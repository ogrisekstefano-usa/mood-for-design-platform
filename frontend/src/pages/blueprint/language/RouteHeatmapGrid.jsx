/**
 * RouteHeatmapGrid · ITER133.
 *
 * Editorial row per route — name · severity dot · per-kind swatches with
 * count badges. Click a row to open the LocalizationScreenshotDrawer.
 */
import React from 'react';
import { SEVERITY, severityForCounts } from './RuntimeLocalizationApi';

const KINDS = [
  ['RUNTIME_CRASH',           'page_errors'],
  ['INVALID_USE_TRANSLATION', 'raw_keys'],
  ['MISSING_REGISTRY_KEY',    'missing_tokens'],
  ['HARD_CODED_UI',           'italian_leaks'],
  ['DB_SEEDED_CONTENT',       'api_leaks'],
];

const countsFor = (page) => {
  const c = {};
  KINDS.forEach(([k, src]) => { c[k] = (page[src] || []).length; });
  return c;
};

const Swatch = ({ kind, count }) => {
  const meta = SEVERITY[kind];
  if (!meta) return null;
  const active = count > 0;
  return (
    <span
      data-testid={`locgov-swatch-${kind}-${count}`}
      title={`${meta.label} · ${count}`}
      className="inline-flex items-center justify-center min-w-[28px] h-[22px] text-[10px] font-mono px-1.5"
      style={{
        background: active ? meta.color : 'rgba(255,255,255,0.04)',
        color: active ? '#0c0e11' : 'rgba(240,235,224,0.35)',
        fontWeight: active ? 600 : 400,
      }}
    >
      {count || '·'}
    </span>
  );
};

const RouteHeatmapGrid = ({ pages = [], onSelectRoute }) => {
  if (!pages.length) {
    return (
      <p data-testid="locgov-route-empty"
         className="py-14 font-heading italic text-[15px] text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
        No routes have been crawled yet.
      </p>
    );
  }
  // Sort: routes with any P0 first, then P1, then P2, then converged.
  const sorted = [...pages].sort((a, b) => {
    const A = countsFor(a), B = countsFor(b);
    const ap = (A.RUNTIME_CRASH || 0) * 1000 + (A.INVALID_USE_TRANSLATION || 0) * 100 +
               (A.MISSING_REGISTRY_KEY || 0) * 100 + (A.HARD_CODED_UI || 0) * 10 +
               (A.DB_SEEDED_CONTENT || 0);
    const bp = (B.RUNTIME_CRASH || 0) * 1000 + (B.INVALID_USE_TRANSLATION || 0) * 100 +
               (B.MISSING_REGISTRY_KEY || 0) * 100 + (B.HARD_CODED_UI || 0) * 10 +
               (B.DB_SEEDED_CONTENT || 0);
    return bp - ap;
  });

  return (
    <ol data-testid="locgov-route-grid" className="border-t border-[var(--mood-border, rgba(255,255,255,0.06))]">
      {sorted.map((p) => {
        const c = countsFor(p);
        const dotColor = severityForCounts(c);
        const total = Object.values(c).reduce((a, b) => a + b, 0);
        return (
          <li
            key={p.key}
            data-testid={`locgov-route-row-${p.key}`}
            className="border-b border-[var(--mood-border, rgba(255,255,255,0.06))] hover:bg-[rgba(255,255,255,0.015)] transition-colors cursor-pointer"
            onClick={() => onSelectRoute?.(p)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectRoute?.(p); } }}
          >
            <div className="grid grid-cols-[14px_1fr_auto] items-center gap-6 py-4 px-1">
              <span
                className="inline-block w-[9px] h-[9px] rounded-full"
                style={{ background: dotColor }}
                title={total ? `${total} signal${total === 1 ? '' : 's'}` : 'converged'}
              />
              <div>
                <p className="text-[13px] text-[var(--mood-text, #f0ebe0)] font-mono">
                  {p.url}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.5))]">
                  {p.key} · {total === 0 ? 'clean' : `${total} signal${total === 1 ? '' : 's'}`}
                </p>
              </div>
              <div className="flex gap-1.5">
                {KINDS.map(([k]) => <Swatch key={k} kind={k} count={c[k]} />)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default RouteHeatmapGrid;
