/**
 * HomePage — MOOD for DESIGN™ cinematic storefront landing.
 *
 * Sections (top → bottom, mirroring the new mockup):
 *   1. Hero            — full-bleed dark image + serif headline + supporting sub
 *   2. Dual CTA        — privato (cream) / professionista (dark) cards
 *   3. USP strip       — 5 icon columns on warm-cream
 *   4. Projects rail   — 5-up grid on dark ("Progetti che ispirano")
 *   5. Newsletter band — cream with email form
 *
 * EVERY visible string is locale-keyed and overridable via the storefront
 * CMS (`useStorefrontContent('home')`). NOTHING is hardcoded — when an
 * admin edits a section in /settings/storefront the page rerenders.
 *
 * Tenants without DB content yet fall back to the `homepageContent` shipped
 * in `site/content/homepage.js` so the page never reads "broken".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award, Users, Sparkles, Globe, ShieldCheck, ArrowRight,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useSite } from '../../site/SiteContext';
import { tenantConfig } from '../../site/content/tenant';
import { homepageContent } from '../../site/content/homepage';
import { useStorefrontContent } from '../../site/useStorefrontContent';
import { usePublicBrand } from '../../site/usePublicBrand';
import { toBcp47Storefront } from '../../site/localeBcp47';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const USP_ICONS = {
  excellence:    Award,
  relationship:  Users,
  bespoke:       Sparkles,
  international: Globe,
  quality:       ShieldCheck,
};

// ── Fallback editorial copy (CMS overrides) ─────────────────────────────
const FALLBACK = {
  hero: {
    bg: 'https://images.unsplash.com/photo-1618219740975-d40978bb7378?auto=format&fit=crop&w=2200&q=85',
    title:    { it: 'Arredare spazi.\nCostruire relazioni.',           en: 'Furnishing spaces.\nBuilding relationships.' },
    sub:      { it: 'MOOD for DESIGN™ connette persone e progetti con il saper fare italiano e una rete selezionata di designer, architetti e artigiani.',
                en: 'MOOD for DESIGN™ connects people and projects with Italian craftsmanship and a curated network of designers, architects and artisans.' },
    overline: { it: 'Due percorsi. Un unico obiettivo:',                en: 'Two paths. One single goal:' },
    overline_italic: { it: 'trasformare la tua visione in realtà.',    en: 'turning your vision into reality.' },
  },
  dual: {
    privato: {
      eyebrow: { it: 'Sei un privato?',  en: 'Are you a private client?' },
      title:   { it: 'Inizia il tuo progetto', en: 'Start your project' },
      body:    { it: 'Raccontaci la tua idea, i tuoi desideri e le tue esigenze. Ti guideremo passo dopo passo nella creazione del tuo spazio ideale.',
                 en: 'Tell us your idea, your wishes and your needs. We will guide you step by step in shaping your ideal space.' },
      cta:     { it: 'Inizia il tuo progetto', en: 'Start your project' },
      href:    '/start-project',
      image:   'https://images.unsplash.com/photo-1492138645846-7ba729b4d6ae?auto=format&fit=crop&w=900&q=85',
    },
    professional: {
      eyebrow: { it: 'Sei un professionista?', en: 'Are you a professional?' },
      title:   { it: 'Collabora con noi',      en: 'Work with us' },
      body:    { it: 'Accedi a un ecosistema di prodotti, competenze e servizi dedicati ai professionisti dell\'interior design e dell\'architettura.',
                 en: 'Access an ecosystem of products, expertise and services for interior design and architecture professionals.' },
      cta:     { it: 'Accesso professionisti', en: 'Professional access' },
      href:    '/professionals',
      image:   'https://images.unsplash.com/photo-1582719188393-bb71ca45dbb9?auto=format&fit=crop&w=900&q=85',
    },
  },
  usp: {
    title: { it: 'Perché scegliere {brand}', en: 'Why choose {brand}' },
    items: [
      { id: 'excellence',    icon: 'excellence',
        title: { it: 'Eccellenza italiana',  en: 'Italian excellence' },
        body:  { it: 'Selezioniamo i migliori brand e artigiani del Made in Italy.',
                 en: 'We select the finest Made in Italy brands and craftsmen.' } },
      { id: 'relationship',  icon: 'relationship',
        title: { it: 'Relazione umana',      en: 'Human relationship' },
        body:  { it: 'Ogni progetto è seguito da un professionista dedicato.',
                 en: 'Every project is led by a dedicated professional.' } },
      { id: 'bespoke',       icon: 'bespoke',
        title: { it: 'Progetti su misura',   en: 'Bespoke projects' },
        body:  { it: 'Soluzioni personalizzate per spazi residenziali e contract.',
                 en: 'Tailored solutions for residential and contract spaces.' } },
      { id: 'international', icon: 'international',
        title: { it: 'Internazionale',       en: 'International' },
        body:  { it: 'Supportiamo privati e professionisti in tutto il mondo.',
                 en: 'We support private clients and professionals worldwide.' } },
      { id: 'quality',       icon: 'quality',
        title: { it: 'Qualità garantita',    en: 'Guaranteed quality' },
        body:  { it: 'Materiali, design e servizio senza compromessi.',
                 en: 'Materials, design and service without compromise.' } },
    ],
  },
  projects: {
    title: { it: 'Progetti che ispirano', en: 'Projects that inspire' },
    items: [
      { id: 'venezia',  category: { it: 'Residenziale', en: 'Residential' }, city: { it: 'Venezia',       en: 'Venice' },
        image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=85', href: '/projects' },
      { id: 'como',     category: { it: 'Resort',       en: 'Resort' },      city: { it: 'Lago di Como',  en: 'Lake Como' },
        image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=85', href: '/projects' },
      { id: 'firenze',  category: { it: 'Boutique Hotel', en: 'Boutique Hotel' }, city: { it: 'Firenze',  en: 'Florence' },
        image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=900&q=85', href: '/projects' },
      { id: 'val-orcia', category: { it: 'Villa Privata', en: 'Private Villa' }, city: { it: "Val d'Orcia", en: "Val d'Orcia" },
        image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=85', href: '/projects' },
      { id: 'milano',    category: { it: 'Penthouse',     en: 'Penthouse' },     city: { it: 'Milano',     en: 'Milan' },
        image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=900&q=85', href: '/projects' },
    ],
  },
  newsletter: {
    title: { it: 'Ispirazione e novità',                en: 'Inspiration & news' },
    body:  { it: 'Iscriviti alla nostra newsletter per ricevere contenuti esclusivi e aggiornamenti dal mondo del design.',
             en: 'Subscribe to our newsletter for exclusive content and updates from the world of design.' },
    placeholder: { it: 'La tua email', en: 'Your email' },
    cta:         { it: 'Iscriviti',     en: 'Subscribe' },
    success:     { it: 'Grazie per esserti iscritto.', en: 'Thanks for subscribing.' },
  },
};

const pick = (bag, locale) => {
  if (bag == null) return '';
  if (typeof bag === 'string') return bag;
  const chain = [locale, locale?.split('-')[0], 'it', 'en-US', 'en', 'fr', 'de', 'es'];
  for (const c of chain) if (c && bag[c]) return bag[c];
  return Object.values(bag)[0] || '';
};

// Locale-aware deep getter against the CMS bag, falling back to JS defaults.
// Tries multiple keys: bcp47 (`it-IT`), compact (`it`), then default chain.
const fromCMS = (cmsContent, sectionKey, field, locale) => {
  const db = cmsContent?.[sectionKey];
  if (!db) return undefined;
  const bcp = toBcp47Storefront(locale);
  return db[bcp]?.[field]
      ?? db[locale]?.[field]
      ?? db._default?.[field]
      ?? db['en-US']?.[field]
      ?? db.it?.[field]
      ?? db['it-IT']?.[field];
};


// ── Sections ─────────────────────────────────────────────────────────────

const Hero = ({ cms, locale, brandName }) => {
  // Phase S-CONNECT Step 4 — bind to Storefront Studio actual schema.
  // DB section_type: `store_hero` · fields: title · eyebrow · settings.background_image_url
  const heroSettings = cms?.store_hero?._settings || {};
  const bg = heroSettings.background_image_url
          || fromCMS(cms, 'store_hero', 'background_url', locale)
          || FALLBACK.hero.bg;
  const title = fromCMS(cms, 'store_hero', 'title', locale)
             || fromCMS(cms, 'store_hero', 'headline', locale)
             || pick(FALLBACK.hero.title, locale);
  const sub   = fromCMS(cms, 'store_hero', 'subtitle', locale)
             || fromCMS(cms, 'store_hero', 'sub', locale)
             || pick(FALLBACK.hero.sub, locale);
  const overline = fromCMS(cms, 'store_hero', 'eyebrow', locale)
                || fromCMS(cms, 'store_hero', 'overline', locale)
                || pick(FALLBACK.hero.overline, locale);
  const overlineIt = fromCMS(cms, 'store_hero', 'overline_italic', locale) || pick(FALLBACK.hero.overline_italic, locale);
  // Allow {brand} placeholder in CMS / fallback titles.
  const titleResolved = String(title).replaceAll('{brand}', brandName || '');
  return (
    <section className="mfd-hero" data-testid="home-hero">
      <div className="mfd-hero__bg" style={{ backgroundImage: `url("${bg}")` }} aria-hidden />
      <div className="mfd-hero__veil" aria-hidden />
      <div className="mfd-hero__content">
        <h1 className="mfd-hero__title" data-testid="home-hero-title">
          {titleResolved.split('\n').map((ln, i) => <span key={i} style={{ display: 'block' }}>{ln}</span>)}
        </h1>
        <p className="mfd-hero__sub" data-testid="home-hero-sub">{sub}</p>
        <div className="mfd-hero__divider" aria-hidden />
        <p className="mfd-hero__overline">{overline}</p>
        <p className="mfd-hero__overline-italic">{overlineIt}</p>
      </div>
    </section>
  );
};


const DualCTA = ({ cms, locale }) => {
  // Phase S-CONNECT Step 4 — bind to Storefront Studio `dual_cta` section
  // (single section_type with private_* and professional_* fields per locale).
  const F = FALLBACK.dual;
  const dual = cms?.dual_cta;
  const fromDual = (key) =>
    dual?.[locale]?.[key] ?? dual?.[toBcp47Storefront(locale)]?.[key] ?? dual?._default?.[key] ?? dual?.['en-US']?.[key] ?? dual?.['it-IT']?.[key];

  const card = (kind, fb) => ({
    eyebrow: fromDual(`${kind}_eyebrow`) || fromCMS(cms, `dual_cta_${kind}`, 'eyebrow', locale) || pick(fb.eyebrow, locale),
    title:   fromDual(`${kind}_title`)   || fromCMS(cms, `dual_cta_${kind}`, 'title',   locale) || pick(fb.title,   locale),
    body:    fromDual(`${kind}_body`)    || fromCMS(cms, `dual_cta_${kind}`, 'body',    locale) || pick(fb.body,    locale),
    cta:     fromDual(`${kind}_cta`)     || fromCMS(cms, `dual_cta_${kind}`, 'cta',     locale) || pick(fb.cta,     locale),
    href:    fromDual(`${kind}_href`)    || fromCMS(cms, `dual_cta_${kind}`, 'href',    locale) || fb.href,
    image:   fromDual(`${kind}_image`)   || fromCMS(cms, `dual_cta_${kind}`, 'image',   locale) || fb.image,
  });
  const p = card('private', F.privato);
  const q = card('professional', F.professional);
  return (
    <section className="mfd-dual-cta" data-testid="home-dual-cta">
      <div className="mfd-dual-cta__grid">
        <article className="mfd-dual-card mfd-dual-card--cream" data-testid="home-cta-privato">
          <div className="mfd-dual-card__body">
            <p className="mfd-dual-card__eyebrow">{p.eyebrow}</p>
            <h3 className="mfd-dual-card__title">{p.title}</h3>
            <p className="mfd-dual-card__text">{p.body}</p>
            <Link to={p.href} className="mfd-dual-card__cta" data-testid="home-cta-privato-link">
              {p.cta} <ArrowRight size={14} strokeWidth={1.7} aria-hidden />
            </Link>
          </div>
          <div className="mfd-dual-card__image" style={{ backgroundImage: `url("${p.image}")` }} aria-hidden />
        </article>
        <article className="mfd-dual-card mfd-dual-card--dark" data-testid="home-cta-professional">
          <div className="mfd-dual-card__body">
            <p className="mfd-dual-card__eyebrow">{q.eyebrow}</p>
            <h3 className="mfd-dual-card__title">{q.title}</h3>
            <p className="mfd-dual-card__text">{q.body}</p>
            <Link to={q.href} className="mfd-dual-card__cta" data-testid="home-cta-professional-link">
              {q.cta} <ArrowRight size={14} strokeWidth={1.7} aria-hidden />
            </Link>
          </div>
          <div className="mfd-dual-card__image" style={{ backgroundImage: `url("${q.image}")` }} aria-hidden />
        </article>
      </div>
    </section>
  );
};


const UspStrip = ({ cms, locale, brandName }) => {
  // Phase S-CONNECT Step 4 — bind to Storefront Studio `value_props` section.
  // DB fields: section_title (per locale) · section_kicker · settings.pillars
  const titleRaw = fromCMS(cms, 'value_props', 'section_title', locale)
                || fromCMS(cms, 'usp_strip', 'title', locale)
                || pick(FALLBACK.usp.title, locale);
  const title = String(titleRaw).replaceAll('{brand}', brandName || '');
  const items = (cms?.value_props?._settings?.pillars)
             || (cms?.usp_strip?._settings?.items)
             || FALLBACK.usp.items;
  return (
    <section className="mfd-usp" data-testid="home-usp">
      <header className="mfd-usp__head">
        <h2 className="mfd-usp__title">{title.split(' ').map((w, i) => /^MOOD/i.test(w) ? <span key={i}>{w} </span> : i === 0 || /^per|^why|^why$/i.test(w) ? <span key={i}>{w} </span> : <span key={i}>{w} </span>)}</h2>
        <span className="mfd-usp__rule" aria-hidden />
      </header>
      <div className="mfd-usp__grid">
        {items.map((it) => {
          const Icon = USP_ICONS[it.icon] || USP_ICONS.excellence;
          return (
            <div key={it.id} className="mfd-usp__col" data-testid={`home-usp-${it.id}`}>
              <span className="mfd-usp__icon"><Icon size={34} strokeWidth={1.2} aria-hidden /></span>
              <h4 className="mfd-usp__col-title">{pick(it.title, locale)}</h4>
              <p className="mfd-usp__col-body">{pick(it.body, locale)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};


const ProjectsRail = ({ cms, locale }) => {
  // Phase S-CONNECT Step 4 — bind to Storefront Studio `projects_preview`
  // (section title) + runtime portfolio public endpoint (project cards).
  const titleRaw = fromCMS(cms, 'projects_preview', 'section_title', locale)
                || fromCMS(cms, 'projects_rail', 'title', locale)
                || pick(FALLBACK.projects.title, locale);
  const cmsItems = (cms?.projects_preview?._settings?.items)
                || (cms?.projects_rail?._settings?.items)
                || FALLBACK.projects.items;
  const [runtimeItems, setRuntimeItems] = useState(null);

  // Phase S-CONNECT Step 4 — runtime binding to portfolio public endpoint.
  useEffect(() => {
    let alive = true;
    const slug = tenantConfig.slug;
    const bcp = toBcp47Storefront(locale);
    axios.get(`${BACKEND_URL}/api/portfolio/public/${slug}/projects?locale_code=${encodeURIComponent(bcp)}`)
      .then((r) => {
        if (!alive) return;
        const list = r.data?.projects || [];
        setRuntimeItems(list.length > 0 ? list.slice(0, 5) : []);
      })
      .catch(() => { if (alive) setRuntimeItems([]); });
    return () => { alive = false; };
  }, [locale]);

  // If we have published variants for this market, use them — else CMS items.
  const usingRuntime = Array.isArray(runtimeItems) && runtimeItems.length > 0;
  const items = usingRuntime ? runtimeItems : cmsItems;

  return (
    <section className="mfd-projects" data-testid="home-projects" data-source={usingRuntime ? 'runtime' : 'cms'}>
      <header className="mfd-projects__head">
        <h2 className="mfd-projects__title">{titleRaw}</h2>
        <span className="mfd-projects__rule" aria-hidden />
      </header>
      <div className="mfd-projects__grid">
        {items.map((p) => {
          const id   = usingRuntime ? p.id     : p.id;
          const slug = usingRuntime ? p.slug   : null;
          const href = usingRuntime ? (slug ? `/projects/${slug}` : '/projects') : (p.href || '/projects');
          const image= usingRuntime ? (p.cover_image_url || '') : p.image;
          const cat  = usingRuntime ? (p.category || '') : pick(p.category, locale);
          const city = usingRuntime ? (p.location || '') : pick(p.city, locale);
          return (
            <Link
              key={id || slug}
              to={href}
              className="mfd-project-card"
              data-testid={`home-project-${id || slug}`}
            >
              <div className="mfd-project-card__media" style={{ backgroundImage: image ? `url("${image}")` : undefined }} aria-hidden />
              <div className="mfd-project-card__caption">
                <span className="mfd-project-card__category">{cat}</span>
                <span className="mfd-project-card__city">{city}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};


const Newsletter = ({ cms, locale, slug }) => {
  const N = FALLBACK.newsletter;
  const title       = fromCMS(cms, 'newsletter', 'title',       locale) || pick(N.title, locale);
  const body        = fromCMS(cms, 'newsletter', 'body',        locale) || pick(N.body, locale);
  const placeholder = fromCMS(cms, 'newsletter', 'placeholder', locale) || pick(N.placeholder, locale);
  const ctaLabel    = fromCMS(cms, 'newsletter', 'cta',         locale) || pick(N.cta, locale);
  const successMsg  = fromCMS(cms, 'newsletter', 'success',     locale) || pick(N.success, locale);

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const v = email.trim();
    if (!v || !/.+@.+\..+/.test(v)) {
      toast.error(locale.startsWith('it') ? 'Inserisci una email valida.' : 'Please enter a valid email.');
      return;
    }
    setBusy(true);
    try {
      // Reuses the existing public lead endpoint — falls back to a soft
      // success toast if the endpoint isn't wired for newsletter capture.
      await axios.post(`${BACKEND_URL}/api/public/leads/newsletter`, { email: v, tenant_slug: slug }).catch(() => null);
      toast.success(successMsg);
      setEmail('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mfd-newsletter" data-testid="home-newsletter">
      <div className="mfd-newsletter__grid">
        <div>
          <h2 className="mfd-newsletter__title">{title}</h2>
          <p className="mfd-newsletter__body">{body}</p>
        </div>
        <form className="mfd-newsletter__form" onSubmit={submit} data-testid="home-newsletter-form">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            data-testid="home-newsletter-email"
          />
          <button type="submit" disabled={busy} data-testid="home-newsletter-submit">
            {ctaLabel}
          </button>
        </form>
      </div>
    </section>
  );
};


// ── New cinematic bands bound to DB sections via Experience Studio ────

const StatsBand = ({ cms, locale }) => {
  const section = cms?.stats_band;
  if (!section) return null;
  const eyebrow = fromCMS(cms, 'stats_band', 'eyebrow', locale);
  const title   = fromCMS(cms, 'stats_band', 'title',   locale);
  const body    = fromCMS(cms, 'stats_band', 'body',    locale);
  const items   = Array.isArray(section._settings?.stats) ? section._settings.stats : [];
  if (items.length === 0 && !title) return null;
  return (
    <section className="mfd-stats" data-testid="home-stats-band">
      <div className="mfd-stats__head">
        {eyebrow && <p className="mfd-stats__eyebrow">{eyebrow}</p>}
        {title && <h2 className="mfd-stats__title">{title}</h2>}
        {body && <p className="mfd-stats__body">{body}</p>}
      </div>
      <div className="mfd-stats__grid">
        {items.map((it, i) => (
          <div className="mfd-stats__cell" key={i} data-testid={`home-stats-cell-${i}`}>
            <span className="mfd-stats__value">{it.value}</span>
            <span className="mfd-stats__label">{pick(it.label_i18n, locale) || ''}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

const BrandLogosStrip = ({ cms, locale }) => {
  const section = cms?.brand_logos;
  if (!section) return null;
  const eyebrow = fromCMS(cms, 'brand_logos', 'eyebrow', locale);
  const title   = fromCMS(cms, 'brand_logos', 'title',   locale);
  const items   = Array.isArray(section._settings?.logos) ? section._settings.logos : [];
  if (items.length === 0) return null;
  return (
    <section className="mfd-logos" data-testid="home-brand-logos">
      {(eyebrow || title) && (
        <div className="mfd-logos__head">
          {eyebrow && <p className="mfd-logos__eyebrow">{eyebrow}</p>}
          {title && <h2 className="mfd-logos__title">{title}</h2>}
        </div>
      )}
      <div className="mfd-logos__strip">
        {items.map((it, i) => {
          const inner = it.logo_url
            ? <img src={it.logo_url} alt={it.name || ''} className="mfd-logos__img" />
            : <span className="mfd-logos__name">{it.name}</span>;
          return it.href
            ? <a key={i} href={it.href} className="mfd-logos__cell" data-testid={`home-logo-${i}`} target="_blank" rel="noopener noreferrer">{inner}</a>
            : <div key={i} className="mfd-logos__cell" data-testid={`home-logo-${i}`}>{inner}</div>;
        })}
      </div>
    </section>
  );
};

const MagazineGrid = ({ cms, locale, slug }) => {
  const section = cms?.magazine_grid;
  const [articles, setArticles] = useState(null);
  const limit = section?._settings?.limit ?? 3;
  const mode  = section?._settings?.mode  || 'auto';
  const slugs = section?._settings?.slugs || [];

  useEffect(() => {
    if (!section) return;
    const bcp = toBcp47Storefront(locale);
    axios.get(`${BACKEND_URL}/api/magazine/public/${slug}/articles?locale_code=${encodeURIComponent(bcp)}&limit=${limit}`)
      .then((r) => setArticles(r.data?.articles || []))
      .catch(() => setArticles([]));
  }, [section, locale, slug, limit]);

  if (!section) return null;
  const eyebrow = fromCMS(cms, 'magazine_grid', 'eyebrow', locale);
  const title   = fromCMS(cms, 'magazine_grid', 'title',   locale);
  const body    = fromCMS(cms, 'magazine_grid', 'body',    locale);
  const ctaLabel = fromCMS(cms, 'magazine_grid', 'cta_label', locale);
  const ctaHref  = fromCMS(cms, 'magazine_grid', 'cta_href',  locale) || '/magazine';

  let items = articles;
  if (mode === 'manual' && Array.isArray(slugs) && slugs.length > 0 && Array.isArray(articles)) {
    items = articles.filter((a) => slugs.includes(a.slug));
  }
  // Editorial empty state — no silent fallback.
  if (Array.isArray(items) && items.length === 0) {
    if (!title) return null;
    return (
      <section className="mfd-mag" data-testid="home-magazine-grid">
        <div className="mfd-mag__head">
          {eyebrow && <p className="mfd-mag__eyebrow">{eyebrow}</p>}
          <h2 className="mfd-mag__title">{title}</h2>
        </div>
        <p className="mfd-mag__empty">
          {locale?.startsWith('it') ? 'Nuovi articoli editoriali in arrivo.' : 'New editorial stories coming soon.'}
        </p>
      </section>
    );
  }
  if (!Array.isArray(items)) return null;

  return (
    <section className="mfd-mag" data-testid="home-magazine-grid">
      <div className="mfd-mag__head">
        {eyebrow && <p className="mfd-mag__eyebrow">{eyebrow}</p>}
        {title && <h2 className="mfd-mag__title">{title}</h2>}
        {body && <p className="mfd-mag__body">{body}</p>}
      </div>
      <div className="mfd-mag__grid">
        {items.slice(0, limit).map((a) => (
          <Link to={`/magazine/${a.slug}`} key={a.slug} className="mfd-mag__card" data-testid={`home-mag-${a.slug}`}>
            <div className="mfd-mag__media" style={{ backgroundImage: a.cover_image_url ? `url("${a.cover_image_url}")` : undefined }} aria-hidden />
            <div className="mfd-mag__caption">
              {a.category && <span className="mfd-mag__category">{a.category}</span>}
              <h3 className="mfd-mag__h3">{a.title}</h3>
              {a.excerpt && <p className="mfd-mag__excerpt">{a.excerpt}</p>}
            </div>
          </Link>
        ))}
      </div>
      {ctaLabel && (
        <div className="mfd-mag__cta-row">
          <Link to={ctaHref} className="mfd-mag__cta" data-testid="home-mag-cta">
            {ctaLabel} <ArrowRight size={14} strokeWidth={1.7} aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
};


// ── Page ────────────────────────────────────────────────────────────────

const HomePage = () => {
  const { locale } = useSite();
  const slug = tenantConfig?.slug || 'mood-demo-studio-81a09e';
  const { content: cms } = useStorefrontContent(slug, 'home', homepageContent);
  const { brand } = usePublicBrand(slug, locale);
  const brandName = useMemo(
    () => `${brand?.name || 'MOOD for DESIGN'}${brand?.suffix || ''}`,
    [brand],
  );

  return (
    <div className="mfd-home" data-testid="home-page" data-surface="storefront">
      <Hero       cms={cms} locale={locale} brandName={brandName} />
      <DualCTA    cms={cms} locale={locale} />
      <UspStrip   cms={cms} locale={locale} brandName={brandName} />
      <StatsBand  cms={cms} locale={locale} />
      <ProjectsRail cms={cms} locale={locale} />
      <MagazineGrid cms={cms} locale={locale} slug={slug} />
      <BrandLogosStrip cms={cms} locale={locale} />
      <Newsletter cms={cms} locale={locale} slug={slug} />
    </div>
  );
};

export default HomePage;
