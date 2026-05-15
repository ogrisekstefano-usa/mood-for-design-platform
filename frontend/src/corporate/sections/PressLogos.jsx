import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * PressLogos — Editorial press strip ("Used and loved by").
 * content: { overline, headline, logos:[{name}] }
 * config:  { dark: false (default light) }
 */
const PressLogos = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.15 });
  const dark = !!config.dark;
  const logos = content.logos || [];

  return (
    <section
      className="relative"
      style={{ background: dark ? 'var(--mood-ink)' : '#F5F2EC', color: dark ? '#FFFFFF' : '#000000' }}
      data-testid="press-logos"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-20 lg:py-24">
        <div ref={ref} className={`text-center reveal ${visible ? 'visible' : ''}`}>
          {content.overline && <p className={dark ? 'overline-teal mb-5' : 'overline-ink mb-5'} style={{ opacity: 0.7 }}>{content.overline}</p>}
          {content.headline && (
            <h3 className="font-serif text-2xl md:text-3xl leading-tight mb-12 max-w-3xl mx-auto">
              {content.headline}
            </h3>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 lg:gap-x-14">
          {logos.map((logo, i) => (
            <span
              key={i}
              className={`reveal ${visible ? 'visible' : ''}`}
              style={{
                fontFamily: logo.font === 'sans' ? 'Montserrat, sans-serif' : (logo.font === 'mono' ? 'monospace' : 'Playfair Display, serif'),
                fontWeight: logo.weight || 600,
                fontStyle: logo.italic ? 'italic' : 'normal',
                fontSize: 'clamp(0.95rem, 1.4vw, 1.3rem)',
                letterSpacing: logo.spacing || '0.04em',
                color: dark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.75)',
                textTransform: logo.uppercase ? 'uppercase' : 'none',
                transitionDelay: `${0.1 + i * 0.05}s`,
                whiteSpace: 'nowrap',
              }}
              data-testid={`press-logo-${i}`}
            >
              {logo.name}
              {logo.starred && <span style={{ color: '#00C9B3', marginLeft: 2 }}>*</span>}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PressLogos;
