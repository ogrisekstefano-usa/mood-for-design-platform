-- ITER160 — Studio Activation Onboarding Flow™
--
-- Draft state for an in-progress studio composition.
-- A draft exists BEFORE there's a tenant or a user. It is keyed by a
-- cookie/localStorage `draft_token` chosen by the client. When the
-- composition completes, the draft is consumed and a `tenants` row
-- (plus founder `users` row, `tenant_modules` rows) are created.

CREATE TABLE IF NOT EXISTS studio_activation_drafts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_token         TEXT NOT NULL UNIQUE,             -- opaque client-issued id
    archetype           TEXT NULL,                         -- 'interior_studio' | 'luxury_showroom' | ...
    experiences         TEXT[] NOT NULL DEFAULT '{}',
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,   -- identity blob (name, monogram, atelier[], …)
    current_movement    TEXT NOT NULL DEFAULT 'entrance', -- entrance | practice | ecosystem | identity | activate
    founder_email       TEXT NULL,
    resumed_count       INT  NOT NULL DEFAULT 0,
    ip                  TEXT NULL,
    user_agent          TEXT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_studio_drafts_recent
    ON studio_activation_drafts (updated_at DESC);

-- Modules activated by a tenant. Populated at the moment of activation
-- (Movement V completion) and updated thereafter by the rest of the platform.
CREATE TABLE IF NOT EXISTS tenant_modules (
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_key      TEXT NOT NULL,
    state           TEXT NOT NULL DEFAULT 'active',   -- active | paused | archived
    activated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_modules_state
    ON tenant_modules (state);
