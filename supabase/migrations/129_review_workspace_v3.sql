-- ─────────────────────────────────────────────────────────────────────
-- 129 · REVIEW WORKSPACE™ V3 — FUTURE USES + KNOWLEDGE IMPACT + PROJECT IMPACT
-- ─────────────────────────────────────────────────────────────────────
-- Purpose: foundation for Review Workspace™ V3 (Brand Knowledge Package
-- → Ecosistema MOOD). Adds three layers without touching any existing
-- table:
--   1. entity_operational_usage  · Single Source of Truth for FUTURE USES™.
--      Polymorphic record of (entity → operational asset) relationships.
--   2. entity_future_uses_v      · aggregated counters per entity.
--   3. knowledge_impact_events   · post-approval ROI ledger (Knowledge Impact).
--   4. entity_project_impact     · M7 PLACEHOLDER (no economic KPIs yet).
--
-- ⚠️  No schema change to: brand_detected_entities, brands,
--     studio_library_items, moodboard_*, design_journey_*, materials_*,
--     designers_*. Pure additive.
-- ─────────────────────────────────────────────────────────────────────


-- §1 · entity_operational_usage ───────────────────────────────────────
-- One row per (entity_type, entity_id) ↔ (asset_type, asset_id).
-- Asset_type enum captures the operational MOOD surfaces.
CREATE TABLE IF NOT EXISTS entity_operational_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
    -- 'product' | 'material' | 'designer' | 'image' | 'brand'
    -- | 'collection' | 'document'
  entity_id       UUID NOT NULL,
  asset_type      TEXT NOT NULL,
    -- 'moodboard' | 'design_journey' | 'material_board'
    -- | 'client_presentation' | 'magazine' | 'social_story'
    -- | 'product_selection' | 'home_staging_pack'
  asset_id        UUID NOT NULL,
  -- optional context (e.g. board page, journey milestone, slide index)
  usage_context   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  UNIQUE (tenant_id, entity_type, entity_id, asset_type, asset_id),
  CONSTRAINT entity_operational_usage_entity_type_chk CHECK (
    entity_type IN (
      'product','material','designer','image','brand',
      'collection','document'
    )
  ),
  CONSTRAINT entity_operational_usage_asset_type_chk CHECK (
    asset_type IN (
      'moodboard','design_journey','material_board',
      'client_presentation','magazine','social_story',
      'product_selection','home_staging_pack'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_eou_entity
  ON entity_operational_usage (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_eou_tenant_entity
  ON entity_operational_usage (tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_eou_asset
  ON entity_operational_usage (asset_type, asset_id);

COMMENT ON TABLE entity_operational_usage IS
  'V3 Review Workspace · Single Source of Truth for FUTURE USES™. '
  'Each row = one (entity → operational asset) link. No duplication, no snapshots.';


-- §2 · entity_future_uses_v ──────────────────────────────────────────
-- Aggregated view: per (tenant, entity_type, entity_id) returns counters
-- for every asset_type. Read-only convenience for the UI.
CREATE OR REPLACE VIEW entity_future_uses_v AS
SELECT
  tenant_id,
  entity_type,
  entity_id,
  COUNT(*) FILTER (WHERE asset_type = 'moodboard')             AS moodboard_count,
  COUNT(*) FILTER (WHERE asset_type = 'design_journey')        AS design_journey_count,
  COUNT(*) FILTER (WHERE asset_type = 'material_board')        AS material_board_count,
  COUNT(*) FILTER (WHERE asset_type = 'client_presentation')   AS client_presentation_count,
  COUNT(*) FILTER (WHERE asset_type = 'magazine')              AS magazine_count,
  COUNT(*) FILTER (WHERE asset_type = 'social_story')          AS social_story_count,
  COUNT(*) FILTER (WHERE asset_type = 'product_selection')     AS product_selection_count,
  COUNT(*) FILTER (WHERE asset_type = 'home_staging_pack')     AS home_staging_pack_count,
  COUNT(*)                                                     AS total_uses
FROM entity_operational_usage
GROUP BY tenant_id, entity_type, entity_id;

COMMENT ON VIEW entity_future_uses_v IS
  'V3 · Aggregated FUTURE USES™ counters per entity (read-only).';


-- §3 · knowledge_impact_events ───────────────────────────────────────
-- Post-approval ROI ledger. One row per AI Validation approve action.
-- Drives the "Impatto sull''Ecosistema MOOD" card.
CREATE TABLE IF NOT EXISTS knowledge_impact_events (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  catalog_set_id                UUID NOT NULL REFERENCES brand_catalog_sets(id) ON DELETE CASCADE,
  -- Target of the correction (the canonical entity that was promoted/merged)
  entity_type                   TEXT NOT NULL,
  entity_id                     UUID NOT NULL,
  -- Scope of the correction
  scope                         TEXT NOT NULL,
    -- 'only_here' | 'catalog' | 'brand'
  -- Inputs
  source_input                  TEXT,           -- e.g. "Walnut"
  canonical_target              TEXT,           -- e.g. "Noce Canaletto"
  -- Counters (Knowledge Impact ROI)
  occurrences_corrected         INTEGER NOT NULL DEFAULT 0,
  products_improved             INTEGER NOT NULL DEFAULT 0,
  images_linked                 INTEGER NOT NULL DEFAULT 0,
  future_moodboards_unlocked    INTEGER NOT NULL DEFAULT 0,
  materials_consolidated        INTEGER NOT NULL DEFAULT 0,
  designers_consolidated        INTEGER NOT NULL DEFAULT 0,
  -- Free-form preview payload (for forward-compatible pre-approval preview)
  preview_payload               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                    UUID,
  CONSTRAINT knowledge_impact_events_scope_chk CHECK (
    scope IN ('only_here','catalog','brand')
  )
);

CREATE INDEX IF NOT EXISTS idx_kie_set
  ON knowledge_impact_events (catalog_set_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kie_entity
  ON knowledge_impact_events (entity_type, entity_id);

COMMENT ON TABLE knowledge_impact_events IS
  'V3 · Post-approval ROI ledger. Drives the Knowledge Impact card.';


-- §4 · entity_project_impact (M7 PLACEHOLDER — no economic KPIs) ─────
-- Foundation for Project Impact™. Stores zero-state placeholders;
-- value_aggregate stays NULL until M7 wires it in.
CREATE TABLE IF NOT EXISTS entity_project_impact (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type         TEXT NOT NULL,
  entity_id           UUID NOT NULL,
  project_type        TEXT NOT NULL,
    -- 'residential' | 'hospitality' | 'retail' | 'office' | 'home_staging'
  project_count       INTEGER NOT NULL DEFAULT 0,
  client_count        INTEGER NOT NULL DEFAULT 0,
  moodboard_count     INTEGER NOT NULL DEFAULT 0,
  journey_count       INTEGER NOT NULL DEFAULT 0,
  -- M7 placeholder — DO NOT populate yet (no economic logic in V3.1)
  value_aggregate     NUMERIC(14,2),
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, entity_type, entity_id, project_type),
  CONSTRAINT entity_project_impact_project_type_chk CHECK (
    project_type IN ('residential','hospitality','retail','office','home_staging')
  )
);

CREATE INDEX IF NOT EXISTS idx_epi_entity
  ON entity_project_impact (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_epi_tenant_entity
  ON entity_project_impact (tenant_id, entity_type, entity_id);

COMMENT ON TABLE entity_project_impact IS
  'V3 · M7 PLACEHOLDER — Project Impact foundation. value_aggregate stays NULL '
  'until M7 (NO economic KPIs in V3.1).';


-- §5 · schema_migrations stamp ───────────────────────────────────────
INSERT INTO schema_migrations (version, applied_at)
VALUES ('129_review_workspace_v3', NOW())
ON CONFLICT (version) DO NOTHING;
