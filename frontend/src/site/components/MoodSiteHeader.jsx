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
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';

// Localized copy resolver
const L = (v, l) => (typeof v === 'string' ? v : (v?.[l] || v?.en || v?.it || ''));

const DEFAULT_COPY = {
  nav: {
    how_it_works:  { it: 'Come funziona',  en: 'How it works' },
    magazine:      { it: 'Magazine',       en: 'Magazine' },
    design_stories:{ it: 'Design Stories', en: 'Design Stories' },
    professionals: { it: 'Per i professionisti', en: 'For professionals' },
    cta:           { it: 'Inizia il tuo Design Journey™', en: 'Begin your Design Journey™' },
    login:         { it: 'Rientra', en: 'Re-enter' },
  },
};

const MoodSiteHeader = ({
  locale = 'it',
  copy = DEFAULT_COPY,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const onHome = location.pathname === '/' || location.pathname === '';
  const closeMenu = useCallback(() => setMenuOpen(false), []);

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
          <Link to="/" className="mfd-header__brand" onClick={closeMenu}>
            <span className="mfd-header__brand-mark">MOOD <em>for</em> DESIGN</span>
            <span className="mfd-header__brand-sub">Italian Design Studios</span>
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
            to="/auth/login"
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
            <Link to="/auth/login" className="mfd-mobile-menu__login" onClick={closeMenu}>
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
