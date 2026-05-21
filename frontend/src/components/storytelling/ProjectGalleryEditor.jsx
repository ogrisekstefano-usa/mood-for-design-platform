/**
 * ProjectGalleryEditor™
 * ────────────────────────────────────────────────────────────────────
 * Multi-image gallery editor for a Project's `gallery` array.
 *
 * Each item shape (serialized into portfolio_projects.gallery[]):
 *   {
 *     id:       string  — stable id (used by gallery_overrides + hotspot block_id)
 *     url:      string
 *     asset_id: string | null
 *     caption:  string
 *     alt_text: string
 *     hotspots: array of { id, x_pct, y_pct, kind, title, description, ... }
 *   }
 *
 * Cover is tracked separately via the parent's `cover_image_url` —
 * the "Imposta come cover" button mirrors that item's url into cover_image_url.
 *
 * Reorder: HTML5 drag&drop (no external library).
 * Inline editor: caption + alt + Detail Points (hotspot overlay).
 */
import React, { useState, useCallback } from 'react';
import {
  GripVertical, Star, StarOff, MapPin, Trash2, Plus,
  Pencil, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import EditorialMediaField from '../common/EditorialMediaField';
import HotspotImageOverlay from './HotspotImageOverlay';
import './storytelling.css';
import { useT } from '../../i18n/useT';

const newItemId = () => `gal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const ProjectGalleryEditor = ({
  gallery = [],
  coverUrl = '',
  onChange,                 // (nextGalleryArray) => void
  onSetCover,               // (newCoverUrl) => void
  entityType = 'portfolio_project',
  entityId,
  readOnly = false,
  testId = 'project-gallery',
}) => {
  // Defensive: legacy gallery items may not have an id. Backfill so React
  // keys are stable AND persist the migration upstream (otherwise React
  // keys would flicker and input focus would be lost on every keystroke).
  const safeGallery = React.useMemo(
    () => gallery.map((g, i) => g.id ? g : { ...g, id: `legacy_gal_${i}_${Math.random().toString(36).slice(2, 8)}` }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gallery.length, gallery.map((g) => g.id || '').join('|')]
  );
  React.useEffect(() => {
    if (gallery.some((g) => !g.id)) onChange?.(safeGallery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeGallery]);
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState({ url: '', asset_id: null, alt_text: '', caption: '' });
  const [dragIdx, setDragIdx] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [hotspotItem, setHotspotItem] = useState(null);

  const updateItem = useCallback((id, patch) => {
    const next = safeGallery.map((g) => (g.id === id ? { ...g, ...patch } : g));
    onChange?.(next);
  }, [safeGallery, onChange]);

  const removeItem = (id) => {
    if (!confirm('Eliminare questa immagine dalla gallery?')) return;
    onChange?.(safeGallery.filter((g) => g.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const moveItem = (from, to) => {
    if (from === to) return;
    const next = [...safeGallery];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange?.(next);
  };

  const setAsCover = (item) => {
    onSetCover?.(item.url);
    toast.success('Cover impostata');
  };

  // ── Add new image flow ──────────────────────────────────────────
  const commitAdd = () => {
    if (!addDraft.url) { toast.error('Carica o seleziona un\'immagine prima'); return; }
    const item = {
      id: newItemId(),
      url: addDraft.url,
      asset_id: addDraft.asset_id || null,
      alt_text: addDraft.alt_text || '',
      caption: addDraft.caption || '',
      hotspots: [],
    };
    onChange?.([...safeGallery, item]);
    setAddDraft({ url: '', asset_id: null, alt_text: '', caption: '' });
    setAdding(false);
    // Auto-promote first image as cover if none set
    if (!coverUrl) onSetCover?.(item.url);
    toast.success('Immagine aggiunta alla gallery');
  };

  return (
    <section className="pg-wrap" data-testid={testId}>
      <header className="pg-head">
        <div>
          <p className="pg-eyebrow">Visual Storytelling</p>
          <h3 className="pg-title">{t('storytelling.project_gallery.gallery_del_progetto')}</h3>
          <p className="pg-sub">
            Una case history editoriale, non una scheda portfolio. Trascina per
            riordinare · clicca <em>★</em> per impostare la cover · clicca
            <em> ◉</em> per aggiungere note di dettaglio.
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            className="pg-add"
            data-testid="pg-add-btn"
            onClick={() => setAdding((v) => !v)}
          >
            <Plus size={13} /> Aggiungi immagine
          </button>
        )}
      </header>

      {/* Inline "Add new" panel */}
      {adding && (
        <div className="pg-addpanel" data-testid="pg-add-panel">
          <EditorialMediaField
            value={addDraft}
            valueShape="object"
            onChange={(v) => setAddDraft(v)}
            preset="gallery"
            label="Nuova immagine"
            helperText="Carica · scegli dalla Media Library · o incolla un URL."
            entityType={entityType}
            entityId={entityId}
            role="gallery_item"
            testId="pg-add-media"
          />
          <div className="pg-addpanel__actions">
            <button
              type="button"
              className="pg-btn pg-btn--ghost"
              onClick={() => { setAdding(false); setAddDraft({ url: '', asset_id: null, alt_text: '', caption: '' }); }}
            >{t('storytelling.project_gallery.annulla')}</button>
            <button
              type="button"
              className="pg-btn pg-btn--primary"
              data-testid="pg-add-commit"
              onClick={commitAdd}
              disabled={!addDraft.url}
            >{t('storytelling.project_gallery.conferma_immagine')}</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {safeGallery.length === 0 && !adding && (
        <div className="pg-empty" data-testid="pg-empty">
          <span className="pg-empty__eyebrow">Sequenza visiva</span>
          <p>{t('storytelling.project_gallery.nessuna_immagine_ancora_aggiungi_la_prima_per_iniz')}</p>
          {!readOnly && (
            <button
              type="button"
              className="pg-btn pg-btn--primary"
              data-testid="pg-empty-add"
              onClick={() => setAdding(true)}
            >{t('storytelling.project_gallery.aggiungi_la_prima_immagine')}</button>
          )}
        </div>
      )}

      {/* Grid */}
      {safeGallery.length > 0 && (
        <div className="pg-grid" data-testid="pg-grid">
          {safeGallery.map((item, idx) => {
            const isCover = item.url && item.url === coverUrl;
            const hsCount = (item.hotspots || []).length;
            const isEditing = editingId === item.id;
            return (
              <article
                key={item.id}
                className={`pg-card ${isEditing ? 'is-editing' : ''} ${isCover ? 'is-cover' : ''}`}
                data-testid={`pg-card-${idx}`}
                draggable={!readOnly}
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx !== null && dragIdx !== idx) moveItem(dragIdx, idx);
                  setDragIdx(null);
                }}
              >
                <div className="pg-card__media">
                  <img src={item.url} alt={item.alt_text || ''} />
                  {!readOnly && (
                    <span className="pg-grip" title="Trascina per riordinare">
                      <GripVertical size={13} />
                    </span>
                  )}
                  {isCover && (
                    <span className="pg-cover-badge" data-testid={`pg-cover-badge-${idx}`}>
                      <Star size={10} strokeWidth={2} /> Cover
                    </span>
                  )}
                  {hsCount > 0 && (
                    <span className="pg-hs-badge" title={`${hsCount} detail points`}>
                      <MapPin size={10} /> {hsCount}
                    </span>
                  )}
                </div>
                <div className="pg-card__meta">
                  {isEditing ? (
                    <>
                      <input
                        className="pg-input"
                        value={item.caption || ''}
                        onChange={(e) => updateItem(item.id, { caption: e.target.value })}
                        placeholder="Caption editoriale (visibile)"
                        data-testid={`pg-caption-${idx}`}
                      />
                      <input
                        className="pg-input pg-input--small"
                        value={item.alt_text || ''}
                        onChange={(e) => updateItem(item.id, { alt_text: e.target.value })}
                        placeholder="Alt text (accessibility / SEO)"
                        data-testid={`pg-alt-${idx}`}
                      />
                    </>
                  ) : (
                    <>
                      <p className="pg-card__caption">
                        {item.caption || <em className="pg-card__caption--placeholder">Senza didascalia</em>}
                      </p>
                      {item.alt_text && <p className="pg-card__alt">alt · {item.alt_text}</p>}
                    </>
                  )}
                </div>
                {!readOnly && (
                  <div className="pg-card__actions">
                    <button
                      type="button"
                      className="pg-act"
                      title={isCover ? 'Già cover' : 'Imposta come cover'}
                      data-testid={`pg-cover-${idx}`}
                      onClick={() => setAsCover(item)}
                      disabled={isCover}
                    >
                      {isCover ? <Star size={12} strokeWidth={2} /> : <StarOff size={12} strokeWidth={1.5} />}
                    </button>
                    <button
                      type="button"
                      className="pg-act"
                      title="Detail Points"
                      data-testid={`pg-hotspots-${idx}`}
                      onClick={() => setHotspotItem(item)}
                    >
                      <MapPin size={12} />
                    </button>
                    <button
                      type="button"
                      className="pg-act"
                      title={isEditing ? 'Chiudi editing' : 'Modifica didascalia'}
                      data-testid={`pg-edit-${idx}`}
                      onClick={() => setEditingId(isEditing ? null : item.id)}
                    >
                      {isEditing ? <EyeOff size={12} /> : <Pencil size={12} />}
                    </button>
                    <button
                      type="button"
                      className="pg-act pg-act--danger"
                      title="Elimina"
                      data-testid={`pg-del-${idx}`}
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Hotspot overlay */}
      {hotspotItem && (
        <HotspotImageOverlay
          open
          imageUrl={hotspotItem.url}
          imageCaption={hotspotItem.caption}
          hotspots={hotspotItem.hotspots || []}
          mode="memory"
          onChange={(nextHs) => updateItem(hotspotItem.id, { hotspots: nextHs })}
          onClose={() => setHotspotItem(null)}
        />
      )}
    </section>
  );
};

export default ProjectGalleryEditor;
