import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * HeroEditorial — panoramic homepage hero (unified pattern with the
 * rest of the site).
 *
 * Photo runs edge-to-edge; horizontal left-to-right black veil holds the
 * editorial copy in the top-left, container-aligned with the navigation.
 *
 * content: { eyebrow, title_1, title_2, title_3, body, cta_primary, cta_secondary }
 * media:   { image: { url, alt } }
 * links:   { cta_primary_href, cta_secondary_href }
 */
const HeroEditorial = ({ content = {}, media = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.05 });
  const image = media.image;

  return (
    <section
      ref={ref}
      className={`relative overflow-hidden reveal ${visible ? 'visible' : ''}`}
      style={{
        background: '#000000',
        minHeight: 'clamp(640px, 84vh, 920px)',
      }}
      data-testid="hero-editorial"
    >
      {image && image.url && (
        <img
          src={image.url}
          alt={image.alt || ''}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            objectPosition: 'center 40%',
          }}
          loading="eager"
        />
      )}
      {/* Unified left-to-right black veil */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          background:
            'linear-gradient(to right, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.95) 28%, rgba(0,0,0,0.82) 50%, rgba(0,0,0,0.55) 68%, rgba(0,0,0,0.22) 82%, rgba(0,0,0,0) 95%)',
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
          <div className="max-w-[860px]">
            {content.eyebrow && (
              <p
                style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '0.74rem', fontWeight: 500,
                  letterSpacing: '0.24em', textTransform: 'uppercase',
                  color: 'var(--mood-teal, #00C9B3)', marginBottom: '2.4rem',
                }}
                data-testid="hero-eyebrow"
              >
                {content.eyebrow}
              </p>
            )}
            <h1
              style={{
                fontFamily: 'Playfair Display, serif', fontWeight: 400,
                fontSize: 'clamp(2.8rem, 5.6vw, 5.8rem)', lineHeight: 1.04,
                letterSpacing: '-0.02em', color: '#FFFFFF',
              }}
              data-testid="hero-title"
            >
              {content.title_1 && <span style={{ display: 'block' }}>{content.title_1}</span>}
              {content.title_2 && <span style={{ display: 'block' }}>{content.title_2}</span>}
              {content.title_3 && (
                <span style={{ display: 'block', color: 'var(--mood-teal, #00C9B3)' }}>
                  {content.title_3}
                </span>
              )}
            </h1>

            {content.body && (
              <p
                className="mt-8 lg:mt-10"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 'clamp(1rem, 1.15vw, 1.15rem)',
                  lineHeight: 1.72, color: 'rgba(255,255,255,0.78)', fontWeight: 300,
                  maxWidth: '62ch',
                }}
                data-testid="hero-body"
              >
                {content.body}
              </p>
            )}

            {(content.cta_primary || content.cta_secondary) && (
              <div className="mt-10 lg:mt-12 flex flex-wrap items-center gap-6">
                {content.cta_primary && (
                  <a
                    href={links.cta_primary_href || '#'}
                    style={{
                      display: 'inline-block',
                      fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
                      fontWeight: 500, letterSpacing: '0.04em',
                      color: '#000', background: 'var(--mood-teal, #00C9B3)',
                      textDecoration: 'none',
                      padding: '1rem 1.8rem',
                      transition: 'all 0.25s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,201,179,0.85)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--mood-teal, #00C9B3)'; }}
                    data-testid="hero-cta-primary"
                  >
                    {content.cta_primary}
                  </a>
                )}
                {content.cta_secondary && (
                  <a
                    href={links.cta_secondary_href || '#'}
                    style={{
                      display: 'inline-block',
                      fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
                      fontWeight: 400, letterSpacing: '0.04em',
                      color: '#FFFFFF', textDecoration: 'none',
                      padding: '1rem 1.8rem',
                      border: '1px solid rgba(255,255,255,0.5)',
                      transition: 'all 0.25s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'var(--mood-teal, #00C9B3)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; }}
                    data-testid="hero-cta-secondary"
                  >
                    {content.cta_secondary}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroEditorial;
