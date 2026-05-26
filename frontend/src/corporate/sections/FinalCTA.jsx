import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * FinalCTA — closing editorial CTA with cinematic architectural background.
 * Two primary CTAs (Begin Journey · Professional Access).
 *
 * content: { title, body, cta_primary, cta_secondary }
 * media:   { background: {url, alt} }
 * links:   { cta_primary_href, cta_secondary_href }
 * options: { dim: 0..1 }
 */
const FinalCTA = ({ content = {}, media = {}, links = {}, options = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.2 });
  const bg = media.background;
  const dim = options.dim ?? 0.6;

  return (
    <section
      className="relative overflow-hidden grain"
      style={{ background: 'var(--mood-black)', minHeight: '70vh' }}
      data-testid="final-cta"
    >
      {bg && bg.url && (
        <img src={bg.url} alt={bg.alt || ''} className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'saturate(0.95)' }} />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: bg
            ? `linear-gradient(180deg, rgba(0,0,0,${dim}) 0%, rgba(0,0,0,${Math.min(dim + 0.25, 0.92)}) 100%)`
            : 'radial-gradient(circle at 50% 0%, rgba(0,201,179,0.10) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-28 lg:py-40 grid place-items-center min-h-[70vh]">
        <div ref={ref} className={`text-center max-w-5xl reveal ${visible ? 'visible' : ''}`}>
          {content.title && (
            <h2
              className="font-serif text-white leading-[1.06]"
              style={{ fontSize: 'clamp(2.4rem, 4.4vw, 4.4rem)', whiteSpace: 'pre-line', fontWeight: 400 }}
              data-testid="final-cta-title"
            >
              {content.title}
            </h2>
          )}
          {content.body && (
            <p
              className="mt-7 mx-auto"
              style={{
                fontFamily: 'Playfair Display, serif',
                fontStyle: 'italic',
                fontSize: 'clamp(1.05rem, 1.4vw, 1.3rem)',
                color: 'rgba(255,255,255,0.78)',
                lineHeight: 1.55,
                maxWidth: '52ch',
              }}
            >
              {content.body}
            </p>
          )}

          {content.cta_primary && (
            <div className="mt-12 flex items-center justify-center">
              <a href={links.cta_primary_href || '#'} className="btn-pill-teal" data-testid="final-cta-primary">
                {content.cta_primary}
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
