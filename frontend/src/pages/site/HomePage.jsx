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
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Plus } from 'lucide-react';
import { useSite, SiteProvider } from '../../site/SiteContext';
import { useStorefrontContent } from '../../site/useStorefrontContent';
import StorefrontThemeProvider from '../../design-system/storefront/StorefrontThemeProvider';
import SiteLocaleBridge from '../../site/SiteLocaleBridge';
import './home-iter150.css';

// ─────────────────────────────────────────────────────────────────────
// FALLBACK · curated editorial copy + Unsplash imagery
// ─────────────────────────────────────────────────────────────────────
const FALLBACK = {
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
  hero: {
    image: 'https://images.unsplash.com/photo-1618219740975-d40978bb7378?auto=format&fit=crop&w=2400&q=85',
    title:    { it: 'Il tuo spazio.\nIl tuo viaggio.',     en: 'Your space.\nYour journey.' },
    sub:      { it: 'Inizia un\'esperienza di design personale con studi italiani di alta gamma.',
                en: 'Begin a personal design experience with Italian design studios.' },
    cta_primary:   { it: 'Inizia il tuo viaggio',   en: 'Begin Your Journey™' },
    cta_secondary: { it: 'Per i professionisti',    en: 'For Professionals™' },
  },
  trust: {
    eyebrow: { it: 'Materiali Selezionati & Design Partner',
               en: 'Selected Materials & Design Partners' },
    brands: ['Poliform', 'Molteni&C', 'B&B Italia', 'Minotti', 'FLOS', 'Cattelan Italia', 'Porro', 'Poltrona Frau'],
  },
  howitworks: {
    eyebrow:  { it: 'Come funziona',  en: 'How it works' },
    title:    { it: 'Un viaggio. Disegnato attorno a te.',
                en: 'A journey. Designed around you.' },
    steps: [
      { id: '01', title: { it: 'Esplora',  en: 'Discover' },
        body: { it: 'Esplora atmosfere, stili e ispirazioni che parlano di te.',
                en: 'Explore atmospheres, styles and inspirations that speak to you.' } },
      { id: '02', title: { it: 'Condividi', en: 'Share' },
        body: { it: 'Raccontaci il tuo spazio, le tue esigenze e le tue preferenze visive.',
                en: 'Tell us about your space, needs and visual preferences.' } },
      { id: '03', title: { it: 'Design Journey', en: 'Design Journey' },
        body: { it: 'Il nostro studio sviluppa il tuo progetto, passo dopo passo, insieme a te.',
                en: 'Our studio creates your project, step by step, together.' } },
    ],
    cta: { it: 'Inizia il tuo viaggio', en: 'Start Your Journey' },
  },
  magazine: {
    eyebrow:  { it: 'Magazine', en: 'Magazine' },
    title:    { it: 'Ispirazione. Materiali. Atmosfere.',
                en: 'Inspiration. Materials. Atmospheres.' },
    explore:  { it: 'Esplora tutti gli articoli', en: 'Explore all articles' },
    cards: [
      { id: 'm1', category: 'INTERIORS',
        title: { it: 'Modern living\nin perfetto equilibrio', en: 'Modern living\nin perfect balance' },
        image: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=85' },
      { id: 'm2', category: 'MATERIALS',
        title: { it: 'La bellezza della\npietra naturale', en: 'The beauty of\nnatural stone' },
        image: 'https://images.unsplash.com/photo-1604578762246-41134e37f9cc?auto=format&fit=crop&w=900&q=85' },
      { id: 'm3', category: 'INSPIRATION',
        title: { it: 'Minimalismo caldo:\nliving senza tempo', en: 'Warm minimalism:\ntimeless living' },
        image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=900&q=85' },
      { id: 'm4', category: 'DESIGN STORIES',
        title: { it: 'Un progetto\na Milano', en: 'A project\nin Milan' },
        image: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=900&q=85' },
      { id: 'm5', category: 'DETAILS',
        title: { it: 'L\'arte\ndei dettagli', en: 'The art\nof the details' },
        image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=85' },
    ],
  },
  stories: {
    eyebrow:  { it: 'Design Stories', en: 'Design Stories' },
    title:    { it: 'Progetti reali. Spazi reali.', en: 'Real projects. Real spaces.' },
    viewAll:  { it: 'Vedi tutti i progetti', en: 'View all projects' },
    cards: [
      { id: 's1', kind: { it: 'RESIDENZA PRIVATA', en: 'PRIVATE RESIDENCE' },
        title:  { it: 'Lugano Lake House', en: 'Lugano Lake House' },
        excerpt:{ it: 'Un rifugio sereno in armonia con la natura.',
                  en: 'A serene retreat in harmony with nature.' },
        image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1100&q=85' },
      { id: 's2', kind: { it: 'APPARTAMENTO', en: 'APARTMENT' },
        title:  { it: 'Brera Apartment', en: 'Brera Apartment' },
        excerpt:{ it: 'Linee eleganti e artigianato italiano.',
                  en: 'Elegant lines and Italian craftsmanship.' },
        image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1100&q=85' },
      { id: 's3', kind: { it: 'VILLA', en: 'VILLA' },
        title:  { it: 'Tuscany Hills', en: 'Tuscany Hills' },
        excerpt:{ it: 'Dove la tradizione incontra il design contemporaneo.',
                  en: 'Where tradition meets contemporary design.' },
        image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1100&q=85' },
      { id: 's4', kind: { it: 'PENTHOUSE', en: 'PENTHOUSE' },
        title:  { it: 'City Skyline', en: 'City Skyline' },
        excerpt:{ it: 'Luce, viste e abitare sofisticato.',
                  en: 'Light, views and sophisticated living.' },
        image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1100&q=85' },
    ],
  },
  materials: {
    eyebrow:  { it: 'Materiali & Brand', en: 'Materials & Brands' },
    title:    { it: 'Una selezione curata dei migliori materiali.',
                en: 'Curated selection of the finest materials.' },
    explore:  { it: 'Esplora i materiali', en: 'Explore materials' },
    swatches: [
      { id: 'mat1', name: 'Marble',     image: 'https://images.unsplash.com/photo-1604147706283-d7119b5b822c?auto=format&fit=crop&w=400&q=85' },
      { id: 'mat2', name: 'Walnut',     image: 'https://images.unsplash.com/photo-1610552050890-fe99536c2615?auto=format&fit=crop&w=400&q=85' },
      { id: 'mat3', name: 'Oak',        image: 'https://images.unsplash.com/photo-1609921141835-710b7cd1a51c?auto=format&fit=crop&w=400&q=85' },
      { id: 'mat4', name: 'Linen',      image: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=400&q=85' },
      { id: 'mat5', name: 'Travertine', image: 'https://images.unsplash.com/photo-1604147495798-57beb5d6af73?auto=format&fit=crop&w=400&q=85' },
      { id: 'mat6', name: 'Brass',      image: 'https://images.unsplash.com/photo-1564540586988-aa4e53c3d799?auto=format&fit=crop&w=400&q=85' },
      { id: 'mat7', name: 'Terrazzo',   image: 'https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=400&q=85' },
      { id: 'mat8', name: 'Slate',      image: 'https://images.unsplash.com/photo-1597428892389-6d456e69ec48?auto=format&fit=crop&w=400&q=85' },
      { id: 'mat9', name: 'Linen Light',image: 'https://images.unsplash.com/photo-1622820236923-2c14b95b62b3?auto=format&fit=crop&w=400&q=85' },
      { id: 'mat10',name: 'Charcoal',   image: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=400&q=85' },
      { id: 'mat11',name: 'Basalt',     image: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=400&q=85' },
    ],
  },
  finalCTA: {
    title:   { it: 'Pronto a iniziare\nil tuo design journey?',
               en: 'Ready to start\nyour design journey?' },
    sub:     { it: 'Siamo qui per portare la tua visione alla luce.',
               en: 'We are here to bring your vision to life.' },
    private: { it: 'Per Clienti Privati', en: 'For Private Clients' },
    pro:     { it: 'Per Studi & Brand',   en: 'For Design Studios & Brands' },
  },
  footer: {
    cols: [
      { title: { it: 'Azienda', en: 'Company' },
        links: [
          { label: { it: 'Chi siamo',     en: 'About Us' },   href: '/about' },
          { label: { it: 'I nostri studi', en: 'Our Studios' },href: '/studios' },
          { label: { it: 'Lavora con noi', en: 'Careers' },   href: '/careers' },
          { label: { it: 'Contatti',      en: 'Contact' },    href: '/contact' },
        ] },
      { title: { it: 'Risorse', en: 'Resources' },
        links: [
          { label: { it: 'FAQ',            en: 'FAQ' },            href: '/faq' },
          { label: { it: 'Privacy Policy', en: 'Privacy Policy' }, href: '/privacy' },
          { label: { it: 'Termini e Condizioni', en: 'Terms & Conditions' }, href: '/terms' },
        ] },
      { title: { it: 'Seguici', en: 'Follow Us' },
        links: [
          { label: 'Instagram', href: 'https://instagram.com' },
          { label: 'Pinterest', href: 'https://pinterest.com' },
          { label: 'LinkedIn',  href: 'https://linkedin.com' },
        ] },
    ],
    rights: { it: '© 2026 MOOD for DESIGN. Tutti i diritti riservati.',
              en: '© 2026 MOOD for DESIGN. All rights reserved.' },
  },
};

// ── locale picker ────────────────────────────────────────────────
const L = (obj, locale) => {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[locale] || obj.en || obj.it || Object.values(obj)[0] || '';
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
// SITE HEADER — sticky luxury nav
// ─────────────────────────────────────────────────────────────────────
const SiteHeader = ({ locale, copy, onLocaleChange }) => {
  const locales = (copy.locales && copy.locales.length) ? copy.locales : DEFAULT_LOCALES;
  return (
  <>
    <div className="mfd-welcome-strip" role="region" aria-label="Welcome">
      <p className="mfd-welcome-strip__msg">{L(copy.welcome, locale)}</p>
      <div className="mfd-welcome-strip__meta">
        <LanguageSelector locale={locale} locales={locales} onChange={onLocaleChange} />
        <Link to="/magazine" className="mfd-welcome-strip__link" data-testid="welcome-magazine-link">
          {L(copy.nav.magazine, locale)}
        </Link>
        <Link to="/auth/login" className="mfd-welcome-strip__link" data-testid="welcome-login-link">
          {L(copy.nav.login, locale)}
        </Link>
      </div>
    </div>
    <header className="mfd-header">
      <Link to="/" className="mfd-header__brand">
        <span className="mfd-header__brand-mark">MOOD <em>for</em> DESIGN</span>
        <span className="mfd-header__brand-sub">Italian Design Studios</span>
      </Link>
      <nav className="mfd-header__nav" aria-label="Primary">
        <a href="#how-it-works">{L(copy.nav.how_it_works, locale)}</a>
        <Link to="/magazine">{L(copy.nav.magazine, locale)}</Link>
        <a href="#design-stories">{L(copy.nav.design_stories, locale)}</a>
        <a href="#materials">{L(copy.nav.materials, locale)}</a>
        <Link to="/professionals">{L(copy.nav.professionals, locale)}</Link>
        <a href="#footer">{L(copy.nav.about, locale)}</a>
      </nav>
      <Link to="/begin-journey" className="mfd-cta mfd-cta--primary" data-testid="header-cta-start-project">
        {L(copy.nav.cta, locale)}
      </Link>
    </header>
  </>
  );
};

// ─────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────
const Hero = ({ locale, copy }) => (
  <section className="mfd-hero" data-testid="hero-section">
    <div className="mfd-hero__bg" aria-hidden="true">
      <img src={copy.hero.image} alt="" loading="eager" />
      <span className="mfd-hero__veil" />
    </div>
    <div className="mfd-hero__content">
      <h1 className="mfd-hero__title" data-testid="hero-title">
        {L(copy.hero.title, locale).split('\n').map((line, i) => (
          <span key={i} className="mfd-hero__title-line">{line}</span>
        ))}
      </h1>
      <p className="mfd-hero__sub" data-testid="hero-sub">{L(copy.hero.sub, locale)}</p>
      <div className="mfd-hero__ctas">
        <Link to="/begin-journey" className="mfd-cta mfd-cta--solid" data-testid="hero-cta-primary">
          {L(copy.hero.cta_primary, locale)}
        </Link>
        <Link to="/professionals" className="mfd-cta mfd-cta--ghost" data-testid="hero-cta-secondary">
          {L(copy.hero.cta_secondary, locale)}
        </Link>
      </div>
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────────
// TRUST / MATERIAL & PARTNER STRIP
// ─────────────────────────────────────────────────────────────────────
const TrustStrip = ({ locale, copy }) => (
  <section className="mfd-trust" data-testid="trust-strip">
    <p className="mfd-trust__eyebrow">{L(copy.trust.eyebrow, locale)}</p>
    <ul className="mfd-trust__brands">
      {copy.trust.brands.map((b) => (
        <li key={b} className="mfd-trust__brand">{b}</li>
      ))}
    </ul>
  </section>
);

// ─────────────────────────────────────────────────────────────────────
// HOW IT WORKS
// ─────────────────────────────────────────────────────────────────────
const HowItWorks = ({ locale, copy }) => (
  <section id="how-it-works" className="mfd-how" data-testid="how-it-works">
    <header className="mfd-section-head">
      <p className="mfd-section-eyebrow">{L(copy.howitworks.eyebrow, locale)}</p>
      <h2 className="mfd-section-title">{L(copy.howitworks.title, locale)}</h2>
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
  </section>
);

// ─────────────────────────────────────────────────────────────────────
// MAGAZINE
// ─────────────────────────────────────────────────────────────────────
const Magazine = ({ locale, copy }) => (
  <section id="magazine" className="mfd-home-magazine" data-testid="magazine-section">
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
  </section>
);

// ─────────────────────────────────────────────────────────────────────
// DESIGN STORIES
// ─────────────────────────────────────────────────────────────────────
const DesignStories = ({ locale, copy }) => (
  <section id="design-stories" className="mfd-stories" data-testid="design-stories">
    <header className="mfd-section-head mfd-section-head--with-link">
      <div>
        <p className="mfd-section-eyebrow">{L(copy.stories.eyebrow, locale)}</p>
        <h2 className="mfd-section-title">{L(copy.stories.title, locale)}</h2>
      </div>
      <Link to="/projects" className="mfd-section-link" data-testid="stories-view-all">
        {L(copy.stories.viewAll, locale)} <ArrowRight size={14} strokeWidth={1.6} />
      </Link>
    </header>
    <div className="mfd-stories__grid">
      {copy.stories.cards.map((c) => (
        <Link key={c.id} to={`/projects/${c.id}`} className="story-card" data-testid={`story-card-${c.id}`}>
          <div className="story-card__media">
            <img src={c.image} alt="" loading="lazy" />
          </div>
          <div className="story-card__body">
            <p className="story-card__kind">{L(c.kind, locale)}</p>
            <h3 className="story-card__title">{L(c.title, locale)}</h3>
            <p className="story-card__excerpt">{L(c.excerpt, locale)}</p>
          </div>
        </Link>
      ))}
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────────
// MATERIALS
// ─────────────────────────────────────────────────────────────────────
const Materials = ({ locale, copy }) => {
  const railRef = React.useRef(null);
  const scrollBy = (dx) => railRef.current?.scrollBy({ left: dx, behavior: 'smooth' });
  return (
    <section id="materials" className="mfd-materials" data-testid="materials-section">
      <header className="mfd-section-head mfd-section-head--with-link">
        <div>
          <p className="mfd-section-eyebrow">{L(copy.materials.eyebrow, locale)}</p>
          <h2 className="mfd-section-title">{L(copy.materials.title, locale)}</h2>
        </div>
        <Link to="/materials" className="mfd-section-link" data-testid="materials-explore">
          {L(copy.materials.explore, locale)} <ArrowRight size={14} strokeWidth={1.6} />
        </Link>
      </header>
      <div className="mfd-materials__wrap">
        <div className="mfd-materials__rail" ref={railRef}>
          {copy.materials.swatches.map((s) => (
            <button key={s.id} className="mat-tile" data-testid={`material-tile-${s.id}`} aria-label={s.name}>
              <img src={s.image} alt="" loading="lazy" />
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
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────
// FINAL CTA
// ─────────────────────────────────────────────────────────────────────
const FinalCTA = ({ locale, copy }) => (
  <section className="mfd-finalcta" data-testid="final-cta">
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
  </section>
);

// ─────────────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────────────
const SiteFooter = ({ locale, copy }) => (
  <footer id="footer" className="mfd-footer" data-testid="site-footer">
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
    <div className="mfd-footer__rights">{L(copy.footer.rights, locale)}</div>
    <div className="mfd-footer__blueprint" aria-label="Blueprint OS">
      <span>© 2026 Blueprint OS™</span>
    </div>
  </footer>
);

// ─────────────────────────────────────────────────────────────────────
// PAGE BODY (inside providers)
// ─────────────────────────────────────────────────────────────────────
const HomePageBody = () => {
  const site = useSite();
  const locale = (site?.locale || 'it').slice(0, 2);
  const setLocale = site?.setLocale;
  const onLocaleChange = React.useCallback((code) => {
    if (setLocale) setLocale(code);
  }, [setLocale]);

  // CMS overrides — merged onto FALLBACK without breaking missing branches.
  const cms = useStorefrontContent('home') || {};
  const copy = useMemo(() => {
    // Shallow merge per top-level section.
    const merged = { ...FALLBACK };
    Object.keys(cms).forEach((k) => {
      merged[k] = { ...(FALLBACK[k] || {}), ...(cms[k] || {}) };
    });
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cms)]);

  return (
    <div className="mfd-site" data-testid="public-home-page">
      <SiteHeader locale={locale} copy={copy} onLocaleChange={onLocaleChange} />
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
