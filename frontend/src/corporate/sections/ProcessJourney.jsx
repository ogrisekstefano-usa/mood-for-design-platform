import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * ProcessJourney — editorial 4-step process (Ascolto / Curatela / Progetto / Realizzazione).
 * No SaaS-style flowchart — uses large numbers + serif titles for editorial feel.
 *
 * content keys: eyebrow, title, step_1.title, step_1.body, step_2.*, step_3.*, step_4.*
 */
const STEPS = ['step_1', 'step_2', 'step_3', 'step_4'];

const ProcessJourney = ({ content = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.12 });

  return (
    <section className="relative grain overflow-hidden" style={{ background: '#F5F2EC', color: '#0E0E10' }} data-testid="process-journey">
      <div ref={ref} className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-20 lg:py-32">
        {content.eyebrow && (
          <p
            className={`text-center uppercase mb-6 reveal ${visible ? 'visible' : ''}`}
            style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.28em', color: '#00C9B3' }}
          >
            {content.eyebrow}
          </p>
        )}
        {content.title && (
          <h2
            className={`text-center font-serif font-normal reveal ${visible ? 'visible' : ''}`}
            style={{
              fontSize: 'clamp(2.2rem, 4vw, 3.6rem)',
              lineHeight: 1.08,
              whiteSpace: 'pre-line',
              color: '#0E0E10',
              maxWidth: 900,
              margin: '0 auto',
              transitionDelay: '0.05s',
            }}
          >
            {content.title}
          </h2>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-16 gap-x-10 mt-24">
          {STEPS.map((sk, i) => {
            const title = content[`${sk}.title`];
            const body  = content[`${sk}.body`];
            if (!title) return null;
            return (
              <div
                key={sk}
                className={`reveal ${visible ? 'visible' : ''}`}
                style={{ transitionDelay: `${0.1 + i * 0.08}s` }}
                data-testid={`process-step-${i + 1}`}
              >
                <p
                  style={{
                    fontFamily: 'Playfair Display, serif',
                    fontSize: 'clamp(2.8rem, 5vw, 4.5rem)',
                    lineHeight: 1,
                    fontWeight: 300,
                    color: 'rgba(0,201,179,0.55)',
                    marginBottom: 16,
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.4rem, 1.9vw, 1.85rem)', lineHeight: 1.2, fontWeight: 400 }}>
                  {title}
                </h3>
                {body && (
                  <p
                    style={{
                      marginTop: 14,
                      fontFamily: 'Montserrat, sans-serif',
                      fontSize: '0.92rem',
                      lineHeight: 1.65,
                      color: '#5A4F44',
                      maxWidth: '34ch',
                    }}
                  >
                    {body}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ProcessJourney;
