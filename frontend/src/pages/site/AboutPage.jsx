/**
 * AboutPage — Chi siamo / About Studio
 * ════════════════════════════════════
 * Completamente CMS-driven via `useStorefrontContent('about')`.
 * Sezioni:
 *   1. AboutHero           — hero cinematico studio
 *   2. Manifesto           — filosofia (atmosphere_statement)
 *   3. TeamSection         — team (team_identity_card + API live)
 *   4. ApproachSection     — come lavoriamo (design_journey)
 *   5. StatsSection        — numeri chiave (stats_band)
 *   6. ProjectsTeaser      — portfolio (featured_design_journeys)
 *   7. ContactCTA          — CTA contatto (cinematic_quote)
 *
 * Nessuna nuova tabella. Tutti i dati vengono dalle tabelle esistenti:
 *   cms_sections, published_design_journeys, users_profile.
 *
 * Usato con SiteLayout — non ha bisogno di provider propri.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useSite } from '../../site/SiteContext';
import { useStorefrontContent } from '../../site/useStorefrontContent';
import './home-iter150.css';

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
  const en  = norm.startsWith('en');
  return obj[en ? 'en-US' : 'it'] || obj[en ? 'en' : 'en-US'] || obj._default || Object.values(obj)[0] || '';
};

const resolveBag = (bag, locale) => {
  if (!bag || typeof bag !== 'object') return {};
  const norm = (locale || 'it').toLowerCase();
  if (norm.startsWith('en')) return { ...(bag._default || {}), ...(bag['en-US'] || bag.en || {}) };
  return { ...(bag._default || {}), ...(bag.it || {}) };
};

// ── Data hooks ───────────────────────────────────────────────────────────────
const usePublishedJourneys = (locale) => {
  const [state, setState] = useState({ items: [], loading: true });
  useEffect(() => {
    let cancelled = false;
    const loc = locale === 'en' ? 'en-US' : 'it-IT';
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/public/published-journeys/${TENANT_SLUG}/feed?locale=${encodeURIComponent(loc)}&featured_only=true&limit=3`;
    fetch(url)
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d) => { if (!cancelled) setState({ items: d.items || [], loading: false }); })
      .catch(() => { if (!cancelled) setState({ items: [], loading: false }); });
    return () => { cancelled = true; };
  }, [locale]);
  return state;
};

const useTeamLeaders = () => {
  const [state, setState] = useState({ leaders: [], loading: true });
  useEffect(() => {
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/storefront/public/${TENANT_SLUG}/team-leaders?max_leaders=1`;
    fetch(url)
      .then((r) => r.ok ? r.json() : { leaders: [] })
      .then((d) => setState({ leaders: d.leaders || [], loading: false }))
      .catch(() => setState({ leaders: [], loading: false }));
  }, []);
  return state;
};

// ── Section: Hero ─────────────────────────────────────────────────────────────
const AboutHero = ({ locale, sec }) => {
  const bag = resolveBag(sec?.locale_content, locale);
  const img = bag.image || '';
  const title = bag.title || '';
  const sub = bag.sub || '';
  const eyebrow = bag.eyebrow || '';
  const cta1 = bag.cta_primary || (locale === 'en' ? 'Start a project' : 'Inizia un progetto');
  const cta2 = bag.cta_secondary || (locale === 'en' ? 'For professionals' : 'Per i professionisti');
  const settings = sec?.settings || {};

  return (
    <section className="mfd-home-hero mfd-about-hero" data-testid="about-hero">
      <div className="mfd-home-hero__bg" aria-hidden="true">
        {img && <img src={img} alt="" loading="eager" />}
        <span className="mfd-home-hero__veil" style={{ opacity: 0.55 }} />
      </div>
      <div className="mfd-home-hero__inner">
        <div className="mfd-home-hero__content">
          {eyebrow && <p className="mfd-section-eyebrow" style={{ color: 'rgba(255,255,255,0.75)', marginBottom: '1.5rem' }}>{eyebrow}</p>}
          <h1 className="mfd-home-hero__title" data-testid="about-hero-title">
            {title.split('\n').map((line, i) => (
              <span key={i} className="mfd-home-hero__title-line">{line}</span>
            ))}
          </h1>
          {sub && <p className="mfd-home-hero__sub" data-testid="about-hero-sub">{sub}</p>}
          <div className="mfd-home-hero__ctas">
            <Link to={settings.cta_primary_href || '/begin-journey'} className="mfd-cta mfd-cta--solid" data-testid="about-hero-cta-primary">{cta1}</Link>
            <Link to={settings.cta_secondary_href || '/professionals'} className="mfd-cta mfd-cta--ghost" data-testid="about-hero-cta-secondary">{cta2}</Link>
          </div>
        </div>
      </div>
    </section>
  );
};

// ── Section: Manifesto ───────────────────────────────────────────────────────
const Manifesto = ({ locale, sec }) => {
  const bag = resolveBag(sec?.locale_content, locale);
  const eyebrow = bag.eyebrow || '';
  const title = bag.title || '';
  const body = bag.body || '';
  const quote = bag.quote || '';
  const cta = bag.cta || '';
  const settings = sec?.settings || {};

  return (
    <section className="mfd-manifesto" data-testid="about-manifesto" style={{
      padding: '7rem 0',
      background: 'var(--clr-bg, #F5F2ED)',
    }}>
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '0 2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'center' }}>
        <div>
          {eyebrow && <p className="mfd-section-eyebrow" data-testid="about-manifesto-eyebrow">{eyebrow}</p>}
          <h2 className="mfd-section-title" data-testid="about-manifesto-title" style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)', lineHeight: 1.1, marginTop: '1rem' }}>
            {title.split('\n').map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
          </h2>
          {cta && (
            <Link to={settings.cta_href || '/projects'} className="mfd-cta mfd-cta--outline" style={{ marginTop: '2.5rem', display: 'inline-flex' }} data-testid="about-manifesto-cta">
              {cta} <ArrowRight size={14} strokeWidth={1.6} style={{ marginLeft: 8 }} />
            </Link>
          )}
        </div>
        <div>
          {body && <p style={{ fontSize: '1.0625rem', lineHeight: 1.8, color: 'var(--clr-text, #2A2A2A)', marginBottom: '2.5rem' }} data-testid="about-manifesto-body">{body}</p>}
          {quote && (
            <blockquote style={{ margin: 0, paddingLeft: '1.5rem', borderLeft: '2px solid var(--clr-accent, #00C9B3)', fontStyle: 'italic', fontSize: '1.0625rem', lineHeight: 1.7, color: 'var(--clr-text, #2A2A2A)' }} data-testid="about-manifesto-quote">
              &ldquo;{quote}&rdquo;
            </blockquote>
          )}
        </div>
      </div>
    </section>
  );
};

// ── Section: Team ────────────────────────────────────────────────────────────
const TeamSection = ({ locale, sec }) => {
  const bag = resolveBag(sec?.locale_content, locale);
  const { leaders, loading } = useTeamLeaders();
  const settings = sec?.settings || {};
  const eyebrow = bag.eyebrow || '';
  const headline = bag.headline || '';
  const subheadline = bag.subheadline || '';
  const ctaLabel = bag.cta_label || (locale === 'en' ? 'Start a conversation' : 'Inizia una conversazione');
  const ctaHref = settings.cta_href || '/begin-journey';

  const leader = leaders[0];

  return (
    <section className="mfd-team" data-testid="about-team" style={{
      padding: '7rem 0',
      background: '#1C1C1C',
      color: '#F5F2ED',
    }}>
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '0 2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'center' }}>
        {/* Portrait */}
        <div style={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden', background: '#2A2A2A' }}>
          {!loading && leader?.avatar_url ? (
            <img src={leader.avatar_url} alt={leader.display_name || 'Studio'} loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
              data-testid="about-team-avatar"
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #2A2A2A 0%, #3A3A3A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#666', fontSize: '4rem', fontWeight: 200 }}>◇</span>
            </div>
          )}
          {!loading && leader && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '2rem', background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
              <p style={{ margin: 0, fontSize: '1.125rem', fontWeight: 500, letterSpacing: '0.01em' }}>{leader.display_name}</p>
              {leader.role_label && <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'rgba(245,242,237,0.65)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{leader.role_label}</p>}
            </div>
          )}
        </div>
        {/* Copy */}
        <div>
          {eyebrow && <p style={{ fontSize: '0.8125rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(245,242,237,0.5)', marginBottom: '1.5rem' }} data-testid="about-team-eyebrow">{eyebrow}</p>}
          {headline && (
            <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', lineHeight: 1.1, fontWeight: 400, marginBottom: '2rem' }} data-testid="about-team-headline">
              {headline.split('\n').map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
            </h2>
          )}
          {!loading && leader?.short_bio && (
            <p style={{ fontSize: '1rem', lineHeight: 1.8, color: 'rgba(245,242,237,0.75)', marginBottom: '2rem' }} data-testid="about-team-bio">{leader.short_bio}</p>
          )}
          {subheadline && (
            <p style={{ fontSize: '1rem', lineHeight: 1.8, color: 'rgba(245,242,237,0.65)', marginBottom: '2.5rem' }} data-testid="about-team-subheadline">{subheadline}</p>
          )}
          <Link to={ctaHref} className="mfd-cta mfd-cta--solid" data-testid="about-team-cta">{ctaLabel}</Link>
        </div>
      </div>
    </section>
  );
};

