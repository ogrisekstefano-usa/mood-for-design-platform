/**
 * ITER201 · Review Workspace™
 *
 * Human-in-the-Loop knowledge validation layer embedded inside the
 * Brand Catalog workspace. Operator can review, approve, merge, reject
 * and promote entities directly from the UI — no SQL, no developer.
 *
 * Sections:
 *   1. Review Queue summary header
 *   2. Entity cards (clickable, multi-select)
 *   3. Review Drawer (Shadcn Sheet)
 *   4. Review Actions inside drawer
 *   5. Bulk action bar
 *   6. Publish Gate readiness panel
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '../../components/ui/sheet';
import KE from '../../lib/knowledgeApi';

const TYPE_LABEL = {
  collection: 'Collezione',
  demoted_collection: '⤓ Collezione (demoted)',
  designer: 'Designer (OCR)',
  designer_registered: 'Designer ✓',
  demoted_designer: '⤓ Designer (demoted)',
  finish: 'Finitura',
  demoted_finish: '⤓ Finitura (demoted)',
  material: 'Materiale',
  product: 'Prodotto',
};

const IMPACT_ORDER = [
  'collection', 'designer_registered', 'designer',
  'material', 'product',
  'demoted_collection', 'demoted_designer',
  'finish', 'demoted_finish',
];

export default function ReviewWorkspace({ setId, status, onAfterPublish }) {
  const [summary, setSummary] = useState(null);
  const [entities, setEntities] = useState([]);
  const [audit, setAudit] = useState(null);
  const [gate, setGate] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(() => new Set());
  const [drawerId, setDrawerId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, e, a, g] = await Promise.all([
        KE.reviewSummary(setId),
        KE.listNeedsReview(setId),
        KE.knowledgeAudit(setId),
        KE.publishGate(setId),
      ]);
      setSummary(s.data);
      setEntities(e.data?.entities || []);
      setAudit(a.data);
      setGate(g.data);
    } catch (err) {
      toast.error('Caricamento workspace fallito');
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const onResolve = async () => {
    setResolving(true);
    try {
      await KE.resolveEntities(setId);
      toast.success('Resolution completata');
      await refreshAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Resolution fallita');
    } finally { setResolving(false); }
  };

  const onPublish = async () => {
    if (!gate?.ready_to_publish) {
      toast.error('Publish Gate non superato');
      return;
    }
    setPublishing(true);
    try {
      await KE.publishSet(setId);
      toast.success('Brand Atlas pubblicato nel Knowledge Graph');
      onAfterPublish?.();
      await refreshAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Pubblicazione bloccata');
    } finally { setPublishing(false); }
  };

  const filtered = useMemo(() => {
    let rows = entities;
    if (filter !== 'all') {
      rows = rows.filter((e) => e.entity_type.includes(filter));
    }
    // Sort by impact priority then mention_count
    return rows.sort((a, b) => {
      const ai = IMPACT_ORDER.indexOf(a.entity_type);
      const bi = IMPACT_ORDER.indexOf(b.entity_type);
      if (ai !== bi) return ai - bi;
      return (b.mention_count || 0) - (a.mention_count || 0);
    });
  }, [entities, filter]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());
  const selectAllVisible = () => {
    setSelected(new Set(filtered.slice(0, 100).map((e) => e.id)));
  };

  const onBulk = async (action) => {
    if (selected.size === 0) {
      toast.error('Nessuna entità selezionata');
      return;
    }
    try {
      const ids = Array.from(selected);
      const { data } = await KE.bulkAction(setId, { entity_ids: ids, action });
      toast.success(`${action}: ${data.applied}/${data.total}`);
      clearSelection();
      await refreshAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Bulk action fallita');
    }
  };

  return (
    <div data-testid="iter201-review-workspace" style={{ position: 'relative' }}>
      {/* ── Section 1 · Review Queue Header ───────────────────────── */}
      <QueueHeader summary={summary} audit={audit}
                    onResolve={onResolve} resolving={resolving}
                    onRefresh={refreshAll} loading={loading} />

      {/* ── Section 9 · Publish Gate ───────────────────────────────── */}
      <PublishGatePanel gate={gate}
                         onPublish={onPublish}
                         publishing={publishing}
                         currentStatus={status} />

      {/* ── Filter pills ───────────────────────────────────────────── */}
      <FilterPills filter={filter} setFilter={setFilter} summary={summary} />

      {/* ── Section 5 · Bulk Action Bar ────────────────────────────── */}
      {selected.size > 0 && (
        <BulkBar count={selected.size}
                  onAction={onBulk}
                  onClear={clearSelection}
                  onSelectAllVisible={selectAllVisible} />
      )}

      {/* ── Section 2 · Entity Cards ───────────────────────────────── */}
      <EntityList entities={filtered.slice(0, 200)}
                   selected={selected}
                   onToggle={toggleSelect}
                   onOpen={setDrawerId}
                   totalCount={filtered.length} />

      {/* ── Section 3+4 · Review Drawer ────────────────────────────── */}
      <ReviewDrawer
        setId={setId}
        entityId={drawerId}
        onClose={() => setDrawerId(null)}
        onAfterAction={refreshAll}
        candidateTargets={entities}
      />
    </div>
  );
}

