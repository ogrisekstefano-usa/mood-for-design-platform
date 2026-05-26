/**
 * HomePage — MOOD for DESIGN™ · International Lead Generation Platform
 * ITER150 · Public Editorial Experience™
 *
 * Premium international design ecosystem · NOT a SaaS landing.
 * Warm minimal palette (warm white #F5F2ED · charcoal · editorial beige).
 * Cyan #00C9B3 ONLY for CTAs / hover / progressions.
 *
 * Sections (top → bottom, mirroring the ITER150 mockup):
 *   1. SiteHeader      — sticky luxury nav + welcome strip
 *   2. Hero            — full-bleed lifestyle photography + serif headline
 *   3. TrustStrip      — partner brand row, monochrome
 *   4. HowItWorks      — 3 editorial steps (Discover · Share · Design Journey)
 *   5. Magazine        — 5 cinematic editorial cards (NO date, NO author)
 *   6. DesignStories   — real projects grid (4 cards)
 *   7. Materials       — horizontal tactile selector
 *   8. FinalCTA        — dark band, two pathways
 *   9. SiteFooter      — minimal editorial (Company · Resources · Legal · Social)
 *
 * Architecture: editorial copy + media URLs are resolved through
 * useStorefrontContent('home') (CMS-driven). When DB content is empty
 * we fall back to FALLBACK (curated Unsplash + IT/EN copy) so the page
 * never reads broken — and Blueprint Command Center™ can override
 * each block without code changes.
 */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Plus } from 'lucide-react';
import { useSite, SiteProvider } from '../../site/SiteContext';
import MoodSiteHeader from '../../site/components/MoodSiteHeader';
import { useStorefrontContent } from '../../site/useStorefrontContent';
import StorefrontThemeProvider from '../../design-system/storefront/StorefrontThemeProvider';
import SiteLocaleBridge from '../../site/SiteLocaleBridge';
import './home-iter150.css';

// ─────────────────────────────────────────────────────────────────────
// FALLBACK · curated editorial copy + Unsplash imagery
// ─────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────
// ITER157 · Sprint A · Public Editorial Infrastructure™
//
// NO HARDCODED EDITORIAL CONTENT.
// Every block of copy, image, project, magazine article, brand label
// and CTA lives in the Storefront CMS (cms_pages/home + cms_sections).
//
// EDITORIAL_SHELL provides ONLY navigation-level UI labels needed
// to render the chrome (header, footer link structure) when the CMS
// has not yet been seeded. It contains NO editorial content, NO fake
// images, NO mock arrays. Empty sections render the graceful
// `EmptyEditorialSlot` placeholder instead.
// ─────────────────────────────────────────────────────────────────────
const EDITORIAL_SHELL = {
  welcome: {
    it: 'Benvenuti nel nostro studio. Disegniamo relazioni, non solo spazi.',
    en: 'Welcome to our studio. We design relationships, not just spaces.',
  },
  nav: {
    how_it_works:    { it: 'Come funziona',  en: 'How it works' },
    magazine:        { it: 'Magazine',       en: 'Magazine' },
    design_stories:  { it: 'Design Stories', en: 'Design Stories' },
    materials:       { it: 'Materiali',      en: 'Materials' },
    professionals:   { it: 'Per i professionisti', en: 'For Professionals™' },
    about:           { it: 'Chi siamo',      en: 'About' },
    login:           { it: 'Accedi',         en: 'Login' },
    cta:             { it: 'Inizia il tuo viaggio', en: 'Begin Your Journey™' },
  },
  // Editorial slots — empty by design. Populated by the CMS.
  hero:       { image: '', title: { it: '', en: '' }, sub: { it: '', en: '' },
                cta_primary: { it: '', en: '' }, cta_secondary: { it: '', en: '' } },
  trust:      { eyebrow: { it: '', en: '' }, brands: [] },
  howitworks: { eyebrow: { it: '', en: '' }, title: { it: '', en: '' }, steps: [], cta: { it: '', en: '' } },
  magazine:   { eyebrow: { it: '', en: '' }, title: { it: '', en: '' }, explore: { it: '', en: '' }, cards: [] },
  stories:    { eyebrow: { it: '', en: '' }, title: { it: '', en: '' }, viewAll: { it: '', en: '' }, cards: [] },
  materials:  { eyebrow: { it: '', en: '' }, title: { it: '', en: '' }, explore: { it: '', en: '' }, swatches: [] },
  finalCTA:   { title: { it: '', en: '' }, sub: { it: '', en: '' },
                private: { it: '', en: '' }, pro: { it: '', en: '' } },
  footer: {
    cols: [],
    rights: { it: '© 2026 MOOD for DESIGN. Tutti i diritti riservati.',
              en: '© 2026 MOOD for DESIGN. All rights reserved.' },
    colophon: {
      enabled: true,
      left:   { it: '© 2026 MOOD for DESIGN™', en: '© 2026 MOOD for DESIGN™' },
      center: { it: { prefix: 'Questo servizio è fornito da ', link_label: 'MOOD for DESIGN', suffix: '' },
                en: { prefix: 'This service is provided by ',  link_label: 'MOOD for DESIGN', suffix: '' } },
      center_link_href: 'https://www.moodfordesign.com',
      right:  { it: 'Running on Blueprint OS™ · Editorial Infrastructure for Design Studios',
                en: 'Running on Blueprint OS™ · Editorial Infrastructure for Design Studios' },
    },
  },
};

