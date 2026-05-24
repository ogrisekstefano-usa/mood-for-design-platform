import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';
import { useSiteFooter } from '../hooks/useSiteChrome';
import { useLocale } from '../../contexts/LocaleContext';

const SOCIAL_ICONS = { instagram: Instagram, linkedin: Linkedin, twitter: Twitter, youtube: Youtube, pinterest: Instagram };

const LOGO_URL = "https://customer-assets.emergentagent.com/job_editorial-platform-4/artifacts/chlucgqo_Artboard%201.png";

/**
 * EditorialFooter — 5-column footer per ITER149 mockup:
 *   Magazine · Progetti · Materiali · Azienda · Legale
 * Plus brand block (left) with logo + manifesto + social.
 * Language selector on the right side of the bottom bar.
 */
const EditorialFooter = () => {
  const { manifesto, copyright, links = [], legal = [], social = [] } = useSiteFooter();
  const { locale, locales, setLocale } = useLocale();

  // Group footer links by `group` setting; fall back to columns inferred from key prefix.
  const groups = {};
  links.forEach((L) => {
    const g = L.group || 'magazine';
    (groups[g] = groups[g] || []).push(L);
  });
  const GROUP_KEYS = ['magazine', 'projects', 'materials', 'company'];

  return (
    <footer
      style={{
        background: 'var(--mood-ink-1)',
        color: 'var(--mood-text-1)',
        borderTop: '1px solid var(--mood-line-soft)',
      }}
      data-testid="editorial-footer"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16 pt-20 pb-12">
        {/* Top row: brand block (manifesto + logo + social) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 pb-14 mb-14" style={{ borderBottom: '1px solid var(--mood-line-soft)' }}>
          <div className="lg:col-span-5">
            <Link to="/" style={{ display: 'inline-block' }}>
              <img src={LOGO_URL} alt="MOOD for DESIGN" style={{ height: 56, width: 'auto' }} draggable={false} />
            </Link>
            {manifesto && (
              <p
                style={{
                  marginTop: '1.5rem',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '1.05rem',
                  lineHeight: 1.55,
                  color: 'var(--mood-text-2)',
                  maxWidth: '44ch',
                }}
                data-testid="footer-manifesto"
              >
                {manifesto}
              </p>
            )}
          </div>
          <div className="lg:col-span-7 flex items-end lg:justify-end">
            {social.length > 0 && (
              <div className="flex items-center gap-5">
                {social.map((s, i) => {
                  const Icon = SOCIAL_ICONS[s.icon] || Instagram;
                  return (
                    <a
                      key={s.key || i}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--mood-text-3)', transition: 'color 0.2s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mood-teal)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mood-text-3)')}
                      data-testid={`footer-social-${s.key}`}
                    >
                      <Icon size={20} strokeWidth={1.4} />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Link columns: 5 columns at lg breakpoint */}
        <div className="grid gap-10 lg:gap-8 footer-link-grid">
          {GROUP_KEYS.map((gk) => {
            const items = groups[gk] || [];
            if (!items.length) return null;
            const heading = items.find((L) => L.isHeading);
            const visibleItems = items.filter((L) => !L.isHeading);
            return (
              <div key={gk} data-testid={`footer-col-${gk}`}>
                {heading && (
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      color: 'var(--mood-text-1)',
                      marginBottom: '1.25rem',
                    }}
                  >
                    {heading.label}
                  </p>
                )}
                <ul className="space-y-3">
                  {visibleItems.map((L, i) => (
                    <li key={L.key || i}>
                      <Link
                        to={L.href}
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '0.92rem',
                          color: 'var(--mood-text-2)',
                          textDecoration: 'none',
                          transition: 'color 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mood-teal)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mood-text-2)')}
                        data-testid={`footer-link-${L.key}`}
                      >
                        {L.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {/* Legal column */}
          {legal.length > 0 && (
            <div data-testid="footer-col-legal">
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  color: 'var(--mood-text-1)',
                  marginBottom: '1.25rem',
                }}
              >
                {legal.find((L) => L.isHeading)?.label || 'Legal'}
              </p>
              <ul className="space-y-3">
                {legal.filter((L) => !L.isHeading).map((L, i) => (
                  <li key={L.key || i}>
                    <a
                      href={L.href}
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '0.92rem',
                        color: 'var(--mood-text-2)',
                        textDecoration: 'none',
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mood-teal)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mood-text-2)')}
                      data-testid={`footer-legal-${L.key}`}
                    >
                      {L.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Bottom bar: copyright + language dropdown */}
        <div
          className="mt-16 pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          style={{ borderTop: '1px solid var(--mood-line-soft)' }}
        >
          {copyright && (
            <p
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: 'var(--mood-text-3)' }}
              data-testid="footer-copyright"
            >
              {copyright}
            </p>
          )}
          {locales.length > 0 && (
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.18)',
                color: 'var(--mood-text-1)',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.92rem',
                padding: '0.55rem 0.9rem',
                borderRadius: 4,
                cursor: 'pointer',
                minWidth: 180,
              }}
              data-testid="footer-language-select"
            >
              {locales.map((l) => (
                <option key={l.code} value={l.code} style={{ background: 'var(--mood-ink-1)' }}>
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
