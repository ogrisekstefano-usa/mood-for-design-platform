import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Instagram, Linkedin, Twitter, Youtube, Facebook, Globe, ChevronDown, Check } from 'lucide-react';
import { useSiteFooter } from '../hooks/useSiteChrome';
import { useLocale } from '../../contexts/LocaleContext';
import { LOCALIZED_SLUGS, slugToCanonical } from '../routes/localizedSlugs';
import { MoodLogo } from './CorporateNav';

const SOCIAL_ICONS = {
  instagram: Instagram, linkedin: Linkedin, twitter: Twitter, x: Twitter,
  youtube: Youtube, facebook: Facebook, pinterest: Instagram,
};

/**
 * Apple-style country/language options. `code` matches LocaleContext locale codes.
 */
const COUNTRY_OPTIONS = [
  { code: 'it',    country: 'Italia',         language: 'Italiano' },
  { code: 'en-us', country: 'United States',  language: 'English'  },
  { code: 'en-uk', country: 'United Kingdom', language: 'English'  },
  { code: 'fr',    country: 'France',         language: 'Français' },
  { code: 'de',    country: 'Deutschland',    language: 'Deutsch'  },
  { code: 'es',    country: 'España',         language: 'Español'  },
];

const HEADING_STYLE = {
  fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: '0.78rem',
  letterSpacing: '0.18em', textTransform: 'uppercase',
  color: 'var(--mood-text-2)', marginBottom: '1.4rem',
};

const LINK_STYLE = {
  fontFamily: 'Inter, sans-serif', fontSize: '0.9rem',
  color: 'var(--mood-text-2)', textDecoration: 'none',
  transition: 'color 0.2s',
};

