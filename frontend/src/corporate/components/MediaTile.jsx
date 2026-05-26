import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { linkTarget } from '../utils/linkTarget';

/**
 * Lightbox — fullscreen image overlay, click outside or ESC to close.
 */
const Lightbox = ({ src, alt, onClose }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="media-lightbox"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.94)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '4vh 4vw',
        cursor: 'zoom-out',
      }}
    >
      <button
        onClick={onClose}
        aria-label="Chiudi"
        style={{
          position: 'absolute', top: 24, right: 24,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#FFF', borderRadius: 999, width: 40, height: 40,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <X size={18} strokeWidth={1.6} />
      </button>
      <img
        src={src}
        alt={alt || ''}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '100%', maxHeight: '92vh',
          objectFit: 'contain', display: 'block',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          cursor: 'default',
        }}
      />
    </div>
  );
};

/**
 * MediaTile — renders a media item (img) with a CMS-configurable click action:
 *  - action = 'none'     → static image
 *  - action = 'link'     → wraps with <a href={href}> (with optional target/_blank)
 *  - action = 'lightbox' → opens a fullscreen lightbox
 *
 * Props:
 *  - media: { url, alt, dominant_color }  (resolved by site_resolver)
 *  - action: { action: 'none'|'link'|'lightbox', href?: string, target?: '_blank'|'_self' }
 *  - imgStyle / wrapperStyle: optional style overrides
 *  - className: optional wrapper class
 *  - children: optional overlay nodes rendered on top of the image
 *  - testid: optional data-testid value
 */
const MediaTile = ({
  media, action,
  imgStyle, wrapperStyle, className,
  children, testid,
}) => {
  const [openLB, setOpenLB] = useState(false);
  if (!media || !media.url) return null;

  const baseStyle = {
    width: '100%', height: '100%', objectFit: 'cover',
    display: 'block', ...(imgStyle || {}),
  };
  const wrap = {
    position: 'relative', overflow: 'hidden',
    background: media.dominant_color || '#0F1828',
    ...(wrapperStyle || {}),
  };

  const img = (
    <img src={media.url} alt={media.alt || ''} loading="lazy" style={baseStyle} />
  );

  const actType = action?.action || 'none';

  if (actType === 'link' && action.href) {
    return (
      <a
        href={action.href}
        {...linkTarget(action.target)}
        className={className}
        style={{ ...wrap, cursor: 'pointer', textDecoration: 'none', display: 'block' }}
        data-testid={testid}
      >
        {img}
        {children}
      </a>
    );
  }

  if (actType === 'lightbox') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpenLB(true)}
          className={className}
          style={{
            ...wrap, cursor: 'zoom-in', border: 'none', padding: 0,
            width: '100%', textAlign: 'left',
          }}
          data-testid={testid}
          aria-label="Ingrandisci immagine"
        >
          {img}
          {children}
        </button>
        {openLB && <Lightbox src={media.url} alt={media.alt} onClose={() => setOpenLB(false)} />}
      </>
    );
  }

  // 'none' — static image
  return (
    <div className={className} style={wrap} data-testid={testid}>
      {img}
      {children}
    </div>
  );
};

export default MediaTile;
