-- ITER192 · Phase 1 · MOOD Founding Brands Program™
-- ─────────────────────────────────────────────────────────────────────
-- Migration: 117_iter192_brand_import_sessions.sql
--
-- Introduces multi-PDF Brand Import Sessions that aggregate N source_documents
-- under one brand into a unified Brand Knowledge Package™.
--
-- New tables (idempotent):
--   1. brand_import_sessions   · root entity
--   2. materials_canonical     · entity resolution target (Kauri, Cedro, Oak…)
--   3. designers_canonical     · entity resolution target (Patricia Urquiola…)
--   4. collections_canonical   · entity resolution target (Raw Edition…)
--   5. stories_canonical       · 10 themes: sustainability, heritage, craftsmanship,
--                                innovation, material_culture, family_business,
--                                design_collaboration, hospitality, outdoor_living,
--                                customization
--   6. vision_cache            · hybrid scope (per-tenant default + global for
--                                curated_public assets)
--
-- Alters:
--   • source_documents.brand_import_session_id  (FK linkage)
--   • products.brand_import_session_id          (FK linkage)
--   • products.canonical_material_ids JSONB     (M:N to materials_canonical)
--   • products.canonical_designer_id            (FK)
--   • products.canonical_collection_id          (FK)
-- ─────────────────────────────────────────────────────────────────────

-- §1 · brand_import_sessions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_import_sessions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id                 UUID NULL REFERENCES brands(id) ON DELETE SET NULL,
  session_name             TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'open',
    -- 'open' | 'processing' | 'completed' | 'failed' | 'archived'
  document_count           INTEGER NOT NULL DEFAULT 0,
  documents_processed      INTEGER NOT NULL DEFAULT 0,
  documents_failed         INTEGER NOT NULL DEFAULT 0,
  metrics                  JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- { products, materials, designers, collections, stories, assets,
    --   vision_cache_hits, vision_cache_misses }
  package_score            JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- { product_completeness, material_completeness, story_completeness,
    --   academy_readiness, magazine_readiness, marketboard_readiness,
    --   moodboard_readiness, specification_readiness, overall }
  knowledge_package        JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- denormalized assembled package for fast dashboard reads
  processing_started_at    TIMESTAMPTZ,
  processing_completed_at  TIMESTAMPTZ,
  processing_logs          JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_logs               JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by               UUID,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bis_tenant ON brand_import_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bis_brand ON brand_import_sessions(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bis_status ON brand_import_sessions(tenant_id, status);


-- §2 · source_documents ↔ brand_import_session ─────────────────────────
ALTER TABLE source_documents
  ADD COLUMN IF NOT EXISTS brand_import_session_id UUID NULL
    REFERENCES brand_import_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_source_documents_session
  ON source_documents(brand_import_session_id) WHERE brand_import_session_id IS NOT NULL;


-- §3 · materials_canonical ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS materials_canonical (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NULL,                -- NULL = global library
  brand_id              UUID NULL REFERENCES brands(id) ON DELETE SET NULL,
  material_key          TEXT NOT NULL,
  display_name          TEXT,
  origin                TEXT,
  geography             JSONB NOT NULL DEFAULT '{}'::jsonb,
  sustainability_story  TEXT,
  processing_story      TEXT,
  applications          JSONB NOT NULL DEFAULT '[]'::jsonb,
  emotional_keywords    JSONB NOT NULL DEFAULT '[]'::jsonb,
  academy_topics        JSONB NOT NULL DEFAULT '[]'::jsonb,
  market_positioning    TEXT,
  description_i18n      JSONB NOT NULL DEFAULT '{}'::jsonb,
  mention_count         INTEGER NOT NULL DEFAULT 0,
  source_document_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence              JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_score      NUMERIC(4,3),
  metadata_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, brand_id, material_key)
);

CREATE INDEX IF NOT EXISTS idx_materials_tenant_brand
  ON materials_canonical(tenant_id, brand_id);
CREATE INDEX IF NOT EXISTS idx_materials_key
  ON materials_canonical(material_key);


