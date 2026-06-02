-- ITER194 · MULTI-PDF BRAND CATALOG INGESTION WORKSPACE
-- ─────────────────────────────────────────────────────────────────────
-- Migration: 119_iter194_brand_catalog_ingestion.sql
--
-- Purpose: extend the existing single-PDF Knowledge Factory with a
-- unified workspace where a SuperAdmin can:
--   1. group multiple manufacturer PDFs under a "Catalog Set" for one brand
--   2. run a unified extraction pipeline across all PDFs in the set
--   3. obtain a Unified Brand Index (collections, products, finishes,
--      materials, designers) deduplicated across the whole set
--   4. validate page-by-page through a Validation Dashboard before publish
--
-- Coexists with:
--   • brands                  (058_brand_registry)            ← REUSED
--   • source_documents        (116)                            ← REUSED
--   • brand_import_sessions   (117)                            ← legacy parallel flow
--   • materials/designers/collections_canonical (117)          ← used as merge targets
--
-- New tables (idempotent CREATE IF NOT EXISTS):
--   1. brand_catalog_sets            · root entity (a workspace per batch)
--   2. brand_catalog_documents       · per-PDF in a set (FK→source_documents)
--   3. brand_catalog_pages           · page-level extraction (visual_role, text)
--   4. brand_detected_entities       · unified brand index entry + confidence
--   5. brand_entity_relations        · graph edges between detected entities
-- ─────────────────────────────────────────────────────────────────────

-- §1 · brand_catalog_sets ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_catalog_sets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id                 UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  slug                     TEXT,
  description              TEXT,
  status                   TEXT NOT NULL DEFAULT 'draft',
    -- 'draft' | 'uploading' | 'extracting' | 'needs_review' | 'validated' | 'published' | 'archived'
  document_count           INTEGER NOT NULL DEFAULT 0,
  documents_extracted      INTEGER NOT NULL DEFAULT 0,
  documents_failed         INTEGER NOT NULL DEFAULT 0,
  total_pages              INTEGER NOT NULL DEFAULT 0,
  pages_processed          INTEGER NOT NULL DEFAULT 0,
  extraction_progress      NUMERIC(5,2) NOT NULL DEFAULT 0.00,  -- 0.00 .. 100.00
  -- Unified Brand Index summary (denormalized for fast dashboard reads):
  --   { collections:N, products:N, finishes:N, materials:N, designers:N,
  --     needs_review:N, auto_merged:N }
  index_summary            JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Per-document quick status map: { [doc_id]: 'pending'|'extracting'|'review'|'failed' }
  documents_status         JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Linkage to the legacy ITER192 session if the set was bootstrapped from one
  brand_import_session_id  UUID NULL REFERENCES brand_import_sessions(id) ON DELETE SET NULL,
  extraction_started_at    TIMESTAMPTZ,
  extraction_completed_at  TIMESTAMPTZ,
  validated_at             TIMESTAMPTZ,
  validated_by             UUID,
  published_at             TIMESTAMPTZ,
  published_by             UUID,
  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by               UUID,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, brand_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_bcs_tenant   ON brand_catalog_sets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bcs_brand    ON brand_catalog_sets(brand_id);
CREATE INDEX IF NOT EXISTS idx_bcs_status   ON brand_catalog_sets(tenant_id, status);

COMMENT ON TABLE brand_catalog_sets IS
  'ITER194 · Multi-PDF Brand Catalog Set — root workspace per brand ingestion batch.';


