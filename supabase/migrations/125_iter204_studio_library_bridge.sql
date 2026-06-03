-- ITER204 · STUDIO LIBRARY BRIDGE™
-- =============================================================
-- Unified Studio Library™ for the studio's permanent curatorial heritage:
-- brands, collections, products, materials, designers (and future
-- source_types: academy, editorial, case_study, market_insight).
--
-- This sits alongside (not replacing) studio_brand_links — which remains
-- a brand-only quick-link table. The new studio_library_items is the
-- canonical, polymorphic Library used by Brand Atlas, Studio Library
-- page, and Moodboard "From Studio Library" creation flow.
-- =============================================================

CREATE TABLE IF NOT EXISTS studio_library_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type   TEXT NOT NULL,
    entity_id     UUID NOT NULL,
    source_type   TEXT,
    saved_by      UUID,
    saved_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes         TEXT,
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (tenant_id, entity_type, entity_id),
    CONSTRAINT studio_library_items_entity_type_chk CHECK (
        entity_type IN ('brand', 'collection', 'product', 'material', 'designer')
    ),
    CONSTRAINT studio_library_items_source_type_chk CHECK (
        source_type IS NULL OR source_type IN (
            'academy', 'editorial', 'case_study', 'market_insight',
            'brand_atlas', 'manual', 'import'
        )
    )
);

COMMENT ON TABLE  studio_library_items IS
  'ITER204 · Studio Library Bridge™ — polymorphic studio curatorial heritage.';
COMMENT ON COLUMN studio_library_items.entity_type IS
  'brand | collection | product | material | designer';
COMMENT ON COLUMN studio_library_items.source_type IS
  'Provenance: academy | editorial | case_study | market_insight | brand_atlas | manual | import';

CREATE INDEX IF NOT EXISTS idx_studio_library_tenant
  ON studio_library_items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_studio_library_tenant_type
  ON studio_library_items (tenant_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_studio_library_entity
  ON studio_library_items (entity_type, entity_id);

-- ── Backfill from studio_brand_links (idempotent) ───────────────────
INSERT INTO studio_library_items
    (id, tenant_id, entity_type, entity_id, source_type, saved_by, saved_at, notes)
SELECT
    gen_random_uuid(),
    sbl.tenant_id,
    'brand',
    sbl.brand_id,
    'brand_atlas',
    sbl.linked_by,
    sbl.linked_at,
    sbl.note
FROM studio_brand_links sbl
WHERE NOT EXISTS (
    SELECT 1 FROM studio_library_items sli
    WHERE sli.tenant_id = sbl.tenant_id
      AND sli.entity_type = 'brand'
      AND sli.entity_id  = sbl.brand_id
);

-- ── Register navigation entry "Studio Library™" ─────────────────────
INSERT INTO feature_modules_registry
  (code, display_name, category, description, default_state, required_role,
   is_core, position, nav_route, nav_icon, nav_group, nav_section_label,
   nav_visibility, nav_end_match, nav_has_mark, group_position, nav_test_id)
VALUES
  ('studio_library',     'Studio Library',     'content',
   'Studio curatorial heritage — brands, collections, products, materials, designers.',
   'enabled', 'tenant', FALSE, 29, '/studio-library', 'Library',
   'curatorial-atlas', 'Curatorial Atlas', 'tenant', FALSE, TRUE, 30,
   'sidebar-nav-studio-library')
ON CONFLICT (code) DO UPDATE SET
  display_name      = EXCLUDED.display_name,
  category          = EXCLUDED.category,
  description       = EXCLUDED.description,
  default_state     = EXCLUDED.default_state,
  required_role     = EXCLUDED.required_role,
  is_core           = EXCLUDED.is_core,
  position          = EXCLUDED.position,
  nav_route         = EXCLUDED.nav_route,
  nav_icon          = EXCLUDED.nav_icon,
  nav_group         = EXCLUDED.nav_group,
  nav_section_label = EXCLUDED.nav_section_label,
  nav_visibility    = EXCLUDED.nav_visibility,
  nav_end_match     = EXCLUDED.nav_end_match,
  nav_has_mark      = EXCLUDED.nav_has_mark,
  group_position    = EXCLUDED.group_position,
  nav_test_id       = EXCLUDED.nav_test_id,
  updated_at        = NOW();
