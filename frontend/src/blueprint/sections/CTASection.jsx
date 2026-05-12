/**
 * CTASection — conversion band.
 * content: { eyebrow, headline, subline, primary_cta, secondary_cta, atmosphere }
 */
import React from 'react';
import { Section, Container, Eyebrow, H2, Lead, CTAGroup } from '../Kit';

const CTASection = ({ content = {} }) => {
  const atmosphere = content.atmosphere || 'glass';
  const wrapperCls = atmosphere === 'glass'
    ? 'bp-glass rounded-[var(--bp-radius-lg)] p-12 md:p-20'
    : atmosphere === 'cinematic'
    ? 'bp-vignette bg-[var(--bp-surface-1)] rounded-[var(--bp-radius-lg)] p-12 md:p-20 overflow-hidden relative'
    : 'border border-[var(--bp-border)] rounded-[var(--bp-radius-lg)] p-12 md:p-20';

  return (
    <Section data-testid="section-cta">
      <Container>
        <div className={wrapperCls}>
          {content.eyebrow && <Eyebrow>{content.eyebrow}</Eyebrow>}
          {content.headline && <H2 className="mt-4 max-w-2xl">{content.headline}</H2>}
          {content.subline && <Lead className="mt-6 max-w-xl">{content.subline}</Lead>}
          <CTAGroup primary={content.primary_cta} secondary={content.secondary_cta} className="mt-10" />
        </div>
      </Container>
    </Section>
  );
};

export default CTASection;
