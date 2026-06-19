/**
 * ProfessionalsGatewayPage — Pagina Partner Network
 * ═══════════════════════════════════════════════════
 * CMS-driven via useStorefrontContent('professionals').
 * Partner Sprint 2026 — CTA → /partner-application
 *
 * Sezioni:
 *   1. ProHero          — hero_editorial
 *   2. ProManifesto     — atmosphere_statement
 *   3. PartnerTypesGrid — inline (Chi collabora)
 *   4. ProTriptych      — editorial_triptych
 *   5. ProProcess       — design_journey (4 step)
 *   6. PartnerCaseStudies — inline (Progetti sviluppati insieme)
 *   7. ProCollaborators — professionals_cta
 *   8. ProFinalCTA      — cinematic_quote
 */
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Home, Hammer, Store, Tag, LayoutGrid } from 'lucide-react';
import { useSite } from '../../site/SiteContext';
import { useStorefrontContent } from '../../site/useStorefrontContent';
import './home-iter150.css';
import './professionals.css';

// ── Tenant slug ──────────────────────────────────────────────────────────────
const TENANT_SLUG = (() => {
  if (typeof window === 'undefined') return 'studio';
  const host = window.location.hostname || '';
  const first = (host.split('.')[0] || '').toLowerCase();
  if (host.includes('.preview.emergentagent.com')) return 'studio';
  if (['studio', 'blueprint', 'www', 'localhost'].some((h) => first === h || first.startsWith(h))) return 'studio';
  return first || 'studio';
})();

// ── Locale utilities ─────────────────────────────────────────────────────────
const L = (obj, locale) => {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  const norm = (locale || 'it').toLowerCase();
  const en   = norm.startsWith('en');
  return obj[en ? 'en-US' : 'it'] || obj[en ? 'en' : 'en-US'] || obj._default || Object.values(obj)[0] || '';
};

const bag = (section, locale) => {
  if (!section) return {};
  const lc  = section.locale_content || {};
  const norm = (locale || 'it').toLowerCase();
  if (norm.startsWith('en')) return { ...(lc._default || {}), ...(lc['en-US'] || lc.en || {}) };
  return { ...(lc._default || {}), ...(lc.it || {}) };
};

