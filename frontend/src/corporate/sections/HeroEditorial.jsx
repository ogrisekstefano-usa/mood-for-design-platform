import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * HeroEditorial — full-width cinematic background + left-to-right shadow.
 * Text sits on the left, image flows across the entire section.
 * Height ~70vh (less tall than before).
 */
const HeroEditorial = ({ content = {}, media = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.05 });
  const image = media.image;

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: 'var(--mood-black)',
        minHeight: '64vh',
      }}
      data-testid="hero-editorial"
    >
      {/* Full-width background image */}
      {image && image.url && (
        <img
          src={image.url}
          alt={image.alt || ''}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'saturate(1.05) brightness(0.95)' }}
          loading="eager"
        />
      )}
      {/* Left → right shadow gradient for text readability */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.15) 80%, rgba(0,0,0,0) 100%)',
        }}
      />
      {/* Subtle vertical tone to keep nav legible */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-32 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
        }}
      />

      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16 pt-32 lg:pt-32 pb-16 min-h-[64vh] flex items-center">
        <div ref={ref} className="lg:w-[60%] xl:w-[55%]">
          {content.eyebrow && (
            <p className={`overline-teal mb-6 reveal ${visible ? 'visible' : ''}`} data-testid="hero-eyebrow">
              {content.eyebrow}
            </p>
          )}
          <h1
            className={`font-serif font-normal leading-[1.04] tracking-tight reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: 'clamp(2.6rem, 5vw, 4.6rem)',
              color: 'var(--mood-text-1)',
              transitionDelay: '0.05s',
              textShadow: '0 2px 24px rgba(0,0,0,0.6)',
            }}
            data-testid="hero-title"
          >
            {content.title_1 && <span className="block">{content.title_1}</span>}
            {content.title_2 && <span className="block">{content.title_2}</span>}
            {content.title_3 && (
              <span className="block" style={{ color: 'var(--mood-teal)' }}>
                {content.title_3}
              </span>
            )}
          </h1>

          {content.body && (
            <p
              className={`mt-7 reveal ${visible ? 'visible' : ''}`}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '1.05rem',
                lineHeight: 1.6,
                color: 'var(--mood-text-2)',
                maxWidth: '46ch',
                transitionDelay: '0.18s',
                textShadow: '0 2px 12px rgba(0,0,0,0.6)',
              }}
              data-testid="hero-body"
            >
              {content.body}
            </p>
          )}

          {(content.cta_primary || content.cta_secondary) && (
            <div className={`mt-9 flex flex-wrap items-center gap-3 reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.25s' }}>
              {content.cta_primary && (
                <a href={links.cta_primary_href || '#'} className="btn-pill-teal" data-testid="hero-cta-primary">
                  {content.cta_primary}
                </a>
              )}
              {content.cta_secondary && (
                <a href={links.cta_secondary_href || '#'} className="btn-pill-outline" data-testid="hero-cta-secondary">
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

export default HeroEditorial;
