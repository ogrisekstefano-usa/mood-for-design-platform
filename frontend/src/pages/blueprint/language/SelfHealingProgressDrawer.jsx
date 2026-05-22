/**
 * SelfHealingProgressDrawer · ITER134.
 *
 * Live progress drawer for the autonomous remediation loop. Polls the
 * `/api/language/runtime/run-loop/status/{job_id}` endpoint every 2.5s,
 * surfaces the stage (queued · crawling · remediating · restarting · etc.),
 * the per-locale convergence summary, and a streaming log tail.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { fetchRuntimeJobStatus, cancelRuntimeJob, SEVERITY } from './RuntimeLocalizationApi';

const STAGE_LABELS = {
  queued:                 'Queued',
  starting:               'Initialising',
  remediating:            'Generating fixes',
  restarting_frontend:    'Reloading frontend',
  rendering_heatmap:      'Painting heatmap',
  completed:              'Completed',
  failed:                 'Failed',
  cancelled:              'Cancelled',
};

const stageLabel = (raw) => {
  if (!raw) return '—';
  if (raw.startsWith('crawling[')) return `Crawling ${raw.slice(9, -1)}`;
  if (raw.startsWith('restarting_frontend')) return raw.replace('restarting_frontend', 'Reloading frontend');
  if (raw.includes('process_exited')) return raw;
  return STAGE_LABELS[raw] || raw;
};

const SummaryChips = ({ summary }) => {
  if (!summary || Object.keys(summary).length === 0) {
    return <span className="text-[10.5px] uppercase tracking-[0.22em] font-mono text-[#3d8b6a]">Converged · 0 leaks</span>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(summary).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
        const meta = SEVERITY[k] || { color: '#888' };
        return (
          <span
            key={k}
            className="text-[10px] uppercase tracking-[0.18em] font-mono px-2 py-1 border"
            style={{ borderColor: meta.color, color: meta.color }}
          >
            {k} · {v}
          </span>
        );
      })}
    </div>
  );
};

const SelfHealingProgressDrawer = ({ jobId, onClose, onComplete }) => {
  const [status, setStatus] = useState(null);
  const [err, setErr]       = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await fetchRuntimeJobStatus(jobId);
        if (cancelled) return;
        setStatus(s);
        if (s?.completed) {
          onComplete?.(s);
          if (timer.current) { clearInterval(timer.current); timer.current = null; }
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Network error');
      }
    };
    tick();
    timer.current = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
    };
  }, [jobId, onComplete]);

  const onCancel = async () => {
    try {
      await cancelRuntimeJob(jobId);
    } catch (_) { /* noop */ }
  };

  if (!jobId) return null;
  const completed = !!status?.completed;
  const failed    = status?.stage === 'failed' || status?.stage === 'cancelled' || (status?.stage || '').includes('process_exited');
  const converged = !!status?.converged;
  const pct       = Math.max(0, Math.min(100, status?.progress_pct ?? 0));

  const verdictColor = failed ? '#c25b5b' : (converged ? '#3d8b6a' : '#d9b285');
  const VerdictIcon  = failed ? XCircle : (converged ? CheckCircle2 : Loader2);

  return (
    <aside
      data-testid="locgov-loop-drawer"
      className="fixed top-0 right-0 h-screen w-[min(640px,100vw)] bg-[var(--mood-bg, #0c0e11)] border-l border-[var(--mood-border, rgba(255,255,255,0.08))] z-[60] overflow-y-auto"
      style={{ boxShadow: '-32px 0 60px rgba(0,0,0,0.6)' }}
    >
      <header className="sticky top-0 bg-[var(--mood-bg, #0c0e11)] z-10 px-8 pt-7 pb-5 border-b border-[var(--mood-border, rgba(255,255,255,0.06))]">
        <button type="button" onClick={onClose} data-testid="locgov-loop-drawer-close" aria-label="Close"
          className="absolute right-5 top-5 text-[var(--mood-text-muted, rgba(240,235,224,0.5))] hover:text-[var(--mood-text, #f0ebe0)]">
          <X size={18} strokeWidth={1.5} />
        </button>
        <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--mood-accent, #d9b285)] mb-2">
          Self-Healing Loop™ · job <code className="font-mono">{jobId.slice(0, 8)}</code>
        </p>
        <h3 className="font-heading text-[24px] leading-[1.2] text-[var(--mood-text, #f0ebe0)] tracking-[-0.005em] mb-3">
          {failed ? 'Loop terminated' : (converged ? 'Convergence reached' : 'Loop in flight')}
        </h3>
        <div className="flex items-center gap-3">
          <span data-testid="locgov-loop-stage"
            className="px-3 py-1.5 border flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] font-mono"
            style={{ borderColor: verdictColor, color: verdictColor }}>
            <VerdictIcon size={12} strokeWidth={1.7}
              className={!completed ? 'animate-spin' : ''} />
            {stageLabel(status?.stage)}
          </span>
          <span className="text-[10.5px] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
            {pct}%
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-[2px] bg-[rgba(255,255,255,0.06)] overflow-hidden">
          <div data-testid="locgov-loop-progress-bar"
            className="h-full transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%`, background: verdictColor }} />
        </div>
      </header>

      <div className="px-8 py-7">
        {err && (
          <p data-testid="locgov-loop-err"
             className="mb-5 px-4 py-3 border border-[var(--mood-danger, #c25b5b)] text-[12px] text-[var(--mood-danger, #c25b5b)] flex items-center gap-2">
            <AlertTriangle size={12} strokeWidth={1.6} /> {err}
          </p>
        )}

        {/* Per-locale tiles */}
        <p className="text-[10px] uppercase tracking-[0.26em] font-mono text-[var(--mood-accent, #d9b285)] mb-3">
          Per-locale convergence
        </p>
        <div className="space-y-3 mb-7" data-testid="locgov-loop-per-locale">
          {Object.entries(status?.per_locale || {}).map(([locale, info]) => (
            <div key={locale}
                 className="border border-[var(--mood-border, rgba(255,255,255,0.06))] p-4">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-mono text-[14px] text-[var(--mood-text, #f0ebe0)]">{locale}</span>
                <span className="text-[10px] uppercase tracking-[0.22em] font-mono"
                  style={{ color: info.converged ? '#3d8b6a' : 'var(--mood-text-muted, rgba(240,235,224,0.55))' }}>
                  {info.converged ? 'Converged' : `Iter ${info.iterations}`}
                </span>
              </div>
              <SummaryChips summary={info.summary || {}} />
            </div>
          ))}
          {Object.keys(status?.per_locale || {}).length === 0 && (
            <p className="text-[12px] italic text-[var(--mood-text-muted, rgba(240,235,224,0.5))]">
              Awaiting first stage…
            </p>
          )}
        </div>

        {/* Log stream */}
        <p className="text-[10px] uppercase tracking-[0.26em] font-mono text-[var(--mood-accent, #d9b285)] mb-3">
          Stream
        </p>
        <ul data-testid="locgov-loop-log"
          className="space-y-1 max-h-[340px] overflow-y-auto font-mono text-[11px] text-[var(--mood-text-muted, rgba(240,235,224,0.7))] border border-[var(--mood-border, rgba(255,255,255,0.05))] p-4 bg-[rgba(255,255,255,0.015)]">
          {(status?.log || []).slice(-60).map((entry, idx) => (
            <li key={idx}>
              <span className="text-[var(--mood-text-faint, rgba(240,235,224,0.35))]">
                {entry.ts ? new Date(entry.ts).toLocaleTimeString() : ''}
              </span>
              {' · '}{entry.line}
            </li>
          ))}
          {(!status?.log || status.log.length === 0) && (
            <li className="italic text-[var(--mood-text-faint, rgba(240,235,224,0.4))]">…</li>
          )}
        </ul>

        {/* Final summary */}
        {completed && status?.final_summary && (
          <div className="mt-7" data-testid="locgov-loop-final">
            <p className="text-[10px] uppercase tracking-[0.26em] font-mono text-[var(--mood-accent, #d9b285)] mb-3">
              Aggregate result
            </p>
            <SummaryChips summary={status.final_summary} />
          </div>
        )}

        {/* Cancel */}
        {!completed && (
          <button
            type="button"
            onClick={onCancel}
            data-testid="locgov-loop-cancel"
            className="mt-7 inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] font-mono text-[var(--mood-danger, #c25b5b)] hover:opacity-80"
          >
            <X size={11} strokeWidth={1.7} /> Cancel job
          </button>
        )}
      </div>
    </aside>
  );
};

export default SelfHealingProgressDrawer;
