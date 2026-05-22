/**
 * LeakInspectorTable · ITER133.
 *
 * Filterable table over the SQLite leak DB exposed by
 * `/api/language/runtime/leaks`. Editorial atelier styling, no
 * Grafana-grade tables.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';
import { fetchRuntimeLeaks, SEVERITY } from './RuntimeLocalizationApi';

const KINDS_FILTER = [
  ['all',                       'All'],
  ['RUNTIME_CRASH',             'Crash'],
  ['INVALID_USE_TRANSLATION',   'Raw key'],
  ['MISSING_REGISTRY_KEY',      'Missing'],
  ['HARD_CODED_UI',             'IT leak'],
  ['DB_SEEDED_CONTENT',         'DB seed'],
  ['API_FAILURE',               'API failure'],
];

const LeakInspectorTable = () => {
  const [openOnly, setOpenOnly] = useState(true);
  const [kindFilter, setKindFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stamp, setStamp] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchRuntimeLeaks({ openOnly, limit: 400 })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items || []);
      })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [openOnly, stamp]);

  const filtered = useMemo(() => {
    let rows = items;
    if (kindFilter !== 'all') rows = rows.filter((r) => r.kind === kindFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        (r.text || '').toLowerCase().includes(q) ||
        (r.page || '').toLowerCase().includes(q) ||
        (r.testid || '').toLowerCase().includes(q));
    }
    return rows;
  }, [items, kindFilter, search]);

  return (
    <section data-testid="locgov-leak-inspector" className="mt-2">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-7 items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search text, page, testid…"
          data-testid="locgov-leak-search"
          className="flex-1 min-w-[260px] bg-transparent border border-[var(--mood-border, rgba(255,255,255,0.08))] py-2.5 px-3.5 text-[13px] font-body text-[var(--mood-text, #f0ebe0)] outline-none focus:border-[var(--mood-accent-soft, rgba(217,178,133,0.4))] placeholder:text-[var(--mood-text-muted, rgba(240,235,224,0.4))]"
        />
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          data-testid="locgov-leak-filter-kind"
          className="bg-transparent border border-[var(--mood-border, rgba(255,255,255,0.08))] py-2.5 px-3 text-[11px] uppercase tracking-[0.18em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.75))]"
        >
          {KINDS_FILTER.map(([k, lab]) => <option key={k} value={k}>{lab}</option>)}
        </select>
        <label className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.65))] cursor-pointer">
          <input type="checkbox" checked={openOnly}
                 onChange={(e) => setOpenOnly(e.target.checked)}
                 data-testid="locgov-leak-open-only" />
          Open only
        </label>
        <button
          type="button"
          onClick={() => setStamp((s) => s + 1)}
          data-testid="locgov-leak-refresh"
          className="px-3 py-2 text-[10.5px] uppercase tracking-[0.22em] font-mono border border-[var(--mood-border, rgba(255,255,255,0.1))] text-[var(--mood-text-muted, rgba(240,235,224,0.7))] hover:text-[var(--mood-text, #f0ebe0)] flex items-center gap-2"
        >
          <RefreshCcw size={11} strokeWidth={1.7} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-14 flex items-center gap-3 text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[11px] uppercase tracking-[0.24em]">Loading leak ledger</span>
        </div>
      ) : filtered.length === 0 ? (
        <p data-testid="locgov-leak-empty"
           className="py-14 font-heading italic text-[15px] text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
          {openOnly
            ? 'No open leaks on record. The runtime is in a converged state.'
            : 'No leaks match your filters.'}
        </p>
      ) : (
        <table data-testid="locgov-leak-table"
               className="w-full text-[12px] font-body">
          <thead>
            <tr className="text-[9.5px] uppercase tracking-[0.22em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
              <th className="text-left py-3 pr-4 font-normal">Kind</th>
              <th className="text-left py-3 pr-4 font-normal">Page</th>
              <th className="text-left py-3 pr-4 font-normal">Text</th>
              <th className="text-left py-3 pr-4 font-normal">Testid</th>
              <th className="text-right py-3 pr-4 font-normal">×</th>
              <th className="text-left py-3 pr-4 font-normal">Resolution</th>
              <th className="text-left py-3 font-normal">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const meta = SEVERITY[r.kind] || { color: '#888', label: r.kind };
              return (
                <tr key={r.id}
                    data-testid={`locgov-leak-row-${r.id}`}
                    className="border-t border-[var(--mood-border, rgba(255,255,255,0.05))] align-top">
                  <td className="py-3.5 pr-4 whitespace-nowrap" style={{ color: meta.color }}>
                    <span className="text-[10px] uppercase tracking-[0.2em] font-mono">{meta.label}</span>
                  </td>
                  <td className="py-3.5 pr-4 font-mono text-[11.5px] text-[var(--mood-text, #f0ebe0)] whitespace-nowrap">{r.page || '—'}</td>
                  <td className="py-3.5 pr-4 max-w-[420px]">
                    <span className="line-clamp-2 text-[var(--mood-text-muted, rgba(240,235,224,0.78))]">«{r.text}»</span>
                  </td>
                  <td className="py-3.5 pr-4 font-mono text-[10.5px] text-[var(--mood-text-faint, rgba(240,235,224,0.5))]">{r.testid || '—'}</td>
                  <td className="py-3.5 pr-4 text-right font-mono">{r.occurrences}</td>
                  <td className="py-3.5 pr-4 text-[10.5px] uppercase tracking-[0.16em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.6))]">
                    {r.resolution_method
                      ? <span className="text-[#3d8b6a]">{r.resolution_method}</span>
                      : <span className="text-[var(--mood-danger, #c25b5b)]">OPEN</span>}
                  </td>
                  <td className="py-3.5 font-mono text-[10.5px] text-[var(--mood-text-faint, rgba(240,235,224,0.5))]">
                    {r.last_seen ? new Date(r.last_seen).toLocaleString() : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
};

export default LeakInspectorTable;
