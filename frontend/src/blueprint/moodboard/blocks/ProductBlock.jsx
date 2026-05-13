import React from 'react';

const ProductBlock = ({ block, t }) => {
  const { name, vendor, price, image } = block.content || {};
  return (
    <div className="w-full h-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] overflow-hidden flex flex-col">
      <div className="flex-1 bg-[var(--bp-surface-2)] overflow-hidden">
        {image ? <img src={image} alt={name} className="w-full h-full object-cover bp-img-cinematic" />
                : <div className="w-full h-full flex items-center justify-center text-[var(--bp-text-subtle)] bp-caption">{t ? t('moodboards.block.product.placeholder') : ''}</div>}
      </div>
      <div className="p-3">
        {vendor && <p className="bp-eyebrow !text-[var(--bp-text-muted)]">{vendor}</p>}
        <p className="bp-body !text-sm text-[var(--bp-text-primary)] mt-1">{name || (t ? t('moodboards.block.product') : '')}</p>
        {price && <p className="bp-caption text-[var(--bp-primary)] mt-1">{price}</p>}
      </div>
    </div>
  );
};
export default ProductBlock;
