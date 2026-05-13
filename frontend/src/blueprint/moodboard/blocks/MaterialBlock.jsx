import React from 'react';

const MaterialBlock = ({ block, t }) => {
  const { name, finish, swatch } = block.content || {};
  return (
    <div className="w-full h-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] overflow-hidden flex flex-col">
      <div className="flex-1" style={swatch ? { backgroundImage: `url(${swatch})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: 'linear-gradient(135deg, var(--bp-surface-2), var(--bp-surface-3))' }} />
      <div className="p-3 border-t border-[var(--bp-border)]">
        <p className="bp-body !text-sm text-[var(--bp-text-primary)]">{name || (t ? t('moodboards.block.material') : '')}</p>
        {finish && <p className="bp-caption text-[var(--bp-text-muted)] mt-0.5">{finish}</p>}
      </div>
    </div>
  );
};
export default MaterialBlock;
