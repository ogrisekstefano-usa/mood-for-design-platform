/**
 * MoodSiteHeader — reusable public site header for the cream/editorial layout.
 * CMS-driven: reads nav labels, CTA and login from the `navigation` CMS page.
 * Falls back silently to empty strings when CMS is not loaded yet.
 * White-label compliant — ZERO hardcoded nav text.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { MOOD_BRAND_LOGO_URL, MOOD_BRAND_ALT } from '../content/brandAssets';
import { useSite } from '../SiteContext';
import { useStorefrontContent } from '../useStorefrontContent';

// Resolve tenant slug from host (used for the CMS storefront fetch).
const resolveTenantSlug = () => {
  if (typeof window === 'undefined') return 'studio';
  const host = (window.location.hostname || '').toLowerCase();
  const first = host.split('.')[0] || '';
  const PLATFORM = ['studio', 'blueprint', 'www', 'localhost'];
  if (first.startsWith('content-hub-pro-')) return 'studio';
  if (host.includes('.preview.emergentagent.com')) return 'studio';
  if (PLATFORM.some((h) => first === h || first.startsWith(h))) return 'studio';
  return first || 'studio';
};

// Localized copy resolver for {en-US, it-IT, _default} format
const Ln = (obj, locale) => {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  const norm = (locale || 'it').toLowerCase();
  const itKey = norm.startsWith('it') ? 'it-IT' : null;
  const enKey = norm.startsWith('en') ? 'en-US' : null;
  return (itKey && obj[itKey]) || (enKey && obj[enKey]) ||
    obj['_default'] || obj['en-US'] || obj['it-IT'] ||
    Object.values(obj)[0] || '';
};

// Legacy resolver for {it, en} format from `copy` prop (backward compat with HomePage)
const L = (v, l) => (typeof v === 'string' ? v : (v?.[l] || v?.en || v?.it || ''));

/**
 * Hook: reads nav data from CMS `navigation` page nav_top section.
 * Returns { links: Map<id, {label, href}>, cta: {label, href}, login: {label, href} }
 */
const useCmsNav = (tenantSlug, locale) => {
  const cmsNav = useStorefrontContent(tenantSlug, 'navigation');
  return useMemo(() => {
    const navTop = cmsNav?.content?.nav_top || cmsNav?.content?.navigation_main;
    if (!navTop) return null;
    const settings = navTop._settings || navTop.settings || {};
    if (!settings) return null;
    const links = {};
    (settings.links || []).filter((l) => l.visible !== false).forEach((l) => {
      links[l.id] = { label: Ln(l.label_i18n, locale), href: l.href || '/' };
    });
    return {
      links,
      cta:   { label: Ln(settings.cta?.label_i18n, locale),   href: settings.cta?.href   || '' },
      login: { label: Ln(settings.login?.label_i18n, locale), href: settings.login?.href || '/access' },
    };
  }, [cmsNav, locale]);
};

