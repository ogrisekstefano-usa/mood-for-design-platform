/**
 * ITER146 HARDENING · ModuleLoadingState™
 *
 * Lightweight cinematic shimmer rendered ONLY while the runtime bundle
 * is still being fetched. INTENTIONALLY distinct from the Cinematic
 * Blocked State™ — loading is a transient, neutral signal, not a
 * "this module is locked" surface.
 *
 * In practice ModuleRouteGuard renders children pass-through during
 * loading (each page has its own skeleton). This component exists for
 * cases where a caller explicitly wants a runtime loading placeholder
 * (e.g. nested mounts, lazy children, debug overlays).
 */
import React from 'react';

const ModuleLoadingState = ({ moduleCode }) => (
  <div
    data-testid="module-loading-state"
    data-module-code={moduleCode || undefined}
    style={{
      minHeight: '40vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 22,
      padding: '64px 32px',
      background: 'var(--bp-bg, #050608)',
      color: 'rgba(255,255,255,0.45)',
      fontFamily: 'var(--atelier-mono)',
      fontSize: 10,
      letterSpacing: '0.32em',
      textTransform: 'uppercase',
    }}
  >
    <div
      style={{
        width: 44, height: 44, borderRadius: '50%',
        border: '1px solid rgba(124,228,245,0.18)',
        borderTopColor: 'var(--atelier-cyan, #7ce4f5)',
        animation: 'mlsSpin 1.1s linear infinite',
      }}
    />
    <span>RUNTIME · COMPOSING</span>
    <style>{`@keyframes mlsSpin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default ModuleLoadingState;
