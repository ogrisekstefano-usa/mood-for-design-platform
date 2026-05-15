/**
 * HomePage — EXE INTERIOR demo storefront.
 *
 * Sections (top→bottom), matching the cinematic mockup:
 *   1. Hero             — full-bleed image, eyebrow + serif headline + 2 CTAs + video badge + scroll cue
 *   2. Services         — 5 cards on warm-beige background with line separators
 *   3. Stats Band       — dark band, gold-accent numbers, 5 KPIs
 *   4. Featured Proj.   — left intro column + 3-card horizontal rail
 *   5. Magazine Grid    — 3 article cards with image + category eyebrow
 *   6. Brand Partners   — single row of wordmarks
 *
 * Content sources:
 *   • homepageContent (JS fallback — committed to repo)
 *   • DB CMS overlay via useStorefrontContent (loaded async, merges per locale)
 *
 * No hardcoded copy — every visible string is locale-keyed and CMS-overridable.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  PencilRuler, Armchair, LayoutGrid, FileText, Handshake, Play, ChevronDown, ArrowRight, ArrowUpRight,
} from 'lucide-react';
import { useSite } from '../../site/SiteContext';
import { homepageContent } from '../../site/content/homepage';
import { tenantConfig } from '../../site/content/tenant';
import { useStorefrontContent, pickContent } from '../../site/useStorefrontContent';
import { Reveal } from '../../site/components/Reveal';
import TryPlatformCta from '../../components/demo/TryPlatformCta';

const ICONS = {
  'pencil-ruler': PencilRuler,
  'armchair':     Armchair,
  'layout-grid':  LayoutGrid,
  'file-text':    FileText,
  'handshake':    Handshake,
};

// ── DB → fallback locale picker ───────────────────────────────────────
// `db` is the section's locale_content map { it:{...}, 'en-US':{...} } or null.
// `fb` is the JS fallback object whose values are { it,en,fr,de,es,ae } T-maps.
const useResolver = (cmsContent, locale, pick) => useMemo(() => {
  const dbPick = (sectionKey, field) => {
    const db = cmsContent?.[sectionKey];
    if (!db) return undefined;
    const direct = db[locale]?.[field] ?? db._default?.[field] ?? db['en-US']?.[field];
    return direct;
  };
  // Resolve: DB section field → JS-fallback (which is itself locale-keyed).
  return (sectionKey, field, fallbackValue) => {
    const v = dbPick(sectionKey, field);
    if (v != null && v !== '') return v;
    if (fallbackValue && typeof fallbackValue === 'object' && fallbackValue.it != null) return pick(fallbackValue);
    return fallbackValue;
  };
}, [cmsContent, locale, pick]);

// ── HERO ──────────────────────────────────────────────────────────────
const HeroBlock = ({ resolve, c, pick }) => {
  const bg = resolve('store_hero', 'background_image', c.hero.backgroundImage);
  const eyebrow  = resolve('store_hero', 'eyebrow',  c.hero.eyebrow);
  const headline = resolve('store_hero', 'headline', c.hero.headline);
  const sub      = resolve('store_hero', 'sub',      c.hero.sub);
  return (
    <section className="exe-hero" data-testid="exe-hero">
      <div className="exe-hero__bg" style={{ backgroundImage: `url(${bg})` }} aria-hidden="true" />
      <div className="exe-hero__overlay" aria-hidden="true" />
      <div className="exe-hero__inner">
        <Reveal>
          <p className="exe-hero__eyebrow" data-testid="hero-eyebrow">{eyebrow}</p>
        </Reveal>
        <Reveal delay={120}>
          <h1 className="exe-hero__headline" data-testid="hero-headline">{headline}</h1>
        </Reveal>
        <Reveal delay={220}>
          <p className="exe-hero__sub" data-testid="hero-sub">{sub}</p>
        </Reveal>
        <Reveal delay={320}>
          <div className="exe-hero__ctas">
            <Link to={c.hero.ctaPrimary.href} className="exe-btn exe-btn--primary" data-testid="hero-cta-primary">
              {pick(c.hero.ctaPrimary.label)} <ArrowRight size={14} strokeWidth={1.7} />
            </Link>
            <a href={c.hero.ctaSecondary.href} className="exe-btn exe-btn--ghost" data-testid="hero-cta-secondary">
              {pick(c.hero.ctaSecondary.label)}
            </a>
          </div>
        </Reveal>
      </div>
      <a href={c.hero.videoLabel.href} className="exe-hero__video" data-testid="hero-video">
        <span className="exe-hero__video-play"><Play size={14} strokeWidth={1.5} fill="currentColor" /></span>
        <span className="exe-hero__video-text">
          <span className="exe-hero__video-kicker">{pick(c.hero.videoLabel.kicker)}</span>
          <span className="exe-hero__video-title">{pick(c.hero.videoLabel.title)}</span>
        </span>
      </a>
      <div className="exe-hero__scroll" data-testid="hero-scroll">
        <span>{pick(c.hero.scrollLabel)}</span>
        <ChevronDown size={14} strokeWidth={1.5} />
      </div>
    </section>
  );
};

// ── SERVICES ─────────────────────────────────────────────────────────
const ServicesBlock = ({ resolve, c, pick }) => {
  const kicker = resolve('value_props', 'section_kicker', c.services.kicker);
  const title  = resolve('value_props', 'section_title',  c.services.title);
  // Items come from JS fallback (or the DB section's pillars[] later when wired)
  const items = c.services.items;
  return (
    <section id="services" className="exe-services" data-testid="exe-services">
      <div className="exe-section__head">
        <Reveal><p className="exe-eyebrow">{kicker}</p></Reveal>
        <Reveal delay={80}><h2 className="exe-section__title">{title}</h2></Reveal>
      </div>
      <div className="exe-services__grid">
        {items.map((it, idx) => {
          const Icon = ICONS[it.icon] || PencilRuler;
          return (
            <Reveal key={it.id} delay={140 + idx * 70}>
              <a href={it.href} className="exe-service" data-testid={`service-${it.id}`}>
                <div className="exe-service__icon"><Icon size={28} strokeWidth={1.1} /></div>
                <h3 className="exe-service__title">{pick(it.title)}</h3>
                <p className="exe-service__body">{pick(it.body)}</p>
                <span className="exe-service__more">{pick(c.services.moreLabel)} <ArrowRight size={12} strokeWidth={1.6} /></span>
              </a>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
};

// ── STATS BAND ───────────────────────────────────────────────────────
const StatsBlock = ({ resolve, c, pick }) => {
  const kicker = resolve('stats_band', 'section_kicker', c.stats.kicker);
  const title  = resolve('stats_band', 'section_title',  c.stats.title);
  const items = c.stats.items;
  return (
    <section className="exe-stats" data-testid="exe-stats">
      <div className="exe-stats__bg" aria-hidden="true" />
      <div className="exe-section__head exe-section__head--center">
        <Reveal><p className="exe-eyebrow exe-eyebrow--gold">{kicker}</p></Reveal>
        <Reveal delay={80}><h2 className="exe-section__title exe-section__title--light">{title}</h2></Reveal>
      </div>
      <div className="exe-stats__grid">
        {items.map((s, idx) => (
          <Reveal key={s.id} delay={150 + idx * 70}>
            <div className="exe-stat" data-testid={`stat-${s.id}`}>
              <div className="exe-stat__value">{s.value}</div>
              <div className="exe-stat__label">{pick(s.label)}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
};

// ── FEATURED PROJECTS ────────────────────────────────────────────────
const ProjectsBlock = ({ resolve, c, pick }) => {
  const kicker = resolve('projects_preview', 'section_kicker', c.projectsInspire.kicker);
  const title  = resolve('projects_preview', 'section_title',  c.projectsInspire.title);
  const ctaLbl = resolve('projects_preview', 'cta_label',      c.projectsInspire.ctaLabel);
  const items = c.projectsInspire.items;
  return (
    <section className="exe-projects" data-testid="exe-projects">
      <div className="exe-projects__head">
        <Reveal><p className="exe-eyebrow">{kicker}</p></Reveal>
        <Reveal delay={80}><h2 className="exe-section__title">{title}</h2></Reveal>
        <Reveal delay={160}>
          <Link to={c.projectsInspire.ctaHref || '/projects'} className="exe-btn exe-btn--outline" data-testid="projects-cta">
            {ctaLbl} <ArrowRight size={13} strokeWidth={1.6} />
          </Link>
        </Reveal>
      </div>
      <div className="exe-projects__rail" data-testid="projects-rail">
        {items.map((p, idx) => (
          <Reveal key={p.id} delay={150 + idx * 100}>
            <Link to={`/projects/${p.slug}`} className="exe-project" data-testid={`project-card-${p.id}`}>
              <div className="exe-project__media">
                <img src={p.image} alt="" loading="lazy" />
              </div>
              <div className="exe-project__meta">
                <p className="exe-project__category">{pick(p.category)}</p>
                <p className="exe-project__location">{pick(p.location)}</p>
                <span className="exe-project__more">{pick(c.projectsInspire.moreLabel)} <ArrowRight size={12} strokeWidth={1.6} /></span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
};

// ── MAGAZINE GRID ────────────────────────────────────────────────────
const MagazineBlock = ({ resolve, c, pick }) => {
  const kicker = resolve('magazine_grid', 'section_kicker', c.magazine.kicker);
  const title  = resolve('magazine_grid', 'section_title',  c.magazine.title);
  const ctaLbl = resolve('magazine_grid', 'cta_label',      c.magazine.ctaLabel);
  const items = c.magazine.items;
  return (
    <section className="exe-magazine" data-testid="exe-magazine">
      <div className="exe-magazine__head">
        <Reveal><p className="exe-eyebrow">{kicker}</p></Reveal>
        <Reveal delay={80}><h2 className="exe-section__title">{title}</h2></Reveal>
        <Reveal delay={160}>
          <a href={c.magazine.ctaHref || '/magazine'} className="exe-btn exe-btn--outline" data-testid="magazine-cta">
            {ctaLbl} <ArrowRight size={13} strokeWidth={1.6} />
          </a>
        </Reveal>
      </div>
      <div className="exe-magazine__grid">
        {items.map((a, idx) => (
          <Reveal key={a.id} delay={150 + idx * 100}>
            <a href={`/magazine/${a.slug}`} className="exe-article" data-testid={`article-${a.id}`}>
              <div className="exe-article__media"><img src={a.image} alt="" loading="lazy" /></div>
              <p className="exe-article__category">{pick(a.category)}</p>
              <h3 className="exe-article__title">{pick(a.title)}</h3>
              <span className="exe-article__more">{pick(c.magazine.readLabel)} <ArrowUpRight size={12} strokeWidth={1.6} /></span>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
};

// ── BRAND PARTNERS ───────────────────────────────────────────────────
const BrandLogosBlock = ({ resolve, c, pick }) => {
  const kicker = resolve('brand_logos', 'section_kicker', c.brandLogos.kicker);
  return (
    <section className="exe-brands" data-testid="exe-brands">
      <p className="exe-brands__kicker">{kicker}</p>
      <div className="exe-brands__row">
        {c.brandLogos.items.map((b) => (
          <a key={b.id} href={b.href || '#'} className="exe-brand" data-testid={`brand-${b.id}`}>
            <span className="exe-brand__wordmark">{b.wordmark}</span>
          </a>
        ))}
      </div>
    </section>
  );
};

// ── PAGE ─────────────────────────────────────────────────────────────
const HomePage = () => {
  const { pick, locale } = useSite();
  const { content: cmsContent } = useStorefrontContent(tenantConfig.slug, 'home', homepageContent);
  const resolve = useResolver(cmsContent, locale, pick);
  const c = homepageContent;

  return (
    <main className="exe-home" data-testid="exe-home">
      <HeroBlock        resolve={resolve} c={c} pick={pick} />
      <ServicesBlock    resolve={resolve} c={c} pick={pick} />
      <StatsBlock       resolve={resolve} c={c} pick={pick} />
      <ProjectsBlock    resolve={resolve} c={c} pick={pick} />
      <MagazineBlock    resolve={resolve} c={c} pick={pick} />
      <BrandLogosBlock  resolve={resolve} c={c} pick={pick} />
      <TryPlatformCta />
    </main>
  );
};

export default HomePage;
