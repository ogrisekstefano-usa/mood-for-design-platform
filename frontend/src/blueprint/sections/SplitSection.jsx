/**
 * SplitSection — asymmetric content + media.
 * content: { eyebrow, headline, body, media, side, primary_cta }
 */
import React from 'react';
import { Section, Container, Eyebrow, H2, Body, CTAGroup } from '../Kit';

const SplitSection = ({ content = {} }) => {
  const side = content.side || 'right';
  const order = side === 'right' ? '' : 'md:order-2';
  const mediaOrder = side === 'right' ? 'md:order-2' : 'md:order-1';

  return (
    <Section data-testid="section-split">
      <Container>
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div className={order}>
            {content.eyebrow && <Eyebrow>{content.eyebrow}</Eyebrow>}
            {content.headline && <H2 className="mt-4">{content.headline}</H2>}
            {content.body && <Body className="mt-6 max-w-md">{content.body}</Body>}
            {content.primary_cta?.label && (
              <CTAGroup primary={content.primary_cta} className="mt-8" />
            )}
          </div>
          <div className={`relative aspect-[4/5] overflow-hidden rounded-[var(--bp-radius-md)] bg-[var(--bp-surface-1)] ${mediaOrder}`}>
            {content.media?.src ? (
              <img src={content.media.src} alt={content.media.alt || ''}
                className="absolute inset-0 w-full h-full object-cover bp-img-cinematic" loading="lazy" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--bp-text-subtle)] bp-caption">
                Add media to this section
              </div>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
};

export default SplitSection;