const MoodSiteHeader = ({
  locale: localeProp,
  copy = null,  // optional legacy prop from HomePage; standalone usage reads CMS directly
}) => {
  const site = useSite();
  const locale = (localeProp || site?.locale || 'it').slice(0, 2);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoImgError, setLogoImgError] = useState(false);
  const location = useLocation();
  const onHome = location.pathname === '/' || location.pathname === '';
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const tenantSlug = useMemo(() => resolveTenantSlug(), []);
  // CMS logo (always fetched directly from CMS)
  const cmsNav = useStorefrontContent(tenantSlug, 'navigation');
  const brandLogoUrl = useMemo(() => {
    const navTop = cmsNav?.content?.nav_top || cmsNav?.content?.navigation_main;
    const fromSettings = navTop?._settings?.logo_url || navTop?.settings?.logo_url;
    return (fromSettings && String(fromSettings).trim()) || null;
  }, [cmsNav]);

  // CMS-driven nav (for standalone usage — SiteLayout renders without `copy` prop)
  const cmsNavData = useCmsNav(tenantSlug, locale);

  // Nav resolvers: prefer `copy` prop (legacy, HomePage), then CMS, then empty string
  const navLabel = (key) => {
    if (copy?.nav?.[key]) return L(copy.nav[key], locale);
    return cmsNavData?.links?.[key]?.label || '';
  };
  const ctaLabel  = copy?.nav?.cta ? L(copy.nav.cta, locale) : (cmsNavData?.cta?.label  || '');
  const ctaHref   = copy?.nav?.cta_href || cmsNavData?.cta?.href || '';
  const loginLabel = copy?.nav?.login ? L(copy.nav.login, locale) : (cmsNavData?.login?.label || '');

  // Reset img error when logo URL changes
  useEffect(() => { setLogoImgError(false); }, [brandLogoUrl]);

  // Always close the menu when route changes (defensive)
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (menuOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  // Convert in-page hashes to /#hash when not on home, so anchors work cross-page
  const anchor = (hash) => (onHome ? hash : `/${hash}`);

  return (
    <>
      <header className="mfd-header" data-testid="mfd-header">
        <div className="mfd-header__inner">
          <Link to="/" className="mfd-header__brand" onClick={closeMenu} aria-label="Studio">
            {(brandLogoUrl && !logoImgError)
              ? <img src={brandLogoUrl} alt="Studio" className="mfd-header__brand-img" draggable={false} data-testid="mfd-header-brand-img" onError={() => setLogoImgError(true)} />
              : <span className="mfd-header__brand-wordmark" data-testid="mfd-header-brand-wordmark">Studio</span>
            }
          </Link>
          <nav className="mfd-header__nav" aria-label="Primary">
            {navLabel('how_it_works') && (onHome ? (
              <a href="#how-it-works">{navLabel('how_it_works')}</a>
            ) : (
              <Link to="/#how-it-works">{navLabel('how_it_works')}</Link>
            ))}
            {navLabel('magazine') && <Link to="/magazine">{navLabel('magazine')}</Link>}
            {navLabel('design_stories') && (onHome ? (
              <a href="#design-stories">{navLabel('design_stories')}</a>
            ) : (
              <Link to="/#design-stories">{navLabel('design_stories')}</Link>
            ))}
            {navLabel('professionals') && <Link to="/professionals">{navLabel('professionals')}</Link>}
          </nav>
          {loginLabel && (
            <Link to="/access" className="mfd-header__reenter" data-testid="header-cta-reenter" onClick={closeMenu}>
              {loginLabel}
            </Link>
          )}
          {ctaLabel && ctaHref && (
            <Link to={ctaHref} className="mfd-cta mfd-cta--primary mfd-header__cta" data-testid="header-cta-start-project" onClick={closeMenu}>
              {ctaLabel}
            </Link>
          )}
          <button
            type="button"
            className={`mfd-burger ${menuOpen ? 'mfd-burger--open' : ''}`}
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            data-testid="header-burger"
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {createPortal(
        <>
          <div
            className={`mfd-mobile-menu ${menuOpen ? 'mfd-mobile-menu--open' : ''}`}
            aria-hidden={!menuOpen}
            data-testid="mobile-menu-panel"
            style={{
              visibility: menuOpen ? 'visible' : 'hidden',
              pointerEvents: menuOpen ? 'auto' : 'none',
            }}
          >
            <nav className="mfd-mobile-menu__nav" aria-label="Mobile">
              {navLabel('how_it_works') && <Link to={anchor('#how-it-works')} onClick={closeMenu}>{navLabel('how_it_works')}</Link>}
              {navLabel('magazine')       && <Link to="/magazine"              onClick={closeMenu}>{navLabel('magazine')}</Link>}
              {navLabel('design_stories') && <Link to={anchor('#design-stories')} onClick={closeMenu}>{navLabel('design_stories')}</Link>}
              {navLabel('professionals')  && <Link to="/professionals"         onClick={closeMenu}>{navLabel('professionals')}</Link>}
            </nav>
            {ctaLabel && ctaHref && (
              <Link to={ctaHref} className="mfd-cta mfd-cta--primary mfd-mobile-menu__cta" onClick={closeMenu} data-testid="mobile-menu-cta">
                {ctaLabel}
              </Link>
            )}
            {loginLabel && (
              <Link to="/access" className="mfd-mobile-menu__login" onClick={closeMenu}>
                {loginLabel}
              </Link>
            )}
          </div>
          {menuOpen && <div className="mfd-mobile-menu__overlay" onClick={closeMenu} />}
        </>,
        document.body,
      )}
    </>
  );
};

export default MoodSiteHeader;
