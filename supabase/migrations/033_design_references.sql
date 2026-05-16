-- ─────────────────────────────────────────────────────────────────────────
-- Phase P0.3.A — Cultural Design Intelligence™ Foundation.
--
-- External design references are NOT media uploads or social pins.
-- They are contextualized design signals that evolve project direction,
-- strategic positioning, material language, and advisor interpretation.
--
-- Three core tables:
--   1. design_references                  — core intelligence entity
--   2. reference_locale_interpretations   — cultural intelligence engine
--   3. reference_collections              — curated editorial directions
--   + reference_collection_items          — join table for collections
--
-- ABSOLUTE RULES (encoded in schema):
--   • editorial_status defaults to 'processing_editorial_reading' —
--     references MUST NOT become visible until interpretation exists.
--   • UNIQUE (reference_id, locale) on interpretations so a given
--     reference can carry one editorial reading per locale.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. design_references ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS design_references (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id            UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- Provenance
  source_type           TEXT NOT NULL DEFAULT 'upload',
                        -- upload | pinterest | external_url | curator_pick
  source_url            TEXT,
  imported_image_url    TEXT NOT NULL,
  curator_name          TEXT,
  locale_origin         TEXT,
                        -- e.g. EN_AE / IT_IT — the locale "this reference reads to"

  -- Editorial gating — references stay hidden until interpretation lands
  editorial_status      TEXT NOT NULL DEFAULT 'processing_editorial_reading',
                        -- processing_editorial_reading | ready | archived | rejected

  -- Future intelligence fields (foundational, nullable today)
  design_intent         TEXT,
  emotional_direction   TEXT,
  project_relevance     TEXT,
  advisor_notes         TEXT,
  material_affinity     TEXT,

  -- Audit
  created_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_references_tenant_status
  ON design_references(tenant_id, editorial_status);
CREATE INDEX IF NOT EXISTS idx_design_references_project
  ON design_references(project_id);
CREATE INDEX IF NOT EXISTS idx_design_references_tenant_created
  ON design_references(tenant_id, created_at DESC);


-- ── 2. reference_locale_interpretations ────────────────────────────────
-- The cultural intelligence engine. NOT metadata — design intelligence.
-- One row per (reference_id, locale). Same reference, completely
-- different editorial reading across EN_US / EN_GB / EN_AE / DE_DE.
CREATE TABLE IF NOT EXISTS reference_locale_interpretations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reference_id           UUID NOT NULL REFERENCES design_references(id) ON DELETE CASCADE,
  locale                 TEXT NOT NULL,

  -- Cultural reading fields
  atmosphere             TEXT,
  material_language      TEXT,
  hospitality_level      TEXT,
  architectural_tone     TEXT,
  emotional_positioning  TEXT,
  market_fit_score       NUMERIC(5,2),

  -- The senior-curator editorial reading (luxury, strategic, never AI-labelled)
  editorial_reading      TEXT,

  -- Provenance
  created_by_system      BOOLEAN NOT NULL DEFAULT TRUE,
  generated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (reference_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_reference_locale_interpretations_ref
  ON reference_locale_interpretations(reference_id);
CREATE INDEX IF NOT EXISTS idx_reference_locale_interpretations_tenant_locale
  ON reference_locale_interpretations(tenant_id, locale);


-- ── 3. reference_collections ───────────────────────────────────────────
-- Curated editorial directions. NOT folders, NOT boards.
CREATE TABLE IF NOT EXISTS reference_collections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advisor_id            UUID,

  title                 TEXT NOT NULL,
  subtitle              TEXT,
  atmosphere_direction  TEXT,
  project_vertical      TEXT,
                        -- residential | hospitality | retail | wellness | …
  market_focus          TEXT,
                        -- locale_code primarily addressed by this direction

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reference_collections_tenant
  ON reference_collections(tenant_id, created_at DESC);


-- ── 4. reference_collection_items (join) ───────────────────────────────
-- Soft membership: a reference can sit in multiple collections.
CREATE TABLE IF NOT EXISTS reference_collection_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  collection_id         UUID NOT NULL REFERENCES reference_collections(id) ON DELETE CASCADE,
  reference_id          UUID NOT NULL REFERENCES design_references(id) ON DELETE CASCADE,
  added_by              UUID,
  added_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (collection_id, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_reference_collection_items_collection
  ON reference_collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_reference_collection_items_reference
  ON reference_collection_items(reference_id);
