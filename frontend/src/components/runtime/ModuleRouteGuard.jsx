/**
 * ITER144 · ModuleRouteGuard™
 *
 * Wraps a route element. If the module identified by `code` is disabled
 * for the current tenant (or hidden / locked), the route is bounced to
 * `/dashboard` (or a configured fallback). No visual leakage.
 *
 * Usage:
 *   <Route path="/inspirations"
 *     element={<ModuleRouteGuard code="inspirations"><Inspirations/></ModuleRouteGuard>} />
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useModule, useTenantConfiguration } from '../contexts/TenantConfigurationContext';

const ModuleRouteGuard = ({ code, fallback = '/dashboard', children }) => {
  const { loading, bundle } = useTenantConfiguration();
  const module = useModule(code);

  // Still loading the runtime bundle → render nothing yet (Suspense
  // fallback above will show the cinematic loader).
  if (loading || !bundle) return children;

  // Unknown module → permissive (so newly-added routes work before the
  // registry seed catches up).
  if (!module) return children;

  if (module.state === 'enabled' || module.state === 'beta') {
    return children;
  }
  // disabled / hidden / locked → bounce
  return <Navigate to={fallback} replace />;
};

export default ModuleRouteGuard;
