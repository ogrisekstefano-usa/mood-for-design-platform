-- ─────────────────────────────────────────────────────────────────
-- 022_human_layer.sql
-- Phase S.1 — Human Layer + Tenant Onboarding Foundation
--
-- Adds:
--   1. human_assignments — who is the real person accompanying a
--      client / lead / project / studio onboarding inside a tenant
--   2. human_assignment_events — append-only audit trail
--   3. tenant_onboarding — checklist progress per tenant + lightweight
--      profile fields for the public-safe assignee profile
--   4. users_profile editorial fields needed for the "human card":
--      short_bio, response_time_label, contact_cta_label, role_label
--
-- RLS DISABLED (multi-tenancy enforced server-side via tenant_id),
-- in line with the rest of the codebase.
-- ─────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. human_assignments ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS human_assignments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subject_type    text NOT NULL CHECK (subject_type IN
                      ('client', 'lead', 'project', 'studio_onboarding')),
    subject_id      uuid NOT NULL,
    assignee_user_id uuid REFERENCES users_profile(id) ON DELETE SET NULL,
    assignment_reason text NOT NULL CHECK (assignment_reason IN
                      ('only_available_user', 'round_robin',
                       'fallback_admin', 'manual_override', 'unassigned')),
    status          text NOT NULL DEFAULT 'active' CHECK (status IN
                      ('active', 'reassigned', 'closed')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users_profile(id) ON DELETE SET NULL,
    metadata_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (tenant_id, subject_type, subject_id, status)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS ix_human_assignments_tenant
    ON human_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS ix_human_assignments_subject
    ON human_assignments(tenant_id, subject_type, subject_id);
CREATE INDEX IF NOT EXISTS ix_human_assignments_assignee
    ON human_assignments(tenant_id, assignee_user_id)
    WHERE status = 'active';


-- ── 2. human_assignment_events ──────────────────────────────────
CREATE TABLE IF NOT EXISTS human_assignment_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   uuid NOT NULL REFERENCES human_assignments(id) ON DELETE CASCADE,
    event_type      text NOT NULL CHECK (event_type IN
                      ('assigned', 'reassigned', 'viewed',
                       'contacted', 'completed')),
    actor_user_id   uuid REFERENCES users_profile(id) ON DELETE SET NULL,
    payload_json    jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_assignment_events_assignment
    ON human_assignment_events(assignment_id, created_at DESC);


-- ── 3. tenant_onboarding ────────────────────────────────────────
-- Per-tenant onboarding checklist state. One row per tenant.
CREATE TABLE IF NOT EXISTS tenant_onboarding (
    tenant_id           uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    -- Step booleans — backend never reads these for permission gating,
    -- they exist purely to drive the Studio Onboarding panel UI.
    profile_completed   boolean NOT NULL DEFAULT false,
    branding_completed  boolean NOT NULL DEFAULT false,
    service_completed   boolean NOT NULL DEFAULT false,
    team_invited        boolean NOT NULL DEFAULT false,
    project_created     boolean NOT NULL DEFAULT false,
    materials_uploaded  boolean NOT NULL DEFAULT false,
    storefront_published boolean NOT NULL DEFAULT false,
    -- Snapshot of when the tenant finished onboarding (all steps green).
    completed_at        timestamptz,
    -- Whoever dismissed the panel for good (super_admin can re-enable).
    dismissed_at        timestamptz,
    dismissed_by        uuid REFERENCES users_profile(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);


-- ── 4. users_profile editorial fields ───────────────────────────
-- These fields power the public-safe assignee profile shown to clients.
-- They are nullable — when missing, the API returns sensible defaults.
ALTER TABLE users_profile
    ADD COLUMN IF NOT EXISTS short_bio text,
    ADD COLUMN IF NOT EXISTS role_label text,
    ADD COLUMN IF NOT EXISTS response_time_label text,
    ADD COLUMN IF NOT EXISTS contact_cta_label text;


-- ── updated_at trigger helper (no-op if already created) ────────
CREATE OR REPLACE FUNCTION _touch_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_human_assignments_touch ON human_assignments;
CREATE TRIGGER trg_human_assignments_touch
    BEFORE UPDATE ON human_assignments
    FOR EACH ROW EXECUTE FUNCTION _touch_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_onboarding_touch ON tenant_onboarding;
CREATE TRIGGER trg_tenant_onboarding_touch
    BEFORE UPDATE ON tenant_onboarding
    FOR EACH ROW EXECUTE FUNCTION _touch_updated_at();

COMMIT;
