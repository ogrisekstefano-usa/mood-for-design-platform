/**
 * TimelineFeed — Relationship Timeline (M2).
 *
 * Unified chronological view of lifecycle events, whitelisted email dispatches
 * and manual quick-action activities. Style aligned to Command Center tokens:
 * bg-black for active state, border-stone-300/200/100, text-[10px] uppercase
 * tracking-wider eyebrows, squared borders, monochrome palette.
 *
 * Labels/icons come from the timeline API + platform_*_event_types /
 * platform_activity_types catalogs (filter-options endpoint). The only
 * UI-internal labels are the three timeline source domains
 * (event / email / activity), which are not catalog data.
 *
 * Props:
 *   - apiBase: `${BACKEND}/api/admin/tenants/{tid}` | `${BACKEND}/api/blueprint`
 *   - scope:  'admin' | 'founder'
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

// Timeline source domain labels (UI-internal; not catalog data).
const SOURCE_LABELS = {
  event:    'Eventi',
  email:    'Email',
  activity: 'Attività',
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
  const [sourceFilter, setSourceFilter] = useState([]);
  const [typeFilter, setTypeFilter] = useState([]);
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

  const activeCount = sourceFilter.length + typeFilter.length + (manualOnly ? 1 : 0);

  return (
    <div data-testid={tid} className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-stone-400">
          {items.length === 0 && !loading
            ? 'Nessun evento ancora registrato per questo tenant.'
            : <>Visualizzati <strong className="text-white">{items.length}</strong> eventi</>}
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="timeline-toggle-filters"
                  onClick={() => setShowFilters(v => !v)}
                  className="inline-flex items-center gap-2 border border-stone-300 px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-stone-50">
            <FilterIcon size={12} />
            Filtri {activeCount > 0 ? `(${activeCount})` : ''}
          </button>
          <button data-testid="timeline-refresh"
                  onClick={() => { setCursor(null); setItems([]); load(true); loadFilterOptions(); }}
                  className="inline-flex items-center gap-2 border border-stone-300 px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-stone-50">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Aggiorna
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div data-testid="timeline-filters-panel"
             className="border border-stone-200 bg-stone-50 p-4 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-2">Sorgente</div>
            <div className="flex flex-wrap items-center gap-2">
              {(filterOptions.sources || []).map(s => (
                <button key={s}
                        data-testid={`timeline-source-${s}`}
                        onClick={() => toggleSource(s)}
                        className={`text-[11px] px-2 py-1 border uppercase tracking-wide ${
                          sourceFilter.includes(s)
                            ? 'border-black bg-black text-white'
                            : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'}`}>
                  {SOURCE_LABELS[s] || s}
                </button>
              ))}
              <label className="ml-2 flex items-center gap-2 text-[11px] text-stone-700">
                <input type="checkbox" data-testid="timeline-manual-only"
                       checked={manualOnly}
                       onChange={(e) => setManualOnly(e.target.checked)} />
                Solo manuali
              </label>
              {activeCount > 0 && (
                <button onClick={clearFilters}
                        data-testid="timeline-clear-filters"
                        className="ml-auto inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-stone-500 hover:text-stone-900">
                  <XIcon size={11} /> Reset
                </button>
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-2">Tipo evento</div>
            <div className="flex flex-wrap items-center gap-2">
              {(filterOptions.type_codes || []).slice(0, 16).map(t => (
                <button key={`${t.source}-${t.type_code}`}
                        data-testid={`timeline-type-${t.type_code}`}
                        onClick={() => toggleType(t.type_code)}
                        className={`text-[11px] px-2 py-1 border ${
                          typeFilter.includes(t.type_code)
                            ? 'border-black bg-black text-white'
                            : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'}`}>
                  {t.label_it || t.type_code}
                  <span className="ml-1 opacity-60 tabular-nums">({t.occurrences})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div data-testid="timeline-error"
             className="border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {String(error)}
        </div>
      )}

      {/* Empty state */}
      {grouped.length === 0 && !loading && !error && (
        <div data-testid="timeline-empty"
             className="border border-stone-300 bg-white px-10 py-16 text-center">
          <Clock size={28} className="text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-500">Nessun evento per i filtri selezionati.</p>
        </div>
      )}

      {/* Items grouped by day */}
      {grouped.map(([day, list]) => (
        <section key={day} data-testid={`timeline-day-${day}`} className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-wider text-stone-400">
            {fmtDay(day + 'T00:00:00')}
          </h3>
          <div className="border border-stone-200 bg-white p-4">
            <ul className="border-l border-stone-200 pl-4 space-y-3">
              {list.map((it) => {
                const Icon = iconFor(it.icon);
                return (
                  <li key={`${it.source}-${it.id}`}
                      data-testid={`timeline-item-${it.id}`}
                      className="relative flex items-start gap-3">
                    <span className="absolute -left-[18px] top-2.5 w-2 h-2 bg-stone-400" />
                    <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center border border-stone-200 bg-white">
                      <Icon size={14} className="text-stone-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-medium text-stone-900">
                          {it.label_it || it.type_code}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-stone-400">
                          {SOURCE_LABELS[it.source] || it.source}
                        </span>
                        <span className="ml-auto text-xs text-stone-400 tabular-nums whitespace-nowrap">
                          {fmtTime(it.at)}
                        </span>
                      </div>
                      {it.subject && (
                        <p className="text-sm text-stone-600 mt-0.5 break-words">{it.subject}</p>
                      )}
                      {it.owner_display && (
                        <p className="text-[10px] uppercase tracking-wider text-stone-400 mt-1">
                          Owner · <span className="text-stone-700 normal-case tracking-normal">{it.owner_display}</span>
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ))}

      {cursor && !error && (
        <div className="flex justify-center pt-2">
          <button data-testid="timeline-load-more"
                  onClick={() => load(false)}
                  disabled={loading}
                  className="border border-stone-300 px-4 py-2 text-xs uppercase tracking-wide hover:bg-stone-50 disabled:opacity-50">
            {loading ? 'Caricamento…' : 'Carica altri'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TimelineFeed;
