import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Gem, Users, Sparkles, Globe, ShieldCheck } from 'lucide-react';
import { useSite } from '../../site/SiteContext';
import { homepageContent } from '../../site/content/homepage';
import { Reveal } from '../../site/components/Reveal';

const ICONS = { gem: Gem, users: Users, sparkles: Sparkles, globe: Globe, 'shield-check': ShieldCheck };

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

const HomePage = () => {
  const { pick } = useSite();
  const c = homepageContent;

  useEffect(() => { document.title = pick(c.meta.title); }, [pick, c.meta.title]);

  return (
    <div data-testid="site-home">
      {/* HERO */}
      <section className="mfd-hero" data-testid="home-hero">
        <HeroMedia src={c.hero.backgroundImage} />
        <div className="mfd-hero__inner">
          <Reveal as="h1" className="mfd-display" data-testid="hero-headline">{pick(c.hero.headline)}</Reveal>
          <Reveal as="p" className="mfd-lead" delay={2} data-testid="hero-sub" style={{ textAlign: 'center', whiteSpace: 'pre-line' }}>
            {pick(c.hero.sub)}
          </Reveal>
          <Reveal delay={3} className="mfd-hero__divider" />
          <Reveal as="span" className="mfd-eyebrow" delay={3} data-testid="hero-overline">{pick(c.hero.overline)}</Reveal>
          <Reveal as="p" className="mfd-italic-line" delay={4} data-testid="hero-overline-italic">{pick(c.hero.overlineItalic)}</Reveal>
        </div>
      </section>

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
