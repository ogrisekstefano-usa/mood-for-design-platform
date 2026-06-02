/**
 * TenantsList — Command Center M1.
 * Lista paginata di tutti i tenant (filtrati per scope advisor).
 * Filtri: advisor, market, status, role. Search globale via tsvector.
 */
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Building2, Search as SearchIcon, X, ArrowUpRight } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const FILTER_KEY = 'cc_tenant_filters_v1';

const StatusChip = ({ status }) => {
  const tone = {
    'active':     'bg-emerald-50  text-emerald-700  border-emerald-200',
    'trial':      'bg-amber-50    text-amber-700    border-amber-200',
    'suspended':  'bg-red-50      text-red-700      border-red-200',
  }[status] || 'bg-stone-50 text-stone-700 border-stone-200';
  return (
    <span data-testid="tenant-status-chip"
          className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wide border ${tone}`}>
      {status || '—'}
    </span>
  );
};

const TenantsList = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FILTER_KEY) || '{}'); }
    catch { return {}; }
  });

  const headers = useMemo(() => {
    const tok = localStorage.getItem('mood_auth_token') || '';
    return { Authorization: `Bearer ${tok}` };
  }, []);

  const reload = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (q) params.set('q', q);
      if (filters.advisor) params.set('advisor', filters.advisor);
      if (filters.market)  params.set('market',  filters.market);
      if (filters.status)  params.set('status',  filters.status);
      if (filters.role)    params.set('role',    filters.role);
      const r = await axios.get(`${BACKEND}/api/admin/tenants?${params.toString()}`,
                                 { headers });
      setRows(r.data.items || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      console.error('tenants list error', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const onSearchKey = (e) => {
    if (e.key === 'Enter') reload();
  };
  const clearFilter = (k) => setFilters({ ...filters, [k]: undefined });

  return (
    <div data-testid="tenants-list-page" className="p-8 max-w-[1400px] mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-light tracking-tight">Tenants</h1>
        <p className="text-sm text-stone-500 mt-1">
          {loading ? 'Caricamento…' : `${total} tenant attivi`}
        </p>
      </header>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 border border-stone-200 px-3 py-2 bg-white flex-1 min-w-[280px]">
          <SearchIcon size={16} className="text-stone-400" />
          <input
            data-testid="tenants-search-input"
            type="text"
            placeholder="Cerca studio, contatto, email, telefono…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onSearchKey}
            className="flex-1 bg-transparent outline-none text-sm"
          />
          {q && (
            <button onClick={() => { setQ(''); reload(); }}
                    className="text-stone-400 hover:text-stone-700"
                    data-testid="tenants-search-clear">
              <X size={14} />
            </button>
          )}
          <button onClick={reload} data-testid="tenants-search-submit"
                  className="text-xs uppercase tracking-wide px-3 py-1 bg-black text-white">
            Cerca
          </button>
        </div>
        {Object.entries(filters).filter(([_,v]) => v).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1 px-3 py-1 bg-stone-100 text-xs">
            {k}: <strong>{String(v)}</strong>
            <button onClick={() => clearFilter(k)} className="ml-1"><X size={12} /></button>
          </span>
        ))}
      </div>

      <div className="border border-stone-200 bg-white">
        <table data-testid="tenants-table" className="w-full text-sm">
          <thead className="border-b border-stone-200 text-[11px] uppercase tracking-wider text-stone-500">
            <tr>
              <th className="text-left px-4 py-3">Studio</th>
              <th className="text-left px-4 py-3">Geo</th>
              <th className="text-left px-4 py-3">Advisor</th>
              <th className="text-left px-4 py-3">Owner</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Contacts</th>
              <th className="text-right px-4 py-3">Last Activity</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="text-center py-12 text-stone-400">Caricamento…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-stone-400">Nessun tenant.</td></tr>
            )}
            {!loading && rows.map((t) => (
              <tr key={t.id}
                  data-testid={`tenant-row-${t.id}`}
                  onClick={() => navigate(`/command-center/tenants/${t.id}`)}
                  className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition-colors">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Building2 size={16} className="text-stone-400" />
                    <div>
                      <div className="font-medium">{t.studio_name || t.name || '—'}</div>
                      <div className="text-[11px] text-stone-400">{t.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-stone-600">{[t.city, t.country].filter(Boolean).join(', ') || '—'}</td>
                <td className="px-4 py-4 text-stone-600">{t.advisor_display || '—'}</td>
                <td className="px-4 py-4 text-stone-600">{t.tenant_owner_display || '—'}</td>
                <td className="px-4 py-4"><StatusChip status={t.status} /></td>
                <td className="px-4 py-4 text-right tabular-nums">{t.contacts_count || 0}</td>
                <td className="px-4 py-4 text-right text-[11px] text-stone-400">
                  {t.last_activity_at ? new Date(t.last_activity_at).toLocaleDateString('it-IT') : '—'}
                </td>
                <td className="px-2 py-4 text-stone-300">
                  <ArrowUpRight size={14} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TenantsList;
