import React from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';

/**
 * EditorialCardGrid — flexible editorial card grid.
 *
 * Used for the lower sections of Supporto and Formazione pages:
 * each card has a photograph + eyebrow + serif title + body + CTA link.
 * Layout responds to `options.columns` (default 4 for support, 2 for
 * training). The last card can optionally span full-width when
 * `options.featured_last = true` (used for Mood Academy in Formazione).
 *
 * content: { item_01_eyebrow, item_01_title, item_01_body, item_01_cta,
 *            item_02_..., ... up to 6 items }
 * media:   { item_01, item_02, item_03, item_04, item_05, item_06 }
 * links:   { item_01_href, item_02_href, ..., item_06_href }
 * options: { columns?: 2|3|4, featured_last?: boolean,
 *            background?: '#000000' | '#0A0A0A' | string }
 */
const EditorialCardGrid = ({ content = {}, media = {}, links = {}, options = {} }) => {
  const items = Array.from({ length: 6 }, (_, i) => {
    const n = i + 1;
    const k = String(n).padStart(2, '0');
    return {
      n: k,
      eyebrow: content[`item_${k}_eyebrow`],
      title:   content[`item_${k}_title`],
      body:    content[`item_${k}_body`],
      cta:     content[`item_${k}_cta`],
      href:    links[`item_${k}_href`] || '#',
      media:   media[`item_${k}`],
    };
  }).filter((it) => (it.title && it.title.trim()) || (it.body && it.body.trim()));

  const cols = Number(options.columns) || 4;
  const featuredLast = options.featured_last === true;
  const bgColor = options.background || '#000000';

  return (
    <section
      style={{ background: bgColor, padding: 'clamp(4rem, 8vw, 8rem) 0' }}
      data-testid="editorial-card-grid"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: 'clamp(1.2rem, 2vw, 1.8rem)',
          }}
          className="cardgrid-responsive"
        >
          {items.map((it, idx) => {
            const isFeaturedLast = featuredLast && idx === items.length - 1;
            return (
              <EditorialCard
                key={it.n}
                item={it}
                fullSpan={isFeaturedLast}
                cols={cols}
              />
            );
          })}
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .cardgrid-responsive {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 640px) {
          .cardgrid-responsive {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
};

const EditorialCard = ({ item, fullSpan, cols }) => {
  const [ref, visible] = useReveal({ threshold: 0.12 });
  return (
    <article
      ref={ref}
      className={`reveal ${visible ? 'visible' : ''}`}
      style={{
        position: 'relative',
        background: 'rgba(20,20,20,0.85)',
        border: '1px solid rgba(255,255,255,0.05)',
        gridColumn: fullSpan ? `span ${cols}` : 'span 1',
        display: 'grid',
        gridTemplateColumns: fullSpan ? '1fr 1.1fr' : '1fr',
        minHeight: fullSpan ? 340 : 480,
        overflow: 'hidden',
      }}
      data-testid={`editorial-card-${item.n}`}
    >
      {/* Body */}
      <div
        style={{
          padding: 'clamp(1.8rem, 2.6vw, 2.6rem)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {item.eyebrow && (
          <p
            style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', fontWeight: 500,
              letterSpacing: '0.24em', textTransform: 'uppercase',
              color: 'var(--mood-teal, #00C9B3)', marginBottom: '1.4rem',
            }}
            data-testid={`editorial-card-eyebrow-${item.n}`}
          >
            {item.eyebrow}
          </p>
        )}
        {item.title && (
          <h3
            style={{
              fontFamily: 'Playfair Display, serif', fontWeight: 400,
              fontSize: 'clamp(1.5rem, 2vw, 2.1rem)', lineHeight: 1.12,
              letterSpacing: '-0.012em', color: '#FFFFFF',
              marginBottom: '1.2rem',
              maxWidth: fullSpan ? '16ch' : '14ch',
            }}
            data-testid={`editorial-card-title-${item.n}`}
          >
            {item.title}
          </h3>
        )}
        {item.body && (
          <p
            style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.92rem',
              lineHeight: 1.65, color: 'rgba(255,255,255,0.62)', fontWeight: 300,
              maxWidth: fullSpan ? '44ch' : '34ch',
            }}
            data-testid={`editorial-card-body-${item.n}`}
          >
            {item.body}
          </p>
        )}

        <div style={{ flex: 1 }} />

        {item.cta && (
          <Link
            to={item.href}
            style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
              fontWeight: 500, letterSpacing: '0.02em',
              color: 'var(--mood-teal, #00C9B3)', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              marginTop: '2rem', alignSelf: 'flex-start',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--mood-teal, #00C9B3)'; }}
            data-testid={`editorial-card-cta-${item.n}`}
          >
            {item.cta} <span aria-hidden>→</span>
          </Link>
        )}
      </div>

      {/* Photograph — only visible on featured-last (right side) */}
      {fullSpan && item.media && item.media.url && (
        <div style={{ position: 'relative', overflow: 'hidden', background: '#0A0A0A' }}>
          <img
            src={item.media.url}
            alt={item.media.alt || ''}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
            }}
            loading="lazy"
          />
        </div>
      )}

      {/* Background image for regular (non-featured) cards — bottom area */}
      {!fullSpan && item.media && item.media.url && (
        <div
          style={{
            position: 'absolute', right: 0, bottom: 0,
            width: '60%', height: '60%',
            overflow: 'hidden',
            opacity: 0.92,
            maskImage: 'linear-gradient(135deg, transparent 0%, #000 38%, #000 100%)',
            WebkitMaskImage: 'linear-gradient(135deg, transparent 0%, #000 38%, #000 100%)',
            pointerEvents: 'none',
          }}
          aria-hidden
        >
          <img
            src={item.media.url}
            alt=""
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
            }}
            loading="lazy"
          />
        </div>
      )}
    </article>
  );
};

export default EditorialCardGrid;
