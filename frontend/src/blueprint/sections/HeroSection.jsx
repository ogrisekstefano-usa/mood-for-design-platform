/**
 * HeroSection — cinematic introduction.
 * content: { eyebrow, headline, subline, primary_cta, secondary_cta, media, layout, atmosphere, height }
 */
import React from 'react';
import { Section, Container, Eyebrow, Display, Lead, CTAGroup } from '../Kit';

const HeroSection = ({ content = {}, settings = {} }) => {
  const layout = content.layout || 'editorial';
  const atmosphere = content.atmosphere || 'cinematic';
  const height = content.height || 'tall';
  const heightCls = {
    compact:    'min-h-[60vh]',
    tall:       'min-h-[82vh]',
    fullscreen: 'min-h-screen',
  }[height];

  const bg = content.media?.src ? (
    <div className="absolute inset-0 z-0">
      <img src={content.media.src} alt={content.media.alt || ''}
        className="w-full h-full object-cover bp-img-cinematic" loading="eager" />
      <div className="absolute inset-0" style={{ background: 'var(--bp-hero-gradient)' }} />
    </div>
  ) : null;

  const inner = (
    <div className="relative z-10 max-w-3xl">
      {content.eyebrow && <Eyebrow>{content.eyebrow}</Eyebrow>}
      <Display className="mt-5">{content.headline}</Display>
      {content.subline && <Lead className="mt-8 max-w-xl">{content.subline}</Lead>}
      <CTAGroup primary={content.primary_cta} secondary={content.secondary_cta} className="mt-10" />
    </div>
  );

  return (
    <Section atmosphere={atmosphere} className={`relative overflow-hidden ${heightCls} flex items-end`} data-testid="section-hero">
      {bg}
      <Container className={`relative z-10 w-full ${layout === 'centered' ? 'text-center mx-auto' : ''}`}>
        {inner}
      </Container>
    </Section>
  );
};

export default HeroSection;
