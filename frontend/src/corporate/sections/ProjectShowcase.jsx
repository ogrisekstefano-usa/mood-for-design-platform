import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * ProjectShowcase — Light section with editorial project cards.
 * content: { overline, headline, projects:[{title, location, style, image}] }
 * config:  { background?, columns? }
 */
const ProjectShowcase = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.1 });
  const projects = content.projects || [];
  const cols = config.columns || 4;
  const bg = config.background || '#F5F2EC'; // bone

  return (
    <section
      className="relative"
      style={{ background: bg, color: '#0A1320' }}
      data-testid="project-showcase"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-24 lg:py-32">
        <div ref={ref} className={`max-w-3xl mb-14 lg:mb-20 reveal ${visible ? 'visible' : ''}`}>
          {content.overline && <p className="overline-ink mb-5" style={{ color: '#0A1320', opacity: 0.6 }}>{content.overline}</p>}
          {content.headline && (
            <h2 className="font-serif leading-[1.05]" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.4rem)' }}>
              {content.headline}
            </h2>
          )}
          {content.body && (
            <p className="mt-5 text-base font-light leading-relaxed max-w-2xl" style={{ color: 'rgba(10,19,32,0.6)' }}>
              {content.body}
            </p>
          )}
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${cols} gap-6 lg:gap-8`}>
          {projects.map((p, i) => (
            <article
              key={i}
              className={`group reveal ${visible ? 'visible' : ''}`}
              style={{ transitionDelay: `${0.1 + i * 0.07}s` }}
              data-testid={`project-card-${i}`}
            >
              <div
                className="relative aspect-[4/5] rounded-lg overflow-hidden mb-5"
                style={{ background: '#E8E2D5', boxShadow: '0 20px 40px -20px rgba(10,19,32,0.15)' }}
              >
                {p.image && (
                  <img
                    src={p.image}
                    alt={p.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                )}
                {p.style && (
                  <span
                    className="absolute top-4 left-4 inline-block text-[0.55rem] tracking-[0.18em] uppercase font-medium px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.92)', color: '#0A1320', backdropFilter: 'blur(8px)' }}
                  >
                    {p.style}
                  </span>
                )}
              </div>
              <h3 className="font-serif text-xl leading-tight mb-1.5 transition-colors duration-200 group-hover:text-[#2BB9B0]">
                {p.title}
              </h3>
              {p.location && (
                <p className="text-xs font-light tracking-wide" style={{ color: 'rgba(10,19,32,0.55)' }}>
                  {p.location}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProjectShowcase;
