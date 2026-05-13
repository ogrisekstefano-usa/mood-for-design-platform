import React from 'react';

const NoteBlock = ({ block }) => {
  const { text } = block.content || {};
  return (
    <div className="w-full h-full p-4 bg-[#FFF8DC]/95 text-[#3A2E1A] rounded-[var(--bp-radius-sm)] font-body text-sm whitespace-pre-wrap leading-relaxed shadow-[var(--bp-shadow-md)]">
      {text || 'Note…'}
    </div>
  );
};
export default NoteBlock;
