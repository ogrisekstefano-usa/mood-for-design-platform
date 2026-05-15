import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * CTASection — Call to action banner.
 * Backgrounds: "teal" | "dark" | "light"
 */
const CTASection = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.2 });
  const bg = config.background === 'teal'
    ? '#3DDAD0'
    : config.background === 'dark'
    ? '#0A0A0A'
    : '#FFFFFF';

  const textColor = config.background === 'teal' ? '#0A0A0A' : config.background === 'dark' ? '#F9F9F8' : '#0A0A0A';
  const subColor = config.background === 'teal' ? 'rgba(10,10,10,0.65)' : config.background === 'dark' ? 'rgba(249,249,248,0.55)' : '#5A5A5A';
  const btnClass = config.background === 'teal'
    ? 'bg-[#0A0A0A] text-white hover:bg-white hover:text-[#0A0A0A]'
    : config.background === 'dark'
    ? 'bg-[#3DDAD0] text-[#0A0A0A] hover:bg-white'
    : 'btn-primary';

  return (
    <section
      className="py-24 md:py-32"
      style={{ background: bg }}
      data-testid="cta-section"
    >
      <div className="max-w-7xl mx-auto px-8 md:px-16">
        <div
          ref={ref}
          className="grid grid-cols-1 lg:grid-cols-12 items-center gap-12"
        >
          {/* Logo icon + text */}
          <div className="lg:col-span-7">
            {config.show_logo && (
              <div className="mb-8 opacity-30">
                <div className="flex gap-1">
                  <div className="w-8 h-8 rounded-full border-2 border-current" style={{ color: textColor }} />
                  <div className="w-8 h-8 rounded-full border-2 border-current -ml-3" style={{ color: textColor }} />
                </div>
              </div>
            )}
            <h2
              className={`font-serif font-light tracking-tighter reveal ${visible ? 'visible' : ''}`}
              style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', color: textColor, lineHeight: '1.1', transitionDelay: '0.1s' }}
            >
              {content.headline}
            </h2>
            {content.subheading && (
              <p
                className={`mt-4 text-base max-w-lg reveal ${visible ? 'visible' : ''}`}
                style={{ color: subColor, transitionDelay: '0.2s' }}
              >
                {content.subheading}
              </p>
            )}
          </div>

          {/* CTA buttons */}
          <div className={`lg:col-span-5 flex flex-col sm:flex-row gap-4 justify-start lg:justify-end reveal ${visible ? 'visible' : ''}`}
               style={{ transitionDelay: '0.3s' }}>
            {content.cta_primary && (
              <a
                href={content.cta_primary.href}
                className={`inline-flex items-center gap-2 px-8 py-4 text-xs font-bold uppercase tracking-widest transition-colors duration-200 ${btnClass}`}
                data-testid="cta-primary-btn"
              >
                {content.cta_primary.text} <span>↗</span>
              </a>
            )}
            {content.cta_secondary && (
              <a
                href={content.cta_secondary.href}
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest transition-colors duration-200"
                style={{ color: textColor }}
                data-testid="cta-secondary-btn"
              >
                {content.cta_secondary.text} <span>→</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
