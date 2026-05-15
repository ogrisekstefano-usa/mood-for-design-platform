import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';

/**
 * LocaleSwitcher — Dropdown for locale switching.
 * Integrated in CorporateNav.
 */
const LocaleSwitcher = () => {
  const { locale, setLocale, locales, localeLabel } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref} data-testid="locale-switcher">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#0A0A0A] hover:text-[#3DDAD0] transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="locale-switcher-trigger"
      >
        {localeLabel}
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 bg-[#F9F9F8] border border-[rgba(10,10,10,0.12)] shadow-lg z-50 min-w-[140px]"
          role="listbox"
          data-testid="locale-dropdown"
        >
          {locales.map(loc => (
            <button
              key={loc.code}
              onClick={() => { setLocale(loc.code); setOpen(false); }}
              className={`w-full text-left px-4 py-3 text-xs font-medium transition-colors hover:bg-[#3DDAD0] hover:text-[#0A0A0A] ${locale === loc.code ? 'text-[#3DDAD0]' : 'text-[#0A0A0A]'}`}
              role="option"
              aria-selected={locale === loc.code}
              data-testid={`locale-option-${loc.code}`}
            >
              {loc.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocaleSwitcher;