// ── Section: Approach ─────────────────────────────────────────────────────────
const ApproachSection = ({ locale, sec }) => {
  const bag = resolveBag(sec?.locale_content, locale);
  const settings = sec?.settings || {};
  const eyebrow = bag.eyebrow || '';
  const title = bag.title || '';
  const cta = bag.cta || '';
  const steps = Array.isArray(settings.steps) ? settings.steps : [];

  if (!steps.length && !title) return null;

  return (
    <section className="mfd-how" id="about-approach" data-testid="about-approach" style={{ background: 'var(--clr-bg, #F5F2ED)' }}>
      <div className="mfd-how__inner">
        <header className="mfd-section-head">
          {eyebrow && <p className="mfd-section-eyebrow" data-testid="about-approach-eyebrow">{eyebrow}</p>}
          {title && (
            <h2 className="mfd-section-title" data-testid="about-approach-title">
              {title.split('\n').map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
            </h2>
          )}
        </header>
        {steps.length > 0 && (
          <ol className="mfd-how__steps">
            {steps.map((s) => (
              <li key={s.id} className="mfd-how__step" data-testid={`about-approach-step-${s.id}`}>
                <span className="mfd-how__step-num">{s.id}</span>
                <div className="mfd-how__step-body">
                  <h3 className="mfd-how__step-title">{L(s.title, locale)}</h3>
                  <p className="mfd-how__step-text">{L(s.body, locale)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
        {cta && (
          <div className="mfd-how__cta-wrap">
            <Link to={settings.cta_href || '/begin-journey'} className="mfd-cta mfd-cta--outline" data-testid="about-approach-cta">{cta}</Link>
          </div>
        )}
      </div>
    </section>
  );
};

// ── Section: Stats ────────────────────────────────────────────────────────────
const StatsSection = ({ locale, sec }) => {
  const bag = resolveBag(sec?.locale_content, locale);
  const settings = sec?.settings || {};
  const eyebrow = bag.eyebrow || '';
  const sectionTitle = bag.section_title || '';
  const stats = Array.isArray(settings.stats) ? settings.stats : [];

  if (!stats.length) return null;

  return (
    <section className="mfd-stats-band" data-testid="about-stats" style={{
      padding: '6rem 0',
      background: '#1C1C1C',
      color: '#F5F2ED',
    }}>
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '0 2rem' }}>
        {eyebrow && <p style={{ fontSize: '0.8125rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(245,242,237,0.45)', marginBottom: '1rem' }} data-testid="about-stats-eyebrow">{eyebrow}</p>}
        {sectionTitle && <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 400, marginBottom: '4rem', lineHeight: 1.2 }} data-testid="about-stats-title">{sectionTitle}</h2>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2.5rem' }}>
          {stats.map((s) => (
            <div key={s.id} data-testid={`about-stat-${s.id}`} style={{ borderTop: '1px solid rgba(245,242,237,0.12)', paddingTop: '1.5rem' }}>
              <p style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: 300, letterSpacing: '-0.02em', margin: 0, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: '0.875rem', color: 'rgba(245,242,237,0.55)', marginTop: '0.75rem', lineHeight: 1.4 }}>{L(s.label, locale)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── Section: Projects Teaser ──────────────────────────────────────────────────
const ProjectsTeaser = ({ locale, sec }) => {
  const bag = resolveBag(sec?.locale_content, locale);
  const { items, loading } = usePublishedJourneys(locale);
  const eyebrow = bag.eyebrow || '';
  const title = bag.title || '';
  const viewAll = bag.viewAll || (locale === 'en' ? 'View all projects' : 'Vedi tutti i progetti');

  if (loading) return <section className="mfd-stories mfd-stories--loading" aria-hidden="true" />;
  if (!items.length) return null;

  return (
    <section className="mfd-stories" id="about-projects" data-testid="about-projects" style={{ background: 'var(--clr-bg, #F5F2ED)' }}>
      <div className="mfd-stories__inner">
        <header className="mfd-section-head mfd-section-head--with-link">
          <div>
            {eyebrow && <p className="mfd-section-eyebrow" data-testid="about-projects-eyebrow">{eyebrow}</p>}
            {title && (
              <h2 className="mfd-section-title" data-testid="about-projects-title">
                {title.split('\n').map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
              </h2>
            )}
          </div>
          <Link to="/projects" className="mfd-section-link" data-testid="about-projects-view-all">
            {viewAll} <ArrowRight size={14} strokeWidth={1.6} />
          </Link>
        </header>
        <div className="mfd-stories__grid">
          {items.map((j) => (
            <Link key={j.id} to={`/projects/${j.slug}`} className="story-card" data-testid={`about-project-card-${j.slug}`}>
              <div className="story-card__media">
                {j.hero_url
                  ? <img src={j.hero_url} alt="" loading="lazy" />
                  : <div className="story-card__media-empty" aria-hidden="true" />
                }
              </div>
              <div className="story-card__body">
                <p className="story-card__kind">{j.location || j.atmosphere || ''}</p>
                <h3 className="story-card__title">{j.title}</h3>
                {j.editorial_excerpt && <p className="story-card__excerpt">{j.editorial_excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── Section: Contact CTA ──────────────────────────────────────────────────────
const ContactCTA = ({ locale, sec }) => {
  const bag = resolveBag(sec?.locale_content, locale);
  const settings = sec?.settings || {};
  const title = bag.title || '';
  const sub = bag.sub || '';
  const privateCta = bag.private || '';
  const proCta = bag.pro || '';

  return (
    <section className="mfd-finalcta" data-testid="about-contact-cta">
      <div className="mfd-finalcta__inner">
        <div className="mfd-finalcta__lede">
          {title && (
            <h2 className="mfd-finalcta__title" data-testid="about-cta-title">
              {title.split('\n').map((line, i) => <span key={i}>{line}</span>)}
            </h2>
          )}
          {sub && <p className="mfd-finalcta__sub" data-testid="about-cta-sub">{sub}</p>}
        </div>
        <div className="mfd-finalcta__paths">
          <Link to={settings.private_href || '/begin-journey'} className="mfd-finalcta__path" data-testid="about-cta-private">
            <span className="mfd-finalcta__path-label">{privateCta}</span>
          </Link>
          <Link to={settings.pro_href || '/professionals'} className="mfd-finalcta__path" data-testid="about-cta-pro">
            <span className="mfd-finalcta__path-label">{proCta}</span>
          </Link>
        </div>
      </div>
    </section>
  );
};

// ── Page Body ─────────────────────────────────────────────────────────────────
const AboutPageBody = () => {
  const site = useSite();
  const locale = (site?.locale || 'it').slice(0, 2);
  const cms = useStorefrontContent(TENANT_SLUG, 'about');
  const content = cms?.content || {};
  const sections = cms?.page?.sections || [];

  // Index sections by type for easy lookup
  const secByType = {};
  sections.forEach((s) => { secByType[s.section_type] = s; });

  return (
    <div className="mfd-about-page" data-testid="about-page">
      <AboutHero locale={locale} sec={secByType['hero_editorial']} />
      <Manifesto locale={locale} sec={secByType['atmosphere_statement']} />
      <TeamSection locale={locale} sec={secByType['team_identity_card']} />
      <ApproachSection locale={locale} sec={secByType['design_journey']} />
      <StatsSection locale={locale} sec={secByType['stats_band']} />
      <ProjectsTeaser locale={locale} sec={secByType['featured_design_journeys']} />
      <ContactCTA locale={locale} sec={secByType['cinematic_quote']} />
    </div>
  );
};

export default AboutPageBody;