const ColumnList = ({ heading, items, testid }) => (
  <div data-testid={testid}>
    {heading && <p style={HEADING_STYLE}>{heading}</p>}
    <ul className="space-y-3" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {items.map((L, i) => {
        const external = L.target === '_blank' || /^https?:\/\//i.test(L.href || '');
        return (
          <li key={L.key || i}>
            <a
              href={L.href || '#'}
              target={L.target === '_blank' ? '_blank' : undefined}
              rel={L.target === '_blank' ? 'noopener noreferrer' : undefined}
              style={LINK_STYLE}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mood-teal)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mood-text-2)')}
              data-testid={`footer-link-${L.key || i}`}
            >
              {L.label}
              {external && L.target === '_blank' && (
                <span aria-hidden="true" style={{ marginLeft: 6, opacity: 0.4, fontSize: '0.72em' }}>↗</span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  </div>
);

/**
 * CountryLanguagePicker — Apple-style pill that opens upward, listing every
 * supported locale. Entirely CMS-aware via the `locales` prop.
 */
const CountryLanguagePicker = ({ locale, locales, onSelect }) => {
  const [open, setOpen] = useState(false);
  const current = COUNTRY_OPTIONS.find((o) => o.code === locale) || COUNTRY_OPTIONS[0];

  const enabledCodes = new Set((locales || []).map((l) => l.code));
  const visible = COUNTRY_OPTIONS.filter((o) => enabledCodes.size === 0 || enabledCodes.has(o.code));

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} data-testid="country-lang-picker">
      <button
        onClick={() => setOpen((s) => !s)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.7rem',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'var(--mood-text-1)',
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.86rem', fontWeight: 400, letterSpacing: '0.04em',
          padding: '0.85rem 1.4rem', borderRadius: 9999,
          cursor: 'pointer', transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--mood-teal)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
        aria-expanded={open}
        data-testid="country-lang-toggle"
      >
        <Globe size={14} strokeWidth={1.4} color="var(--mood-teal)" />
        <span style={{ fontWeight: 500 }}>{current.country}</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>—</span>
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{current.language}</span>
        <ChevronDown size={14} strokeWidth={1.6} style={{ marginLeft: 4, opacity: 0.5,
          transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
          <ul
            role="listbox"
            style={{
              position: 'absolute', bottom: 'calc(100% + 0.5rem)', left: 0,
              minWidth: 280, padding: '0.4rem 0',
              background: 'rgba(18,18,18,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)',
              listStyle: 'none', margin: 0, zIndex: 60,
              boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
            }}
            data-testid="country-lang-menu"
          >
            {visible.map((opt) => {
              const isCurrent = opt.code === locale;
              return (
                <li key={opt.code}>
                  <button
                    onClick={() => { onSelect(opt.code); setOpen(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 12,
                      padding: '0.75rem 1.1rem',
                      background: isCurrent ? 'rgba(0,201,179,0.08)' : 'transparent',
                      border: 'none',
                      fontFamily: 'Inter, sans-serif', fontSize: '0.86rem',
                      color: '#FFF', cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                    data-testid={`country-lang-${opt.code}`}
                  >
                    <span>
                      <span style={{ fontWeight: 500 }}>{opt.country}</span>
                      <span style={{ color: 'rgba(255,255,255,0.45)', marginLeft: 8 }}>{opt.language}</span>
                    </span>
                    {isCurrent && <Check size={14} color="var(--mood-teal)" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};

const EditorialFooter = () => {
  const { links = [], legal = [], social = [] } = useSiteFooter();
  const { locale, locales, setLocale } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();

  const onLocaleSelect = (newLocale) => {
    setLocale(newLocale);
    try { localStorage.setItem('mood_pref_locale', newLocale); } catch {}
    const canonical = slugToCanonical(location.pathname);
    if (canonical) {
      const target = LOCALIZED_SLUGS[canonical]?.[newLocale];
      if (target && target !== location.pathname) navigate(target);
    }
  };

  const navHeading   = links.find((L) => L.isHeading)?.label || 'Esplora';
  const navItems     = links.filter((L) => !L.isHeading);
  const legalHeading = legal.find((L) => L.isHeading)?.label || 'Legale';
  const legalItems   = legal.filter((L) => !L.isHeading);

  return (
    <footer
      style={{
        background: 'rgba(18,18,18,0.92)',
        color: 'var(--mood-text-1)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
      data-testid="editorial-footer"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16 pt-16 pb-12">
        {/* 4-column grid: Brand+Socials | Esplora | Legale | Language */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-16">
          {/* Brand column — logo + social icons stacked underneath */}
          <div data-testid="footer-col-brand">
            <Link to="/" style={{ display: 'inline-block', marginBottom: '1.6rem', textDecoration: 'none' }}
                  data-testid="footer-logo-link">
              <MoodLogo compact />
            </Link>
            {social.length > 0 && (
              <div className="flex items-center gap-5" data-testid="footer-socials">
                {social.map((s, i) => {
                  const Icon = SOCIAL_ICONS[s.icon] || Instagram;
                  if (!s.href) return null;
                  return (
                    <a
                      key={s.key || i} href={s.href} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--mood-text-3)', transition: 'color 0.2s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mood-teal)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mood-text-3)')}
                      aria-label={s.label || s.icon}
                      data-testid={`footer-social-${s.key || s.icon}`}
                    >
                      <Icon size={18} strokeWidth={1.4} />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Column 1: Esplora */}
          <ColumnList heading={navHeading}   items={navItems}   testid="footer-col-nav" />

          {/* Column 2: Legale */}
          <ColumnList heading={legalHeading} items={legalItems} testid="footer-col-legal" />

          {/* Column 3: Language picker — temporarily hidden until EN/FR/DE/ES
              receive editorial-grade translations (not the original seed).
              Re-enable once the bulk-translate review is complete. */}
          {false && (
            <div data-testid="footer-col-locale">
              <p style={HEADING_STYLE}>Lingua &amp; Paese</p>
              <CountryLanguagePicker locale={locale} locales={locales} onSelect={onLocaleSelect} />
            </div>
          )}
        </div>
      </div>
    </footer>
  );
};

export default EditorialFooter;
