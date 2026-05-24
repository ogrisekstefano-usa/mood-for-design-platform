/**
 * ClientRelationsLayout — shared header + filters + counts for the 3 stage pages.
 * Each stage page provides its own dataset + dataset-specific filters.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import api from '../../lib/api';
import RelationshipCard from './RelationshipCard';
import './client-relations.css';

const ATMOSPHERE_FILTERS = [
  { value: 'warm_editorial',    label: 'Warm editorial' },
  { value: 'nordic_silence',    label: 'Nordic silence' },
  { value: 'midnight_mood',     label: 'Midnight mood' },
  { value: 'architectural_dawn',label: 'Architectural dawn' },
  { value: 'mediterranean_light',label: 'Mediterranean light' },
];

const TIER_FILTERS = [
  { value: 'atelier',       label: 'Atelier' },
  { value: 'couture',       label: 'Couture' },
  { value: 'pret_a_porter', label: 'Prêt-à-porter' },
  { value: 'exploratory',   label: 'Exploratory' },
];

const ClientRelationsLayout = ({
  stage,           // 'lead' | 'prospect' | 'account'
  eyebrow,
  title,
  lede,
  endpoint,        // e.g. '/api/relations/leads'
  showFilters = true,
}) => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ lead: 0, prospect: 0, account: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: '', atmosphere: null, budget_tier: null,
  });

  const fetchCounts = useCallback(async () => {
    try {
      const { data } = await api.get('/api/relations/stats');
      setCounts(data);
    } catch (_) { /* keep */ }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '40');
      if (filters.q) params.set('q', filters.q);
      if (filters.atmosphere) params.set('atmosphere', filters.atmosphere);
      if (filters.budget_tier) params.set('budget_tier', filters.budget_tier);
      const { data } = await api.get(`${endpoint}?${params.toString()}`);
      setItems(data.data || []);
      setTotal(data.total || 0);
    } catch (e) {
      setItems([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [endpoint, filters]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => { fetchList(); }, [fetchList]);

  const promote = async (item) => {
    const target = stage === 'lead' ? 'prospect' : (stage === 'prospect' ? 'account' : null);
    if (!target) return;
    try {
      await api.post(`/api/relations/leads/${item.id}/promote`, { target });
      await Promise.all([fetchList(), fetchCounts()]);
    } catch (_) { /* TODO toast */ }
  };

  const toggle = (key, value) =>
    setFilters((p) => ({ ...p, [key]: p[key] === value ? null : value }));

  const clearAll = () => setFilters({ q: '', atmosphere: null, budget_tier: null });
  const hasActive = filters.q || filters.atmosphere || filters.budget_tier;

  return (
    <div className="cr-shell" data-testid={`cr-shell-${stage}`}>
      <header className="cr-header">
        <p className="cr-header__eyebrow" data-testid="cr-header-eyebrow">{eyebrow}</p>
        <h1 className="cr-header__title" data-testid="cr-header-title">{title}</h1>
        <p className="cr-header__lede" data-testid="cr-header-lede">{lede}</p>

        <div className="cr-header__counts" data-testid="cr-header-counts">
          <div className="cr-count">
            <span className="cr-count__value">{counts.lead || 0}</span>
            <span className="cr-count__label">Leads</span>
          </div>
          <div className="cr-count">
            <span className="cr-count__value">{counts.prospect || 0}</span>
            <span className="cr-count__label">Prospects</span>
          </div>
          <div className="cr-count">
            <span className="cr-count__value">{counts.account || 0}</span>
            <span className="cr-count__label">Accounts</span>
          </div>
        </div>
      </header>

      {showFilters && (
        <div className="cr-filters" data-testid="cr-filters">
          <input
            type="search"
            placeholder="Cerca per nome o email…"
            value={filters.q}
            onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
            className="cr-filter__search"
            data-testid="cr-filter-search"
          />
          {stage !== 'account' && ATMOSPHERE_FILTERS.map((a) => (
            <button
              key={a.value}
              className={`cr-chip ${filters.atmosphere === a.value ? 'cr-chip--active' : ''}`}
              onClick={() => toggle('atmosphere', a.value)}
              data-testid={`cr-filter-atmosphere-${a.value}`}
            >{a.label}</button>
          ))}
          {stage !== 'account' && TIER_FILTERS.map((t) => (
            <button
              key={t.value}
              className={`cr-chip ${filters.budget_tier === t.value ? 'cr-chip--active' : ''}`}
              onClick={() => toggle('budget_tier', t.value)}
              data-testid={`cr-filter-tier-${t.value}`}
            >{t.label}</button>
          ))}
          {hasActive && (
            <button className="cr-chip" onClick={clearAll} data-testid="cr-filter-clear">
              <X size={14} /> Reset
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="cr-grid" data-testid="cr-loading">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="cr-card cr-skeleton" style={{ minHeight: 240 }} />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="cr-empty" data-testid="cr-empty">
          <p className="cr-empty__title">No relationships yet in this layer.</p>
          <p className="cr-empty__sub">
            {stage === 'lead' && 'New leads will appear here as the public Begin Journey™ surfaces capture interest.'}
            {stage === 'prospect' && 'Promote a lead from the Leads view to start cultivating a relationship.'}
            {stage === 'account' && 'Accounts appear when a Prospect is promoted with a Design Journey™.'}
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="cr-grid" data-testid="cr-grid">
          {items.map((it) => (
            <RelationshipCard key={it.id} item={it} stage={stage} onPromote={promote} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientRelationsLayout;