// ── Loading skeleton ─────────────────────────────────────────────────────────
const ProSkeleton = () => (
  <div className="pro-skeleton" aria-label="Caricamento in corso…">
    <div className="pro-skeleton__bar pro-skeleton__bar--hero" />
    <div className="pro-skeleton__bar pro-skeleton__bar--text" />
    <div className="pro-skeleton__bar pro-skeleton__bar--text" />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Sezione 1 — Hero (hero_editorial)
// ─────────────────────────────────────────────────────────────────────────────
const ProHero = ({ locale, sec }) => {
  if (!sec) return null;
  const b        = bag(sec, locale);
  const settings = sec.settings || {};
  const img      = settings.bg_image || b.image || '';
  const title    = b.title || '';
  const sub      = b.sub   || '';
  const eyebrow  = b.eyebrow || '';
  const cta1     = b.cta_primary   || (locale === 'en' ? 'Propose a collaboration' : 'Proponi una collaborazione');
  const cta2     = b.cta_secondary || (locale === 'en' ? 'Discover our projects' : 'Scopri i nostri progetti');
  const href1    = settings.cta_primary_href   || '/partner-application';
  const href2    = settings.cta_secondary_href || '/projects';

  return (
    <section className="mfd-home-hero mfd-pro-hero" data-testid="pro-hero">
      <div className="mfd-home-hero__bg" aria-hidden="true">
        {img && <img src={img} alt="" loading="eager" />}
        <span className="mfd-home-hero__veil" style={{ opacity: 0.52 }} />
      </div>
      <div className="mfd-home-hero__inner">
        <div className="mfd-home-hero__content">
          {eyebrow && (
            <p className="mfd-section-eyebrow" style={{ color: 'rgba(255,255,255,0.72)', marginBottom: '1.5rem' }} data-testid="pro-eyebrow">
              {eyebrow}
            </p>
          )}
          <h1 className="mfd-home-hero__title" data-testid="pro-title">
            {title.split('\n').map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
          </h1>
          {sub && <p className="mfd-home-hero__sub" data-testid="pro-sub">{sub}</p>}
          <div className="mfd-home-hero__ctas">
            {cta1 && (
              <Link to={href1} className="mfd-cta mfd-cta--solid" data-testid="pro-cta-primary">
                {cta1}
              </Link>
            )}
            {cta2 && (
              <Link to={href2} className="mfd-cta mfd-cta--ghost" data-testid="pro-cta-secondary">
                {cta2}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sezione 2 — Manifesto Collaborazione (atmosphere_statement)
// ─────────────────────────────────────────────────────────────────────────────
const ProManifesto = ({ locale, sec }) => {
  if (!sec) return null;
  const b        = bag(sec, locale);
  const settings = sec.settings || {};
  const eyebrow  = b.eyebrow || '';
  const title    = b.title   || '';
  const body     = b.body    || '';
  const cta      = b.cta     || '';
  const ctaHref  = settings.cta_href || '/about';
  if (!title && !body) return null;

  return (
    <section className="mfd-editorial-stmt mfd-pro-manifesto" data-testid="pro-manifesto">
      <div className="mfd-editorial-stmt__inner">
        {eyebrow && <p className="mfd-editorial-stmt__eyebrow" data-testid="pro-manifesto-eyebrow">{eyebrow}</p>}
        <blockquote className="mfd-editorial-stmt__quote" data-testid="pro-manifesto-title">
          {title.split('\n').map((line, i) => <span key={i}>{line}</span>)}
        </blockquote>
        {body && <p className="mfd-editorial-stmt__body" data-testid="pro-manifesto-body">{body}</p>}
        {cta && (
          <Link to={ctaHref} className="mfd-editorial-stmt__cta" data-testid="pro-manifesto-cta">
            {cta} <ArrowRight size={14} strokeWidth={1.6} />
          </Link>
        )}
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sezione 3 — Triptych (editorial_triptych)
// ─────────────────────────────────────────────────────────────────────────────
const ProTriptych = ({ locale, sec }) => {
  if (!sec) return null;
  const b        = bag(sec, locale);
  const eyebrow  = b.eyebrow || '';
  const title    = b.title   || '';
  const blocks   = b.blocks  || [];
  if (!blocks.length) return null;

  return (
    <section className="mfd-pro-triptych" data-testid="pro-triptych">
      <div className="mfd-pro-triptych__inner">
        <header className="mfd-section-head">
          {eyebrow && <p className="mfd-section-eyebrow" data-testid="pro-triptych-eyebrow">{eyebrow}</p>}
          {title && (
            <h2 className="mfd-section-title" data-testid="pro-triptych-title">
              {title.split('\n').map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
            </h2>
          )}
        </header>
        <div className="mfd-pro-triptych__grid">
          {blocks.map((bl, i) => (
            <div key={bl.id || i} className="mfd-pro-triptych__card" data-testid={`pro-triptych-card-${i + 1}`}>
              <span className="mfd-pro-triptych__num">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mfd-pro-triptych__card-title">{L(bl.title, locale) || bl.title}</h3>
              <p className="mfd-pro-triptych__card-body">{L(bl.body, locale) || bl.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sezione 4 — Processo (design_journey)
// ─────────────────────────────────────────────────────────────────────────────
const ProProcess = ({ locale, sec }) => {
  if (!sec) return null;
  const b        = bag(sec, locale);
  const settings = sec.settings || {};
  const eyebrow  = b.eyebrow || '';
  const title    = b.title   || '';
  const ctaLabel = b.cta     || (locale === 'en' ? 'Propose a collaboration' : 'Proponi una collaborazione');
  const ctaHref  = settings.cta_href || '/partner-application';
  const steps    = (settings.steps || []);
  if (!steps.length) return null;

  return (
    <section className="mfd-how mfd-pro-process" data-testid="pro-process">
      <div className="mfd-how__inner">
        <header className="mfd-section-head">
          {eyebrow && <p className="mfd-section-eyebrow" data-testid="pro-process-eyebrow">{eyebrow}</p>}
          {title && (
            <h2 className="mfd-section-title" data-testid="pro-process-title">
              {title.split('\n').map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
            </h2>
          )}
        </header>
        <ol
          className="mfd-how__steps"
          style={{ '--how-cols': Math.min(steps.length, 4) }}
          data-testid="pro-process-steps"
        >
          {steps.map((step) => (
            <li key={step.id} className="mfd-how__step">
              <span className="mfd-how__step-num">{step.id}</span>
              <div className="mfd-how__step-body">
                <h3 className="mfd-how__step-title">{L(step.title, locale)}</h3>
                <p className="mfd-how__step-text">{L(step.body, locale)}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mfd-how__cta-wrap">
          <Link to={ctaHref} className="mfd-cta mfd-cta--outline" data-testid="pro-process-cta">
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sezione 5 — Chi Collabora (professionals_cta)
// ─────────────────────────────────────────────────────────────────────────────
const ProCollaborators = ({ locale, sec }) => {
  if (!sec) return null;
  const b        = bag(sec, locale);
  const settings = sec.settings || {};
  const eyebrow  = b.eyebrow || '';
  const title    = b.title   || '';
  const body     = b.body    || '';
  const ctaLabel = b.cta     || (locale === 'en' ? 'Join the professional network' : 'Entra nella rete professionale');
  const ctaHref  = settings.cta_href || '/partner-application';
  const profBlocks = (b.blocks || []);
  if (!title && !body) return null;

  return (
    <section className="mfd-pro-collaborators" data-testid="pro-collaborators">
      <div className="mfd-pro-collaborators__inner">
        <div className="mfd-pro-collaborators__text">
          {eyebrow && <p className="mfd-section-eyebrow" data-testid="pro-collab-eyebrow">{eyebrow}</p>}
          {title && (
            <h2 className="mfd-section-title" data-testid="pro-collab-title">
              {title.split('\n').map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
            </h2>
          )}
          {body && <p className="mfd-pro-collaborators__body" data-testid="pro-collab-body">{body}</p>}
          {profBlocks.length > 0 && (
            <div className="mfd-pro-collaborators__tags" data-testid="pro-collab-tags">
              {profBlocks.map((pb, i) => (
                <span key={pb.id || i} className="mfd-pro-tag">
                  {L(pb.label, locale) || pb.label}
                </span>
              ))}
            </div>
          )}
          <Link to={ctaHref} className="mfd-cta mfd-cta--solid" data-testid="pro-collab-cta">
            {ctaLabel}
          </Link>
        </div>
        <div className="mfd-pro-collaborators__visual" aria-hidden="true">
          <div className="mfd-pro-collaborators__accent-block" />
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sezione inline A — Partner Types Grid (Chi collabora)
// ─────────────────────────────────────────────────────────────────────────────
const PARTNER_TYPES = [
  { id: 'architect',        icon: Building2,   it: 'Architetti',        en: 'Architects',        desc_it: 'Studi di architettura che cercano un partner operativo per la fase esecutiva.', desc_en: 'Architecture firms looking for an operational partner for the execution phase.' },
  { id: 'interior_designer',icon: Home,        it: 'Interior Designer', en: 'Interior Designers', desc_it: 'Designer indipendenti che vogliono amplificare la portata dei loro progetti.', desc_en: 'Independent designers who want to amplify the scope of their projects.' },
  { id: 'contractor',       icon: Hammer,      it: 'Contractor',        en: 'Contractors',        desc_it: 'General contractor e imprese che gestiscono cantieri di qualità elevata.', desc_en: 'General contractors and firms managing high-quality construction sites.' },
  { id: 'showroom',         icon: Store,       it: 'Showroom',          en: 'Showrooms',          desc_it: 'Showroom e distributori di materiali premium alla ricerca di progetti di riferimento.', desc_en: 'Premium material showrooms and distributors looking for showcase projects.' },
  { id: 'brand',            icon: Tag,         it: 'Brand',             en: 'Brands',             desc_it: 'Brand di arredo e prodotto che cercano visibilità su progetti residenziali e hospitality.', desc_en: 'Furniture and product brands seeking visibility on residential and hospitality projects.' },
  { id: 'developer',        icon: LayoutGrid,  it: 'Developer',         en: 'Developers',         desc_it: 'Developer immobiliari che vogliono elevare la qualità progettuale dei propri interventi.', desc_en: 'Real estate developers who want to elevate the design quality of their projects.' },
];

const PartnerTypesGrid = ({ locale }) => {
  const en = (locale || 'it').startsWith('en');
  return (
    <section className="mfd-partner-types" data-testid="partner-types-grid">
      <div className="mfd-partner-types__inner">
        <header className="mfd-section-head">
          <p className="mfd-section-eyebrow" data-testid="partner-types-eyebrow">
            {en ? 'WHO COLLABORATES WITH US' : 'CHI COLLABORA CON NOI'}
          </p>
          <h2 className="mfd-section-title" data-testid="partner-types-title">
            {en ? <>Professionals who share<span style={{display:'block'}}>our vision.</span></> : <>Professionisti che condividono<span style={{display:'block'}}>la nostra visione.</span></>}
          </h2>
        </header>
        <div className="mfd-partner-types__grid">
          {PARTNER_TYPES.map((pt) => {
            const Icon = pt.icon;
            return (
              <div key={pt.id} className="mfd-partner-type-card" data-testid={`partner-type-${pt.id}`}>
                <div className="mfd-partner-type-card__icon">
                  <Icon size={22} strokeWidth={1.4} />
                </div>
                <h3 className="mfd-partner-type-card__title">{en ? pt.en : pt.it}</h3>
                <p className="mfd-partner-type-card__desc">{en ? pt.desc_en : pt.desc_it}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sezione inline B — Partner Case Studies (Progetti sviluppati insieme)
// ─────────────────────────────────────────────────────────────────────────────
const CASE_STUDIES = [
  {
    id: 'cs1',
    partner_it: 'Studio Arch. M. Ferrante',
    partner_en: 'Arch. M. Ferrante Studio',
    role_it: 'Progetto architettonico',
    role_en: 'Architectural design',
    title_it: 'Villa privata, Brianza',
    title_en: 'Private Villa, Brianza',
    result_it: 'Ristrutturazione completa 480 mq — 14 mesi, consegnato entro budget.',
    result_en: 'Full renovation 480 sqm — 14 months, delivered within budget.',
    image: 'https://images.pexels.com/photos/4968694/pexels-photo-4968694.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
  },
  {
    id: 'cs2',
    partner_it: 'Showroom Material Lab',
    partner_en: 'Material Lab Showroom',
    role_it: 'Fornitura materiali lapidei',
    role_en: 'Stone materials supply',
    title_it: 'Resort boutique, Costiera',
    title_en: 'Boutique Resort, Amalfi Coast',
    result_it: '23 suite — selezione materiali premium, posa e supervisione cantiere.',
    result_en: '23 suites — premium material selection, laying and site supervision.',
    image: 'https://images.pexels.com/photos/5582590/pexels-photo-5582590.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
  },
  {
    id: 'cs3',
    partner_it: 'GC Costruzioni Srl',
    partner_en: 'GC Costruzioni Srl',
    role_it: 'General Contractor',
    role_en: 'General Contractor',
    title_it: 'Penthouse Milano, Zona Magenta',
    title_en: 'Penthouse Milan, Magenta District',
    result_it: 'Penthouse 320 mq — progettazione esecutiva e cantieristica integrata.',
    result_en: '320 sqm penthouse — executive design and integrated construction management.',
    image: 'https://images.pexels.com/photos/23496714/pexels-photo-23496714.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
  },
];

const PartnerCaseStudies = ({ locale }) => {
  const en = (locale || 'it').startsWith('en');
  return (
    <section className="mfd-partner-cases" data-testid="partner-case-studies">
      <div className="mfd-partner-cases__inner">
        <header className="mfd-section-head mfd-section-head--with-link">
          <div>
            <p className="mfd-section-eyebrow" data-testid="partner-cases-eyebrow">
              {en ? 'PROJECTS BUILT TOGETHER' : 'PROGETTI SVILUPPATI INSIEME'}
            </p>
            <h2 className="mfd-section-title" data-testid="partner-cases-title">
              {en ? <>Partner&nbsp;+&nbsp;Studio<span style={{display:'block'}}>= risultato.</span></> : <>Partner&nbsp;+&nbsp;Studio<span style={{display:'block'}}>= risultato.</span></>}
            </h2>
          </div>
        </header>
        <div className="mfd-partner-cases__grid">
          {CASE_STUDIES.map((cs) => (
            <article key={cs.id} className="mfd-partner-case-card" data-testid={`partner-case-${cs.id}`}>
              <div className="mfd-partner-case-card__image">
                <img src={cs.image} alt={en ? cs.title_en : cs.title_it} loading="lazy" />
                <div className="mfd-partner-case-card__badge">
                  <span>{en ? cs.partner_en : cs.partner_it}</span>
                  <span className="mfd-partner-case-card__plus">+</span>
                  <span>MOOD for DESIGN</span>
                </div>
              </div>
              <div className="mfd-partner-case-card__body">
                <p className="mfd-partner-case-card__role">{en ? cs.role_en : cs.role_it}</p>
                <h3 className="mfd-partner-case-card__title">{en ? cs.title_en : cs.title_it}</h3>
                <p className="mfd-partner-case-card__result">{en ? cs.result_en : cs.result_it}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sezione 6 — CTA Finale (cinematic_quote)
// ─────────────────────────────────────────────────────────────────────────────
const ProFinalCTA = ({ locale, sec }) => {
  if (!sec) return null;
  const b        = bag(sec, locale);
  const settings = sec.settings || {};
  const title    = b.title   || '';
  const sub      = b.sub     || '';
  const cta1     = b.private || (locale === 'en' ? 'Propose a collaboration' : 'Proponi una collaborazione');
  const cta2     = b.pro     || (locale === 'en' ? 'Join the professional network' : 'Entra nella rete professionale');
  const href1    = settings.private_href || '/partner-application';
  const href2    = settings.pro_href     || '/partner-application';
  if (!title) return null;

  return (
    <section className="mfd-finalcta mfd-pro-finalcta" data-testid="pro-finalcta">
      <div className="mfd-finalcta__inner">
        <div className="mfd-finalcta__text">
          <h2 className="mfd-finalcta__title" data-testid="pro-finalcta-title">
            {title.split('\n').map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
          </h2>
          {sub && <p className="mfd-finalcta__sub" data-testid="pro-finalcta-sub">{sub}</p>}
        </div>
        <div className="mfd-finalcta__paths">
          <Link to={href1} className="mfd-finalcta__path" data-testid="pro-finalcta-cta1">
            <span className="mfd-finalcta__path-label">{cta1}</span>
            <ArrowRight size={16} strokeWidth={1.5} />
          </Link>
          <Link to={href2} className="mfd-finalcta__path mfd-finalcta__path--outline" data-testid="pro-finalcta-cta2">
            <span className="mfd-finalcta__path-label">{cta2}</span>
            <ArrowRight size={16} strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Root: ProfessionalsGatewayPage
// ─────────────────────────────────────────────────────────────────────────────
const ProfessionalsGatewayPage = () => {
  const site   = useSite();
  const locale = (site?.locale || 'it').slice(0, 2);
  const cms    = useStorefrontContent(TENANT_SLUG, 'professionals');

  useEffect(() => {
    document.title = locale === 'en'
      ? 'Partner Network — Studio'
      : 'Partner Network — Studio';
  }, [locale]);

  if (cms?.loading) return <ProSkeleton />;

  const sections = cms?.page?.sections || [];
  const byType   = (type) => sections.find((s) => s.section_type === type) || null;

  const heroSec    = byType('hero_editorial');
  const manifestoSec = byType('atmosphere_statement');
  const triptychSec  = byType('editorial_triptych');
  const processSec   = byType('design_journey');
  const collabSec    = byType('professionals_cta');
  const finalCtaSec  = byType('cinematic_quote');

  return (
    <div data-testid="professionals-gateway-page">
      <main>
        <ProHero          locale={locale} sec={heroSec} />
        <ProManifesto     locale={locale} sec={manifestoSec} />
        <PartnerTypesGrid locale={locale} />
        <ProTriptych      locale={locale} sec={triptychSec} />
        <ProProcess       locale={locale} sec={processSec} />
        <PartnerCaseStudies locale={locale} />
        <ProCollaborators locale={locale} sec={collabSec} />
        <ProFinalCTA      locale={locale} sec={finalCtaSec} />
      </main>
    </div>
  );
};

export default ProfessionalsGatewayPage;
