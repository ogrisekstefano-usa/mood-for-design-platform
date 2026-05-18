/**
 * EditorialMediaField™
 * ────────────────────────────────────────────────────────────────────
 * Global, intelligent media input. Replaces every raw URL input in the
 * Blueprint admin (logo, hero, gallery, cta, magazine cover, etc.).
 *
 * Foundations:
 *  • Upload locale (Supabase Storage, via /api/storage/*)
 *  • Picker dalla Media Library (via /api/media)
 *  • URL esterno opzionale (con stato esplicito "externally-linked")
 *  • Preset crop responsive (logo / hero / gallery / square / portrait / story / thumb)
 *  • Image Intent enum (editorial atmosphere, product detail, hospitality emotion…)
 *  • Alt text inline (accessibility-first)
 *  • Usage relationships chip ("USATO IN N LUOGHI")
 *  • Visual states espliciti — niente fallback silenzioso
 *
 * Backwards compatible:
 *   <EditorialMediaField value="https://…" onChange={(url) => …} />
 *
 * Forward-compat:
 *   <EditorialMediaField
 *      valueShape="object"
 *      value={{ url, asset_id, alt_text, image_intent, focal_point }}
 *      onChange={(obj) => …}
 *   />
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ImagePlus, RefreshCw, Trash2, Link2, FolderOpen, Loader2, AlertCircle,
  ExternalLink, Library,
} from 'lucide-react';
import { toast } from 'sonner';
import { media, links, uploadMediaFile } from '../../lib/mediaApi';
import AssetPickerModal from '../../pages/settings/AssetPickerModal';
import './editorial-media-field.css';

const IMAGE_INTENTS = [
  { value: '',                       label: '— Nessun intento —' },
  { value: 'editorial_atmosphere',   label: 'Editorial Atmosphere' },
  { value: 'product_detail',         label: 'Product Detail' },
  { value: 'hospitality_emotion',    label: 'Hospitality Emotion' },
  { value: 'material_texture',       label: 'Material Texture' },
  { value: 'lifestyle',              label: 'Lifestyle' },
  { value: 'architectural_wide',     label: 'Architectural Wide' },
  { value: 'human_presence',         label: 'Human Presence' },
  { value: 'seo_cover',              label: 'SEO Cover' },
  { value: 'pinterest_hook',         label: 'Pinterest Hook' },
  { value: 'moodboard_element',      label: 'Moodboard Element' },
  { value: 'storytelling_detail',    label: 'Storytelling Detail' },
];

  // Normalize incoming value: string URL OR {url, asset_id, ...}
const normalize = (raw) => {
  if (!raw) return { url: '', asset_id: null, alt_text: '', caption: '', seo_title: '', image_intent: '', focal_point: null };
  if (typeof raw === 'string') return { url: raw, asset_id: null, alt_text: '', caption: '', seo_title: '', image_intent: '', focal_point: null };
  return {
    url: raw.url || raw.file_url || '',
    asset_id: raw.asset_id || raw.id || null,
    alt_text: raw.alt_text || '',
    caption: raw.caption || '',
    seo_title: raw.seo_title || raw.title || '',
    image_intent: raw.image_intent || '',
    focal_point: raw.focal_point || null,
  };
};

const EditorialMediaField = ({
  // Value contract
  value,
  onChange,
  valueShape = 'url',          // 'url' (default, legacy) | 'object'

  // Visual configuration
  preset = 'gallery',          // logo | hero | gallery | square | portrait | story | thumbnail
  label,
  helperText,
  required = false,

  // Upload destination
  bucket = 'tenant-assets',
  folder = 'editorial',

  // Usage relationship tracking
  entityType,                  // 'branding_asset' | 'cms_section' | 'magazine_article' | …
  entityId,
  role = 'primary',

  // Misc
  testId = 'editorial-media-field',
  disabled = false,
}) => {
  const normalized = useMemo(() => normalize(value), [value]);
  const [state, setState] = useState('idle');     // idle | uploading | ready | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [externalDraft, setExternalDraft] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const [resolvedAsset, setResolvedAsset] = useState(null); // hydrated from asset_id
  const [usageCount, setUsageCount] = useState(null);
  const fileInputRef = useRef(null);

  // ── Hydrate resolved asset for usage relationships
  useEffect(() => {
    let alive = true;
    const id = normalized.asset_id;
    if (!id) { setResolvedAsset(null); setUsageCount(null); return; }
    (async () => {
      try {
        const detail = await media.detail(id);
        if (!alive) return;
        setResolvedAsset(detail.asset);
        setUsageCount((detail.links || []).length);
      } catch {
        if (alive) { setResolvedAsset(null); setUsageCount(null); }
      }
    })();
    return () => { alive = false; };
  }, [normalized.asset_id]);

  // ── Emit value upstream in correct shape
  const emit = useCallback((next) => {
    if (valueShape === 'object') {
      onChange?.(next);
    } else {
      onChange?.(next?.url || '');
    }
  }, [onChange, valueShape]);

  // ── Direct file upload (drag&drop or pick)
  const uploadFile = useCallback(async (file) => {
    if (!file || !file.type?.startsWith('image/')) {
      toast.error('Solo immagini');
      return;
    }
    setState('uploading');
    setProgress(5);
    setError(null);
    try {
      const asset = await uploadMediaFile({
        file,
        bucket,
        folder,
        category: entityType || null,
        onProgress: (p) => setProgress(Math.max(p, 10)),
      });

      // Auto-link to entity for usage tracking
      if (entityType && entityId) {
        try { await links.create(asset.id, { entity_type: entityType, entity_id: entityId, role }); }
        catch (_) { /* non-blocking */ }
      }

      const next = {
        url: asset.file_url,
        asset_id: asset.id,
        alt_text: normalized.alt_text,
        image_intent: normalized.image_intent,
        focal_point: normalized.focal_point,
      };
      emit(next);
      setState('idle');
      setProgress(100);
      toast.success('Immagine caricata');
    } catch (e) {
      setState('error');
      setError(e?.response?.data?.detail || e?.message || 'Upload fallito');
    }
  }, [bucket, folder, entityType, entityId, role, normalized.alt_text, normalized.image_intent, normalized.focal_point, emit]);

  // ── Picker (library) callback
  const handlePicked = useCallback(async ({ asset }) => {
    if (!asset) return;
    const next = {
      url: asset.display_url || asset.file_url,
      asset_id: asset.id,
      alt_text: asset.alt_text || normalized.alt_text,
      image_intent: normalized.image_intent,
      focal_point: asset.focal_point || normalized.focal_point,
    };
    emit(next);
    setPickerOpen(false);
    toast.success('Asset collegato dalla Library');
  }, [emit, normalized.alt_text, normalized.image_intent, normalized.focal_point]);

  // ── Patch metadata only (alt / image_intent / caption / seo_title) — without changing the asset
  const patchMeta = useCallback((patch) => {
    const next = { ...normalized, ...patch };
    emit(next);
    // Also persist to media_library if we have an asset_id
    if (normalized.asset_id) {
      const payload = {};
      if ('alt_text' in patch) payload.alt_text = patch.alt_text;
      if ('caption' in patch) payload.description = patch.caption;
      if ('seo_title' in patch) payload.title = patch.seo_title;
      if ('focal_point' in patch) payload.focal_point = patch.focal_point;
      // image_intent goes into category for now (denormalized into media_library)
      if ('image_intent' in patch) payload.category = patch.image_intent || null;
      if (Object.keys(payload).length) {
        media.update(normalized.asset_id, payload).catch(() => {});
      }
    }
  }, [normalized, emit]);

  // ── Clear value
  const clear = useCallback(() => {
    if (!confirm('Rimuovere questa immagine dal campo?')) return;
    emit({ url: '', asset_id: null, alt_text: '', image_intent: '', focal_point: null });
  }, [emit]);

  // ── Accept external URL fallback
  const acceptExternal = () => {
    const u = externalUrl.trim();
    if (!u) return;
    emit({ url: u, asset_id: null, alt_text: '', image_intent: '', focal_point: null });
    setExternalDraft(false);
    setExternalUrl('');
  };

  // ── Drop handlers
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) uploadFile(f);
  };

  // ── Derived state
  const hasValue = !!normalized.url;
  const isLibrary = !!normalized.asset_id;
  const isExternal = hasValue && !isLibrary;
  const surfaceState = state === 'uploading' ? 'uploading'
    : state === 'error' ? 'error'
    : hasValue ? 'ready' : 'empty';

  const statusLabel = ({
    empty:    ['Vuoto',    'empty'],
    uploading:['Caricamento', 'upload'],
    ready:    isLibrary
      ? (usageCount > 1 ? [`Usato in ${usageCount}`, 'multi'] : ['Library',  'library'])
      : ['URL esterno', 'ext'],
    error:    ['Errore',   'error'],
  })[surfaceState];

  return (
    <div className="emf-field" data-testid={testId}>
      {/* Header */}
      {(label || statusLabel) && (
        <div className="emf-field__header">
          {label && (
            <p className="emf-field__label">
              {label}
              {required && <span className="emf-field__required">*</span>}
            </p>
          )}
          {statusLabel && (
            <span
              className={`emf-field__status emf-field__status--${statusLabel[1]}`}
              data-testid={`${testId}-status`}
            >
              {statusLabel[0]}
            </span>
          )}
        </div>
      )}

      {/* Surface */}
      <div
        data-preset={preset}
        data-testid={`${testId}-surface`}
        className={`emf-surface emf-surface--${surfaceState} ${dragOver ? 'emf-surface--dragover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={(e) => {
          if (disabled) return;
          // Only trigger picker when clicking empty surface (not on actions)
          if (surfaceState === 'empty' && e.target.closest('.emf-empty')) {
            setPickerOpen(true);
          }
        }}
      >
        {/* Image preview */}
        {hasValue && state !== 'uploading' && (
          <img
            src={normalized.url}
            alt={normalized.alt_text || ''}
            className={`emf-image ${preset === 'logo' ? 'emf-image--logo' : ''}`}
            style={normalized.focal_point ? {
              objectPosition: `${(normalized.focal_point.x || 0.5) * 100}% ${(normalized.focal_point.y || 0.5) * 100}%`,
            } : undefined}
            onError={() => setError('Immagine non disponibile')}
          />
        )}

        {/* Meta strip (filename + chip) */}
        {hasValue && state !== 'uploading' && (
          <div className="emf-meta">
            <span className="emf-meta__name">
              {resolvedAsset?.file_name || (normalized.url || '').split('/').pop()?.slice(0, 40) || '—'}
            </span>
            {isLibrary && (
              <span className="emf-meta__chip">
                <Library size={9} style={{ display: 'inline', marginRight: 4 }} />
                LIBRARY
              </span>
            )}
            {isExternal && (
              <span className="emf-meta__chip">
                <ExternalLink size={9} style={{ display: 'inline', marginRight: 4 }} />
                EXTERNAL
              </span>
            )}
          </div>
        )}

        {/* Empty state */}
        {surfaceState === 'empty' && (
          <div className="emf-empty">
            <span className="emf-empty__icon"><ImagePlus size={18} strokeWidth={1.5} /></span>
            <p className="emf-empty__title">+ Aggiungi media</p>
            <p className="emf-empty__sub">Trascina · sfoglia · scegli dalla Library</p>
          </div>
        )}

        {/* Uploading state */}
        {state === 'uploading' && (
          <div className="emf-uploading">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--bp-primary)' }} />
            <div className="emf-uploading__bar"><span style={{ width: `${progress}%` }} /></div>
            <span className="emf-uploading__pct">{progress}%</span>
          </div>
        )}

        {/* Action overlay */}
        {hasValue && state !== 'uploading' && !disabled && (
          <div className="emf-actions">
            <button
              type="button"
              className="emf-action"
              title="Sostituisci dalla Library"
              data-testid={`${testId}-replace-library`}
              onClick={(e) => { e.stopPropagation(); setPickerOpen(true); }}
            >
              <FolderOpen size={13} strokeWidth={1.6} />
            </button>
            <button
              type="button"
              className="emf-action"
              title="Carica nuovo file"
              data-testid={`${testId}-upload`}
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              <RefreshCw size={13} strokeWidth={1.6} />
            </button>
            <button
              type="button"
              className="emf-action emf-action--danger"
              title="Rimuovi"
              data-testid={`${testId}-remove`}
              onClick={(e) => { e.stopPropagation(); clear(); }}
            >
              <Trash2 size={13} strokeWidth={1.6} />
            </button>
          </div>
        )}

        {/* Hidden upload input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
            e.target.value = '';
          }}
          data-testid={`${testId}-file-input`}
        />
      </div>

      {/* Empty state explicit action buttons (below surface) */}
      {surfaceState === 'empty' && !disabled && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            data-testid={`${testId}-cta-library`}
            onClick={() => setPickerOpen(true)}
            className="emf-input"
            style={{ cursor: 'pointer', textAlign: 'center', flex: '1 1 auto' }}
          >
            <Library size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: '-1px' }} />
            Scegli dalla Library
          </button>
          <button
            type="button"
            data-testid={`${testId}-cta-upload`}
            onClick={() => fileInputRef.current?.click()}
            className="emf-input"
            style={{ cursor: 'pointer', textAlign: 'center', flex: '1 1 auto' }}
          >
            <ImagePlus size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: '-1px' }} />
            Carica file
          </button>
          {!externalDraft ? (
            <button
              type="button"
              data-testid={`${testId}-cta-external`}
              onClick={() => setExternalDraft(true)}
              className="emf-input"
              style={{ cursor: 'pointer', textAlign: 'center', flex: '0 0 auto', color: 'var(--bp-text-muted)' }}
            >
              <Link2 size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: '-1px' }} />
              URL esterno
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6, flex: '1 1 100%' }}>
              <input
                autoFocus
                type="url"
                placeholder="https://…"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') acceptExternal(); if (e.key === 'Escape') setExternalDraft(false); }}
                className="emf-input"
                data-testid={`${testId}-external-input`}
              />
              <button
                type="button"
                onClick={acceptExternal}
                className="emf-input"
                style={{ cursor: 'pointer', flex: '0 0 auto', width: 80, background: 'var(--bp-primary)', color: '#000' }}
                data-testid={`${testId}-external-accept`}
              >
                Conferma
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="emf-error">
          <AlertCircle size={11} strokeWidth={2} /> {error}
        </p>
      )}

      {/* Helper text */}
      {helperText && <p className="emf-helper">{helperText}</p>}

      {/* Metadata footer — alt + image_intent + caption + seo_title */}
      {hasValue && state !== 'uploading' && (
        <>
          <div className="emf-footer">
            <div className="emf-footer__col">
              <label className="emf-footer__label">Alt text · Accessibilità</label>
              <input
                type="text"
                value={normalized.alt_text}
                onChange={(e) => patchMeta({ alt_text: e.target.value })}
                placeholder="Descrizione concisa per screen reader"
                className="emf-input"
                data-testid={`${testId}-alt`}
              />
            </div>
            <div className="emf-footer__col">
              <label className="emf-footer__label">Image Intent</label>
              <select
                value={normalized.image_intent}
                onChange={(e) => patchMeta({ image_intent: e.target.value })}
                className="emf-select"
                data-testid={`${testId}-intent`}
              >
                {IMAGE_INTENTS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="emf-footer__col">
              <label className="emf-footer__label">Caption (opzionale)</label>
              <input
                type="text"
                value={normalized.caption}
                onChange={(e) => patchMeta({ caption: e.target.value })}
                placeholder="Didascalia visibile sotto l'immagine"
                className="emf-input"
                data-testid={`${testId}-caption`}
              />
            </div>
            <div className="emf-footer__col">
              <label className="emf-footer__label">SEO title (opzionale)</label>
              <input
                type="text"
                value={normalized.seo_title}
                onChange={(e) => patchMeta({ seo_title: e.target.value })}
                placeholder="Titolo immagine per ricerca"
                className="emf-input"
                data-testid={`${testId}-seo-title`}
              />
            </div>
          </div>

          {/* Usage relationships chip */}
          {usageCount !== null && (
            <div className="emf-usage" data-testid={`${testId}-usage`}>
              <span className="emf-usage__lead">Usato in</span>
              {usageCount === 0 ? (
                <span className="emf-usage__chip" style={{ color: 'var(--bp-text-faint)' }}>
                  Nessun altro luogo · asset orfano
                </span>
              ) : (
                <span className="emf-usage__chip">
                  {usageCount} {usageCount === 1 ? 'luogo' : 'luoghi'}
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* Picker modal */}
      {pickerOpen && (
        <AssetPickerModal
          open
          onClose={() => setPickerOpen(false)}
          onSelect={handlePicked}
          entityType={entityType}
          entityId={entityId}
          role={role}
          bucket={bucket}
          folder={folder}
          title="Scegli o carica un'immagine"
          eyebrow="EDITORIAL MEDIA"
          defaultTab="library"
        />
      )}
    </div>
  );
};

export default EditorialMediaField;
