import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

/**
 * CinematicQuote — Dark editorial section.
 * Layout: 3 columns: [text + features] | [image] | [testimonial]
 * Headline split: headline (white) + headline_accent (teal)
 */
const CinematicQuote = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.06 });
  const isDark = config.background !== 'light';
  const bg = isDark ? '#000000' : '#F8F8F8';
  const textPrimary = isDark ? '#FFFFFF' : '#000000';
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : '#6B6E71';

  return (
    <section
      id="cinematic"
      className="py-28 md:py-36"
      style={{ background: bg }}
      data-testid="cinematic-quote"
    >
      <div className="max-w-7xl mx-auto px-8 md:px-16">
        <div
          ref={ref}
          className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-16 items-start"
        >

          {/* Column 1: Headline + body + features */}
          <div className="md:col-span-5">
            {content.overline && (
              <p className={`overline-teal mb-8 reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0s' }}>
                {content.overline}
              </p>
            )}

            {/* Split headline: headline (white) + headline_accent (teal) */}
            <h2
              className={`font-serif font-normal tracking-tight reveal ${visible ? 'visible' : ''}`}
              style={{
                fontSize: 'clamp(2.5rem, 4.5vw, 4rem)',
                lineHeight: '1.05',
                color: textPrimary,
                transitionDelay: '0.1s',
              }}
            >
              {content.headline && (
                <span className="block">{content.headline}</span>
              )}
              {content.headline_accent && (
                <span className="block" style={{ color: '#00C9B3' }}>{content.headline_accent}</span>
              )}
              {/* Legacy: if single headline with \n */}
              {!content.headline_accent && content.headline && !content.headline.includes('\n') && null}
            </h2>

            {content.body && (
              <p
                className={`mt-7 text-sm font-light leading-relaxed max-w-sm reveal ${visible ? 'visible' : ''}`}
                style={{ color: textSecondary, transitionDelay: '0.2s' }}
              >
                {content.body}
              </p>
            )}

            {config.show_features !== false && content.features?.length > 0 && (
              <ul className={`mt-8 space-y-3 reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.3s' }}>
                {content.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle size={15} className="flex-shrink-0" style={{ color: '#00C9B3' }} />
                    <span className="text-sm font-light" style={{ color: textSecondary }}>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Column 2: Image */}
          {config.image_url && (
            <div
              className={`md:col-span-4 relative overflow-hidden reveal ${visible ? 'visible' : ''}`}
              style={{ minHeight: '480px', transitionDelay: '0.12s' }}
            >
              <img
                src={config.image_url}
                alt=""
                className="w-full h-full object-cover absolute inset-0"
                loading="lazy"
              />
            </div>
          )}

          {/* Column 3: Testimonial */}
          {(content.quote || (!config.image_url)) && (
            <div
              className={`md:col-span-3 flex flex-col justify-center reveal ${visible ? 'visible' : ''}`}
              style={{ transitionDelay: '0.25s' }}
            >
              {content.quote && (
                <div data-testid="testimonial-quote">
                  <span
                    className="font-serif block mb-3"
                    style={{ fontSize: '5rem', lineHeight: '1', color: '#00C9B3', fontStyle: 'italic' }}
                  >
                    "
                  </span>
                  <p
                    className="font-serif text-lg leading-snug"
                    style={{ color: textPrimary, fontStyle: 'italic', fontSize: '1.15rem' }}
                  >
                    {content.quote}
                  </p>
                  {content.quote_author && (
                    <div className="mt-8">
                      <p className="text-sm font-semibold" style={{ color: textPrimary }}>
                        — {content.quote_author}
                      </p>
                      {content.quote_role && (
                        <p className="text-xs mt-1 font-light" style={{ color: textSecondary }}>
                          {content.quote_role}
                        </p>
                      )}
                    </div>
                  )}
                  {/* Carousel dots */}
                  <div className="flex gap-2 mt-10">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="h-0.5 transition-all duration-300"
                        style={{ width: i === 0 ? '24px' : '8px', background: i === 0 ? '#00C9B3' : 'rgba(255,255,255,0.2)' }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </section>
  );
};

export default CinematicQuote;
