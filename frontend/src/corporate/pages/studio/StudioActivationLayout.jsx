/**
 * StudioActivationLayout — the editorial chrome shared by all five
 * movements of the Studio Activation flow.
 *
 *   • Black background (#050505), pure typography, no boxed UI.
 *   • Top-left: MOOD monogram (silent retreat → "/").
 *   • Top-right: studio monogram-in-formation (visible from Movement IV).
 *   • Left margin: ascending hairline indicator (no numbers).
 *   • Bottom-right: tiny italic resumed-indicator when applicable.
 *
 * Children render full-bleed inside the layout. No padding is imposed;
 * each movement composes its own typographic field.
 */
import React from 'react';

const MOVEMENTS = ['entrance', 'practice', 'ecosystem', 'identity', 'activate'];

const StudioActivationLayout = ({
  children,
  movement = 'entrance',
  monogram = null,
  resumed = false,
}) => {
  const movementIdx = Math.max(0, MOVEMENTS.indexOf(movement));
  const progress = (movementIdx + 1) / MOVEMENTS.length;

  return (
    <div
      data-testid="studio-activation-layout"
      data-movement={movement}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#050505',
        color: '#FFFFFF',
        overflow: 'hidden',
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Top-left: MOOD silent retreat */}
      <a
        href="/"
        data-testid="studio-exit"
        style={{
          position: 'absolute', top: 32, left: 36, zIndex: 50,
          opacity: 0.55, transition: 'opacity 260ms ease',
          textDecoration: 'none',
        }}
        onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseOut={(e) => (e.currentTarget.style.opacity = '0.55')}
      >
        <img
          src="https://customer-assets.emergentagent.com/job_editorial-platform-4/artifacts/chlucgqo_Artboard%201.png"
          alt="MOOD for DESIGN"
          style={{ height: 36, width: 'auto', display: 'block' }}
          draggable={false}
        />
      </a>

      {/* Top-right: studio monogram in formation (Movement IV onward) */}
      {monogram && (
        <div
          data-testid="studio-monogram"
          style={{
            position: 'absolute', top: 32, right: 36, zIndex: 50,
            fontFamily: '"Playfair Display", Georgia, serif',
            fontStyle: 'italic',
            fontSize: 18,
            letterSpacing: '0.05em',
            color: 'rgba(255,255,255,0.78)',
          }}
        >
          {monogram}
        </div>
      )}

      {/* Left-margin ascending hairline (no numbers) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', left: 36, top: '50%',
          transform: 'translateY(-50%)',
          width: 1, height: 96,
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.10), rgba(255,255,255,0.10))',
          zIndex: 5,
        }}
      >
        <div
          data-testid="studio-progress"
          style={{
            position: 'absolute', bottom: 0, left: 0,
            width: 1,
            height: `${progress * 100}%`,
            background: '#00C9B3',
            transition: 'height 700ms cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      </div>

      {/* Resumed indicator */}
      {resumed && (
        <p
          data-testid="studio-resumed"
          style={{
            position: 'absolute', bottom: 28, right: 36, zIndex: 50,
            fontFamily: '"Playfair Display", Georgia, serif',
            fontStyle: 'italic', fontSize: 12.5,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.02em',
          }}
        >
          La tua composizione vi attende qui.
        </p>
      )}

      {/* Page content — full bleed */}
      <main style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
        {children}
      </main>

      {/* Global motion + grain */}
      <style>{`
        @keyframes studioKenBurns {
          0%   { transform: scale(1.04) translate3d(0,0,0); }
          50%  { transform: scale(1.10) translate3d(-1%,-1%,0); }
          100% { transform: scale(1.04) translate3d(1%,0,0); }
        }
        @keyframes studioRise {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes studioGlow {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 0.85; }
        }
        .studio-rise { animation: studioRise 820ms cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>
    </div>
  );
};

export default StudioActivationLayout;
