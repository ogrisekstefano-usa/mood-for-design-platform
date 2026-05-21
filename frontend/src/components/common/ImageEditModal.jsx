/**
 * ImageEditModal — Modifica editoriale per ogni immagine del DAM.
 *
 * 3 tab editoriali:
 *   • CROP — react-easy-crop con preset (Libero · 1:1 · 16:9 · 9:16 · 4:3 · 3:4)
 *   • PUNTO FOCALE — drag-to-set su superficie editoriale con preview live
 *     in 3 ratio (16:9 hero, 9:16 storytelling mobile, 1:1 card editoriale).
 *     NON modifica il raster — solo metadata `focal_point: {x, y}` letti
 *     runtime tramite `object-position` su tutti i renderer.
 *   • FILTRI — luminosità · contrasto · saturazione · rotazione + reset
 *
 * Save: PATCH /api/media/{id} con focal_point + filters.
 * Il display_url e il SiteImage universale propagano in modo continuo.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Check, RotateCw, Crop as CropIcon, SlidersHorizontal, Loader2, Crosshair } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { toast } from 'sonner';
import { media, uploadMediaFile } from '../../lib/mediaApi';
import { DEFAULT_FILTERS, cssFilterOf } from '../../lib/imageFilters';
import './image-edit-modal.css';
import { useT } from '../../i18n/useT';
const ASPECTS = [{
  id: 'free',
  label: 'Libero',
  value: null
}, {
  id: '1x1',
  label: '1:1',
  value: 1
}, {
  id: '16x9',
  label: '16:9',
  value: 16 / 9
}, {
  id: '9x16',
  label: '9:16',
  value: 9 / 16
}, {
  id: '4x3',
  label: '4:3',
  value: 4 / 3
}, {
  id: '3x4',
  label: '3:4',
  value: 3 / 4
}];

// Ratios per cui il punto focale viene previewed.
// Ogni voce determina come l'immagine appare in un consumo reale.
const FP_PREVIEWS = [{
  id: '16x9',
  label: '16:9 · hero / progetto',
  ratio: 16 / 9,
  hint: 'Pagina progetto, hero editoriale'
}, {
  id: '9x16',
  label: '9:16 · mobile · storytelling',
  ratio: 9 / 16,
  hint: 'Storia mobile, Inspirations™'
}, {
  id: '1x1',
  label: '1:1 · card · grid · avatar',
  ratio: 1,
  hint: 'Magazine card, moodboard preview'
}];
const CROP_SAFE_INSET = 0.08; // 8% safe-zone interna (no testo/volto vicino al bordo)

const buildCroppedBlob = (imageSrc, cropArea, filters) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = cropArea.width;
    canvas.height = cropArea.height;
    const ctx = canvas.getContext('2d');
    ctx.filter = cssFilterOf(filters || DEFAULT_FILTERS);
    ctx.drawImage(img, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, cropArea.width, cropArea.height);
    canvas.toBlob(blob => {
      if (blob) resolve(blob);else reject(new Error('canvas toBlob failed'));
    }, 'image/jpeg', 0.92);
  };
  img.onerror = reject;
  img.src = imageSrc;
});
const ImageEditModal = ({
  open,
  asset,
  onClose,
  onSaved
}) => {
  const {
    t
  } = useT();
  const [tab, setTab] = useState('crop'); // crop | focal | filters
  const [crop, setCrop] = useState({
    x: 0,
    y: 0
  });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(null);
  const [croppedArea, setCroppedArea] = useState(null);
  const [filters, setFilters] = useState({
    ...DEFAULT_FILTERS
  });
  const [focal, setFocal] = useState({
    x: 0.5,
    y: 0.5
  });
  const [saving, setSaving] = useState(false);
  const initialUrl = useRef('');
  useEffect(() => {
    if (!open || !asset) return;
    initialUrl.current = asset.display_url || asset.file_url || '';
    setCrop({
      x: 0,
      y: 0
    });
    setZoom(1);
    setAspect(null);
    setCroppedArea(null);
    setFilters({
      ...DEFAULT_FILTERS,
      ...(asset.filters || {})
    });
    const fp = asset.focal_point || {};
    setFocal({
      x: typeof fp.x === 'number' ? fp.x : 0.5,
      y: typeof fp.y === 'number' ? fp.y : 0.5
    });
    setTab('crop');
  }, [open, asset]);
  const onCropComplete = useCallback((_, areaPixels) => {
    setCroppedArea(areaPixels);
  }, []);
  const handleSave = async () => {
    if (!asset) return;
    setSaving(true);
    try {
      // Persist filters + focal_point sempre (anche senza crop).
      await media.update(asset.id, {
        filters,
        focal_point: {
          x: Number(focal.x.toFixed(4)),
          y: Number(focal.y.toFixed(4))
        }
      });
      const didCrop = croppedArea && croppedArea.width > 0 && (croppedArea.x > 1 || croppedArea.y > 1 || Math.abs(croppedArea.width - asset.width) > 2 || Math.abs(croppedArea.height - asset.height) > 2);
      let saved = {
        ...asset,
        filters,
        focal_point: focal
      };
      if (didCrop) {
        const blob = await buildCroppedBlob(initialUrl.current, croppedArea, filters);
        const file = new File([blob], asset.file_name || `edit-${asset.id}.jpg`, {
          type: 'image/jpeg'
        });
        const newAsset = await uploadMediaFile({
          file,
          bucket: asset.bucket || 'tenant-assets',
          folder: asset.folder || 'editorial',
          category: asset.category || null
        });
        await media.update(asset.id, {
          file_url: newAsset.file_url,
          display_url: newAsset.display_url || newAsset.file_url,
          width: newAsset.width,
          height: newAsset.height
        }).catch(() => {/* tolerated */});
        saved = {
          ...saved,
          file_url: newAsset.file_url,
          display_url: newAsset.display_url || newAsset.file_url,
          width: newAsset.width,
          height: newAsset.height
        };
      }
      toast.success('Immagine aggiornata · stile propagato ovunque');
      onSaved?.(saved);
      onClose?.();
    } catch (e) {
      console.error(e);
      toast.error('Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };
  if (!open || !asset) return null;
  const previewStyle = {
    filter: cssFilterOf(filters)
  };
  return <div className="iem-backdrop" onClick={e => {
    if (e.target === e.currentTarget) onClose?.();
  }} data-testid="image-edit-modal">
      <div className="iem-modal">
        <header className="iem-modal__head">
          <div>
            <p className="iem-modal__eyebrow">{t('common.image_edit.modifica_immagine_continuita_editoriale')}</p>
            <h2 className="iem-modal__title">{asset.file_name || 'Asset senza nome'}</h2>
          </div>
          <button type="button" className="iem-modal__close" onClick={onClose} data-testid="iem-close" aria-label={t("common.image_edit.chiudi")}>
            <X size={16} />
          </button>
        </header>

        <div className="iem-tabs" role="tablist">
          <button type="button" role="tab" className={`iem-tab ${tab === 'crop' ? 'is-active' : ''}`} onClick={() => setTab('crop')} data-testid="iem-tab-crop">
            <CropIcon size={12} /> Crop
          </button>
          <button type="button" role="tab" className={`iem-tab ${tab === 'focal' ? 'is-active' : ''}`} onClick={() => setTab('focal')} data-testid="iem-tab-focal">
            <Crosshair size={12} /> Punto focale
          </button>
          <button type="button" role="tab" className={`iem-tab ${tab === 'filters' ? 'is-active' : ''}`} onClick={() => setTab('filters')} data-testid="iem-tab-filters">
            <SlidersHorizontal size={12} /> Filtri
          </button>
        </div>

        <div className="iem-body">
          <div className="iem-stage">
            {tab === 'crop' && <Cropper image={initialUrl.current} crop={crop} zoom={zoom} aspect={aspect || undefined} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} cropShape="rect" showGrid objectFit="contain" style={{
            containerStyle: {
              background: 'rgba(0,0,0,0.6)'
            }
          }} />}
            {tab === 'focal' && <FocalSurface src={initialUrl.current} focal={focal} onChange={setFocal} />}
            {tab === 'filters' && <div className="iem-filters-preview">
                <img src={initialUrl.current} alt={asset.alt_text || 'preview'} style={previewStyle} data-testid="iem-filter-preview" />
              </div>}
          </div>

          <aside className="iem-panel">
            {tab === 'crop' && <>
                <p className="iem-panel__label">Aspect ratio</p>
                <div className="iem-aspects">
                  {ASPECTS.map(a => <button key={a.id} type="button" className={`iem-aspect ${aspect === a.value ? 'is-active' : ''}`} onClick={() => setAspect(a.value)} data-testid={`iem-aspect-${a.id}`}>
                      {a.label}
                    </button>)}
                </div>
                <p className="iem-panel__label">Zoom</p>
                <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} data-testid="iem-zoom" />
                <p className="iem-panel__hint">{t('common.image_edit.trascina_l_area_visibile_usa_le_maniglie_per_regol')}</p>
              </>}

            {tab === 'focal' && <FocalPreviews src={initialUrl.current} focal={focal} filters={filters} onPick={setFocal} />}

            {tab === 'filters' && <>
                <FilterRow label="Luminosità" testid="iem-flt-brightness" value={filters.brightness} min={0.5} max={1.5} step={0.05} onChange={v => setFilters({
              ...filters,
              brightness: v
            })} format={v => `${Math.round(v * 100)}%`} />
                <FilterRow label="Contrasto" testid="iem-flt-contrast" value={filters.contrast} min={0.5} max={1.5} step={0.05} onChange={v => setFilters({
              ...filters,
              contrast: v
            })} format={v => `${Math.round(v * 100)}%`} />
                <FilterRow label="Saturazione" testid="iem-flt-saturation" value={filters.saturation} min={0} max={2} step={0.05} onChange={v => setFilters({
              ...filters,
              saturation: v
            })} format={v => `${Math.round(v * 100)}%`} />
                <FilterRow label="Rotazione" testid="iem-flt-rotate" value={filters.rotate} min={-180} max={180} step={1} onChange={v => setFilters({
              ...filters,
              rotate: v
            })} format={v => `${v}°`} extra={<button type="button" className="iem-icon-btn" onClick={() => setFilters({
              ...filters,
              rotate: ((filters.rotate || 0) + 90) % 360
            })} data-testid="iem-rotate-90">
                               <RotateCw size={11} />
                             </button>} />
                <button type="button" className="iem-reset" onClick={() => setFilters({
              ...DEFAULT_FILTERS
            })} data-testid="iem-reset">
                  Reset filtri
                </button>
              </>}
          </aside>
        </div>

        <footer className="iem-foot">
          <button type="button" className="iem-btn iem-btn--ghost" onClick={onClose} disabled={saving} data-testid="iem-cancel">
            {t("common.image_edit.annulla")}
          </button>
          <button type="button" className="iem-btn iem-btn--primary" onClick={handleSave} disabled={saving} data-testid="iem-save">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {saving ? 'Salvo…' : 'Salva modifiche'}
          </button>
        </footer>
      </div>
    </div>;
};

