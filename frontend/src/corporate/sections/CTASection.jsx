import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * CTASection — Call to action banner.
 * brand guide: teal bg = dark btn | dark bg = teal btn | white bg = teal btn
 */
const CTASection = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.2 });

  const bgMap = {
    teal: '#00C9B3',
    dark: '#1A1A1A',
    light: '#FFFFFF',
    white: '#FFFFFF',
  };
  const bg = bgMap[config.background] || '#FFFFFF';
  const isTeal = config.background === 'teal';
  const isDark = config.background === 'dark';

  const textColor = isTeal ? '#1A1A1A' : isDark ? '#FFFFFF' : '#1A1A1A';
  const subColor = isTeal ? 'rgba(26,26,26,0.65)' : isDark ? 'rgba(255,255,255,0.5)' : '#6B6E71';

  // Button style: on teal bg → dark btn; on dark bg → teal btn; on white → teal btn
  const primaryBtnClass = isTeal ? 'btn-dark' : 'btn-primary';

  return (
    <section className="py-24 md:py-32" style={{ background: bg }} data-testid="cta-section">
      <div className="max-w-7xl mx-auto px-8 md:px-16">
        <div
          ref={ref}
          className="grid grid-cols-1 lg:grid-cols-12 items-center gap-12"
        >
          {/* Text block */}
          <div className="lg:col-span-7">
            {/* MOOD circles logo mark */}
            {config.show_logo && (
              <div className="mb-10 opacity-20">
                <svg width="56" height="30" viewBox="0 0 56 30" fill="none">
                  <circle cx="15" cy="15" r="14" stroke={textColor} strokeWidth="2" fill="none" />
                  <circle cx="41" cy="15" r="14" stroke={textColor} strokeWidth="2" fill="none" />
                </svg>
              </div>
            )}
            <h2
              className={`font-serif font-normal tracking-tight reveal ${visible ? 'visible' : ''}`}
              style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', color: textColor, lineHeight: '1.1', transitionDelay: '0.1s' }}
            >
              {content.headline}
            </h2>
            {content.subheading && (
              <p
                className={`mt-4 text-sm font-light max-w-lg reveal ${visible ? 'visible' : ''}`}
                style={{ color: subColor, transitionDelay: '0.2s' }}
              >
                {content.subheading}
              </p>
            )}
          </div>

          {/* CTA buttons */}
          <div
            className={`lg:col-span-5 flex flex-col sm:flex-row gap-4 justify-start lg:justify-end reveal ${visible ? 'visible' : ''}`}
            style={{ transitionDelay: '0.3s' }}
          >
            {content.cta_primary && (
              <a href={content.cta_primary.href} className={primaryBtnClass} data-testid="cta-primary-btn">
                {content.cta_primary.text} ↗
              </a>
            )}
            {content.cta_secondary && (
              <a
                href={content.cta_secondary.href}
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200"
                style={{ color: textColor }}
                data-testid="cta-secondary-btn"
              >
                {content.cta_secondary.text} →
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
