import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Globe } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { LOCALIZED_SLUGS, slugToCanonical } from '../routes/localizedSlugs';

/**
 * LocaleSwitcher — when the user changes locale on a localized page
 * (e.g. /dedicato-a in IT), it navigates to the equivalent localized path
 * for the new locale (e.g. /audience in EN). Falls back to current path.
 */
const LocaleSwitcher = ({ dark = true }) => {
  const { locale, setLocale, locales, localeLabel } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const triggerColor = dark ? 'rgba(255,255,255,0.82)' : '#000000';
  const menuBg       = dark ? 'rgba(10,19,32,0.95)' : '#FFFFFF';
  const menuBorder   = dark ? 'rgba(255,255,255,0.08)' : 'rgba(10,19,32,0.08)';
  const itemColor    = dark ? '#FFFFFF' : '#000000';

  const onSelectLocale = (newLocale) => {
    setLocale(newLocale);
    setOpen(false);

    // Smart route translation: if current path is a localized slug,
    // navigate to the equivalent slug in the target locale.
    const canonical = slugToCanonical(location.pathname);
    if (canonical) {
      const targetPath = LOCALIZED_SLUGS[canonical]?.[newLocale];
      if (targetPath && targetPath !== location.pathname) {
        navigate(targetPath, { replace: false });
      }
    }
  };

  return (
    <div className="relative" ref={ref} data-testid="locale-switcher">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5"
        style={{
          fontFamily: 'Montserrat, sans-serif',
          fontSize: '0.7rem',
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: triggerColor,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
        data-testid="locale-switcher-trigger"
      >
        <Globe size={13} strokeWidth={1.5} />
        {localeLabel}
        <ChevronDown size={11} style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-3 z-50 rounded-lg overflow-hidden"
          style={{
            background: menuBg,
            backdropFilter: 'blur(18px)',
            border: `1px solid ${menuBorder}`,
            boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
            minWidth: '170px',
          }}
          role="listbox"
          data-testid="locale-dropdown"
        >
          {locales.map(loc => (
            <button
              key={loc.code}
              onClick={() => onSelectLocale(loc.code)}
              className="w-full text-left transition-colors duration-150"
              style={{
                padding: '0.7rem 1rem',
                fontFamily: 'Montserrat, sans-serif',
                fontSize: '0.74rem',
                fontWeight: locale === loc.code ? 600 : 400,
                color: locale === loc.code ? '#00C9B3' : itemColor,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'block',
              }}
              onMouseEnter={e => { if (locale !== loc.code) e.target.style.background = dark ? 'rgba(255,255,255,0.05)' : 'rgba(10,19,32,0.04)'; }}
              onMouseLeave={e => (e.target.style.background = 'none')}
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
