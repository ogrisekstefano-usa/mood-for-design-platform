import React from 'react';

/**
 * LegalStrip — narrow white strip displayed below the footer on every
 * public page. Contains 3 small editorial lines:
 *   - Copyright       (left)
 *   - Service notice  (center)
 *   - Platform credit (right)
 *
 * Editable in the future via cms_sections (section_type='legal_strip').
 */
const LegalStrip = () => (
  <div
    style={{
      background: '#FAFAFA',
      borderTop: '1px solid rgba(0,0,0,0.06)',
      color: 'rgba(0,0,0,0.55)',
      fontFamily: 'Inter, sans-serif',
      fontSize: '0.72rem',
      letterSpacing: '0.04em',
    }}
    data-testid="legal-strip"
  >
    <div
      className="max-w-screen-2xl mx-auto"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.4fr 1.6fr',
        alignItems: 'center',
        gap: '1.5rem',
        padding: '0.85rem clamp(1rem, 4vw, 4rem)',
      }}
    >
      <span data-testid="legal-strip-copyright">
        © {new Date().getFullYear()} MOOD for DESIGN™
      </span>
      <span style={{ textAlign: 'center' }} data-testid="legal-strip-service">
        Questo servizio è fornito da MOOD for DESIGN
      </span>
      <span style={{ textAlign: 'right' }} data-testid="legal-strip-platform">
        Running on Blueprint OS™ · Editorial Infrastructure for Design Studios
      </span>
    </div>

    <style>{`
      @media (max-width: 768px) {
        [data-testid="legal-strip"] > div {
          grid-template-columns: 1fr !important;
          gap: 0.25rem !important;
          text-align: center !important;
        }
        [data-testid="legal-strip"] > div > span {
          text-align: center !important;
        }
      }
    `}</style>
  </div>
);

export default LegalStrip;
