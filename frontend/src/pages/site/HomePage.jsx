import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Gem, Users, Sparkles, Globe, ShieldCheck } from 'lucide-react';
import { useSite } from '../../site/SiteContext';
import { homepageContent } from '../../site/content/homepage';
import { tenantConfig } from '../../site/content/tenant';
import { useStorefrontContent } from '../../site/useStorefrontContent';
import { Reveal } from '../../site/components/Reveal';

const ICONS = { gem: Gem, users: Users, sparkles: Sparkles, globe: Globe, 'shield-check': ShieldCheck };

// Merge DB CMS content over the legacy JS config so the JSX below stays
// unchanged. Per locale key (`it`, `en-US`, ...), DB values win; per non-locale
// field (e.g. image URLs in settings), DB settings win.
const buildLocaleBag = (db, legacy, field) => {
  // legacy is { it, en, fr, de, es } — preserve as the base
  const merged = { ...(legacy || {}) };
  if (db && typeof db === 'object') {
    for (const code of Object.keys(db)) {
      if (code.startsWith('_')) continue;
      const v = db[code]?.[field];
      if (v != null && v !== '') {
        // Map en-US → en for legacy resolver compatibility
        const legacyCode = code === 'en-US' ? 'en' : code === 'en-GB' ? 'en' : code;
        merged[legacyCode] = v;
      }
    }
    if (db._default?.[field] != null && db._default[field] !== '') {
      merged._default = db._default[field];
    }
  }
  return merged;
};

const mergeHomepage = (legacy, content) => {
  if (!content || Object.keys(content).length === 0) return legacy;
  const hero = content.store_hero;
  const dual = content.dual_cta;
  const vp = content.value_props;
  const pi = content.projects_preview;
  const nl = content.newsletter;
  const out = { ...legacy };
  if (hero) {
    out.hero = {
      ...legacy.hero,
      backgroundImage: hero._settings?.background_image_url || legacy.hero.backgroundImage,
      headline:        buildLocaleBag(hero, legacy.hero.headline,        'headline'),
      sub:             buildLocaleBag(hero, legacy.hero.sub,             'sub'),
      overline:        buildLocaleBag(hero, legacy.hero.overline,        'overline'),
      overlineItalic:  buildLocaleBag(hero, legacy.hero.overlineItalic,  'overline_italic'),
      _settings:       hero._settings || {},
    };
  }
  if (dual) {
    out.dualPath = {
      private: {
        ...legacy.dualPath.private,
        image:  dual._settings?.client_image_url || legacy.dualPath.private.image,
        kicker: buildLocaleBag(dual, legacy.dualPath.private.kicker, 'client_kicker'),
        title:  buildLocaleBag(dual, legacy.dualPath.private.title,  'client_title'),
        body:   buildLocaleBag(dual, legacy.dualPath.private.body,   'client_body'),
        cta:    buildLocaleBag(dual, legacy.dualPath.private.cta,    'client_cta_label'),
      },
      pro: {
        ...legacy.dualPath.pro,
        image:  dual._settings?.pro_image_url || legacy.dualPath.pro.image,
        kicker: buildLocaleBag(dual, legacy.dualPath.pro.kicker, 'pro_kicker'),
        title:  buildLocaleBag(dual, legacy.dualPath.pro.title,  'pro_title'),
        body:   buildLocaleBag(dual, legacy.dualPath.pro.body,   'pro_body'),
        cta:    buildLocaleBag(dual, legacy.dualPath.pro.cta,    'pro_cta_label'),
      },
    };
  }
  if (vp) {
    const dbPillars = Array.isArray(vp._settings?.pillars) ? vp._settings.pillars : null;
    out.valueProps = {
      ...legacy.valueProps,
      title: buildLocaleBag(vp, legacy.valueProps.title, 'section_title'),
      items: (dbPillars && dbPillars.length > 0)
        ? dbPillars.map((p, i) => ({
            id:    p.id || `pillar_${i}`,
            icon:  p.icon || 'gem',
            title: (p.title && typeof p.title === 'object') ? p.title : { _default: p.title || '' },
            body:  (p.body  && typeof p.body  === 'object') ? p.body  : { _default: p.body  || '' },
          }))
        : legacy.valueProps.items,
    };
  }
  if (pi) {
    out.projectsInspire = {
      ...legacy.projectsInspire,
      title: buildLocaleBag(pi, legacy.projectsInspire.title, 'section_title'),
    };
  }
  if (nl) {
    out.newsletter = {
      ...legacy.newsletter,
      decorImage: nl._settings?.decor_image_url || legacy.newsletter.decorImage,
      title:       buildLocaleBag(nl, legacy.newsletter.title,       'title'),
      body:        buildLocaleBag(nl, legacy.newsletter.body,        'body'),
      placeholder: buildLocaleBag(nl, legacy.newsletter.placeholder, 'placeholder'),
      submit:      buildLocaleBag(nl, legacy.newsletter.submit,      'cta_label'),
    };
  }
  return out;
};

