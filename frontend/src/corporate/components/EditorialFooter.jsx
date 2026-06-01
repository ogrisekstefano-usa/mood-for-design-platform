import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Linkedin, Twitter, Youtube, Facebook } from 'lucide-react';
import { useSiteFooter } from '../hooks/useSiteChrome';
import { MoodLogo } from './CorporateNav';
import MarketTrigger from './MarketTrigger';

const SOCIAL_ICONS = {
  instagram: Instagram, linkedin: Linkedin, twitter: Twitter, x: Twitter,
  youtube: Youtube, facebook: Facebook, pinterest: Instagram,
};

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
 * EditorialFooter — gateway to MOOD markets.
 *
 * Architecture:
 *   • Columns: Brand / Esplora / Legale / Market trigger
 *   • Market trigger opens <MarketSelectorModal /> populated entirely from
 *     /api/markets + /api/site/locales (no hardcoded country/locale arrays).
 *   • Footer link copy from /api/site/footer (CMS-driven).
 */
const EditorialFooter = () => {
  const { links = [], legal = [], social = [] } = useSiteFooter();

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-16">
          {/* Brand column */}
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

          {/* Esplora */}
          <ColumnList heading={navHeading}   items={navItems}   testid="footer-col-nav" />

          {/* Legale */}
          <ColumnList heading={legalHeading} items={legalItems} testid="footer-col-legal" />

          {/* Market gateway */}
          <div data-testid="footer-col-market">
            <p style={HEADING_STYLE}>Mercato</p>
            <MarketTrigger />
            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.78rem',
              color: 'var(--mood-text-3)', marginTop: '0.9rem', lineHeight: 1.5,
            }}>
              Scegli il mercato di riferimento per definire lingua, valuta e
              advisor del tuo studio.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default EditorialFooter;
