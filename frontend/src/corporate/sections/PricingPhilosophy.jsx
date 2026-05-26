import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * PricingPhilosophy — typographic intermezzo between hero and tiers.
 * Pure typography on black. Communicates: "this is not pricing, this
 * is an invitation into an ecosystem". Italic Playfair pull-quote
 * register, no decorative chrome.
 *
 * content: { eyebrow, headline, body }
 */
const PricingPhilosophy = ({ content = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.2 });

  return (
    <section
      ref={ref}
      className={`relative reveal ${visible ? 'visible' : ''}`}
      style={{ background: '#000000', padding: 'clamp(6rem, 12vw, 12rem) 0' }}
      data-testid="pricing-philosophy"
    >
      <div className="max-w-screen-xl mx-auto px-6 md:px-12 lg:px-20">
        <div
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,_220px)_1fr]"
          style={{ gap: 'clamp(2rem, 5vw, 6rem)' }}
        >
          {/* Left rail eyebrow */}
          <div>
            {content.eyebrow && (
              <p
                style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', fontWeight: 500,
                  letterSpacing: '0.24em', textTransform: 'uppercase',
                  color: 'var(--mood-teal, #00C9B3)',
                  paddingTop: '0.4rem',
                }}
                data-testid="pricing-philosophy-eyebrow"
              >
                {content.eyebrow}
              </p>
            )}
          </div>

          {/* Right: editorial body */}
          <div>
            {content.headline && (
              <h2
                style={{
                  fontFamily: 'Playfair Display, serif',
                  fontWeight: 400,
                  fontStyle: 'italic',
                  fontSize: 'clamp(1.9rem, 3.2vw, 3.2rem)',
                  lineHeight: 1.18,
                  letterSpacing: '-0.012em',
                  color: '#FFFFFF',
                  maxWidth: '24ch',
                }}
                data-testid="pricing-philosophy-headline"
              >
                {content.headline}
              </h2>
            )}
            {content.body && (
              <p
                className="mt-10 lg:mt-12"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 'clamp(1rem, 1.1vw, 1.08rem)',
                  lineHeight: 1.8,
                  color: 'rgba(255,255,255,0.62)',
                  fontWeight: 300,
                  maxWidth: '58ch',
                }}
                data-testid="pricing-philosophy-body"
              >
                {content.body}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingPhilosophy;
