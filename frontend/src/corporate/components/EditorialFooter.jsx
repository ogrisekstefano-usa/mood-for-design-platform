import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';
import { useSiteFooter } from '../hooks/useSiteChrome';
import { useLocale } from '../../contexts/LocaleContext';

const SOCIAL_ICONS = { instagram: Instagram, linkedin: Linkedin, twitter: Twitter, youtube: Youtube, pinterest: Instagram };

const LOGO_URL = "https://customer-assets.emergentagent.com/job_editorial-platform-4/artifacts/chlucgqo_Artboard%201.png";

const GROUP_KEYS = ['magazine', 'projects', 'materials', 'company'];

const ColumnList = ({ heading, items, testid }) => (
  <div data-testid={testid}>
    {heading && (
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          fontSize: '0.92rem',
          color: 'var(--mood-text-1)',
          marginBottom: '1.1rem',
        }}
      >
        {heading}
      </p>
    )}
    <ul className="space-y-3">
      {items.map((L, i) => (
        <li key={L.key || i}>
          <Link
            to={L.href}
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.88rem',
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

const EditorialFooter = () => {
  const { manifesto, copyright, links = [], legal = [], social = [] } = useSiteFooter();
  const { locale, locales, setLocale } = useLocale();

  // Group footer links by `group` setting
  const groups = {};
  links.forEach((L) => {
    const g = L.group || 'magazine';
    (groups[g] = groups[g] || []).push(L);
  });
  const legalHeading = legal.find((L) => L.isHeading)?.label || 'Legal';
  const legalItems   = legal.filter((L) => !L.isHeading);

  return (
    <footer
      style={{
        background: 'var(--mood-black)',
        color: 'var(--mood-text-1)',
        borderTop: '1px solid var(--mood-line-soft)',
      }}
      data-testid="editorial-footer"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16 pt-16 pb-8">
        {/* TOP ROW: brand block (4 cols) | 5 link columns (8 cols → 1.6 each) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-10">
          {/* Brand block */}
          <div className="lg:col-span-4">
            <Link to="/" style={{ display: 'inline-block' }}>
              <img src={LOGO_URL} alt="MOOD for DESIGN" style={{ height: 48, width: 'auto' }} draggable={false} />
            </Link>
            {manifesto && (
              <p
                style={{
                  marginTop: '1.4rem',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.95rem',
                  lineHeight: 1.55,
                  color: 'var(--mood-text-2)',
                  maxWidth: '36ch',
                }}
                data-testid="footer-manifesto"
              >
                {manifesto}
              </p>
            )}
            {social.length > 0 && (
              <div className="mt-6 flex items-center gap-5">
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

          {/* 5 link columns: lives in 8 cols, each takes 8/5 = 1.6 cols */}
          <div className="lg:col-span-8 grid footer-link-grid gap-8">
            {GROUP_KEYS.map((gk) => {
              const items = groups[gk] || [];
              if (!items.length) return null;
              const heading = items.find((L) => L.isHeading)?.label || gk;
              const visibleItems = items.filter((L) => !L.isHeading);
              return (
                <ColumnList key={gk} heading={heading} items={visibleItems} testid={`footer-col-${gk}`} />
              );
            })}
            <ColumnList heading={legalHeading} items={legalItems} testid="footer-col-legal" />
          </div>
        </div>

        {/* BOTTOM ROW: copyright + language + tagline */}
        <div
          className="mt-14 pt-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
          style={{ borderTop: '1px solid var(--mood-line-soft)' }}
        >
          {copyright && (
            <p
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--mood-text-3)' }}
              data-testid="footer-copyright"
            >
              {copyright}
            </p>
          )}
          <div className="flex items-center gap-5">
            {locales.length > 0 && (
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: 'var(--mood-text-1)',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.88rem',
                  padding: '0.5rem 0.85rem',
                  borderRadius: 4,
                  cursor: 'pointer',
                  minWidth: 150,
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
      </div>
    </footer>
  );
};

export default EditorialFooter;