// ─── Queue Header ─────────────────────────────────────────────────────
function QueueHeader({ summary, audit, onResolve, resolving, onRefresh, loading }) {
  const tot = summary?.totals || {};
  const verdictColor = (v) => {
    if (!v) return '#64748b';
    if (v.startsWith('A')) return '#059669';
    if (v.startsWith('B')) return '#d97706';
    return '#dc2626';
  };
  return (
    <div data-testid="iter201-queue-header"
          style={{ padding: 16, marginBottom: 12,
                    background: 'rgba(15,23,42,.04)',
                    border: '1px solid rgba(15,23,42,.08)',
                    borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                     alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="ke-eyebrow">REVIEW QUEUE</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 6 }}>
            {tot.total || 0} entità totali ·{' '}
            <span style={{ color: '#059669' }}>{(tot.validated || 0) + (tot.auto_validated || 0)} validate</span>{' '}·{' '}
            <span style={{ color: '#d97706' }}>{tot.needs_review || 0} in review</span>{' '}·{' '}
            <span style={{ color: '#6b7280' }}>{tot.rejected || 0} rifiutate</span>
          </div>
          {audit && (
            <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ background: '#fff', padding: '4px 10px', borderRadius: 999,
                              border: '1px solid rgba(15,23,42,.1)', fontSize: 12,
                              color: verdictColor(audit.verdict), fontWeight: 600 }}
                     data-testid="iter201-verdict">
                {audit.verdict}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(15,23,42,.7)' }}
                     data-testid="iter201-knowledge-score">
                Knowledge {audit.knowledge_score} · Brand Atlas {audit.brand_atlas_readiness} · Graph {audit.graph_completeness}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ke-btn" onClick={onRefresh} disabled={loading}
                   data-testid="iter201-refresh">
            <Icons.RefreshCw size={14} />
            <span>Aggiorna</span>
          </button>
          <button className="ke-btn ke-btn-primary" onClick={onResolve}
                   disabled={resolving} data-testid="iter201-resolve">
            <Icons.Sparkles size={14} />
            <span>{resolving ? 'In corso…' : 'Esegui Resolution'}</span>
          </button>
        </div>
      </div>

      {/* Breakdown per type */}
      {summary?.breakdown && (
        <div style={{ marginTop: 16, display: 'grid',
                       gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))',
                       gap: 8 }}>
          {(summary.sort_order || []).filter((t) => summary.breakdown[t])
            .map((t) => {
            const d = summary.breakdown[t];
            return (
              <div key={t} data-testid={`iter201-breakdown-${t}`}
                    style={{ padding: 10, background: '#fff', borderRadius: 6,
                              border: '1px solid rgba(15,23,42,.08)' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase',
                               color: 'rgba(15,23,42,.55)', letterSpacing: '.04em' }}>
                  {TYPE_LABEL[t] || t}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
                  {d.total}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(15,23,42,.6)', marginTop: 2 }}>
                  {d.validated > 0 && <span style={{ color: '#059669' }}>{d.validated} ✓</span>}
                  {d.needs_review > 0 && <span style={{ color: '#d97706', marginLeft: 8 }}>{d.needs_review} ⚠</span>}
                  {d.pct_validated >= 0 && <span style={{ marginLeft: 8 }}>{d.pct_validated}%</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Publish Gate ────────────────────────────────────────────────────
function PublishGatePanel({ gate, onPublish, publishing, currentStatus }) {
  if (!gate) return null;
  const overall = gate.overall_readiness_pct || 0;
  const tone = gate.ready_to_publish ? '#059669' : '#d97706';
  return (
    <div data-testid="iter201-publish-gate"
          style={{ padding: 16, marginBottom: 12, background: '#fff',
                    border: '1px solid rgba(15,23,42,.08)', borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                     alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="ke-eyebrow">BRAND ATLAS CERTIFICATION GATE</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: tone, marginTop: 4 }}
                data-testid="iter201-gate-overall">
            {overall}% ready
          </div>
        </div>
        <button
          className="ke-btn ke-btn-primary"
          onClick={onPublish}
          disabled={!gate.ready_to_publish || publishing || currentStatus === 'published'}
          data-testid="iter201-publish-btn"
          style={{
            background: gate.ready_to_publish ? '#059669' : '#94a3b8',
            opacity: gate.ready_to_publish ? 1 : 0.6,
          }}
        >
          <Icons.CheckCircle2 size={14} />
          <span>
            {currentStatus === 'published' ? 'Pubblicato'
              : publishing ? 'Pubblicazione…'
              : 'Publish to Knowledge Graph'}
          </span>
        </button>
      </div>

      {/* Per-criterion progress */}
      <div style={{ marginTop: 16, display: 'grid',
                     gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))',
                     gap: 10 }}>
        {(gate.criteria || []).map((c) => (
          <div key={c.key} data-testid={`iter201-criterion-${c.key}`}
                style={{ padding: 10, border: `1px solid ${c.ok ? '#86efac' : '#fcd34d'}`,
                          borderRadius: 6, background: c.ok ? '#f0fdf4' : '#fffbeb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{c.label}</span>
              {c.ok ? <Icons.CheckCircle2 size={14} color="#059669" />
                    : <Icons.AlertCircle size={14} color="#d97706" />}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4,
                           color: c.ok ? '#059669' : '#b45309' }}>
              {c.value_pct}% <span style={{ fontSize: 10, color: '#6b7280' }}>/ {c.threshold}%</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(15,23,42,.6)' }}>{c.count}</div>
            <div style={{ marginTop: 6, height: 4, background: 'rgba(15,23,42,.06)',
                           borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, c.value_pct)}%`, height: '100%',
                             background: c.ok ? '#059669' : '#d97706',
                             transition: 'width .3s' }} />
            </div>
          </div>
        ))}
      </div>
      {!!(gate.non_critical?.finishes?.needs_review || gate.non_critical?.finishes?.total) && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(15,23,42,.55)' }}>
          Non-critical review: {gate.non_critical.finishes?.total || 0} finiture · {gate.non_critical.materials?.total || 0} materiali · {gate.non_critical.products?.total || 0} prodotti — non bloccano il publish.
        </div>
      )}
    </div>
  );
}

function FilterPills({ filter, setFilter, summary }) {
  const totalReview = summary?.totals?.needs_review || 0;
  const opts = [
    ['all', `Tutte (${totalReview})`],
    ['collection', 'Collezioni'],
    ['designer', 'Designer'],
    ['material', 'Materiali'],
    ['product', 'Prodotti'],
    ['finish', 'Finiture'],
  ];
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
      {opts.map(([k, label]) => (
        <button key={k} type="button"
                 className={`ke-btn ${filter === k ? 'ke-btn-primary' : ''}`}
                 onClick={() => setFilter(k)}
                 data-testid={`iter201-filter-${k}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function BulkBar({ count, onAction, onClear, onSelectAllVisible }) {
  return (
    <div data-testid="iter201-bulk-bar"
          style={{ position: 'sticky', top: 0, zIndex: 10,
                    background: '#1e293b', color: '#fff', padding: '10px 14px',
                    borderRadius: 8, marginBottom: 12,
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 600 }}>{count} selezionate</span>
      <button className="ke-btn" onClick={onSelectAllVisible}
               data-testid="iter201-select-all">Seleziona visibili</button>
      <span style={{ flex: 1 }} />
      <button className="ke-btn" onClick={() => onAction('approve')}
               data-testid="iter201-bulk-approve">Approve</button>
      <button className="ke-btn" onClick={() => onAction('promote')}
               data-testid="iter201-bulk-promote">Promote</button>
      <button className="ke-btn" onClick={() => onAction('reject')}
               data-testid="iter201-bulk-reject">Reject</button>
      <button className="ke-btn" onClick={onClear}
               data-testid="iter201-bulk-clear">
        <Icons.X size={14} />
      </button>
    </div>
  );
}

function EntityList({ entities, selected, onToggle, onOpen, totalCount }) {
  if (entities.length === 0) {
    return (
      <div className="ke-empty" data-testid="iter201-list-empty">
        Nessuna entità in review per questo filtro.
      </div>
    );
  }
  return (
    <div data-testid="iter201-entity-list"
          style={{ display: 'flex', flexDirection: 'column', gap: 6,
                    maxHeight: 700, overflowY: 'auto' }}>
      {entities.map((e) => (
        <EntityCard key={e.id} entity={e}
                     selected={selected.has(e.id)}
                     onToggle={() => onToggle(e.id)}
                     onOpen={() => onOpen(e.id)} />
      ))}
      {totalCount > entities.length && (
        <div className="ke-empty-sm" style={{ padding: 8 }}>
          +{totalCount - entities.length} altre entità non mostrate (raffina filtro per vederle tutte)
        </div>
      )}
    </div>
  );
}

function EntityCard({ entity, selected, onToggle, onOpen }) {
  const isDemoted = entity.entity_type.startsWith('demoted_');
  const aliases = (entity.aliases || []).slice(0, 3);
  const conf = entity.confidence_score ?? 0;
  return (
    <div data-testid={`iter201-card-${entity.id}`}
          style={{ display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', background: '#fff',
                    border: selected ? '2px solid #2563eb'
                                       : '1px solid rgba(15,23,42,.08)',
                    borderRadius: 6 }}>
      <input type="checkbox" checked={selected}
              onChange={(e) => { e.stopPropagation(); onToggle(); }}
              data-testid={`iter201-checkbox-${entity.id}`}
              style={{ cursor: 'pointer' }} />
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={onOpen}
            data-testid={`iter201-card-open-${entity.id}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`ke-mini-pill ${isDemoted ? 'tone-neutral' : 'tone-warning'}`}>
            {TYPE_LABEL[entity.entity_type] || entity.entity_type}
          </span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {entity.display_name}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(15,23,42,.55)', marginTop: 4 }}>
          conf. {(conf * 100).toFixed(0)}% · {entity.mention_count || 0} mention
          · {(entity.source_document_ids || []).length} doc
          · {aliases.length} alias
          {aliases.length > 0 && (
            <span style={{ marginLeft: 6, fontStyle: 'italic' }}>
              {aliases.join(' · ')}
            </span>
          )}
        </div>
      </div>
      <button className="ke-btn" onClick={onOpen}
               data-testid={`iter201-open-drawer-${entity.id}`}>
        Review
        <Icons.ChevronRight size={14} />
      </button>
    </div>
  );
}

// ─── Review Drawer (Shadcn Sheet) ─────────────────────────────────────
function ReviewDrawer({ setId, entityId, onClose, onAfterAction, candidateTargets }) {
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mergeTarget, setMergeTarget] = useState('');

  useEffect(() => {
    if (!entityId) { setDetail(null); return; }
    (async () => {
      try {
        const { data } = await KE.entityDetail(setId, entityId);
        setDetail(data);
        setMergeTarget('');
      } catch (_) {
        toast.error('Caricamento dettaglio fallito');
      }
    })();
  }, [setId, entityId]);

  const e = detail?.entity;
  const isOpen = !!entityId;

  const doAction = async (fn, label) => {
    setBusy(true);
    try {
      await fn();
      toast.success(`${label} completato`);
      onAfterAction?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || `${label} fallito`);
    } finally { setBusy(false); }
  };

  const doMerge = async () => {
    if (!mergeTarget) { toast.error('Seleziona un target'); return; }
    setBusy(true);
    try {
      await KE.mergeAliases(setId, {
        source_entity_ids: [entityId],
        target_entity_id: mergeTarget,
      });
      toast.success('Merge alias completato');
      onAfterAction?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Merge fallito');
    } finally { setBusy(false); }
  };

  // Candidate targets for merge: same entity_type, not self, validated/detected
  const mergeCandidates = useMemo(() => {
    if (!e) return [];
    const base = e.entity_type.replace('demoted_', '');
    return (candidateTargets || []).filter((c) =>
      c.id !== e.id
      && (c.entity_type === base || c.entity_type === `${base}_registered`)
      && c.status !== 'merged_into'
    ).slice(0, 30);
  }, [e, candidateTargets]);

  return (
    <Sheet open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right"
                     className="w-full sm:max-w-[640px] overflow-y-auto"
                     data-testid="iter201-review-drawer">
        {!detail ? (
          <div style={{ padding: 20 }}>Caricamento…</div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle data-testid="iter201-drawer-title">
                {e?.display_name}
              </SheetTitle>
              <SheetDescription>
                <span className="ke-mini-pill tone-warning">
                  {TYPE_LABEL[e?.entity_type] || e?.entity_type}
                </span>
                {' '} · {e?.status || 'detected'}
              </SheetDescription>
            </SheetHeader>

            {/* Entity Info */}
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(15,23,42,.04)',
                           borderRadius: 6 }}>
              <div className="ke-eyebrow">ENTITY INFORMATION</div>
              <Field label="Nome" value={e?.display_name} />
              <Field label="Tipo" value={TYPE_LABEL[e?.entity_type] || e?.entity_type} />
              <Field label="Confidence"
                      value={e?.confidence_score
                              ? `${(e.confidence_score * 100).toFixed(1)}%`
                              : '—'} />
              <Field label="Mentions" value={e?.mention_count} />
              <Field label="Documenti" value={detail.documents?.length} />
              <Field label="Pagine rilevate" value={detail.pages?.length} />
            </div>

            {/* Aliases */}
            <div style={{ marginTop: 16 }}>
              <div className="ke-eyebrow">ALIASES ({(e?.aliases || []).length})</div>
              {(e?.aliases || []).length === 0 ? (
                <div style={{ fontSize: 12, color: 'rgba(15,23,42,.5)', marginTop: 4 }}>
                  Nessun alias.
                </div>
              ) : (
                <ul style={{ marginTop: 4, paddingLeft: 18 }}
                     data-testid="iter201-aliases-list">
                  {(e?.aliases || []).slice(0, 30).map((a, i) => (
                    <li key={i} style={{ fontSize: 13, marginTop: 2 }}>{a}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Suggested Canonical */}
            {detail.suggested_canonical && (
              <div style={{ marginTop: 16, padding: 12, background: '#eff6ff',
                             border: '1px solid #bfdbfe', borderRadius: 6 }}
                    data-testid="iter201-suggested-canonical">
                <div className="ke-eyebrow">SUGGESTED CANONICAL</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                  {detail.suggested_canonical.display_name || detail.suggested_canonical.name}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(15,23,42,.6)', marginTop: 2 }}>
                  {detail.suggested_canonical.kind}
                  {detail.suggested_canonical.confidence !== undefined &&
                    ` · ${(detail.suggested_canonical.confidence * 100).toFixed(0)}% confidence`}
                  {detail.suggested_canonical.verified_by &&
                    ` · ${detail.suggested_canonical.verified_by}`}
                </div>
              </div>
            )}

            {/* Graph Impact */}
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(15,23,42,.04)',
                           borderRadius: 6 }}>
              <div className="ke-eyebrow">GRAPH IMPACT</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)',
                             gap: 8, marginTop: 6 }}
                    data-testid="iter201-graph-impact">
                <Field label="Prodotti linkati" value={detail.graph_impact?.products_linked} />
                <Field label="Materiali" value={detail.graph_impact?.materials_linked} />
                <Field label="Collezioni" value={detail.graph_impact?.collections_linked} />
                <Field label="Finiture" value={detail.graph_impact?.finishes_linked} />
              </div>
            </div>

            {/* Designer-specific: registry hint */}
            {(e?.entity_type === 'designer' || e?.entity_type === 'demoted_designer') && (
              <div style={{ marginTop: 16, padding: 12, background: '#fef3c7',
                             border: '1px solid #fde68a', borderRadius: 6 }}>
                <div className="ke-eyebrow">DESIGNER VALIDATION</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Approve → Promosso a Designer Verificato (designer_registered).
                  Reject → Demoted come "no_registry_match".
                </div>
              </div>
            )}

            {/* Collection-specific: merge guidance */}
            {(e?.entity_type === 'collection' || e?.entity_type === 'demoted_collection') && (
              <div style={{ marginTop: 16, padding: 12, background: '#dcfce7',
                             border: '1px solid #86efac', borderRadius: 6 }}>
                <div className="ke-eyebrow">COLLECTION REVIEW</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Promote → Materializza un Canonical Collection in <code>collections_canonical</code>.
                  Merge → Fonde questa entità come alias di un'altra collezione.
                </div>
              </div>
            )}

            {/* Merge selector */}
            {mergeCandidates.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="ke-eyebrow">MERGE ALIAS INTO…</div>
                <select value={mergeTarget}
                         onChange={(ev) => setMergeTarget(ev.target.value)}
                         data-testid="iter201-merge-target"
                         style={{ width: '100%', marginTop: 6, padding: '8px 10px',
                                   border: '1px solid rgba(15,23,42,.15)',
                                   borderRadius: 6, fontSize: 13 }}>
                  <option value="">— seleziona un target —</option>
                  {mergeCandidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name} ({c.mention_count || 0} mentions)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Actions */}
            <div style={{ marginTop: 20, display: 'grid',
                           gridTemplateColumns: '1fr 1fr', gap: 8 }}
                  data-testid="iter201-drawer-actions">
              <button className="ke-btn ke-btn-primary" disabled={busy}
                       onClick={() => doAction(() => KE.approveEntity(setId, entityId), 'Approve')}
                       data-testid="iter201-drawer-approve">
                <Icons.Check size={14} />
                <span>Approve</span>
              </button>
              <button className="ke-btn" disabled={busy || !mergeTarget}
                       onClick={doMerge}
                       data-testid="iter201-drawer-merge">
                <Icons.GitMerge size={14} />
                <span>Merge Alias</span>
              </button>
              <button className="ke-btn" disabled={busy}
                       onClick={() => doAction(() => KE.promoteEntityToCanonical(setId, entityId), 'Promote')}
                       data-testid="iter201-drawer-promote">
                <Icons.Star size={14} />
                <span>Promote to Canonical</span>
              </button>
              <button className="ke-btn" disabled={busy}
                       onClick={() => doAction(() => KE.rejectEntity(setId, entityId), 'Reject')}
                       data-testid="iter201-drawer-reject"
                       style={{ color: '#dc2626' }}>
                <Icons.X size={14} />
                <span>Reject</span>
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between',
                   fontSize: 12, marginTop: 4 }}>
      <span style={{ color: 'rgba(15,23,42,.6)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value ?? '—'}</span>
    </div>
  );
}