const HeroMedia = ({ src }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <div className="mfd-hero__media">
        <img src={src} alt="" className={loaded ? 'is-loaded' : ''} onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} />
      </div>
      <div className="mfd-hero__veil" />
    </>
  );
};

// Compute the CSS for the configurable veil from CMS settings.
const heroVeilCss = (style, opacity) => {
  const o = Math.max(0, Math.min(100, opacity != null ? opacity : 60)) / 100;
  if (style === 'none') return 'transparent';
  if (style === 'soft')   return `rgba(0,0,0,${(o * 0.55).toFixed(3)})`;
  if (style === 'strong') return `rgba(0,0,0,${(o * 0.85).toFixed(3)})`;
  if (style === 'gradient-top') {
    return `linear-gradient(to bottom, rgba(0,0,0,${o.toFixed(3)}) 0%, rgba(0,0,0,0) 100%)`;
  }
  // default gradient-bottom
  return `linear-gradient(to top, rgba(0,0,0,${o.toFixed(3)}) 0%, rgba(0,0,0,0) 100%)`;
};

const HomeHero = ({ c, pick }) => {
  const s = c.hero._settings || {};
  const textAlign = s.text_align || 'center';
  const vAnchor   = s.vertical_anchor || 'middle';
  const hAnchor   = s.horizontal_anchor || 'center';
  const showItalic = s.show_italic !== false; // default ON for live (legacy)
  const veilBg = heroVeilCss(s.veil_style || 'gradient-bottom', s.veil_opacity);

  return (
    <section
      className="mfd-hero"
      data-testid="home-hero"
      data-text-align={textAlign}
      data-v-anchor={vAnchor}
      data-h-anchor={hAnchor}
      style={{ '--hero-veil': veilBg }}
    >
      <HeroMedia src={c.hero.backgroundImage} />
      <div className="mfd-hero__inner">
        <Reveal as="span" className="mfd-eyebrow" data-testid="hero-overline">{pick(c.hero.overline)}</Reveal>
        <Reveal as="h1" className="mfd-display" delay={1} data-testid="hero-headline">{pick(c.hero.headline)}</Reveal>
        <Reveal as="p" className="mfd-lead" delay={2} data-testid="hero-sub" style={{ whiteSpace: 'pre-line' }}>
          {pick(c.hero.sub)}
        </Reveal>
        {showItalic && pick(c.hero.overlineItalic) && (
          <>
            <Reveal delay={3} className="mfd-hero__divider" />
            <Reveal as="p" className="mfd-italic-line" delay={4} data-testid="hero-overline-italic">{pick(c.hero.overlineItalic)}</Reveal>
          </>
        )}
      </div>
    </section>
  );
};

