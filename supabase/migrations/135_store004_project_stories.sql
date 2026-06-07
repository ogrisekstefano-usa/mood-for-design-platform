-- 135 · STORE-004 · PROJECT STORY™
BEGIN;
CREATE TABLE IF NOT EXISTS project_stories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL,
  project_id  UUID NULL,
  journey_id  UUID NULL,
  source_moodboard_id      UUID NULL,
  source_material_board_id UUID NULL,
  source_specification_id  UUID NULL,
  title       TEXT NOT NULL DEFAULT 'Project Story',
  client_name TEXT NULL,
  cover_image_url TEXT NULL,
  studio_name TEXT NULL,
  status      TEXT NOT NULL DEFAULT 'draft',  -- draft | published
  share_token TEXT UNIQUE NULL,
  sections    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by  UUID NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_project_stories_tenant ON project_stories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_stories_token ON project_stories(share_token) WHERE share_token IS NOT NULL;
INSERT INTO schema_migrations (version, applied_at)
VALUES ('135_store004_project_stories', NOW()) ON CONFLICT DO NOTHING;
COMMIT;
