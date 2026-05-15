import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * LogosWall — Brand trust strip.
 * Brand guide: Montserrat for brand names, subtle opacity.
 */
const LogosWall = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.2 });
  const brands = config.brands || content.brands || [];
  const dark = config.dark !== false; // default DARK to match new theme

  return (
    <section
      className="py-16"
      style={{
        background: dark ? 'var(--mood-ink)' : '#F5F2EC',
        borderTop: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(10,19,32,0.08)',
        borderBottom: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(10,19,32,0.08)',
      }}
      data-testid="logos-wall"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14">
        {content.eyebrow && (
          <p
            className={`text-center mb-10 ${dark ? 'overline-teal' : 'overline-ink'}`}
            style={!dark ? { color: 'rgba(10,19,32,0.6)' } : undefined}
          >
            {content.eyebrow}
          </p>
        )}
        <div
          ref={ref}
          className={`flex flex-wrap justify-center items-center gap-x-12 md:gap-x-16 gap-y-6 reveal ${visible ? 'visible' : ''}`}
        >
          {brands.map((brand, i) => (
            <span
              key={i}
              className="font-serif transition-all duration-300 cursor-default select-none"
              style={{
                fontSize: '1.05rem',
                color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(10,19,32,0.4)',
                letterSpacing: '0.05em',
                transitionDelay: `${i * 0.04}s`,
              }}
              onMouseEnter={e => (e.target.style.color = dark ? '#FFFFFF' : '#0A1320')}
              onMouseLeave={e => (e.target.style.color = dark ? 'rgba(255,255,255,0.35)' : 'rgba(10,19,32,0.4)')}
              data-testid={`brand-${(brand || '').toString().toLowerCase().replace(/[\s&+*]/g, '-')}`}
            >
              {brand}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LogosWall;
