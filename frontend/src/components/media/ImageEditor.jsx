/**
 * ImageEditor — Canvas-based crop + basic filters editor.
 *
 * Requisito MOOD: TUTTI i file in upload devono passare per crop + filtri base.
 * Implementazione: pure Canvas + CSS filters, zero dipendenze esterne.
 *
 * Features:
 *   • Crop con aspect ratio preset (Libero · 1:1 · 4:5 · 16:9 · 3:4)
 *   • Filtri: Luminosità · Contrasto · Saturazione · Calore · Nitidezza
 *   • Preview live via CSS filter()
 *   • Export via Canvas con tutti i filtri applicati al pixel
 *   • Returns Blob pronto per upload
 *
 * Linguaggio: italiano editoriale. ZERO jargon SaaS.
 */
import React, { useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import './image-editor.css';

const ASPECT_PRESETS = [
  { key: 'free',   label: 'Libero',  ratio: null },
  { key: 'square', label: '1:1',     ratio: 1 },
  { key: 'portrait', label: '4:5',   ratio: 4 / 5 },
  { key: 'wide',   label: '16:9',    ratio: 16 / 9 },
  { key: 'editorial', label: '3:4',  ratio: 3 / 4 },
];

const DEFAULT_FILTERS = {
  brightness: 100,   // 0-200 (100 = neutro)
  contrast:   100,
  saturate:   100,
  warmth:     0,     // -50 a +50
  sharpness:  0,     // 0-100 (post-process)
};

const FILTER_STYLE = (f) =>
  `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) hue-rotate(${f.warmth * 0.4}deg)`;


const ImageEditor = ({ open, file, onCancel, onConfirm }) => {
  const [imgEl, setImgEl] = useState(null);
  const [aspectKey, setAspectKey] = useState('free');
  const [crop, setCrop] = useState(null); // {x, y, w, h} in image pixels
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [dragMode, setDragMode] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Load image when modal opens
  useEffect(() => {
    if (!open || !file) { setImgEl(null); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      const aspect = ASPECT_PRESETS.find((a) => a.key === aspectKey)?.ratio;
      setCrop(initialCrop(img.naturalWidth, img.naturalHeight, aspect));
      setFilters(DEFAULT_FILTERS);
    };
    img.onerror = () => { setImgEl(null); };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [open, file]); // eslint-disable-line

  const applyAspect = (key) => {
    setAspectKey(key);
    if (!imgEl) return;
    const aspect = ASPECT_PRESETS.find((a) => a.key === key)?.ratio;
    setCrop(initialCrop(imgEl.naturalWidth, imgEl.naturalHeight, aspect));
  };

  // Drag handlers (pointer events) on the overlay
  const onPointerDown = (e, mode) => {
    if (!imgEl || !containerRef.current) return;
    e.stopPropagation();
    setDragMode(mode);
    setDragStart({
      x: e.clientX, y: e.clientY,
      crop: { ...crop },
      rect: containerRef.current.getBoundingClientRect(),
    });
  };
  const onPointerMove = (e) => {
    if (!dragMode || !dragStart || !imgEl) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const scale = imgEl.naturalWidth / dragStart.rect.width;
    const aspect = ASPECT_PRESETS.find((a) => a.key === aspectKey)?.ratio;
    let { x, y, w, h } = dragStart.crop;
    if (dragMode === 'move') {
      x = clamp(x + dx * scale, 0, imgEl.naturalWidth - w);
      y = clamp(y + dy * scale, 0, imgEl.naturalHeight - h);
    } else {
      // Handle resize from corners (se, ne, sw, nw)
      const adjustments = {
        se: { dw: dx * scale, dh: dy * scale,  dxC: 0, dyC: 0 },
        ne: { dw: dx * scale, dh: -dy * scale, dxC: 0, dyC: dy * scale },
        sw: { dw: -dx * scale, dh: dy * scale, dxC: dx * scale, dyC: 0 },
        nw: { dw: -dx * scale, dh: -dy * scale, dxC: dx * scale, dyC: dy * scale },
      }[dragMode] || { dw: 0, dh: 0, dxC: 0, dyC: 0 };
      let newW = Math.max(40, w + adjustments.dw);
      let newH = Math.max(40, h + adjustments.dh);
      if (aspect) {
        // Lock to aspect
        if (Math.abs(adjustments.dw) > Math.abs(adjustments.dh)) {
          newH = newW / aspect;
        } else {
          newW = newH * aspect;
        }
      }
      let newX = clamp(x + adjustments.dxC, 0, imgEl.naturalWidth - 40);
      let newY = clamp(y + adjustments.dyC, 0, imgEl.naturalHeight - 40);
      newW = Math.min(newW, imgEl.naturalWidth - newX);
      newH = Math.min(newH, imgEl.naturalHeight - newY);
      x = newX; y = newY; w = newW; h = newH;
    }
    setCrop({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
  };
  const onPointerUp = () => { setDragMode(null); setDragStart(null); };

  useEffect(() => {
    if (!dragMode) return;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragMode, dragStart]); // eslint-disable-line

  // Apply filters + crop to Canvas → Blob
  const exportBlob = () => new Promise((resolve, reject) => {
    if (!imgEl || !crop || !canvasRef.current) return reject(new Error('Editor non pronto'));
    const c = canvasRef.current;
    c.width = crop.w;
    c.height = crop.h;
    const ctx = c.getContext('2d');
    ctx.filter = FILTER_STYLE(filters);
    ctx.drawImage(imgEl, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    // Apply optional sharpness post-process (lightweight convolution)
    if (filters.sharpness > 0) {
      applySharpness(ctx, c.width, c.height, filters.sharpness / 100);
    }
    c.toBlob((blob) => {
      if (!blob) return reject(new Error('Export fallito'));
      resolve(new File([blob], (file?.name || 'inspiration') + '.jpg',
                       { type: 'image/jpeg', lastModified: Date.now() }));
    }, 'image/jpeg', 0.92);
  });

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const out = await exportBlob();
      onConfirm?.(out);
    } catch (e) {
      console.error(e);
    } finally { setBusy(false); }
  };

  if (!open) return null;

  // Compute scaled overlay box for live preview
  const previewBox = imgEl && crop && containerRef.current ? (() => {
    const rect = containerRef.current.getBoundingClientRect();
    const scale = rect.width / imgEl.naturalWidth;
    return {
      left:   crop.x * scale,
      top:    crop.y * scale,
      width:  crop.w * scale,
      height: crop.h * scale,
    };
  })() : null;

  return (
    <div className="imed-backdrop" data-testid="image-editor"
         onClick={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}>
      <div className="imed-modal">
        <header className="imed-head">
          <p className="ins-eyebrow">Editor immagine · prima dell'upload</p>
          <h2 className="imed-title">Inquadra l'immagine.</h2>
          <p className="imed-lede">
            Ogni riferimento entra in MOOD passando per una breve cura editoriale: ritaglio e correzioni di base.
          </p>
        </header>

        <div className="imed-body">
          <div className="imed-stage" ref={containerRef}>
            {imgEl ? (
              <>
                <img src={imgEl.src} alt="" className="imed-img"
                     style={{ filter: FILTER_STYLE(filters) }} draggable={false} />
                {previewBox && (
                  <div className="imed-crop"
                       style={{ left: previewBox.left, top: previewBox.top,
                                width: previewBox.width, height: previewBox.height }}
                       onPointerDown={(e) => onPointerDown(e, 'move')}>
                    <div className="imed-handle imed-handle--nw"
                         onPointerDown={(e) => onPointerDown(e, 'nw')} />
                    <div className="imed-handle imed-handle--ne"
                         onPointerDown={(e) => onPointerDown(e, 'ne')} />
                    <div className="imed-handle imed-handle--sw"
                         onPointerDown={(e) => onPointerDown(e, 'sw')} />
                    <div className="imed-handle imed-handle--se"
                         onPointerDown={(e) => onPointerDown(e, 'se')} />
                  </div>
                )}
              </>
            ) : (
              <div className="imed-loading">Caricamento immagine…</div>
            )}
          </div>

          <aside className="imed-controls">
            <section className="imed-section">
              <p className="ins-label">Inquadratura</p>
              <div className="imed-chips">
                {ASPECT_PRESETS.map((a) => (
                  <button key={a.key} type="button"
                          className={`imed-chip ${aspectKey === a.key ? 'imed-chip--on' : ''}`}
                          onClick={() => applyAspect(a.key)}
                          data-testid={`imed-aspect-${a.key}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="imed-section">
              <p className="ins-label">Correzioni</p>
              <SliderRow label="Luminosità" value={filters.brightness} min={50} max={150}
                         onChange={(v) => setFilters({ ...filters, brightness: v })} suffix="%" testid="imed-brightness" />
              <SliderRow label="Contrasto" value={filters.contrast} min={50} max={150}
                         onChange={(v) => setFilters({ ...filters, contrast: v })} suffix="%" testid="imed-contrast" />
              <SliderRow label="Saturazione" value={filters.saturate} min={0} max={180}
                         onChange={(v) => setFilters({ ...filters, saturate: v })} suffix="%" testid="imed-saturate" />
              <SliderRow label="Calore" value={filters.warmth} min={-30} max={30}
                         onChange={(v) => setFilters({ ...filters, warmth: v })} testid="imed-warmth" />
              <SliderRow label="Nitidezza" value={filters.sharpness} min={0} max={60}
                         onChange={(v) => setFilters({ ...filters, sharpness: v })} testid="imed-sharpness" />
              <button type="button" className="imed-reset"
                      onClick={() => setFilters(DEFAULT_FILTERS)}
                      data-testid="imed-reset">
                <Icons.RotateCcw size={11} /> Ripristina
              </button>
            </section>
          </aside>
        </div>

        <footer className="imed-foot">
          <button type="button" className="ins-btn ins-btn--ghost" onClick={onCancel} disabled={busy}
                  data-testid="imed-cancel">
            Annulla
          </button>
          <button type="button" className="ins-btn ins-btn--primary"
                  onClick={handleConfirm} disabled={busy || !imgEl}
                  data-testid="imed-confirm">
            {busy ? 'Salvataggio…' : 'Conferma e carica'}
            {!busy && <Icons.ArrowRight size={13} />}
          </button>
        </footer>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

const SliderRow = ({ label, value, min, max, onChange, suffix = '', testid }) => (
  <div className="imed-slider">
    <div className="imed-slider__top">
      <span>{label}</span>
      <span className="imed-slider__val">{value}{suffix}</span>
    </div>
    <input type="range" min={min} max={max} value={value}
           onChange={(e) => onChange(Number(e.target.value))}
           data-testid={testid} />
  </div>
);

// ── helpers ─────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const initialCrop = (W, H, aspect) => {
  if (!aspect) {
    // 90% of image, centered
    const m = 0.05;
    return { x: Math.round(W * m), y: Math.round(H * m),
             w: Math.round(W * (1 - 2 * m)), h: Math.round(H * (1 - 2 * m)) };
  }
  const imgAspect = W / H;
  let w, h;
  if (imgAspect > aspect) {
    h = H * 0.9; w = h * aspect;
  } else {
    w = W * 0.9; h = w / aspect;
  }
  return { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2),
           w: Math.round(w), h: Math.round(h) };
};

// Lightweight sharpness convolution. amount in [0,1].
function applySharpness(ctx, w, h, amount) {
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const k = amount * 0.6;
  const m = [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        let v = 0;
        let idx = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            v += src.data[((y + dy) * w + (x + dx)) * 4 + ch] * m[idx++];
          }
        }
        out.data[i + ch] = clamp(v, 0, 255);
      }
      out.data[i + 3] = src.data[i + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

export default ImageEditor;
