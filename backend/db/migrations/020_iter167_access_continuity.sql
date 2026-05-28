-- ITER167 — Access Continuity™ (Magic-Link First Experience™)
--
-- One-time, short-lived access tokens issued by the platform.
-- Stored as the SHA-256 of the actual token; the raw token never lives in DB.
-- Consumed exactly once. After expiry (default 15min) it can no longer be used.

CREATE TABLE IF NOT EXISTS access_magic_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NULL REFERENCES tenants(id) ON DELETE SET NULL,
    user_id         UUID NULL REFERENCES users(id) ON DELETE CASCADE,
    email_attempt   TEXT NOT NULL,             -- lowercase email used in request
    token_hash      TEXT NOT NULL UNIQUE,      -- sha256(raw_token)
    expires_at      TIMESTAMPTZ NOT NULL,
    consumed_at     TIMESTAMPTZ NULL,
    ip              TEXT NULL,
    user_agent      TEXT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_magic_links_email_recent
    ON access_magic_links (email_attempt, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_magic_links_user
    ON access_magic_links (user_id);

-- Rate-limit helper: count of recent requests by email within a window.
-- (Queried directly by the access_continuity service.)
