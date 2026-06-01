/**
 * RelationshipLiveTimeline — ITER150 Sprint A + Sprint F · F4 Realtime
 *
 * Living relational memory layer. NOT a feed, NOT an activity wall.
 * Editorial sentences appearing as the relationship breathes.
 *
 *   Sofia ha completato il briefing iniziale.   ·  2 min fa
 *   Marco è tornato sul moodboard dopo 3 giorni. ·  ora
 *
 * Sprint F · F4 behavior:
 *   - Realtime subscribe to `relationship_events:tenant_id=eq.<tid>`
 *   - On INSERT push → delta re-fetch via REST (authoritative
 *     permission filtering stays on the server)
 *   - 15s safety-net polling
 *   - Editorial grouping: Oggi · Ieri · Prima
 *   - Smart auto-scroll guard 96px (reuses F2 pattern):
 *       · at fresh edge → soft fade-in of new memories
 *       · away from edge → sticky pill "↓ un nuovo movimento"
 *   - `.rl-event--fresh` 420ms cubic-bezier emergence (opacity +
 *     translateY 6px + tiny blur dissolve). NO scale, NO spring.
 *
 * Timeline order: reverse-chronological (most recent at top).
 * "Fresh edge" = scroll position near TOP. Pill direction `↑`.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { getDesignerTimeline } from '../../lib/relationshipEngine';
import { subscribe } from '../../lib/realtimeBus';
import { useAuth } from '../../contexts/AuthContext';
import './relationship-live-timeline.css';

const POLL_MS = 15000;                 // F4 · realtime is primary
const SCROLL_THRESHOLD = 96;           // px from top = "at fresh edge"

const ICON_FOR = {
  briefing_completed:        '◐',
  briefing_started:          '◯',
  message_sent:              '✎',
  call_requested:            '☎',
  moodboard_viewed:          '◇',
  proposal_opened:           '▤',
  approval_requested:        '⌁',
  approval_confirmed:        '✓',
  designer_assigned:         '◈',
  designer_changed:          '◈',
  timeline_progressed:       '→',
  file_uploaded:             '⬆',
  client_returned:           '⤺',
  project_direction_updated: '✦',
  status_changed:            '◉',
  journey_resumed:           '⤴',
};

const fmtAgo = (iso, locale = 'it') => {
  if (!iso) return '';
  const sec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return locale === 'it' ? 'ora' : 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return locale === 'it' ? `${min} min fa` : `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return locale === 'it' ? `${h} ore fa` : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return locale === 'it' ? 'ieri' : 'yesterday';
  if (d < 30) return locale === 'it' ? `${d} g fa` : `${d}d ago`;
  return locale === 'it' ? `${Math.floor(d / 30)} mesi fa` : `${Math.floor(d / 30)}mo ago`;
};

const BUCKETS = {
  it: { today: 'Oggi', yesterday: 'Ieri', earlier: 'Prima' },
  en: { today: 'Today', yesterday: 'Yesterday', earlier: 'Earlier' },
};

const bucketize = (events) => {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const yesterday = today - 86400 * 1000;
  const out = { today: [], yesterday: [], earlier: [] };
  for (const ev of events) {
    const t = new Date(ev.occurred_at).getTime();
    if (t >= today) out.today.push(ev);
    else if (t >= yesterday) out.yesterday.push(ev);
    else out.earlier.push(ev);
  }
  return out;
};

const RelationshipLiveTimeline = ({ locale = 'it' }) => {
  const [events, setEvents] = useState([]);
  const [polledAt, setPolledAt] = useState(null);
  const [error, setError] = useState(null);
  const [empty, setEmpty] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const lastSeenRef = useRef(null);          // most-recent occurred_at we have
  const pollingRef = useRef(null);
  const scrollRef = useRef(null);
  const freshIdsRef = useRef(new Set());     // ids to animate as fresh
  const { user } = useAuth();
  const tenantId = user?.tenant_id || null;
  const L = BUCKETS[locale] || BUCKETS.it;

  const isAtFreshEdge = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollTop <= SCROLL_THRESHOLD;
  };

  /* ── DELTA FETCH (used by polling + realtime) ────────────────
   * Always goes through the REST endpoint so permissions stay
   * authoritative on the server. Realtime is only a trigger. */
  const fetchDelta = useCallback(async (isFirst = false) => {
    try {
      const params = isFirst ? {} : { since: lastSeenRef.current || undefined };
      const { data } = await getDesignerTimeline(params);
      const incoming = data?.data || [];
      let injectedFresh = 0;

      if (isFirst) {
        setEvents(incoming);
        setEmpty(incoming.length === 0);
      } else if (incoming.length) {
        setEvents(prev => {
          const ids = new Set(prev.map(e => e.id));
          const additions = incoming.filter(e => !ids.has(e.id));
          additions.forEach(e => freshIdsRef.current.add(e.id));
          injectedFresh = additions.length;
          // newest first (reverse-chronological)
          return [...additions, ...prev].slice(0, 80);
        });
        setEmpty(false);
      }

      if (incoming.length) lastSeenRef.current = incoming[0].occurred_at;
      setPolledAt(data?.polled_at || new Date().toISOString());
      setError(null);

      // If the user is reading older memories, raise the pill instead of
      // silently appending new visual weight without their consent.
      if (!isFirst && injectedFresh > 0 && !isAtFreshEdge()) {
        setPendingCount(p => p + injectedFresh);
      } else if (!isFirst && injectedFresh > 0) {
        // at edge → keep view stable; the fresh class handles the emergence
        setPendingCount(0);
      }
    } catch (e) {
      setError(e?.response?.status === 401 ? 'auth' : 'net');
    }
  }, []);

  /* ── INITIAL LOAD + 15s SAFETY-NET POLLING ─────────────────── */
  useEffect(() => {
    fetchDelta(true);
    pollingRef.current = setInterval(() => fetchDelta(false), POLL_MS);
    return () => clearInterval(pollingRef.current);
  }, [fetchDelta]);

  /* ── REALTIME (primary) ─────────────────────────────────────
   * Subscribe to tenant-scoped INSERTs. We don't trust the raw
   * payload directly; we re-fetch through the API to keep
   * authoritative permission filtering. */
  useEffect(() => {
    if (!tenantId) return undefined;
    const unsub = subscribe({
      key: `events:${tenantId}`,
      table: 'relationship_events',
      event: 'INSERT',
      filter: `tenant_id=eq.${tenantId}`,
      onPayload: () => {
        queueMicrotask(() => fetchDelta(false));
      },
    });
    return unsub;
  }, [tenantId, fetchDelta]);

  /* ── REFRESH RELATIVE TIMESTAMPS EVERY 30s ─────────────────── */
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  /* ── PILL · "↑ un nuovo movimento" ──────────────────────────
   * Reset pending counter when reader returns to the fresh edge. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onScroll = () => { if (el.scrollTop <= SCROLL_THRESHOLD) setPendingCount(0); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const jumpToEdge = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: 'smooth' });
    setPendingCount(0);
  };

  const buckets = useMemo(() => bucketize(events), [events]);
  const ordered = [
    ['today',     buckets.today],
    ['yesterday', buckets.yesterday],
    ['earlier',   buckets.earlier],
  ];

  return (
    <section className="rl-timeline" data-testid="relationship-live-timeline">
      <header className="rl-timeline__head">
        <div>
          <p className="rl-timeline__eyebrow">{locale === 'it' ? 'Attività relazioni' : 'Relationship activity'}</p>
          <h3 className="rl-timeline__title">
            {locale === 'it' ? 'Timeline relazioni' : 'Relationships timeline'}
          </h3>
        </div>
        <span className="rl-timeline__pulse" aria-hidden="true" title={polledAt || ''}>
          <span className="rl-timeline__pulse-dot" />
          {locale === 'it' ? 'LIVE' : 'LIVE'}
        </span>
      </header>

      {error === 'auth' && (
        <p className="rl-timeline__hint" data-testid="rl-timeline-auth-hint">
          {locale === 'it' ? 'Accedi per vedere la tua timeline.' : 'Sign in to see your timeline.'}
        </p>
      )}

      {empty && !error && (
        <div className="rl-timeline__empty" data-testid="rl-timeline-empty">
          <p>
            {locale === 'it'
              ? 'Nessun movimento ancora. Quando la relazione respirerà, le memorie emergeranno qui.'
              : 'No movement yet. When the relationship breathes, memories will surface here.'}
          </p>
        </div>
      )}

      <div className="rl-timeline__viewport" ref={scrollRef} data-testid="rl-timeline-viewport">
        {pendingCount > 0 && (
          <button
            type="button"
            className="rl-new-movement"
            onClick={jumpToEdge}
            data-testid="rl-new-movement-pill"
          >
            <ArrowUp size={12} strokeWidth={1.7} />
            <span>
              {locale === 'it'
                ? (pendingCount === 1 ? 'un nuovo movimento' : `${pendingCount} nuovi movimenti`)
                : (pendingCount === 1 ? 'a new movement' : `${pendingCount} new movements`)}
            </span>
          </button>
        )}

        {ordered.map(([bk, arr]) => arr.length > 0 && (
          <section className="rl-bucket" key={bk}>
            <p className="rl-bucket__head">{L[bk]}</p>
            <ol className="rl-timeline__list">
              {arr.map((ev) => {
                const fresh = freshIdsRef.current.has(ev.id);
                return (
                  <li
                    key={ev.id}
                    className={`rl-event ${fresh ? 'rl-event--fresh' : ''}`}
                    data-testid={`rl-event-${ev.event_type}`}
                  >
                    <span className="rl-event__glyph" aria-hidden="true">{ICON_FOR[ev.event_type] || '·'}</span>
                    <div className="rl-event__body">
                      <p className="rl-event__narrative">{ev.narrative}</p>
                      <p className="rl-event__meta">
                        <span className="rl-event__when">{fmtAgo(ev.occurred_at, locale)}</span>
                        {ev.actor_label ? <span className="rl-event__sep">·</span> : null}
                        {ev.actor_label ? <span className="rl-event__actor">{ev.actor_label}</span> : null}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
};

export default RelationshipLiveTimeline;
