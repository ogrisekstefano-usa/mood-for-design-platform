/**
 * RelationshipLiveTimeline — ITER150 Sprint A
 *
 * Editorial live feed of relationship events for the designer workspace.
 * NOT a log, NOT a CRM table — narrative sentences with subtle relative
 * timestamps. Polls /api/relationship-engine/timeline every 5s.
 *
 *   Sofia ha completato il briefing iniziale.   ·  2 min fa
 *   Marco è tornato sul moodboard dopo 3 giorni. ·  ora
 *   Elena ha richiesto una call · 2 slot proposti. · 5 min fa
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getDesignerTimeline } from '../../lib/relationshipEngine';
import './relationship-live-timeline.css';

const POLL_MS = 5000;

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
  const then = new Date(iso).getTime();
  const sec = Math.max(1, Math.floor((Date.now() - then) / 1000));
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

const RelationshipLiveTimeline = ({ locale = 'it' }) => {
  const [events, setEvents] = useState([]);
  const [polledAt, setPolledAt] = useState(null);
  const [error, setError] = useState(null);
  const [empty, setEmpty] = useState(false);
  const lastSeenRef = useRef(null);
  const pollingRef = useRef(null);

  const poll = useCallback(async (isFirst = false) => {
    try {
      const params = isFirst ? {} : { since: lastSeenRef.current || undefined };
      const { data } = await getDesignerTimeline(params);
      const incoming = data?.data || [];
      if (isFirst) {
        setEvents(incoming);
        setEmpty(incoming.length === 0);
      } else if (incoming.length) {
        setEvents(prev => {
          const ids = new Set(prev.map(e => e.id));
          const merged = [...incoming.filter(e => !ids.has(e.id)), ...prev];
          return merged.slice(0, 80);
        });
        setEmpty(false);
      }
      if (incoming.length) lastSeenRef.current = incoming[0].occurred_at;
      setPolledAt(data?.polled_at || new Date().toISOString());
      setError(null);
    } catch (e) {
      setError(e?.response?.status === 401 ? 'auth' : 'net');
    }
  }, []);

  useEffect(() => {
    poll(true);
    pollingRef.current = setInterval(() => poll(false), POLL_MS);
    return () => clearInterval(pollingRef.current);
  }, [poll]);

  // re-render every 30s to keep relative timestamps fresh
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="rl-timeline" data-testid="relationship-live-timeline">
      <header className="rl-timeline__head">
        <div>
          <p className="rl-timeline__eyebrow">{locale === 'it' ? 'Vita relazionale' : 'Living relationships'}</p>
          <h3 className="rl-timeline__title">
            {locale === 'it' ? 'Cosa sta accadendo ora' : 'What is happening now'}
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
              ? 'Nessuna attività ancora. Quando i tuoi clienti interagiranno, vedrai qui i loro gesti in tempo reale.'
              : 'No activity yet. When your clients engage, their gestures will appear here in real time.'}
          </p>
        </div>
      )}

      <ol className="rl-timeline__list">
        {events.map((ev) => (
          <li key={ev.id} className="rl-event" data-testid={`rl-event-${ev.event_type}`}>
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
        ))}
      </ol>
    </section>
  );
};

export default RelationshipLiveTimeline;
