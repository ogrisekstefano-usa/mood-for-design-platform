/**
 * KE-004 · P0-3 · Knowledge Impact History · Timeline
 *
 * Render delle decisioni reali dal ledger `knowledge_impact_events`.
 * Ordinate per data discendente · cromia Blueprint Chameleon™.
 */
import React, { useEffect, useState, useCallback } from 'react';
import * as Icons from 'lucide-react';
import KE from '../../lib/knowledgeApi';

function timeAgo(iso) {
  if (!iso) return '—';
  try {
    const now = new Date();
    const t = new Date(iso);
    const sec = Math.max(1, Math.floor((now - t) / 1000));
    if (sec < 60)        return `${sec}s fa`;
    if (sec < 3600)      return `${Math.floor(sec / 60)} min fa`;
    if (sec < 86400)     return `${Math.floor(sec / 3600)} h fa`;
    if (sec < 86400 * 7) return `${Math.floor(sec / 86400)} g fa`;
    return t.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  } catch { return iso?.slice?.(0, 10) || '—'; }
}

const SCOPE_LABEL = {
  only_here: 'solo qui',
  catalog:   'catalogo',
  brand:     'brand',
};

export default function ImpactHistoryTimeline({ setId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (sid) => {
    setLoading(true);
    try {
      const res = await KE.impactHistory(sid, 50);
      setEvents(res.data?.events || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!setId) return;
    load(setId);
  }, [setId, load]);

  return (
    <div className="rw-history" data-testid="rw-impact-history">
      <div className="rw-history__title">
        <Icons.History size={12} /> Decisioni recenti · {events.length}
      </div>

      {loading && (
        <div className="rw-history__loading">Caricamento timeline…</div>
      )}

      {!loading && events.length === 0 && (
        <div
          className="rw-history__empty"
          data-testid="rw-impact-history-empty"
        >
          Nessuna decisione registrata su questo catalogo. Le tue
          certificazioni compariranno qui in tempo reale.
        </div>
      )}

      {!loading && events.length > 0 && (
        <ul className="rw-history__list">
          {events.map((e) => (
            <li
              key={e.id}
              className={`rw-history__item rw-history__item--scope-${e.scope}`}
              data-testid={`rw-impact-event-${e.id}`}
            >
              <span className="rw-history__time">{timeAgo(e.created_at)}</span>
              <div className="rw-history__body">
                <div className="rw-history__line">
                  <span className="rw-history__source">{e.source_input || '—'}</span>
                  <Icons.ArrowRight size={11} className="rw-history__arrow" />
                  <span className="rw-history__target">{e.canonical_target || '—'}</span>
                </div>
                <div className="rw-history__meta">
                  <span className={`rw-history__scope rw-history__scope--${e.scope}`}>
                    {SCOPE_LABEL[e.scope] || e.scope}
                  </span>
                  <span>{e.entity_type}</span>
                  {e.occurrences_corrected > 0 && (
                    <span>· {e.occurrences_corrected} occorrenze</span>
                  )}
                  {e.products_improved > 0 && (
                    <span>· {e.products_improved} prodotti</span>
                  )}
                  {e.images_linked > 0 && (
                    <span>· {e.images_linked} immagini</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
