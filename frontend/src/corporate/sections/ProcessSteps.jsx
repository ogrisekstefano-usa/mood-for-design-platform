import React from 'react';
import { useReveal } from '../hooks/useReveal';
import { ArrowRight } from 'lucide-react';

/**
 * ProcessSteps — 6-step "Client Journey" connected by lines.
 * content: { overline, headline, body, steps:[{title, description}] }
 * config:  { dark: true (default), num_columns? }
 */
const ProcessSteps = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.1 });
  const dark = config.dark !== false;
  const steps = content.steps || [];

  return (
    <section
      className={`relative overflow-hidden ${dark ? 'grain' : ''}`}
      style={{ background: dark ? 'var(--mood-ink)' : 'var(--mood-bone)' }}
      data-testid="process-steps"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-24 lg:py-32">
        <div ref={ref} className={`max-w-3xl reveal ${visible ? 'visible' : ''}`}>
          {content.overline && <p className="overline-teal mb-6">{content.overline}</p>}
          {content.headline && (
            <h2
              className="font-serif leading-[1.05]"
              style={{ fontSize: 'clamp(2rem, 3.8vw, 3.4rem)', color: dark ? '#FFFFFF' : 'var(--mood-ink)' }}
            >
              {content.headline}
            </h2>
          )}
          {content.body && (
            <p
              className="mt-5 text-base leading-relaxed font-light max-w-2xl"
              style={{ color: dark ? 'rgba(255,255,255,0.65)' : 'rgba(10,19,32,0.65)' }}
            >
              {content.body}
            </p>
          )}
        </div>

        {/* Steps grid */}
        <div className="mt-16 lg:mt-20 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-12 relative">
          {/* Connecting line behind step circles (desktop only) */}
          <div className="hidden lg:block absolute" style={{ top: '23px', left: '4%', right: '4%', height: '1px', background: 'rgba(0,201,179,0.25)', zIndex: 0 }} />

          {steps.map((step, i) => (
            <div
              key={i}
              className={`relative reveal ${visible ? 'visible' : ''}`}
              style={{ transitionDelay: `${0.1 + i * 0.06}s`, zIndex: 1 }}
              data-testid={`process-step-${i}`}
            >
              {/* Connecting arrow (hidden on last + mobile) */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute" style={{ top: '16px', right: '-12px', color: 'rgba(0,201,179,0.5)' }}>
                  <ArrowRight size={16} strokeWidth={1.4} />
                </div>
              )}

              <div className="step-circle mb-5" style={{ background: dark ? 'var(--mood-black)' : '#FFFFFF' }}>{String(i + 1).padStart(2, '0')}</div>
              <h3
                className="text-xs font-semibold uppercase tracking-[0.16em] leading-tight mb-2"
                style={{ color: dark ? '#FFFFFF' : 'var(--mood-black)' }}
              >
                {step.title}
              </h3>
              <p
                className="text-sm font-light leading-relaxed"
                style={{ color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}
              >
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProcessSteps;
