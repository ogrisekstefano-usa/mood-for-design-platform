/**
 * ImageEditModal — Modal "✏️ Edit" per ogni foto della Media Library.
 *
 * Funzioni Phase 1:
 *   • CROP libero o con preset (square · 16:9 · 4:3 · 3:4 · 9:16 · free)
 *   • FILTRI base — luminosità · contrasto · saturazione · rotazione
 *   • Live preview in canvas, applicati on save
 *   • Salvataggio: invia metadati filters al backend (media_library.filters)
 *     + se cambia il crop, applica trasformazione canvas e ri-upload
 *
 * Si apre da AssetPickerModal (icona penna su ogni card) o da EditorialMediaField
 * (icona penna nel pannello azioni). Riusa lo schema filtri già presente in
 * imageFilters.js e il modulo media.update().
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, Check, RotateCw, Crop as CropIcon, SlidersHorizontal, Loader2,
} from 'lucide-react';
import Cropper from 'react-easy-crop';
import { toast } from 'sonner';
import { media, uploadMediaFile } from '../../lib/mediaApi';
import { DEFAULT_FILTERS, cssFilterOf } from '../../lib/imageFilters';
import './image-edit-modal.css';

const ASPECTS = [
  { id: 'free',  label: 'Libero',   value: null },
  { id: '1x1',   label: '1:1',      value: 1 },
  { id: '16x9',  label: '16:9',     value: 16 / 9 },
  { id: '9x16',  label: '9:16',     value: 9 / 16 },
  { id: '4x3',   label: '4:3',      value: 4 / 3 },
  { id: '3x4',   label: '3:4',      value: 3 / 4 },
];

// Build a cropped+filtered jpeg from the canvas crop area.
const buildCroppedBlob = (imageSrc, cropArea, filters) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const rotation = ((filters?.rotate || 0) * Math.PI) / 180;
    // For simplicity we don't rotate canvas here — the saved filters carry the rotate.
    canvas.width = cropArea.width;
    canvas.height = cropArea.height;
    const ctx = canvas.getContext('2d');
    ctx.filter = cssFilterOf(filters || DEFAULT_FILTERS);
    ctx.drawImage(
      img,
      cropArea.x, cropArea.y, cropArea.width, cropArea.height,
      0, 0, cropArea.width, cropArea.height,
    );
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas toBlob failed'));
    }, 'image/jpeg', 0.92);
  };
  img.onerror = reject;
  img.src = imageSrc;
});

const ImageEditModal = ({ open, asset, onClose, onSaved }) => {
  const [tab, setTab] = useState('crop');     // crop | filters
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(null); // null = free
  const [croppedArea, setCroppedArea] = useState(null);
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [saving, setSaving] = useState(false);
  const initialUrl = useRef('');

  useEffect(() => {
    if (!open || !asset) return;
    initialUrl.current = asset.display_url || asset.file_url || '';
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspect(null);
    setCroppedArea(null);
    setFilters({ ...DEFAULT_FILTERS, ...(asset.filters || {}) });
    setTab('crop');
  }, [open, asset]);

  const onCropComplete = useCallback((_, areaPixels) => {
    setCroppedArea(areaPixels);
  }, []);

  const handleSave = async () => {
    if (!asset) return;
    setSaving(true);
    try {
      // Step 1: persist filters metadata (always)
      await media.update(asset.id, { filters });

      // Step 2: if user did a crop, render new image and re-upload
      const didCrop = croppedArea && (croppedArea.width > 0) && (
        croppedArea.x > 1 || croppedArea.y > 1 ||
        Math.abs(croppedArea.width - asset.width) > 2 ||
        Math.abs(croppedArea.height - asset.height) > 2
      );
      let saved = { ...asset, filters };
      if (didCrop) {
        const blob = await buildCroppedBlob(initialUrl.current, croppedArea, filters);
        const file = new File([blob], asset.file_name || `edit-${asset.id}.jpg`, { type: 'image/jpeg' });
        const newAsset = await uploadMediaFile({
          file,
          bucket: asset.bucket || 'tenant-assets',
          folder: asset.folder || 'editorial',
          category: asset.category || null,
        });
        // Replace the original asset's URL so consumers see the cropped version
        await media.update(asset.id, {
          file_url: newAsset.file_url,
          display_url: newAsset.display_url || newAsset.file_url,
          width: newAsset.width,
          height: newAsset.height,
        }).catch(() => { /* tolerated */ });
        saved = { ...saved, file_url: newAsset.file_url, display_url: newAsset.display_url || newAsset.file_url, width: newAsset.width, height: newAsset.height };
      }
      toast.success('Immagine aggiornata');
      onSaved?.(saved);
      onClose?.();
    } catch (e) {
      console.error(e);
      toast.error('Salvataggio fallito');
    } finally { setSaving(false); }
  };

  if (!open || !asset) return null;
  const previewStyle = { filter: cssFilterOf(filters) };

  return (
    <div className="iem-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
         data-testid="image-edit-modal">
      <div className="iem-modal">
        <header className="iem-modal__head">
          <div>
            <p className="iem-modal__eyebrow">Modifica immagine</p>
            <h2 className="iem-modal__title">{asset.file_name || 'Asset senza nome'}</h2>
          </div>
          <button type="button" className="iem-modal__close" onClick={onClose}
                  data-testid="iem-close" aria-label="Chiudi">
            <X size={16} />
          </button>
        </header>

        <div className="iem-tabs" role="tablist">
          <button type="button" role="tab"
                  className={`iem-tab ${tab === 'crop' ? 'is-active' : ''}`}
                  onClick={() => setTab('crop')}
                  data-testid="iem-tab-crop">
            <CropIcon size={12} /> Crop
          </button>
          <button type="button" role="tab"
                  className={`iem-tab ${tab === 'filters' ? 'is-active' : ''}`}
                  onClick={() => setTab('filters')}
                  data-testid="iem-tab-filters">
            <SlidersHorizontal size={12} /> Filtri
          </button>
        </div>

        <div className="iem-body">
          <div className="iem-stage">
            {tab === 'crop' ? (
              <Cropper
                image={initialUrl.current}
                crop={crop}
                zoom={zoom}
                aspect={aspect || undefined}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="rect"
                showGrid
                objectFit="contain"
                style={{ containerStyle: { background: 'rgba(0,0,0,0.6)' } }}
              />
            ) : (
              <div className="iem-filters-preview">
                <img src={initialUrl.current} alt={asset.alt_text || 'preview'}
                     style={previewStyle} data-testid="iem-filter-preview" />
              </div>
            )}
          </div>

          <aside className="iem-panel">
            {tab === 'crop' ? (
              <>
                <p className="iem-panel__label">Aspect ratio</p>
                <div className="iem-aspects">
                  {ASPECTS.map((a) => (
                    <button key={a.id} type="button"
                            className={`iem-aspect ${aspect === a.value ? 'is-active' : ''}`}
                            onClick={() => setAspect(a.value)}
                            data-testid={`iem-aspect-${a.id}`}>
                      {a.label}
                    </button>
                  ))}
                </div>
                <p className="iem-panel__label">Zoom</p>
                <input type="range" min={1} max={3} step={0.01} value={zoom}
                       onChange={(e) => setZoom(parseFloat(e.target.value))}
                       data-testid="iem-zoom" />
                <p className="iem-panel__hint">Trascina l'area visibile · usa le maniglie per regolare</p>
              </>
            ) : (
              <>
                <FilterRow label="Luminosità" testid="iem-flt-brightness"
                           value={filters.brightness} min={0.5} max={1.5} step={0.05}
                           onChange={(v) => setFilters({ ...filters, brightness: v })}
                           format={(v) => `${Math.round(v * 100)}%`} />
                <FilterRow label="Contrasto" testid="iem-flt-contrast"
                           value={filters.contrast} min={0.5} max={1.5} step={0.05}
                           onChange={(v) => setFilters({ ...filters, contrast: v })}
                           format={(v) => `${Math.round(v * 100)}%`} />
                <FilterRow label="Saturazione" testid="iem-flt-saturation"
                           value={filters.saturation} min={0} max={2} step={0.05}
                           onChange={(v) => setFilters({ ...filters, saturation: v })}
                           format={(v) => `${Math.round(v * 100)}%`} />
                <FilterRow label="Rotazione" testid="iem-flt-rotate"
                           value={filters.rotate} min={-180} max={180} step={1}
                           onChange={(v) => setFilters({ ...filters, rotate: v })}
                           format={(v) => `${v}°`}
                           extra={
                             <button type="button" className="iem-icon-btn"
                                     onClick={() => setFilters({ ...filters, rotate: ((filters.rotate || 0) + 90) % 360 })}
                                     data-testid="iem-rotate-90">
                               <RotateCw size={11} />
                             </button>
                           } />
                <button type="button" className="iem-reset"
                        onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                        data-testid="iem-reset">
                  Reset filtri
                </button>
              </>
            )}
          </aside>
        </div>

        <footer className="iem-foot">
          <button type="button" className="iem-btn iem-btn--ghost"
                  onClick={onClose} disabled={saving} data-testid="iem-cancel">
            Annulla
          </button>
          <button type="button" className="iem-btn iem-btn--primary"
                  onClick={handleSave} disabled={saving} data-testid="iem-save">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {saving ? 'Salvo…' : 'Salva modifiche'}
          </button>
        </footer>
      </div>
    </div>
  );
};

const FilterRow = ({ label, value, min, max, step, onChange, format, testid, extra }) => (
  <div className="iem-flt" data-testid={testid}>
    <div className="iem-flt__head">
      <span className="iem-flt__label">{label}</span>
      <span className="iem-flt__val">{format ? format(value) : value}</span>
      {extra}
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
           onChange={(e) => onChange(parseFloat(e.target.value))} />
  </div>
);

export default ImageEditModal;
