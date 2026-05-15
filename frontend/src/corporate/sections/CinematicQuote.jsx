import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

/**
 * CinematicQuote — Dark or light large editorial section.
 * Can include: headline, features list, testimonial quote.
 */
const CinematicQuote = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.08 });
  const isDark = config.background === 'dark';
  const bg = isDark ? '#0A0A0A' : '#F9F9F8';
  const textPrimary = isDark ? '#F9F9F8' : '#0A0A0A';
  const textSecondary = isDark ? 'rgba(249,249,248,0.55)' : '#5A5A5A';

  return (
    <section
      id="cinematic"
      className="py-32"
      style={{ background: bg }}
      data-testid="cinematic-quote"
    >
      <div className="max-w-7xl mx-auto px-8 md:px-16">
        <div ref={ref} className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">

          {/* Left: Main content */}
          <div className="lg:col-span-7">
            {content.overline && (
              <p className={`overline-teal mb-8 reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0s' }}>
                {content.overline}
              </p>
            )}
            {content.headline && (
              <h2
                className={`font-serif font-light tracking-tighter reveal ${visible ? 'visible' : ''}`}
                style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', lineHeight: '1', color: textPrimary, whiteSpace: 'pre-line', transitionDelay: '0.1s' }}
              >
                {content.headline}
              </h2>
            )}
            {content.body && (
              <p
                className={`mt-8 text-base leading-relaxed max-w-lg reveal ${visible ? 'visible' : ''}`}
                style={{ color: textSecondary, transitionDelay: '0.2s' }}
              >
                {content.body}
              </p>
            )}

            {/* Feature list */}
            {config.show_features && content.features?.length > 0 && (
              <ul className={`mt-10 space-y-3 reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.3s' }}>
                {content.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle size={16} className="text-[#3DDAD0] flex-shrink-0" />
                    <span className="text-sm" style={{ color: textSecondary }}>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Right: Image + testimonial */}
          <div className="lg:col-span-5 space-y-8">
            {config.image_url && (
              <div
                className={`relative overflow-hidden reveal ${visible ? 'visible' : ''}`}
                style={{ transitionDelay: '0.15s', aspectRatio: '4/5' }}
              >
                <img
                  src={config.image_url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* Testimonial */}
            {config.show_testimonial && content.quote && (
              <div
                className={`border-t pt-8 reveal ${visible ? 'visible' : ''}`}
                style={{ borderColor: isDark ? 'rgba(249,249,248,0.15)' : 'rgba(10,10,10,0.1)', transitionDelay: '0.4s' }}
                data-testid="testimonial-quote"
              >
                <span className="font-serif text-5xl leading-none" style={{ color: '#3DDAD0' }}>"</span>
                <p
                  className="font-serif text-lg leading-snug mt-2"
                  style={{ color: textPrimary, fontStyle: 'italic' }}
                >
                  {content.quote}
                </p>
                {content.quote_author && (
                  <div className="mt-6">
                    <p className="text-sm font-semibold" style={{ color: textPrimary }}>
                      — {content.quote_author}
                    </p>
                    {content.quote_role && (
                      <p className="text-xs mt-1" style={{ color: textSecondary }}>
                        {content.quote_role}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quote without testimonial block */}
            {!config.show_testimonial && content.quote && (
              <div
                className={`border-l-2 border-[#3DDAD0] pl-8 reveal ${visible ? 'visible' : ''}`}
                style={{ transitionDelay: '0.35s' }}
                data-testid="cinematic-large-quote"
              >
                <p className="font-serif italic" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', color: textPrimary, lineHeight: '1.2' }}>
                  "{content.quote}"
                </p>
                {content.quote_author && (
                  <p className="mt-6 text-sm font-semibold" style={{ color: textSecondary }}>
                    — {content.quote_author}
                    {content.quote_role && `, ${content.quote_role}`}
                  </p>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </section>
  );
};

export default CinematicQuote;
