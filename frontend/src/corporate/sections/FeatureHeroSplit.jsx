import React from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';

/**
 * FeatureHeroSplit — split hero: text left on solid black, cinematic photo right.
 * Matches the mockup with "La nostra comunità" eyebrow + serif title +
 * editorial body + outlined CTA pill.
 *
 * content:  { eyebrow, title, body, cta_label }
 * media:    { background: { url, alt } }
 * links:    { cta_href }
 */
const FeatureHeroSplit = ({ content = {}, media = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.15 });
  const bg = media.background;

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: '#000000', minHeight: 'min(900px, 100vh)' }}
      data-testid="feature-hero-split"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,_46%)_1fr]" style={{ minHeight: 'min(900px, 100vh)' }}>
        {/* LEFT — text on solid black */}
        <div
          ref={ref}
          className={`relative z-10 flex items-center px-6 md:px-12 lg:px-20 py-24 lg:py-32 reveal ${visible ? 'visible' : ''}`}
        >
          <div className="w-full max-w-[520px]">
            {content.eyebrow && (
              <p
                style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '0.74rem', fontWeight: 500,
                  letterSpacing: '0.22em', textTransform: 'uppercase',
                  color: 'var(--mood-teal, #00C9B3)', marginBottom: '2.4rem',
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
                  fontSize: 'clamp(2.6rem, 4.6vw, 4.4rem)', lineHeight: 1.06,
                  letterSpacing: '-0.018em', color: '#FFFFFF',
                }}
                data-testid="feature-hero-title"
              >
                {content.title}
              </h1>
            )}
            {content.body && (
              <p
                className="mt-8 lg:mt-10"
                style={{
                  fontFamily: 'Inter, sans-serif', fontSize: 'clamp(1rem, 1.15vw, 1.08rem)',
                  lineHeight: 1.75, color: 'rgba(255,255,255,0.78)', fontWeight: 300,
                  maxWidth: '46ch',
                }}
                data-testid="feature-hero-body"
              >
                {content.body}
              </p>
            )}
            {content.cta_label && (
              <div className="mt-10 lg:mt-12">
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
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'var(--mood-teal, #00C9B3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; }}
                  data-testid="feature-hero-cta"
                >
                  {content.cta_label}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — cinematic photo with subtle left gradient blending into black */}
        <div className="relative" style={{ background: '#0A0A0A' }}>
          {bg && bg.url && (
            <>
              <img
                src={bg.url}
                alt={bg.alt || ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
                loading="eager"
              />
              <div
                aria-hidden
                style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.75) 15%, rgba(0,0,0,0.45) 35%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0) 70%)',
                }}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default FeatureHeroSplit;