// ─── Focal surface — drag-to-set sull'immagine intera ─────────────────
const FocalSurface = ({
  src,
  focal,
  onChange
}) => {
  const surfaceRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const updateFromEvent = useCallback((clientX, clientY) => {
    const el = surfaceRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Trova il bounding box dell'immagine all'interno della surface (object-fit:contain).
    const img = el.querySelector('img');
    if (!img || !img.naturalWidth) return;
    const sw = rect.width;
    const sh = rect.height;
    const ar = img.naturalWidth / img.naturalHeight;
    let iw, ih, ox, oy;
    if (sw / sh > ar) {
      ih = sh;
      iw = ih * ar;
      ox = (sw - iw) / 2;
      oy = 0;
    } else {
      iw = sw;
      ih = iw / ar;
      ox = 0;
      oy = (sh - ih) / 2;
    }
    const rx = Math.min(1, Math.max(0, (clientX - rect.left - ox) / iw));
    const ry = Math.min(1, Math.max(0, (clientY - rect.top - oy) / ih));
    onChange({
      x: rx,
      y: ry
    });
  }, [onChange]);
  const onPointerDown = e => {
    e.preventDefault();
    setDragging(true);
    updateFromEvent(e.clientX, e.clientY);
  };
  const onPointerMove = e => {
    if (!dragging) return;
    updateFromEvent(e.clientX, e.clientY);
  };
  const onPointerUp = () => setDragging(false);
  return <div className="iem-focal-stage" ref={surfaceRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp} data-testid="iem-focal-stage">
      <img src={src} alt="focal-source" draggable={false} />
      {/* Safe zone overlay */}
      <div className="iem-focal-safe" style={{
      left: `${CROP_SAFE_INSET * 100}%`,
      right: `${CROP_SAFE_INSET * 100}%`,
      top: `${CROP_SAFE_INSET * 100}%`,
      bottom: `${CROP_SAFE_INSET * 100}%`
    }} />
      <div className="iem-focal-target" style={{
      left: `${focal.x * 100}%`,
      top: `${focal.y * 100}%`
    }} data-testid="iem-focal-target">
        <span className="iem-focal-target__ring" />
        <span className="iem-focal-target__dot" />
      </div>
    </div>;
};

