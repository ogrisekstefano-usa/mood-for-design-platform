import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * LogosWall — Brand trust strip.
 * Clean text-based brand names with subtle opacity on hover.
 */
const LogosWall = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.2 });
  const brands = config.brands || [];

  return (
    <section
      className="py-12 border-y"
      style={{ borderColor: 'rgba(10,10,10,0.1)', background: '#F9F9F8' }}
      data-testid="logos-wall"
    >
      <div className="max-w-7xl mx-auto px-8 md:px-16">
        {content.eyebrow && (
          <p className="text-center mb-10" style={{ fontSize: '0.68rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#5A5A5A', fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
            {content.eyebrow}
          </p>
        )}
        <div
          ref={ref}
          className={`flex flex-wrap justify-center gap-8 md:gap-12 lg:gap-16 items-center reveal ${visible ? 'visible' : ''}`}
        >
          {brands.map((brand, i) => (
            <span
              key={i}
              className="font-serif text-base md:text-lg transition-colors duration-300"
              style={{ color: 'rgba(10,10,10,0.35)', transitionDelay: `${i * 0.05}s` }}
              onMouseEnter={e => e.target.style.color = '#0A0A0A'}
              onMouseLeave={e => e.target.style.color = 'rgba(10,10,10,0.35)'}
              data-testid={`brand-${brand.toLowerCase().replace(/[\s&]/g, '-')}`}
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
