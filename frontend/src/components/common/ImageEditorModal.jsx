/**
 * ImageEditorModal™ — ITER157.E.8
 * Post-upload (or pre-upload) image editor with:
 *   • Crop with aspect ratio selector (free · 1:1 · 4:3 · 3:2 · 16:9 · 21:9)
 *   • Brightness · Contrast · Saturation sliders
 *   • Grayscale toggle
 *
 * Output: a `Blob` (PNG, max 2400px on the longest side) ready for upload.
 *
 * Usage:
 *   <ImageEditorModal
 *      file={file}                              // OR src={url}
 *      filename="hero.jpg"
 *      initialAspect={16/9}
 *      onCancel={() => setOpen(false)}
 *      onApply={(blob) => doUpload(blob)} />
 */
import React, { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import { X, Sun, Contrast as ContrastIcon, Droplet, RotateCcw, Check, Crop as CropIcon } from 'lucide-react';
import './imageEditorModal.css';

const ASPECTS = [
  { value: null,    label: 'Libero' },
  { value: 1,       label: '1:1' },
  { value: 4/3,     label: '4:3' },
  { value: 3/2,     label: '3:2' },
  { value: 16/9,    label: '16:9' },
  { value: 21/9,    label: '21:9' },
];

const MAX_OUTPUT_SIDE = 2400;

const FILTER_DEFAULTS = { brightness: 100, contrast: 100, saturation: 100, grayscale: false };

const cssFilter = (f) =>
  `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) grayscale(${f.grayscale ? 100 : 0}%)`;

// Load HTMLImage from URL/blob — guarded by CORS if remote
const loadImage = (src) => new Promise((res, rej) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => res(img);
  img.onerror = rej;
  img.src = src;
});

// Render crop+filters to canvas → blob (PNG)
async function bakeImage(src, cropPixels, filters) {
  const img = await loadImage(src);
  const sx = cropPixels?.x ?? 0;
  const sy = cropPixels?.y ?? 0;
  const sw = cropPixels?.width  ?? img.naturalWidth;
  const sh = cropPixels?.height ?? img.naturalHeight;
  // Scale down output if cropped result is huge.
  const longest = Math.max(sw, sh);
  const scale = longest > MAX_OUTPUT_SIDE ? MAX_OUTPUT_SIDE / longest : 1;
  const outW = Math.round(sw * scale);
  const outH = Math.round(sh * scale);
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  ctx.filter = cssFilter(filters);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  return await new Promise((res) => canvas.toBlob((b) => res(b), 'image/png', 0.92));
}

