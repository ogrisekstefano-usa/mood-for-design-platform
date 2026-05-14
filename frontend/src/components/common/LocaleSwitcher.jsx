/**
 * LocaleSwitcher — dropdown for selecting active platform locale.
 * Reads available locales + active from BlueprintContext.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useBlueprint } from '../../contexts/BlueprintContext';

const LocaleSwitcher = ({ align = 'right' }) => {
  const { locale, setLocale, availableLocales } = useBlueprint();
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = availableLocales.find((l) => l.code === locale) || availableLocales[0];

  return (
    <div className="relative" ref={ref}>
      <button
        data-testid="locale-switcher-btn"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-body text-[#A19D98] hover:text-[#EFEBE4] hover:bg-white/[0.04] rounded-[3px] transition-colors"
      >
        <Globe size={12} strokeWidth={1.5} />
        <span className="uppercase tracking-wide">{current?.code}</span>
        <ChevronDown size={11} strokeWidth={1.5} />
      </button>
      {open && (
        <div
          data-testid="locale-switcher-menu"
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1 w-44 bg-[#141416] border border-white/[0.08] rounded-md shadow-lg py-1 z-[1200] animate-fadeIn`}
        >
          {availableLocales.map((l) => (
            <button
              key={l.code}
              data-testid={`locale-option-${l.code}`}
              onClick={() => { setLocale(l.code); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-body text-[#A19D98] hover:bg-white/[0.04] hover:text-[#EFEBE4] transition-colors"
            >
              <span>{l.native}</span>
              {locale === l.code && <Check size={11} className="text-[var(--bp-primary,#D4AF37)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocaleSwitcher;
