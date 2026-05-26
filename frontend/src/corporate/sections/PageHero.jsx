import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * PageHero — minimal cinematic hero for the new ITER151 dynamic pages.
 * content: { eyebrow, title, subtitle }
 * media:   { hero?: {url, alt} }   (optional background)
 */
const PageHero = ({ content = {}, media = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.15 });
  const bg = media.hero;

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: '#000000', paddingTop: 'clamp(8rem, 14vh, 11rem)' }}
      data-testid="page-hero"
    >
      {bg && bg.url && (
        <>
          <img
            src={bg.url}
            alt={bg.alt || ''}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'brightness(0.55) saturate(0.95)', opacity: 0.55 }}
            loading="eager"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.85) 100%)',
            }}
          />
        </>
      )}

      <div
        ref={ref}
        className={`relative z-10 max-w-screen-xl mx-auto px-6 md:px-10 lg:px-16 pb-20 lg:pb-28 reveal ${visible ? 'visible' : ''}`}
      >
        {content.eyebrow && (
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.72rem',
              fontWeight: 500,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--mood-teal)',
              marginBottom: '1.5rem',
            }}
            data-testid="page-hero-eyebrow"
          >
            {content.eyebrow}
          </p>
        )}
        {content.title && (
          <h1
            style={{
              fontFamily: 'Playfair Display, serif',
              fontWeight: 400,
              fontSize: 'clamp(2.4rem, 5vw, 4.4rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.015em',
              color: 'var(--mood-text-1)',
              maxWidth: '22ch',
            }}
            data-testid="page-hero-title"
          >
            {content.title}
          </h1>
        )}
        {content.subtitle && (
          <p
            className="mt-8"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 'clamp(1.05rem, 1.4vw, 1.18rem)',
              lineHeight: 1.55,
              color: 'var(--mood-text-2)',
              maxWidth: '60ch',
              fontWeight: 300,
            }}
            data-testid="page-hero-subtitle"
          >
            {content.subtitle}
          </p>
        )}
      </div>
    </section>
  );
};

export default PageHero;
