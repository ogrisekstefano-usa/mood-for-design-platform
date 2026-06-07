/**
 * EntityContextPanel · cuore dell'ecosistema MOOD (KE-005B.2)
 *
 * Componente premium che mostra TUTTO il contesto di una singola entità
 * canonica, alimentato dall'endpoint /api/knowledge/entities/{id}/context-panel.
 *
 * Sezioni nell'ordine approvato (KE-005B.1 direttiva n.7):
 *   1. Hero (display_name + entity_type + brand badge)
 *   2. Brand / Designer / Collection
 *   3. Operational Readiness   ← KE-004
 *   4. Future Uses™            ← KE-004 (visivamente evidente)
 *   5. Connected Assets™       ← KE-004 (visivamente evidente)
 *   6. Certification status
 *   7. Materials correlati
 *   8. Provenance
 *   9. Actions (Apri in Brand Atlas · Sostituisci · Rimuovi)
 *
 * Props:
 *   - entityId: string (uuid)
 *   - open: boolean
 *   - onClose: () => void
 *   - surfaceContext: { type, id, blockId? }
 *   - onSwap: (newEntity) => void  (opens picker)
 *   - onRemove: () => void
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  X, ExternalLink, RefreshCw, Trash2, Tag, User, Layers,
  Award, Layout, Compass, Package, FileText, Sparkles, Check,
  ChevronRight, Image as ImageIcon,
} from 'lucide-react';
import api from '../../lib/api';
import './entity-context-panel.css';

const TYPE_LABEL = {
  product:  'Prodotto', material: 'Materiale', finish: 'Finitura',
  designer: 'Designer', brand:    'Brand',     image:  'Immagine',
};

const SURFACE_LABEL = {
  moodboard:           'Moodboard',
  design_journey:      'Design Journey',
  material_board:      'Material Board',
  client_presentation: 'Presentazione Cliente',
  magazine:            'Magazine',
};

// ─── Sub: section header ──────────────────────────────────────────
const SectionHead = ({ icon: Icon, title }) => (
  <div className="ecp-sec-head">
    <Icon size={12} strokeWidth={1.7} />
    <span>{title}</span>
  </div>
);

const EntityContextPanel = ({
  entityId, open, onClose,
  surfaceContext, onSwap, onRemove,
}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!open || !entityId) return;
    let alive = true;
    const apply = (result) => {
      if (!alive) return;
      if (result.ok) { setData(result.data); setError(null); }
      else { setError(result.error); }
      setLoading(false);
    };
    api.get(`/api/knowledge/entities/${entityId}/context-panel`)
      .then((r) => apply({ ok: true, data: r.data }))
      .catch((e) => apply({ ok: false, error: e?.response?.data?.detail || 'Errore di caricamento' }));
    return () => { alive = false; };
  }, [open, entityId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sec = data?.sections || {};
  const hero = sec.hero || {};
  const bdc  = sec.brand_designer_collection || {};
  const ready = sec.operational_readiness || {};
  const future = sec.future_uses || {};
  const connected = sec.connected_assets || {};
  const cert = sec.certification || {};
  const materials = sec.materials || [];
  const provenance = sec.provenance || {};
  const actions = sec.actions || {};
  const typeLabel = TYPE_LABEL[hero.entity_type] || hero.entity_type || '';

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <>
      <div className="ecp-backdrop" onClick={onClose} data-testid="ecp-backdrop" />
      <aside className="ecp" role="dialog" aria-modal="true"
             data-testid="entity-context-panel">

        {/* Header sticky */}
        <header className="ecp__header">
          <div className="ecp__type-pill">{typeLabel}</div>
          <button type="button" className="ecp__close"
                  onClick={onClose} aria-label="Chiudi"
                  data-testid="ecp-close">
            <X size={16} strokeWidth={1.6} />
          </button>
        </header>

        {loading && <div className="ecp__loading">Caricamento conoscenza…</div>}
        {error   && <div className="ecp__error">{error}</div>}

        {data && (
          <div className="ecp__body">

            {/* 1 · HERO */}
            <section className="ecp__hero">
              <div className="ecp__hero-name" data-testid="ecp-hero-name">
                {hero.display_name || '—'}
              </div>
              {hero.mention_count > 0 && (
                <div className="ecp__hero-meta">
                  {hero.mention_count} menzioni nei tuoi documenti
                </div>
              )}
            </section>

            {/* 2 · Brand / Designer / Collection */}
            {(bdc.brand || bdc.designer || bdc.collection) && (
              <section className="ecp__sec ecp__bdc">
                <SectionHead icon={Tag} title="Identità" />
                <div className="ecp__bdc-grid">
                  {bdc.brand && (
                    <div className="ecp__bdc-item">
                      <span className="ecp__bdc-label">Brand</span>
                      <span className="ecp__bdc-value">{bdc.brand.name}</span>
                    </div>
                  )}
                  {bdc.designer && (
                    <div className="ecp__bdc-item">
                      <span className="ecp__bdc-label">Designer</span>
                      <span className="ecp__bdc-value">{bdc.designer.name}</span>
                    </div>
                  )}
                  {bdc.collection && (
                    <div className="ecp__bdc-item">
                      <span className="ecp__bdc-label">Collezione</span>
                      <span className="ecp__bdc-value">{bdc.collection.name}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 3 · Operational Readiness */}
            <section className="ecp__sec">
              <SectionHead icon={Award} title="Pronto per" />
              <div className="ecp__ready-grid">
                {Object.entries(ready).map(([surf, info]) => (
                  <div key={surf}
                       className={`ecp__ready ${info.ready ? 'on' : 'off'}`}>
                    <div className="ecp__ready-dot">
                      {info.ready ? <Check size={11} strokeWidth={2.4} /> : '·'}
                    </div>
                    <div className="ecp__ready-label">
                      {SURFACE_LABEL[surf] || surf}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 4 · Future Uses™ (visivamente evidente) */}
            <section className="ecp__sec ecp__future">
              <SectionHead icon={Layout} title="Future Uses™" />
              <div className="ecp__future-grid">
                {Object.entries(future).map(([surf, count]) => (
                  <div key={surf} className="ecp__future-tile"
                       data-testid={`ecp-future-${surf}`}>
                    <div className="ecp__future-num">{count}</div>
                    <div className="ecp__future-label">
                      {SURFACE_LABEL[surf] || surf}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 5 · Connected Assets™ (visivamente evidente) */}
            <section className="ecp__sec ecp__connected">
              <SectionHead icon={Sparkles} title="Connected Assets™" />
              <div className="ecp__connected-total">
                <span className="ecp__connected-big">{connected.total_relations || 0}</span>
                <span className="ecp__connected-cap">relazioni nel grafo</span>
              </div>
              {connected.by_relation && Object.keys(connected.by_relation).length > 0 && (
                <div className="ecp__connected-chips">
                  {Object.entries(connected.by_relation).slice(0, 8).map(([rel, count]) => (
                    <span key={rel} className="ecp__chip">
                      <span className="ecp__chip-count">{count}</span>
                      <span className="ecp__chip-label">{rel.replace(/_/g, ' ')}</span>
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* 6 · Certification */}
            <section className="ecp__sec">
              <SectionHead icon={Award} title="Certificazione" />
              <div className="ecp__cert">
                <div className={`ecp__cert-badge ecp__cert-badge--${cert.is_certified ? 'on' : 'off'}`}>
                  {cert.is_certified ? <Check size={12} strokeWidth={2.4} /> : '·'}
                  <span>{cert.is_certified ? 'Certificata' : 'In attesa'}</span>
                </div>
                {cert.confidence != null && (
                  <div className="ecp__cert-meta">
                    Confidence · {Math.round((cert.confidence || 0) * 100)}%
                  </div>
                )}
              </div>
            </section>

            {/* 7 · Materials */}
            {materials.length > 0 && (
              <section className="ecp__sec">
                <SectionHead icon={Layers} title="Materiali correlati" />
                <ul className="ecp__mat-list">
                  {materials.map((m) => (
                    <li key={m.id} className="ecp__mat-item">
                      <Layers size={11} strokeWidth={1.6} />
                      <span className="ecp__mat-name">{m.display_name}</span>
                      <span className="ecp__mat-rel">{m.relation?.replace(/_/g, ' ')}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 8 · Provenance */}
            <section className="ecp__sec">
              <SectionHead icon={FileText} title="Provenienza" />
              <div className="ecp__prov">
                <div className="ecp__prov-row">
                  <ImageIcon size={11} strokeWidth={1.6} />
                  <span>{provenance.source_page_ids?.length || 0} immagini · {provenance.source_document_ids?.length || 0} documenti</span>
                </div>
                {provenance.aliases?.length > 0 && (
                  <div className="ecp__prov-row">
                    <Tag size={11} strokeWidth={1.6} />
                    <span>Alias: {provenance.aliases.slice(0, 3).join(' · ')}</span>
                  </div>
                )}
              </div>
            </section>

            {/* 9 · Actions */}
            <footer className="ecp__actions">
              {actions.deep_link_review_workspace && (
                <Link to={actions.deep_link_review_workspace}
                      className="ecp__action ecp__action--primary"
                      data-testid="ecp-open-brand-atlas">
                  <ExternalLink size={13} strokeWidth={1.7} />
                  Apri nel Brand Atlas
                </Link>
              )}
              {onSwap && actions.can_swap && (
                <button type="button" className="ecp__action"
                        onClick={onSwap}
                        data-testid="ecp-swap">
                  <RefreshCw size={13} strokeWidth={1.7} />
                  Sostituisci
                </button>
              )}
              {onRemove && actions.can_remove && (
                <button type="button" className="ecp__action ecp__action--danger"
                        onClick={onRemove}
                        data-testid="ecp-remove">
                  <Trash2 size={13} strokeWidth={1.7} />
                  Rimuovi
                </button>
              )}
            </footer>
          </div>
        )}
      </aside>
    </>
  );
};

export default EntityContextPanel;
