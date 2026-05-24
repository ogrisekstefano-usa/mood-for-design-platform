/**
 * ITER146 HARDENING · ModuleRouteGuard™ — Runtime State Machine
 *
 * Wraps a route element. Renders ONE of seven explicit, disjoint
 * runtime surfaces. There is NO implicit fallback — every code path
 * is named and observable.
 *
 *   1. LOADING      → runtime bundle not yet resolved.
 *                     We pass through the children (page renders its
 *                     own skeleton). Loading is NEVER conflated with
 *                     "blocked" or "disabled".
 *   2. UNKNOWN_CODE → guard configured against a module code that no
 *                     longer exists in the registry. We pass through
 *                     with a console warning so the operator notices
 *                     the drift. Pure safety net, not a block.
 *   3. OPERATIONAL  → state ∈ {enabled, beta}. Fast path, NEVER routed
 *                     to the blocked renderer.
 *   4. CORE_AUTO_RECOVERED → core-critical modules (`is_core_critical`
 *                     OR the frontend allow-list) MUST never present a
 *                     blocked state. If upstream config drifts, we
 *                     auto-force render of the children + a visible
 *                     diagnostic badge (dev/debug only).
 *   5. BLOCKED      → known non-operational state ∈ {hidden, locked,
 *                     disabled, beta_restricted, coming_soon}. The
 *                     Cinematic Blocked State™ surface is rendered.
 *   6. UNAVAILABLE  → state is non-empty but NOT in the known set.
 *                     Console warning + neutral `unavailable` variant
 *                     (NOT silently coerced to `disabled`).
 *   7. CRASH        → handled outside this component by the App-level
 *                     ErrorBoundary; documented here for clarity.
 *
 * Usage:
 *   <Route path="/inspirations"
 *     element={<ModuleRouteGuard code="inspirations">
 *                <InspirationsPage />
 *              </ModuleRouteGuard>} />
 */
import React from 'react';

import { useModule, useTenantConfiguration } from '../../contexts/TenantConfigurationContext';
import ModuleBlockedState from './ModuleBlockedState';
import CoreAutoRecoveredBadge from './CoreAutoRecoveredBadge';

// ── State sets ────────────────────────────────────────────────────────
const OPERATIONAL_STATES = new Set(['enabled', 'beta']);

const BLOCKED_STATE_VARIANTS = {
  hidden:           'hidden',
  locked:           'locked',
  disabled:         'disabled',
  beta_restricted:  'beta_restricted',
  coming_soon:      'coming_soon',
};

// Frontend allow-list of core-critical modules. Mirrors the backend
// `is_core_critical` registry flag so the safeguard works even when the
// flag hasn't propagated yet (cache lag, new tenant, hot reload).
const FRONTEND_CORE_CRITICAL = new Set([
  'dashboard',
  'settings_workspace',
  'blueprint_admin',
  'begin_journey',
  'journey_index',
  'team',
]);

const isCoreCritical = (code, module) =>
  !!(module && module.is_core_critical) || FRONTEND_CORE_CRITICAL.has(code);

const warn = (msg) => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(`[ModuleRouteGuard] ${msg}`);
  }
};

// ── Component ─────────────────────────────────────────────────────────
const ModuleRouteGuard = ({ code, fallback = '/dashboard', children }) => {
  const { loading, bundle } = useTenantConfiguration();
  const module = useModule(code);

  // 1. LOADING — runtime not resolved yet. Pass through to avoid a
  //    flash of blocked surface during the initial paint. Pages handle
  //    their own loading skeletons.
  if (loading || !bundle) {
    return children;
  }

  // 2. UNKNOWN_CODE — guard configured against a code that no longer
  //    exists in the registry. Don't block; warn so the operator notices.
  if (!module) {
    warn(`Unknown module code "${code}" — passing through.`);
    return children;
  }

  const state = module.state;

  // 3. OPERATIONAL — explicit fast path. Never lets `enabled` or `beta`
  //    fall through to any blocked path.
  if (OPERATIONAL_STATES.has(state)) {
    return children;
  }

  // 4. CORE_AUTO_RECOVERED — runtime essentials MUST never present a
  //    blocked state regardless of upstream config drift. Auto-force
  //    render + diagnostic breadcrumb.
  if (isCoreCritical(code, module)) {
    warn(
      `Core-critical "${code}" arrived in non-operational state ` +
      `"${state || 'undefined'}" — auto-recovering on the frontend.`,
    );
    return (
      <>
        {children}
        <CoreAutoRecoveredBadge code={code} attemptedState={state || 'undefined'} />
      </>
    );
  }

  // 5. BLOCKED — known non-operational state → cinematic blocked state.
  if (Object.prototype.hasOwnProperty.call(BLOCKED_STATE_VARIANTS, state)) {
    return (
      <ModuleBlockedState
        moduleCode={code}
        state={BLOCKED_STATE_VARIANTS[state]}
        fallbackTo={fallback}
      />
    );
  }

  // 6. UNAVAILABLE — unmapped state. Log + neutral surface (NOT
  //    `disabled`). This is the safety valve for backend changes that
  //    introduce a new state value the frontend hasn't learned yet.
  warn(
    `Unmapped state "${state || 'undefined'}" for module "${code}" — ` +
    `rendering neutral unavailable surface.`,
  );
  return (
    <ModuleBlockedState
      moduleCode={code}
      state="unavailable"
      fallbackTo={fallback}
    />
  );

  // 7. CRASH — App-level ErrorBoundary catches React render errors.
  //    Intentionally NOT a path inside this component.
};

export default ModuleRouteGuard;
