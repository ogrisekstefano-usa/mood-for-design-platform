import React from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';

/**
 * AudienceHeroSplit — split editorial hero.
 *
 * Solid black left panel (~46%) with eyebrow + serif title + body + CTA.
 * Cinematic photograph on the right (~54%) with subtle left-edge blend.
 *
 * Matches the "Dedicato a" mockup (library / atelier scene, woman
 * curating materials).
 *
 * content: { eyebrow, title, body, cta_label }
 * media:   { background: { url, alt } }
 * links:   { cta_href }
 */
const AudienceHeroSplit = ({ content = {}, media = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.12 });
  const bg = media.background;

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: '#000000', minHeight: 'clamp(640px, 82vh, 900px)' }}
      data-testid="audience-hero-split"
    >
      <div
        className="grid grid-cols-1 lg:grid-cols-[minmax(0,_46%)_1fr]"
        style={{ minHeight: 'clamp(640px, 82vh, 900px)' }}
      >
        {/* LEFT — text on solid black */}
        <div
          ref={ref}
          className={`relative z-10 flex items-center px-6 md:px-12 lg:px-20 py-20 lg:py-28 reveal ${visible ? 'visible' : ''}`}
        >
          <div className="w-full max-w-[520px]">
            {content.eyebrow && (
              <p
                style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '0.74rem', fontWeight: 500,
                  letterSpacing: '0.24em', textTransform: 'uppercase',
                  color: 'var(--mood-teal, #00C9B3)', marginBottom: '2.4rem',
                }}
                data-testid="audience-hero-eyebrow"
              >
                {content.eyebrow}
              </p>
            )}
            {content.title && (
              <h1
                style={{
                  fontFamily: 'Playfair Display, serif', fontWeight: 400,
                  fontSize: 'clamp(2.6rem, 4.6vw, 4.4rem)', lineHeight: 1.06,
                  letterSpacing: '-0.018em', color: '#FFFFFF',
                }}
                data-testid="audience-hero-title"
              >
                {content.title}
              </h1>
            )}
            {content.body && (
              <p
                className="mt-8 lg:mt-10"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 'clamp(1rem, 1.12vw, 1.08rem)',
                  lineHeight: 1.75, color: 'rgba(255,255,255,0.78)', fontWeight: 300,
                  maxWidth: '44ch',
                }}
                data-testid="audience-hero-body"
              >
                {content.body}
              </p>
            )}
            {content.cta_label && (
              <div className="mt-10 lg:mt-12">
                <Link
                  to={links.cta_href || '#chi-ci-rivolgiamo'}
                  style={{
                    display: 'inline-block',
                    fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
                    fontWeight: 400, letterSpacing: '0.04em',
                    color: '#FFFFFF', textDecoration: 'none',
                    padding: '1rem 2rem',
                    border: '1px solid rgba(255,255,255,0.5)',
                    transition: 'all 0.25s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'var(--mood-teal, #00C9B3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; }}
                  data-testid="audience-hero-cta"
                >
                  {content.cta_label}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — cinematic photograph */}
        <div className="relative" style={{ background: '#0A0A0A' }}>
          {bg && bg.url && (
            <>
              <img
                src={bg.url}
                alt={bg.alt || ''}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  position: 'absolute', inset: 0,
                }}
                loading="eager"
              />
              {/* Subtle left-edge blend into the black text panel */}
              <div
                aria-hidden
                style={{
                  position: 'absolute', inset: 0,
                  background:
                    'linear-gradient(to right, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.35) 12%, rgba(0,0,0,0.08) 26%, rgba(0,0,0,0) 38%)',
                }}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default AudienceHeroSplit;
