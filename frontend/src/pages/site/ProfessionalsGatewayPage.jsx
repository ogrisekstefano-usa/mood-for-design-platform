/**
 * ProfessionalsGatewayPage — Pagina Professionisti
 * ═══════════════════════════════════════════════════
 * Completamente CMS-driven via useStorefrontContent('professionals').
 *
 * Sezioni (riutilizzano section types esistenti — ZERO nuove tabelle):
 *   1. ProHero          — hero_editorial
 *   2. ProManifesto     — atmosphere_statement
 *   3. ProTriptych      — editorial_triptych (3 vantaggi)
 *   4. ProProcess       — design_journey (4 step)
 *   5. ProCTA           — professionals_cta
 *   6. ProFinalCTA      — cinematic_quote
 *
 * Obiettivo: parlare ad architetti, designer, contractor, showroom.
 * Vendere la collaborazione, non il servizio software.
 * CTA unica: "Prenota una consulenza" → /consulenza
 */
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
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
  const img      = b.image || '';
  const title    = b.title || '';
  const sub      = b.sub   || '';
  const eyebrow  = b.eyebrow || '';
  const cta1     = b.cta_primary   || (locale === 'en' ? 'Book a consultation' : 'Prenota una consulenza');
  const cta2     = b.cta_secondary || (locale === 'en' ? 'Discover our projects' : 'Scopri i nostri progetti');
  const href1    = settings.cta_primary_href   || '/consulenza';
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
  const ctaLabel = b.cta     || (locale === 'en' ? 'Book a consultation' : 'Prenota una consulenza');
  const ctaHref  = settings.cta_href || '/consulenza';
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
  const ctaLabel = b.cta     || (locale === 'en' ? 'Book a consultation' : 'Prenota una consulenza');
  const ctaHref  = settings.cta_href || '/consulenza';
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
// Sezione 6 — CTA Finale (cinematic_quote)
// ─────────────────────────────────────────────────────────────────────────────
const ProFinalCTA = ({ locale, sec }) => {
  if (!sec) return null;
  const b        = bag(sec, locale);
  const settings = sec.settings || {};
  const title    = b.title   || '';
  const sub      = b.sub     || '';
  const cta1     = b.private || (locale === 'en' ? 'Book a consultation' : 'Prenota una consulenza');
  const cta2     = b.pro     || (locale === 'en' ? 'Discover our projects' : 'Scopri i nostri progetti');
  const href1    = settings.private_href || '/consulenza';
  const href2    = settings.pro_href     || '/projects';
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
      ? 'For Professionals — Studio'
      : 'Per Professionisti — Studio';
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
        <ProTriptych      locale={locale} sec={triptychSec} />
        <ProProcess       locale={locale} sec={processSec} />
        <ProCollaborators locale={locale} sec={collabSec} />
        <ProFinalCTA      locale={locale} sec={finalCtaSec} />
      </main>
    </div>
  );
};

export default ProfessionalsGatewayPage;
