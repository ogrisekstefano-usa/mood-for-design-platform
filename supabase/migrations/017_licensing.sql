-- =====================================================================
-- 017_licensing.sql — Tenant Licensing Engine
-- =====================================================================
-- Adds licensing/plan/capacity fields to `tenants`.
-- All limits are nullable → NULL means "unlimited" (Enterprise default).
-- Plan strings are open-ended (string column) so adding plans later
-- doesn't require a schema migration. Defaults are kept in core/licensing.py.
--
-- enabled_modules is a jsonb array of module keys (e.g. ["leads","moodboards"])
-- so future feature-flag gating can read straight from the tenant record.
--
-- Stripe fields are nullable on purpose — Session G is mock-first.
-- =====================================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS active_plan          text        NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS plan_assigned_at     timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS plan_assigned_by     uuid,
  ADD COLUMN IF NOT EXISTS subscription_status  text        NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS billing_cycle        text,            -- monthly | yearly | trial | manual
  ADD COLUMN IF NOT EXISTS trial_ends_at        timestamptz,
  ADD COLUMN IF NOT EXISTS max_users            integer,         -- null = unlimited
  ADD COLUMN IF NOT EXISTS max_projects         integer,
  ADD COLUMN IF NOT EXISTS max_storage_gb       numeric(10, 2),
  ADD COLUMN IF NOT EXISTS max_domains          integer,
  ADD COLUMN IF NOT EXISTS max_ai_credits       integer,
  ADD COLUMN IF NOT EXISTS enabled_modules      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stripe_customer_id   text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

COMMENT ON COLUMN tenants.active_plan IS         'starter | studio | enterprise | custom — defaults in core/licensing.py';
COMMENT ON COLUMN tenants.subscription_status IS 'active | past_due | canceled | suspended | trial';
COMMENT ON COLUMN tenants.max_users IS           'NULL = unlimited';
COMMENT ON COLUMN tenants.enabled_modules IS     'jsonb array of module keys, e.g. ["leads","moodboards","ai_translate"]';

CREATE INDEX IF NOT EXISTS idx_tenants_plan   ON tenants (active_plan);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants (subscription_status);

-- ── Backfill defaults for existing tenants ────────────────────────────
-- Apply the Studio plan to every existing tenant so dev/demo work continues
-- without being blocked by the new license checks. Super-admin can then
-- downgrade to Starter on individual tenants from the SuperAdmin dashboard.
UPDATE tenants
SET
  active_plan    = COALESCE(NULLIF(active_plan, ''), 'studio'),
  max_users      = COALESCE(max_users, 10),
  max_projects   = COALESCE(max_projects, 50),
  max_storage_gb = COALESCE(max_storage_gb, 25.0),
  max_domains    = COALESCE(max_domains, 2),
  max_ai_credits = COALESCE(max_ai_credits, 5000),
  enabled_modules = CASE
    WHEN enabled_modules = '[]'::jsonb OR enabled_modules IS NULL
    THEN '["leads","projects","proposals","moodboards","inspirations","members","storefront","forms"]'::jsonb
    ELSE enabled_modules
  END
WHERE active_plan IN ('starter', 'studio', 'enterprise', 'custom') OR active_plan IS NULL;
