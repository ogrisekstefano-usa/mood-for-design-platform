-- =============================================================================
-- ITER157.B · Published Design Journeys™
-- Migration 103 · Public editorial publishing layer
--
-- ARCHITECTURE — strategic separation (never merge):
--   • design_journeys           → live operational relationship layer
--   • portfolio_projects        → portfolio archive layer
--   • published_design_journeys → curated editorial publishing layer  ← THIS
--
-- A Published Design Journey is an editorially frozen snapshot of a
-- completed operational Journey. The operational Journey continues
-- evolving internally; the published version is a curated public
-- artifact — homepage content, design stories, editorial material.
--
-- Publishing is ALWAYS curatorially intentional (never auto-publish).
-- The publish action is initiated by the studio from inside the
-- operational Journey detail.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS published_design_journeys (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Soft links — DO NOT cascade. The Published artifact survives
  -- deletion of the operational layer (editorial permanence).
  design_journey_id     UUID,
  portfolio_project_id  UUID,

  -- Public URL slug (UNIQUE per tenant). Used at /projects/:slug.
  slug                  TEXT NOT NULL,

  -- Canonical authoring locale (BCP-47). All translations cascade
  -- from this baseline via published_design_journey_translations.
  canonical_locale      TEXT NOT NULL DEFAULT 'it-IT',

  -- Editorial spine (canonical locale snapshot)
  title                 TEXT NOT NULL,
  editorial_excerpt     TEXT,
  atmosphere            TEXT,
  project_type          TEXT,     -- 'residential' | 'hospitality' | 'commercial' | 'atelier' | …
  location              TEXT,
  year                  INTEGER,

  -- Visual identity
  hero_asset_id         UUID,                            -- soft FK to cms_assets
  hero_url              TEXT,                            -- denormalised for fast public read
  gallery_asset_ids     UUID[] DEFAULT ARRAY[]::UUID[],

  -- Material vocabulary — array of material tags / brand references
  material_tags         JSONB DEFAULT '[]'::jsonb,

  -- SEO (canonical locale; translations have their own SEO fields)
  seo_title             TEXT,
  seo_description       TEXT,

  -- Curation governance
  visibility_status     TEXT NOT NULL DEFAULT 'draft',
    -- 'draft' | 'published' | 'archived'
  featured_order        INTEGER DEFAULT 0,
  homepage_featured     BOOLEAN DEFAULT FALSE,

  -- Future linkage scaffolding (will resolve in later sprints)
  editorial_article_id  UUID,    -- ITER157.C — link to editorial_articles
  magazine_feature_id   UUID,    -- soft link to magazine_articles
  cultural_edition_id   UUID,    -- soft link to cultural_editions

  -- Lifecycle
  published_at          TIMESTAMPTZ,
  created_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT pdj_slug_unique_per_tenant UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_pdj_tenant
  ON published_design_journeys (tenant_id);

CREATE INDEX IF NOT EXISTS idx_pdj_homepage_feed
  ON published_design_journeys (tenant_id, homepage_featured, featured_order)
  WHERE visibility_status = 'published';

CREATE INDEX IF NOT EXISTS idx_pdj_visibility
  ON published_design_journeys (tenant_id, visibility_status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_pdj_design_journey
  ON published_design_journeys (design_journey_id)
  WHERE design_journey_id IS NOT NULL;


-- =============================================================================
-- Per-locale translation surface
--
-- Each Published Journey has ONE canonical authoring (in the parent row)
-- + N translation rows. The frontend resolves with the chain:
--   tenant override → translation row → canonical locale → fallback.
-- =============================================================================
CREATE TABLE IF NOT EXISTS published_design_journey_translations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  published_journey_id     UUID NOT NULL REFERENCES published_design_journeys(id) ON DELETE CASCADE,
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  locale                   TEXT NOT NULL,    -- BCP-47

  title                    TEXT,
  editorial_excerpt        TEXT,
  atmosphere               TEXT,
  location                 TEXT,
  seo_title                TEXT,
  seo_description          TEXT,

  -- Quality signal — `manual` (human-authored) | `ai` (AI-translated, awaiting review)
  status                   TEXT NOT NULL DEFAULT 'manual',
  generated_by             TEXT,             -- e.g. 'claude-sonnet-4.5' for AI rows

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT pdj_translation_unique UNIQUE (published_journey_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_pdj_tx_lookup
  ON published_design_journey_translations (tenant_id, locale);

COMMIT;
