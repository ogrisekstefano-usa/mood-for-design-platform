import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Instagram, Linkedin, Twitter, Youtube, Facebook } from 'lucide-react';
import { useSiteFooter } from '../hooks/useSiteChrome';
import { useLocale } from '../../contexts/LocaleContext';
import { LOCALIZED_SLUGS, slugToCanonical } from '../routes/localizedSlugs';

const SOCIAL_ICONS = {
  instagram: Instagram, linkedin: Linkedin, twitter: Twitter, x: Twitter,
  youtube: Youtube, facebook: Facebook, pinterest: Instagram,
};

const LOGO_URL = "https://customer-assets.emergentagent.com/job_editorial-platform-4/artifacts/chlucgqo_Artboard%201.png";

const ColumnList = ({ heading, items, testid }) => (
  <div data-testid={testid}>
    {heading && (
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontSize: '0.78rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--mood-text-2)',
          marginBottom: '1.4rem',
        }}
      >
        {heading}
      </p>
    )}
    <ul className="space-y-3" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {items.map((L, i) => (
        <li key={L.key || i}>
          <Link
            to={L.href || '#'}
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.9rem',
              color: 'var(--mood-text-2)',
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mood-teal)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mood-text-2)')}
            data-testid={`footer-link-${L.key || i}`}
          >
            {L.label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

const EditorialFooter = () => {
  const { copyright, links = [], legal = [], social = [] } = useSiteFooter();
  const { locale, locales, setLocale } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();

  const onLocaleSelect = (newLocale) => {
    setLocale(newLocale);
    const canonical = slugToCanonical(location.pathname);
    if (canonical) {
      const target = LOCALIZED_SLUGS[canonical]?.[newLocale];
      if (target && target !== location.pathname) navigate(target);
    }
  };

  // Snellito: ONE configurable column (anything not flagged isHeading/legal)
  // + the legal column. Everything else from CMS is collapsed into the
  // single "navigate" column so the footer reads as a compact bottom menu.
  const navHeading = links.find((L) => L.isHeading)?.label || 'Esplora';
  const navItems   = links.filter((L) => !L.isHeading);
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
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16 pt-14 pb-8">
        {/* TOP: brand left + 2 link columns right */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr] gap-12 lg:gap-16">
          {/* Brand block */}
          <div>
            <Link to="/" style={{ display: 'inline-block' }}>
              <img src={LOGO_URL} alt="MOOD for DESIGN" style={{ height: 44, width: 'auto' }} draggable={false} />
            </Link>
            {social.length > 0 && (
              <div className="mt-7 flex items-center gap-5">
                {social.map((s, i) => {
                  const Icon = SOCIAL_ICONS[s.icon] || Instagram;
                  if (!s.href) return null;
                  return (
                    <a
                      key={s.key || i}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
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

          {/* Navigation column */}
          {navItems.length > 0 && (
            <ColumnList heading={navHeading} items={navItems} testid="footer-col-nav" />
          )}

          {/* Legal column */}
          {legalItems.length > 0 && (
            <ColumnList heading={legalHeading} items={legalItems} testid="footer-col-legal" />
          )}
        </div>

        {/* BOTTOM ROW: copyright + language */}
        <div
          className="mt-12 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          {copyright && (
            <p
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--mood-text-3)' }}
              data-testid="footer-copyright"
            >
              {copyright}
            </p>
          )}
          {locales.length > 0 && (
            <select
              value={locale}
              onChange={(e) => onLocaleSelect(e.target.value)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.18)',
                color: 'var(--mood-text-1)',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.84rem',
                padding: '0.5rem 0.85rem',
                borderRadius: 2,
                cursor: 'pointer',
                minWidth: 150,
              }}
              data-testid="footer-language-select"
            >
              {locales.map((l) => (
                <option key={l.code} value={l.code} style={{ background: '#0a0a0a' }}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </footer>
  );
};

export default EditorialFooter;
