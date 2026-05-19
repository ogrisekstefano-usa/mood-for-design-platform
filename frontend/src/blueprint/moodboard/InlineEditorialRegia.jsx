/**
 * InlineEditorialRegia — Inline Cropper™ (Phase D · Sprint D1).
 *
 * "Mini regia editoriale contestuale" che appare ancorata al blocco
 * immagine senza uscire dal flow del moodboard. Riusa la palette filtri
 * del Universal Editorial Cropper™ (single source-of-truth via
 * EDITORIAL_FILTERS export) e aggiorna in tempo reale `block.style`
 * + `block.metadata.display_meta` via updateBlock — l'autosave
 * persiste l'intera regia senza re-upload del raster.
 *
 * Linguaggio: "Regia immagine", "Atmosfera", "Punto focale",
 * "Adatta presentazione". MAI: "crop tool", "image editor", "filter".
 *
 * Non distruttivo: nessuna trasformazione raster — solo metadata
 * (focal_point, zoom, editorial_filter) propagati ovunque l'asset
 * venga riusato (Inspirations, Presentations, Magazine).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Icons from 'lucide-react';
import api from '../../lib/api';
import {
  EDITORIAL_FILTERS,
  SAFE_AREAS,
  filterCssFor,
} from '../../components/media/UniversalEditorialCropper';
import './inline-regia.css';

// Parse "45.0% 60.0%" into {x:0.45, y:0.60}; fallback center.
const parseFocal = (fp) => {
  if (!fp) return { x: 0.5, y: 0.5 };
  if (typeof fp === 'object' && fp.x !== undefined) return fp;
  const m = String(fp).match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
  if (!m) return { x: 0.5, y: 0.5 };
  return { x: Math.max(0, Math.min(1, parseFloat(m[1]) / 100)),
           y: Math.max(0, Math.min(1, parseFloat(m[2]) / 100)) };
};

const fmtFocal = (f) =>
  `${(f.x * 100).toFixed(1)}% ${(f.y * 100).toFixed(1)}%`;

const InlineEditorialRegia = ({
  block,
  anchorRect,
  onChange,
  onClose,
}) => {
  const src = block?.content?.src;
  const dm  = (block?.metadata?.display_meta) || {};
  const styleFp = block?.style?.focal_point;
  const styleZoom = block?.style?.zoom;

  const [focal, setFocal] = useState(() => parseFocal(styleFp || (dm.focal_x !== undefined ? { x: dm.focal_x, y: dm.focal_y } : null)));
  const [filterKey, setFilterKey] = useState(block?.metadata?.editorial_filter || dm.editorial_filter || '');
  const [zoom, setZoom] = useState(Number(styleZoom ?? dm.zoom ?? 1) || 1);
  const [safe, setSafe] = useState('hero');
  const [pos, setPos] = useState({ top: 0, left: 0, placement: 'right' });
  const stageRef = useRef(null);
  const draggingRef = useRef(false);

  // ── Anchor positioning ────────────────────────────────────────
  // Prefer to place the popover to the RIGHT of the block. Fall back
  // to LEFT, then BOTTOM, so the popover never escapes the viewport.
  useEffect(() => {
    if (!anchorRect) return;
    const W = 340, H = 480, gap = 14;
    const vw = window.innerWidth, vh = window.innerHeight;
    let top = anchorRect.top;
    let left = anchorRect.right + gap;
    let placement = 'right';
    if (left + W > vw - 12) {
      left = anchorRect.left - W - gap;
      placement = 'left';
    }
    if (left < 12) {
      left = Math.max(12, Math.min(vw - W - 12, anchorRect.left));
      top = anchorRect.bottom + gap;
      placement = 'bottom';
    }
    if (top + H > vh - 12) top = Math.max(12, vh - H - 12);
    if (top < 12) top = 12;
    setPos({ top, left, placement });
  }, [anchorRect]);

  // ── Live propagation ──────────────────────────────────────────
  // Every change → patch the block immediately. updateBlock in
  // MoodboardEditor deep-merges style/metadata, so a partial patch
  // never wipes siblings. Autosave handles persistence.
  const propagate = (nextFocal, nextFilter, nextZoom) => {
    const f = nextFocal ?? focal;
    const fk = nextFilter !== undefined ? nextFilter : filterKey;
    const z = nextZoom ?? zoom;
    onChange?.({
      style: {
        focal_point: fmtFocal(f),
        zoom: z,
        fit_mode: block?.style?.fit_mode || 'cover',
      },
      metadata: {
        editorial_filter: fk || null,
        display_meta: {
          ...(block?.metadata?.display_meta || {}),
          focal_x: f.x,
          focal_y: f.y,
          editorial_filter: fk || null,
          zoom: z,
        },
      },
    });
  };

  // Persist display_meta back to the Inspirations™ archive too, so
  // the regia follows the asset everywhere it's reused.
  const inspirationId = block?.metadata?.inspiration_id;
  const saveToArchive = async () => {
    if (!inspirationId) return;
    try {
      await api.patch(`/api/inspirations/archive/${inspirationId}/display-meta`, {
        focal_x: focal.x,
        focal_y: focal.y,
        editorial_filter: filterKey || null,
        zoom,
        crop_ratio: block?.metadata?.display_meta?.crop_ratio || null,
      });
    } catch (_) { /* silent — block-level regia already persisted */ }
  };

  // ── Focal stage drag ──────────────────────────────────────────
  const onStagePointer = (e) => {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top)  / rect.height));
    const next = { x, y };
    setFocal(next);
    propagate(next, undefined, undefined);
  };
  const onStageDown = (e) => { draggingRef.current = true; onStagePointer(e); e.preventDefault(); };
  const onStageMove = (e) => { if (draggingRef.current) onStagePointer(e); };
  const onStageUp   = () => { draggingRef.current = false; };

  // ── Filter / zoom handlers ───────────────────────────────────
  const pickFilter = (key) => {
    setFilterKey(key);
    propagate(undefined, key, undefined);
  };
  const onZoom = (v) => {
    const z = Number(v);
    setZoom(z);
    propagate(undefined, undefined, z);
  };

  // ── Outside click + Escape ───────────────────────────────────
  const rootRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown, true);
    };
  }, [onClose]);

  const cssFilter = useMemo(() => filterCssFor(filterKey), [filterKey]);
  const focalCss = fmtFocal(focal);

  if (!src) return null;

  return createPortal(
    <div
      ref={rootRef}
      className={`ir-popover ir-popover--${pos.placement}`}
      style={{ top: pos.top, left: pos.left }}
      data-testid="inline-regia"
    >
      <header className="ir-head">
        <div>
          <span className="ir-eyebrow">Regia immagine</span>
          <h4 className="ir-title">Atmosfera editoriale</h4>
        </div>
        <button type="button" className="ir-close" onClick={onClose}
                data-testid="inline-regia-close" aria-label="Chiudi">
          <Icons.X size={12} />
        </button>
      </header>

      {/* Focal point stage (compact) */}
      <section className="ir-section">
        <p className="ir-section-label">
          <Icons.Target size={10} /> Punto focale
        </p>
        <div
          ref={stageRef}
          className="ir-stage"
          data-testid="inline-regia-stage"
          onMouseDown={onStageDown}
          onMouseMove={onStageMove}
          onMouseUp={onStageUp}
          onMouseLeave={onStageUp}
        >
          <img src={src} alt="" draggable={false}
               style={{
                 transform: `scale(${zoom})`,
                 transformOrigin: focalCss,
                 filter: cssFilter === 'none' ? undefined : cssFilter,
               }} />
          <span className="ir-focal" style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }} />
        </div>
        <div className="ir-zoom" data-testid="inline-regia-zoom">
          <Icons.ZoomOut size={10} />
          <input type="range" min="1" max="3" step="0.05"
                 value={zoom}
                 onChange={(e) => onZoom(e.target.value)} />
          <Icons.ZoomIn size={10} />
          <span className="ir-zoom__val">{zoom.toFixed(2)}×</span>
        </div>
      </section>

      {/* Editorial filter strip — sottile, Lightroom-style */}
      <section className="ir-section">
        <p className="ir-section-label">
          <Icons.Wand2 size={10} /> Filtri editoriali
        </p>
        <div className="ir-filter-strip" data-testid="inline-regia-filters">
          {EDITORIAL_FILTERS.map((f) => (
            <button
              key={f.key || 'none'}
              type="button"
              onClick={() => pickFilter(f.key)}
              data-testid={`inline-regia-filter-${f.key || 'none'}`}
              className={`ir-filter ${filterKey === f.key ? 'is-on' : ''}`}
              title={f.label}
            >
              <span className="ir-filter__thumb"
                    style={{
                      backgroundImage: `url(${src})`,
                      backgroundPosition: focalCss,
                      filter: f.css === 'none' ? undefined : f.css,
                    }} />
              <span className="ir-filter__lbl">{f.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Safe-area mini preview pills */}
      <section className="ir-section">
        <p className="ir-section-label">
          <Icons.LayoutTemplate size={10} /> Adatta presentazione
        </p>
        <div className="ir-safe-pills" data-testid="inline-regia-safe-pills">
          {SAFE_AREAS.map((s) => (
            <button key={s.key} type="button"
                    className={`ir-safe-pill ${safe === s.key ? 'is-on' : ''}`}
                    onClick={() => setSafe(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="ir-safe-preview"
             style={{ aspectRatio: (SAFE_AREAS.find((s) => s.key === safe) || SAFE_AREAS[0]).ratio }}
             data-testid="inline-regia-safe-preview">
          <img src={src} alt=""
               style={{
                 objectFit: 'cover',
                 objectPosition: focalCss,
                 transform: `scale(${zoom})`,
                 transformOrigin: focalCss,
                 filter: cssFilter === 'none' ? undefined : cssFilter,
               }} />
        </div>
      </section>

      <footer className="ir-foot">
        {inspirationId && (
          <button type="button" className="ir-btn-soft"
                  onClick={saveToArchive}
                  data-testid="inline-regia-archive">
            <Icons.Save size={10} /> Persisti su Inspirations™
          </button>
        )}
        <span className="ir-foot__spacer" />
        <button type="button" className="ir-btn" onClick={onClose}
                data-testid="inline-regia-done">
          Fatto
        </button>
      </footer>
    </div>,
    document.body
  );
};

export default InlineEditorialRegia;
