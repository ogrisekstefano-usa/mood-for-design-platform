/**
 * ProfessionalsGatewayPage — ITER143A+ Dynamic Editorial Runtime™.
 *
 * ZERO HARDCODED CONTENT POLICY: every visible string is loaded from
 * the editorial runtime (page_key='professionals'). Background media
 * and CTA hrefs still come from the design-time content file, since
 * those are NOT editorial copy (they are layout/asset concerns).
 */
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { professionalsContent } from '../../site/content/professionals';
import { tenantConfig } from '../../site/content/tenant';
import { Reveal } from '../../site/components/Reveal';
import {
  EditorialBundleProvider,
  useEditorialBundle,
} from '../../site/editorial/EditorialBundleProvider';

const NS = 'site.professionals';
const k = (s) => `${NS}.${s}`;

const ProCtaContent = ({ get, kicker, title, body, label }) => (
  <>
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      <span className="mfd-pro-cta__kicker">{get(kicker)}</span>
      <h2 className="mfd-pro-cta__title">{get(title)}</h2>
      <p className="mfd-pro-cta__body">{get(body)}</p>
    </div>
    <span className="mfd-pro-cta__action">
      {get(label)} <ArrowUpRight size={14} />
    </span>
  </>
);

const ProfessionalsGatewayInner = () => {
  const { get, ready } = useEditorialBundle();
  const c = professionalsContent.gateway;

  useEffect(() => {
    const title = get(k('meta.title'));
    if (title) document.title = title;
  }, [get]);

  const exploreUrl = tenantConfig.studioExternal.url;
  const exploreTarget = tenantConfig.studioExternal.target || '_self';
  const isExternal = /^https?:\/\//.test(exploreUrl);

  if (!ready) {
    return (
      <div data-testid="site-professionals-gateway" aria-busy="true">
        <section className="mfd-pro-hero" data-editorial-skeleton="true" />
      </div>
    );
  }

  return (
    <div data-testid="site-professionals-gateway">
      <section className="mfd-pro-hero" data-testid="pro-hero">
        <div className="mfd-pro-hero__media">
          <img src={c.backgroundImage} alt="" />
        </div>
        <div className="mfd-pro-hero__veil" />
        <div className="mfd-pro-hero__inner">
          <Reveal as="span" className="mfd-eyebrow mfd-eyebrow--accent" data-testid="pro-eyebrow">
            {get(k('hero.eyebrow'))}
          </Reveal>
          <Reveal
            as="h1"
            className="mfd-display"
            delay={2}
            data-testid="pro-headline"
            style={{ fontSize: 'clamp(2.4rem, 5.4vw, 5.4rem)', textTransform: 'none' }}
          >
            {get(k('hero.headline'))}
          </Reveal>
          <Reveal as="p" className="mfd-lead" delay={3} data-testid="pro-sub">
            {get(k('hero.sub'))}
          </Reveal>
        </div>
      </section>

      <section data-testid="pro-ctas">
        <div className="mfd-pro-ctas">
          {/* CTA 1 — Explore the studio */}
          {isExternal ? (
            <a href={exploreUrl} target={exploreTarget} rel="noopener noreferrer" className="mfd-pro-cta" data-testid="pro-cta-explore">
              <ProCtaContent
                get={get}
                kicker={k('cta.explore.kicker')}
                title={k('cta.explore.title')}
                body={k('cta.explore.body')}
                label={k('cta.explore.label')}
              />
            </a>
          ) : (
            <Link to={exploreUrl} className="mfd-pro-cta" data-testid="pro-cta-explore">
              <ProCtaContent
                get={get}
                kicker={k('cta.explore.kicker')}
                title={k('cta.explore.title')}
                body={k('cta.explore.body')}
                label={k('cta.explore.label')}
              />
            </Link>
          )}
          {/* CTA 2 — Start a professional project */}
          <Link to={c.ctas.start.href} className="mfd-pro-cta" data-testid="pro-cta-start">
            <ProCtaContent
              get={get}
              kicker={k('cta.start.kicker')}
              title={k('cta.start.title')}
              body={k('cta.start.body')}
              label={k('cta.start.label')}
            />
          </Link>
          {/* CTA 3 — Access workspace */}
          <Link to={c.ctas.access.href} className="mfd-pro-cta" data-testid="pro-cta-access">
            <ProCtaContent
              get={get}
              kicker={k('cta.access.kicker')}
              title={k('cta.access.title')}
              body={k('cta.access.body')}
              label={k('cta.access.label')}
            />
          </Link>
        </div>
      </section>
    </div>
  );
};

const ProfessionalsGatewayPage = () => (
  <EditorialBundleProvider pageKeys={['professionals']}>
    <ProfessionalsGatewayInner />
  </EditorialBundleProvider>
);

export default ProfessionalsGatewayPage;
