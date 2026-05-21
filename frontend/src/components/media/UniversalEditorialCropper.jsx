/**
 * UniversalEditorialCropper — regia immagine riusabile per tutto MOOD.
 *
 * Universal Editorial Cropper™ è il componente unico per:
 *   • Inspirations™ (riferimenti editoriali + Product Inspirations)
 *   • Moodboards (immagini drop)
 *   • Articles / Hero / Projects
 *   • Cultural Editions™ (cover)
 *
 * NESSUNA modifica raster — solo metadata persistito su
 * `media_library.metadata_json.display_meta`. I consumer leggono:
 *   { focal_x, focal_y, editorial_filter, crop_ratio, zoom }
 * e li applicano runtime via object-position + CSS filter() + zoom.
 *
 * Linguaggio: "Regia immagine", "Preparazione editoriale", "Punto focale",
 * "Filtro editoriale". MAI: editor / cropper / image filter / photo editor.
 */
import React, { useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { asErrorString } from '../../lib/asErrorString';
import './universal-cropper.css';

// ── Filtri editoriali (CSS filter() based — preview istantaneo, persistito) ──
import { useT } from "../../i18n/useT";
export const EDITORIAL_FILTERS = [{
  key: '',
  label: 'Nessun filtro',
  css: 'none'
}, {
  key: 'editorial_neutral',
  label: 'Editorial Neutral',
  css: 'contrast(1.04) saturate(0.95)'
}, {
  key: 'warm_residential',
  label: 'Warm Residential',
  css: 'sepia(0.10) saturate(1.10) brightness(1.03)'
}, {
  key: 'hospitality_glow',
  label: 'Hospitality Glow',
  css: 'sepia(0.18) saturate(1.18) brightness(1.06) contrast(1.02)'
}, {
  key: 'ad_contrast',
  label: 'AD Contrast',
  css: 'contrast(1.15) saturate(1.05) brightness(0.96)'
}, {
  key: 'soft_natural',
  label: 'Soft Natural',
  css: 'contrast(0.96) saturate(0.92) brightness(1.05)'
}, {
  key: 'material_focus',
  label: 'Material Focus',
  css: 'contrast(1.10) saturate(0.88) brightness(1.02)'
}, {
  key: 'cinematic_dark',
  label: 'Cinematic Dark',
  css: 'contrast(1.20) brightness(0.88) saturate(1.05)'
}];

// ── Anteprime safe-area (multi-device) ──────────────────────────────
export const SAFE_AREAS = [{
  key: 'hero',
  label: 'Hero',
  ratio: '16/9'
}, {
  key: 'moodboard',
  label: 'Moodboard',
  ratio: '4/3'
}, {
  key: 'card',
  label: 'Editorial Card',
  ratio: '1/1'
}, {
  key: 'mobile',
  label: 'Mobile portrait',
  ratio: '9/16'
}, {
  key: 'cinematic',
  label: 'Cinematic',
  ratio: '21/9'
}];
export const filterCssFor = key => (EDITORIAL_FILTERS.find(f => f.key === key) || EDITORIAL_FILTERS[0]).css;
const UniversalEditorialCropper = ({
  mediaId,
  imageUrl,
  initial,
  // { focal_x, focal_y, editorial_filter, crop_ratio, zoom }
  open,
  onClose,
  onSaved // (display_meta) => void
}) => {
  const {
    t
  } = useT();
  const [focal, setFocal] = useState({
    x: initial?.focal_x ?? 0.5,
    y: initial?.focal_y ?? 0.5
  });
  const [filter, setFilter] = useState(initial?.editorial_filter || '');
  const [ratio, setRatio] = useState(initial?.crop_ratio || 'auto');
  const [zoom, setZoom] = useState(initial?.zoom ?? 1);
  const [safe, setSafe] = useState('hero');
  const [saving, setSaving] = useState(false);
  const stageRef = useRef(null);
  const draggingRef = useRef(false);
  useEffect(() => {
    if (!open) return;
    setFocal({
      x: initial?.focal_x ?? 0.5,
      y: initial?.focal_y ?? 0.5
    });
    setFilter(initial?.editorial_filter || '');
    setRatio(initial?.crop_ratio || 'auto');
    setZoom(initial?.zoom ?? 1);
    setSafe('hero');
  }, [open, initial]);
  if (!open) return null;
  const cssFilter = filterCssFor(filter);
  const focalToObjPos = `${(focal.x * 100).toFixed(1)}% ${(focal.y * 100).toFixed(1)}%`;
  const onStagePointer = e => {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setFocal({
      x,
      y
    });
  };
  const onStageDown = e => {
    draggingRef.current = true;
    onStagePointer(e);
    e.preventDefault();
  };
  const onStageMove = e => {
    if (draggingRef.current) onStagePointer(e);
  };
  const onStageUp = () => {
    draggingRef.current = false;
  };
  const reset = () => {
    setFocal({
      x: 0.5,
      y: 0.5
    });
    setFilter('');
    setRatio('auto');
    setZoom(1);
  };
  const save = async () => {
    if (!mediaId) {
      onSaved?.({
        focal_x: focal.x,
        focal_y: focal.y,
        editorial_filter: filter || null,
        crop_ratio: ratio === 'auto' ? null : ratio,
        zoom
      });
      return;
    }
    setSaving(true);
    try {
      const r = await api.patch(`/api/inspirations/archive/${mediaId}/display-meta`, {
        focal_x: focal.x,
        focal_y: focal.y,
        editorial_filter: filter || null,
        crop_ratio: ratio === 'auto' ? null : ratio,
        zoom
      });
      onSaved?.(r.data.display_meta);
      toast.success('Regia immagine salvata.');
    } catch (e) {
      toast.error(asErrorString(e, 'Salvataggio non riuscito.'));
    } finally {
      setSaving(false);
    }
  };
  return <div className="uec-backdrop" data-testid="universal-cropper" onMouseDown={e => {
    if (e.target === e.currentTarget) onClose?.();
  }}>
      <div className="uec-modal">
        <header className="uec-head">
          <div>
            <p className="uec-eyebrow">Universal Editorial Cropper™</p>
            <h2 className="uec-title">Regia immagine</h2>
          </div>
          <button type="button" className="uec-close" onClick={onClose} data-testid="universal-cropper-close" aria-label={t("media.universal_editorial_cropper.chiudi")}>
            <Icons.X size={16} />
          </button>
        </header>

        <div className="uec-body">
          {/* Stage with focal point */}
          <section className="uec-stage-wrap">
            <p className="uec-section-label">
              <Icons.Target size={11} /> {t("media.universal_editorial_cropper.trascina_il_punto_focale_sulla_parte_importante_de")}
            </p>
            <div ref={stageRef} className="uec-stage" data-testid="universal-cropper-stage" onMouseDown={onStageDown} onMouseMove={onStageMove} onMouseUp={onStageUp} onMouseLeave={onStageUp}>
              <img src={imageUrl} alt="" className="uec-stage__img" style={{
              transform: `scale(${zoom})`,
              transformOrigin: focalToObjPos,
              filter: cssFilter
            }} draggable={false} />
              <span className="uec-focal" data-testid="universal-cropper-focal" style={{
              left: `${focal.x * 100}%`,
              top: `${focal.y * 100}%`
            }} />
            </div>

            {/* Zoom control */}
            <div className="uec-zoom" data-testid="universal-cropper-zoom">
              <Icons.ZoomOut size={12} />
              <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} aria-label="Zoom" />
              <Icons.ZoomIn size={12} />
              <span className="uec-zoom__val">{zoom.toFixed(2)}×</span>
            </div>
          </section>

          {/* Side panel */}
          <aside className="uec-panel">
            <Section title={t("media.universal_editorial_cropper.filtro_editoriale")} icon={Icons.Wand2}>
              <div className="uec-filter-grid" data-testid="universal-cropper-filters">
                {EDITORIAL_FILTERS.map(f => <button key={f.key || 'none'} type="button" className={`uec-filter-tile ${filter === f.key ? 'is-on' : ''}`} onClick={() => setFilter(f.key)} data-testid={`universal-cropper-filter-${f.key || 'none'}`}>
                    <div className="uec-filter-tile__preview" style={{
                  filter: f.css === 'none' ? undefined : f.css,
                  backgroundImage: `url(${imageUrl})`,
                  backgroundPosition: focalToObjPos
                }} />
                    <span className="uec-filter-tile__label">{f.label}</span>
                  </button>)}
              </div>
            </Section>

            <Section title="Anteprima · proporzioni" icon={Icons.LayoutTemplate}>
              <div className="uec-safe-toggle" data-testid="universal-cropper-safe-toggle">
                {SAFE_AREAS.map(s => <button key={s.key} type="button" className={`uec-safe-btn ${safe === s.key ? 'is-on' : ''}`} onClick={() => setSafe(s.key)}>
                    {s.label}
                  </button>)}
              </div>
              <div className="uec-safe-preview" style={{
              aspectRatio: (SAFE_AREAS.find(s => s.key === safe) || SAFE_AREAS[0]).ratio
            }} data-testid="universal-cropper-safe-preview">
                <img src={imageUrl} alt="" style={{
                objectFit: 'cover',
                objectPosition: focalToObjPos,
                transform: `scale(${zoom})`,
                transformOrigin: focalToObjPos,
                filter: cssFilter
              }} />
              </div>
            </Section>

            <Section title="Proporzioni preferite" icon={Icons.Crop}>
              <div className="uec-ratio-row">
                {['auto', '16:9', '4:3', '1:1', '9:16', '21:9'].map(r => <button key={r} type="button" className={`uec-ratio-btn ${ratio === r ? 'is-on' : ''}`} onClick={() => setRatio(r)} data-testid={`universal-cropper-ratio-${r}`}>
                    {r}
                  </button>)}
              </div>
              <p className="uec-hint">
                {t("media.universal_editorial_cropper.questa_e_la_proporzione_che_i_consumer_hero_moodbo")}
              </p>
            </Section>
          </aside>
        </div>

        <footer className="uec-foot">
          <button type="button" className="uec-btn-soft" onClick={reset} data-testid="universal-cropper-reset">
            <Icons.RotateCcw size={11} /> Ripristina
          </button>
          <span className="uec-foot__spacer" />
          <button type="button" className="uec-btn" onClick={save} disabled={saving} data-testid="universal-cropper-save">
            {saving ? 'Salvataggio…' : <>{t("media.universal_editorial_cropper.salva_regia")} <Icons.Check size={12} /></>}
          </button>
        </footer>
      </div>
    </div>;
};
const Section = ({
  title,
  icon: Icon,
  children
}) => <div className="uec-section">
    <p className="uec-section-label">
      {Icon && <Icon size={11} />}
      {title}
    </p>
    {children}
  </div>;
export default UniversalEditorialCropper;