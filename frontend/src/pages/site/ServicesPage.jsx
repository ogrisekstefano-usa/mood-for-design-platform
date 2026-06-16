/**
 * ServicesPage — Pagina Servizi dello Studio
 * ═══════════════════════════════════════════
 * Completamente CMS-driven via useStorefrontContent('services').
 *
 * Sezioni (section types esistenti — ZERO nuove tabelle):
 *   1. ServicesHero       — hero_editorial
 *   2. ServicesTriptych   — editorial_triptych (4 tipologie)
 *   3. ServicesManifesto  — atmosphere_statement
 *   4. ServicesProcess    — design_journey (4 fasi)
 *   5. ServicesFinalCTA   — cinematic_quote
 *
 * Narrativa: tipologie (Residenziale/Hospitality/Contract/Retail) + processo
 * Tono: studio di progettazione premium, non catalogo di prodotti
 */
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useSite } from '../../site/SiteContext';
import { useStorefrontContent } from '../../site/useStorefrontContent';
import './home-iter150.css';
import './services.css';

const TENANT_SLUG = (() => {
  if (typeof window === 'undefined') return 'studio';
  const host  = window.location.hostname || '';
  const first = (host.split('.')[0] || '').toLowerCase();
  if (host.includes('.preview.emergentagent.com')) return 'studio';
  if (['studio', 'blueprint', 'www', 'localhost'].some((h) => first === h || first.startsWith(h))) return 'studio';
  return first || 'studio';
})();

// ── Utilities ────────────────────────────────────────────────────────────────
const L = (obj, locale) => {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  const norm = (locale || 'it').toLowerCase();
  const en   = norm.startsWith('en');
  return obj[en ? 'en-US' : 'it'] || obj[en ? 'en' : 'en-US'] || obj._default || Object.values(obj)[0] || '';
};

const bag = (section, locale) => {
  if (!section) return {};
  const lc   = section.locale_content || {};
  const norm  = (locale || 'it').toLowerCase();
  if (norm.startsWith('en')) return { ...(lc._default || {}), ...(lc['en-US'] || lc.en || {}) };
  return { ...(lc._default || {}), ...(lc.it || {}) };
};

