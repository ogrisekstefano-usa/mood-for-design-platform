import React from 'react';

const Brand = ({ size = 'md' }) => {
  const sizes = {
    sm: { logo: 'w-6 h-6', main: 'text-[10px]', sub: 'text-[8px]' },
    md: { logo: 'w-8 h-8', main: 'text-sm', sub: 'text-[10px]' },
  };
  const s = sizes[size] || sizes.md;
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${s.logo} bg-[var(--bp-primary,#D4AF37)] rounded-[3px] flex items-center justify-center flex-shrink-0`}>
        <span className="text-[#0A0A0B] font-bold font-body text-sm">M</span>
      </div>
      <div className="min-w-0">
        <p className={`text-[#EFEBE4] ${s.main} font-semibold font-body tracking-[0.1em] uppercase leading-tight`}>
          MOOD for Design
        </p>
        <p className={`text-[#4A4845] ${s.sub} font-body tracking-[0.2em] uppercase`}>Blueprint OS™</p>
      </div>
    </div>
  );
};

export default Brand;