// Legacy alias retained while the JSX migrates section-by-section.
// All bindings below resolve through `copy = useStorefrontContent('home')`
// merged onto EDITORIAL_SHELL — the CMS is the source of truth.
const FALLBACK = EDITORIAL_SHELL;

// ── locale picker ────────────────────────────────────────────────
const L = (obj, locale) => {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[locale] || obj.en || obj.it || Object.values(obj)[0] || '';
};

// ────────────────────────────────────────────────────────────────
// ITER157 · EmptyEditorialSlot — graceful empty state when the CMS
// has not yet been populated for a given section.
//
// Renders a refined editorial placeholder (no fake content), with a
// subtle admin CTA visible ONLY when `?editorial=preview` is in the
// URL (so end-users never see "open Blueprint" prompts).
// ────────────────────────────────────────────────────────────────
const isEditorialPreview = () => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('editorial') === 'preview';
};

const EmptyEditorialSlot = ({ section, label, testid }) => (
  <section className="mfd-empty-slot" data-testid={testid || `empty-slot-${section}`}>
    <div className="mfd-empty-slot__inner">
      <span className="mfd-empty-slot__rule" aria-hidden="true" />
      <p className="mfd-empty-slot__eyebrow">{section.toUpperCase()}</p>
      <p className="mfd-empty-slot__hint">
        {label || 'Sezione editoriale in attesa di curation.'}
      </p>
      {isEditorialPreview() && (
        <a href="/blueprint/experience" className="mfd-empty-slot__cta" data-testid={`empty-slot-cta-${section}`}>
          Apri Blueprint Experience →
        </a>
      )}
    </div>
  </section>
);

// Helper: is a locale-bag string empty (across all locales)?
const isLocaleEmpty = (obj) => {
  if (!obj) return true;
  if (typeof obj === 'string') return obj.trim() === '';
  if (typeof obj !== 'object') return true;
  return Object.values(obj).every((v) => !v || (typeof v === 'string' && v.trim() === ''));
};

// ── locale registry · CMS-driven (fallback to active two) ──────
// In future this will read from `cms_settings.enabled_locales`. Today
// we ship a curated default and accept overrides via copy.locales.
const DEFAULT_LOCALES = [
  { code: 'it',    label: 'IT', active: true },
  { code: 'en',    label: 'EN', active: true },
  { code: 'fr',    label: 'FR', active: false },
  { code: 'de',    label: 'DE', active: false },
  { code: 'es',    label: 'ES', active: false },
];

