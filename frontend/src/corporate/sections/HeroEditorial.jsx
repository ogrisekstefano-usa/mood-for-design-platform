import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * HeroEditorial — ITER149 hero matching the official mockup.
 * Left: editorial copy ("Design begins with understanding people.")
 * Right: cinematic device mockup image (laptop + phone) from media_library.
 */
const HeroEditorial = ({ content = {}, media = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.05 });
  const image = media.image;

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: 'var(--mood-black)', minHeight: '92vh' }}
      data-testid="hero-editorial"
    >
      {/* Subtle cyan glow on the right side */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 80% 35%, rgba(25,240,255,0.12) 0%, transparent 60%)' }}
      />

      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16 pt-28 lg:pt-32 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Text column */}
        <div ref={ref} className="lg:col-span-5">
          {content.eyebrow && (
            <p className={`overline-teal mb-6 reveal ${visible ? 'visible' : ''}`} data-testid="hero-eyebrow">
              {content.eyebrow}
            </p>
          )}
          <h1
            className={`font-serif font-normal leading-[1.04] tracking-tight reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: 'var(--fs-h1)',
              color: 'var(--mood-text-1)',
              transitionDelay: '0.05s',
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
                maxWidth: '38ch',
                transitionDelay: '0.18s',
              }}
              data-testid="hero-body"
            >
              {content.body}
            </p>
          )}

          {(content.cta_primary || content.cta_secondary) && (
            <div className={`mt-10 flex flex-wrap items-center gap-3 reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.25s' }}>
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

        {/* Device image column */}
        <div className="relative lg:col-span-7">
          {image && image.url && (
            <div
              className={`relative reveal ${visible ? 'visible' : ''}`}
              style={{ transitionDelay: '0.2s' }}
            >
              <img
                src={image.url}
                alt={image.alt || ''}
                className="w-full h-auto"
                style={{
                  filter: 'saturate(1.05) contrast(1.02)',
                  borderRadius: 4,
                }}
                loading="eager"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroEditorial;
