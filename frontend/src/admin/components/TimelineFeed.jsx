/**
 * TimelineFeed — Relationship Timeline (M2).
 *
 * Unified chronological view of:
 *   - lifecycle / relationship events
 *   - whitelisted email dispatches (D5)
 *   - manual quick-action activities
 *
 * Used by:
 *   - Admin: /command-center/tenants/{tid}?tab=timeline
 *   - Founder: /blueprint?tab=timeline (via the same component, apiBase prop)
 *
 * Props:
 *   - apiBase: base URL for timeline endpoint
 *       Admin:   `${BACKEND}/api/admin/tenants/{tid}`
 *       Founder: `${BACKEND}/api/blueprint`
 *   - scope:  'admin' | 'founder'  (for testids only)
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import * as Icons from 'lucide-react';
import { Clock, RefreshCw, Filter as FilterIcon, X as XIcon } from 'lucide-react';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('mood_auth_token') || ''}`,
});

const iconFor = (name) => {
  if (!name) return Clock;
  const key = name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
  return Icons[key] || Clock;
};

const SOURCE_LABELS = {
  event:    { it: 'Eventi',   en: 'Events' },
  email:    { it: 'Email',    en: 'Emails' },
  activity: { it: 'Attività', en: 'Activities' },
};

const fmtDay = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
};
const fmtTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
};

const TimelineFeed = ({ apiBase, scope = 'admin' }) => {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ sources: [], type_codes: [] });
  const [sourceFilter, setSourceFilter] = useState([]);   // active sources
  const [typeFilter, setTypeFilter] = useState([]);       // active type_codes
  const [manualOnly, setManualOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const tid = `timeline-${scope}`;

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: 30 };
      if (!reset && cursor) params.cursor = cursor;
      if (sourceFilter.length) params.sources = sourceFilter.join(',');
      if (typeFilter.length)   params.type_codes = typeFilter.join(',');
      if (manualOnly)          params.manual_only = 1;
      const { data } = await axios.get(`${apiBase}/timeline`, { headers: headers(), params });
      setItems(prev => reset ? data.items : [...prev, ...data.items]);
      setCursor(data.next_cursor || null);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Errore caricamento timeline');
    } finally {
      setLoading(false);
    }
  }, [apiBase, cursor, sourceFilter, typeFilter, manualOnly]);

  const loadFilterOptions = useCallback(async () => {
    try {
      const { data } = await axios.get(`${apiBase}/timeline/filter-options`,
                                        { headers: headers() });
      setFilterOptions(data || { sources: [], type_codes: [] });
    } catch (e) {
      // non-blocking
    }
  }, [apiBase]);

  // (re)load on filter change
  useEffect(() => {
    setCursor(null);
    setItems([]);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFilter, typeFilter, manualOnly, apiBase]);

  useEffect(() => { loadFilterOptions(); }, [loadFilterOptions]);

  const grouped = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const day = (it.at || '').slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(it);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [items]);

  const toggleSource = (s) =>
    setSourceFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleType = (t) =>
    setTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const clearFilters = () => {
    setSourceFilter([]); setTypeFilter([]); setManualOnly(false);
  };

  return (
    <div data-testid={tid} className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-stone-500">
          {items.length === 0 && !loading
            ? 'Nessun evento ancora registrato per questo tenant.'
            : <>Visualizzati <strong className="text-stone-900">{items.length}</strong> eventi</>}
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="timeline-toggle-filters"
                  onClick={() => setShowFilters(v => !v)}
                  className="flex items-center gap-2 border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-50">
            <FilterIcon size={12} />
            Filtri {(sourceFilter.length + typeFilter.length + (manualOnly ? 1 : 0)) > 0
              ? `(${sourceFilter.length + typeFilter.length + (manualOnly ? 1 : 0)})`
              : ''}
          </button>
          <button data-testid="timeline-refresh"
                  onClick={() => { setCursor(null); setItems([]); load(true); loadFilterOptions(); }}
                  className="flex items-center gap-2 border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-50">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Aggiorna
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div data-testid="timeline-filters-panel" className="border border-stone-200 bg-stone-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-stone-500 mr-2">Sorgente</span>
            {(filterOptions.sources || []).map(s => (
              <button key={s}
                      data-testid={`timeline-source-${s}`}
                      onClick={() => toggleSource(s)}
                      className={`text-[11px] px-2 py-1 border ${
                        sourceFilter.includes(s)
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : 'border-stone-300 hover:bg-white'}`}>
                {(SOURCE_LABELS[s] || { it: s }).it}
              </button>
            ))}
            <label className="ml-4 flex items-center gap-2 text-[11px] text-stone-600">
              <input type="checkbox" data-testid="timeline-manual-only"
                     checked={manualOnly}
                     onChange={(e) => setManualOnly(e.target.checked)} />
              Solo manuali
            </label>
            {(sourceFilter.length + typeFilter.length + (manualOnly ? 1 : 0)) > 0 && (
              <button onClick={clearFilters}
                      data-testid="timeline-clear-filters"
                      className="ml-auto text-[11px] text-stone-500 hover:text-stone-900 flex items-center gap-1">
                <XIcon size={11} /> Reset
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-stone-500 mr-2">Tipo evento</span>
            {(filterOptions.type_codes || []).slice(0, 16).map(t => (
              <button key={`${t.source}-${t.type_code}`}
                      data-testid={`timeline-type-${t.type_code}`}
                      onClick={() => toggleType(t.type_code)}
                      className={`text-[11px] px-2 py-1 border ${
                        typeFilter.includes(t.type_code)
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : 'border-stone-300 hover:bg-white'}`}>
                {t.label_it || t.type_code}
                <span className="ml-1 opacity-60 tabular-nums">({t.occurrences})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div data-testid="timeline-error"
             className="border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {String(error)}
        </div>
      )}

      {/* Items grouped by day */}
      {grouped.length === 0 && !loading && !error && (
        <div data-testid="timeline-empty"
             className="border border-dashed border-stone-300 px-10 py-16 text-center">
          <Clock size={28} className="text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-500">Nessun evento per i filtri selezionati.</p>
        </div>
      )}

      {grouped.map(([day, list]) => (
        <section key={day} data-testid={`timeline-day-${day}`} className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-wider text-stone-400 font-medium">
            {fmtDay(day + 'T00:00:00')}
          </h3>
          <ul className="border-l border-stone-200 pl-4 space-y-3">
            {list.map((it) => {
              const Icon = iconFor(it.icon);
              const color = it.color || (it.source === 'activity' ? '#0f172a'
                                       : it.source === 'email'    ? '#64748b'
                                                                  : '#3b82f6');
              return (
                <li key={`${it.source}-${it.id}`}
                    data-testid={`timeline-item-${it.id}`}
                    className="relative flex items-start gap-3">
                  <span className="absolute -left-[19px] top-2 w-3 h-3 rounded-full border-2 bg-white"
                        style={{ borderColor: color }} />
                  <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded bg-stone-100">
                    <Icon size={14} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-stone-900">
                        {it.label_it || it.type_code}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-stone-400">
                        {(SOURCE_LABELS[it.source] || { it: it.source }).it}
                      </span>
                      <span className="ml-auto text-xs text-stone-400 tabular-nums">
                        {fmtTime(it.at)}
                      </span>
                    </div>
                    {it.subject && (
                      <p className="text-sm text-stone-600 mt-0.5">{it.subject}</p>
                    )}
                    {it.owner_display && (
                      <p className="text-xs text-stone-400 mt-0.5">
                        Owner: <span className="text-stone-600">{it.owner_display}</span>
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {cursor && !error && (
        <div className="flex justify-center pt-2">
          <button data-testid="timeline-load-more"
                  onClick={() => load(false)}
                  disabled={loading}
                  className="border border-stone-300 px-4 py-2 text-xs hover:bg-stone-50 disabled:opacity-50">
            {loading ? 'Caricamento…' : 'Carica altri'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TimelineFeed;
