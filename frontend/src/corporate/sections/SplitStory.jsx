import React from 'react';
import { useReveal } from '../hooks/useReveal';
import { Check } from 'lucide-react';

/**
 * SplitStory — dark editorial split with optional bullet list + dashboard mockup image.
 * config: { image_url, image_position: 'left'|'right', dark: true (default for new design),
 *           background, image_alt, mockup: true (rounded shadow style) }
 * content: { overline, headline, body, bullets:[string], cta:{text,href} }
 */
const SplitStory = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.1 });
  const isImageLeft = config.image_position === 'left';
  const dark = config.dark !== false;

  const bgClass    = dark ? 'surface-dark grain' : 'surface-light';
  const headColor  = dark ? '#FFFFFF' : 'var(--mood-ink)';
  const bodyColor  = dark ? 'rgba(255,255,255,0.7)' : 'rgba(10,19,32,0.65)';

  return (
    <section
      className={`relative overflow-hidden ${bgClass}`}
      style={{ background: dark ? 'var(--mood-ink)' : undefined }}
      data-testid="split-story"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-24 lg:py-32 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        {/* Text */}
        <div
          ref={ref}
          className={`lg:col-span-5 ${isImageLeft ? 'lg:order-2' : 'lg:order-1'}`}
        >
          {content.overline && (
            <p className={`overline-teal mb-7 reveal ${visible ? 'visible' : ''}`}>{content.overline}</p>
          )}
          {content.headline && (
            <h2
              className={`font-serif font-normal leading-[1.05] tracking-tight reveal ${visible ? 'visible' : ''}`}
              style={{
                fontSize: 'clamp(2rem, 3.6vw, 3.4rem)',
                transitionDelay: '0.08s',
                whiteSpace: 'pre-line',
                color: headColor,
              }}
            >
              {content.headline}
            </h2>
          )}
          {content.body && (
            <p
              className={`mt-6 text-base font-light leading-relaxed max-w-md reveal ${visible ? 'visible' : ''}`}
              style={{ transitionDelay: '0.15s', color: bodyColor }}
            >
              {content.body}
            </p>
          )}
          {Array.isArray(content.bullets) && content.bullets.length > 0 && (
            <ul className={`mt-8 space-y-3 max-w-md reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.22s' }} data-testid="split-story-bullets">
              {content.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3" style={{ color: dark ? 'rgba(255,255,255,0.8)' : 'rgba(10,19,32,0.75)', fontSize: '0.86rem' }}>
                  <span className="mt-1 inline-flex items-center justify-center w-5 h-5 rounded-full" style={{ background: 'rgba(0,201,179,0.14)', border: '1px solid rgba(0,201,179,0.45)', color: '#00C9B3' }}>
                    <Check size={11} strokeWidth={2.4} />
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          {content.cta && (
            <div className={`mt-10 reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.3s' }}>
              <a href={content.cta.href} className={dark ? 'btn-pill-outline-teal' : 'btn-pill-teal'} data-testid="split-story-cta">
                {content.cta.text}
              </a>
            </div>
          )}
        </div>

        {/* Visual */}
        <div className={`lg:col-span-7 ${isImageLeft ? 'lg:order-1' : 'lg:order-2'}`}>
          <div
            className={`relative aspect-[16/11] rounded-xl overflow-hidden reveal ${visible ? 'visible' : ''}`}
            style={{
              transitionDelay: '0.2s',
              boxShadow: '0 50px 100px -25px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
              background: '#0F1A2A',
            }}
          >
            {config.image_url ? (
              <img src={config.image_url} alt={config.image_alt || ''} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F1A2A 0%, #050B14 100%)' }}>
                <div className="text-white/30 font-serif text-sm">Dashboard preview</div>
              </div>
            )}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(10,19,32,0) 60%, rgba(10,19,32,0.35) 100%)' }} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SplitStory;
