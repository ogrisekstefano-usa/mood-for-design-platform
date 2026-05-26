import React from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';

/**
 * FeatureHeroSplit — full-width cinematic panoramic hero.
 *
 * Layout (single-column, photo as background):
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ [text overlay top-left]                                          │
 *   │   eyebrow                                                        │
 *   │   serif title                                                    │
 *   │   body                                       PHOTOGRAPH (full)   │
 *   │   CTA pill                                                       │
 *   │                                                                  │
 *   └──────────────────────────────────────────────────────────────────┘
 * Black left-to-right gradient veil sits between photo and text so the
 * copy reads natively while the right side of the image breathes.
 *
 * content: { eyebrow, title, body, cta_label }
 * media:   { background: { url, alt } }
 * links:   { cta_href }
 */
const FeatureHeroSplit = ({ content = {}, media = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.15 });
  const bg = media.background;

  return (
    <section
      ref={ref}
      className={`relative overflow-hidden reveal ${visible ? 'visible' : ''}`}
      style={{
        background: '#000000',
        // Panoramic, not full height
        minHeight: 'clamp(520px, 62vh, 720px)',
      }}
      data-testid="feature-hero-split"
    >
      {/* Background photograph — full width */}
      {bg && bg.url && (
        <img
          src={bg.url}
          alt={bg.alt || ''}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            objectPosition: 'center 35%',
          }}
          loading="eager"
        />
      )}

      {/* Left-to-right black veil — solid on the left, transparent on the right */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          background:
            'linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.82) 22%, rgba(0,0,0,0.55) 42%, rgba(0,0,0,0.25) 62%, rgba(0,0,0,0) 82%)',
        }}
      />

      {/* Text overlay — top-left */}
      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 md:px-12 lg:px-20 py-16 lg:py-24">
        <div className="w-full max-w-[560px]">
          {content.eyebrow && (
            <p
              style={{
                fontFamily: 'Inter, sans-serif', fontSize: '0.74rem', fontWeight: 500,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                color: 'var(--mood-teal, #00C9B3)', marginBottom: '2.2rem',
              }}
              data-testid="feature-hero-eyebrow"
            >
              {content.eyebrow}
            </p>
          )}
          {content.title && (
            <h1
              style={{
                fontFamily: 'Playfair Display, serif', fontWeight: 400,
                fontSize: 'clamp(2.4rem, 4.4vw, 4rem)', lineHeight: 1.06,
                letterSpacing: '-0.018em', color: '#FFFFFF',
              }}
              data-testid="feature-hero-title"
            >
              {content.title}
            </h1>
          )}
          {content.body && (
            <p
              className="mt-7 lg:mt-9"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 'clamp(0.98rem, 1.1vw, 1.06rem)',
                lineHeight: 1.72, color: 'rgba(255,255,255,0.78)', fontWeight: 300,
                maxWidth: '46ch',
              }}
              data-testid="feature-hero-body"
            >
              {content.body}
            </p>
          )}
          {content.cta_label && (
            <div className="mt-9 lg:mt-11">
              <Link
                to={links.cta_href || '/dedicato-a'}
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
                data-testid="feature-hero-cta"
              >
                {content.cta_label}
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default FeatureHeroSplit;
