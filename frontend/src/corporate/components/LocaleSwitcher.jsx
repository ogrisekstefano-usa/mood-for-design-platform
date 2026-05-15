import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';

const LocaleSwitcher = () => {
  const { locale, setLocale, locales, localeLabel } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref} data-testid="locale-switcher">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1"
        style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A', background: 'none', border: 'none', cursor: 'pointer' }}
        data-testid="locale-switcher-trigger"
      >
        <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>🌐</span>
        {localeLabel}
        <ChevronDown size={11} style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50"
          style={{ background: '#FFFFFF', border: '1px solid rgba(26,26,26,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', minWidth: '150px' }}
          role="listbox"
          data-testid="locale-dropdown"
        >
          {locales.map(loc => (
            <button
              key={loc.code}
              onClick={() => { setLocale(loc.code); setOpen(false); }}
              className="w-full text-left transition-colors duration-150"
              style={{
                padding: '0.75rem 1rem',
                fontFamily: 'Montserrat, sans-serif',
                fontSize: '0.72rem',
                fontWeight: locale === loc.code ? 600 : 400,
                color: locale === loc.code ? '#00C9B3' : '#1A1A1A',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'block',
              }}
              onMouseEnter={e => { if (locale !== loc.code) e.target.style.background = '#F8F8F8'; }}
              onMouseLeave={e => e.target.style.background = 'none'}
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
