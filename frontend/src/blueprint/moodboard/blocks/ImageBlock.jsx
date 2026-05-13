/**
 * ImageBlock — Phase E.5 polish.
 *
 *  - Loading skeleton with shimmer
 *  - Fade-in transition once loaded
 *  - Elegant error fallback (broken-link state)
 *  - Premium "missing asset" placeholder when src is empty
 *  - CSS-filter-based image adjustments persisted in style.adjustments
 *      brightness · contrast · saturation · warmth · blur · grayscale · vignette
 */
import React, { useEffect, useRef, useState } from 'react';
import { ImageOff, ImagePlus } from 'lucide-react';
import api from '../../../lib/api';

const buildFilter = (a = {}) => {
  const parts = [];
  if (a.brightness !== undefined && a.brightness !== 1) parts.push(`brightness(${a.brightness})`);
  if (a.contrast   !== undefined && a.contrast   !== 1) parts.push(`contrast(${a.contrast})`);
  if (a.saturation !== undefined && a.saturation !== 1) parts.push(`saturate(${a.saturation})`);
  // 'warmth' is folded into sepia: warm → sepia(>0), cool → hue-rotate
  if (a.warmth) {
    if (a.warmth > 0) parts.push(`sepia(${Math.min(1, a.warmth)})`);
    else              parts.push(`hue-rotate(${(a.warmth * -30).toFixed(0)}deg)`);
  }
  if (a.blur)       parts.push(`blur(${a.blur}px)`);
  if (a.grayscale)  parts.push(`grayscale(${Math.min(1, a.grayscale)})`);
  return parts.length ? parts.join(' ') : 'none';
};

const SHADOW_MAP = {
  soft:     '0 4px 12px rgba(0,0,0,0.18)',
  medium:   '0 8px 24px rgba(0,0,0,0.30)',
  dramatic: '0 16px 48px rgba(0,0,0,0.45)',
};

const ImageBlock = ({ block, readOnly, t }) => {
  const { src, caption } = block.content || {};
  const style = block.style || {};
  const fit = style.fit_mode || 'cover';
  const focal = style.focal_point || 'center';
  const zoom = Number(style.zoom) || 1;
  const adj = style.adjustments || {};
  const borderRadius = style.border_radius !== undefined ? style.border_radius : 4;
  const shadowPreset = style.shadow_preset || 'none';
  const objectPosition = focal === 'center' ? 'center'
    : focal === 'top' ? 'center top'
    : focal === 'bottom' ? 'center bottom'
    : focal === 'left' ? 'left center'
    : focal === 'right' ? 'right center'
    : focal; // custom "x% y%"

  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  // Defensive: if the public URL fails (private bucket, expired cache,
  // network blip), fall back ONCE to a backend-issued signed URL derived
  // from the upload's storage_path in metadata. Avoids the broken-link UX
  // while leaving stored coordinates / src untouched.
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const fallbackAttempted = useRef(false);

  // Reset state when src changes
  useEffect(() => {
    setLoaded(false);
    setErrored(false);
    setResolvedSrc(src);
    fallbackAttempted.current = false;
  }, [src]);

  const handleImgError = async () => {
    if (fallbackAttempted.current) { setErrored(true); return; }
    fallbackAttempted.current = true;
    const storagePath = block.metadata?.storage_path;
    if (!storagePath) { setErrored(true); return; }
    try {
      const r = await api.get('/api/storage/signed-download', {
        params: { bucket: 'moodboard-assets', path: storagePath },
      });
      const signed = r.data?.url;
      if (signed) { setResolvedSrc(signed); setErrored(false); }
      else setErrored(true);
    } catch (_) { setErrored(true); }
  };

  return (
    <div className="w-full h-full overflow-hidden bg-[var(--bp-surface-2)] relative group"
         style={{
           borderRadius: `${borderRadius}px`,
           boxShadow: SHADOW_MAP[shadowPreset] || 'none',
         }}>
      {/* Empty / placeholder state */}
      {!src && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[var(--bp-text-subtle)] bp-caption px-3 text-center"
             data-testid="image-block-empty">
          <ImagePlus size={22} strokeWidth={0.8} />
          {block.metadata?.placeholder?.label ? (
            <div className="space-y-1">
              <p className="bp-eyebrow !text-[9px] !text-[var(--bp-text-muted)]">
                {block.metadata.placeholder.required ? '★ ' : ''}{block.metadata.placeholder.label}
              </p>
              <p className="text-[10px] text-[var(--bp-text-subtle)]">
                {readOnly ? '—' : (t ? t('moodboards.placeholder.replaceImage') : 'Replace with image')}
              </p>
            </div>
          ) : (
            <span>{readOnly ? '—' : (t ? t('moodboards.block.image.placeholder') : '')}</span>
          )}
        </div>
      )}

      {/* Loading skeleton (visible until <img onLoad>) */}
      {src && !loaded && !errored && (
        <div className="absolute inset-0 overflow-hidden bg-[var(--bp-surface-2)]"
             data-testid="image-block-skeleton">
          <div className="absolute inset-0 animate-[shimmer_1.6s_ease-in-out_infinite]"
               style={{
                 background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
                 backgroundSize: '200% 100%',
               }} />
        </div>
      )}

      {/* Error state */}
      {src && errored && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[var(--bp-text-subtle)] bp-caption"
             data-testid="image-block-error">
          <ImageOff size={20} strokeWidth={0.8} />
          <span className="text-[10px]">{t ? t('moodboards.editor.imageMissing') : ''}</span>
        </div>
      )}

      {/* Actual image — kept mounted under skeleton so onLoad still fires */}
      {src && (
        <img
          src={resolvedSrc || src}
          alt={caption || ''}
          onLoad={() => setLoaded(true)}
          onError={handleImgError}
          className="w-full h-full bp-img-cinematic"
          data-testid="image-block-img"
          style={{
            objectFit: fit,
            objectPosition,
            transform: `scale(${zoom})`,
            transformOrigin: objectPosition,
            filter: buildFilter(adj),
            opacity: loaded && !errored ? 1 : 0,
            transition: 'opacity 480ms cubic-bezier(0.22, 0.61, 0.36, 1), filter 220ms ease',
          }}
        />
      )}

      {/* Soft vignette (optional adjustment) */}
      {src && loaded && !errored && adj.vignette > 0 && (
        <div className="absolute inset-0 pointer-events-none"
             style={{
               background: `radial-gradient(ellipse at center, transparent ${Math.max(40, 70 - adj.vignette * 30)}%, rgba(0,0,0,${(adj.vignette * 0.6).toFixed(2)}) 100%)`,
             }} />
      )}

      {caption && loaded && (
        <div className="absolute bottom-0 inset-x-0 p-2 bp-caption text-white bg-gradient-to-t from-black/70">
          {caption}
        </div>
      )}
    </div>
  );
};

export default ImageBlock;
