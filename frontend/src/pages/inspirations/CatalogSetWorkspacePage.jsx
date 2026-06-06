/**
 * CatalogSetWorkspacePage — ITER195 Phase 4A · Validation-only.
 *
 * Single page with 3 stacked sections (no fancy tabs, no graph viewer):
 *   1. UPLOAD     · drag&drop multi-PDF (max 50) + lista documenti
 *   2. ESTRAZIONE · trigger background extraction + polling 2s
 *   3. VALIDAZIONE · validation summary + collection detection +
 *                    Knowledge Package preview (JSON)
 *
 * Path: /inspirations/knowledge-engine/catalog-sets/:setId
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import KE from '../../lib/knowledgeApi';
import ReviewWorkspaceV3 from '../../components/review-workspace/ReviewWorkspaceV3';
import ControlRoomPanel from '../../components/control-room/ControlRoomPanel';
import './knowledge-engine.css';

const STATUS_LABEL = {
  draft: 'Bozza',
  uploading: 'Caricamento',
  extracting: 'Estrazione in corso',
  needs_review: 'Da validare',
  validated: 'Validato',
  published: 'Pubblicato',
  archived: 'Archiviato',
};
const STATUS_TONE = {
  draft: 'tone-neutral',
  uploading: 'tone-info',
  extracting: 'tone-info',
  needs_review: 'tone-warning',
  validated: 'tone-positive',
  published: 'tone-positive',
  archived: 'tone-neutral',
};
const DOC_STATUS_LABEL = {
  pending: 'In attesa',
  extracting: 'Estrazione',
  review: 'Pronto per la review',
  validated: 'Validato',
  failed: 'Necessita controllo',
};

const ENTITY_LABEL = {
  collection: 'Collezioni',
  composition: 'Composizioni',
  product: 'Prodotti',
  finish: 'Finiture',
  material: 'Materiali',
  designer: 'Designer',
  accessory: 'Accessori',
  mirror: 'Specchiere',
  washbasin: 'Lavabi',
  tap: 'Rubinetterie',
};

// ─── Upload Panel ───────────────────────────────────────────────────
function UploadPanel({ setId, status, onUploaded }) {
  const inputRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const disabled = status === 'extracting' || status === 'published' || status === 'archived';

  const handleFiles = useCallback(async (fileList) => {
    if (disabled) return;
    const files = Array.from(fileList || []).filter((f) =>
      (f.type || '').includes('pdf') || /\.pdf$/i.test(f.name)
    );
    if (files.length === 0) {
      toast.error('Solo file PDF sono accettati.');
      return;
    }
    if (files.length > 50) {
      toast.error('Massimo 50 PDF per batch.');
      return;
    }
    const form = new FormData();
    files.forEach((f) => form.append('files', f, f.name));
    setBusy(true); setProgress(0);
    try {
      const { data } = await KE.uploadDocuments(setId, form, (ev) => {
        if (ev?.total) setProgress(Math.round((ev.loaded / ev.total) * 100));
      });
      const ok = data.ok_count || 0;
      const failed = data.failed_count || 0;
      if (ok > 0) toast.success(`${ok} PDF caricati`);
      if (failed > 0) {
        const errs = (data.uploaded || []).filter((u) => !u.ok)
          .map((u) => `${u.file}: ${u.error}`).slice(0, 3).join(' · ');
        toast.error(`${failed} non caricati. ${errs}`);
      }
      onUploaded?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Upload fallito');
    } finally {
      setBusy(false); setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [setId, disabled, onUploaded]);

  return (
    <div
      className={`ke-upload ${hover ? 'is-hover' : ''} ${disabled ? 'is-disabled' : ''}`}
      onDragOver={(e) => { if (!disabled) { e.preventDefault(); setHover(true); } }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault(); setHover(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      data-testid="ke-upload-panel"
    >
      <Icons.UploadCloud size={28} aria-hidden="true" />
      <div className="ke-upload__title">
        {busy ? `Caricamento ${progress}%` : 'Trascina i PDF qui'}
      </div>
      <div className="ke-upload__hint">
        Fino a 50 PDF in un singolo batch · solo formato PDF
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
        data-testid="ke-upload-input"
      />
      <button
        type="button"
        className="ke-btn ke-btn-primary"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
        data-testid="ke-upload-browse-btn"
      >
        {busy ? '…' : 'Seleziona file'}
      </button>
      {disabled && (
        <div className="ke-hint-muted">
          {status === 'extracting'
            ? 'Estrazione in corso — attendere completamento per caricare altri PDF.'
            : 'Catalog Set non modificabile in questo stato.'}
        </div>
      )}
    </div>
  );
}

// ─── Documents List ─────────────────────────────────────────────────
function DocumentsList({ documents, onDelete, setStatus }) {
  if (!documents || documents.length === 0) {
    return (
      <div className="ke-doc-empty">
        Nessun PDF caricato. Aggiungine almeno uno per avviare l'estrazione.
      </div>
    );
  }
  return (
    <ul className="ke-doc-list" data-testid="ke-doc-list">
      {documents.map((d) => (
        <li key={d.id} className="ke-doc-row" data-testid={`ke-doc-row-${d.id}`}>
          <div className="ke-doc-row__left">
            <Icons.FileText size={16} aria-hidden="true" />
            <div className="ke-doc-row__title">
              {d.display_name || d.original_filename || 'PDF'}
            </div>
            <div className="ke-doc-row__meta">
              {d.page_count ? `${d.page_count} pagine` : '—'}
              {d.pages_processed > 0 ? ` · ${d.pages_processed} elaborate` : ''}
            </div>
          </div>
          <div className="ke-doc-row__right">
            <span className={`ke-pill ke-pill-${d.extraction_status}`}>
              {DOC_STATUS_LABEL[d.extraction_status] || d.extraction_status}
            </span>
            {setStatus !== 'extracting' && setStatus !== 'published' && (
              <button
                type="button"
                className="ke-icon-btn"
                aria-label="Rimuovi"
                onClick={() => {
                  if (window.confirm(`Rimuovere "${d.display_name || d.original_filename}"?`)) {
                    onDelete?.(d.id);
                  }
                }}
                data-testid={`ke-doc-delete-${d.id}`}
              >
                <Icons.X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Extraction Progress Panel ──────────────────────────────────────
function ExtractionPanel({ setId, status, statusData, onTrigger, busy }) {
  const docs = statusData?.documents || [];
  const pct = Number(statusData?.extraction_progress || 0);
  const canTrigger = (status === 'uploading' || status === 'draft' || status === 'needs_review')
    && (statusData?.document_count || 0) > 0
    && status !== 'extracting';

  return (
    <div className="ke-extract-panel" data-testid="ke-extract-panel">
      <div className="ke-extract-head">
        <div>
          <div className="ke-eyebrow">PIPELINE</div>
          <div className="ke-extract-title">
            {status === 'extracting' ? 'Estrazione in corso' :
             status === 'needs_review' ? 'Estrazione completata — pronta per la validazione' :
             status === 'published' ? 'Catalog Set pubblicato' :
             'Estrazione non ancora avviata'}
          </div>
          <div className="ke-extract-meta">
            {statusData?.documents_extracted || 0} / {statusData?.document_count || 0} documenti
            {' · '}
            {statusData?.pages_processed || 0} / {statusData?.total_pages || 0} pagine
            {statusData?.documents_failed > 0
              ? ` · ${statusData.documents_failed} da controllare`
              : ''}
          </div>
        </div>
        <button
          type="button"
          className="ke-btn ke-btn-primary"
          onClick={onTrigger}
          disabled={!canTrigger || busy}
          data-testid="ke-extract-trigger"
        >
          {busy ? 'Avvio…'
            : status === 'extracting' ? 'In corso…'
            : status === 'needs_review' ? 'Rilancia estrazione'
            : 'Avvia estrazione'}
        </button>
      </div>
      <div className="ke-progress" aria-label="Progresso estrazione" role="progressbar"
           aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="ke-progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="ke-progress__pct">{pct.toFixed(1)}%</div>
      {docs.length > 0 && (
        <ul className="ke-extract-doclist">
          {docs.map((d) => {
            const dpct = d.page_count
              ? Math.round(100 * (d.pages_processed || 0) / d.page_count) : 0;
            const isExtracting = d.extraction_status === 'extracting';
            const stageLine = isExtracting && d.stage_label
              ? d.stage_label
              : null;
            const visionLine = isExtracting && d.vision_total
              ? `· ${d.vision_current || 0}/${d.vision_total} immagini`
              : '';
            return (
              <li key={d.id} className="ke-extract-docrow"
                   data-testid={`ke-extract-docrow-${d.id}`}>
                <span className="ke-extract-docname">
                  {d.display_name}
                  {stageLine && (
                    <em style={{
                      display: 'block', fontStyle: 'normal',
                      fontSize: '11px', color: 'var(--bp-text-muted, #94a3b8)',
                      marginTop: '2px',
                    }} data-testid={`ke-extract-stage-${d.id}`}>
                      {stageLine} {visionLine}
                    </em>
                  )}
                </span>
                <span className={`ke-pill ke-pill-${d.extraction_status}`}>
                  {DOC_STATUS_LABEL[d.extraction_status] || d.extraction_status}
                </span>
                <span className="ke-extract-docpct"
                       data-testid={`ke-extract-docpct-${d.id}`}>
                  {(d.pages_processed || 0)}/{d.page_count || 0} pag · {dpct}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Validation Summary Panel ───────────────────────────────────────
function ValidationPanel({ setId, summary, entities, onRefresh, onPublish }) {
  const ec = summary?.entity_counts || {};
  const types = Object.keys(ec).sort();
  const totalEntities = types.reduce((s, t) => s + (ec[t].total || 0), 0);

  const collections = (entities || []).filter((e) => e.entity_type === 'collection')
    .sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));
  const needsReview = (entities || []).filter((e) => e.status === 'needs_review');
  const autoMerged = (entities || []).filter((e) => e.status === 'auto_merged');

  const downloadKp = () => {
    const payload = {
      catalog_set: summary?.catalog_set,
      brand: summary?.brand,
      documents: summary?.documents,
      entity_counts: ec,
      page_review: summary?.page_review,
      index_summary: summary?.index_summary,
      entities: entities,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)],
                          { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = (summary?.brand?.slug || 'brand');
    a.href = url;
    a.download = `knowledge-package-${slug}-${setId.slice(0, 8)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success('Knowledge Package esportato');
  };

  return (
    <div className="ke-valid-panel" data-testid="ke-validation-panel">
      <header className="ke-valid-head">
        <div>
          <div className="ke-eyebrow">VALIDATION DASHBOARD</div>
          <div className="ke-extract-title">
            Brand Knowledge Package™ — {totalEntities} entità rilevate
          </div>
        </div>
        <div className="ke-valid-actions">
          <button
            type="button"
            className="ke-btn"
            onClick={onRefresh}
            data-testid="ke-valid-refresh"
          >
            <Icons.RefreshCw size={14} aria-hidden="true" />
            <span>Aggiorna</span>
          </button>
          <button
            type="button"
            className="ke-btn"
            onClick={downloadKp}
            disabled={!summary}
            data-testid="ke-export-kp"
          >
            <Icons.Download size={14} aria-hidden="true" />
            <span>Esporta JSON</span>
          </button>
          <button
            type="button"
            className="ke-btn ke-btn-primary"
            onClick={onPublish}
            disabled={!summary || summary.catalog_set?.status === 'published'
                       || needsReview.length > 0}
            data-testid="ke-publish-btn"
          >
            <Icons.CheckCircle2 size={14} aria-hidden="true" />
            <span>
              {summary?.catalog_set?.status === 'published'
                ? 'Pubblicato'
                : 'Pubblica nel Knowledge Graph'}
            </span>
          </button>
        </div>
      </header>

      {/* Entity counts grid */}
      <section className="ke-counts-grid" data-testid="ke-counts-grid">
        {types.map((t) => (
          <div key={t} className="ke-counts-card" data-testid={`ke-count-${t}`}>
            <div className="ke-counts-card__total">{ec[t].total}</div>
            <div className="ke-counts-card__label">
              {ENTITY_LABEL[t] || t}
            </div>
            <div className="ke-counts-card__breakdown">
              {ec[t].auto_merged > 0 && (
                <span className="ke-mini-pill tone-positive">
                  {ec[t].auto_merged} auto
                </span>
              )}
              {ec[t].needs_review > 0 && (
                <span className="ke-mini-pill tone-warning">
                  {ec[t].needs_review} review
                </span>
              )}
              {ec[t].validated > 0 && (
                <span className="ke-mini-pill tone-positive">
                  {ec[t].validated} validati
                </span>
              )}
            </div>
          </div>
        ))}
        {types.length === 0 && (
          <div className="ke-empty">
            Nessuna entità ancora. Esegui l'estrazione per popolare l'indice.
          </div>
        )}
      </section>

      {/* Collection Detection */}
      <section className="ke-section" data-testid="ke-collections-section">
        <h3 className="ke-section__title">
          <Icons.Library size={16} aria-hidden="true" />
          Collection Detection
          <span className="ke-section__count">{collections.length}</span>
        </h3>
        {collections.length === 0 ? (
          <div className="ke-empty-sm">Nessuna collezione rilevata.</div>
        ) : (
          <ul className="ke-collection-list">
            {collections.map((c) => (
              <li key={c.id} className="ke-collection-row"
                  data-testid={`ke-collection-${c.id}`}>
                <div className="ke-collection-name">{c.display_name}</div>
                <div className="ke-collection-meta">
                  <span>conf. {(c.confidence_score * 100).toFixed(0)}%</span>
                  <span>· {c.mention_count} mention</span>
                  <span>· {(c.source_document_ids || []).length} doc</span>
                  <span className={`ke-mini-pill tone-${
                    c.status === 'auto_merged' || c.status === 'validated' ? 'positive'
                    : c.status === 'needs_review' ? 'warning' : 'neutral'
                  }`}>{c.status}</span>
                </div>
                {c.aliases && c.aliases.length > 0 && (
                  <div className="ke-collection-aliases">
                    alias: {c.aliases.slice(0, 3).join(' · ')}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Needs review block */}
      {needsReview.length > 0 && (
        <section className="ke-section ke-section-warn"
                  data-testid="ke-needs-review-section">
          <h3 className="ke-section__title">
            <Icons.AlertCircle size={16} aria-hidden="true" />
            Needs review
            <span className="ke-section__count">{needsReview.length}</span>
          </h3>
          <p className="ke-empty-sm">
            Queste entità hanno confidence 0.60–0.85: revisiona manualmente prima
            di pubblicare. (Validazione fine via futura UI dedicata; per ora
            puoi confermare singolarmente o esportare il pacchetto per analisi.)
          </p>
          <ul className="ke-collection-list">
            {needsReview.slice(0, 12).map((c) => (
              <li key={c.id} className="ke-collection-row">
                <div className="ke-collection-name">
                  <span className="ke-type-pill">
                    {ENTITY_LABEL[c.entity_type] || c.entity_type}
                  </span>
                  {c.display_name}
                </div>
                <div className="ke-collection-meta">
                  <span>conf. {(c.confidence_score * 100).toFixed(0)}%</span>
                  <span>· {c.mention_count} mention</span>
                </div>
              </li>
            ))}
            {needsReview.length > 12 && (
              <li className="ke-empty-sm">
                +{needsReview.length - 12} altre in review…
              </li>
            )}
          </ul>
        </section>
      )}

      {/* Auto-merged sample */}
      {autoMerged.length > 0 && (
        <section className="ke-section ke-section-ok"
                  data-testid="ke-auto-merged-section">
          <h3 className="ke-section__title">
            <Icons.CheckCircle2 size={16} aria-hidden="true" />
            Auto-validate (confidence ≥ 0.85)
            <span className="ke-section__count">{autoMerged.length}</span>
          </h3>
          <p className="ke-empty-sm">
            Entità con alta confidence + multi-documento, già pronte. Nessuna
            azione richiesta.
          </p>
        </section>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function CatalogSetWorkspacePage() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [setInfo, setSetInfo] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [entities, setEntities] = useState([]);
  const [extracting, setExtractingBusy] = useState(false);
  const pollRef = useRef(null);

  const reloadAll = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([
        KE.getCatalogSet(setId),
        KE.extractionStatus(setId),
      ]);
      setSetInfo(s.data);
      setStatusData(st.data);
      if (st.data?.status === 'needs_review'
          || st.data?.status === 'validated'
          || st.data?.status === 'published') {
        const [sm, en] = await Promise.all([
          KE.validationSummary(setId),
          KE.listEntities(setId, { limit: 500 }),
        ]);
        setSummary(sm.data); setEntities(en.data?.entities || []);
      } else {
        setSummary(null); setEntities([]);
      }
    } catch (err) {
      toast.error('Impossibile caricare il Catalog Set');
    }
  }, [setId]);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  // Poll every 2s while extracting
  useEffect(() => {
    if (statusData?.status !== 'extracting') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await KE.extractionStatus(setId);
        setStatusData(data);
        if (data?.status !== 'extracting') {
          // Refresh full state when transition occurs
          reloadAll();
        }
      } catch (_) { /* tolerate */ }
    }, 2000);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [statusData?.status, setId, reloadAll]);

  const onDocDelete = async (docId) => {
    try {
      await KE.deleteSetDocument(setId, docId);
      toast.success('PDF rimosso');
      reloadAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Rimozione fallita');
    }
  };

  const onTriggerExtract = async () => {
    setExtractingBusy(true);
    try {
      await KE.triggerExtraction(setId, {});
      toast.success('Estrazione avviata');
      reloadAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Avvio fallito');
    } finally {
      setExtractingBusy(false);
    }
  };

  const onPublish = async () => {
    try {
      await KE.publishSet(setId);
      toast.success('Catalog Set pubblicato nel Knowledge Graph');
      reloadAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Pubblicazione bloccata');
    }
  };

  if (!setInfo) {
    return (
      <div className="ke-page" data-testid="ke-workspace-loading">
        <div className="ke-loading">
          <Icons.Loader2 className="ke-spin" size={18} />
          <span>Caricamento workspace…</span>
        </div>
      </div>
    );
  }

  const cset = setInfo.catalog_set || {};
  const status = cset.status;
  const tone = STATUS_TONE[status] || 'tone-neutral';
  const label = STATUS_LABEL[status] || status;

  return (
    <div className="ke-page" data-testid="ke-workspace-page">
      <header className="ke-workspace__head">
        <div>
          <Link to="/inspirations/knowledge-engine" className="ke-back-link"
                data-testid="ke-back-link">
            <Icons.ArrowLeft size={14} aria-hidden="true" />
            <span>Knowledge Engine</span>
          </Link>
          <h1 className="ke-title" data-testid="ke-workspace-title">{cset.name}</h1>
          <div className="ke-workspace__meta">
            <span className={`ke-badge ${tone}`} data-testid="ke-status-badge">{label}</span>
            <span>{setInfo.document_count || 0} PDF</span>
            <span>{statusData?.total_pages || 0} pagine totali</span>
            {cset.published_at && (
              <span>Pubblicato il {new Date(cset.published_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Section 1 · Upload ─────────────────────────────────────── */}
      <section className="ke-section-block" data-testid="ke-section-upload">
        <h2 className="ke-section-block__title">
          <span className="ke-step-num">1</span>
          Carica i PDF del brand
        </h2>
        <UploadPanel
          setId={setId}
          status={status}
          onUploaded={reloadAll}
        />
        <DocumentsList
          documents={setInfo.documents}
          onDelete={onDocDelete}
          setStatus={status}
        />
      </section>

      {/* ── Section 2 · Knowledge Engine Control Room™ (KE-002) ───── */}
      <section className="ke-section-block" data-testid="ke-section-extraction"
               style={{ padding: 0, background: 'transparent', border: 'none' }}>
        <h2 className="ke-section-block__title" style={{ padding: '0 0 12px' }}>
          <span className="ke-step-num">2</span>
          Knowledge Engine Control Room™
          {status === 'draft' && (
            <button
              onClick={onTriggerExtract}
              disabled={extracting}
              data-testid="ke-cr-trigger-extract"
              style={{
                marginLeft: 16, padding: '6px 14px',
                background: 'rgba(0,229,255,0.12)', color: '#00e5ff',
                border: '1px solid #00e5ff', borderRadius: 4, cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5,
              }}
            >
              {extracting ? 'Avvio…' : '▶ Trigger Estrazione'}
            </button>
          )}
        </h2>
        <ControlRoomPanel
          setId={setId}
          documents={(setInfo?.documents) || []}
          onAfterAction={reloadAll}
        />
      </section>

      {/* ── Section 3 · Review Workspace™ V3 (Brand Atlas → Ecosistema MOOD) ── */}
      {(status === 'needs_review' || status === 'validated' || status === 'published') ? (
        <section className="ke-section-block" data-testid="ke-section-review-v3"
                 style={{ padding: 0, background: 'transparent', border: 'none' }}>
          <ReviewWorkspaceV3
            setId={setId}
            status={status}
            setInfo={setInfo}
            statusData={statusData}
            onAfterPublish={reloadAll}
          />
        </section>
      ) : (
        <section className="ke-section-block" data-testid="ke-section-review-not-ready">
          <h2 className="ke-section-block__title">
            <span className="ke-step-num">3</span>
            Review Workspace™ · Brand Atlas → Ecosistema MOOD
          </h2>
          <div className="ke-empty" data-testid="ke-review-v3-not-ready">
            Il Review Workspace sarà disponibile al termine dell'estrazione.
          </div>
        </section>
      )}
    </div>
  );
}
