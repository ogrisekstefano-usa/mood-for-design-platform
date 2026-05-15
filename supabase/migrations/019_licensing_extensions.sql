-- =====================================================================
-- 019_licensing_extensions.sql — Plan-Aware enforcement everywhere
-- =====================================================================
-- Extends the licensing surface to Projects, Moodboards, Storage, Domains:
--   • tenants.max_moodboards         (NULL = unlimited)
--   • moodboards soft-delete / archive fields (active count != total)
--   • tenant_domains.domain_type     (subdomain | custom — distinct from `kind`
--                                     which is user-facing intent; used as the
--                                     billed-vs-free flag)
--   • Adjust plan defaults via UPDATE (Starter/Studio downgraded vs Session H)
-- =====================================================================

-- ── 1. Moodboard limit on tenants ────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS max_moodboards integer;  -- NULL = unlimited

COMMENT ON COLUMN tenants.max_moodboards IS
  'NULL = unlimited. Enforced server-side in core/licensing.py';

CREATE INDEX IF NOT EXISTS idx_tenants_max_moodboards ON tenants (max_moodboards);

-- ── 2. Moodboard archive / soft-delete columns ───────────────────────
ALTER TABLE moodboards
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz;

COMMENT ON COLUMN moodboards.archived_at IS 'Set when user archives; excluded from quota';
COMMENT ON COLUMN moodboards.deleted_at  IS 'Soft delete — excluded from quota and lists';

CREATE INDEX IF NOT EXISTS idx_moodboards_active
  ON moodboards (tenant_id)
  WHERE deleted_at IS NULL;

-- ── 3. tenant_domains.domain_type (separate from `kind`) ─────────────
-- `kind` already carries user intent (subdomain | custom | apex) but we
-- want a clean billed/free flag that does NOT change if the user re-tags
-- their domain. domain_type is computed once at create time from the
-- hostname suffix and is the single source of truth for quota billing.
ALTER TABLE tenant_domains
  ADD COLUMN IF NOT EXISTS domain_type text NOT NULL DEFAULT 'custom';

COMMENT ON COLUMN tenant_domains.domain_type IS
  'subdomain (free, *.moodfordesign.com) | custom (counts against max_domains)';

CREATE INDEX IF NOT EXISTS idx_domains_domain_type ON tenant_domains (domain_type)
  WHERE deleted_at IS NULL;

-- Backfill existing rows: anything ending with .moodfordesign.com → subdomain
UPDATE tenant_domains
SET domain_type = CASE
  WHEN lower(hostname) LIKE '%.moodfordesign.com' THEN 'subdomain'
  ELSE 'custom'
END
WHERE domain_type IS NULL OR domain_type = 'custom';

-- ── 4. Re-seed plan defaults on existing tenants ─────────────────────
-- Session H seeded the demo tenant on 'studio' with very generous limits.
-- Re-apply user-confirmed defaults (Feb 2026 pricing) but ONLY where the
-- column is still NULL or still at the legacy Session-H values, so any
-- super-admin per-tenant override stays untouched.

-- Starter defaults backfill (no-op for tenants already on starter)
UPDATE tenants SET max_moodboards = 15  WHERE active_plan = 'starter' AND max_moodboards IS NULL;
UPDATE tenants SET max_projects   = 5   WHERE active_plan = 'starter' AND max_projects   = 10;
UPDATE tenants SET max_storage_gb = 5.0 WHERE active_plan = 'starter' AND max_storage_gb = 5.0;
UPDATE tenants SET max_domains    = 1   WHERE active_plan = 'starter' AND max_domains    = 1;

-- Studio defaults backfill
UPDATE tenants SET max_moodboards = 100 WHERE active_plan = 'studio'  AND max_moodboards IS NULL;
UPDATE tenants SET max_projects   = 25  WHERE active_plan = 'studio'  AND max_projects   = 50;
UPDATE tenants SET max_storage_gb = 50.0 WHERE active_plan = 'studio' AND max_storage_gb = 25.0;
UPDATE tenants SET max_domains    = 3   WHERE active_plan = 'studio'  AND max_domains    = 2;

-- Enterprise stays unlimited (no backfill needed, already NULL)
