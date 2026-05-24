import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * CuratedBrands — horizontal monochromatic wordmark strip below the hero.
 * Uses real brand names (PORRO, Minotti, B&B Italia, Poliform, Gallotti&Radice,
 * FLOS, Flexform, Lualdi). Brand names come from editorial_blocks
 * (site.home.brands.brand_N.label), NEVER hardcoded.
 */
const BRANDS = ['brand_1', 'brand_2', 'brand_3', 'brand_4', 'brand_5', 'brand_6', 'brand_7', 'brand_8'];

const BRAND_STYLES = {
  brand_1: { font: 'Playfair Display, serif', tracking: '0.18em', weight: 700 },   // PORRO
  brand_2: { font: 'Playfair Display, serif', tracking: '0.01em', weight: 400, italic: true },  // Minotti
  brand_3: { font: 'Playfair Display, serif', tracking: '0.05em', weight: 700 },   // B&B Italia
  brand_4: { font: 'Inter, sans-serif',       tracking: '0.10em', weight: 600 },   // Poliform
  brand_5: { font: 'Playfair Display, serif', tracking: '0.02em', weight: 600 },   // Gallotti&Radice
  brand_6: { font: 'Inter, sans-serif',       tracking: '0.18em', weight: 700 },   // FLOS
  brand_7: { font: 'Inter, sans-serif',       tracking: '0.18em', weight: 700 },   // Flexform
  brand_8: { font: 'Inter, sans-serif',       tracking: '0.16em', weight: 600 },   // Lualdi
};

const CuratedBrands = ({ content = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.1 });

  return (
    <section
      className="relative"
      style={{ background: 'var(--mood-ink-1)', borderTop: '1px solid var(--mood-line-soft)', borderBottom: '1px solid var(--mood-line-soft)' }}
      data-testid="curated-brands"
    >
      <div ref={ref} className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16 py-6 lg:py-7">
        {content.eyebrow && (
          <p
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--mood-teal)',
              marginBottom: '1.25rem',
            }}
          >
            {content.eyebrow}
          </p>
        )}

        <div className={`flex items-center justify-between gap-6 lg:gap-10 flex-wrap reveal ${visible ? 'visible' : ''}`}
             style={{ transitionDelay: '0.1s' }}>
          {BRANDS.map((k, i) => {
            const label = content[`${k}.label`];
            if (!label) return null;
            const s = BRAND_STYLES[k] || {};
            return (
              <span
                key={k}
                style={{
                  fontFamily: s.font,
                  fontWeight: s.weight,
                  letterSpacing: s.tracking,
                  fontStyle: s.italic ? 'italic' : 'normal',
                  textTransform: 'uppercase',
                  color: 'var(--mood-text-2)',
                  fontSize: '1rem',
                  opacity: 0.75,
                  transition: 'color 0.25s, opacity 0.25s',
                  cursor: 'default',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--mood-teal)'; e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--mood-text-2)'; e.currentTarget.style.opacity = '0.75'; }}
                data-testid={`brand-${i + 1}`}
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CuratedBrands;
