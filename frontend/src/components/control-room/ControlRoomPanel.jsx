/**
 * Knowledge Engine · Control Room™ · KE-002
 *
 * Single-file panel composition (5 sub-components inline):
 *   1. WorkerStatusBar       — 7 semantic states from /worker-status
 *   2. ExtractionKPIStrip    — 6 KPIs with session deltas
 *   3. LiveActivityStream    — append-only from /events (polling 2s)
 *   4. WarningCenter         — 7 categories from /needs-review?type=
 *   5. DocumentQueue         — per-row OPEN / REVIEW / RETRY
 *
 * Foundation: KE-001 backend endpoints. NO new backend logic invented here.
 * Renders inside CatalogSetWorkspacePage Section 2 (between Upload and V3).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import KE from '../../lib/knowledgeApi';
import './control-room.css';

const STATE_COPY = {
  idle:              { label: 'IDLE',              copy: 'Pronto · nessuna estrazione attiva' },
  active:            { label: 'ACTIVE',            copy: 'Worker attivo · estrazione in corso' },
  stalled:           { label: 'STALLED',           copy: 'Nessun progresso recente · in osservazione' },
  stalled_recovery:  { label: 'STALLED · RECOVERY', copy: 'Recovery automatico in corso' },
  failed:            { label: 'FAILED',            copy: 'Job interrotto · richiede intervento' },
  review_required:   { label: 'REVIEW REQUIRED',   copy: 'Ambiguità da risolvere prima della certificazione' },
  certified:         { label: 'CERTIFIED',         copy: 'Brand Knowledge Package certificato' },
};

const KIND_LABEL = {
  JOB_STARTED: 'JOB', JOB_COMPLETED: 'JOB', JOB_FAILED: 'JOB',
  JOB_STALLED: 'JOB', JOB_RECOVERED: 'JOB',
  JOB_PAUSED: 'JOB', JOB_RESUMED: 'JOB', JOB_CANCELLED: 'JOB',
  DOCUMENT_STARTED: 'DOC', DOCUMENT_FAILED: 'DOC',
  DOCUMENT_COMPLETED: 'DOC', DOCUMENT_RETRIED: 'DOC',
  PAGE_PROCESSED: 'PAGE', STAGE_TRANSITION: 'STAGE',
  IMAGE_FOUND: 'IMG', PRODUCT_FOUND: 'PROD',
  DESIGNER_FOUND: 'DSGN', MATERIAL_FOUND: 'MAT',
  BRAND_ALIAS_FOUND: 'ALIAS', RELATION_FOUND: 'REL',
  WARNING_CREATED: 'WARN', ERROR: 'ERR',
};

const WARNING_CATEGORIES = [
  { type: 'designer_ambiguous',   label: 'Designer ambigui' },
  { type: 'material_ambiguous',   label: 'Materiali ambigui' },
  { type: 'brand_duplicate',      label: 'Brand duplicati' },
  { type: 'product_unclassified', label: 'Prodotti sconosciuti' },
  { type: 'image_orphan',         label: 'Immagini senza match' },
  { type: 'low_confidence',       label: 'Confidence < 60%' },
  { type: 'failed_document',      label: 'Documenti falliti' },
];

const fmtNum = (n) => (typeof n === 'number' ? n.toLocaleString('it-IT') : (n ?? '—'));
const fmtTs = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
const fmtEta = (s) => {
  if (s == null) return '—';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}min`;
};
const fmtAge = (s) => {
  if (s == null) return '—';
  if (s < 5) return 'ora';
  if (s < 60) return `${s}s fa`;
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  return `${Math.floor(s / 3600)}h fa`;
};


// ─── 1 · Worker Status Bar ──────────────────────────────────────────
function WorkerStatusBar({ status, onCertify, onRetryFailed, onOpenReview }) {
  if (!status) {
    return (
      <div className="cr-status cr-status--idle" data-testid="ke-cr-worker-status">
        <span className="cr-status__pill">
          <span className="cr-status__dot" />
          <span>Loading…</span>
        </span>
      </div>
    );
  }
  const s = STATE_COPY[status.state] || STATE_COPY.idle;
  const j = status.job || {};
  const docName = j.current_document_name || '—';
  const stage = j.current_stage_label || j.current_stage || '—';
  const page = j.current_page != null ? j.current_page : '—';
  const total = j.total_pages || (status.queue.pending + status.queue.extracting + status.queue.review + status.queue.failed + status.queue.validated);
  return (
    <header className={`cr-status cr-status--${status.state}`} data-testid="ke-cr-worker-status">
      <span className="cr-status__pill" data-testid={`ke-cr-state-${status.state}`}>
        <span className="cr-status__dot" />
        <span>{s.label}</span>
      </span>
      <div className="cr-status__facts">
        <div className="cr-status__fact">
          <span className="cr-status__fact-label">Stato</span>
          <span className="cr-status__fact-value" data-testid="ke-cr-state-copy">{s.copy}</span>
        </div>
        {j.worker_id && (
          <div className="cr-status__fact">
            <span className="cr-status__fact-label">Worker</span>
            <span className="cr-status__fact-value">{j.worker_id.split(':').pop() || j.worker_id}</span>
          </div>
        )}
        {status.state === 'active' && j.current_document_name && (
          <>
            <div className="cr-status__fact">
              <span className="cr-status__fact-label">Documento</span>
              <span className="cr-status__fact-value" data-testid="ke-cr-current-doc">{docName}</span>
            </div>
            <div className="cr-status__fact">
              <span className="cr-status__fact-label">Pagina</span>
              <span className="cr-status__fact-value">{fmtNum(page)} / {fmtNum(j.total_pages || total)}</span>
            </div>
            <div className="cr-status__fact">
              <span className="cr-status__fact-label">Stage</span>
              <span className="cr-status__fact-value">{stage}</span>
            </div>
            <div className="cr-status__fact">
              <span className="cr-status__fact-label">ETA</span>
              <span className="cr-status__fact-value" data-testid="ke-cr-eta">{fmtEta(status.eta_seconds)}</span>
            </div>
          </>
        )}
        {(status.state === 'stalled' || status.state === 'stalled_recovery') && (
          <div className="cr-status__fact">
            <span className="cr-status__fact-label">Ultima attività</span>
            <span className="cr-status__fact-value">{fmtAge(status.heartbeat_age_seconds)}</span>
          </div>
        )}
        {status.state === 'failed' && j.error_message && (
          <div className="cr-status__fact">
            <span className="cr-status__fact-label">Errore</span>
            <span className="cr-status__fact-value" title={j.error_message}>{j.error_message.slice(0, 60)}</span>
          </div>
        )}
        <div className="cr-status__fact">
          <span className="cr-status__fact-label">Queue</span>
          <span className="cr-status__fact-value">
            {status.queue.pending} pending · {status.queue.extracting} active · {status.queue.failed} failed · {status.queue.review} review
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {status.state === 'failed' && status.queue.failed > 0 && (
          <button className="cr-status__cta" onClick={onRetryFailed} data-testid="ke-cr-retry-failed">
            ↻ Riprova falliti
          </button>
        )}
        {status.state === 'review_required' && status.warnings_total > 0 && (
          <button className="cr-status__cta" onClick={onOpenReview} data-testid="ke-cr-open-review">
            → Review Workspace
          </button>
        )}
        {status.state === 'certified' && (
          <button className="cr-status__cta" onClick={onOpenReview} data-testid="ke-cr-launchpad">
            🚀 Launchpad
          </button>
        )}
      </div>
    </header>
  );
}


// ─── 2 · Extraction KPI Strip ───────────────────────────────────────
function ExtractionKPIStrip({ kpi, deltas }) {
  const cells = [
    { key: 'products',  label: 'Prodotti' },
    { key: 'designers', label: 'Designer' },
    { key: 'materials', label: 'Materiali' },
    { key: 'images',    label: 'Immagini' },
    { key: 'relations', label: 'Relazioni' },
    { key: 'aliases',   label: 'Brand Alias' },
  ];
  return (
    <div className="cr-kpi" data-testid="ke-cr-kpi-strip">
      {cells.map((c) => {
        const v = kpi[c.key] ?? 0;
        const d = deltas[c.key] ?? 0;
        return (
          <div className="cr-kpi__cell" key={c.key} data-testid={`ke-cr-kpi-${c.key}`}>
            <span className="cr-kpi__label">{c.label}</span>
            <div className="cr-kpi__row">
              <span className="cr-kpi__value">{fmtNum(v)}</span>
              <span className={`cr-kpi__delta ${d === 0 ? 'cr-kpi__delta--zero' : ''}`}>
                {d > 0 ? `+${d}` : d === 0 ? '·' : `${d}`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ─── 3 · Live Activity Stream ───────────────────────────────────────
function LiveActivityStream({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="cr-stream__empty" data-testid="ke-cr-stream-empty">
        Nessuna attività registrata · l'estrazione non è ancora stata avviata.
      </div>
    );
  }
  return (
    <div className="cr-stream" data-testid="ke-cr-stream">
      {events.slice(0, 20).map((e) => (
        <div className={`cr-event cr-event--${e.kind}`} key={e.id} data-testid={`ke-cr-event-${e.kind}`}>
          <span className="cr-event__ts">{fmtTs(e.ts)}</span>
          <span className="cr-event__kind">{KIND_LABEL[e.kind] || e.kind}</span>
          <span className="cr-event__msg" title={e.message}>{e.message}</span>
        </div>
      ))}
    </div>
  );
}


// ─── 4 · Warning Center ─────────────────────────────────────────────
function WarningCenter({ counts, onCategoryClick, onCtaClick }) {
  const total = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
  return (
    <div data-testid="ke-cr-warning-center">
      <div className="cr-warnings">
        {WARNING_CATEGORIES.map((cat) => {
          const n = counts[cat.type] ?? 0;
          return (
            <div
              key={cat.type}
              className={`cr-warning ${n === 0 ? 'cr-warning--zero' : ''}`}
              onClick={n > 0 ? () => onCategoryClick(cat.type) : undefined}
              data-testid={`ke-cr-warning-${cat.type}`}
            >
              <span className="cr-warning__label">{cat.label}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="cr-warning__count">{n}</span>
                {n > 0 && <span className="cr-warning__arrow">→</span>}
              </span>
            </div>
          );
        })}
      </div>
      {total > 0 && (
        <div className="cr-warning-cta" onClick={onCtaClick} data-testid="ke-cr-warning-cta">
          <span>Apri Review Workspace™ ({total})</span>
          <span className="cr-warning-cta__arrow">→</span>
        </div>
      )}
    </div>
  );
}


// ─── 5 · Document Queue ─────────────────────────────────────────────
function DocumentQueue({ documents, onOpen, onReview, onRetry, onRetryFailed, retryingAll }) {
  const failedCount = documents.filter((d) => d.extraction_status === 'failed').length;
  return (
    <div className="cr-docs" data-testid="ke-cr-document-queue">
      <div className="cr-docs__header">
        <span className="cr-col__title" style={{ margin: 0 }}>
          Document Queue <small>· {documents.length} documenti</small>
        </span>
      </div>
      <div className="cr-docs__list">
        {documents.length === 0 && (
          <div className="cr-empty">Nessun documento caricato.</div>
        )}
        {documents.map((d) => {
          const status = d.extraction_status || 'pending';
          const canRetry = status === 'failed';
          const canReview = status === 'review' || status === 'validated' || status === 'failed';
          return (
            <div className={`cr-doc cr-doc--${status}`} key={d.id} data-testid={`ke-cr-doc-${d.id}`}>
              <span className="cr-doc__icon" />
              <span className="cr-doc__name" title={d.display_name || d.original_filename}>
                {d.display_name || d.original_filename || 'Documento'}
              </span>
              <span className="cr-doc__pages">
                {d.pages_processed || 0} / {d.page_count || '?'}
              </span>
              <div className="cr-doc__actions">
                <button
                  className="cr-doc__btn"
                  onClick={() => onOpen(d)}
                  data-testid={`ke-cr-doc-open-${d.id}`}
                >
                  Open
                </button>
                <button
                  className="cr-doc__btn cr-doc__btn--review"
                  onClick={() => onReview(d)}
                  disabled={!canReview}
                  data-testid={`ke-cr-doc-review-${d.id}`}
                >
                  Review
                </button>
                <button
                  className="cr-doc__btn cr-doc__btn--retry"
                  onClick={() => onRetry(d)}
                  disabled={!canRetry}
                  data-testid={`ke-cr-doc-retry-${d.id}`}
                >
                  Retry
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="cr-docs__footer">
        <span className="cr-docs__count">
          {failedCount} failed · {documents.filter((d) => d.extraction_status === 'pending').length} pending
          · {documents.filter((d) => d.extraction_status === 'review').length} review
        </span>
        <button
          className="cr-docs__bulk"
          onClick={onRetryFailed}
          disabled={failedCount === 0 || retryingAll}
          data-testid="ke-cr-bulk-retry-failed"
        >
          {retryingAll ? 'In corso…' : `↻ Retry ${failedCount} failed`}
        </button>
      </div>
    </div>
  );
}


// ─── Main panel ─────────────────────────────────────────────────────
export default function ControlRoomPanel({ setId, documents = [], onAfterAction }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState([]);
  const [kpi, setKpi] = useState({ products: 0, designers: 0, materials: 0, images: 0, relations: 0, aliases: 0 });
  const baselineRef = useRef(null);
  const [deltas, setDeltas] = useState({});
  const [warningCounts, setWarningCounts] = useState({});
  const [retryingAll, setRetryingAll] = useState(false);

  // ── Polling: worker-status + events + KPI snapshot every 2s ──
  const sinceRef = useRef(null);
  const pollRef = useRef(null);
  const refresh = useCallback(async () => {
    try {
      const [s, ev, vs] = await Promise.all([
        KE.workerStatus(setId).catch(() => null),
        KE.listEvents(setId, { limit: 30, since: sinceRef.current }).catch(() => null),
        KE.validationSummary(setId).catch(() => null),
      ]);
      if (s?.data) setStatus(s.data);
      if (ev?.data) {
        const newEvents = ev.data.events || [];
        if (newEvents.length > 0) {
          setEvents((prev) => {
            const merged = [...newEvents, ...prev];
            // dedupe by id, keep newest first
            const seen = new Set();
            const dedup = [];
            for (const e of merged) {
              if (!seen.has(e.id)) { seen.add(e.id); dedup.push(e); }
            }
            return dedup.slice(0, 30);
          });
          if (ev.data.next_since) sinceRef.current = ev.data.next_since;
        } else if (sinceRef.current == null && newEvents.length === 0) {
          // bootstrap: load latest batch even without `since`
          setEvents([]);
        }
      }
      if (vs?.data) {
        const summary = vs.data || {};
        const newKpi = {
          products:  summary.product_count   || summary.products   || 0,
          designers: summary.designer_count  || summary.designers  || 0,
          materials: summary.material_count  || summary.materials  || 0,
          images:    summary.image_count     || summary.images     || 0,
          relations: summary.relations_count || summary.relations  || 0,
          aliases:   summary.alias_count     || summary.aliases    || 0,
        };
        setKpi(newKpi);
        if (!baselineRef.current) {
          baselineRef.current = { ...newKpi };
          setDeltas({ products: 0, designers: 0, materials: 0, images: 0, relations: 0, aliases: 0 });
        } else {
          const b = baselineRef.current;
          setDeltas({
            products:  newKpi.products  - b.products,
            designers: newKpi.designers - b.designers,
            materials: newKpi.materials - b.materials,
            images:    newKpi.images    - b.images,
            relations: newKpi.relations - b.relations,
            aliases:   newKpi.aliases   - b.aliases,
          });
        }
      }
    } catch (_) { /* tolerate transient errors */ }
  }, [setId]);

  // ── Warning counts: pull once + after status changes ──
  const refreshWarnings = useCallback(async () => {
    const counts = {};
    await Promise.all(WARNING_CATEGORIES.map(async (cat) => {
      try {
        const { data } = await KE.needsReviewByType(setId, cat.type, false);
        counts[cat.type] = data.count || 0;
      } catch (_) {
        counts[cat.type] = 0;
      }
    }));
    setWarningCounts(counts);
  }, [setId]);

  useEffect(() => {
    refresh();
    refreshWarnings();
    pollRef.current = setInterval(refresh, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [refresh, refreshWarnings]);

  // Refresh warnings whenever status state changes
  useEffect(() => { refreshWarnings(); }, [status?.state, refreshWarnings]);

  // ── Action handlers ──
  const handleOpen = (doc) => {
    toast(`📄 ${doc.display_name || doc.original_filename}`, {
      description: `${doc.pages_processed || 0} / ${doc.page_count || '?'} pagine · stato: ${doc.extraction_status}`,
    });
  };
  const handleReview = async (doc) => {
    try {
      const { data } = await KE.documentReviewContext(setId, doc.id);
      const el = document.querySelector(`[data-testid="rw-v3-root"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      if (data?.first_anomaly) {
        toast.success(`Review: ${data.count} entità da risolvere su "${doc.display_name || doc.original_filename}"`);
      } else if (data) {
        toast.info(`Nessuna ambiguità rilevata su "${doc.display_name || doc.original_filename}" · doc status: ${doc.extraction_status}`);
      } else {
        toast.warning('Review context non disponibile');
      }
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || err.message;
      toast.error(`Review context: ${status ? `${status} · ` : ''}${detail}`);
    }
  };
  const handleRetry = async (doc) => {
    try {
      await KE.retryDocument(setId, doc.id);
      toast.success(`Retry avviato: ${doc.display_name || doc.original_filename}`);
      onAfterAction?.();
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Retry fallito');
    }
  };
  const handleRetryFailed = async () => {
    setRetryingAll(true);
    try {
      const { data } = await KE.retryFailed(setId, { dry_run: false });
      toast.success(`${data.reset || 0} documenti rilanciati`);
      onAfterAction?.();
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Bulk retry fallito');
    } finally {
      setRetryingAll(false);
    }
  };
  const handleWarningCategory = async (type) => {
    try {
      const { data } = await KE.needsReviewByType(setId, type, true);
      const el = document.querySelector(`[data-testid="rw-v3-root"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      toast(`Warning: ${data.count || 0} elementi in "${type}"`, {
        description: data.first_anomaly ? `Apertura prima anomalia: ${data.first_anomaly.slice(0, 8)}…` : 'Nessuna anomalia',
      });
    } catch (err) {
      toast.error('Filtro non disponibile');
    }
  };
  const handleOpenReview = () => {
    const el = document.querySelector(`[data-testid="rw-v3-root"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="ke-cr" data-testid="ke-cr-root">
      <WorkerStatusBar
        status={status}
        onRetryFailed={handleRetryFailed}
        onOpenReview={handleOpenReview}
      />
      <ExtractionKPIStrip kpi={kpi} deltas={deltas} />
      <div className="cr-body">
        <div className="cr-col">
          <h3 className="cr-col__title">
            Live Activity Stream <small>· tail ultime 20</small>
          </h3>
          <LiveActivityStream events={events} />
        </div>
        <div className="cr-col">
          <h3 className="cr-col__title">
            Warning Center <small>· 7 categorie</small>
          </h3>
          <WarningCenter
            counts={warningCounts}
            onCategoryClick={handleWarningCategory}
            onCtaClick={handleOpenReview}
          />
        </div>
      </div>
      <DocumentQueue
        documents={documents}
        onOpen={handleOpen}
        onReview={handleReview}
        onRetry={handleRetry}
        onRetryFailed={handleRetryFailed}
        retryingAll={retryingAll}
      />
    </section>
  );
}
