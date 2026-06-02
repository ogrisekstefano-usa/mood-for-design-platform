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

// ─── ITER200 · Resolution + Review Panel ────────────────────────────
function ResolutionReviewPanel({ setId, status }) {
  const [audit, setAudit] = useState(null);
  const [needsReview, setNeedsReview] = useState([]);
  const [resolving, setResolving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);

  const loadAudit = useCallback(async () => {
    try {
      const { data } = await KE.knowledgeAudit(setId);
      setAudit(data);
    } catch (_) { /* tolerate */ }
  }, [setId]);

  const loadReview = useCallback(async () => {
    try {
      const { data } = await KE.listNeedsReview(setId);
      setNeedsReview(data?.entities || []);
    } catch (_) { setNeedsReview([]); }
  }, [setId]);

  useEffect(() => { loadAudit(); loadReview(); }, [loadAudit, loadReview]);

  const onResolve = async () => {
    setResolving(true);
    try {
      await KE.resolveEntities(setId);
      toast.success('Entity Resolution™ completata');
      await loadAudit(); await loadReview();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Resolution fallita');
    } finally {
      setResolving(false);
    }
  };

  const handleAction = async (entityId, action) => {
    setBusyId(entityId);
    try {
      if (action === 'approve') await KE.approveEntity(setId, entityId);
      else if (action === 'reject') await KE.rejectEntity(setId, entityId);
      else if (action === 'promote') await KE.promoteEntityToCanonical(setId, entityId);
      toast.success(action === 'approve' ? 'Approvato'
                   : action === 'reject' ? 'Rifiutato' : 'Promosso a Canonical');
      await loadReview(); await loadAudit();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Azione fallita');
    } finally {
      setBusyId(null);
    }
  };

  // Filter
  const filtered = needsReview.filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'designer') return e.entity_type.includes('designer');
    if (filter === 'collection') return e.entity_type.includes('collection');
    if (filter === 'finish') return e.entity_type.includes('finish');
    return true;
  });

  const verdictTone = (v) => {
    if (!v) return 'tone-neutral';
    if (v.startsWith('A')) return 'tone-positive';
    if (v.startsWith('B')) return 'tone-warning';
    return 'tone-negative';
  };

  const scores = audit?.scores || {};

  return (
    <div className="ke-review-panel" data-testid="ke-review-panel">
      {/* Audit summary header */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start',
                     padding: 16, background: 'rgba(15,23,42,.04)',
                     border: '1px solid rgba(15,23,42,.08)', borderRadius: 8,
                     marginBottom: 16, flexWrap: 'wrap' }}
            data-testid="ke-audit-summary">
        <div style={{ flex: '1 1 240px' }}>
          <div className="ke-eyebrow">VERDETTO BRAND ATLAS™</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}
                data-testid="ke-audit-verdict">
            {audit?.verdict || '—'}
          </div>
          <span className={`ke-badge ${verdictTone(audit?.verdict)}`}
                 style={{ marginTop: 8, display: 'inline-block' }}>
            Score {audit?.knowledge_score ?? '—'} / 100
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(150px,1fr))',
                       gap: 8, flex: '2 1 320px' }}>
          <ScoreCell label="Knowledge Score" value={audit?.knowledge_score} target={80}
                     testid="ke-score-knowledge" />
          <ScoreCell label="Brand Atlas" value={audit?.brand_atlas_readiness} target={80}
                     testid="ke-score-brand-atlas" />
          <ScoreCell label="Graph" value={audit?.graph_completeness} target={90}
                     testid="ke-score-graph" />
          <ScoreCell label="Designer" value={scores.designer_coverage} target={80}
                     testid="ke-score-designer" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" className="ke-btn ke-btn-primary"
                   onClick={onResolve} disabled={resolving}
                   data-testid="ke-resolve-btn">
            <Icons.Sparkles size={14} aria-hidden="true" />
            <span>{resolving ? 'In corso…' : 'Esegui Resolution'}</span>
          </button>
          <button type="button" className="ke-btn"
                   onClick={() => { loadAudit(); loadReview(); }}
                   data-testid="ke-refresh-audit">
            <Icons.RefreshCw size={14} aria-hidden="true" />
            <span>Aggiorna</span>
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[
          ['all', `Tutte (${needsReview.length})`],
          ['designer', 'Designer'],
          ['collection', 'Collezioni'],
          ['finish', 'Finiture'],
        ].map(([k, label]) => (
          <button key={k} type="button"
                   className={`ke-btn ${filter === k ? 'ke-btn-primary' : ''}`}
                   onClick={() => setFilter(k)}
                   data-testid={`ke-review-filter-${k}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Review list */}
      {filtered.length === 0 ? (
        <div className="ke-empty" data-testid="ke-review-empty">
          Nessuna entità da revisionare in questa categoria.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8,
                       maxHeight: 600, overflowY: 'auto' }}
              data-testid="ke-review-list">
          {filtered.slice(0, 200).map((e) => (
            <ReviewRow key={e.id} entity={e}
                        busy={busyId === e.id}
                        onAction={handleAction} />
          ))}
          {filtered.length > 200 && (
            <div className="ke-empty-sm">
              +{filtered.length - 200} altre entità non mostrate
              (esegui Resolution per consolidare il backlog).
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreCell({ label, value, target, testid }) {
  const v = (value === undefined || value === null) ? null : Number(value);
  const ok = v !== null && target !== undefined && v >= target;
  return (
    <div data-testid={testid}
          style={{ padding: 10, background: '#fff', borderRadius: 6,
                    border: '1px solid rgba(15,23,42,.08)' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase',
                     color: 'rgba(15,23,42,.55)', letterSpacing: '.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4,
                     color: ok ? '#059669' : v !== null && v > 0 ? '#b45309' : '#6b7280' }}>
        {v === null ? '—' : v.toFixed(2)}
        {target !== undefined && (
          <span style={{ fontSize: 10, color: 'rgba(15,23,42,.4)',
                          marginLeft: 6 }}>
            / {target}
          </span>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ entity, busy, onAction }) {
  const conf = entity.confidence_score ?? null;
  const mentions = entity.mention_count ?? 0;
  const docs = (entity.source_document_ids || []).length;
  const typeLabel = entity.entity_type
    .replace('demoted_', '⤓ ')
    .replace('_', ' ');
  const isDemoted = entity.entity_type.startsWith('demoted_');
  const aliases = (entity.aliases || []).slice(0, 3);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between',
                   alignItems: 'center', padding: '10px 12px',
                   background: '#fff', border: '1px solid rgba(15,23,42,.08)',
                   borderRadius: 6, gap: 12, flexWrap: 'wrap' }}
          data-testid={`ke-review-row-${entity.id}`}>
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`ke-mini-pill ${isDemoted ? 'tone-neutral' : 'tone-warning'}`}>
            {typeLabel}
          </span>
          <span style={{ fontWeight: 600, fontSize: 14,
                          color: 'rgba(15,23,42,.92)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap' }}>
            {entity.display_name}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(15,23,42,.55)', marginTop: 4 }}>
          {conf !== null && <span>conf. {(conf * 100).toFixed(0)}% · </span>}
          <span>{mentions} mention</span>
          {docs > 0 && <span> · {docs} doc</span>}
          {aliases.length > 0 && (
            <span style={{ display: 'block', marginTop: 2 }}>
              alias: {aliases.join(' · ')}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button type="button" className="ke-btn"
                 disabled={busy}
                 onClick={() => onAction(entity.id, 'approve')}
                 data-testid={`ke-review-approve-${entity.id}`}>
          Approve
        </button>
        <button type="button" className="ke-btn"
                 disabled={busy}
                 onClick={() => onAction(entity.id, 'promote')}
                 data-testid={`ke-review-promote-${entity.id}`}>
          Promote
        </button>
        <button type="button" className="ke-btn"
                 disabled={busy}
                 onClick={() => onAction(entity.id, 'reject')}
                 data-testid={`ke-review-reject-${entity.id}`}>
          Reject
        </button>
      </div>
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

      {/* ── Section 2 · Extraction ─────────────────────────────────── */}
      <section className="ke-section-block" data-testid="ke-section-extraction">
        <h2 className="ke-section-block__title">
          <span className="ke-step-num">2</span>
          Estrazione e indicizzazione
        </h2>
        <ExtractionPanel
          setId={setId}
          status={status}
          statusData={statusData}
          onTrigger={onTriggerExtract}
          busy={extracting}
        />
      </section>

      {/* ── Section 3 · Validation ─────────────────────────────────── */}
      <section className="ke-section-block" data-testid="ke-section-validation">
        <h2 className="ke-section-block__title">
          <span className="ke-step-num">3</span>
          Validazione Brand Knowledge Package™
        </h2>
        {(status === 'needs_review' || status === 'validated' || status === 'published') ? (
          <ValidationPanel
            setId={setId}
            summary={summary}
            entities={entities}
            onRefresh={reloadAll}
            onPublish={onPublish}
          />
        ) : (
          <div className="ke-empty" data-testid="ke-validation-not-ready">
            La Validation Dashboard sarà disponibile al termine dell'estrazione.
          </div>
        )}
      </section>

      {/* ── Section 4 · Resolution + Review (ITER200) ──────────────── */}
      <section className="ke-section-block" data-testid="ke-section-review">
        <h2 className="ke-section-block__title">
          <span className="ke-step-num">4</span>
          Resolution &amp; Review · Brand Atlas Certification™
        </h2>
        {(status === 'needs_review' || status === 'validated' || status === 'published') ? (
          <ResolutionReviewPanel setId={setId} status={status} />
        ) : (
          <div className="ke-empty" data-testid="ke-review-not-ready">
            La Review Dashboard sarà disponibile al termine dell'estrazione.
          </div>
        )}
      </section>
    </div>
  );
}
