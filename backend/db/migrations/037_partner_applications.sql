-- 037_partner_applications.sql
-- Phase 3 — Partner Application intake table.
-- Idempotent (IF NOT EXISTS on table and indexes).

CREATE TABLE IF NOT EXISTS partner_applications (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name            TEXT        NOT NULL,
    last_name             TEXT        NOT NULL,
    email                 TEXT        NOT NULL,
    phone_prefix          TEXT,
    phone_number          TEXT,
    company               TEXT,
    website               TEXT,
    profile_type          TEXT        NOT NULL,
    collaboration_intents TEXT[]      DEFAULT '{}',
    message               TEXT,
    locale                TEXT        DEFAULT 'en-US',
    status                TEXT        DEFAULT 'new',
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS partner_applications_email_idx
    ON partner_applications(email);

CREATE INDEX IF NOT EXISTS partner_applications_status_idx
    ON partner_applications(status);

CREATE INDEX IF NOT EXISTS partner_applications_created_at_idx
    ON partner_applications(created_at DESC);
