import React from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';

/**
 * AudienceHeroSplit — panoramic editorial hero (now unified with the
 * site-wide pattern used by Pricing / Support / Login / Page heroes).
 *
 * Photo runs edge-to-edge; horizontal left-to-right black veil holds the
 * editorial text in the top-left, container-aligned with the navigation.
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
      ref={ref}
      className={`relative overflow-hidden reveal ${visible ? 'visible' : ''}`}
      style={{ background: '#000000', minHeight: 'clamp(640px, 82vh, 900px)' }}
      data-testid="audience-hero-split"
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

      {/* Left-to-right black veil */}
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
        style={{ minHeight: 'clamp(640px, 82vh, 900px)' }}
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
                  maxWidth: '46ch',
                }}
                data-testid="audience-hero-body"
              >
                {content.body}
              </p>
            )}
            {content.cta_label && (
              <div className="mt-10 lg:mt-12">
                <Link
                  to={links.cta_href || '#a-chi-ci-rivolgiamo'}
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
      </div>
    </section>
  );
};

export default AudienceHeroSplit;
