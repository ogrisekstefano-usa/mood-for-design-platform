/**
 * LocalizationStatusHero · ITER133.
 *
 * Editorial hero strip that summarises the latest runtime crawl: locale,
 * convergence verdict, key counters (CRASH · MISS · LEAK), generated_at,
 * and route coverage. Atelier feel, not Grafana.
 */
import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { SEVERITY } from './RuntimeLocalizationApi';

const Stat = ({ label, value, color }) => (
  <div className="flex flex-col gap-1.5">
    <span
      className="font-mono text-[28px] tracking-[-0.01em]"
      style={{ color: color || 'var(--mood-text, #f0ebe0)' }}
      data-testid={`locgov-stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {value}
    </span>
    <span className="text-[9.5px] uppercase tracking-[0.26em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
      {label}
    </span>
  </div>
);

const LocalizationStatusHero = ({ summary, iterations = [] }) => {
  if (!summary?.available) {
    return (
      <div data-testid="locgov-hero-empty"
        className="p-8 border border-dashed border-[var(--mood-border, rgba(255,255,255,0.08))]">
        <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--mood-accent, #d9b285)] mb-3">
          Runtime Heatmap™ · Idle
        </p>
        <p className="font-heading italic text-[16px] text-[var(--mood-text-muted, rgba(240,235,224,0.7))]">
          No crawler run on file. Trigger the autonomous loop to populate this view.
        </p>
        <p className="mt-3 text-[11px] font-mono text-[var(--mood-text-faint, rgba(240,235,224,0.4))]">
          <code>python3 /app/scripts/runtime_remediation_loop.py</code>
        </p>
      </div>
    );
  }

  const s = summary.summary || {};
  const crash    = s.RUNTIME_CRASH || 0;
  const rawKey   = s.INVALID_USE_TRANSLATION || 0;
  const missing  = s.MISSING_REGISTRY_KEY || 0;
  const itLeak   = s.HARD_CODED_UI || 0;
  const dbSeed   = s.DB_SEEDED_CONTENT || 0;
  const apiFail  = s.API_FAILURE || 0;
  const critical = crash + rawKey + missing + itLeak;
  const converged = critical === 0;

  const verdictColor = converged ? '#3d8b6a' : SEVERITY.RUNTIME_CRASH.color;
  const verdictLabel = converged
    ? `CONVERGED · MISS 0 · LEAK 0`
    : `OPEN · ${critical} P0 LEAKS`;

  const generatedAt = summary.generated_at
    ? new Date(summary.generated_at).toLocaleString()
    : '—';

  return (
    <section data-testid="locgov-status-hero" className="mb-12">
      <div className="flex items-baseline justify-between gap-6 mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--mood-accent, #d9b285)] mb-2">
            Localization Governance · {summary.locale}
          </p>
          <h2 className="font-heading text-[28px] leading-[1.15] text-[var(--mood-text, #f0ebe0)] tracking-[-0.005em]">
            Runtime State
          </h2>
        </div>
        <div
          data-testid="locgov-verdict-pill"
          className="px-5 py-3 border flex items-center gap-3"
          style={{ borderColor: verdictColor, color: verdictColor }}
        >
          {converged
            ? <CheckCircle2 size={14} strokeWidth={1.6} />
            : <AlertTriangle size={14} strokeWidth={1.6} />}
          <span className="text-[10.5px] uppercase tracking-[0.24em] font-mono">{verdictLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-x-10 gap-y-6 p-8 border border-[var(--mood-border, rgba(255,255,255,0.06))] bg-[var(--mood-surface, #11141a)]">
        <Stat label="Crash"          value={crash}    color={crash    ? SEVERITY.RUNTIME_CRASH.color : undefined} />
        <Stat label="Raw key"        value={rawKey}   color={rawKey   ? SEVERITY.INVALID_USE_TRANSLATION.color : undefined} />
        <Stat label="Missing"        value={missing}  color={missing  ? SEVERITY.MISSING_REGISTRY_KEY.color : undefined} />
        <Stat label="IT leak"        value={itLeak}   color={itLeak   ? SEVERITY.HARD_CODED_UI.color : undefined} />
        <Stat label="DB seed"        value={dbSeed}   color={dbSeed   ? SEVERITY.DB_SEEDED_CONTENT.color : undefined} />
        <Stat label="API failure"    value={apiFail}  color={apiFail  ? SEVERITY.API_FAILURE.color : undefined} />
        <Stat label="Routes"         value={summary.routes_crawled || 0} />
      </div>

      <p className="mt-4 text-[10.5px] uppercase tracking-[0.22em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
        Last crawl <strong className="text-[var(--mood-text, #f0ebe0)]">{generatedAt}</strong>
        {iterations.length > 0 && (
          <>
            &nbsp;·&nbsp; {iterations.length} iteration{iterations.length === 1 ? '' : 's'} on record
          </>
        )}
      </p>
    </section>
  );
};

export default LocalizationStatusHero;
