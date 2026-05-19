import React from 'react';
import { Grid2x2, Atom, Compass, Globe2, ArrowRight } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

/**
 * ExperiencePillars — 4-column editorial pillars section.
 * Title + 4 minimal icon + title + body columns.
 *
 * content: {
 *   overline, headline, pillars:[{ id, title, body }], cta?
 * }
 * config: { pillars:[{ id, icon }] }  // icon name overrides
 */

const ICON_MAP = {
  pro:      Grid2x2,
  design:   Atom,
  custom:   Compass,
  global:   Globe2,
};

const ExperiencePillars = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.12 });
  const configById = Object.fromEntries((config.pillars || []).map((p) => [p.id, p]));
  const pillars = Array.isArray(content.pillars) ? content.pillars : [];

  return (
    <section
      className="relative grain overflow-hidden"
      style={{ background: 'var(--mood-black)' }}
      data-testid="experience-pillars"
    >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

      <div ref={ref} className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-20 lg:py-28">
        {content.overline && (
          <p className={`overline-teal text-center mb-6 reveal ${visible ? 'visible' : ''}`}>
            {content.overline}
          </p>
        )}
        {content.headline && (
          <h2
            className={`text-center font-serif font-normal text-white reveal ${visible ? 'visible' : ''}`}
            style={{
              fontSize: 'clamp(2rem, 3.6vw, 3.2rem)',
              lineHeight: 1.08,
              transitionDelay: '0.05s',
              maxWidth: 880,
              margin: '0 auto',
            }}
          >
            {content.headline}
          </h2>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-14 mt-20">
          {pillars.map((p, i) => {
            const iconName = configById[p.id]?.icon || p.id;
            const Icon = ICON_MAP[iconName] || Grid2x2;
            return (
              <div
                key={p.id || i}
                className={`text-center reveal ${visible ? 'visible' : ''}`}
                style={{ transitionDelay: `${0.12 + i * 0.08}s` }}
                data-testid={`pillar-${p.id || i}`}
              >
                <div className="flex justify-center mb-7">
                  <Icon size={36} strokeWidth={1.2} color="#00C9B3" />
                </div>
                <p
                  className="uppercase mb-5"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.22em',
                    color: '#FFFFFF',
                  }}
                >
                  {p.title}
                </p>
                <p
                  className="font-light"
                  style={{
                    fontSize: '0.86rem',
                    lineHeight: 1.65,
                    color: 'rgba(255,255,255,0.55)',
                    fontFamily: 'Montserrat, sans-serif',
                  }}
                >
                  {p.body}
                </p>
              </div>
            );
          })}
        </div>

        {content.cta && (
          <div className="text-center mt-16">
            <a
              href={content.cta.href || '#'}
              className="inline-flex items-center gap-2 uppercase"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.22em',
                color: '#00C9B3',
                textDecoration: 'none',
              }}
              data-testid="pillars-cta"
            >
              {content.cta.text} <ArrowRight size={14} strokeWidth={1.6} />
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

export default ExperiencePillars;
