import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpRight, ArrowLeft, Mail } from 'lucide-react';
import { useSite } from '../../site/SiteContext';
import { uiContent } from '../../site/content/ui';
import { Reveal } from '../../site/components/Reveal';

const OnboardingPlaceholderPage = () => {
  const { kind } = useParams();
  const { pick } = useSite();
  const safeKind = uiContent.onboarding[kind] ? kind : 'private';
  const copy = uiContent.onboarding[safeKind];
  const isPro = safeKind === 'pro';
  const ctaHref = isPro ? '/auth/login' : 'mailto:hello@moodfordesign.com';

  useEffect(() => {
    document.title = `${pick(copy.eyebrow, `ui.onboarding.${safeKind}.eyebrow`)} — MOOD for DESIGN\u2122`;
  }, [pick, copy.eyebrow, safeKind]);

  return (
    <div data-testid={`site-onboarding-${safeKind}`}>
      <section className="mfd-section" style={{ paddingTop: 'clamp(8rem, 14vw, 12rem)', minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
        <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem', maxWidth: '1100px' }}>
          <Reveal as="span" className="mfd-eyebrow mfd-eyebrow--accent">{pick(copy.eyebrow, `ui.onboarding.${safeKind}.eyebrow`)}</Reveal>
          <Reveal as="h1" className="mfd-display" delay={2}>{pick(copy.title, `ui.onboarding.${safeKind}.title`)}</Reveal>
          <Reveal as="p" className="mfd-lead" delay={3}>{pick(copy.body, `ui.onboarding.${safeKind}.body`)}</Reveal>
          <Reveal delay={4} style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            {isPro ? (
              <Link to={ctaHref} className="mfd-btn mfd-btn--paper" data-testid="onboarding-cta-primary">
                {pick(copy.cta, `ui.onboarding.${safeKind}.cta`)} <ArrowUpRight size={14} />
              </Link>
            ) : (
              <a href={ctaHref} className="mfd-btn mfd-btn--paper" data-testid="onboarding-cta-primary">
                {pick(copy.cta, `ui.onboarding.${safeKind}.cta`)} <Mail size={14} />
              </a>
            )}
            <Link to="/projects" className="mfd-btn" data-testid="onboarding-cta-projects">
              {pick(uiContent.onboarding.exploreProjects, 'ui.onboarding.exploreProjects')} <ArrowUpRight size={14} />
            </Link>
            <Link to="/" className="mfd-btn mfd-btn--outline-paper" data-testid="onboarding-cta-home">
              <ArrowLeft size={14} /> {pick(uiContent.backHome, 'ui.backHome')}
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default OnboardingPlaceholderPage;
