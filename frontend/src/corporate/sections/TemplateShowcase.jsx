import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * TemplateShowcase — Gallery of Blueprint design templates.
 */
const TemplateShowcase = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.05 });
  const templates = content.templates || config.templates || [];

  return (
    <section className="py-24 bg-[#0A0A0A]" data-testid="template-showcase">
      <div className="max-w-7xl mx-auto px-8 md:px-16">
        {content.headline && (
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <h2 className="font-serif font-light text-4xl md:text-5xl text-white tracking-tighter">
              {content.headline}
            </h2>
            {content.cta && (
              <a href={content.cta.href} className="text-xs font-semibold uppercase tracking-widest text-[#00C9B3] inline-flex items-center gap-2">
                {content.cta.text} <span>→</span>
              </a>
            )}
          </div>
        )}

        <div
          ref={ref}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {templates.length > 0 ? templates.map((tmpl, i) => (
            <a
              key={tmpl.id || i}
              href={tmpl.href || '#'}
              className={`group relative overflow-hidden reveal ${visible ? 'visible' : ''}`}
              style={{ aspectRatio: '3/4', transitionDelay: `${i * 0.07}s` }}
              data-testid={`template-card-${i}`}
            >
              {tmpl.image ? (
                <img src={tmpl.image} alt={tmpl.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              ) : (
                <div className="w-full h-full bg-[#1A1A1A] flex items-center justify-center">
                  <span className="font-serif text-2xl text-white/20">{tmpl.name}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-0 p-6">
                  <p className="font-sans font-semibold text-white text-sm">{tmpl.name}</p>
                  {tmpl.category && <p className="text-xs text-white/60 mt-1">{tmpl.category}</p>}
                </div>
              </div>
            </a>
          )) : (
            // Placeholder grid when no templates provided
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`bg-[#1A1A1A] reveal ${visible ? 'visible' : ''}`}
                style={{ aspectRatio: '3/4', transitionDelay: `${i * 0.07}s` }}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default TemplateShowcase;
