/**
 * RuntimeHeatmapPanel · ITER133.
 *
 * Composes the Localization Governance experience inside the Language
 * Command Center: status hero · route-by-route severity grid · admin
 * actions row · screenshot drawer.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Download, ExternalLink, PlayCircle, RefreshCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchRuntimeSummary, fetchRuntimeReport,
  downloadRuntimeReport, runtimeHeatmapRawUrl,
  launchRuntimeLoop, clearFixedLeaks,
} from './RuntimeLocalizationApi';
import LocalizationStatusHero from './LocalizationStatusHero';
import RouteHeatmapGrid from './RouteHeatmapGrid';
import LocalizationScreenshotDrawer from './LocalizationScreenshotDrawer';
import SelfHealingProgressDrawer from './SelfHealingProgressDrawer';

const Action = ({ icon: Icon, label, onClick, disabled, hint, testid }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    data-testid={testid}
    title={hint || label}
    className={`px-4 py-2.5 text-[10.5px] uppercase tracking-[0.22em] font-mono border flex items-center gap-2 transition-colors
      ${disabled
        ? 'border-[var(--mood-border, rgba(255,255,255,0.05))] text-[var(--mood-text-faint, rgba(240,235,224,0.3))] cursor-not-allowed'
        : 'border-[var(--mood-border, rgba(255,255,255,0.12))] text-[var(--mood-text-muted, rgba(240,235,224,0.75))] hover:border-[var(--mood-accent-soft, rgba(217,178,133,0.5))] hover:text-[var(--mood-text, #f0ebe0)]'}`}
  >
    <Icon size={11} strokeWidth={1.7} />
    {label}
    {disabled && hint && (
      <span className="ml-1 text-[8.5px] tracking-[0.18em] text-[var(--mood-text-faint, rgba(240,235,224,0.3))]">
        · {hint}
      </span>
    )}
  </button>
);

const RuntimeHeatmapPanel = () => {
  const [summary, setSummary] = useState(null);
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [activeJobId, setActiveJobId]     = useState(null);
  const [launching, setLaunching]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        fetchRuntimeSummary().catch(() => ({ available: false })),
        fetchRuntimeReport().catch(() => null),
      ]);
      setSummary(s);
      setReport(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
      toast.success('Heatmap refreshed');
    } finally {
      setRefreshing(false);
    }
  };

  const onDownload = async () => {
    try {
      await downloadRuntimeReport();
      toast.success('Report downloaded');
    } catch (_) {
      toast.error('Download failed');
    }
  };

  const onOpenRaw = () => {
    window.open(runtimeHeatmapRawUrl(), '_blank', 'noopener,noreferrer');
  };

  const startLoop = async ({ locales, maxIters }) => {
    if (launching) return;
    setLaunching(true);
    try {
      const res = await launchRuntimeLoop({ locales, maxIters });
      setActiveJobId(res.job_id);
      toast.success(`Self-healing loop started · job ${res.job_id.slice(0, 8)}`);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail?.reason === 'concurrent_job') {
        setActiveJobId(detail.job_id);
        toast.info(`Resuming live job ${detail.job_id.slice(0, 8)}`);
      } else {
        toast.error('Failed to start loop');
      }
    } finally {
      setLaunching(false);
    }
  };

  const onRunAudit = () => startLoop({ locales: ['en-US'], maxIters: 1 });
  const onRerunLoop = () => startLoop({
    locales: ['en-US', 'it-IT', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'ar'],
    maxIters: 3,
  });

  const onClearFixed = async () => {
    if (!window.confirm('Delete all closed leak rows from the runtime ledger? This cannot be undone.')) return;
    try {
      const res = await clearFixedLeaks();
      toast.success(`Cleared ${res.cleared} resolved leak${res.cleared === 1 ? '' : 's'}`);
      load();
    } catch (_) {
      toast.error('Clear failed');
    }
  };

  const onLoopComplete = useCallback((status) => {
    if (status?.converged) {
      toast.success(`Loop converged · ${(status.locales || []).join(' · ')}`);
    } else if (status?.stage === 'failed' || status?.stage === 'cancelled') {
      toast.error(`Loop ${status.stage}`);
    } else {
      toast.info('Loop finished — review the results');
    }
    // Refresh the underlying data so the hero + grid reflect the new state.
    load();
  }, [load]);

  return (
    <section data-testid="locgov-runtime-heatmap-panel">
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--mood-accent, #d9b285)] mb-2">
          03 · Runtime Heatmap™
        </p>
        <h2 className="font-heading text-[28px] leading-[1.15] text-[var(--mood-text, #f0ebe0)] tracking-[-0.005em] mb-2">
          Live governance over every spoken word
        </h2>
        <p className="text-[13px] leading-[1.7] text-[var(--mood-text-muted, rgba(240,235,224,0.6))] font-body max-w-[68ch]">
          The autonomous crawler walks the platform in every operational locale,
          captures the DOM and the API payloads, classifies every leak, and
          remediates whatever can be remediated automatically. This panel is the
          studio's cockpit over that pipeline.
        </p>
      </div>

      {loading ? (
        <div className="py-14 flex items-center gap-3 text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[11px] uppercase tracking-[0.24em]">Loading runtime state</span>
        </div>
      ) : (
        <>
          <LocalizationStatusHero
            summary={summary}
            iterations={summary?.iterations}
          />

          {/* Action row · ITER134 wires the 3 self-healing actions */}
          <div className="flex flex-wrap gap-3 mb-10" data-testid="locgov-actions">
            <Action
              icon={refreshing ? Loader2 : RefreshCcw}
              label="Refresh heatmap"
              onClick={onRefresh}
              testid="locgov-action-refresh"
            />
            <Action
              icon={Download}
              label="Download JSON"
              onClick={onDownload}
              testid="locgov-action-download"
            />
            <Action
              icon={ExternalLink}
              label="Open raw heatmap"
              onClick={onOpenRaw}
              testid="locgov-action-open-raw"
            />
            <Action
              icon={launching ? Loader2 : PlayCircle}
              label="Run runtime audit"
              onClick={onRunAudit}
              disabled={launching || !!activeJobId}
              hint={activeJobId ? 'In flight' : null}
              testid="locgov-action-run-audit"
            />
            <Action
              icon={launching ? Loader2 : PlayCircle}
              label="Re-run remediation loop"
              onClick={onRerunLoop}
              disabled={launching || !!activeJobId}
              hint={activeJobId ? 'In flight' : 'all 7 locales'}
              testid="locgov-action-rerun-loop"
            />
            <Action
              icon={Trash2}
              label="Clear fixed leaks"
              onClick={onClearFixed}
              testid="locgov-action-clear"
            />
          </div>

          {/* Route grid */}
          <div className="mb-10">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--mood-accent, #d9b285)] mb-2">
              Route severity map
            </p>
            <h3 className="font-heading text-[22px] leading-[1.2] text-[var(--mood-text, #f0ebe0)] tracking-[-0.005em] mb-1">
              {report?.pages?.length || 0} routes audited
            </h3>
            <p className="text-[11.5px] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.55))] mb-4">
              Tap a route to inspect its screenshot &amp; leak detail.
            </p>
            <RouteHeatmapGrid
              pages={report?.pages || []}
              onSelectRoute={setSelectedRoute}
            />
          </div>
        </>
      )}

      {selectedRoute && (
        <LocalizationScreenshotDrawer
          route={selectedRoute}
          onClose={() => setSelectedRoute(null)}
        />
      )}
      {activeJobId && (
        <SelfHealingProgressDrawer
          jobId={activeJobId}
          onClose={() => setActiveJobId(null)}
          onComplete={onLoopComplete}
        />
      )}
    </section>
  );
};

export default RuntimeHeatmapPanel;
