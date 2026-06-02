-- ITER187 · Phase 1 · MOOD Brand Knowledge Factory™
-- ─────────────────────────────────────────────────────────────────────
-- Migration: 116_brand_knowledge_factory_phase1.sql
--
-- Introduces canonical Product Knowledge Objects™ extracted from
-- manufacturer PDFs by the Product Composer pipeline.
--
-- Tables added (idempotent CREATE IF NOT EXISTS):
--   1. source_documents     · audit-grade tracking of every PDF processed
--   2. product_sections     · detected product spreads inside a document
--   3. products             · canonical Product Knowledge Object (PIM seed)
--   4. product_assets       · M2M between products and media_library, with role
--
-- Strategy:
--   • forward-only, no destructive change
--   • NO modification of media_library (assets stay where they live)
--   • Every product is tenant-scoped in Phase 1 (curated_public promotion = Phase 2)
--   • Product is engineered as a Knowledge Object™ reusable by Marketboard,
--     Moodboard, Academy, Magazine, Specification. Future-facing fields kept
--     nullable in Phase 1 (usage_contexts, suggested_applications, mood_tags,
--     market_tags, spec_ready, academy_ready, content_ready).
-- ─────────────────────────────────────────────────────────────────────

-- §1 · source_documents ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS source_documents (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id                 UUID NULL REFERENCES brands(id) ON DELETE SET NULL,
  supplier_catalog_id      UUID NULL REFERENCES supplier_catalogs(id) ON DELETE SET NULL,
  file_id                  UUID NULL,        -- soft ref to media_library.id (PDF row)
  original_filename        TEXT,
  document_type            TEXT NOT NULL DEFAULT 'catalog',
    -- 'catalog' | 'spec_sheet' | 'brand_brochure' | 'lookbook' | 'price_list'
  page_count               INTEGER,
  extraction_status        TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'extracting' | 'sections_detected' | 'review' | 'approved' | 'failed'
  extraction_started_at    TIMESTAMPTZ,
  extraction_completed_at  TIMESTAMPTZ,
  processing_logs          JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_logs               JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics                  JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- {products_detected, assets_extracted, dedup_groups, dimensions_hit, materials_hit, avg_confidence}
  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by               UUID,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_documents_tenant
  ON source_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_source_documents_brand
  ON source_documents(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_source_documents_status
  ON source_documents(tenant_id, extraction_status);
CREATE INDEX IF NOT EXISTS idx_source_documents_catalog
  ON source_documents(supplier_catalog_id) WHERE supplier_catalog_id IS NOT NULL;

COMMENT ON TABLE source_documents IS
  'ITER187 · Audit-grade tracking of every PDF processed by the Product Composer pipeline.';


-- §2 · product_sections ───────────────────────────────────────────────
-- Detected product spreads inside a document. Created BEFORE products
-- so an admin can re-run product composition without losing the layout.
CREATE TABLE IF NOT EXISTS product_sections (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id       UUID NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  section_index            INTEGER NOT NULL,
  start_page               INTEGER NOT NULL,
  end_page                 INTEGER NOT NULL,
  detected_title           TEXT,
  detected_designer        TEXT,
  detected_category        TEXT,
  raw_text                 TEXT,
  product_id               UUID NULL,        -- soft ref (set when product created)
  confidence_score         NUMERIC(4,3),     -- 0.000-1.000
  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_sections_doc
  ON product_sections(source_document_id, section_index);
CREATE INDEX IF NOT EXISTS idx_product_sections_tenant
  ON product_sections(tenant_id);

COMMENT ON TABLE product_sections IS
  'ITER187 · Multi-page product spreads detected inside a source_document. Pre-composition stage.';


-- §3 · products (canonical Product Knowledge Object™) ─────────────────
CREATE TABLE IF NOT EXISTS products (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id                 UUID NULL REFERENCES brands(id) ON DELETE SET NULL,
  source_document_id       UUID NULL REFERENCES source_documents(id) ON DELETE SET NULL,
  source_section_id        UUID NULL,        -- soft ref to product_sections.id

  -- Identity
  product_name             TEXT NOT NULL,
  slug                     TEXT NOT NULL,
  category_id              UUID NULL,        -- FK tag_registry (Phase 2)
  category_label           TEXT,             -- denormalized fallback for Phase 1
  designer_name            TEXT,

  -- Descriptive
  description              TEXT,
  description_i18n         JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- { "it": "...", "en": "...", "fr": "..." }
  materials                JSONB NOT NULL DEFAULT '[]'::jsonb,
  finishes                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  dimensions_raw           JSONB NOT NULL DEFAULT '[]'::jsonb,
  dimensions_structured    JSONB NOT NULL DEFAULT '{}'::jsonb,
  applications             JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_pages             JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- ── Product Knowledge Object™ fields (Phase 1 seed, populated later) ──
  usage_contexts           JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- ["residential", "hospitality", "contract", "outdoor"]
  suggested_applications   JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- editorial suggestions: ["lobby", "lounge", "private_dining"]
  mood_tags                JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Mood/Atmosphere descriptors: ["minimalist", "warm", "monolithic"]
  market_tags              JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Market targeting: ["luxury", "boutique_hotel", "high_end_residential"]
  spec_ready               BOOLEAN NOT NULL DEFAULT FALSE,
    -- True when fields meet Specification Sheet minimum: name+dims+materials+designer
  academy_ready            BOOLEAN NOT NULL DEFAULT FALSE,
    -- True when there is description IT/EN + designer + ≥1 ambient image
  content_ready            BOOLEAN NOT NULL DEFAULT FALSE,
    -- True when there is ≥1 hero asset + description + mood_tags or market_tags

  -- Quality & review
  confidence_score         NUMERIC(4,3),     -- composite extraction confidence
  review_status            TEXT NOT NULL DEFAULT 'draft',
    -- 'draft' | 'review' | 'approved' | 'rejected' | 'merged'
  merged_into_id           UUID NULL REFERENCES products(id) ON DELETE SET NULL,
  reviewed_by              UUID,
  reviewed_at              TIMESTAMPTZ,
  rejection_reason         TEXT,

  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, brand_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant
  ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_brand
  ON products(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_source_doc
  ON products(source_document_id) WHERE source_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_review_status
  ON products(tenant_id, review_status);
CREATE INDEX IF NOT EXISTS idx_products_designer
  ON products(designer_name) WHERE designer_name IS NOT NULL;

COMMENT ON TABLE products IS
  'ITER187 · Canonical Product Knowledge Object™. Tenant-scoped in Phase 1. Reusable by Marketboard / Moodboard / Academy / Magazine / Specification.';


-- §4 · product_assets ─────────────────────────────────────────────────
-- M2M between products and media_library, with image role + dedup group
CREATE TABLE IF NOT EXISTS product_assets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id               UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  asset_id                 UUID NOT NULL,    -- soft ref to media_library.id
  role                     TEXT NOT NULL,
    -- 'hero' | 'ambient' | 'still_life' | 'detail' | 'texture' | 'technical'
    -- | 'finish' | 'drawing' | 'packshot' | 'logo' | 'decorative'
  page_number              INTEGER,
  source_document_id       UUID NULL REFERENCES source_documents(id) ON DELETE SET NULL,
  confidence_score         NUMERIC(4,3),
  is_primary               BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order               INTEGER NOT NULL DEFAULT 0,
  similarity_group         TEXT,             -- perceptual hash group key
  phash                    TEXT,             -- raw perceptual hash (hex)
  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, asset_id, role)
);

CREATE INDEX IF NOT EXISTS idx_product_assets_product
  ON product_assets(product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_assets_asset
  ON product_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_product_assets_role
  ON product_assets(product_id, role);
CREATE INDEX IF NOT EXISTS idx_product_assets_similarity
  ON product_assets(similarity_group) WHERE similarity_group IS NOT NULL;

COMMENT ON TABLE product_assets IS
  'ITER187 · M2M Product ↔ media_library with image role (hero/ambient/still_life/…) and perceptual dedup group.';


-- §5 · GRANT service_role ─────────────────────────────────────────────
-- Tables are accessed by backend via service_role (RLS bypass). No
-- direct anon/authenticated grants in Phase 1.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT ALL ON source_documents,product_sections,products,product_assets TO service_role';
  END IF;
END $$;


-- §6 · tenant_settings feature flag ───────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'settings'
  ) THEN
    UPDATE tenants
       SET settings = COALESCE(settings, '{}'::jsonb)
                      || '{"knowledge_factory_v1": true}'::jsonb,
           updated_at = NOW()
     WHERE COALESCE(settings, '{}'::jsonb) ? 'knowledge_factory_v1' = false;
  END IF;
END $$;


-- ── End of 116_brand_knowledge_factory_phase1.sql ────────────────────