-- §2 · brand_catalog_documents ────────────────────────────────────────
-- One row per PDF inside a set. Wraps source_documents (the reusable
-- extraction unit) to keep the legacy single-PDF flow intact.
CREATE TABLE IF NOT EXISTS brand_catalog_documents (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  catalog_set_id           UUID NOT NULL REFERENCES brand_catalog_sets(id) ON DELETE CASCADE,
  brand_id                 UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  source_document_id       UUID NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  display_name             TEXT,
  original_filename        TEXT,
  catalog_type             TEXT NOT NULL DEFAULT 'catalog',
    -- 'catalog' | 'lookbook' | 'price_list' | 'spec_sheet' | 'brochure'
  catalog_year             INTEGER,
  language                 TEXT,                       -- 'it' | 'en' | 'multi'
  pdf_url                  TEXT,
  storage_path             TEXT,
  page_count               INTEGER,
  pages_processed          INTEGER NOT NULL DEFAULT 0,
  extraction_status        TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'extracting' | 'review' | 'validated' | 'failed'
  extraction_started_at    TIMESTAMPTZ,
  extraction_completed_at  TIMESTAMPTZ,
  metrics                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_logs               JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order               INTEGER NOT NULL DEFAULT 0,
  created_by               UUID,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (catalog_set_id, source_document_id)
);

CREATE INDEX IF NOT EXISTS idx_bcd_set    ON brand_catalog_documents(catalog_set_id);
CREATE INDEX IF NOT EXISTS idx_bcd_brand  ON brand_catalog_documents(brand_id);
CREATE INDEX IF NOT EXISTS idx_bcd_source ON brand_catalog_documents(source_document_id);
CREATE INDEX IF NOT EXISTS idx_bcd_status ON brand_catalog_documents(tenant_id, extraction_status);

COMMENT ON TABLE brand_catalog_documents IS
  'ITER194 · Per-PDF row inside a Brand Catalog Set, wraps source_documents.';


