-- 134 · STORE-003 · SPECIFICATION PACKAGE™
BEGIN;

CREATE TABLE IF NOT EXISTS specification_packages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL,
  project_id  UUID NULL,
  journey_id  UUID NULL,
  source_moodboard_id      UUID NULL,
  source_material_board_id UUID NULL,
  title       TEXT NOT NULL DEFAULT 'Specification Package',
  status      TEXT NOT NULL DEFAULT 'draft',  -- draft | review | approved | ready
  notes       TEXT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by  UUID NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_specifications_tenant ON specification_packages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_specifications_project ON specification_packages(project_id) WHERE project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS specification_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL,
  specification_id UUID NOT NULL REFERENCES specification_packages(id) ON DELETE CASCADE,
  entity_id       UUID NULL,
  quantity        NUMERIC NOT NULL DEFAULT 1,
  unit            TEXT NOT NULL DEFAULT 'pz',
  material_finish TEXT NULL,
  code            TEXT NULL,
  notes           TEXT NULL,
  price           NUMERIC NULL,
  status          TEXT NOT NULL DEFAULT 'proposed', -- proposed | confirmed | replaced | removed
  sort_order      INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spec_items_spec ON specification_items(specification_id);
CREATE INDEX IF NOT EXISTS idx_spec_items_entity ON specification_items(entity_id) WHERE entity_id IS NOT NULL;

INSERT INTO schema_migrations (version, applied_at)
VALUES ('134_store003_specification_packages', NOW()) ON CONFLICT DO NOTHING;
COMMIT;