const LanguageSelector = ({ locale, locales, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const active = locales.filter(l => l.active);
  const current = active.find(l => l.code === locale) || active[0];
  return (
    <div className="mfd-langsel" data-testid="language-selector">
      <button
        type="button"
        className="mfd-langsel__btn"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox" aria-expanded={open}
        data-testid="language-selector-toggle"
      >
        {current?.label || 'IT'} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className="mfd-langsel__menu" role="listbox">
          {active.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                className={`mfd-langsel__item ${l.code === locale ? 'is-current' : ''}`}
                onClick={() => { onChange?.(l.code); setOpen(false); }}
                data-testid={`language-option-${l.code}`}
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// HEADER (with burger menu for tablet/mobile)
// ─────────────────────────────────────────────────────────────────────
const SiteHeader = ({ locale, copy, onLocaleChange }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const locales = (copy.locales && copy.locales.length) ? copy.locales : DEFAULT_LOCALES;

  // Close menu on route change / anchor click
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Lock body scroll when menu open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
  <>
    <div className="mfd-welcome-strip" role="region" aria-label="Welcome">
      <div className="mfd-welcome-strip__inner">
        <p className="mfd-welcome-strip__msg">{L(copy.welcome, locale)}</p>
        <div className="mfd-welcome-strip__meta">
          <LanguageSelector locale={locale} locales={locales} onChange={onLocaleChange} />
          <Link to="/auth/login" className="mfd-welcome-strip__link" data-testid="welcome-login-link">
            {L(copy.nav.login, locale)}
          </Link>
        </div>
      </div>
    </div>
    <header className="mfd-header">
      <div className="mfd-header__inner">
        <Link to="/" className="mfd-header__brand" onClick={closeMenu}>
          <span className="mfd-header__brand-mark">MOOD <em>for</em> DESIGN</span>
          <span className="mfd-header__brand-sub">Italian Design Studios</span>
        </Link>
        <nav className="mfd-header__nav" aria-label="Primary">
          <a href="#how-it-works">{L(copy.nav.how_it_works, locale)}</a>
          <Link to="/magazine">{L(copy.nav.magazine, locale)}</Link>
          <a href="#design-stories">{L(copy.nav.design_stories, locale)}</a>
          <Link to="/professionals">{L(copy.nav.professionals, locale)}</Link>
        </nav>
        <Link to="/begin-journey" className="mfd-cta mfd-cta--primary mfd-header__cta" data-testid="header-cta-start-project">
          {L(copy.nav.cta, locale)}
        </Link>
        <button
          type="button"
          className={`mfd-burger ${menuOpen ? 'mfd-burger--open' : ''}`}
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
          data-testid="header-burger"
        >
          <span /><span /><span />
        </button>
      </div>
    </header>

    {/* Mobile / tablet slide-down panel — PORTALED to document.body
        to escape parent transform/layout context, otherwise it would
        leak into the page flow on desktop. */}
    {createPortal(
      <>
        <div
          className={`mfd-mobile-menu ${menuOpen ? 'mfd-mobile-menu--open' : ''}`}
          aria-hidden={!menuOpen}
          data-testid="mobile-menu-panel"
        >
          <nav className="mfd-mobile-menu__nav" aria-label="Mobile">
            <a href="#how-it-works" onClick={closeMenu}>{L(copy.nav.how_it_works, locale)}</a>
            <Link to="/magazine" onClick={closeMenu}>{L(copy.nav.magazine, locale)}</Link>
            <a href="#design-stories" onClick={closeMenu}>{L(copy.nav.design_stories, locale)}</a>
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
      document.body
    )}
  </>
  );
};

// ─────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────
const Hero = ({ locale, copy }) => {
  const titleEmpty = isLocaleEmpty(copy.hero.title);
  const imageEmpty = !copy.hero.image;
  if (titleEmpty && imageEmpty) {
    return <EmptyEditorialSlot section="hero_editorial" label="Componi l'apertura editoriale dal Blueprint." testid="empty-slot-hero" />;
  }
  return (
  <section className="mfd-home-hero" data-testid="hero-section">
    <div className="mfd-home-hero__bg" aria-hidden="true">
      {copy.hero.image && <img src={copy.hero.image} alt="" loading="eager" />}
      <span className="mfd-home-hero__veil" />
    </div>
    <div className="mfd-home-hero__inner">
      <div className="mfd-home-hero__content">
        <h1 className="mfd-home-hero__title" data-testid="hero-title">
          {L(copy.hero.title, locale).split('\n').map((line, i) => (
            <span key={i} className="mfd-home-hero__title-line">{line}</span>
          ))}
        </h1>
        <p className="mfd-home-hero__sub" data-testid="hero-sub">{L(copy.hero.sub, locale)}</p>
        <div className="mfd-home-hero__ctas">
          <Link to="/begin-journey" className="mfd-cta mfd-cta--solid" data-testid="hero-cta-primary">
            {L(copy.hero.cta_primary, locale)}
          </Link>
          <Link to="/professionals" className="mfd-cta mfd-cta--ghost" data-testid="hero-cta-secondary">
            {L(copy.hero.cta_secondary, locale)}
          </Link>
        </div>
      </div>
    </div>
  </section>
  );
};

// ─────────────────────────────────────────────────────────────────────
// TRUST / MATERIAL & PARTNER STRIP — marquee carousel
// ─────────────────────────────────────────────────────────────────────
const TrustStrip = ({ locale, copy }) => {
  if (!copy.trust.brands || copy.trust.brands.length === 0) return null;
  // Duplicate brand list once so the CSS marquee can loop seamlessly.
  const loopBrands = [...copy.trust.brands, ...copy.trust.brands];
  return (
    <section className="mfd-trust" data-testid="trust-strip">
      <div className="mfd-trust__inner">
        <p className="mfd-trust__eyebrow">{L(copy.trust.eyebrow, locale)}</p>
        <div className="mfd-trust__viewport" aria-hidden="false">
          <ul className="mfd-trust__brands" data-testid="trust-brands-track">
            {loopBrands.map((b, i) => (
              <li key={`${b}-${i}`} className="mfd-trust__brand">{b}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────
// HOW IT WORKS
// ─────────────────────────────────────────────────────────────────────
const HowItWorks = ({ locale, copy }) => {
  if (!copy.howitworks.steps || copy.howitworks.steps.length === 0) {
    return <EmptyEditorialSlot section="how_it_works" label="Definisci i passi del Design Journey dal Blueprint." testid="empty-slot-how-it-works" />;
  }
  return (
  <section id="how-it-works" className="mfd-how" data-testid="how-it-works">
    <div className="mfd-how__inner">
      <header className="mfd-section-head">
        <p className="mfd-section-eyebrow">{L(copy.howitworks.eyebrow, locale)}</p>
        <h2 className="mfd-section-title">
          {L(copy.howitworks.title, locale).split('\n').map((line, i) => (
            <span key={i} style={{ display: 'block' }}>{line}</span>
          ))}
        </h2>
      </header>
      <ol className="mfd-how__steps">
        {copy.howitworks.steps.map((s) => (
          <li key={s.id} className="mfd-how__step">
            <span className="mfd-how__step-num">{s.id}</span>
            <div className="mfd-how__step-body">
              <h3 className="mfd-how__step-title">{L(s.title, locale)}</h3>
              <p className="mfd-how__step-text">{L(s.body, locale)}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mfd-how__cta-wrap">
        <Link to="/begin-journey" className="mfd-cta mfd-cta--outline" data-testid="how-cta">
          {L(copy.howitworks.cta, locale)}
        </Link>
      </div>
    </div>
  </section>
  );
};

// ─────────────────────────────────────────────────────────────────────
// MAGAZINE
// ─────────────────────────────────────────────────────────────────────
const Magazine = ({ locale, copy }) => {
  if (!copy.magazine.cards || copy.magazine.cards.length === 0) {
    return <EmptyEditorialSlot section="magazine_highlights" label="Seleziona gli articoli editoriali in evidenza dal Blueprint." />;
  }
  return (
  <section id="magazine" className="mfd-home-magazine" data-testid="magazine-section">
    <div className="mfd-home-magazine__inner">
      <header className="mfd-section-head mfd-section-head--with-link">
        <div>
          <p className="mfd-section-eyebrow">{L(copy.magazine.eyebrow, locale)}</p>
          <h2 className="mfd-section-title">{L(copy.magazine.title, locale)}</h2>
        </div>
        <Link to="/magazine" className="mfd-section-link" data-testid="magazine-explore">
          {L(copy.magazine.explore, locale)} <ArrowRight size={14} strokeWidth={1.6} />
        </Link>
      </header>
      <div className="mfd-home-magazine__grid">
        {copy.magazine.cards.map((c) => (
          <Link key={c.id} to={`/magazine/${c.id}`} className="mag-card" data-testid={`magazine-card-${c.id}`}>
            <div className="mag-card__media">
              <img src={c.image} alt="" loading="lazy" />
              <span className="mag-card__veil" />
            </div>
            <span className="mag-card__category">{c.category}</span>
            <h3 className="mag-card__title">
              {L(c.title, locale).split('\n').map((line, i) => (
                <span key={i}>{line}</span>
              ))}
            </h3>
            <span className="mag-card__plus" aria-hidden="true">
              <Plus size={14} strokeWidth={1.6} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  </section>
  );
};

// ─────────────────────────────────────────────────────────────────────
// DESIGN STORIES
// ─────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────
// DESIGN STORIES
//
// ITER157.B · Auto-fed from `published_design_journeys` (curated public
// editorial layer). Each card represents a real completed Journey,
// editorially frozen by the studio. Never auto-published.
// ─────────────────────────────────────────────────────────────────────
const usePublishedJourneys = (locale) => {
  const [state, setState] = useState({ items: [], loading: true });
  useEffect(() => {
    let cancelled = false;
    const loc = (locale === 'en') ? 'en-US' : (locale || 'it-IT');
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/public/published-journeys/${TENANT_SLUG}/feed?locale=${encodeURIComponent(loc)}&featured_only=true&limit=6`;
    fetch(url)
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d) => { if (!cancelled) setState({ items: d.items || [], loading: false }); })
      .catch(() => { if (!cancelled) setState({ items: [], loading: false }); });
    return () => { cancelled = true; };
  }, [locale]);
  return state;
};

const DesignStories = ({ locale, copy }) => {
  const { items, loading } = usePublishedJourneys(locale === 'en' ? 'en-US' : 'it-IT');

  if (loading) {
    // No skeleton flash — keep the editorial silence until content lands.
    return <section className="mfd-stories mfd-stories--loading" aria-hidden="true" />;
  }

  if (!items || items.length === 0) {
    return <EmptyEditorialSlot
      section="featured_design_journeys"
      label="Questa collezione è in corso di curation."
      testid="empty-slot-design-stories"
    />;
  }

  return (
  <section id="design-stories" className="mfd-stories" data-testid="design-stories">
    <div className="mfd-stories__inner">
      <header className="mfd-section-head mfd-section-head--with-link">
        <div>
          <p className="mfd-section-eyebrow">{L(copy.stories.eyebrow, locale) || (locale === 'en' ? 'Design Stories' : 'Design Stories')}</p>
          <h2 className="mfd-section-title">{L(copy.stories.title, locale) || (locale === 'en' ? 'Real journeys. Real spaces.' : 'Journey reali. Spazi reali.')}</h2>
        </div>
        <Link to="/projects" className="mfd-section-link" data-testid="stories-view-all">
          {L(copy.stories.viewAll, locale) || (locale === 'en' ? 'View all journeys' : 'Vedi tutti i Journey')} <ArrowRight size={14} strokeWidth={1.6} />
        </Link>
      </header>
      <div className="mfd-stories__grid">
        {items.map((j) => (
          <Link key={j.id} to={`/projects/${j.slug}`} className="story-card" data-testid={`story-card-${j.slug}`}>
            <div className="story-card__media">
              {j.hero_url ? <img src={j.hero_url} alt="" loading="lazy" /> : <div className="story-card__media-empty" aria-hidden="true" />}
            </div>
            <div className="story-card__body">
              <p className="story-card__kind">{j.location || j.atmosphere || ''}</p>
              <h3 className="story-card__title">{j.title}</h3>
              {j.excerpt && <p className="story-card__excerpt">{j.excerpt}</p>}
              {j.atmosphere && <p className="story-card__atmosphere" aria-hidden="true">— {j.atmosphere}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  </section>
  );
};

// ─────────────────────────────────────────────────────────────────────
// MATERIALS
// ─────────────────────────────────────────────────────────────────────
const Materials = ({ locale, copy }) => {
  const railRef = React.useRef(null);
  const scrollBy = (dx) => railRef.current?.scrollBy({ left: dx, behavior: 'smooth' });
  if (!copy.materials.swatches || copy.materials.swatches.length === 0) {
    return <EmptyEditorialSlot section="materials_carousel" label="Componi il carosello materiali dal Blueprint." />;
  }
  return (
    <section id="materials" className="mfd-materials" data-testid="materials-section">
      <div className="mfd-materials__inner">
        <header className="mfd-section-head">
          <p className="mfd-section-eyebrow">{L(copy.materials.eyebrow, locale)}</p>
          <h2 className="mfd-section-title">{L(copy.materials.title, locale)}</h2>
        </header>
        <div className="mfd-materials__wrap">
          <div className="mfd-materials__rail" ref={railRef}>
            {copy.materials.swatches.map((s) => (
              <button
                key={s.id}
                className={`mat-tile mat-tile--${s.tone || 'mid'}`}
                data-testid={`material-tile-${s.id}`}
                aria-label={s.name}
                style={{ '--mat-color': s.swatch }}
              >
                <span className="mat-tile__swatch" aria-hidden="true" />
                <span className="mat-tile__label">{s.name}</span>
              </button>
            ))}
          </div>
          <div className="mfd-materials__controls" aria-hidden="true">
            <button onClick={() => scrollBy(-360)} className="mfd-materials__arrow" aria-label="prev">
              <ArrowLeft size={16} strokeWidth={1.4} />
            </button>
            <button onClick={() => scrollBy(360)} className="mfd-materials__arrow" aria-label="next">
              <ArrowRight size={16} strokeWidth={1.4} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────
// FINAL CTA
// ─────────────────────────────────────────────────────────────────────
const FinalCTA = ({ locale, copy }) => (
  <section className="mfd-finalcta" data-testid="final-cta">
    <div className="mfd-finalcta__inner">
      <div className="mfd-finalcta__lede">
        <h2 className="mfd-finalcta__title">
          {L(copy.finalCTA.title, locale).split('\n').map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </h2>
        <p className="mfd-finalcta__sub">{L(copy.finalCTA.sub, locale)}</p>
      </div>
      <div className="mfd-finalcta__paths">
        <Link to="/begin-journey" className="mfd-finalcta__path" data-testid="final-cta-private">
          <span className="mfd-finalcta__path-label">{L(copy.hero.cta_primary, locale)}</span>
          <span className="mfd-finalcta__path-sub">{L(copy.finalCTA.private, locale)}</span>
        </Link>
        <Link to="/professionals" className="mfd-finalcta__path" data-testid="final-cta-pro">
          <span className="mfd-finalcta__path-label">{L(copy.hero.cta_secondary, locale)}</span>
          <span className="mfd-finalcta__path-sub">{L(copy.finalCTA.pro, locale)}</span>
        </Link>
      </div>
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────────
// FOOTER — Colophon (LEFT · CENTER · RIGHT) · CMS-driven, multilingual
// ─────────────────────────────────────────────────────────────────────
const FooterColophon = ({ locale, copy }) => {
  const c = copy.footer.colophon;
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

// ─────────────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────────────
const SiteFooter = ({ locale, copy }) => (
  <footer id="footer" className="mfd-footer" data-testid="site-footer">
    <div className="mfd-footer__inner">
      <div className="mfd-footer__top">
        <div className="mfd-footer__brand">
          <span className="mfd-footer__brand-mark">MOOD <em>for</em> DESIGN</span>
          <span className="mfd-footer__brand-sub">Italian Design Studios</span>
        </div>
        <div className="mfd-footer__cols">
          {copy.footer.cols.map((col, ci) => (
            <div key={ci} className="mfd-footer__col">
              <h4 className="mfd-footer__col-title">{L(col.title, locale)}</h4>
              <ul>
                {col.links.map((l, li) => (
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
      </div>
    </div>
    <FooterColophon locale={locale} copy={copy} />
  </footer>
);

// ────────────────────────────────────────────────────────────────
// ITER157 · CMS → legacy copy mapper.
//
// The Storefront CMS returns sections keyed by `section_type` with a
// locale-bag of `{ _default, it, en-US, fr, de, es }`. The JSX still
// consumes a legacy "copy" shape (copy.hero / copy.magazine.cards /
// copy.stories.cards / …). This mapper bridges the two so the page
// is driven by the CMS without rewriting the entire DOM tree.
//
// `locale` here is a short code ('it' / 'en'); we map to the BCP-47
// locale keys used by the CMS bags ('it', 'en-US').
// ────────────────────────────────────────────────────────────────
const _resolveBag = (bag, locale) => {
  if (!bag || typeof bag !== 'object') return {};
  const norm = (locale || 'it').toLowerCase();
  if (norm.startsWith('en')) return { ...(bag._default || {}), ...(bag['en-US'] || bag.en || {}) };
  if (norm.startsWith('it')) return { ...(bag._default || {}), ...(bag.it || {}) };
  if (norm.startsWith('fr')) return { ...(bag._default || {}), ...(bag.fr || {}) };
  if (norm.startsWith('de')) return { ...(bag._default || {}), ...(bag.de || {}) };
  if (norm.startsWith('es')) return { ...(bag._default || {}), ...(bag.es || {}) };
  return { ...(bag._default || {}) };
};

const mapCmsToCopy = (content, locale) => {
  if (!content || typeof content !== 'object') return null;
  const merged = {};
  const _b = (k) => _resolveBag(content[k], locale);

  // hero_editorial → copy.hero
  const hero = _b('hero_editorial');
  const heroSettings = content.hero_editorial?._settings || {};
  if (Object.keys(hero).length) {
    merged.hero = {
      image:         hero.image || '',
      title:         { it: hero.title || '',  en: hero.title || '' },
      sub:           { it: hero.sub   || '',  en: hero.sub   || '' },
      cta_primary:   { it: hero.cta_primary   || '', en: hero.cta_primary   || '' },
      cta_secondary: { it: hero.cta_secondary || '', en: hero.cta_secondary || '' },
      cta_primary_href:   heroSettings.cta_primary_href   || '/begin-journey',
      cta_secondary_href: heroSettings.cta_secondary_href || '/professionals',
    };
  }

  // trust_marquee → copy.trust
  const trust = _b('trust_marquee');
  const trustSettings = content.trust_marquee?._settings || {};
  if (Object.keys(trust).length || (trustSettings.brands || []).length) {
    merged.trust = {
      eyebrow: { it: trust.eyebrow || '', en: trust.eyebrow || '' },
      brands:  Array.isArray(trustSettings.brands) ? trustSettings.brands : [],
    };
  }

  // editorial_grid → copy.magazine
  const mag = _b('editorial_grid');
  const magSettings = content.editorial_grid?._settings || {};
  if (Object.keys(mag).length || (magSettings.cards || []).length) {
    merged.magazine = {
      eyebrow: { it: mag.eyebrow || '', en: mag.eyebrow || '' },
      title:   { it: mag.title   || '', en: mag.title   || '' },
      explore: { it: mag.explore || '', en: mag.explore || '' },
      // ITER157.B will wire the auto-feed from magazine_articles here.
      cards:   Array.isArray(magSettings.cards) ? magSettings.cards : [],
    };
  }

  // featured_design_journeys → copy.stories
  const stories = _b('featured_design_journeys');
  const storiesSettings = content.featured_design_journeys?._settings || {};
  if (Object.keys(stories).length || (storiesSettings.cards || []).length) {
    merged.stories = {
      eyebrow: { it: stories.eyebrow || '', en: stories.eyebrow || '' },
      title:   { it: stories.title   || '', en: stories.title   || '' },
      viewAll: { it: stories.viewAll || '', en: stories.viewAll || '' },
      // ITER157.B will wire the auto-feed from published_design_journeys here.
      cards:   Array.isArray(storiesSettings.cards) ? storiesSettings.cards : [],
    };
  }

  // materials_carousel → copy.materials
  const mat = _b('materials_carousel');
  const matSettings = content.materials_carousel?._settings || {};
  if (Object.keys(mat).length || (matSettings.swatches || []).length) {
    merged.materials = {
      eyebrow:  { it: mat.eyebrow || '', en: mat.eyebrow || '' },
      title:    { it: mat.title   || '', en: mat.title   || '' },
      explore:  { it: mat.explore || '', en: mat.explore || '' },
      swatches: Array.isArray(matSettings.swatches) ? matSettings.swatches : [],
    };
  }

  // professionals_cta + cinematic_quote → copy.howitworks + copy.finalCTA
  const finalc = _b('cinematic_quote');
  const finalSettings = content.cinematic_quote?._settings || {};
  if (Object.keys(finalc).length) {
    merged.finalCTA = {
      title:        { it: finalc.title   || '', en: finalc.title   || '' },
      sub:          { it: finalc.sub     || '', en: finalc.sub     || '' },
      private:      { it: finalc.private || '', en: finalc.private || '' },
      pro:          { it: finalc.pro     || '', en: finalc.pro     || '' },
      private_href: finalSettings.private_href || '/begin-journey',
      pro_href:     finalSettings.pro_href     || '/professionals',
    };
  }

  // editorial_footer → copy.footer
  const footer = _b('editorial_footer');
  if (Object.keys(footer).length) {
    merged.footer = {
      rights: { it: footer.rights || '', en: footer.rights || '' },
      cols:   Array.isArray(footer.cols) ? footer.cols : [],
    };
  }

  return merged;
};

const TENANT_SLUG = (() => {
  if (typeof window === 'undefined') return 'studio';
  const host = window.location.hostname || '';
  const first = (host.split('.')[0] || '').toLowerCase();
  const PLATFORM = ['studio', 'blueprint', 'www', 'localhost'];
  if (first.startsWith('content-hub-pro-')) return 'studio';
  if (PLATFORM.some((h) => first === h || first.startsWith(h))) return 'studio';
  return first || 'studio';
})();

// ────────────────────────────────────────────────────────────────
// PAGE BODY (inside providers)
// ────────────────────────────────────────────────────────────────
const HomePageBody = () => {
  const site = useSite();
  const locale = (site?.locale || 'it').slice(0, 2);
  const setLocale = site?.setLocale;
  const onLocaleChange = React.useCallback((code) => {
    if (setLocale) setLocale(code);
  }, [setLocale]);

  // CMS — single source of truth for editorial copy.
  const cms = useStorefrontContent(TENANT_SLUG, 'home');
  const copy = useMemo(() => {
    const merged = { ...EDITORIAL_SHELL };
    const mapped = mapCmsToCopy(cms?.content, locale === 'en' ? 'en-US' : locale);
    if (mapped && typeof mapped === 'object') {
      Object.keys(mapped).forEach((k) => {
        merged[k] = { ...(EDITORIAL_SHELL[k] || {}), ...mapped[k] };
      });
    }
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cms?.content), locale]);

  return (
    <div className="mfd-site" data-testid="public-home-page">
      <MoodSiteHeader locale={locale} copy={copy} onLocaleChange={onLocaleChange} />
      <main>
        <Hero locale={locale} copy={copy} />
        <TrustStrip locale={locale} copy={copy} />
        <HowItWorks locale={locale} copy={copy} />
        <Magazine locale={locale} copy={copy} />
        <DesignStories locale={locale} copy={copy} />
        <Materials locale={locale} copy={copy} />
        <FinalCTA locale={locale} copy={copy} />
      </main>
      <SiteFooter locale={locale} copy={copy} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// MAIN — wraps providers required by Site components
// ─────────────────────────────────────────────────────────────────────
const HomePage = () => (
  <SiteProvider>
    <StorefrontThemeProvider>
      <SiteLocaleBridge />
      <HomePageBody />
    </StorefrontThemeProvider>
  </SiteProvider>
);

export default HomePage;