-- §3 · brand_catalog_pages ────────────────────────────────────────────
-- Page-level extraction record. One row per PDF page so the Validation
-- Dashboard can iterate page-by-page with visual_role + extracted entities.
CREATE TABLE IF NOT EXISTS brand_catalog_pages (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  catalog_set_id           UUID NOT NULL REFERENCES brand_catalog_sets(id) ON DELETE CASCADE,
  catalog_document_id      UUID NOT NULL REFERENCES brand_catalog_documents(id) ON DELETE CASCADE,
  source_document_id       UUID NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  brand_id                 UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  page_number              INTEGER NOT NULL,
  -- Visual role inferred by section_detector / vision classifier
  visual_role              TEXT NOT NULL DEFAULT 'unknown',
    -- 'cover' | 'index' | 'section_opener' | 'product_spread' | 'lifestyle'
    -- | 'technical_drawing' | 'finishes_table' | 'composition'
    -- | 'brand_story' | 'unknown'
  page_title               TEXT,
  detected_collection      TEXT,
  detected_section         TEXT,
  -- Raw text extracted from the page (used by entity detection)
  raw_text                 TEXT,
  -- Image refs captured on this page (asset URLs / pHashes)
  asset_refs               JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Lightweight inline entity list discovered in-page (resolved separately
  -- into brand_detected_entities for the unified index)
  inline_entities          JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Per-page review state
  review_status            TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'needs_review' | 'validated' | 'skipped'
  review_notes             TEXT,
  confidence_score         NUMERIC(4,3),
  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by              UUID,
  reviewed_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (catalog_document_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_bcp_set    ON brand_catalog_pages(catalog_set_id);
CREATE INDEX IF NOT EXISTS idx_bcp_doc    ON brand_catalog_pages(catalog_document_id, page_number);
CREATE INDEX IF NOT EXISTS idx_bcp_review ON brand_catalog_pages(catalog_set_id, review_status);
CREATE INDEX IF NOT EXISTS idx_bcp_role   ON brand_catalog_pages(catalog_set_id, visual_role);

COMMENT ON TABLE brand_catalog_pages IS
  'ITER194 · Page-level extraction row enabling per-page validation review.';


-- §4 · brand_detected_entities ────────────────────────────────────────
-- The Unified Brand Index. Each row is a deduplicated entity discovered
-- across the whole catalog set. Confidence-based merge policy:
--   • confidence >= 0.85 → status='auto_merged'  (no manual review needed)
--   • 0.60 <= conf < 0.85 → status='needs_review' (resolver shows duplicates)
--   • confidence <  0.60 → status='separate'      (kept distinct)
CREATE TABLE IF NOT EXISTS brand_detected_entities (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  catalog_set_id           UUID NOT NULL REFERENCES brand_catalog_sets(id) ON DELETE CASCADE,
  brand_id                 UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  entity_type              TEXT NOT NULL,
    -- 'collection' | 'composition' | 'product' | 'finish' | 'material'
    -- | 'designer' | 'accessory' | 'mirror' | 'washbasin' | 'tap'
  entity_key               TEXT NOT NULL,       -- canonical_slug for dedup
  display_name             TEXT NOT NULL,
  aliases                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Cross-document evidence
  source_document_ids      JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_page_ids          JSONB NOT NULL DEFAULT '[]'::jsonb,
  mention_count            INTEGER NOT NULL DEFAULT 0,
  -- Detection confidence (combined across mentions)
  confidence_score         NUMERIC(4,3) NOT NULL DEFAULT 0.000,
  -- Merge / review lifecycle
  status                   TEXT NOT NULL DEFAULT 'detected',
    -- 'detected' | 'auto_merged' | 'needs_review' | 'separate'
    -- | 'merged_into' | 'rejected' | 'validated'
  merged_into_id           UUID NULL REFERENCES brand_detected_entities(id) ON DELETE SET NULL,
  -- Optional pointer to the legacy canonical row (materials_canonical etc.)
  canonical_ref_table      TEXT,
  canonical_ref_id         UUID,
  -- Free-form payload (dimensions, color, finishes list, etc.)
  attributes               JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviewed_by              UUID,
  reviewed_at              TIMESTAMPTZ,
  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (catalog_set_id, entity_type, entity_key)
);

CREATE INDEX IF NOT EXISTS idx_bde_set        ON brand_detected_entities(catalog_set_id);
CREATE INDEX IF NOT EXISTS idx_bde_type       ON brand_detected_entities(catalog_set_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_bde_status     ON brand_detected_entities(catalog_set_id, status);
CREATE INDEX IF NOT EXISTS idx_bde_brand_type ON brand_detected_entities(brand_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_bde_key_lower  ON brand_detected_entities(brand_id, entity_type, LOWER(entity_key));

COMMENT ON TABLE brand_detected_entities IS
  'ITER194 · Unified Brand Index entry. Confidence-thresholded dedup across the Catalog Set.';


-- §5 · brand_entity_relations ─────────────────────────────────────────
-- Graph edges between detected entities (collection→product, product→finish,
-- product→material, product→designer, composition→products, etc.)
CREATE TABLE IF NOT EXISTS brand_entity_relations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  catalog_set_id           UUID NOT NULL REFERENCES brand_catalog_sets(id) ON DELETE CASCADE,
  brand_id                 UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  source_entity_id         UUID NOT NULL REFERENCES brand_detected_entities(id) ON DELETE CASCADE,
  target_entity_id         UUID NOT NULL REFERENCES brand_detected_entities(id) ON DELETE CASCADE,
  relation_type            TEXT NOT NULL,
    -- 'contains' (collection→product) | 'has_finish' | 'has_material'
    -- | 'designed_by' | 'includes_component' | 'belongs_to_composition'
    -- | 'available_in' | 'paired_with'
  evidence                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_score         NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (catalog_set_id, source_entity_id, target_entity_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_ber_set      ON brand_entity_relations(catalog_set_id);
CREATE INDEX IF NOT EXISTS idx_ber_source   ON brand_entity_relations(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_ber_target   ON brand_entity_relations(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_ber_type     ON brand_entity_relations(catalog_set_id, relation_type);

COMMENT ON TABLE brand_entity_relations IS
  'ITER194 · Graph edges between brand_detected_entities (collection→product, etc.).';


-- §6 · GRANT service_role ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT ALL ON brand_catalog_sets,brand_catalog_documents,brand_catalog_pages,brand_detected_entities,brand_entity_relations TO service_role';
  END IF;
END $$;


-- §7 · schema_migrations bookkeeping ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO public.schema_migrations(version)
  VALUES ('119_iter194_brand_catalog_ingestion.sql')
  ON CONFLICT (version) DO NOTHING;

-- ── End of 119_iter194_brand_catalog_ingestion.sql ───────────────────
