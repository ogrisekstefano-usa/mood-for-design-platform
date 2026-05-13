-- =============================================================================
-- Blueprint Inspirations™ Foundation — Creative Memory System™
-- Migration 011 · adds the four core tables for the inspiration architecture.
--
-- Design notes:
--   • All tables are tenant-scoped (tenant_id NOT NULL) and indexed for
--     row-level isolation queries.
--   • Boards can be (optionally) linked to lead / project / moodboard so the
--     SAME schema serves both the "free creative archive" and the future
--     Mood Discovery™ workflow.
--   • metadata_json + ai_tags_json + style_tags_json + extracted_palette_json
--     are placeholders for future AI enrichment — kept as JSONB so we can add
--     keys without migrations.
--   • Activity is a first-class table (not a poll on items.updated_at) so the
--     designer can see "client uploaded X at 14:32" as a real timeline event.
--   • RLS policies are NOT created here (we mirror the rest of the codebase
--     which enforces tenant isolation at the API layer for now).
-- =============================================================================
BEGIN;

-- ── Boards ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspirations_boards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES users_profile(id),
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  lead_id         UUID REFERENCES leads(id)    ON DELETE SET NULL,
  moodboard_id    UUID REFERENCES moodboards(id) ON DELETE SET NULL,
  -- Descriptive fields
  title           TEXT NOT NULL,
  description     TEXT,
  cover_image     TEXT,
  visibility      TEXT NOT NULL DEFAULT 'private',
  -- private | team | project | shared (last reserved for future)
  tags_json       JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ins_boards_tenant_idx     ON inspirations_boards(tenant_id);
CREATE INDEX IF NOT EXISTS ins_boards_project_idx    ON inspirations_boards(project_id);
CREATE INDEX IF NOT EXISTS ins_boards_lead_idx       ON inspirations_boards(lead_id);
CREATE INDEX IF NOT EXISTS ins_boards_moodboard_idx  ON inspirations_boards(moodboard_id);
CREATE INDEX IF NOT EXISTS ins_boards_created_idx    ON inspirations_boards(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ins_boards_visibility_idx ON inspirations_boards(tenant_id, visibility);

-- ── Items ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspirations_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  board_id        UUID NOT NULL REFERENCES inspirations_boards(id) ON DELETE CASCADE,
  -- Content type — kept as TEXT (not enum) so future content types don't
  -- require a migration: image | link | product | note | pdf | video | material
  type            TEXT NOT NULL,
  title           TEXT,
  description     TEXT,
  -- For URL-typed items
  source_url      TEXT,
  -- Always-resolved preview thumbnail (could be CDN URL or signed URL)
  thumbnail_url   TEXT,
  -- For uploaded assets (image / pdf / video)
  asset_url       TEXT,
  -- Free-form provenance: { storage_path, content_type, file_size,
  -- original_dimensions, file_name, captured_at, source_app, … }
  metadata_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Designer-defined style tags ["japandi","warm minimal","stone"]
  style_tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- AI-extracted tags (future) — populated by enrichment workers
  ai_tags_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- AI-extracted dominant palette (future) — list of {hex, weight} entries
  extracted_palette_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Grid / freeform layout: { x, y, w, h, z } — used by future board canvas
  position_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Audit
  created_by      UUID NOT NULL REFERENCES users_profile(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ins_items_tenant_idx   ON inspirations_items(tenant_id);
CREATE INDEX IF NOT EXISTS ins_items_board_idx    ON inspirations_items(board_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ins_items_type_idx     ON inspirations_items(tenant_id, type);
CREATE INDEX IF NOT EXISTS ins_items_created_idx  ON inspirations_items(tenant_id, created_at DESC);

-- ── Activity timeline ───────────────────────────────────────────────────────
-- First-class table (not a view) so the designer's "when did the client
-- upload X?" answer is O(1) and chronologically ordered out-of-the-box.
CREATE TABLE IF NOT EXISTS inspirations_activity (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  board_id        UUID NOT NULL REFERENCES inspirations_boards(id) ON DELETE CASCADE,
  item_id         UUID REFERENCES inspirations_items(id) ON DELETE SET NULL,
  actor_id        UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  -- item_added | item_removed | note_added | client_uploaded | moved
  -- | tagged | linked_to_project | board_created | board_updated | comment_added
  activity_type   TEXT NOT NULL,
  payload_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ins_activity_board_idx  ON inspirations_activity(board_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ins_activity_tenant_idx ON inspirations_activity(tenant_id, created_at DESC);

-- ── Comments ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspirations_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  board_id        UUID NOT NULL REFERENCES inspirations_boards(id) ON DELETE CASCADE,
  item_id         UUID REFERENCES inspirations_items(id) ON DELETE SET NULL,
  author_id       UUID NOT NULL REFERENCES users_profile(id),
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ins_comments_board_idx ON inspirations_comments(board_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ins_comments_item_idx  ON inspirations_comments(item_id, created_at DESC);

-- ── Updated_at triggers (reuse global helper if available) ──────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    EXECUTE 'CREATE TRIGGER ins_boards_set_updated_at BEFORE UPDATE ON inspirations_boards FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
    EXECUTE 'CREATE TRIGGER ins_items_set_updated_at  BEFORE UPDATE ON inspirations_items  FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Triggers may already exist on re-run; ignore.
  NULL;
END $$;

COMMIT;