const ImageEditorModal = ({
  file = null,
  src = null,
  filename = 'image.png',
  initialAspect = 16/9,
  onCancel,
  onApply,
}) => {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(initialAspect);
  const [cropPixels, setCropPixels] = useState(null);
  const [filters, setFilters] = useState(FILTER_DEFAULTS);
  const [busy, setBusy] = useState(false);

  // Resolve preview URL: blob from file OR remote src
  useEffect(() => {
    if (file) {
      const u = URL.createObjectURL(file);
      setPreviewUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setPreviewUrl(src);
  }, [file, src]);

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCropPixels(areaPixels);
  }, []);

  const resetFilters = () => setFilters(FILTER_DEFAULTS);

  const handleApply = async () => {
    if (!previewUrl) return;
    setBusy(true);
    try {
      const blob = await bakeImage(previewUrl, cropPixels, filters);
      // Wrap blob as File with the original name (so the upload pipeline
      // can probe ext / mime type properly).
      const ext = (filename.split('.').pop() || 'png').toLowerCase();
      const safeName = filename.replace(/\.[^.]+$/, '') + '_edited.' + ext;
      const fileOut = new File([blob], safeName, { type: 'image/png' });
      await onApply(fileOut);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Image bake failed', e);
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async () => {
    // Skip = upload as-is (no crop, no filter). For local files we just
    // forward the original; for remote src we still bake to enforce
    // any deliberate aspect ratio choice. For simplicity here: just
    // pass the original file back if available.
    if (file) onApply(file);
    else handleApply();
  };

  return (
    <div className="iem-overlay" data-testid="iem-overlay">
      <div className="iem-modal" data-testid="iem-modal">
        <header className="iem-head">
          <div>
            <p className="iem-eyebrow">EDITOR IMMAGINE</p>
            <h2 className="iem-title">Ritaglio &amp; Filtri</h2>
          </div>
          <button className="iem-close" onClick={onCancel} data-testid="iem-close" title="Annulla">
            <X size={20} strokeWidth={1.8} />
          </button>
        </header>

        <div className="iem-body">
          <div className="iem-stage">
            {previewUrl && (
              <div className="iem-cropper-wrap" style={{ filter: cssFilter(filters) }}>
                <Cropper
                  image={previewUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspect || undefined}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  showGrid={true}
                  objectFit="contain"
                  style={{
                    containerStyle: { background: '#000', borderRadius: 8 },
                  }}
                />
              </div>
            )}
            <div className="iem-zoom-row">
              <span className="iem-zoom-label">ZOOM</span>
              <input
                type="range" min="1" max="3" step="0.05"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="iem-range"
                data-testid="iem-zoom" />
              <span className="iem-zoom-val">{zoom.toFixed(2)}×</span>
            </div>
          </div>

          <aside className="iem-controls">
            <section className="iem-panel">
              <header className="iem-panel__head">
                <CropIcon size={14} strokeWidth={1.8} />
                <span>Proporzioni</span>
              </header>
              <div className="iem-aspect-grid">
                {ASPECTS.map((a) => (
                  <button
                    key={a.label}
                    className="iem-aspect"
                    data-active={aspect === a.value ? 'true' : 'false'}
                    onClick={() => setAspect(a.value)}
                    data-testid={`iem-aspect-${a.label.replace(':', '-')}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="iem-panel">
              <header className="iem-panel__head">
                <Sun size={14} strokeWidth={1.8} />
                <span>Luminosità</span>
                <span className="iem-panel__val">{filters.brightness}%</span>
              </header>
              <input type="range" min="40" max="160" step="1"
                value={filters.brightness}
                onChange={(e) => setFilters((f) => ({ ...f, brightness: Number(e.target.value) }))}
                className="iem-range"
                data-testid="iem-brightness" />
            </section>

            <section className="iem-panel">
              <header className="iem-panel__head">
                <ContrastIcon size={14} strokeWidth={1.8} />
                <span>Contrasto</span>
                <span className="iem-panel__val">{filters.contrast}%</span>
              </header>
              <input type="range" min="40" max="180" step="1"
                value={filters.contrast}
                onChange={(e) => setFilters((f) => ({ ...f, contrast: Number(e.target.value) }))}
                className="iem-range"
                data-testid="iem-contrast" />
            </section>

            <section className="iem-panel">
              <header className="iem-panel__head">
                <Droplet size={14} strokeWidth={1.8} />
                <span>Saturazione</span>
                <span className="iem-panel__val">{filters.saturation}%</span>
              </header>
              <input type="range" min="0" max="180" step="1"
                value={filters.saturation}
                onChange={(e) => setFilters((f) => ({ ...f, saturation: Number(e.target.value) }))}
                className="iem-range"
                data-testid="iem-saturation" />
            </section>

            <section className="iem-panel">
              <label className="iem-toggle">
                <input
                  type="checkbox"
                  checked={filters.grayscale}
                  onChange={(e) => setFilters((f) => ({ ...f, grayscale: e.target.checked }))}
                  data-testid="iem-grayscale" />
                <span>Bianco &amp; Nero</span>
              </label>
            </section>

            <button
              className="iem-reset"
              onClick={resetFilters}
              data-testid="iem-reset"
              title="Reset filtri">
              <RotateCcw size={12} strokeWidth={1.8} /> Reset filtri
            </button>
          </aside>
        </div>

        <footer className="iem-foot">
          <button className="iem-ghost" onClick={handleSkip} disabled={busy} data-testid="iem-skip">
            Salta editor &amp; carica originale
          </button>
          <div className="iem-foot__right">
            <button className="iem-ghost" onClick={onCancel} disabled={busy} data-testid="iem-cancel">
              Annulla
            </button>
            <button className="iem-primary" onClick={handleApply} disabled={busy} data-testid="iem-apply">
              <Check size={14} strokeWidth={2} /> {busy ? 'Elaborazione…' : 'Applica e carica'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ImageEditorModal;
