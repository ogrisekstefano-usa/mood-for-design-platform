/**
 * HotspotImageOverlay™
 * ────────────────────────────────────────────────────────────────────
 * Modal that hosts the reusable HotspotEditor with adapter callbacks.
 *
 * Two persistence modes:
 *  • "in-memory" (default) — hotspots are passed in via prop and changes
 *    bubble up via onChange(nextHotspotsArray). Caller persists.
 *    Used by Projects gallery (hotspots embedded in JSON).
 *  • "remote"   — calls /api/magazine/admin/articles/{aid}/hotspots
 *    Used by Magazine article image/hotspot blocks where block_id is
 *    the magazine body_block id.
 *
 * Hotspot shape:
 *   { id, x_pct, y_pct, kind, title, description,
 *     linked_material_id?, linked_project_id?, linked_article_id?, cta_action? }
 */
import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import HotspotEditor from '../common/HotspotEditor';
import api from '../../lib/api';
import './storytelling.css';
import { useT } from '../../i18n/useT';

const genId = () => `hs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const HotspotImageOverlay = ({
  open,
  onClose,
  imageUrl,
  imageCaption,
  hotspots = [],
  onChange,                 // (nextHotspots) => void  — in-memory mode
  mode = 'memory',          // 'memory' | 'remote'
  remoteArticleId,
  remoteBlockId,
}) => {
  const [busy, setBusy] = useState(false);
  const isRemote = mode === 'remote' && remoteArticleId && remoteBlockId;

  // ── In-memory adapter (Projects gallery, Moodboard) ────────────
  const memCreate = useCallback(async ({ x_pct, y_pct, kind, title, description }) => {
    const next = [
      ...hotspots,
      { id: genId(), x_pct, y_pct, kind, title, description: description || '' },
    ];
    onChange?.(next);
  }, [hotspots, onChange]);

  const memUpdate = useCallback(async (id, patch) => {
    const next = hotspots.map((h) => (h.id === id ? { ...h, ...patch } : h));
    onChange?.(next);
  }, [hotspots, onChange]);

  const memDelete = useCallback(async (id) => {
    const next = hotspots.filter((h) => h.id !== id);
    onChange?.(next);
  }, [hotspots, onChange]);

  // ── Remote adapter (Magazine article) ──────────────────────────
  const remoteCreate = useCallback(async ({ x_pct, y_pct, kind, title, description }) => {
    setBusy(true);
    try {
      const r = await api.post(
        `/api/magazine/admin/articles/${remoteArticleId}/hotspots`,
        {
          block_id: remoteBlockId,
          x_pct, y_pct,
          reference_type: kind || 'atmosphere',
          locale_content: { it: { title: title || '', description: description || '' } },
        },
      );
      const created = {
        ...r.data,
        kind: r.data.reference_type,
        title: (r.data.locale_content?.it?.title) || '',
        description: (r.data.locale_content?.it?.description) || '',
      };
      onChange?.([...hotspots, created]);
    } finally { setBusy(false); }
  }, [hotspots, onChange, remoteArticleId, remoteBlockId]);

  const remoteUpdate = useCallback(async (id, patch) => {
    setBusy(true);
    try {
      const body = {};
      if ('x_pct' in patch) body.x_pct = patch.x_pct;
      if ('y_pct' in patch) body.y_pct = patch.y_pct;
      if ('kind' in patch) body.reference_type = patch.kind;
      if ('title' in patch || 'description' in patch) {
        const cur = hotspots.find((h) => h.id === id) || {};
        body.locale_content = {
          it: {
            title: patch.title ?? cur.title ?? '',
            description: patch.description ?? cur.description ?? '',
          },
        };
      }
      await api.patch(`/api/magazine/admin/hotspots/${id}`, body);
      const next = hotspots.map((h) => (h.id === id ? { ...h, ...patch } : h));
      onChange?.(next);
    } finally { setBusy(false); }
  }, [hotspots, onChange]);

  const remoteDelete = useCallback(async (id) => {
    setBusy(true);
    try {
      await api.delete(`/api/magazine/admin/hotspots/${id}`);
      onChange?.(hotspots.filter((h) => h.id !== id));
    } finally { setBusy(false); }
  }, [hotspots, onChange]);

  if (!open) return null;

  return (
    <div
      className="hsov-bg"
      data-testid="hotspot-overlay-bg"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="hsov-modal" data-testid="hotspot-overlay" data-busy={busy}>
        <header className="hsov-modal__head">
          <div>
            <p className="hsov-eyebrow">Editorial Notes · Detail Points</p>
            <h3 className="hsov-title">{t('storytelling.hotspot_image_overlay.aggiungi_note_di_dettaglio_sull_immagine')}</h3>
            {imageCaption && <p className="hsov-cap">{imageCaption}</p>}
          </div>
          <button
            type="button"
            className="hsov-close"
            data-testid="hotspot-overlay-close"
            onClick={onClose}
          ><X size={16} /></button>
        </header>
        <div className="hsov-modal__body">
          <HotspotEditor
            imageUrl={imageUrl}
            hotspots={hotspots}
            onCreate={isRemote ? remoteCreate : memCreate}
            onUpdate={isRemote ? remoteUpdate : memUpdate}
            onDelete={isRemote ? remoteDelete : memDelete}
          />
        </div>
        <footer className="hsov-modal__foot">
          <span className="hsov-philo">
            I Detail Points sono note editoriali discrete — non pin ecommerce.
          </span>
          <button
            type="button"
            className="hsov-btn"
            data-testid="hotspot-overlay-done"
            onClick={onClose}
          >{t('storytelling.hotspot_image_overlay.chiudi')}</button>
        </footer>
      </div>
    </div>
  );
};

export default HotspotImageOverlay;
