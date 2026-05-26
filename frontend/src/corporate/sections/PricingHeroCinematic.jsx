import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * PricingHeroCinematic — full-bleed cinematic hero for the Pricing page.
 *
 * Visual register: interior photography (studio environment / workstation /
 * architectural light) as the foundation, with editorial typography
 * floating low-left. NOT a SaaS pricing hero — it reads like the cover
 * of an architectural journal.
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
      className="relative overflow-hidden"
      style={{ background: '#000000', minHeight: 'min(820px, 100vh)' }}
      data-testid="pricing-hero-cinematic"
    >
      {/* Background image */}
      {bg && bg.url && (
        <img
          src={bg.url}
          alt={bg.alt || ''}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            opacity: 0.92,
          }}
          loading="eager"
        />
      )}

      {/* Bottom gradient for legibility */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          background:
            'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 25%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0) 80%)',
        }}
      />

      {/* Editorial text block — low-left, like a magazine cover */}
      <div
        className={`relative z-10 flex flex-col justify-end reveal ${visible ? 'visible' : ''}`}
        style={{ minHeight: 'min(820px, 100vh)' }}
      >
        <div className="px-6 md:px-12 lg:px-20 pb-20 lg:pb-28 max-w-screen-2xl mx-auto w-full">
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
                fontSize: 'clamp(2.8rem, 5.4vw, 5.4rem)', lineHeight: 1.04,
                letterSpacing: '-0.02em', color: '#FFFFFF',
                maxWidth: '20ch',
              }}
              data-testid="pricing-hero-title"
            >
              {content.title}
            </h1>
          )}
          {content.subtitle && (
            <p
              className="mt-8 lg:mt-10"
              style={{
                fontFamily: 'Playfair Display, serif', fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 'clamp(1.05rem, 1.3vw, 1.3rem)',
                lineHeight: 1.65, color: 'rgba(255,255,255,0.82)',
                maxWidth: '52ch',
              }}
              data-testid="pricing-hero-subtitle"
            >
              {content.subtitle}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default PricingHeroCinematic;
