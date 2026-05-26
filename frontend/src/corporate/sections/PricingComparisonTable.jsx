import React from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

/**
 * PricingComparisonTable — editorial feature comparison.
 *
 * Layout: large serif title top-left, columns headed by tier names
 * (Essential / Studio / Professional / Enterprise) in gold-italic
 * Playfair, rows of features with cell values per tier. Empty tier
 * columns (no name) are hidden completely.
 *
 * content:
 *   title, footer_note, contact_cta,
 *   tier_01_name, tier_02_name, tier_03_name, tier_04_name,
 *   row_01_label, row_01_v01, row_01_v02, row_01_v03, row_01_v04,
 *   ... up to row_12.
 *
 * Empty rows (no row_NN_label) are also hidden.
 *
 * Cell value semantics:
 *   '✓' / 'yes' / 'true'   → teal check
 *   '-' / '' / 'no'        → dim em-dash
 *   anything else          → text label (Email, Prioritario, 10 GB, …)
 *
 * links: { contact_cta_href }
 */
const isCheck = (v) => {
  const s = (v || '').trim().toLowerCase();
  return s === '✓' || s === 'yes' || s === 'true' || s === 'si' || s === 'sì';
};
const isDash = (v) => {
  const s = (v || '').trim();
  return s === '' || s === '-' || s === '—' || s.toLowerCase() === 'no';
};

const PricingComparisonTable = ({ content = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.1 });

  // Determine visible tiers (those with a non-empty name)
  const tiers = [1, 2, 3, 4].map((n) => {
    const k = String(n).padStart(2, '0');
    return { idx: n, key: k, name: content[`tier_${k}_name`] };
  }).filter((t) => t.name && t.name.trim());

  // Determine visible rows
  const rows = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const k = String(n).padStart(2, '0');
    const label = content[`row_${k}_label`];
    if (!label || !label.trim()) return null;
    const values = tiers.map((t) => content[`row_${k}_v${t.key}`] || '');
    return { key: k, label, values };
  }).filter(Boolean);

  if (tiers.length === 0 || rows.length === 0) return null;

  const colTemplate = `minmax(220px, 1.6fr) ${tiers.map(() => 'minmax(120px, 1fr)').join(' ')}`;

  return (
    <section
      ref={ref}
      className={`relative reveal ${visible ? 'visible' : ''}`}
      style={{ background: '#000000', padding: 'clamp(5rem, 9vw, 9rem) 0' }}
      data-testid="pricing-comparison-table"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-12 lg:px-20">
        {content.title && (
          <h2
            style={{
              fontFamily: 'Playfair Display, serif', fontWeight: 400,
              fontSize: 'clamp(2rem, 3.2vw, 3.2rem)', lineHeight: 1.1,
              letterSpacing: '-0.015em', color: '#FFFFFF',
              marginBottom: 'clamp(2.5rem, 5vw, 4rem)',
              maxWidth: '20ch',
            }}
            data-testid="pricing-comparison-title"
          >
            {content.title}
          </h2>
        )}

        <div style={{ border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          {/* Header row */}
          <div
            style={{
              display: 'grid', gridTemplateColumns: colTemplate,
              alignItems: 'end',
              padding: '1.4rem 1.6rem',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
            className="comparison-row"
          >
            <div />
            {tiers.map((t) => (
              <div
                key={t.key}
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.72rem', fontWeight: 500,
                  letterSpacing: '0.22em', textTransform: 'uppercase',
                  color: '#C9A86A', textAlign: 'center',
                }}
                data-testid={`pricing-comparison-tier-${t.key}`}
              >
                {t.name}
              </div>
            ))}
          </div>

          {/* Rows */}
          {rows.map((r) => (
            <div
              key={r.key}
              style={{
                display: 'grid', gridTemplateColumns: colTemplate,
                alignItems: 'center',
                padding: '1.4rem 1.6rem',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
              className="comparison-row"
              data-testid={`pricing-comparison-row-${r.key}`}
            >
              <div
                style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '0.94rem',
                  color: 'rgba(255,255,255,0.86)', fontWeight: 300,
                }}
              >
                {r.label}
              </div>
              {r.values.map((v, i) => (
                <div
                  key={i}
                  style={{
                    textAlign: 'center', fontFamily: 'Inter, sans-serif',
                    fontSize: '0.92rem', color: 'rgba(255,255,255,0.78)', fontWeight: 300,
                  }}
                >
                  {isCheck(v) ? (
                    <Check size={18} strokeWidth={1.6} style={{ color: 'var(--mood-teal, #00C9B3)', margin: '0 auto' }} />
                  ) : isDash(v) ? (
                    <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
                  ) : (
                    v
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer note + contact CTA */}
        {(content.footer_note || content.contact_cta) && (
          <div
            className="flex items-center justify-between mt-10 gap-6 flex-wrap"
            style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.9rem',
              color: 'rgba(255,255,255,0.5)', fontWeight: 300,
            }}
          >
            {content.footer_note && (
              <p data-testid="pricing-comparison-footer-note" style={{ maxWidth: '60ch' }}>
                {content.footer_note}
              </p>
            )}
            {content.contact_cta && (
              <Link
                to={links.contact_cta_href || '/supporto'}
                style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
                  fontWeight: 400, letterSpacing: '0.04em',
                  color: '#FFFFFF', textDecoration: 'none',
                  padding: '0.9rem 1.6rem',
                  border: '1px solid rgba(255,255,255,0.4)',
                  transition: 'all 0.25s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'var(--mood-teal, #00C9B3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
                data-testid="pricing-comparison-contact-cta"
              >
                {content.contact_cta}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default PricingComparisonTable;
