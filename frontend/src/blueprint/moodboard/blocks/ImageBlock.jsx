import React from 'react';

const ImageBlock = ({ block, readOnly, t }) => {
  const { src, caption } = block.content || {};
  return (
    <div className="w-full h-full overflow-hidden rounded-[var(--bp-radius-sm)] bg-[var(--bp-surface-2)] relative group">
      {src ? (
        <img src={src} alt={caption || ''} className="w-full h-full object-cover bp-img-cinematic" />
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
