import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * HeroCinematic — ITER149 hero.
 * 100% DB-driven: receives resolved content/media/links from /api/site/pages.
 *
 * content: { eyebrow, title_1, title_2, title_3, subtitle_accent, body, cta_primary, cta_secondary }
 * media:   { image: {url, alt, dominant_color} }
 * links:   { cta_primary_href, cta_secondary_href }
 * options: { layout: 'split-right' | 'split-left' | 'centered' }
 */
const HeroCinematic = ({ content = {}, media = {}, links = {}, options = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.05 });
  const reverse = options.layout === 'split-left';
  const image = media.image;

  return (
    <section
      className="relative grain overflow-hidden"
      style={{ background: 'var(--mood-ink)', minHeight: 'calc(100vh - 0px)' }}
      data-testid="hero-cinematic"
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 75% 30%, rgba(0,201,179,0.10) 0%, transparent 55%)' }}
      />

      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 pt-32 lg:pt-40 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        {/* Text column */}
        <div ref={ref} className={`lg:col-span-6 ${reverse ? 'lg:order-2' : ''}`}>
          {content.eyebrow && (
            <p className={`overline-teal mb-8 reveal ${visible ? 'visible' : ''}`} data-testid="hero-eyebrow">
              {content.eyebrow}
            </p>
          )}
          <h1
            className={`font-serif font-normal leading-[1.02] tracking-tight text-white reveal ${visible ? 'visible' : ''}`}
            style={{ fontSize: 'clamp(2.4rem, 5vw, 4.8rem)', transitionDelay: '0.05s' }}
            data-testid="hero-title"
          >
            {content.title_1 && <span className="block">{content.title_1}</span>}
            {content.title_2 && <span className="block">{content.title_2}</span>}
            {content.title_3 && (
              <span className="block italic" style={{ color: '#00C9B3', fontFamily: 'Playfair Display, serif' }}>
                {content.title_3}
              </span>
            )}
          </h1>

          {content.subtitle_accent && (
            <p
              className={`mt-7 italic reveal ${visible ? 'visible' : ''}`}
              style={{
                fontFamily: 'Playfair Display, serif',
                color: 'rgba(255,255,255,0.92)',
                fontSize: 'clamp(1.05rem, 1.55vw, 1.4rem)',
                lineHeight: 1.4,
                transitionDelay: '0.12s',
                maxWidth: '36ch',
              }}
              data-testid="hero-subtitle"
            >
              {content.subtitle_accent}
            </p>
          )}

          {content.body && (
            <p
              className={`mt-6 font-light leading-relaxed reveal ${visible ? 'visible' : ''}`}
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontFamily: 'Montserrat, sans-serif',
                fontSize: '1rem',
                transitionDelay: '0.18s',
                maxWidth: '42ch',
              }}
              data-testid="hero-body"
            >
              {content.body}
            </p>
          )}

          {(content.cta_primary || content.cta_secondary) && (
            <div className={`mt-10 flex flex-wrap items-center gap-4 reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.25s' }}>
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

        {/* Image column */}
        <div className={`relative lg:col-span-6 ${reverse ? 'lg:order-1' : ''}`}>
          {image && image.url && (
            <div
              className={`relative aspect-[4/5] lg:aspect-[3/4] xl:aspect-[5/6] rounded-xl overflow-hidden reveal ${visible ? 'visible' : ''}`}
              style={{
                transitionDelay: '0.2s',
                background: image.dominant_color || '#1A2030',
                boxShadow: '0 60px 120px -30px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
              }}
            >
              <img src={image.url} alt={image.alt || ''} className="w-full h-full object-cover" style={{ filter: 'saturate(1.05) contrast(1.02)' }} loading="eager" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)' }} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroCinematic;