-- §4 · designers_canonical ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS designers_canonical (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NULL,
  brand_id              UUID NULL REFERENCES brands(id) ON DELETE SET NULL,
  designer_key          TEXT NOT NULL,
  display_name          TEXT,
  bio                   TEXT,
  bio_i18n              JSONB NOT NULL DEFAULT '{}'::jsonb,
  studio                TEXT,
  nationality           TEXT,
  mention_count         INTEGER NOT NULL DEFAULT 0,
  product_count         INTEGER NOT NULL DEFAULT 0,
  collection_count      INTEGER NOT NULL DEFAULT 0,
  source_document_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, designer_key)
);

CREATE INDEX IF NOT EXISTS idx_designers_tenant
  ON designers_canonical(tenant_id);


-- §5 · collections_canonical ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collections_canonical (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NULL,
  brand_id              UUID NULL REFERENCES brands(id) ON DELETE CASCADE,
  collection_key        TEXT NOT NULL,
  display_name          TEXT,
  year                  INTEGER,
  description           TEXT,
  product_count         INTEGER NOT NULL DEFAULT 0,
  source_document_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, brand_id, collection_key)
);

CREATE INDEX IF NOT EXISTS idx_collections_brand
  ON collections_canonical(brand_id);


-- §6 · stories_canonical ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stories_canonical (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NULL,
  brand_id              UUID NULL REFERENCES brands(id) ON DELETE CASCADE,
  theme                 TEXT NOT NULL,
    -- 10 themes (ITER192):
    --   sustainability | heritage | craftsmanship | innovation |
    --   material_culture | family_business | design_collaboration |
    --   hospitality | outdoor_living | customization
  title                 TEXT,
  body                  TEXT,
  body_i18n             JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence              JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_document_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_score      NUMERIC(4,3),
  metadata_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, brand_id, theme, title)
);

CREATE INDEX IF NOT EXISTS idx_stories_brand_theme
  ON stories_canonical(brand_id, theme);


-- §7 · vision_cache (hybrid scope) ────────────────────────────────────
-- Founder decision (ITER192): default per-tenant, but assets sourced from
-- Official Brand Package™ / curated_public live in a shared global cache.
-- Scope is encoded directly in the cache key.
--
-- Key conventions:
--   • Tenant-scoped: phash="<phash>::tenant:<tenant_id>"
--   • Global / curated_public: phash="<phash>::global"
CREATE TABLE IF NOT EXISTS vision_cache (
  cache_key             TEXT PRIMARY KEY,         -- see encoding above
  phash                 TEXT NOT NULL,            -- raw pHash for grouping queries
  scope                 TEXT NOT NULL DEFAULT 'tenant',  -- 'tenant' | 'global'
  tenant_id             UUID NULL,                -- NULL when scope='global'
  model                 TEXT NOT NULL,
  result_json           JSONB NOT NULL,
  hit_count             INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_hit_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vision_cache_phash ON vision_cache(phash);
CREATE INDEX IF NOT EXISTS idx_vision_cache_scope ON vision_cache(scope);


-- §8 · products cross-references ──────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brand_import_session_id UUID NULL
    REFERENCES brand_import_sessions(id) ON DELETE SET NULL;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS canonical_material_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS canonical_designer_id UUID NULL
    REFERENCES designers_canonical(id) ON DELETE SET NULL;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS canonical_collection_id UUID NULL
    REFERENCES collections_canonical(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_session
  ON products(brand_import_session_id) WHERE brand_import_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_canonical_designer
  ON products(canonical_designer_id) WHERE canonical_designer_id IS NOT NULL;


-- §9 · GRANT service_role ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT ALL ON brand_import_sessions,materials_canonical,designers_canonical,collections_canonical,stories_canonical,vision_cache TO service_role';
  END IF;
END $$;


-- §10 · tenant_settings feature flag ──────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'settings'
  ) THEN
    UPDATE tenants
       SET settings = COALESCE(settings, '{}'::jsonb)
                      || '{"founding_brands_program_v1": true}'::jsonb,
           updated_at = NOW()
     WHERE COALESCE(settings, '{}'::jsonb) ? 'founding_brands_program_v1' = false;
  END IF;
END $$;


COMMENT ON TABLE brand_import_sessions IS
  'ITER192 · 1 brand + N source_documents + 1 Brand Knowledge Package™. Founding Brands Program.';
COMMENT ON TABLE vision_cache IS
  'ITER192 · Hybrid pHash → Vision LLM result. Default per-tenant; global for curated_public.';

-- ── End of 117_iter192_brand_import_sessions.sql ─────────────────────
