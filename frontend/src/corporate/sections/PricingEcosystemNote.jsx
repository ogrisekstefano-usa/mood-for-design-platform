import React from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';

/**
 * PricingEcosystemNote — closing editorial block that elevates the
 * perception from "software pricing" to "ecosystem access".
 *
 * Pairs a long-form editorial copy on the left with 3 small "service
 * pillars" on the right (onboarding · formazione · team dedicato).
 * Designed to communicate enterprise-tier presence without saying
 * "enterprise".
 *
 * content: {
 *   eyebrow, headline, body,
 *   pillar_01_title, pillar_01_body,
 *   pillar_02_title, pillar_02_body,
 *   pillar_03_title, pillar_03_body,
 *   cta_label,
 * }
 * links:   { cta_href }
 */
const PricingEcosystemNote = ({ content = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.15 });

  const pillars = [1, 2, 3].map((n) => {
    const k = String(n).padStart(2, '0');
    return {
      n: k,
      title: content[`pillar_${k}_title`],
      body:  content[`pillar_${k}_body`],
    };
  }).filter((p) => (p.title && p.title.trim()) || (p.body && p.body.trim()));

  return (
    <section
      ref={ref}
      className={`relative reveal ${visible ? 'visible' : ''}`}
      style={{ background: '#050606', padding: 'clamp(5rem, 10vw, 10rem) 0' }}
      data-testid="pricing-ecosystem-note"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-12 lg:px-20">
        <div
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,_1fr)_minmax(0,_1.1fr)]"
          style={{ gap: 'clamp(3rem, 6vw, 7rem)', alignItems: 'start' }}
        >
          {/* LEFT — editorial copy */}
          <div>
            {content.eyebrow && (
              <p
                style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', fontWeight: 500,
                  letterSpacing: '0.24em', textTransform: 'uppercase',
                  color: 'var(--mood-teal, #00C9B3)', marginBottom: '2rem',
                }}
                data-testid="pricing-ecosystem-eyebrow"
              >
                {content.eyebrow}
              </p>
            )}
            {content.headline && (
              <h2
                style={{
                  fontFamily: 'Playfair Display, serif', fontWeight: 400,
                  fontSize: 'clamp(2.1rem, 3.4vw, 3.4rem)', lineHeight: 1.1,
                  letterSpacing: '-0.015em', color: '#FFFFFF',
                  maxWidth: '18ch',
                }}
                data-testid="pricing-ecosystem-headline"
              >
                {content.headline}
              </h2>
            )}
            {content.body && (
              <p
                className="mt-8 lg:mt-10"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 'clamp(0.98rem, 1.08vw, 1.06rem)',
                  lineHeight: 1.78, color: 'rgba(255,255,255,0.62)',
                  fontWeight: 300, maxWidth: '46ch',
                }}
                data-testid="pricing-ecosystem-body"
              >
                {content.body}
              </p>
            )}
            {content.cta_label && (
              <div className="mt-10 lg:mt-12">
                <Link
                  to={links.cta_href || '/supporto'}
                  style={{
                    display: 'inline-block',
                    fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
                    fontWeight: 400, letterSpacing: '0.04em',
                    color: '#FFFFFF', textDecoration: 'none',
                    padding: '1rem 2rem',
                    border: '1px solid rgba(255,255,255,0.4)',
                    transition: 'all 0.25s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'var(--mood-teal, #00C9B3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
                  data-testid="pricing-ecosystem-cta"
                >
                  {content.cta_label}
                </Link>
              </div>
            )}
          </div>

          {/* RIGHT — 3 pillars */}
          <div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {pillars.map((p, i) => (
                <li
                  key={p.n}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(60px, 80px) 1fr',
                    gap: 'clamp(1rem, 2vw, 2rem)',
                    padding: 'clamp(1.5rem, 3vw, 2.4rem) 0',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    ...(i === pillars.length - 1
                      ? { borderBottom: '1px solid rgba(255,255,255,0.06)' }
                      : {}),
                  }}
                  data-testid={`pricing-ecosystem-pillar-${p.n}`}
                >
                  <div
                    style={{
                      fontFamily: 'Playfair Display, serif', fontWeight: 400,
                      fontSize: '2rem', lineHeight: 1, color: 'transparent',
                      WebkitTextStroke: '1px var(--mood-teal, #00C9B3)',
                      paddingTop: '0.2rem',
                    }}
                  >
                    {p.n}
                  </div>
                  <div>
                    {p.title && (
                      <h4
                        style={{
                          fontFamily: 'Playfair Display, serif', fontWeight: 400,
                          fontSize: 'clamp(1.2rem, 1.6vw, 1.5rem)', lineHeight: 1.25,
                          color: '#FFFFFF', marginBottom: '0.7rem',
                          letterSpacing: '-0.005em',
                        }}
                      >
                        {p.title}
                      </h4>
                    )}
                    {p.body && (
                      <p
                        style={{
                          fontFamily: 'Inter, sans-serif', fontSize: '0.9rem',
                          lineHeight: 1.65, color: 'rgba(255,255,255,0.58)',
                          fontWeight: 300, maxWidth: '46ch',
                        }}
                      >
                        {p.body}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingEcosystemNote;
