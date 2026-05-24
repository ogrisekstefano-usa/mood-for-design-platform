-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  ITER146 · HOTFIX · Core Module Safety™                            ║
-- ║                                                                    ║
-- ║  Add is_core_critical column to feature_modules_registry.          ║
-- ║  Core-critical modules cannot be put into any non-operational      ║
-- ║  state (disabled, hidden, locked, coming_soon, beta_restricted).   ║
-- ║                                                                    ║
-- ║  The previous is_core flag remains as a softer marker (used by     ║
-- ║  the existing core_force_enabled fallback for `disabled` only).    ║
-- ║  is_core_critical is enforced ACROSS ALL non-operational states    ║
-- ║  by both the resolver and the mutation routes.                     ║
-- ╚════════════════════════════════════════════════════════════════════╝

ALTER TABLE feature_modules_registry
  ADD COLUMN IF NOT EXISTS is_core_critical BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN feature_modules_registry.is_core_critical IS
  'When TRUE, this module is fundamental for runtime operability. Any '
  'tenant_flag, tenant_module_toggle or platform_default that would '
  'put it in a non-operational state (disabled/hidden/locked/coming_soon/'
  'beta_restricted) is rejected at the API layer AND auto-promoted to '
  '`enabled` by the resolver. Audit-logged as `core_critical_*` events.';

-- Mark the canonical critical modules. These are the runtime-essential
-- surfaces every tenant MUST have access to in order to operate the
-- studio (dashboard mission control, navigation/settings, journey index,
-- begin-journey ritual, team management, blueprint admin governance).
UPDATE feature_modules_registry
SET is_core_critical = TRUE
WHERE code IN (
  'dashboard',
  'settings_workspace',
  'blueprint_admin',
  'journey_index',
  'begin_journey',
  'team'
);

-- Sanity check (no-op assert via SELECT — informational only).
-- SELECT code, is_core, is_core_critical FROM feature_modules_registry
-- WHERE is_core_critical = TRUE ORDER BY position;
