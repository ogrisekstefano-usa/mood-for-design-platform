import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * PricingHeroCinematic — full-width panoramic hero.
 *
 * Photo runs edge-to-edge; a left-to-right black veil holds the editorial
 * text in the top-left while the right side of the image breathes free.
 * Height is panoramic (not full viewport), reading like a magazine spread.
 *
 * content: { eyebrow, title, subtitle }
 * media:   { background: { url, alt } }
 */
const PricingHeroCinematic = ({ content = {}, media = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.1 });
  const bg = media.background;

  return (
    <section
      ref={ref}
      className={`relative overflow-hidden reveal ${visible ? 'visible' : ''}`}
      style={{
        background: '#000000',
        minHeight: 'clamp(640px, 84vh, 920px)',
      }}
      data-testid="pricing-hero-cinematic"
    >
      {bg && bg.url && (
        <img
          src={bg.url}
          alt={bg.alt || ''}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            objectPosition: 'center 40%',
          }}
          loading="eager"
        />
      )}

      {/* Left-to-right black veil */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          background:
            'linear-gradient(to right, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.94) 22%, rgba(0,0,0,0.78) 42%, rgba(0,0,0,0.5) 62%, rgba(0,0,0,0.18) 78%, rgba(0,0,0,0) 92%)',
        }}
      />

      {/* Editorial text block — vertically centered to match panoramic heroes */}
      <div
        className="relative z-10 flex items-center"
        style={{ minHeight: 'clamp(640px, 84vh, 920px)' }}
      >
        <div className="w-full max-w-screen-2xl mx-auto px-6 md:px-12 lg:px-20 py-16 lg:py-24">
        <div className="w-full max-w-[640px]">
          {content.eyebrow && (
            <p
              style={{
                fontFamily: 'Inter, sans-serif', fontSize: '0.74rem', fontWeight: 500,
                letterSpacing: '0.24em', textTransform: 'uppercase',
                color: 'var(--mood-teal, #00C9B3)', marginBottom: '2rem',
              }}
              data-testid="pricing-hero-eyebrow"
            >
              {content.eyebrow}
            </p>
          )}
          {content.title && (
            <h1
              style={{
                fontFamily: 'Playfair Display, serif', fontWeight: 400,
                fontSize: 'clamp(2.6rem, 4.8vw, 4.6rem)', lineHeight: 1.04,
                letterSpacing: '-0.02em', color: '#FFFFFF',
                maxWidth: '18ch',
              }}
              data-testid="pricing-hero-title"
            >
              {content.title}
            </h1>
          )}
          {content.subtitle && (
            <p
              className="mt-7 lg:mt-9"
              style={{
                fontFamily: 'Playfair Display, serif', fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 'clamp(1.05rem, 1.25vw, 1.25rem)',
                lineHeight: 1.6, color: 'rgba(255,255,255,0.82)',
                maxWidth: '50ch',
              }}
              data-testid="pricing-hero-subtitle"
            >
              {content.subtitle}
            </p>
          )}
        </div>
        </div>
      </div>
    </section>
  );
};

export default PricingHeroCinematic;
