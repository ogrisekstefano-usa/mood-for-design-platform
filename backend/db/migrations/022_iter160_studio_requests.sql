-- ITER160 Phase 2 — Studio Requests (Guided Introduction submissions)
--
-- A studio that completes the /studio flow does NOT become an active
-- tenant. It generates a qualified request that a MOOD Advisor reviews
-- and converts manually via a tailored configuration process.

CREATE TABLE IF NOT EXISTS studio_requests (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id             UUID NULL REFERENCES studio_activation_drafts(id) ON DELETE SET NULL,

    -- Composition
    archetype            TEXT NULL,
    experiences          TEXT[] NOT NULL DEFAULT '{}',

    -- Studio identity
    studio_name          TEXT NULL,
    monogram             TEXT NULL,
    city                 TEXT NULL,
    country              TEXT NULL,
    languages            TEXT[] NOT NULL DEFAULT '{}',
    atelier              JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{name, role}]
    markets              TEXT[] NOT NULL DEFAULT '{}',
    temperament          TEXT NULL,                              -- quiet | composed | vivid

    -- Contact
    contact_name         TEXT NULL,
    contact_role         TEXT NULL,
    contact_email        TEXT NULL,
    phone_prefix         TEXT NULL,
    phone_number         TEXT NULL,
    website              TEXT NULL,
    notes                TEXT NULL,                              -- expectations / context

    -- Telemetry
    locale               TEXT NOT NULL DEFAULT 'it',
    source               TEXT NOT NULL DEFAULT 'studio_flow',
    ip                   TEXT NULL,
    user_agent           TEXT NULL,

    -- Advisor workflow
    status               TEXT NOT NULL DEFAULT 'received',
                                                                  -- received | reviewing | contacted
                                                                  -- | qualified | not_aligned | activated
    advisor_notes        TEXT NULL,
    reviewed_at          TIMESTAMPTZ NULL,
    assigned_advisor_id  UUID NULL REFERENCES users(id) ON DELETE SET NULL,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_requests_status      ON studio_requests (status);
CREATE INDEX IF NOT EXISTS idx_studio_requests_created     ON studio_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_requests_contact_em  ON studio_requests (lower(contact_email));
