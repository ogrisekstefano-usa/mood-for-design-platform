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
  const norm = (locale || 'it').toLowerCase();
  const candidates = [
    locale,
    norm,
    norm === 'it' ? 'it-IT' : null,
    norm === 'en' ? 'en-US' : null,
    norm === 'en' ? 'en-GB' : null,
    norm === 'fr' ? 'fr-FR' : null,
    norm === 'de' ? 'de-DE' : null,
    norm === 'es' ? 'es-ES' : null,
    'it-IT', '_default', 'en-US', 'en', 'it',
  ].filter(Boolean);
  for (const k of candidates) if (obj[k]) return obj[k];
  return Object.values(obj)[0] || '';
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
  const i18nLocale = locale === 'en' ? 'en-US' : (locale === 'it' ? 'it-IT' : locale);

  const tenantSlug = useMemo(() => resolveTenantSlug(), []);
  const cmsHome = useStorefrontContent(tenantSlug, 'home');
  const cmsNav  = useStorefrontContent(tenantSlug, 'navigation');

  // ────────────────────────────────────────────────────────────────────
  // ITER171.3 · Single source of truth for footer columns.
  //
  // 1. Navigation column (mirrors the top nav so users always see the
  //    same site map at top and bottom). Reads from
  //    `navigation.nav_top.settings.links`. Editing the nav in CMS
  //    updates the footer automatically.
  //
  // 2. Editorial columns (Azienda · Risorse · Seguici) come from the
  //    `home.editorial_footer` section. Admin can edit them inside
  //    Command Center → Pagine → Home → "EDITORIAL_FOOTER".
  // ────────────────────────────────────────────────────────────────────
  const cols = useMemo(() => {
    const out = [];

    // 1 · Navigation mirror column
    const navSection = cmsNav?.content?.nav_top
                    || cmsNav?.content?.navigation_main
                    || cmsNav?.content?.main_links;
    const navLinks = navSection?._settings?.links || navSection?.settings?.links || [];
    if (Array.isArray(navLinks) && navLinks.length) {
      const navCol = {
        title: { it: 'Navigazione', en: 'Navigation' },
        links: navLinks
          .filter((l) => l.visible !== false)
          .map((l) => ({
            href:  l.href,
            label: l.label_i18n || l.label || {},
          })),
      };
      if (navCol.links.length) out.push(navCol);
    }

    // 2 · Editorial cols from home.editorial_footer
    const footerBag = resolveBag(cmsHome?.content?.editorial_footer, i18nLocale);
    const editorialCols = Array.isArray(footerBag.cols) ? footerBag.cols : [];
    for (const c of editorialCols) {
      out.push({
        title: c.title,
        links: Array.isArray(c.links) ? c.links : [],
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cmsNav?.content?.nav_top || cmsNav?.content?.navigation_main),
      JSON.stringify(cmsHome?.content?.editorial_footer),
      i18nLocale]);

  const colophon = SHELL_COLOPHON;

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
