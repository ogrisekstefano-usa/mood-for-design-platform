import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * EditorialHero — Primary hero section.
 * Layouts: "split-right" | "split-left" | "centered"
 * Design: Cormorant Garamond serif, teal accent on third headline
 */
const EditorialHero = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.05 });
  const isCentered = config.layout === 'centered';
  const isDark = config.dark_mode || config.background === '#0A0A0A';

  if (isCentered) {
    return (
      <section
        className="min-h-[60vh] flex items-center justify-center"
        style={{ background: isDark ? '#0A0A0A' : (config.background || '#F9F9F8') }}
        data-testid="editorial-hero-centered"
      >
        <div
          ref={ref}
          className={`max-w-4xl mx-auto px-8 md:px-16 text-center reveal ${visible ? 'visible' : ''}`}
        >
          {content.eyebrow && (
            <p className={`overline mb-8 reveal-delay-1 ${visible ? 'visible' : ''} ${isDark ? 'text-[#3DDAD0]' : ''}`}
               style={{ opacity: visible ? 1 : 0, transitionDelay: '0.05s' }}>
              {content.eyebrow}
            </p>
          )}
          <h1 className={`font-serif font-light leading-none tracking-tighter mb-8 ${isDark ? 'text-white' : 'text-[#0A0A0A]'}`}
              style={{ fontSize: 'clamp(3rem, 7vw, 6rem)' }}>
            {content.headline_1 && <span className="block">{content.headline_1}</span>}
            {content.headline_2 && <span className="block">{content.headline_2}</span>}
            {content.headline_3 && <span className="block text-[#3DDAD0]">{content.headline_3}</span>}
          </h1>
          {content.subheading && (
            <p className={`text-base leading-relaxed max-w-2xl mx-auto mb-12 ${isDark ? 'text-white/60' : 'text-[#5A5A5A]'}`}>
              {content.subheading}
            </p>
          )}
          {(content.cta_primary || content.cta_secondary) && (
            <div className="flex flex-wrap gap-4 justify-center">
              {content.cta_primary && (
                <a href={content.cta_primary.href} className="btn-primary" data-testid="hero-cta-primary">
                  {content.cta_primary.text} <span>↗</span>
                </a>
              )}
              {content.cta_secondary && (
                <a href={content.cta_secondary.href} className={`btn-ghost ${isDark ? 'text-white/70 hover:text-white' : ''}`} data-testid="hero-cta-secondary">
                  {content.cta_secondary.text} <span>→</span>
                </a>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative min-h-screen grid grid-cols-1 lg:grid-cols-2"
      style={{ background: isDark ? '#0A0A0A' : '#F9F9F8' }}
      data-testid="editorial-hero-split"
    >
      {/* Text column */}
      <div
        ref={ref}
        className={`flex flex-col justify-center px-8 md:px-16 lg:px-20 xl:px-28 py-32 ${config.layout === 'split-left' ? 'lg:order-2' : ''}`}
      >
        {content.eyebrow && (
          <p className={`overline mb-8 ${isDark ? 'text-[#3DDAD0]' : ''} reveal ${visible ? 'visible' : ''}`}
             style={{ transitionDelay: '0s' }}>
            {content.eyebrow}
          </p>
        )}
        <h1
          className={`font-serif font-light leading-none tracking-tighter reveal ${visible ? 'visible' : ''} ${isDark ? 'text-white' : 'text-[#0A0A0A]'}`}
          style={{ fontSize: 'clamp(2.8rem, 5.5vw, 5.5rem)', transitionDelay: '0.1s' }}
        >
          {content.headline_1 && <span className="block">{content.headline_1}</span>}
          {content.headline_2 && <span className="block">{content.headline_2}</span>}
          {content.headline_3 && <span className="block text-[#3DDAD0]">{content.headline_3}</span>}
        </h1>
        {content.subheading && (
          <p className={`mt-8 text-base leading-relaxed max-w-md reveal ${visible ? 'visible' : ''} ${isDark ? 'text-white/60' : 'text-[#5A5A5A]'}`}
             style={{ transitionDelay: '0.2s' }}>
            {content.subheading}
          </p>
        )}
        {(content.cta_primary || content.cta_secondary) && (
          <div className={`mt-12 flex flex-wrap gap-6 items-center reveal ${visible ? 'visible' : ''}`}
               style={{ transitionDelay: '0.3s' }}>
            {content.cta_primary && (
              <a href={content.cta_primary.href} className="btn-primary" data-testid="hero-cta-primary">
                {content.cta_primary.text} <span>↗</span>
              </a>
            )}
            {content.cta_secondary && (
              <a href={content.cta_secondary.href} className={`btn-ghost ${isDark ? 'text-white/70 hover:text-white' : ''}`} data-testid="hero-cta-secondary">
                {content.cta_secondary.text} <span>→</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Image column */}
      {config.image_url && (
        <div className={`hidden lg:block relative overflow-hidden ${config.layout === 'split-left' ? 'lg:order-1' : ''}`}>
          <img
            src={config.image_url}
            alt={config.image_alt || ''}
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-black/10" />
        </div>
      )}
    </section>
  );
};

export default EditorialHero;
