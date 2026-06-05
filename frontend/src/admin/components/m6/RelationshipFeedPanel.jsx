/**
 * RelationshipFeedPanel — M6 · Column 2.
 *
 * Riusa M2 endpoint `/timeline` (già unifica events + emails + activities).
 * Inline accordion: click su riga → expand inline (NO drawer, NO modal).
 * Filter chips: All / Activities / Events / Emails / Manual only.
 *
 * Espansione mostra: notes, outcome, next_step, follow-up due, linked contact,
 * owner — tutti dal payload esistente.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import * as Icons from 'lucide-react';
import { Clock, ChevronDown, ChevronRight, Plus, RefreshCw } from 'lucide-react';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('mood_auth_token') || ''}`,
});

const iconFor = (name) => {
  if (!name) return Clock;
  const key = name.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  return Icons[key] || Clock;
};

const SOURCE = {
  event:    { label: 'Evento',   color: '#FF9F0A', bg: 'rgba(255,159,10,0.12)' },
  email:    { label: 'Email',    color: '#A0A0A5', bg: 'rgba(160,160,165,0.12)' },
  activity: { label: 'Attività', color: '#00C9B3', bg: 'rgba(0,201,179,0.12)' },
};

const SOURCE_FILTERS = [
  { key: 'all',      label: 'All',      match: () => true },
  { key: 'activity', label: 'Activities', match: (it) => it.source === 'activity' },
  { key: 'event',    label: 'Events',     match: (it) => it.source === 'event' },
  { key: 'email',    label: 'Emails',     match: (it) => it.source === 'email' },
];

const fmtDay = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDateShort = (iso) => iso ? new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export default function RelationshipFeedPanel({ apiBase, onLogActivity }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [manualOnly, setManualOnly] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const params = { limit: 40 };
      if (!reset && cursor) params.cursor = cursor;
      if (manualOnly) params.manual_only = 1;
      const { data } = await axios.get(`${apiBase}/timeline`, { headers: headers(), params });
      setItems((prev) => reset ? data.items : [...prev, ...data.items]);
      setCursor(data.next_cursor || null);
    } catch (e) {
      // non-blocking
    } finally { setLoading(false); }
  }, [apiBase, cursor, manualOnly]);

  useEffect(() => {
    setCursor(null); setItems([]); load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, manualOnly]);

  const filtered = useMemo(() => {
    const matcher = SOURCE_FILTERS.find((f) => f.key === filter)?.match || (() => true);
    return items.filter(matcher);
  }, [items, filter]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((it) => {
      const day = (it.at || '').slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(it);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const toggle = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div data-testid="m6-feed-panel" className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 sticky top-0 bg-[#0A0A0B] z-[5]">
        <h3 className="text-[10.5px] uppercase tracking-[0.14em] text-stone-400 font-medium">
          Relationship Feed <span className="tabular-nums text-stone-500 ml-1">· {filtered.length}</span>
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => { setCursor(null); load(true); }}
                  data-testid="m6-feed-refresh"
                  className="text-[10.5px] uppercase tracking-wider px-2 py-1 border border-stone-300 hover:bg-stone-100">
            <RefreshCw size={11} className={`inline ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onLogActivity}
                  data-testid="m6-feed-log"
                  className="text-[10.5px] uppercase tracking-wider px-3 py-1 bg-black text-white">
            <Plus size={11} className="inline mr-1" />Log
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-stone-100 flex-wrap">
        {SOURCE_FILTERS.map((f) => (
          <button key={f.key}
                  data-testid={`m6-feed-filter-${f.key}`}
                  onClick={() => setFilter(f.key)}
                  className={`text-[10.5px] uppercase tracking-wider px-2.5 py-1 border rounded-full transition-colors ${
                    filter === f.key
                      ? 'bg-[#00C9B3] text-black border-[#00C9B3]'
                      : 'border-stone-300 text-stone-500 hover:text-stone-900'
                  }`}>
            {f.label}
          </button>
        ))}
        <label className="ml-auto inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-stone-500 cursor-pointer">
          <input type="checkbox"
                 data-testid="m6-feed-manual-only"
                 checked={manualOnly}
                 onChange={(e) => setManualOnly(e.target.checked)} />
          Manual only
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {filtered.length === 0 && !loading && (
          <div data-testid="m6-feed-empty" className="px-3 py-16 text-center text-[12px] text-stone-400">
            Nessun evento per i filtri selezionati.<br />
            <button onClick={onLogActivity} className="text-[#00C9B3] underline mt-2 hover:opacity-80">
              + Logga la prima attività
            </button>
          </div>
        )}

        {grouped.map(([day, list]) => (
          <section key={day} data-testid={`m6-feed-day-${day}`}>
            <h4 className="text-[9.5px] uppercase tracking-[0.14em] text-stone-400 mt-4 mb-1 sticky top-0 bg-[#0A0A0B] py-1">
              {fmtDay(day + 'T00:00:00')}
            </h4>
            <div className="space-y-1">
              {list.map((it) => {
                const key = `${it.source}-${it.id}`;
                const isOpen = expanded.has(key);
                const Icon = iconFor(it.icon);
                const src = SOURCE[it.source] || SOURCE.activity;
                return (
                  <div key={key}
                       data-testid={`m6-feed-item-${it.id}`}
                       className={`rounded transition-colors border-l-2 ${
                         isOpen ? 'bg-stone-50 border-[#00C9B3]' : 'border-transparent hover:bg-stone-50'
                       }`}>
                    <button onClick={() => toggle(key)}
                            data-testid={`m6-feed-toggle-${it.id}`}
                            className="w-full text-left flex items-start gap-2.5 px-3 py-2.5">
                      <div className="flex-shrink-0 mt-0.5">
                        {isOpen
                          ? <ChevronDown size={12} className="text-stone-400" />
                          : <ChevronRight size={12} className="text-stone-400" />}
                      </div>
                      <div className="flex-shrink-0 w-7 h-7 rounded border border-stone-300 bg-stone-100 inline-flex items-center justify-center">
                        <Icon size={13} className="text-stone-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <strong className="text-[13px] font-medium">{it.label_it || it.type_code}</strong>
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 border rounded"
                                style={{ color: src.color, borderColor: `${src.color}55`, background: src.bg }}>
                            {src.label}
                          </span>
                          <span className="ml-auto text-[10.5px] tabular-nums text-stone-400 whitespace-nowrap">{fmtTime(it.at)}</span>
                        </div>
                        {it.subject && (
                          <p className="text-[12px] text-stone-600 mt-0.5 line-clamp-2 break-words">{it.subject}</p>
                        )}
                        <div className="text-[10px] uppercase tracking-wider text-stone-400 mt-1 flex items-center gap-3 flex-wrap">
                          {it.owner_display && <span>Owner · <strong className="text-stone-700 normal-case tracking-normal">{it.owner_display}</strong></span>}
                          {it.outcome_label_it && <span>Esito · <strong className="normal-case tracking-normal" style={{ color: it.outcome_color || '#32D74B' }}>{it.outcome_label_it}</strong></span>}
                          {it.contact_display && <span>Contact · <strong className="text-stone-700 normal-case tracking-normal">{it.contact_display}</strong></span>}
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div data-testid={`m6-feed-expanded-${it.id}`}
                           className="mx-3 mb-3 mt-1 px-3 py-2.5 bg-stone-100 border-l-2 border-[#00C9B3] text-[12px] text-stone-600 leading-relaxed">
                        {it.notes && <p className="whitespace-pre-wrap mb-2">{it.notes}</p>}
                        {it.next_step && (
                          <div className="flex items-baseline gap-3 mt-2">
                            <span className="text-[9.5px] uppercase tracking-wider text-stone-400 min-w-[90px]">Next step</span>
                            <span className="text-stone-700">{it.next_step}</span>
                          </div>
                        )}
                        {it.next_step_due_at && (
                          <div className="flex items-baseline gap-3 mt-1">
                            <span className="text-[9.5px] uppercase tracking-wider text-stone-400 min-w-[90px]">Follow-up</span>
                            <span className="tabular-nums text-stone-700">{fmtDateShort(it.next_step_due_at)}</span>
                          </div>
                        )}
                        {it.source_label_it && (
                          <div className="flex items-baseline gap-3 mt-1">
                            <span className="text-[9.5px] uppercase tracking-wider text-stone-400 min-w-[90px]">Source</span>
                            <span className="text-stone-700">{it.source_label_it}</span>
                          </div>
                        )}
                        {!it.notes && !it.next_step && !it.next_step_due_at && (
                          <span className="text-stone-400 text-[11px] italic">Nessun dettaglio aggiuntivo.</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {cursor && (
          <div className="flex justify-center pt-3">
            <button onClick={() => load(false)}
                    data-testid="m6-feed-load-more"
                    disabled={loading}
                    className="border border-stone-300 px-3 py-1.5 text-[10.5px] uppercase tracking-wider hover:bg-stone-100 disabled:opacity-50">
              {loading ? 'Caricamento…' : 'Carica altri'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
