import React, { useEffect, useRef, useState } from 'react';

// Safe Reveal: content is visible by default. We start with `--prep` to hide it,
// but a safety timer + IntersectionObserver guarantees `is-in` flips on quickly.
export const useReveal = (options = {}) => {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  const safetyMs = options.safetyMs ?? 400;

  useEffect(() => {
    if (shown) return undefined;
    let cancelled = false;
    let io;
    const reveal = () => { if (!cancelled) setShown(true); };
    const safety = setTimeout(reveal, safetyMs);

    if (ref.current && typeof IntersectionObserver !== 'undefined') {
      try {
        io = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) { reveal(); io && io.disconnect(); }
          });
        }, { threshold: 0.01 });
        io.observe(ref.current);
      } catch (_) { reveal(); }
    } else {
      reveal();
    }

    return () => {
      cancelled = true;
      clearTimeout(safety);
      if (io) io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  return { ref, shown };
};

export const Reveal = ({ children, delay, className = '', as: As = 'div', ...rest }) => {
  const { ref, shown } = useReveal();
  const delayClass = delay === 2 ? 'mfd-reveal--d2' : delay === 3 ? 'mfd-reveal--d3' : delay === 4 ? 'mfd-reveal--d4' : '';
  return (
    <As
      ref={ref}
      className={`mfd-reveal mfd-reveal--prep ${delayClass} ${shown ? 'is-in' : ''} ${className}`.trim()}
      {...rest}
    >
      {children}
    </As>
  );
};

export const SiteImage = ({ src, alt = '', aspect, className = '', priority = false, filters, focalPoint, style: extraStyle, ...rest }) => {
  const [loaded, setLoaded] = useState(false);
  // Build CSS filter + transform + focal-point styles when present.
  // Kept inline (no new util import) so SiteImage stays a leaf component.
  const filterParts = [];
  let extraTransform = '';
  let objectPosition;
  if (filters) {
    if (filters.brightness != null && filters.brightness !== 1) filterParts.push(`brightness(${filters.brightness})`);
    if (filters.contrast   != null && filters.contrast   !== 1) filterParts.push(`contrast(${filters.contrast})`);
    if (filters.saturation != null && filters.saturation !== 1) filterParts.push(`saturate(${filters.saturation})`);
    if (filters.rotate     != null && filters.rotate     !== 0) extraTransform = `rotate(${filters.rotate}deg)`;
  }
  if (focalPoint && (focalPoint.x != null || focalPoint.y != null)) {
    objectPosition = `${(focalPoint.x ?? 0.5) * 100}% ${(focalPoint.y ?? 0.5) * 100}%`;
  }
  const baseTransform = loaded ? 'scale(1)' : 'scale(1.02)';
  return (
    <div
      className={`${loaded ? '' : 'mfd-img-skeleton'} ${className}`.trim()}
      style={{ aspectRatio: aspect, position: 'relative', overflow: 'hidden' }}
    >
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        style={{
          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          opacity: loaded ? 1 : 0,
          transform: extraTransform ? `${baseTransform} ${extraTransform}` : baseTransform,
          transition: 'opacity 900ms ease, transform 1600ms cubic-bezier(0.2,0.7,0.2,1)',
          ...(filterParts.length ? { filter: filterParts.join(' ') } : {}),
          ...(objectPosition ? { objectPosition } : {}),
          ...extraStyle,
        }}
        {...rest}
      />
    </div>
  );
};
