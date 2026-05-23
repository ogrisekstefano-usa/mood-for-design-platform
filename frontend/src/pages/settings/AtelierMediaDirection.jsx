/**
 * AtelierMediaDirection — ITER138 · MEDIA ORCHESTRATION REFINEMENT™
 *
 * Drag & drop multipart upload → live cinematic preview with focal point,
 * crop safe-zones, grading preset chips, and manual fine-tuning sliders.
 *
 * This is NOT a media library — it is the studio's atmosphere composer.
 * Every byte is uploaded server-side, processed via Pillow, persisted
 * in Supabase Storage, and bound to a DB row with art-direction metadata.
 *
 * Wired into AtelierDashboardAdminPage as the "Media Direction" tab.
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  UploadCloud, Trash2, Crosshair, Sparkles, RefreshCcw,
  Sliders, ImageDown, MonitorSmartphone, Smartphone, Monitor,
} from 'lucide-react';
import api from '../../lib/api';
import { useT } from '../../contexts/BlueprintContext';
import { toast } from 'sonner';
import './atelier-media-direction.css';

const MEDIA_KINDS = [
  { value: 'hero',                   key: 'kind_hero',     fallback: 'Hero' },
  { value: 'project_card_fallback',  key: 'kind_project',  fallback: 'Project card' },
  { value: 'inspiration',            key: 'kind_inspir',   fallback: 'Inspiration' },
];

const LOCALES = [
  { value: '*',     label: 'All locales' },
  { value: 'it-IT', label: 'Italiano' },
  { value: 'en-US', label: 'English US' },
  { value: 'en-GB', label: 'English UK' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'es-ES', label: 'Español' },
  { value: 'ar',    label: 'العربية' },
];

// Safe-zones the studio cares about (px units → aspect ratios)
const SAFE_ZONES = [
  { id: 'ultrawide', label: 'Ultrawide 21:9',      ratio: 21 / 9,  icon: Monitor },
  { id: 'desktop',   label: 'Desktop 16:9',        ratio: 16 / 9,  icon: MonitorSmartphone },
  { id: 'square',    label: 'Card 1:1',            ratio: 1,       icon: Sparkles },
];

// CSS filter string built from grading metadata
const buildFilter = (m) => {
  if (!m) return 'none';
  const presetMap = {
    nordic_silence:     { brightness: 0.62, saturate: 0.55, contrast: 1.18, hue: -8,  sepia: 0 },
    midnight_editorial: { brightness: 0.48, saturate: 0.42, contrast: 1.32, hue: -14, sepia: 0 },
    aman_warmth:        { brightness: 0.78, saturate: 0.88, contrast: 1.06, hue: 8,   sepia: 0.14 },
    architectural_dawn: { brightness: 0.88, saturate: 0.72, contrast: 1.10, hue: -3,  sepia: 0.06 },
    nordic_cinematic:   { brightness: 0.56, saturate: 0.62, contrast: 1.12, hue: -6,  sepia: 0 },
    warm_hospitality:   { brightness: 0.72, saturate: 0.82, contrast: 1.08, hue: 6,   sepia: 0.12 },
    editorial_neutral:  { brightness: 0.80, saturate: 0.75, contrast: 1.05, hue: 0,   sepia: 0 },
    desaturated_film:   { brightness: 0.65, saturate: 0.35, contrast: 1.15, hue: -10, sepia: 0.10 },
  };
  const base = presetMap[m.grading_profile] || presetMap.nordic_silence;
  const warmth = m.warmth_offset || 0;
  // Warmth adjusts hue rotation slightly (warmer → +ve hue, cooler → -ve)
  const hue = base.hue + warmth * 12;
  const brightness = Math.max(0.2, base.brightness + (warmth * 0.05));
  const saturate = base.saturate * (1 + warmth * 0.3);
  return [
    `brightness(${brightness.toFixed(3)})`,
    `saturate(${saturate.toFixed(3)})`,
    `contrast(${base.contrast.toFixed(3)})`,
    `hue-rotate(${hue.toFixed(1)}deg)`,
    base.sepia ? `sepia(${base.sepia})` : '',
  ].filter(Boolean).join(' ');
};


const AtelierMediaDirection = () => {
  const t = useT();
  const [media, setMedia] = useState([]);
  const [presets, setPresets] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [safeZone, setSafeZone] = useState('desktop');
  const fileInputRef = useRef(null);
  const previewRef = useRef(null);

  // Draft state for the upload composer panel
  const [draft, setDraft] = useState({
    file: null,
    file_preview: '',  // local objectURL
    media_kind: 'hero',
    alt_text: '',
    locale: '*',
    grading_profile: 'nordic_silence',
    focal_point_x: 0.5,
    focal_point_y: 0.5,
    overlay_intensity: 0.45,
    grain_level: 0.08,
    vignette_level: 0.30,
    warmth_offset: 0.0,
    cyan_atmosphere: 0.18,
    sort_order: 0,
  });

  // Load existing media + presets
  const reload = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([
        api.get('/api/atelier/dashboard/media').then(r => r.data.media || []),
        api.get('/api/atelier/media/presets').then(r => r.data.presets || {}),
      ]);
      setMedia(m);
      setPresets(p);
    } catch (e) {
      console.error('Media load failed', e);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // File handling
  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('atelier.media.invalid_file', null, 'Please drop an image file.'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('atelier.media.too_large', null, 'Image exceeds 10 MB.'));
      return;
    }
    if (draft.file_preview) URL.revokeObjectURL(draft.file_preview);
    setDraft(d => ({ ...d, file, file_preview: URL.createObjectURL(file) }));
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    handleFile(f);
  };

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  // Focal point click handler
  const onPreviewClick = (e) => {
    if (!previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setDraft(d => ({ ...d, focal_point_x: x, focal_point_y: y }));
  };

  // Apply preset → updates the auxiliary sliders to match
  const applyPreset = (presetKey) => {
    const p = presets[presetKey];
    if (!p) return setDraft(d => ({ ...d, grading_profile: presetKey }));
    setDraft(d => ({
      ...d,
      grading_profile: presetKey,
      grain_level: p.grain_level ?? d.grain_level,
      vignette_level: p.vignette_level ?? d.vignette_level,
      warmth_offset: p.warmth_offset ?? d.warmth_offset,
      cyan_atmosphere: p.cyan_atmosphere ?? d.cyan_atmosphere,
    }));
  };

  // Upload
  const upload = async () => {
    if (!draft.file) {
      toast.error(t('atelier.media.file_required', null, 'Drop or select an image first.'));
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', draft.file);
      fd.append('media_kind', draft.media_kind);
      fd.append('alt_text', draft.alt_text || '');
      fd.append('locale', draft.locale);
      fd.append('grading_profile', draft.grading_profile);
      fd.append('focal_point_x', String(draft.focal_point_x));
      fd.append('focal_point_y', String(draft.focal_point_y));
      fd.append('overlay_intensity', String(draft.overlay_intensity));
      fd.append('grain_level', String(draft.grain_level));
      fd.append('vignette_level', String(draft.vignette_level));
      fd.append('warmth_offset', String(draft.warmth_offset));
      fd.append('cyan_atmosphere', String(draft.cyan_atmosphere));
      fd.append('sort_order', String(draft.sort_order));

      const { data } = await api.post('/api/atelier/media/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data?.media) {
        setMedia(m => [...m, data.media]);
        setActiveId(data.media.id);
      }
      // Reset file part of draft, keep grading for chained uploads
      if (draft.file_preview) URL.revokeObjectURL(draft.file_preview);
      setDraft(d => ({ ...d, file: null, file_preview: '', alt_text: '' }));
      toast.success(t('atelier.media.uploaded', null, 'Asset composed into the atelier.'));
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    } finally {
      setUploading(false);
    }
  };

  // Transform an existing asset
  const transformAsset = async (id, patch) => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/api/atelier/media/${id}/transform`, patch);
      setMedia(m => m.map(x => x.id === id ? { ...x, ...(data.media || patch) } : x));
      toast.success(t('atelier.media.updated', null, 'Composition updated.'));
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  // Archive
  const archive = async (id) => {
    if (!window.confirm(t('atelier.media.confirm_archive', null, 'Archive this asset?'))) return;
    try {
      await api.delete(`/api/atelier/media/${id}`);
      setMedia(m => m.filter(x => x.id !== id));
      if (activeId === id) setActiveId(null);
      toast.success(t('atelier.media.archived', null, 'Asset archived.'));
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    }
  };

  const activeAsset = useMemo(
    () => media.find(m => m.id === activeId),
    [media, activeId]
  );

  // Live preview source: either the unsaved draft, or the active stored asset
  const previewSrc = draft.file_preview || activeAsset?.optimized_asset_url || activeAsset?.file_url || '';
  const previewMeta = draft.file_preview ? draft : (activeAsset || draft);
  const previewFilter = buildFilter(previewMeta);
  const focalPos = `${(previewMeta.focal_point_x ?? 0.5) * 100}% ${(previewMeta.focal_point_y ?? 0.5) * 100}%`;

  const currentZone = SAFE_ZONES.find(z => z.id === safeZone) || SAFE_ZONES[1];

  return (
    <section className="amd" data-testid="amd-root">
      <header className="amd__head">
        <p className="amd__eyebrow">{t('atelier.media.eyebrow', null, 'Atelier · Media Direction')}</p>
        <h2 className="amd__title"><em>{t('atelier.media.title', null, 'Compose the atmosphere.')}</em></h2>
        <p className="amd__lede">
          {t('atelier.media.lede', null,
            'Upload, frame and grade the images that breathe through your dashboard. Every asset lives inside the atelier — no external links.')}
        </p>
      </header>

      <div className="amd__grid">
        {/* LEFT — composer (drop zone + live preview) */}
        <div className="amd__composer">
          {!draft.file_preview && !activeAsset && (
            <div
              className={`amd__drop ${dragOver ? 'is-over' : ''}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
              data-testid="amd-dropzone"
              role="button"
              tabIndex={0}
            >
              <UploadCloud size={28} strokeWidth={1.2} className="amd__drop-icon" />
              <p className="amd__drop-title">
                {t('atelier.media.drop_title', null, 'Drop an image · or browse')}
              </p>
              <p className="amd__drop-hint">
                {t('atelier.media.drop_hint', null,
                  'JPG · PNG · WebP — up to 10 MB. We process the asset cinematically and store it inside the atelier.')}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={e => handleFile(e.target.files?.[0])}
                data-testid="amd-file-input"
              />
            </div>
          )}

          {(draft.file_preview || activeAsset) && previewSrc && (
            <div className="amd__preview-wrap">
              <div className="amd__safe-zones">
                {SAFE_ZONES.map(z => {
                  const Icon = z.icon;
                  return (
                    <button
                      key={z.id}
                      className={`amd__zone-chip ${safeZone === z.id ? 'is-active' : ''}`}
                      onClick={() => setSafeZone(z.id)}
                      data-testid={`amd-zone-${z.id}`}
                    >
                      <Icon size={12} strokeWidth={1.4} /> {z.label}
                    </button>
                  );
                })}
                <button
                  className="amd__zone-chip amd__zone-chip--mobile"
                  onClick={() => setSafeZone('mobile')}
                  data-testid="amd-zone-mobile"
                  title={t('atelier.media.mobile_blocker_zone', null,
                    'Mobile blocker safe zone — the still frame shown on phones')}
                >
                  <Smartphone size={12} strokeWidth={1.4} /> Mobile blocker
                </button>
              </div>

              <div
                className="amd__preview"
                ref={previewRef}
                onClick={onPreviewClick}
                style={{ aspectRatio: String(currentZone.ratio) }}
                data-testid="amd-preview"
              >
                <img
                  src={previewSrc}
                  alt={previewMeta.alt_text || ''}
                  className="amd__preview-img"
                  style={{
                    filter: previewFilter,
                    objectPosition: focalPos,
                  }}
                />
                <span
                  className="amd__vignette"
                  style={{ opacity: previewMeta.vignette_level ?? 0 }}
                />
                <span
                  className="amd__grain"
                  style={{ opacity: previewMeta.grain_level ?? 0 }}
                />
                <span
                  className="amd__cyan-wash"
                  style={{ opacity: previewMeta.cyan_atmosphere ?? 0 }}
                />
                <span
                  className="amd__focal"
                  style={{
                    left: `${(previewMeta.focal_point_x ?? 0.5) * 100}%`,
                    top: `${(previewMeta.focal_point_y ?? 0.5) * 100}%`,
                  }}
                  aria-label="Focal point"
                />
              </div>

              <p className="amd__preview-foot">
                <Crosshair size={11} strokeWidth={1.4} />
                {t('atelier.media.focal_hint', null,
                  'Click the canvas to set the focal point — the cinematic anchor of this asset.')}
              </p>

              {draft.file_preview && (
                <button
                  className="amd__reset"
                  onClick={() => {
                    URL.revokeObjectURL(draft.file_preview);
                    setDraft(d => ({ ...d, file: null, file_preview: '' }));
                  }}
                  data-testid="amd-reset-draft"
                >
                  <RefreshCcw size={11} strokeWidth={1.6} />
                  {t('atelier.media.reset', null, 'Pick another image')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — controls */}
        <div className="amd__controls">
          {/* Grading presets */}
          <div className="amd__section">
            <p className="amd__section-eyebrow">
              <Sparkles size={11} strokeWidth={1.4} />
              {t('atelier.media.presets_label', null, 'Grading register')}
            </p>
            <div className="amd__presets">
              {Object.entries(presets).map(([key, p]) => (
                <button
                  key={key}
                  className={`amd__preset ${previewMeta.grading_profile === key ? 'is-active' : ''}`}
                  onClick={() => {
                    if (draft.file_preview) applyPreset(key);
                    else if (activeAsset) transformAsset(activeAsset.id, {
                      grading_profile: key,
                      grain_level: p.grain_level,
                      vignette_level: p.vignette_level,
                      warmth_offset: p.warmth_offset,
                      cyan_atmosphere: p.cyan_atmosphere,
                    });
                  }}
                  data-testid={`amd-preset-${key}`}
                  disabled={busy}
                >
                  <span className="amd__preset-label">{p.label}</span>
                  <span className="amd__preset-summary">{p.summary}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Manual sliders */}
          <div className="amd__section">
            <p className="amd__section-eyebrow">
              <Sliders size={11} strokeWidth={1.4} />
              {t('atelier.media.manual_label', null, 'Manual fine-tuning')}
            </p>

            {[
              { k: 'grain_level',     l: t('atelier.media.grain', null, 'Grain'),     min: 0,   max: 1,   step: 0.01 },
              { k: 'vignette_level',  l: t('atelier.media.vignette', null, 'Vignette'),min: 0,   max: 1,   step: 0.01 },
              { k: 'warmth_offset',   l: t('atelier.media.warmth', null, 'Warmth'),   min: -0.5,max: 0.5, step: 0.01 },
              { k: 'cyan_atmosphere', l: t('atelier.media.cyan', null, 'Cyan atmosphere'), min: 0, max: 1, step: 0.01 },
              { k: 'overlay_intensity', l: t('atelier.media.overlay', null, 'Overlay intensity'), min: 0, max: 1, step: 0.01 },
            ].map(({ k, l, min, max, step }) => (
              <div key={k} className="amd__slider">
                <div className="amd__slider-head">
                  <label>{l}</label>
                  <span>{(previewMeta[k] ?? 0).toFixed(2)}</span>
                </div>
                <input
                  type="range" min={min} max={max} step={step}
                  value={previewMeta[k] ?? 0}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (draft.file_preview) setDraft(d => ({ ...d, [k]: v }));
                    else if (activeAsset) {
                      setMedia(m => m.map(x => x.id === activeAsset.id ? { ...x, [k]: v } : x));
                    }
                  }}
                  onMouseUp={() => {
                    if (activeAsset && !draft.file_preview) {
                      transformAsset(activeAsset.id, { [k]: previewMeta[k] });
                    }
                  }}
                  data-testid={`amd-slider-${k}`}
                />
              </div>
            ))}
          </div>

          {/* Metadata + actions */}
          <div className="amd__section">
            <p className="amd__section-eyebrow">
              <ImageDown size={11} strokeWidth={1.4} />
              {t('atelier.media.metadata_label', null, 'Asset metadata')}
            </p>

            <div className="amd__metafield">
              <label>{t('atelier.media.alt_text', null, 'Alt text')}</label>
              <input
                value={draft.file_preview ? draft.alt_text : (activeAsset?.alt_text || '')}
                onChange={(e) => {
                  if (draft.file_preview) setDraft(d => ({ ...d, alt_text: e.target.value }));
                  else if (activeAsset) setMedia(m => m.map(x => x.id === activeAsset.id ? { ...x, alt_text: e.target.value } : x));
                }}
                onBlur={() => {
                  if (activeAsset && !draft.file_preview) {
                    transformAsset(activeAsset.id, { alt_text: activeAsset.alt_text || '' });
                  }
                }}
                placeholder={t('atelier.media.alt_placeholder', null, 'Architectural luxury interior · atmospheric warmth')}
                data-testid="amd-alt-text"
              />
            </div>

            <div className="amd__metarow">
              <div className="amd__metafield">
                <label>{t('atelier.media.kind', null, 'Role')}</label>
                <select
                  value={draft.file_preview ? draft.media_kind : (activeAsset?.media_kind || 'hero')}
                  onChange={(e) => {
                    if (draft.file_preview) setDraft(d => ({ ...d, media_kind: e.target.value }));
                    else if (activeAsset) transformAsset(activeAsset.id, { media_kind: e.target.value });
                  }}
                  data-testid="amd-kind"
                >
                  {MEDIA_KINDS.map(o => (
                    <option key={o.value} value={o.value}>
                      {t(`atelier.media.${o.key}`, null, o.fallback)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="amd__metafield">
                <label>{t('atelier.media.locale_label', null, 'Locale')}</label>
                <select
                  value={draft.file_preview ? draft.locale : (activeAsset?.locale || '*')}
                  onChange={(e) => {
                    if (draft.file_preview) setDraft(d => ({ ...d, locale: e.target.value }));
                    else if (activeAsset) transformAsset(activeAsset.id, { locale: e.target.value });
                  }}
                  data-testid="amd-locale"
                >
                  {LOCALES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {draft.file_preview && (
              <button
                className="amd__publish"
                onClick={upload}
                disabled={uploading}
                data-testid="amd-publish"
              >
                <UploadCloud size={14} strokeWidth={1.6} />
                {uploading
                  ? t('atelier.media.publishing', null, 'Composing into atelier…')
                  : t('atelier.media.publish', null, 'Publish into the atelier')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* GALLERY — existing assets */}
      <div className="amd__gallery">
        <p className="amd__gallery-eyebrow">
          {t('atelier.media.gallery_label', null, 'Atelier media bank')}
          <span className="amd__count">{media.length} / 20</span>
        </p>
        {media.length === 0 ? (
          <p className="amd__gallery-empty">
            {t('atelier.media.gallery_empty', null, 'No assets composed yet. Drop your first image above.')}
          </p>
        ) : (
          <ul className="amd__tiles" data-testid="amd-tiles">
            {media.map(m => (
              <li
                key={m.id}
                className={`amd__tile ${activeId === m.id ? 'is-active' : ''}`}
                data-testid={`amd-tile-${m.id}`}
              >
                <button
                  className="amd__tile-img"
                  onClick={() => setActiveId(m.id)}
                  style={{
                    backgroundImage: `url(${m.thumbnail_asset_url || m.optimized_asset_url || m.file_url})`,
                    backgroundPosition: `${(m.focal_point_x ?? 0.5) * 100}% ${(m.focal_point_y ?? 0.5) * 100}%`,
                    filter: buildFilter(m),
                  }}
                  aria-label={m.alt_text || m.media_kind}
                />
                <div className="amd__tile-meta">
                  <p className="amd__tile-kind">{m.media_kind} · {m.locale}</p>
                  <p className="amd__tile-grading">{m.grading_profile}</p>
                </div>
                <button
                  className="amd__tile-archive"
                  onClick={(e) => { e.stopPropagation(); archive(m.id); }}
                  data-testid={`amd-archive-${m.id}`}
                  aria-label="Archive"
                >
                  <Trash2 size={11} strokeWidth={1.6} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default AtelierMediaDirection;
