/**
 * ITER146 HARDENING · CoreAutoRecoveredBadge™
 *
 * Tiny dev-only diagnostic badge mounted alongside the children when a
 * core-critical module arrives in a non-operational state and the
 * frontend silently auto-recovers it to `enabled`. The badge guarantees
 * the operator can spot the runtime drift without disrupting the
 * end-user experience.
 *
 * Visible ONLY when:
 *   - NODE_ENV !== 'production', OR
 *   - localStorage.getItem('mfd:debug:core_recovery') === '1'
 */
import React from 'react';

const SHOW_IN_PROD_FLAG = 'mfd:debug:core_recovery';

const CoreAutoRecoveredBadge = ({ code, attemptedState }) => {
  const isProd = process.env.NODE_ENV === 'production';
  let forced = false;
  if (isProd) {
    try { forced = window.localStorage.getItem(SHOW_IN_PROD_FLAG) === '1'; }
    catch (_) { forced = false; }
  }
  if (isProd && !forced) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="core-auto-recovered-badge"
      data-module-code={code}
      data-attempted-state={attemptedState}
      style={{
        position: 'fixed',
        bottom: 18,
        right: 18,
        zIndex: 9999,
        padding: '7px 14px 7px 10px',
        borderRadius: 999,
        background: 'rgba(8, 10, 14, 0.92)',
        border: '1px solid rgba(244, 201, 122, 0.55)',
        color: '#f4c97a',
        fontFamily: 'var(--atelier-mono, JetBrains Mono, monospace)',
        fontSize: 10,
        letterSpacing: '0.26em',
        textTransform: 'uppercase',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        pointerEvents: 'none',
        boxShadow: '0 12px 36px -16px rgba(244, 201, 122, 0.55)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <span
        style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#f4c97a',
          boxShadow: '0 0 12px #f4c97a',
        }}
      />
      <span>CORE AUTO-RECOVERED · {code} · was {attemptedState}</span>
    </div>
  );
};

export default CoreAutoRecoveredBadge;
