-- =====================================================================
-- 016_members_management.sql — Member Management System
-- =====================================================================
-- Extends users_profile with invite + audit fields and introduces a
-- forward-compatible `tenant_memberships` table so a single auth.user
-- can belong to multiple tenants in the future (showroom managers,
-- A&D partners, fabricators, sales reps).
--
-- For MVP we keep `users_profile.tenant_id` authoritative (single tenant
-- per user). The new memberships table is populated in parallel so we
-- can flip the switch later without data migration.
-- =====================================================================

-- ── users_profile additions ─────────────────────────────────────────
ALTER TABLE users_profile
  ADD COLUMN IF NOT EXISTS first_name      text,
  ADD COLUMN IF NOT EXISTS last_name       text,
  ADD COLUMN IF NOT EXISTS avatar_url      text,
  ADD COLUMN IF NOT EXISTS phone           text,
  ADD COLUMN IF NOT EXISTS last_login_at   timestamptz,
  ADD COLUMN IF NOT EXISTS invited_by      uuid,
  ADD COLUMN IF NOT EXISTS invited_at      timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at     timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at    timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by    uuid,
  ADD COLUMN IF NOT EXISTS suspended_reason text;

-- Status values:
--   active      → can log in, fully provisioned
--   invited     → invite sent, never logged in / set password
--   suspended   → admin disabled the account (login blocked at API level)
COMMENT ON COLUMN users_profile.status IS
  'active | invited | suspended';


-- ── tenant_memberships (future-proof multi-tenant join) ─────────────
CREATE TABLE IF NOT EXISTS tenant_memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  role            text NOT NULL,                       -- role within THIS tenant
  status          text NOT NULL DEFAULT 'active',      -- active | invited | suspended
  is_primary      boolean NOT NULL DEFAULT true,       -- the user's "home" tenant
  invited_by      uuid REFERENCES users_profile(id) ON DELETE SET NULL,
  invited_at      timestamptz,
  accepted_at     timestamptz,
  suspended_at    timestamptz,
  suspended_by    uuid REFERENCES users_profile(id) ON DELETE SET NULL,
  metadata_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant  ON tenant_memberships (tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_profile ON tenant_memberships (profile_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status  ON tenant_memberships (status);

-- Backfill: one membership per existing users_profile.
INSERT INTO tenant_memberships (tenant_id, profile_id, role, status, is_primary, created_at, updated_at)
SELECT tenant_id, id, role, COALESCE(status, 'active'), true, COALESCE(created_at, now()), COALESCE(updated_at, now())
FROM users_profile
WHERE tenant_id IS NOT NULL
ON CONFLICT (tenant_id, profile_id) DO NOTHING;


-- ── member_invites (track magic-link tokens server-side, audit) ─────
-- Even though Supabase issues the magic link, we keep our own record
-- so we can list "pending invites" + show who invited whom + allow
-- "resend" without losing context.
CREATE TABLE IF NOT EXISTS member_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           text NOT NULL,
  first_name      text,
  last_name       text,
  role            text NOT NULL,
  invited_by      uuid REFERENCES users_profile(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'sent',  -- sent | accepted | revoked | expired
  sent_at         timestamptz NOT NULL DEFAULT now(),
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  resend_count    int NOT NULL DEFAULT 0,
  last_resent_at  timestamptz,
  metadata_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_invites_tenant  ON member_invites (tenant_id);
CREATE INDEX IF NOT EXISTS idx_invites_status  ON member_invites (status);
CREATE INDEX IF NOT EXISTS idx_invites_email   ON member_invites (lower(email));

COMMENT ON TABLE  tenant_memberships IS 'A user can belong to multiple tenants. users_profile.tenant_id stays as primary for MVP.';
COMMENT ON TABLE  member_invites    IS 'Audit trail for magic-link invites sent via Supabase Auth.';
