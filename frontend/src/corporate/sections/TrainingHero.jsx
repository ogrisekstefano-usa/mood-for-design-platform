import React from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';

/**
 * TrainingHero — panoramic editorial hero (unified pattern with the
 * rest of the site). Three-line serif headline (each line on its own
 * line, separated by "."), dual CTA (primary outlined teal + secondary
 * ghost), text in the top-left aligned with the navigation container.
 *
 * content: { eyebrow, title_line_1, title_line_2, title_line_3,
 *            body, cta_primary, cta_secondary }
 * media:   { background: { url, alt } }
 * links:   { cta_primary_href, cta_secondary_href }
 */
const TrainingHero = ({ content = {}, media = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.12 });
  const bg = media.background;

  const lines = [content.title_line_1, content.title_line_2, content.title_line_3]
    .filter((l) => l && l.trim());

  return (
    <section
      ref={ref}
      className={`relative overflow-hidden reveal ${visible ? 'visible' : ''}`}
      style={{ background: '#000000', minHeight: 'clamp(640px, 84vh, 920px)' }}
      data-testid="training-hero"
    >
      {bg && bg.url && (
        <img
          src={bg.url}
          alt={bg.alt || ''}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            objectPosition: 'center 38%',
          }}
          loading="eager"
        />
      )}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          background:
            'linear-gradient(to right, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.94) 22%, rgba(0,0,0,0.78) 42%, rgba(0,0,0,0.5) 62%, rgba(0,0,0,0.18) 78%, rgba(0,0,0,0) 92%)',
        }}
      />

      <div
        className="relative z-10 flex items-center"
        style={{ minHeight: 'clamp(640px, 84vh, 920px)' }}
      >
        <div
          className="w-full"
          style={{
            paddingLeft: 'max(1.5rem, calc((100vw - 1536px) / 2 + 4rem))',
            paddingRight: 'clamp(1.5rem, 4vw, 3rem)',
            paddingTop: '5rem', paddingBottom: '5rem',
          }}
        >
          <div className="max-w-[560px]">
            {content.eyebrow && (
              <p
                style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '0.74rem', fontWeight: 500,
                  letterSpacing: '0.24em', textTransform: 'uppercase',
                  color: 'var(--mood-teal, #00C9B3)', marginBottom: '2.4rem',
                }}
                data-testid="training-hero-eyebrow"
              >
                {content.eyebrow}
              </p>
            )}
            {lines.length > 0 && (
              <h1
                style={{
                  fontFamily: 'Playfair Display, serif', fontWeight: 400,
                  fontSize: 'clamp(2.8rem, 5vw, 4.8rem)', lineHeight: 1.04,
                  letterSpacing: '-0.02em', color: '#FFFFFF',
                }}
                data-testid="training-hero-title"
              >
                {lines.map((l, i) => (
                  <span key={i} style={{ display: 'block' }}>{l}</span>
                ))}
              </h1>
            )}
            {content.body && (
              <p
                className="mt-8 lg:mt-10"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 'clamp(1rem, 1.12vw, 1.08rem)',
                  lineHeight: 1.72, color: 'rgba(255,255,255,0.78)', fontWeight: 300,
                  maxWidth: '44ch',
                }}
                data-testid="training-hero-body"
              >
                {content.body}
              </p>
            )}

            {(content.cta_primary || content.cta_secondary) && (
              <div className="mt-10 lg:mt-12 flex items-center gap-6 flex-wrap">
                {content.cta_primary && (
                  <Link
                    to={links.cta_primary_href || '#percorsi'}
                    style={{
                      display: 'inline-block',
                      fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
                      fontWeight: 400, letterSpacing: '0.04em',
                      color: 'var(--mood-teal, #00C9B3)', textDecoration: 'none',
                      padding: '1rem 1.8rem',
                      border: '1px solid var(--mood-teal, #00C9B3)',
                      transition: 'all 0.25s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,201,179,0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    data-testid="training-hero-cta-primary"
                  >
                    {content.cta_primary}
                  </Link>
                )}
                {content.cta_secondary && (
                  <Link
                    to={links.cta_secondary_href || '#tutorial'}
                    style={{
                      fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
                      fontWeight: 400, letterSpacing: '0.04em',
                      color: 'rgba(255,255,255,0.78)', textDecoration: 'none',
                      transition: 'color 0.25s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.78)'; }}
                    data-testid="training-hero-cta-secondary"
                  >
                    {content.cta_secondary}
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrainingHero;
