-- ════════════════════════════════════════════════════════════════════════
-- 133 · STORE-002 · MATERIAL BOARD STUDIO™
-- ════════════════════════════════════════════════════════════════════════
-- Surface autonoma per la Material Board. Knowledge-native: ogni elemento
-- è un entity_id (no snapshot · no JSON locali). Riusa lo stesso pattern
-- di moodboard_elements + il service-layer knowledge_usage_hooks.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS material_boards (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL,
  project_id      UUID NULL,
  journey_id      UUID NULL,
  source_moodboard_id UUID NULL,
  title           TEXT NOT NULL DEFAULT 'Material Board',
  template_key    TEXT NOT NULL DEFAULT 'residential',
  status          TEXT NOT NULL DEFAULT 'draft',
  palette         JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by      UUID NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_material_boards_tenant ON material_boards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_material_boards_project ON material_boards(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_material_boards_source ON material_boards(source_moodboard_id) WHERE source_moodboard_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS material_board_elements (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL,
  material_board_id UUID NOT NULL REFERENCES material_boards(id) ON DELETE CASCADE,
  entity_id         UUID NULL,
  position_json     JSONB NOT NULL DEFAULT '{"x":40,"y":40,"width":220,"height":260,"z_index":0}'::jsonb,
  annotation        TEXT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mb_elements_board ON material_board_elements(material_board_id);
CREATE INDEX IF NOT EXISTS idx_mb_elements_entity ON material_board_elements(entity_id) WHERE entity_id IS NOT NULL;

COMMENT ON TABLE  material_boards IS 'STORE-002 · Material Board Studio™ · surface knowledge-native';
COMMENT ON COLUMN material_board_elements.entity_id IS 'Canonical entity_id · soft FK · gestita dal service-layer';

INSERT INTO schema_migrations (version, applied_at)
VALUES ('133_store002_material_boards', NOW()) ON CONFLICT DO NOTHING;

COMMIT;
