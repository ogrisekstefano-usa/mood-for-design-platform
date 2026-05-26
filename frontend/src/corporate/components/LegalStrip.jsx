import React, { useEffect, useState } from 'react';

const FALLBACK = {
  left:   '© 2026 MOOD for DESIGN™',
  center: 'Questo servizio è fornito da MOOD for DESIGN',
  right:  'Running on Blueprint OS™ · Editorial Infrastructure for Design Studios',
};

const BACKEND = process.env.REACT_APP_BACKEND_URL;

/**
 * LegalStrip — narrow white strip below the footer on every public page.
 *
 * Hydrates from /api/site/legal-strip?locale=<loc>, which returns the
 * three editable lines for the current locale. Falls back to baked-in
 * Italian defaults if the API is unreachable. Editable from
 * /admin/footer (LegalStripEditor sub-panel).
 */
const LegalStrip = () => {
  const [data, setData] = useState(FALLBACK);

  useEffect(() => {
    const loc = (document.documentElement.lang || 'it').toLowerCase();
    fetch(`${BACKEND}/api/site/legal-strip?locale=${encodeURIComponent(loc)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d && (d.left || d.center || d.right)) setData({ ...FALLBACK, ...d }); })
      .catch(() => {});
  }, []);

  return (
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
        <span data-testid="legal-strip-left">{data.left}</span>
        <span style={{ textAlign: 'center' }} data-testid="legal-strip-center">{data.center}</span>
        <span style={{ textAlign: 'right' }} data-testid="legal-strip-right">{data.right}</span>
      </div>

      <style>{`
        @media (max-width: 768px) {
          [data-testid="legal-strip"] > div {
            grid-template-columns: 1fr !important;
            gap: 0.25rem !important;
            text-align: center !important;
          }
          [data-testid="legal-strip"] > div > span { text-align: center !important; }
        }
      `}</style>
    </div>
  );
};

export default LegalStrip;
