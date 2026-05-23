/**
 * ITER144.1 · ModuleRouteGuard™
 *
 * Wraps a route element. The route renders only when the module is
 * `enabled` or `beta`. Otherwise the Cinematic Blocked State™ surface
 * appears (intentional, localized, NOT a 403/redirect/blank).
 *
 * Usage:
 *   <Route path="/inspirations"
 *     element={
 *       <ModuleRouteGuard code="inspirations">
 *         <InspirationsPage />
 *       </ModuleRouteGuard>
 *     } />
 *
 * Permissive on bootstrap: while the runtime bundle is still loading,
 * the route renders normally to avoid a flash of blocked-state during
 * the initial paint.
 */
import React from 'react';
import { useModule, useTenantConfiguration } from '../../contexts/TenantConfigurationContext';
import ModuleBlockedState from './ModuleBlockedState';

const STATE_TO_VARIANT = {
  enabled:  null,           // ✅ render
  beta:     null,           // ✅ render
  locked:   'locked',
  disabled: 'disabled',
  hidden:   'hidden',
  beta_restricted: 'beta_restricted',
  coming_soon: 'coming_soon',
};

const ModuleRouteGuard = ({ code, fallback = '/dashboard', children }) => {
  const { loading, bundle } = useTenantConfiguration();
  const module = useModule(code);

  if (loading || !bundle) return children;          // permissive at boot
  if (!module) return children;                     // unknown module → don't block

  const variant = STATE_TO_VARIANT[module.state] ?? 'disabled';
  if (variant === null) return children;            // enabled/beta → render

  return (
    <ModuleBlockedState
      moduleCode={code}
      state={variant}
      fallbackTo={fallback}
    />
  );
};

export default ModuleRouteGuard;
