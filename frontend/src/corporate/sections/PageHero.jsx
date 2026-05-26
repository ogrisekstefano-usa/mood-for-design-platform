import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * PageHero — full-width panoramic hero for ITER151 dynamic pages.
 *
 * Photo runs edge-to-edge; a left-to-right black veil holds the text in
 * the top-left while the right side of the image breathes. Panoramic
 * height (not full viewport), reading like a magazine spread. Consistent
 * with FeatureHeroSplit and PricingHeroCinematic.
 *
 * content: { eyebrow, title, subtitle }
 * media:   { hero?: {url, alt} }
 */
const PageHero = ({ content = {}, media = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.15 });
  const bg = media.hero;

  return (
    <section
      ref={ref}
      className={`relative overflow-hidden reveal ${visible ? 'visible' : ''}`}
      style={{
        background: '#000000',
        minHeight: 'clamp(520px, 62vh, 720px)',
      }}
      data-testid="page-hero"
    >
      {bg && bg.url && (
        <img
          src={bg.url}
          alt={bg.alt || ''}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            objectPosition: 'center 38%',
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

      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 md:px-12 lg:px-20 py-16 lg:py-24">
        <div className="w-full max-w-[620px]">
          {content.eyebrow && (
            <p
              style={{
                fontFamily: 'Inter, sans-serif', fontSize: '0.74rem', fontWeight: 500,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                color: 'var(--mood-teal, #00C9B3)', marginBottom: '2.2rem',
              }}
              data-testid="page-hero-eyebrow"
            >
              {content.eyebrow}
            </p>
          )}
          {content.title && (
            <h1
              style={{
                fontFamily: 'Playfair Display, serif', fontWeight: 400,
                fontSize: 'clamp(2.4rem, 4.6vw, 4.2rem)', lineHeight: 1.05,
                letterSpacing: '-0.018em', color: '#FFFFFF',
                maxWidth: '20ch',
              }}
              data-testid="page-hero-title"
            >
              {content.title}
            </h1>
          )}
          {content.subtitle && (
            <p
              className="mt-7 lg:mt-9"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 'clamp(1rem, 1.15vw, 1.1rem)',
                lineHeight: 1.7, color: 'rgba(255,255,255,0.78)', fontWeight: 300,
                maxWidth: '48ch',
              }}
              data-testid="page-hero-subtitle"
            >
              {content.subtitle}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default PageHero;
