/**
 * ActivityFeed — M3 paginated activity list with filters + pending follow-up section.
 *
 * Props:
 *   - apiBase    : "${BACKEND}/api/admin/tenants/{tid}" or "${BACKEND}/api/blueprint"
 *   - scope      : "admin" | "founder"
 *   - onEdit(a)
 *   - onCreate()
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Phone, Mail, MessageCircle, Linkedin, Users, MapPin,
         FileText, CheckSquare, Plus, Search, RefreshCw, Filter as FilterIcon } from 'lucide-react';
import useCatalog from '../../lib/useCatalog';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('mood_auth_token') || ''}`,
});

const ICONS = {
  call: Phone, email: Mail, whatsapp: MessageCircle, linkedin: Linkedin,
  meeting: Users, visit: MapPin, internal_note: FileText, task: CheckSquare,
};

const fmtDateTime = (iso) => new Date(iso).toLocaleString('it-IT', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
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
    const Icon = ICONS[a.activity_type_code] || FileText;
    return (
      <div key={a.id} data-testid={`activity-row-${a.id}`}
           onClick={() => onEdit && onEdit(a)}
           className="flex items-start gap-3 px-4 py-3 border-b border-stone-100 hover:bg-stone-50 cursor-pointer last:border-0">
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded bg-stone-100">
          <Icon size={14} className="text-stone-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <strong className="text-sm">{a.type_label_it || a.activity_type_code}</strong>
            {a.subject && <span className="text-sm text-stone-700">· {a.subject}</span>}
            {a.activity_outcome_code && (
              <span data-testid={`outcome-chip-${a.id}`}
                    className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ backgroundColor: (a.outcome_color || '#94a3b8') + '22',
                             color: a.outcome_color || '#475569' }}>
                {a.outcome_label_it || a.activity_outcome_code}
              </span>
            )}
            <span className="ml-auto text-xs text-stone-400 tabular-nums">
              {fmtDateTime(a.occurred_at)}
            </span>
          </div>
          {(a.notes || a.outcome) && (
            <p className="text-xs text-stone-500 mt-1 line-clamp-2">
              {a.notes || a.outcome}
            </p>
          )}
          <div className="text-[10px] text-stone-400 mt-1 flex items-center gap-3">
            {a.contact_display && <span>👤 {a.contact_display}</span>}
            {a.owner_display && <span>👁 {a.owner_display}</span>}
            {a.source_label_it && <span>📥 {a.source_label_it}</span>}
            {a.completed_at && <span className="text-emerald-600">✓ Completata</span>}
            {a.archived_at && <span className="text-stone-400">⊘ Archiviata</span>}
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
                className="flex items-center gap-1 border border-stone-300 px-3 py-2 text-xs hover:bg-stone-50">
          <FilterIcon size={12} /> Filtri
        </button>
        <button data-testid="activity-refresh"
                onClick={() => { setCursor(null); setItems([]); load(true); loadPending(); }}
                className="flex items-center gap-1 border border-stone-300 px-3 py-2 text-xs hover:bg-stone-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        <button data-testid="activity-new"
                onClick={() => onCreate && onCreate()}
                className="flex items-center gap-1 bg-stone-900 text-white px-3 py-2 text-xs hover:bg-stone-800">
          <Plus size={12} /> Nuova attività
        </button>
      </div>

      {showFilters && (
        <div data-testid="activity-filters-panel"
             className="border border-stone-200 bg-stone-50 p-4 grid grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500">Tipo</label>
            <select value={filters.activity_type_code}
                    data-testid="activity-filter-type"
                    onChange={(e) => setFilters({ ...filters, activity_type_code: e.target.value })}
                    className="w-full border border-stone-300 px-2 py-1.5 text-xs">
              <option value="">Tutti</option>
              {types.map(t => <option key={t.code} value={t.code}>{t.label_it}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500">Esito</label>
            <select value={filters.activity_outcome_code}
                    data-testid="activity-filter-outcome"
                    onChange={(e) => setFilters({ ...filters, activity_outcome_code: e.target.value })}
                    className="w-full border border-stone-300 px-2 py-1.5 text-xs">
              <option value="">Tutti</option>
              {outcomes.map(o => <option key={o.code} value={o.code}>{o.label_it}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500">Sorgente</label>
            <select value={filters.source_code}
                    data-testid="activity-filter-source"
                    onChange={(e) => setFilters({ ...filters, source_code: e.target.value })}
                    className="w-full border border-stone-300 px-2 py-1.5 text-xs">
              <option value="">Tutte</option>
              {sources.map(s => <option key={s.code} value={s.code}>{s.label_it}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500">Stato</label>
            <select value={filters.status}
                    data-testid="activity-filter-status"
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full border border-stone-300 px-2 py-1.5 text-xs">
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
          <h3 className="text-[10px] uppercase tracking-wider text-stone-400 font-medium mb-2">
            ▣ Pending follow-up · {pending.length}
          </h3>
          <div className="border border-amber-200 bg-amber-50/30">
            {pending.map(renderRow)}
          </div>
        </section>
      )}

      {/* History */}
      <section>
        <h3 className="text-[10px] uppercase tracking-wider text-stone-400 font-medium mb-2">
          ◯ Storico {filters.status === 'archived' ? 'archiviato' : 'recente'} · {items.length}
        </h3>
        <div className="border border-stone-200 bg-white">
          {items.length === 0 && !loading && (
            <div data-testid="activity-feed-empty"
                 className="px-6 py-10 text-center text-stone-400 text-sm">
              Nessuna attività. Inizia con una chiamata, un meeting o una nota.
            </div>
          )}
          {items.map(renderRow)}
        </div>
        {cursor && (
          <div className="flex justify-center pt-3">
            <button data-testid="activity-load-more"
                    onClick={() => load(false)}
                    disabled={loading}
                    className="border border-stone-300 px-4 py-2 text-xs hover:bg-stone-50 disabled:opacity-50">
              {loading ? 'Caricamento…' : 'Carica altre'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
