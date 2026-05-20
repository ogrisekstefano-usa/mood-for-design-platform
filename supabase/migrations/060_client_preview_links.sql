-- ────────────────────────────────────────────────────────────────────
-- 060_client_preview_links.sql — Sprint F2.4 · Client Preview Link™
--
-- Tre tabelle per supportare la Private Curatorial Presentation Experience:
--   • preview_tokens         — token sicuri shareable
--   • client_preview_feedback — azioni del cliente (approve/alternative/note)
--   • client_preview_views    — tracking views per Usage Memory™ foundation
-- ────────────────────────────────────────────────────────────────────

-- ── 1. PREVIEW TOKENS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS preview_tokens (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by               UUID,                                 -- profile_id che ha generato
  token                    TEXT NOT NULL UNIQUE,                 -- url-safe random (32 bytes b64)
  resource_type            TEXT NOT NULL,                        -- 'curated_collection' | 'moodboard' (future)
  resource_id              UUID NOT NULL,
  title                    TEXT,                                 -- override editoriale (es. "Direzione Cliente Riva")
  preview_mode             TEXT NOT NULL DEFAULT 'editorial',
    -- 'editorial' | 'material' | 'storytelling' | 'composition'
  settings                 JSONB NOT NULL DEFAULT '{}',          -- {show_brand_logo, allow_comments, palette_override, …}
  expires_at               TIMESTAMPTZ,                          -- NULL = never expires
  revoked_at               TIMESTAMPTZ,
  views_count              INTEGER NOT NULL DEFAULT 0,
  unique_visitors_count    INTEGER NOT NULL DEFAULT 0,
  last_viewed_at           TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS preview_tokens_token_idx
  ON preview_tokens (token) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS preview_tokens_tenant_idx
  ON preview_tokens (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS preview_tokens_resource_idx
  ON preview_tokens (resource_type, resource_id);


-- ── 2. CLIENT PREVIEW FEEDBACK ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_preview_feedback (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preview_token_id    UUID NOT NULL REFERENCES preview_tokens(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action_type         TEXT NOT NULL,
    -- 'approve_direction' | 'request_alternatives' | 'note'
  target_asset_id     UUID,                                       -- optional — media_library.id
  note                TEXT,
  client_identifier   TEXT,                                       -- optional self-id (es. nome cliente)
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS client_preview_feedback_token_idx
  ON client_preview_feedback (preview_token_id, created_at DESC);
CREATE INDEX IF NOT EXISTS client_preview_feedback_tenant_idx
  ON client_preview_feedback (tenant_id, created_at DESC);


-- ── 3. CLIENT PREVIEW VIEWS ─────────────────────────────────────────
-- Tracking minimale per Usage Memory™ — quali asset il cliente osserva.
CREATE TABLE IF NOT EXISTS client_preview_views (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preview_token_id    UUID NOT NULL REFERENCES preview_tokens(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_asset_id     UUID,                                       -- NULL = pageview (root)
  duration_ms         INTEGER,
  viewer_signature    TEXT,                                       -- hashed user-agent + ip (best-effort, no PII)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS client_preview_views_token_idx
  ON client_preview_views (preview_token_id, created_at DESC);
CREATE INDEX IF NOT EXISTS client_preview_views_asset_idx
  ON client_preview_views (target_asset_id);
