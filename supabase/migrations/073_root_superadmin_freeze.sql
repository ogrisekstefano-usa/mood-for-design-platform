-- ────────────────────────────────────────────────────────────────────
-- 073_root_superadmin_freeze.sql — ITER143C · BLUEPRINT COMMAND CENTER™
--
-- ROOT GOVERNANCE FREEZE:
--   • `is_root_superadmin` is the ONLY source of truth for ROOT access.
--     Email is canonical identity, NOT permission.
--   • Only ONE active root superadmin can exist at a time (partial
--     unique index). The flag is reserved to `admin@moodfordesign.com`
--     by convention but enforced by DB state, not by email matching.
--   • Tenant_admin / blueprint collaborators / operators / clients
--     CANNOT acquire this flag through any UI flow — only via direct
--     SQL by an existing root superadmin or migration.
--
-- Tenant orchestration helper:
--   • Adds `is_demo` flag on `tenants` so studio.moodfordesign.com
--     (Golden Demo Tenant™) can be identified across the platform
--     without string-matching slugs.
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE users_profile
  ADD COLUMN IF NOT EXISTS is_root_superadmin BOOLEAN NOT NULL DEFAULT FALSE;

-- At most ONE active root superadmin. Partial unique index keeps the
-- constraint cheap and explicit.
CREATE UNIQUE INDEX IF NOT EXISTS users_profile_root_superadmin_unique
  ON users_profile ((TRUE))
  WHERE is_root_superadmin = TRUE;

-- Tenant demo flag — supports the Golden Snapshot™ reset orchestration
-- without ever string-matching slugs.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

-- ───── Email events governance (extends 071_saas_foundation) ─────
-- The base table from 071 covers `tenant_id, event_type, recipient,
-- subject, template, status, provider, provider_id, error, metadata`.
-- We add the bits the Email Governance™ control tower will need:
ALTER TABLE email_events
  ADD COLUMN IF NOT EXISTS locale TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounce_reason TEXT;

CREATE INDEX IF NOT EXISTS email_events_event_type_idx
  ON email_events (event_type, created_at DESC);


-- ───── Golden Snapshot™ orchestration log ─────────────────────────
-- Every reset (and every reseed) of the demo tenant is recorded here.
-- Lets the control tower show "last restored at …" + "by whom" and
-- preserves an audit trail. NEVER deleted, even when the tenant is
-- reset.
CREATE TABLE IF NOT EXISTS demo_snapshot_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,             -- 'restore' | 'reseed' | 'wipe'
  initiated_by  UUID,                      -- users_profile.id
  preserved     JSONB DEFAULT '{}',        -- {users:true,presets:true,locale:true,…}
  wiped         JSONB DEFAULT '{}',        -- {accounts:N,journeys:N,…}
  duration_ms   INTEGER,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS demo_snapshot_events_idx
  ON demo_snapshot_events (created_at DESC);
