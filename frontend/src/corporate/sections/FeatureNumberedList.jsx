import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * FeatureNumberedList — vertical list of 5 features. Each row:
 *   [LARGE OUTLINED NUMBER]   eyebrow + serif title + body    [media screenshot]
 *
 * Items are flat in content/media for CMS auto-discovery:
 *   content: { item_01_eyebrow, item_01_title, item_01_body, item_02_..., ..., item_05_... }
 *   media:   { item_01, item_02, item_03, item_04, item_05 }
 */
const FeatureNumberedList = ({ content = {}, media = {} }) => {
  const items = [1, 2, 3, 4, 5].map((n) => {
    const key = String(n).padStart(2, '0');
    return {
      number: key,
      eyebrow: content[`item_${key}_eyebrow`],
      title:   content[`item_${key}_title`],
      body:    content[`item_${key}_body`],
      media:   media[`item_${key}`],
    };
  });

  return (
    <section
      className="relative"
      style={{ background: '#000000', padding: '6rem 0' }}
      data-testid="feature-numbered-list"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16">
        {items.map((it, idx) => (
          <FeatureRow key={it.number} item={it} isLast={idx === items.length - 1} />
        ))}
      </div>
    </section>
  );
};

const FeatureRow = ({ item, isLast }) => {
  const [ref, visible] = useReveal({ threshold: 0.15 });
  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'visible' : ''}`}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(120px, 180px) minmax(0, 420px) 1fr',
        gap: 'clamp(2rem, 5vw, 5rem)',
        alignItems: 'center',
        padding: 'clamp(3rem, 7vw, 6.5rem) 0',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
      }}
      data-testid={`feature-row-${item.number}`}
    >
      {/* Large outlined number */}
      <div
        style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: 'clamp(5.5rem, 11vw, 10rem)',
          lineHeight: 0.92,
          fontWeight: 400,
          color: 'transparent',
          WebkitTextStroke: '1px var(--mood-teal, #00C9B3)',
          letterSpacing: '-0.02em',
          userSelect: 'none',
        }}
        data-testid={`feature-number-${item.number}`}
      >
        {item.number}
      </div>

      {/* Center: eyebrow + title + body */}
      <div>
        {item.eyebrow && (
          <p
            style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', fontWeight: 500,
              letterSpacing: '0.22em', textTransform: 'uppercase',
              color: 'var(--mood-teal, #00C9B3)', marginBottom: '1.4rem',
            }}
            data-testid={`feature-eyebrow-${item.number}`}
          >
            {item.eyebrow}
          </p>
        )}
        {item.title && (
          <h3
            style={{
              fontFamily: 'Playfair Display, serif', fontWeight: 400,
              fontSize: 'clamp(1.8rem, 2.6vw, 2.6rem)', lineHeight: 1.1,
              letterSpacing: '-0.015em', color: '#FFFFFF', marginBottom: '1.4rem',
            }}
            data-testid={`feature-title-${item.number}`}
          >
            {item.title}
          </h3>
        )}
        {item.body && (
          <p
            style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.95rem',
              lineHeight: 1.65, color: 'rgba(255,255,255,0.62)', fontWeight: 300,
              maxWidth: '38ch',
            }}
            data-testid={`feature-body-${item.number}`}
          >
            {item.body}
          </p>
        )}
      </div>

      {/* Right: media screenshot with teal glow */}
      <div style={{ position: 'relative', justifySelf: 'end', width: '100%', maxWidth: 720 }}>
        {item.media && item.media.url ? (
          <>
            <div
              aria-hidden
              style={{
                position: 'absolute', inset: '10% -5% 10% -5%',
                background: 'radial-gradient(ellipse at center, rgba(0,201,179,0.12) 0%, transparent 65%)',
                filter: 'blur(40px)', pointerEvents: 'none',
              }}
            />
            <img
              src={item.media.url}
              alt={item.media.alt || ''}
              style={{
                position: 'relative', width: '100%', height: 'auto',
                borderRadius: 4,
                boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
                display: 'block',
              }}
              loading="lazy"
            />
          </>
        ) : (
          <div
            style={{
              aspectRatio: '16/9',
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: 4,
            }}
          />
        )}
      </div>
    </div>
  );
};

export default FeatureNumberedList;
