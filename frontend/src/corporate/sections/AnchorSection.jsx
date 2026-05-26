import React from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';
import { renderInlineMarkdown } from '../utils/renderInlineMarkdown';

/**
 * AnchorSection — landing destination for in-page anchor links.
 *
 * Layout: anchor id at the top (data-anchor-id) so links like
 * "/formazione#percorsi" land here. Editorial composition:
 *   eyebrow · large serif title · italic Playfair subtitle
 *   + 2-column block: long-form body paragraph (markdown) + secondary photograph
 *
 * options.anchor_id          — the anchor slug (e.g. 'percorsi')
 * options.hero_image         — when true, photograph fills the top above text (default false)
 * options.reverse            — flip body/photo columns
 * options.background         — '#000' | '#050606' | string
 *
 * content: { eyebrow, title, subtitle, body, cta_label }
 * media:   { hero?: {url}, photo?: {url} }
 * links:   { cta_href }
 */
const AnchorSection = ({ content = {}, media = {}, links = {}, options = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.12 });
  const photo = media.photo;
  const heroPhoto = media.hero;
  const reverse = options.reverse === true;
  const bg = options.background || '#000000';
  const anchorId = options.anchor_id;

  return (
    <section
      ref={ref}
      id={anchorId || undefined}
      data-anchor-id={anchorId || undefined}
      className={`relative reveal ${visible ? 'visible' : ''}`}
      style={{ background: bg, padding: 'clamp(5rem, 9vw, 9rem) 0', scrollMarginTop: '92px' }}
      data-testid={`anchor-section-${anchorId || ''}`}
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-12 lg:px-20">
        {/* Optional hero image at the top */}
        {heroPhoto && heroPhoto.url && (
          <div style={{
            aspectRatio: '21/9', overflow: 'hidden', background: '#0A0A0A',
            marginBottom: 'clamp(2.5rem, 5vw, 4rem)',
          }}>
            <img
              src={heroPhoto.url} alt={heroPhoto.alt || ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              loading="lazy"
            />
          </div>
        )}

        {/* Top: eyebrow + title + subtitle (full width) */}
        <div style={{ marginBottom: 'clamp(2.5rem, 5vw, 4rem)' }}>
          {content.eyebrow && (
            <p
              style={{
                fontFamily: 'Inter, sans-serif', fontSize: '0.74rem', fontWeight: 500,
                letterSpacing: '0.24em', textTransform: 'uppercase',
                color: 'var(--mood-teal, #00C9B3)', marginBottom: '1.6rem',
              }}
              data-testid="anchor-eyebrow"
            >
              {content.eyebrow}
            </p>
          )}
          {content.title && (
            <h2
              style={{
                fontFamily: 'Playfair Display, serif', fontWeight: 400,
                fontSize: 'clamp(2.2rem, 3.6vw, 3.6rem)', lineHeight: 1.1,
                letterSpacing: '-0.015em', color: '#FFFFFF',
                marginBottom: '1.5rem', maxWidth: '22ch',
              }}
              data-testid="anchor-title"
            >
              {content.title}
            </h2>
          )}
          {content.subtitle && (
            <p
              style={{
                fontFamily: 'Playfair Display, serif', fontStyle: 'italic',
                fontWeight: 400, fontSize: 'clamp(1.05rem, 1.3vw, 1.3rem)',
                lineHeight: 1.5, color: 'rgba(0,201,179,0.85)',
                maxWidth: '50ch',
              }}
              data-testid="anchor-subtitle"
            >
              {content.subtitle}
            </p>
          )}
        </div>

        {/* Body + photo */}
        {(content.body || (photo && photo.url)) && (
          <div
            className="grid grid-cols-1 lg:grid-cols-2"
            style={{
              gap: 'clamp(3rem, 6vw, 7rem)', alignItems: 'start',
              direction: reverse ? 'rtl' : 'ltr',
            }}
          >
            <div style={{ direction: 'ltr' }}>
              {content.body && (
                <div
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 'clamp(0.98rem, 1.08vw, 1.06rem)',
                    lineHeight: 1.8, color: 'rgba(255,255,255,0.72)', fontWeight: 300,
                    maxWidth: '52ch', whiteSpace: 'pre-line',
                  }}
                  data-testid="anchor-body"
                >
                  {renderInlineMarkdown(content.body)}
                </div>
              )}
              {content.cta_label && (
                <Link
                  to={links.cta_href || '#'}
                  style={{
                    display: 'inline-block', marginTop: '2.4rem',
                    fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
                    fontWeight: 400, letterSpacing: '0.04em',
                    color: 'var(--mood-teal, #00C9B3)', textDecoration: 'none',
                    padding: '0.9rem 1.6rem',
                    border: '1px solid var(--mood-teal, #00C9B3)',
                    transition: 'all 0.25s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,201,179,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  data-testid="anchor-cta"
                >
                  {content.cta_label}
                </Link>
              )}
            </div>
            {photo && photo.url && (
              <div style={{ direction: 'ltr', position: 'relative', aspectRatio: '4/5', overflow: 'hidden', background: '#0A0A0A' }}>
                <img
                  src={photo.url} alt={photo.alt || ''}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  loading="lazy"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default AnchorSection;
