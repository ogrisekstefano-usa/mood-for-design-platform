import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * LogosWall — Brand trust strip.
 * Brand guide: Montserrat for brand names, subtle opacity.
 */
const LogosWall = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.2 });
  const brands = config.brands || [];

  return (
    <section
      className="py-14"
      style={{ borderTop: '1px solid rgba(26,26,26,0.08)', borderBottom: '1px solid rgba(26,26,26,0.08)', background: '#F8F8F8' }}
      data-testid="logos-wall"
    >
      <div className="max-w-7xl mx-auto px-8 md:px-16">
        {content.eyebrow && (
          <p className="text-center mb-10 overline" style={{ color: '#6B6E71' }}>
            {content.eyebrow}
          </p>
        )}
        <div
          ref={ref}
          className={`flex flex-wrap justify-center items-center gap-x-10 md:gap-x-16 gap-y-6 reveal ${visible ? 'visible' : ''}`}
        >
          {brands.map((brand, i) => (
            <span
              key={i}
              className="font-serif transition-all duration-400 cursor-default select-none"
              style={{
                fontSize: '1.05rem',
                color: 'rgba(26,26,26,0.3)',
                letterSpacing: '0.05em',
                transitionDelay: `${i * 0.04}s`,
              }}
              onMouseEnter={e => e.target.style.color = '#1A1A1A'}
              onMouseLeave={e => e.target.style.color = 'rgba(26,26,26,0.3)'}
              data-testid={`brand-${brand.toLowerCase().replace(/[\s&+]/g, '-')}`}
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