// ─────────────────────────────────────────────────────────────────────────────
// Sezione 1 — Hero
// ─────────────────────────────────────────────────────────────────────────────
const ServicesHero = ({ locale, sec }) => {
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
    <section className="mfd-home-hero mfd-svc-hero" data-testid="services-hero">
      <div className="mfd-home-hero__bg" aria-hidden="true">
        {img && <img src={img} alt="" loading="eager" />}
        <span className="mfd-home-hero__veil" style={{ opacity: 0.52 }} />
      </div>
      <div className="mfd-home-hero__inner">
        <div className="mfd-home-hero__content">
          {eyebrow && (
            <p className="mfd-section-eyebrow" style={{ color: 'rgba(255,255,255,0.72)', marginBottom: '1.5rem' }} data-testid="services-hero-eyebrow">
              {eyebrow}
            </p>
          )}
          <h1 className="mfd-home-hero__title" data-testid="services-hero-title">
            {title.split('\n').map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
          </h1>
          {sub && <p className="mfd-home-hero__sub" data-testid="services-hero-sub">{sub}</p>}
          <div className="mfd-home-hero__ctas">
            {cta1 && (
              <Link to={href1} className="mfd-cta mfd-cta--solid" data-testid="services-hero-cta1">{cta1}</Link>
            )}
            {cta2 && (
              <Link to={href2} className="mfd-cta mfd-cta--ghost" data-testid="services-hero-cta2">{cta2}</Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sezione 2 — Triptych (4 tipologie)
// ─────────────────────────────────────────────────────────────────────────────
const ServicesTriptych = ({ locale, sec }) => {
  if (!sec) return null;
  const b      = bag(sec, locale);
  const blocks = b.blocks || [];
  if (!blocks.length) return null;

  return (
    <section className="mfd-svc-triptych" data-testid="services-triptych">
      <div className="mfd-svc-triptych__inner">
        <header className="mfd-section-head">
          {b.eyebrow && <p className="mfd-section-eyebrow" data-testid="services-triptych-eyebrow">{b.eyebrow}</p>}
          {b.title && (
            <h2 className="mfd-section-title" data-testid="services-triptych-title">
              {b.title.split('\n').map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
            </h2>
          )}
        </header>
        <div className="mfd-svc-triptych__grid" data-testid="services-triptych-grid">
          {blocks.map((bl, i) => (
            <article key={bl.id || i} className="mfd-svc-card" data-testid={`services-card-${i + 1}`}>
              <span className="mfd-svc-card__num">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mfd-svc-card__title">{L(bl.title, locale) || bl.title}</h3>
              <p className="mfd-svc-card__body">{L(bl.body, locale) || bl.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sezione 3 — Manifesto (atmosphere_statement)
// ─────────────────────────────────────────────────────────────────────────────
const ServicesManifesto = ({ locale, sec }) => {
  if (!sec) return null;
  const b       = bag(sec, locale);
  const settings = sec.settings || {};
  if (!b.title && !b.body) return null;

  return (
    <section className="mfd-editorial-stmt" data-testid="services-manifesto">
      <div className="mfd-editorial-stmt__inner">
        {b.eyebrow && <p className="mfd-editorial-stmt__eyebrow" data-testid="services-manifesto-eyebrow">{b.eyebrow}</p>}
        <blockquote className="mfd-editorial-stmt__quote" data-testid="services-manifesto-title">
          {(b.title || '').split('\n').map((line, i) => <span key={i}>{line}</span>)}
        </blockquote>
        {b.body && <p className="mfd-editorial-stmt__body" data-testid="services-manifesto-body">{b.body}</p>}
        {b.cta && (
          <Link to={settings.cta_href || '/about'} className="mfd-editorial-stmt__cta" data-testid="services-manifesto-cta">
            {b.cta} <ArrowRight size={14} strokeWidth={1.6} />
          </Link>
        )}
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sezione 4 — Processo (design_journey)
// ─────────────────────────────────────────────────────────────────────────────
const ServicesProcess = ({ locale, sec }) => {
  if (!sec) return null;
  const b        = bag(sec, locale);
  const settings = sec.settings || {};
  const steps    = settings.steps || [];
  if (!steps.length) return null;

  return (
    <section className="mfd-how mfd-svc-process" data-testid="services-process">
      <div className="mfd-how__inner">
        <header className="mfd-section-head">
          {b.eyebrow && <p className="mfd-section-eyebrow" data-testid="services-process-eyebrow">{b.eyebrow}</p>}
          {b.title && (
            <h2 className="mfd-section-title" data-testid="services-process-title">
              {b.title.split('\n').map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
            </h2>
          )}
        </header>
        <ol
          className="mfd-how__steps"
          style={{ '--how-cols': Math.min(steps.length, 4) }}
          data-testid="services-process-steps"
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
          <Link to={settings.cta_href || '/consulenza'} className="mfd-cta mfd-cta--outline" data-testid="services-process-cta">
            {b.cta || (locale === 'en' ? 'Book a consultation' : 'Prenota una consulenza')}
          </Link>
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sezione 5 — CTA Finale (cinematic_quote)
// ─────────────────────────────────────────────────────────────────────────────
const ServicesFinalCTA = ({ locale, sec }) => {
  if (!sec) return null;
  const b        = bag(sec, locale);
  const settings = sec.settings || {};
  if (!b.title) return null;

  return (
    <section className="mfd-finalcta mfd-svc-finalcta" data-testid="services-finalcta">
      <div className="mfd-finalcta__inner">
        <div className="mfd-finalcta__text">
          <h2 className="mfd-finalcta__title" data-testid="services-finalcta-title">
            {b.title.split('\n').map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
          </h2>
          {b.sub && <p className="mfd-finalcta__sub" data-testid="services-finalcta-sub">{b.sub}</p>}
        </div>
        <div className="mfd-finalcta__paths">
          <Link to={settings.private_href || '/consulenza'} className="mfd-finalcta__path" data-testid="services-finalcta-cta1">
            <span className="mfd-finalcta__path-label">{b.private || (locale === 'en' ? 'Book a consultation' : 'Prenota una consulenza')}</span>
            <ArrowRight size={16} strokeWidth={1.5} />
          </Link>
          <Link to={settings.pro_href || '/projects'} className="mfd-finalcta__path mfd-finalcta__path--outline" data-testid="services-finalcta-cta2">
            <span className="mfd-finalcta__path-label">{b.pro || (locale === 'en' ? 'Discover our projects' : 'Scopri i nostri progetti')}</span>
            <ArrowRight size={16} strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Root: ServicesPage
// ─────────────────────────────────────────────────────────────────────────────
const ServicesPage = () => {
  const site   = useSite();
  const locale = (site?.locale || 'it').slice(0, 2);
  const cms    = useStorefrontContent(TENANT_SLUG, 'services');

  useEffect(() => {
    document.title = locale === 'en'
      ? 'Services — Studio'
      : 'Servizi — Studio';
  }, [locale]);

  const sections = cms?.page?.sections || [];
  const byType   = (type) => sections.find((s) => s.section_type === type) || null;

  return (
    <div data-testid="services-page">
      <main>
        <ServicesHero      locale={locale} sec={byType('hero_editorial')} />
        <ServicesTriptych  locale={locale} sec={byType('editorial_triptych')} />
        <ServicesManifesto locale={locale} sec={byType('atmosphere_statement')} />
        <ServicesProcess   locale={locale} sec={byType('design_journey')} />
        <ServicesFinalCTA  locale={locale} sec={byType('cinematic_quote')} />
      </main>
    </div>
  );
};

export default ServicesPage;
