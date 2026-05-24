import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * FinalCTAImmersive — full-bleed cinematic CTA at the bottom of the homepage.
 * "Pronto a iniziare il tuo percorso?" with 2 CTAs (Begin / Professional).
 */
const FinalCTAImmersive = ({ content = {}, media = {}, links = {}, options = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.2 });
  const bg = media.background;
  const dim = options.dim ?? 0.7;

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: 'var(--mood-black)', minHeight: '60vh' }}
      data-testid="final-cta-immersive"
    >
      {bg && bg.url && (
        <img
          src={bg.url}
          alt={bg.alt || ''}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'saturate(0.95) brightness(0.85)' }}
          loading="lazy"
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: bg
            ? `linear-gradient(180deg, rgba(5,8,22,${dim}) 0%, rgba(5,8,22,${Math.min(dim + 0.15, 0.92)}) 100%)`
            : 'radial-gradient(ellipse at center, rgba(25,240,255,0.10) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16 py-24 lg:py-32 grid place-items-center min-h-[55vh]">
        <div ref={ref} className={`text-center max-w-4xl reveal ${visible ? 'visible' : ''}`}>
          {content.title && (
            <h2
              style={{
                fontFamily: 'Playfair Display, serif',
                fontWeight: 400,
                fontSize: 'clamp(2rem, 3.5vw, 3.4rem)',
                lineHeight: 1.1,
                color: 'var(--mood-text-1)',
                whiteSpace: 'pre-line',
              }}
              data-testid="final-cta-title"
            >
              {content.title}
            </h2>
          )}
          {content.body && (
            <p
              className="mt-6 mx-auto"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '1.1rem',
                lineHeight: 1.55,
                color: 'var(--mood-text-2)',
                maxWidth: '52ch',
              }}
            >
              {content.body}
            </p>
          )}

          {(content.cta_primary || content.cta_secondary) && (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
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
