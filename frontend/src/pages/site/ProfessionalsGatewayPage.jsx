import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useSite } from '../../site/SiteContext';
import { professionalsContent } from '../../site/content/professionals';
import { tenantConfig } from '../../site/content/tenant';
import { Reveal } from '../../site/components/Reveal';

const ProfessionalsGatewayPage = () => {
  const { pick } = useSite();
  const c = professionalsContent.gateway;

  useEffect(() => { document.title = pick(professionalsContent.meta.title, 'professionals.meta.title'); }, [pick]);

  const exploreUrl = tenantConfig.studioExternal.url;
  const exploreTarget = tenantConfig.studioExternal.target || '_self';
  const isExternal = /^https?:\/\//.test(exploreUrl);

  return (
    <div data-testid="site-professionals-gateway">
      <section className="mfd-pro-hero" data-testid="pro-hero">
        <div className="mfd-pro-hero__media">
          <img src={c.backgroundImage} alt="" />
        </div>
        <div className="mfd-pro-hero__veil" />
        <div className="mfd-pro-hero__inner">
          <Reveal as="span" className="mfd-eyebrow mfd-eyebrow--accent" data-testid="pro-eyebrow">{pick(c.eyebrow, 'professionals.gateway.eyebrow')}</Reveal>
          <Reveal as="h1" className="mfd-display" delay={2} data-testid="pro-headline" style={{ fontSize: 'clamp(2.4rem, 5.4vw, 5.4rem)', textTransform: 'none' }}>
            {pick(c.headline, 'professionals.gateway.headline')}
          </Reveal>
          <Reveal as="p" className="mfd-lead" delay={3} data-testid="pro-sub">
            {pick(c.sub, 'professionals.gateway.sub')}
          </Reveal>
        </div>
      </section>

      <section data-testid="pro-ctas">
        <div className="mfd-pro-ctas">
          {/* CTA 1 — Explore the studio */}
          {isExternal ? (
            <a href={exploreUrl} target={exploreTarget} rel="noopener noreferrer" className="mfd-pro-cta" data-testid="pro-cta-explore">
              <ProCtaContent pick={pick} cta={c.ctas.explore} keyPath="professionals.gateway.ctas.explore" />
            </a>
          ) : (
            <Link to={exploreUrl} className="mfd-pro-cta" data-testid="pro-cta-explore">
              <ProCtaContent pick={pick} cta={c.ctas.explore} keyPath="professionals.gateway.ctas.explore" />
            </Link>
          )}
          {/* CTA 2 — Start a professional project */}
          <Link to={c.ctas.start.href} className="mfd-pro-cta" data-testid="pro-cta-start">
            <ProCtaContent pick={pick} cta={c.ctas.start} keyPath="professionals.gateway.ctas.start" />
          </Link>
          {/* CTA 3 — Access workspace */}
          <Link to={c.ctas.access.href} className="mfd-pro-cta" data-testid="pro-cta-access">
            <ProCtaContent pick={pick} cta={c.ctas.access} keyPath="professionals.gateway.ctas.access" />
          </Link>
        </div>
      </section>
    </div>
  );
};

const ProCtaContent = ({ pick, cta, keyPath }) => (
  <>
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      <span className="mfd-pro-cta__kicker">{pick(cta.kicker, `${keyPath}.kicker`)}</span>
      <h2 className="mfd-pro-cta__title">{pick(cta.title, `${keyPath}.title`)}</h2>
      <p className="mfd-pro-cta__body">{pick(cta.body, `${keyPath}.body`)}</p>
    </div>
    <span className="mfd-pro-cta__action">
      {pick(cta.label, `${keyPath}.label`)} <ArrowUpRight size={14} />
    </span>
  </>
);

export default ProfessionalsGatewayPage;
