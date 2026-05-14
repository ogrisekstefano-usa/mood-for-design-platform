import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useSite } from '../../site/SiteContext';
import { homepageContent } from '../../site/content/homepage';
import { projects } from '../../site/content/projects';
import { Reveal, SiteImage } from '../../site/components/Reveal';

const HeroMedia = ({ src }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <div className="mfd-hero__media">
        <img
          src={src}
          alt=""
          className={loaded ? 'is-loaded' : ''}
          onLoad={() => setLoaded(true)}
        />
      </div>
      <div className="mfd-hero__veil" />
    </>
  );
};

const HomePage = () => {
  const { pick } = useSite();
  const c = homepageContent;
  const featured = projects.slice(0, 6);

  useEffect(() => {
    document.title = pick(c.meta.title);
  }, [pick, c.meta.title]);

  return (
    <div data-testid="site-home">
      {/* HERO */}
      <section className="mfd-hero" data-testid="home-hero">
        <HeroMedia src={c.hero.backgroundImage} />
        <div className="mfd-hero__inner">
          <Reveal as="span" className="mfd-eyebrow mfd-eyebrow--accent" data-testid="hero-eyebrow">
            {pick(c.hero.eyebrow)}
          </Reveal>
          <Reveal as="h1" className="mfd-display" delay={2} data-testid="hero-headline">
            {pick(c.hero.headline)}
          </Reveal>
          <Reveal as="p" className="mfd-lead" delay={3} data-testid="hero-sub">
            {pick(c.hero.sub)}
          </Reveal>
          <Reveal className="mfd-hero__cta-row" delay={4}>
            <Link to={c.hero.primaryCta.href} className="mfd-btn mfd-btn--accent" data-testid="hero-cta-private">
              {pick(c.hero.primaryCta.label)} <ArrowUpRight size={14} />
            </Link>
            <Link to={c.hero.secondaryCta.href} className="mfd-btn" data-testid="hero-cta-pro">
              {pick(c.hero.secondaryCta.label)} <ArrowUpRight size={14} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* DUAL CTA */}
      <section className="mfd-section mfd-section--tight" data-testid="home-dual">
        <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem', marginBottom: '3rem' }}>
          <Reveal as="span" className="mfd-eyebrow">{pick(c.dualPath.eyebrow)}</Reveal>
          <Reveal as="h2" className="mfd-h1" delay={2}>{pick(c.dualPath.title)}</Reveal>
        </div>
        <div className="mfd-wrap">
          <div className="mfd-dual">
            <Reveal className="mfd-dual__card" data-testid="dual-private">
              <div className="mfd-dual__card-media">
                <SiteImage src={c.dualPath.private.image} aspect="4/3" alt="" />
              </div>
              <span className="mfd-eyebrow">{pick(c.dualPath.private.kicker)}</span>
              <h3 className="mfd-h2">{pick(c.dualPath.private.title)}</h3>
              <p className="mfd-body" style={{ maxWidth: '46ch' }}>{pick(c.dualPath.private.body)}</p>
              <div>
                <Link to={c.dualPath.private.href} className="mfd-btn mfd-btn--ghost" data-testid="dual-private-cta">
                  {pick(c.dualPath.private.cta)} <ArrowUpRight size={14} />
                </Link>
              </div>
            </Reveal>
            <div className="mfd-dual__divider" />
            <Reveal className="mfd-dual__card" delay={2} data-testid="dual-pro">
              <div className="mfd-dual__card-media">
                <SiteImage src={c.dualPath.pro.image} aspect="4/3" alt="" />
              </div>
              <span className="mfd-eyebrow">{pick(c.dualPath.pro.kicker)}</span>
              <h3 className="mfd-h2">{pick(c.dualPath.pro.title)}</h3>
              <p className="mfd-body" style={{ maxWidth: '46ch' }}>{pick(c.dualPath.pro.body)}</p>
              <div>
                <Link to={c.dualPath.pro.href} className="mfd-btn mfd-btn--ghost" data-testid="dual-pro-cta">
                  {pick(c.dualPath.pro.cta)} <ArrowUpRight size={14} />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* SELECTED PROJECTS */}
      <section className="mfd-section" data-testid="home-projects">
        <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem', marginBottom: '3.5rem' }}>
          <Reveal as="span" className="mfd-eyebrow">{pick(c.selectedProjects.eyebrow)}</Reveal>
          <Reveal as="h2" className="mfd-h1" delay={2}>{pick(c.selectedProjects.title)}</Reveal>
        </div>
        <div className="mfd-wrap">
          <div className="mfd-strip">
            {featured.map((p, i) => (
              <Reveal key={p.slug} delay={(i % 3) + 1} className="mfd-strip__item">
                <Link
                  to={`/projects/${p.slug}`}
                  className="mfd-strip__item"
                  data-testid={`home-project-${p.slug}`}
                  style={{ display: 'block' }}
                >
                  <div className="mfd-strip__media">
                    <SiteImage src={p.cover} aspect={p.aspect} alt={pick(p.title)} />
                  </div>
                  <div className="mfd-strip__meta">
                    <div className="mfd-strip__meta-row">
                      <h3 className="mfd-strip__title">{pick(p.title)}</h3>
                      <span className="mfd-strip__location">{pick(p.location)}</span>
                    </div>
                    <p className="mfd-body" style={{ maxWidth: '56ch' }}>{pick(p.subtitle)}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <div style={{ marginTop: '4rem', display: 'flex', justifyContent: 'flex-start' }}>
            <Link to={c.selectedProjects.href} className="mfd-btn" data-testid="home-projects-all">
              {pick(c.selectedProjects.cta)} <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* EDITORIAL VALUES */}
      <section className="mfd-section" data-testid="home-values" id="about">
        <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem', marginBottom: '3rem' }}>
          <Reveal as="span" className="mfd-eyebrow">{pick(c.editorialValues.eyebrow)}</Reveal>
          <Reveal as="h2" className="mfd-h1" delay={2}>{pick(c.editorialValues.title)}</Reveal>
        </div>
        <div className="mfd-wrap">
          <div className="mfd-values">
            {c.editorialValues.items.map((item, i) => (
              <Reveal key={item.id} delay={(i % 4) + 1} className="mfd-values__item" data-testid={`home-value-${item.id}`}>
                <span className="mfd-eyebrow mfd-eyebrow--accent">{pick(item.kicker)}</span>
                <h3 className="mfd-h2">{pick(item.title)}</h3>
                <p className="mfd-body">{pick(item.body)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section data-testid="home-final-cta">
        <div className="mfd-wrap mfd-final">
          <Reveal as="span" className="mfd-eyebrow">{pick(c.finalCta.eyebrow)}</Reveal>
          <Reveal as="h2" className="mfd-display" delay={2}>{pick(c.finalCta.title)}</Reveal>
          <Reveal className="mfd-final__row" delay={3}>
            <Link to={c.finalCta.primary.href} className="mfd-btn mfd-btn--accent" data-testid="final-cta-primary">
              {pick(c.finalCta.primary.label)} <ArrowUpRight size={14} />
            </Link>
            <Link to={c.finalCta.secondary.href} className="mfd-btn" data-testid="final-cta-secondary">
              {pick(c.finalCta.secondary.label)} <ArrowUpRight size={14} />
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
