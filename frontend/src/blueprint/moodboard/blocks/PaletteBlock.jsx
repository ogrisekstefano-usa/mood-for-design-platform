import React from 'react';

const PaletteBlock = ({ block }) => {
  const colors = block.content?.colors || [];
  return (
    <div className="w-full h-full flex rounded-[var(--bp-radius-sm)] overflow-hidden">
      {colors.map((c, i) => (
        <div key={i} className="flex-1 relative group" style={{ backgroundColor: c }}>
          <span className="absolute inset-x-0 bottom-1 text-center text-[10px] font-mono text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">{c}</span>
        </div>
      ))}
    </div>
  );
};
export default PaletteBlock;
