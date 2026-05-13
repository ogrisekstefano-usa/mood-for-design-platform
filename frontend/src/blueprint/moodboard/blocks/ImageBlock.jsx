import React from 'react';

const ImageBlock = ({ block, readOnly, t }) => {
  const { src, caption } = block.content || {};
  const style = block.style || {};
  const fit = style.fit_mode || 'cover';
  const focal = style.focal_point || 'center';   // shorthand or "x% y%"
  const zoom = Number(style.zoom) || 1;
  const objectPosition = focal === 'center' ? 'center'
    : focal === 'top' ? 'center top'
    : focal === 'bottom' ? 'center bottom'
    : focal === 'left' ? 'left center'
    : focal === 'right' ? 'right center'
    : focal; // custom "30% 40%"
  return (
    <div className="w-full h-full overflow-hidden rounded-[var(--bp-radius-sm)] bg-[var(--bp-surface-2)] relative group">
      {src ? (
        <img src={src} alt={caption || ''}
             className="w-full h-full bp-img-cinematic transition-transform duration-300"
             style={{
               objectFit: fit,
               objectPosition,
               transform: `scale(${zoom})`,
               transformOrigin: objectPosition,
             }} />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[var(--bp-text-subtle)] bp-caption px-3 text-center">
          {readOnly ? '—' : (t ? t('moodboards.block.image.placeholder') : '')}
        </div>
      )}
      {caption && <div className="absolute bottom-0 inset-x-0 p-2 bp-caption text-white bg-gradient-to-t from-black/70">{caption}</div>}
    </div>
  );
};
export default ImageBlock;
