/**
 * MoodSiteFooter — Editorial 4-col + Colophon footer.
 *
 * Single source of truth: this is the SAME footer used on the public
 * homepage. Replaces the legacy `SiteFooter` on all inner pages so the
 * site has consistent chrome end-to-end. CMS-driven via the
 * `editorial_footer` section of the `home` storefront page (the one
 * already maintained by the studio admin).
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  [MOOD logo]   col 1   col 2   col 3   col 4                 │
 *   │                                                              │
 *   │  © 2026 MOOD for DESIGN™      …powered by MOOD…   Blueprint  │
 *   └──────────────────────────────────────────────────────────────┘
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStorefrontContent } from '../useStorefrontContent';
import { useSite } from '../SiteContext';
import { MOOD_BRAND_LOGO_URL, MOOD_BRAND_ALT } from '../content/brandAssets';

// Resolve the tenant slug from the host — keeps the footer DB-driven
// without forcing every page to thread the slug as a prop.
const resolveTenantSlug = () => {
  if (typeof window === 'undefined') return 'studio';
  const host = (window.location.hostname || '').toLowerCase();
  const first = host.split('.')[0] || '';
  const PLATFORM = ['studio', 'blueprint', 'www', 'localhost'];
  if (first.startsWith('content-hub-pro-')) return 'studio';
  if (PLATFORM.some((h) => first === h || first.startsWith(h))) return 'studio';
  return first || 'studio';
};

const L = (obj, locale) => {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[locale] || obj.en || obj.it || Object.values(obj)[0] || '';
};

const resolveBag = (bag, locale) => {
  if (!bag || typeof bag !== 'object') return {};
  const norm = (locale || 'it').toLowerCase();
  if (norm.startsWith('en')) return { ...(bag._default || {}), ...(bag['en-US'] || bag.en || {}) };
  if (norm.startsWith('it')) return { ...(bag._default || {}), ...(bag.it || {}) };
  if (norm.startsWith('fr')) return { ...(bag._default || {}), ...(bag.fr || {}) };
  if (norm.startsWith('de')) return { ...(bag._default || {}), ...(bag.de || {}) };
  if (norm.startsWith('es')) return { ...(bag._default || {}), ...(bag.es || {}) };
  return { ...(bag._default || {}) };
};

const SHELL_COLOPHON = {
  enabled: true,
  left:   { it: '© 2026 MOOD for DESIGN™', en: '© 2026 MOOD for DESIGN™' },
  center: {
    it: { prefix: 'Questo servizio è fornito da ', link_label: 'MOOD for DESIGN', suffix: '' },
    en: { prefix: 'This service is provided by ',  link_label: 'MOOD for DESIGN', suffix: '' },
  },
  center_link_href: 'https://www.moodfordesign.com',
  right: {
    it: 'Running on Blueprint OS™ · Editorial Infrastructure for Design Studios',
    en: 'Running on Blueprint OS™ · Editorial Infrastructure for Design Studios',
  },
};

const FooterColophon = ({ locale, colophon }) => {
  const c = colophon;
  if (!c || c.enabled === false) return null;
  const center = (c.center && (c.center[locale] || c.center.en || c.center.it)) || null;
  const linkHref = c.center_link_href || 'https://www.moodfordesign.com';
  return (
    <div className="mfd-colophon" role="contentinfo" data-testid="footer-colophon">
      <div className="mfd-colophon__inner">
        <p className="mfd-colophon__col mfd-colophon__col--left" data-testid="colophon-left">
          {L(c.left, locale)}
        </p>
        <p className="mfd-colophon__col mfd-colophon__col--center" data-testid="colophon-center">
          {center ? (
            <>
              <span>{center.prefix}</span>
              <a
                href={linkHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mfd-colophon__link"
                data-testid="colophon-center-link"
              >
                {center.link_label}
              </a>
              {center.suffix ? <span>{center.suffix}</span> : null}
            </>
          ) : null}
        </p>
        <p className="mfd-colophon__col mfd-colophon__col--right" data-testid="colophon-right">
          {L(c.right, locale)}
        </p>
      </div>
    </div>
  );
};

const MoodSiteFooter = () => {
  const site = useSite();
  const locale = (site?.locale || 'it').slice(0, 2);

  const tenantSlug = useMemo(() => resolveTenantSlug(), []);
  const cms = useStorefrontContent(tenantSlug, 'home');

  const { cols, colophon } = useMemo(() => {
    const footerBag = resolveBag(cms?.content?.editorial_footer,
                                 locale === 'en' ? 'en-US' : locale);
    return {
      cols: Array.isArray(footerBag.cols) ? footerBag.cols : [],
      colophon: SHELL_COLOPHON,  // colophon is static brand chrome
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cms?.content?.editorial_footer), locale]);

  return (
    <footer id="footer" className="mfd-footer" data-testid="site-footer">
      <div className="mfd-footer__inner">
        <div className="mfd-footer__top">
          <div className="mfd-footer__brand">
            <img
              src={MOOD_BRAND_LOGO_URL}
              alt={MOOD_BRAND_ALT}
              className="mfd-footer__brand-img"
              draggable={false}
              data-testid="site-footer-brand-img"
            />
          </div>
          {cols.length > 0 && (
            <div className="mfd-footer__cols">
              {cols.map((col, ci) => (
                <div key={ci} className="mfd-footer__col">
                  <h4 className="mfd-footer__col-title">{L(col.title, locale)}</h4>
                  <ul>
                    {(col.links || []).map((l, li) => (
                      <li key={li}>
                        {l.href?.startsWith('http')
                          ? <a href={l.href} target="_blank" rel="noopener noreferrer">{L(l.label, locale)}</a>
                          : <Link to={l.href || '#'}>{L(l.label, locale)}</Link>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <FooterColophon locale={locale} colophon={colophon} />
    </footer>
  );
};

export default MoodSiteFooter;
