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
      style={{ background: bg, color: '#000000' }}
      data-testid="project-showcase"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-24 lg:py-32">
        <div ref={ref} className={`max-w-3xl mb-14 lg:mb-20 reveal ${visible ? 'visible' : ''}`}>
          {content.overline && <p className="overline-ink mb-5" style={{ color: '#000000', opacity: 0.6 }}>{content.overline}</p>}
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
                className="relative aspect-[4/3] rounded-lg overflow-hidden mb-4"
                style={{ background: '#E8E2D5', boxShadow: '0 20px 40px -20px rgba(0,0,0,0.18)' }}
              >
                {p.image && (
                  <img
                    src={p.image}
                    alt={p.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                )}
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55) 100%)' }} />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="font-sans text-white text-lg font-semibold leading-tight">{p.title}</h3>
                  {p.studio && <p className="text-white/75 text-xs mt-0.5">{p.studio}</p>}
                </div>
              </div>
              {(p.status || p.style) && (
                <div className="flex gap-2 px-1">
                  {p.status && (
                    <span
                      className="inline-flex items-center text-[0.6rem] tracking-[0.14em] uppercase font-medium px-3 py-1 rounded-full"
                      style={{ background: 'rgba(0,201,179,0.10)', color: '#00A593', border: '1px solid rgba(0,201,179,0.25)' }}
                    >
                      {p.status}
                    </span>
                  )}
                  {p.style && (
                    <span
                      className="inline-flex items-center text-[0.6rem] tracking-[0.14em] uppercase font-medium px-3 py-1 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.6)' }}
                    >
                      {p.style}
                    </span>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProjectShowcase;
