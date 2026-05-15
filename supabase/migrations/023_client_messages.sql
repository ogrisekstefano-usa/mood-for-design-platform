-- ─────────────────────────────────────────────────────────────────
-- 023_client_messages.sql
-- Phase S.2 — Human Workflow Layer + Real Contact Initiation
--
-- Adds:
--   1. client_messages — first message thread between a client and
--      their assigned human reference, plus internal AI suggestions
--      and system notes.
--   2. human_assignments first-contact tracking fields
--   3. notifications — lightweight in-DB notification queue
--      (provider abstraction documented in
--      /app/backend/core/notification_service.py)
-- ─────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS client_messages (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          uuid REFERENCES projects(id) ON DELETE SET NULL,
    client_user_id      uuid NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
    assignee_user_id    uuid REFERENCES users_profile(id) ON DELETE SET NULL,
    sender_user_id      uuid REFERENCES users_profile(id) ON DELETE SET NULL,
    recipient_user_id   uuid REFERENCES users_profile(id) ON DELETE SET NULL,
    message_body        text NOT NULL,
    message_type        text NOT NULL CHECK (message_type IN
                          ('client_message','assignee_reply','system_note','ai_suggestion')),
    visibility          text NOT NULL CHECK (visibility IN
                          ('client_visible','internal_only')),
    status              text NOT NULL DEFAULT 'sent' CHECK (status IN
                          ('draft','sent','read','archived')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    read_at             timestamptz,
    metadata_json       jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_client_messages_tenant_client
    ON client_messages(tenant_id, client_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_client_messages_assignee
    ON client_messages(tenant_id, assignee_user_id, created_at DESC)
    WHERE visibility = 'client_visible';
CREATE INDEX IF NOT EXISTS ix_client_messages_visibility
    ON client_messages(tenant_id, visibility, status);


-- ── First-contact tracking on human_assignments ─────────────────
ALTER TABLE human_assignments
    ADD COLUMN IF NOT EXISTS first_contact_suggested_at timestamptz,
    ADD COLUMN IF NOT EXISTS first_contact_sent_at      timestamptz,
    ADD COLUMN IF NOT EXISTS first_contact_status       text
        CHECK (first_contact_status IN ('pending','suggested','sent','overdue'))
        DEFAULT 'pending';


-- ── Notifications (reuse existing schema) ───────────────────────
-- The `notifications` table already exists (user_id / type / message).
-- We only need new event_type values handled in code, no schema change.

COMMIT;
