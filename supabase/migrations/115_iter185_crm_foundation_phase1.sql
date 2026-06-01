-- ITER185 · Phase 1 · CRM Foundation
-- ─────────────────────────────────────────────────────────────────────
-- Migration: 115_iter185_crm_foundation_phase1.sql
--
-- Adds:
--   1. accounts.signed_proposal_id (nullable column for customer audit)
--   2. tenant_settings.crm_foundation_v2 (feature flag, default true)
--
-- Strategy: idempotent (IF NOT EXISTS), no destructive changes, forward-only.
-- No backfill of legacy lifecycle_stage values (Founder decision).
-- ─────────────────────────────────────────────────────────────────────

-- §1 · accounts.signed_proposal_id ────────────────────────────────────
-- Nullable text column (UUID-like). NO foreign key in Phase 1 to avoid
-- coupling issues if proposals row is deleted/archived later.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS signed_proposal_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_signed_proposal
  ON accounts(tenant_id, signed_proposal_id)
  WHERE signed_proposal_id IS NOT NULL;

COMMENT ON COLUMN accounts.signed_proposal_id IS
  'ITER185.P1 · Soft reference to proposals.id at the moment of customer conversion. NULL = no signed proposal yet (or reverted). No hard FK to allow proposal archival.';


-- §2 · tenant_settings: crm_foundation_v2 flag ────────────────────────
-- Default ENABLED for all tenants going forward. Per-tenant override via
-- UPDATE tenants SET settings = jsonb_set(settings, '{crm_foundation_v2}', 'false');

DO $$
BEGIN
  -- If `tenants.settings` jsonb column doesn't exist, skip (legacy fallback)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'settings'
  ) THEN
    UPDATE tenants
       SET settings = COALESCE(settings, '{}'::jsonb)
                      || '{"crm_foundation_v2": true}'::jsonb,
           updated_at = NOW()
     WHERE COALESCE(settings, '{}'::jsonb) ? 'crm_foundation_v2' = false;
  END IF;
END $$;


-- §3 · Sanity comments ────────────────────────────────────────────────
COMMENT ON TABLE accounts IS
  'CRM Account · single source of truth for lifecycle_stage. ITER185.P1 added signed_proposal_id for customer conversion audit.';

-- ── End of 115_iter185_crm_foundation_phase1.sql ─────────────────────
