import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * CTASection — Cinematic dark CTA with optional background image.
 * content: { overline, headline, body, cta_primary, cta_secondary }
 * config:  { background_image?, dim? (0..1), centered? }
 */
const CTASection = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.2 });
  const bgImage = config.background_image;
  const dim = config.dim ?? 0.55;

  return (
    <section
      className="relative overflow-hidden grain"
      style={{ background: 'var(--mood-onyx)', minHeight: '70vh' }}
      data-testid="cta-section"
    >
      {bgImage && (
        <img
          src={bgImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'saturate(0.95)' }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: bgImage
            ? `linear-gradient(180deg, rgba(5,11,20,${dim}) 0%, rgba(10,19,32,${Math.min(dim + 0.3, 0.95)}) 100%)`
            : `radial-gradient(circle at 50% 0%, rgba(0,201,179,0.10) 0%, transparent 60%)`,
        }}
      />

      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-28 lg:py-36 grid place-items-center min-h-[70vh]">
        <div ref={ref} className={`text-center max-w-3xl reveal ${visible ? 'visible' : ''}`}>
          {content.overline && <p className="overline-teal mb-8">{content.overline}</p>}
          {content.headline && (
            <h2
              className="font-serif text-white leading-[1.05]"
              style={{ fontSize: 'clamp(2.4rem, 5vw, 4.5rem)' }}
            >
              {content.headline}
            </h2>
          )}
          {content.body && (
            <p className="mt-6 text-base lg:text-lg font-light text-white/70 max-w-2xl mx-auto leading-relaxed">
              {content.body}
            </p>
          )}
          {(content.cta_primary || content.cta_secondary) && (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              {content.cta_primary && (
                <a href={content.cta_primary.href} className="btn-pill-teal" data-testid="cta-primary">
                  {content.cta_primary.text}
                </a>
              )}
              {content.cta_secondary && (
                <a href={content.cta_secondary.href} className="btn-pill-outline" data-testid="cta-secondary">
                  {content.cta_secondary.text}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CTASection;
