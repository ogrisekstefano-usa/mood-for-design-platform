import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * FinalCTAImmersive — short cinematic CTA band.
 * Image fills the band; black gradient fades from RIGHT (where text sits) toward LEFT.
 * Text + CTAs are right-aligned.
 */
const FinalCTAImmersive = ({ content = {}, media = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.2 });
  const bg = media.background;

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: 'var(--mood-black)', minHeight: '42vh' }}
      data-testid="final-cta-immersive"
    >
      {bg && bg.url && (
        <img
          src={bg.url}
          alt={bg.alt || ''}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'saturate(0.95) brightness(0.95)' }}
          loading="lazy"
        />
      )}
      {/* Right → left gradient (dark on right, fading to transparent on left) */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(270deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.82) 30%, rgba(0,0,0,0.5) 55%, rgba(0,0,0,0.15) 80%, rgba(0,0,0,0) 100%)',
        }}
      />

      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16 py-16 lg:py-20 min-h-[42vh] flex items-center justify-end">
        <div
          ref={ref}
          className={`text-right reveal ${visible ? 'visible' : ''}`}
          style={{ maxWidth: 580 }}
        >
          {content.title && (
            <h2
              style={{
                fontFamily: 'Playfair Display, serif',
                fontWeight: 400,
                fontSize: 'clamp(1.8rem, 3vw, 2.8rem)',
                lineHeight: 1.1,
                color: 'var(--mood-text-1)',
              }}
              data-testid="final-cta-title"
            >
              {content.title}
            </h2>
          )}
          {content.body && (
            <p
              className="mt-5"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '1rem',
                lineHeight: 1.55,
                color: 'var(--mood-text-2)',
                marginLeft: 'auto',
                maxWidth: '46ch',
              }}
            >
              {content.body}
            </p>
          )}

          {(content.cta_primary || content.cta_secondary) && (
            <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
              {content.cta_primary && (
                <a href={links.cta_primary_href || '#'} className="btn-pill-teal" data-testid="final-cta-primary">
                  {content.cta_primary}
                </a>
              )}
              {content.cta_secondary && (
                <a href={links.cta_secondary_href || '#'} className="btn-pill-outline" data-testid="final-cta-secondary">
                  {content.cta_secondary}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default FinalCTAImmersive;