const HomePage = () => {
  const { pick } = useSite();
  const { content: cmsContent, hasDbContent } = useStorefrontContent(tenantConfig.slug, 'home', homepageContent);
  const c = useMemo(
    () => (hasDbContent ? mergeHomepage(homepageContent, cmsContent) : homepageContent),
    [hasDbContent, cmsContent]
  );

  useEffect(() => { document.title = pick(c.meta.title); }, [pick, c.meta.title]);

  return (
    <div data-testid="site-home">
      {/* HERO */}
      <HomeHero c={c} pick={pick} />

      {/* DUAL CTA */}
      <section className="mfd-section" data-testid="home-dual">
        <div className="mfd-wrap">
          <div className="mfd-dual">
            {/* PRIVATO — light card */}
            <Reveal className="mfd-dual__card mfd-dual__card--light" data-testid="dual-private">
              <div className="mfd-dual__media">
                <img src={c.dualPath.private.image} alt="" loading="lazy" decoding="async" />
              </div>
              <div className="mfd-dual__body">
                <div>
                  <span className="mfd-eyebrow mfd-eyebrow--dark">{pick(c.dualPath.private.kicker)}</span>
                  <h3 className="mfd-dual__title" style={{ marginTop: '0.6rem', color: 'var(--site-ink-dark)' }}>{pick(c.dualPath.private.title)}</h3>
                  <p className="mfd-body mfd-body--dark" style={{ marginTop: '1.1rem', whiteSpace: 'pre-line' }}>{pick(c.dualPath.private.body)}</p>
                </div>
                <div className="mfd-dual__cta-row">
                  <Link to={c.dualPath.private.href} className="mfd-btn mfd-btn--dark" data-testid="dual-private-cta">
                    {pick(c.dualPath.private.cta)} <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </Reveal>

            {/* PROFESSIONISTA — dark card */}
            <Reveal className="mfd-dual__card mfd-dual__card--dark" delay={2} data-testid="dual-pro">
              <div className="mfd-dual__body">
                <div>
                  <span className="mfd-eyebrow">{pick(c.dualPath.pro.kicker)}</span>
                  <h3 className="mfd-dual__title" style={{ marginTop: '0.6rem', color: 'var(--site-ivory)' }}>{pick(c.dualPath.pro.title)}</h3>
                  <p className="mfd-body" style={{ marginTop: '1.1rem', whiteSpace: 'pre-line' }}>{pick(c.dualPath.pro.body)}</p>
                </div>
                <div className="mfd-dual__cta-row">
                  <Link to={c.dualPath.pro.href} className="mfd-btn mfd-btn--paper" data-testid="dual-pro-cta">
                    {pick(c.dualPath.pro.cta)} <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
              <div className="mfd-dual__media">
                <img src={c.dualPath.pro.image} alt="" loading="lazy" decoding="async" />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* VALUE PROPS — paper background */}
      <section className="mfd-section mfd-section--paper" data-testid="home-values" id="about">
        <div className="mfd-wrap" style={{ display: 'grid', gap: '2.5rem' }}>
          <Reveal as="h2" className="mfd-eyebrow" style={{ textAlign: 'center', color: 'var(--site-ink-dark)', fontSize: '12px' }} data-testid="values-title">
            {pick(c.valueProps.title, 'home.valueProps.title')}
          </Reveal>
          <Reveal delay={2} style={{ width: '64px', height: '1px', background: 'var(--site-accent)', margin: '0 auto', opacity: 0.7 }} />
          <Reveal delay={2}>
            <div className="mfd-values">
              {c.valueProps.items.map((item, i) => {
                const Icon = ICONS[item.icon] || Gem;
                return (
                  <Reveal key={item.id} delay={(i % 4) + 1} className="mfd-value" data-testid={`home-value-${item.id}`}>
                    <div className="mfd-value__icon"><Icon size={28} strokeWidth={1.2} /></div>
                    <h3 className="mfd-value__title">{pick(item.title)}</h3>
                    <p className="mfd-value__body">{pick(item.body)}</p>
                  </Reveal>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* PROJECTS THAT INSPIRE */}
      <section className="mfd-section" data-testid="home-projects" id="projects">
        <div className="mfd-wrap" style={{ display: 'grid', gap: '2.5rem' }}>
          <Reveal as="h2" className="mfd-eyebrow" style={{ textAlign: 'center', fontSize: '12px', color: 'var(--site-ink)' }} data-testid="projects-strip-title">
            {pick(c.projectsInspire.title)}
          </Reveal>
          <Reveal delay={2} style={{ width: '64px', height: '1px', background: 'var(--site-accent)', margin: '0 auto', opacity: 0.7 }} />
          <Reveal delay={2}>
            <div className="mfd-inspire-strip">
              {c.projectsInspire.items.map((p, i) => (
                <Reveal key={p.id} delay={(i % 4) + 1} as="div">
                  <Link to={`/projects/${p.slug}`} className="mfd-inspire" data-testid={`home-project-${p.id}`}>
                    <img src={p.image} alt={pick(p.category)} loading="lazy" decoding="async" />
                    <div className="mfd-inspire__veil" />
                    <div className="mfd-inspire__caption">
                      <span className="mfd-inspire__cat">{pick(p.category)}</span>
                      <span className="mfd-inspire__loc">{pick(p.location)}</span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section data-testid="home-newsletter">
        <div className="mfd-newsletter mfd-wrap" style={{ maxWidth: '1480px' }}>
          <Reveal>
            <div className="mfd-newsletter__title">{pick(c.newsletter.title)}</div>
            <p className="mfd-body mfd-body--dark" style={{ whiteSpace: 'pre-line' }}>{pick(c.newsletter.body)}</p>
          </Reveal>
          <Reveal delay={2}>
            <form className="mfd-newsletter__form" onSubmit={(e) => e.preventDefault()} data-testid="newsletter-form">
              <input
                type="email"
                placeholder={pick(c.newsletter.placeholder)}
                aria-label={pick(c.newsletter.placeholder)}
                data-testid="newsletter-input"
              />
              <button type="submit" data-testid="newsletter-submit">{pick(c.newsletter.submit)}</button>
            </form>
          </Reveal>
          <Reveal delay={3} className="mfd-newsletter__decor">
            <img src={c.newsletter.decorImage} alt="" loading="lazy" decoding="async" />
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
