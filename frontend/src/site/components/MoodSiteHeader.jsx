/**
 * MoodSiteHeader — reusable public site header for the cream/editorial layout.
 *
 * Used by HomePage and any other public surface that should keep the same
 * top chrome (e.g. BeginJourneyPage, MagazinePage, ProjectsIndexPage…).
 *
 * Cross-page anchor behaviour: when the header is shown on a page that
 * isn't `/`, in-page hashes like `#how-it-works` become `/#how-it-works`
 * so the link goes home + scrolls to the anchor.
 *
 * Mobile menu is bullet-proofed with `visibility: hidden + pointer-events: none`
 * when closed, so even if a CSS transform regression appeared it would
 * never leak content into the page flow.
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

// Localized copy resolver
const L = (v, l) => (typeof v === 'string' ? v : (v?.[l] || v?.en || v?.it || ''));

const DEFAULT_COPY = {
  nav: {
    how_it_works:  { it: 'Come lavoriamo',  en: 'How we work' },
    magazine:      { it: 'Magazine',       en: 'Magazine' },
    design_stories:{ it: 'Progetti', en: 'Projects' },
    professionals: { it: 'Per i professionisti', en: 'For professionals' },
    cta:           { it: 'Prenota una consulenza', en: 'Book a consultation' },
    login:         { it: 'Accedi', en: 'Sign in' },
  },
};

const MoodSiteHeader = ({
  locale: localeProp,
  copy = DEFAULT_COPY,
}) => {
  const site = useSite();
  // Prefer the prop (used by HomePage), then the SiteContext locale, then 'it'.
  // The short form ('it' / 'en') is what DEFAULT_COPY keys use.
  const locale = (localeProp || site?.locale || 'it').slice(0, 2);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const onHome = location.pathname === '/' || location.pathname === '';
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // ITER171.6 · CMS-driven logo. Reads from `navigation.nav_top.settings.logo_url`.
  // Falls back to the bundled brand asset when CMS has no override yet.
  const tenantSlug = useMemo(() => resolveTenantSlug(), []);
  const cmsNav = useStorefrontContent(tenantSlug, 'navigation');
  const brandLogoUrl = useMemo(() => {
    const navTop = cmsNav?.content?.nav_top || cmsNav?.content?.navigation_main;
    const fromSettings = navTop?._settings?.logo_url || navTop?.settings?.logo_url;
    return (fromSettings && String(fromSettings).trim()) || MOOD_BRAND_LOGO_URL;
  }, [cmsNav]);

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
            <img
              src={brandLogoUrl}
              alt="Studio"
              className="mfd-header__brand-img"
              draggable={false}
              data-testid="mfd-header-brand-img"
            />
          </Link>
          <nav className="mfd-header__nav" aria-label="Primary">
            {onHome ? (
              <a href="#how-it-works">{L(copy.nav.how_it_works, locale)}</a>
            ) : (
              <Link to="/#how-it-works">{L(copy.nav.how_it_works, locale)}</Link>
            )}
            <Link to="/magazine">{L(copy.nav.magazine, locale)}</Link>
            {onHome ? (
              <a href="#design-stories">{L(copy.nav.design_stories, locale)}</a>
            ) : (
              <Link to="/#design-stories">{L(copy.nav.design_stories, locale)}</Link>
            )}
            <Link to="/professionals">{L(copy.nav.professionals, locale)}</Link>
          </nav>
          {/* RIENTRA — Access Continuity™ CTA (ghost, accanto al CTA primario).
              ITER167 · "RIENTRA" perché elegante, corto, non software. */}
          <Link
            to="/access"
            className="mfd-header__reenter"
            data-testid="header-cta-reenter"
            onClick={closeMenu}
          >
            {L(copy.nav.login, locale)}
          </Link>
          <Link
            to="/begin-journey"
            className="mfd-cta mfd-cta--primary mfd-header__cta"
            data-testid="header-cta-start-project"
            onClick={closeMenu}
          >
            {L(copy.nav.cta, locale)}
          </Link>
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

      {/* Slide-down panel + overlay — ALWAYS portaled to document.body
          so it escapes any parent transform context.
          When closed: visibility:hidden + pointer-events:none → fully inert.
          When open : visibility:visible + pointer-events:auto. */}
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
              <Link to={anchor('#how-it-works')} onClick={closeMenu}>{L(copy.nav.how_it_works, locale)}</Link>
              <Link to="/magazine" onClick={closeMenu}>{L(copy.nav.magazine, locale)}</Link>
              <Link to={anchor('#design-stories')} onClick={closeMenu}>{L(copy.nav.design_stories, locale)}</Link>
              <Link to="/professionals" onClick={closeMenu}>{L(copy.nav.professionals, locale)}</Link>
            </nav>
            <Link
              to="/begin-journey"
              className="mfd-cta mfd-cta--primary mfd-mobile-menu__cta"
              onClick={closeMenu}
              data-testid="mobile-menu-cta"
            >
              {L(copy.nav.cta, locale)}
            </Link>
            <Link to="/access" className="mfd-mobile-menu__login" onClick={closeMenu}>
              {L(copy.nav.login, locale)}
            </Link>
          </div>
          {menuOpen && <div className="mfd-mobile-menu__overlay" onClick={closeMenu} />}
        </>,
        document.body,
      )}
    </>
  );
};

export default MoodSiteHeader;