// ─── Focal previews — 3 ratio editoriali ───────────────────────────────
const FocalPreviews = ({
  src,
  focal,
  filters,
  onPick
}) => {
  const filterCss = cssFilterOf(filters);
  return <>
      <p className="iem-panel__label">Anteprime di consumo</p>
      <p className="iem-panel__hint" style={{
      marginTop: 0,
      marginBottom: 12
    }}>
        {t("common.image_edit.il_punto_focale_resta_visibile_in_tutti_i_ritagli")}
      </p>
      <div className="iem-fp-previews">
        {FP_PREVIEWS.map(p => <button type="button" key={p.id} className="iem-fp-preview" onClick={() => onPick && onPick(focal)} data-testid={`iem-fp-preview-${p.id}`}>
            <div className="iem-fp-preview__frame" style={{
          aspectRatio: String(p.ratio)
        }}>
              <img src={src} alt={`preview ${p.label}`} style={{
            filter: filterCss,
            objectPosition: `${focal.x * 100}% ${focal.y * 100}%`
          }} />
            </div>
            <span className="iem-fp-preview__label">{p.label}</span>
          </button>)}
      </div>
      <p className="iem-panel__label" style={{
      marginTop: 16
    }}>Posizione</p>
      <div className="iem-fp-coords">
        <span>X · {Math.round(focal.x * 100)}%</span>
        <span>Y · {Math.round(focal.y * 100)}%</span>
      </div>
      <button type="button" className="iem-reset" onClick={() => onPick({
      x: 0.5,
      y: 0.5
    })} data-testid="iem-focal-reset">
        {t("common.image_edit.centra_il_punto_focale")}
      </button>
    </>;
};
const FilterRow = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  testid,
  extra
}) => <div className="iem-flt" data-testid={testid}>
    <div className="iem-flt__head">
      <span className="iem-flt__label">{label}</span>
      <span className="iem-flt__val">{format ? format(value) : value}</span>
      {extra}
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} />
  </div>;
export default ImageEditModal;