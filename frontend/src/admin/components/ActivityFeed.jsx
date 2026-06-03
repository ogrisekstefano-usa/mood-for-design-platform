/**
 * ActivityFeed — M3 paginated activity list with filters + pending follow-up.
 * Style aligned to Command Center tokens (bg-black, stone palette, squared
 * borders, text-[10px] uppercase eyebrows). All labels/icons come from the
 * platform_activity_* catalogs via useCatalog — no hardcoded catalog values.
 *
 * Props:
 *   - apiBase    : "${BACKEND}/api/admin/tenants/{tid}" or "${BACKEND}/api/blueprint"
 *   - scope      : "admin" | "founder"
 *   - onEdit(a)
 *   - onCreate()
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import * as Icons from 'lucide-react';
import {
  Plus, Search, RefreshCw, Filter as FilterIcon,
  User, Eye, Inbox, CheckCircle2, Archive, Clock,
} from 'lucide-react';
import useCatalog from '../../lib/useCatalog';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('mood_auth_token') || ''}`,
});

const iconFor = (name) => {
  if (!name) return Clock;
  const key = name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  return Icons[key] || Clock;
};

const fmtDateTime = (iso) => new Date(iso).toLocaleString('it-IT', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

export default function ActivityFeed({ apiBase, scope = 'admin', onEdit, onCreate }) {
  const [items, setItems] = useState([]);
  const [pending, setPending] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    activity_type_code: '', activity_outcome_code: '', source_code: '',
    status: 'all',
  });
  const [showFilters, setShowFilters] = useState(false);

  const types    = useCatalog('activity-types');
  const outcomes = useCatalog('activity-outcomes');
  const sources  = useCatalog('activity-sources');

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const params = { limit: 30, ...filters };
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
      if (!reset && cursor) params.cursor = btoa(JSON.stringify(cursor));
      if (search) params.q = search;
      const url = `${apiBase}/activities/${search ? 'search' : 'v2'}`;
      const { data } = await axios.get(url, { headers: headers(), params });
      setItems(prev => reset ? data.items : [...prev, ...data.items]);
      setCursor(data.next_cursor || null);
    } catch (e) {
      // surface in console; pending error UX
    } finally { setLoading(false); }
  }, [apiBase, cursor, filters, search]);

  const loadPending = useCallback(async () => {
    try {
      const { data } = await axios.get(`${apiBase}/activities/open-followups`,
                                         { headers: headers(), params: { limit: 5 } });
      setPending(data.items || []);
    } catch (e) { /* non-blocking */ }
  }, [apiBase]);

  useEffect(() => {
    setCursor(null); setItems([]); load(true); loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, filters, search]);

  const onSearchSubmit = (e) => {
    e.preventDefault();
    setCursor(null); setItems([]); load(true);
  };

  const renderRow = (a) => {
    // Icon strictly from catalog (platform_activity_types.icon)
    const typeMeta = types.find(t => t.code === a.activity_type_code);
    const Icon = iconFor(a.type_icon || typeMeta?.icon);
    return (
      <div key={a.id} data-testid={`activity-row-${a.id}`}
           onClick={() => onEdit && onEdit(a)}
           className="flex items-start gap-3 px-4 py-3 border-b border-stone-100 hover:bg-stone-50 cursor-pointer last:border-0">
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-stone-200 bg-white">
          <Icon size={14} className="text-stone-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <strong className="text-sm text-stone-900">
              {a.type_label_it || typeMeta?.label_it || a.activity_type_code}
            </strong>
            {a.subject && <span className="text-sm text-stone-700">· {a.subject}</span>}
            {a.activity_outcome_code && (
              <span data-testid={`outcome-chip-${a.id}`}
                    className="text-[10px] uppercase tracking-wider px-2 py-0.5 border"
                    style={{
                      borderColor: a.outcome_color || '#d6d3d1',
                      color: a.outcome_color || '#44403c',
                    }}>
                {a.outcome_label_it || a.activity_outcome_code}
              </span>
            )}
            <span className="ml-auto text-xs text-stone-400 tabular-nums whitespace-nowrap">
              {fmtDateTime(a.occurred_at)}
            </span>
          </div>
          {(a.notes || a.outcome) && (
            <p className="text-xs text-stone-500 mt-1 line-clamp-2">
              {a.notes || a.outcome}
            </p>
          )}
          <div className="text-[10px] uppercase tracking-wider text-stone-400 mt-1.5 flex items-center gap-3 flex-wrap">
            {a.contact_display && (
              <span className="inline-flex items-center gap-1">
                <User size={10} /> {a.contact_display}
              </span>
            )}
            {a.owner_display && (
              <span className="inline-flex items-center gap-1">
                <Eye size={10} /> {a.owner_display}
              </span>
            )}
            {a.source_label_it && (
              <span className="inline-flex items-center gap-1">
                <Inbox size={10} /> {a.source_label_it}
              </span>
            )}
            {a.completed_at && (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 size={10} /> Completata
              </span>
            )}
            {a.archived_at && (
              <span className="inline-flex items-center gap-1 text-stone-400">
                <Archive size={10} /> Archiviata
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div data-testid={`activity-feed-${scope}`} className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <form onSubmit={onSearchSubmit} className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-2.5 text-stone-400" />
          <input data-testid="activity-search-input" type="text"
                 placeholder="Cerca su soggetto, note, esito, prossimo passo…"
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="w-full border border-stone-300 pl-9 pr-3 py-2 text-sm" />
        </form>
        <button data-testid="activity-toggle-filters"
                onClick={() => setShowFilters(v => !v)}
                className="inline-flex items-center gap-1 border border-stone-300 px-3 py-2 text-xs uppercase tracking-wide hover:bg-stone-50">
          <FilterIcon size={12} /> Filtri
        </button>
        <button data-testid="activity-refresh"
                onClick={() => { setCursor(null); setItems([]); load(true); loadPending(); }}
                className="inline-flex items-center gap-1 border border-stone-300 px-3 py-2 text-xs hover:bg-stone-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        <button data-testid="activity-new"
                onClick={() => onCreate && onCreate()}
                className="inline-flex items-center gap-1 bg-black text-white px-3 py-2 text-xs uppercase tracking-wide hover:opacity-90">
          <Plus size={12} /> Nuova attività
        </button>
      </div>

      {showFilters && (
        <div data-testid="activity-filters-panel"
             className="border border-stone-200 bg-stone-50 p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Tipo</label>
            <select value={filters.activity_type_code}
                    data-testid="activity-filter-type"
                    onChange={(e) => setFilters({ ...filters, activity_type_code: e.target.value })}
                    className="w-full border border-stone-300 px-2 py-1.5 text-xs bg-white">
              <option value="">Tutti</option>
              {types.map(t => <option key={t.code} value={t.code}>{t.label_it}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Esito</label>
            <select value={filters.activity_outcome_code}
                    data-testid="activity-filter-outcome"
                    onChange={(e) => setFilters({ ...filters, activity_outcome_code: e.target.value })}
                    className="w-full border border-stone-300 px-2 py-1.5 text-xs bg-white">
              <option value="">Tutti</option>
              {outcomes.map(o => <option key={o.code} value={o.code}>{o.label_it}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Sorgente</label>
            <select value={filters.source_code}
                    data-testid="activity-filter-source"
                    onChange={(e) => setFilters({ ...filters, source_code: e.target.value })}
                    className="w-full border border-stone-300 px-2 py-1.5 text-xs bg-white">
              <option value="">Tutte</option>
              {sources.map(s => <option key={s.code} value={s.code}>{s.label_it}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Stato</label>
            <select value={filters.status}
                    data-testid="activity-filter-status"
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full border border-stone-300 px-2 py-1.5 text-xs bg-white">
              <option value="all">Tutte attive</option>
              <option value="open">Open follow-up</option>
              <option value="completed">Completate</option>
              <option value="archived">Archiviate</option>
            </select>
          </div>
        </div>
      )}

      {/* Pending follow-up */}
      {pending.length > 0 && (
        <section data-testid="activity-pending-section">
          <h3 className="text-[10px] uppercase tracking-wider text-stone-400 mb-2">
            Pending follow-up · {pending.length}
          </h3>
          <div className="border border-stone-300 bg-white">
            {pending.map(renderRow)}
          </div>
        </section>
      )}

      {/* History */}
      <section>
        <h3 className="text-[10px] uppercase tracking-wider text-stone-400 mb-2">
          Storico {filters.status === 'archived' ? 'archiviato' : 'recente'} · {items.length}
        </h3>
        <div className="border border-stone-200 bg-white">
          {items.length === 0 && !loading && (
            <div data-testid="activity-feed-empty"
                 className="px-6 py-12 text-center">
              <Clock size={24} className="text-stone-300 mx-auto mb-3" />
              <p className="text-sm text-stone-500">
                Nessuna attività. Inizia con una chiamata, un meeting o una nota.
              </p>
            </div>
          )}
          {items.map(renderRow)}
        </div>
        {cursor && (
          <div className="flex justify-center pt-3">
            <button data-testid="activity-load-more"
                    onClick={() => load(false)}
                    disabled={loading}
                    className="border border-stone-300 px-4 py-2 text-xs uppercase tracking-wide hover:bg-stone-50 disabled:opacity-50">
              {loading ? 'Caricamento…' : 'Carica altre'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
