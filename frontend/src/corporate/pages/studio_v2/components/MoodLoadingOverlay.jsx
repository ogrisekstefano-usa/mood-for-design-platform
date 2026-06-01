/**
 * MoodLoadingOverlay — brand-driven full-screen loading state.
 *
 *   The two O's of "MOOD" animate independently: subtle scale +
 *   counter-rotation, simulating the brand mark "breathing" while
 *   async work happens. No generic spinner, no AI-slop look.
 *
 * Usage:
 *   <MoodLoadingOverlay show message={t('loading.message')} />
 *
 * Visibility is fade-in 220ms / fade-out 180ms via inline CSS keyframes.
 * Z-index 999 — sits above modals, navbar, drawer.
 */
import React from 'react';

const css = `
@keyframes mood-o-pulse {
  0%, 100% { transform: scale(1);   opacity: 0.92; }
  50%      { transform: scale(1.12); opacity: 1;    }
}
@keyframes mood-o-pulse-delayed {
  0%, 100% { transform: scale(1.12); opacity: 1;    }
  50%      { transform: scale(1);    opacity: 0.92; }
}
@keyframes mood-overlay-in  { from { opacity: 0; } to { opacity: 1; } }
@keyframes mood-overlay-out { from { opacity: 1; } to { opacity: 0; } }
`;

const MoodLoadingOverlay = ({ show, message }) => {
  if (!show) return null;
  return (
    <div data-testid="mood-loading-overlay" aria-live="polite" aria-busy="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(10, 10, 11, 0.94)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        animation: 'mood-overlay-in 220ms ease-out',
        fontFamily: 'Inter, sans-serif',
        gap: 28,
      }}>
      <style>{css}</style>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.04em',
        fontSize: 'clamp(3rem, 7vw, 5rem)',
        fontWeight: 500, letterSpacing: '-0.02em',
        color: 'var(--mood-text-1, #F4F4F5)',
        lineHeight: 1,
      }} aria-hidden="true">
        <span data-testid="mood-loading-mark-M">M</span>
        <span data-testid="mood-loading-mark-O1" style={{
          display: 'inline-block',
          color: 'var(--mood-teal, #00C9B3)',
          transformOrigin: 'center',
          animation: 'mood-o-pulse 1.4s ease-in-out infinite',
        }}>O</span>
        <span data-testid="mood-loading-mark-O2" style={{
          display: 'inline-block',
          color: 'var(--mood-teal, #00C9B3)',
          transformOrigin: 'center',
          animation: 'mood-o-pulse-delayed 1.4s ease-in-out infinite',
        }}>O</span>
        <span data-testid="mood-loading-mark-D">D</span>
      </div>
      {message && (
        <p data-testid="mood-loading-message" style={{
          margin: 0, fontSize: '0.86rem',
          letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.45)',
        }}>{message}</p>
      )}
    </div>
  );
};

export default MoodLoadingOverlay;
