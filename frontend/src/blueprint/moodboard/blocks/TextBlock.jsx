import React from 'react';

const TextBlock = ({ block, t }) => {
  const { text, size } = block.content || {};
  const cls = { display: 'bp-display', h1: 'bp-h1', h2: 'bp-h2', h3: 'bp-h3', body: 'bp-body', caption: 'bp-caption', eyebrow: 'bp-eyebrow' }[size] || 'bp-h3';
  return (
    <div className="w-full h-full p-3 flex items-center">
      <span className={`${cls} text-[var(--bp-text-primary)]`}>
        {text || (t ? t('moodboards.block.text.placeholder') : '')}
      </span>
    </div>
  );
};
export default TextBlock;
