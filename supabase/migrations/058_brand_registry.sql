-- ────────────────────────────────────────────────────────────────────
-- 058_brand_registry.sql — Structured Curatorial Data™ foundation.
--
-- Quattro nuove tabelle per trasformare MOOD da media uploader a sistema
-- operativo curatoriale:
--   • brands              — Brand Registry™ (Minotti, Poliform, …)
--   • brand_collections   — Collections Registry™ (FK brand_id)
--   • tag_registry        — Normalized tag dedup + synonyms
--   • product_usage_events — Product Intelligence™ analytics foundation
-- ────────────────────────────────────────────────────────────────────

-- ── 1. BRAND REGISTRY™ ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- NULL = brand globale curato (visibile a tutti i tenant)
    -- valorizzato = brand privato dello studio (visibile solo a quel tenant)

  -- Identità
  name                   TEXT NOT NULL,
  slug                   TEXT NOT NULL,           -- minotti, poliform, b-and-b-italia
  category               TEXT,                    -- arredi | illuminazione | pietra_naturale | …
  country                TEXT,                    -- 'IT', 'FR', …
  website                TEXT,
  logo_url               TEXT,
  palette                JSONB NOT NULL DEFAULT '[]',  -- ['#0b0b0b','#cbb27e',…]

  -- Positioning curatoriale (NO percentuali esposte in UI, sono pesi 0-100 per ranking interno)
  positioning            TEXT,           -- 'editorial luxury' | 'design contemporaneo' | …
  luxury_tier            TEXT,           -- 'icon' | 'premium' | 'contemporary' | 'accessible'
  hospitality_score      INTEGER NOT NULL DEFAULT 0 CHECK (hospitality_score BETWEEN 0 AND 100),
  residential_score      INTEGER NOT NULL DEFAULT 0 CHECK (residential_score BETWEEN 0 AND 100),
  contract_score         INTEGER NOT NULL DEFAULT 0 CHECK (contract_score BETWEEN 0 AND 100),
  retail_score           INTEGER NOT NULL DEFAULT 0 CHECK (retail_score BETWEEN 0 AND 100),
  primary_markets        JSONB NOT NULL DEFAULT '[]',  -- ['italy_milano','usa_miami',…]

  -- Stato curatoriale
  agreement_status       TEXT NOT NULL DEFAULT 'unverified',
    -- 'unverified' | 'partner' | 'official_distributor' | 'public_reference'
  visibility_level       TEXT NOT NULL DEFAULT 'studio_private',
    -- 'studio_private' (visibile solo al tenant) | 'curated_public' (curated by MOOD)
  asset_pack_available   BOOLEAN NOT NULL DEFAULT FALSE,
  catalog_sync_enabled   BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit
  created_by             UUID,
  approved_by            UUID,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Slug deve essere unico per scope (curated_public globale ha tenant_id NULL).
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_brands_visibility ON brands (visibility_level, name);
CREATE INDEX IF NOT EXISTS idx_brands_tenant     ON brands (tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_brands_name_lower ON brands (LOWER(name));

COMMENT ON TABLE brands IS 'Brand Registry™ — produttori normalizzati (curated_public globali o studio_private).';


-- ── 2. COLLECTIONS REGISTRY™ ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_collections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  tenant_id           UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- NULL → collection condivisa fra studi che usano lo stesso brand_id
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL,
  year                INTEGER,
  season              TEXT,            -- 'Spring' | 'Outdoor' | 'Permanent'
  category            TEXT,            -- override del brand.category quando serve
  description         TEXT,
  catalog_cover_url   TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (brand_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_brand_collections_brand ON brand_collections (brand_id, is_active);

COMMENT ON TABLE brand_collections IS 'Collezioni dei brand (FK Brand Registry™). Le Cultural Editions™ e i Product Inspirations™ si riferiscono qui.';


-- ── 3. TAG REGISTRY™ ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tag_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- NULL → tag curato globale (es. atmosphere predefinite)
  slug            TEXT NOT NULL,            -- normalized: 'minotti', 'sobrio', 'noce_canaletto'
  label           TEXT NOT NULL,            -- form leggibile: 'Minotti', 'Sobrio', 'Noce Canaletto'
  type            TEXT NOT NULL,
    -- 'brand' | 'atmosphere' | 'material' | 'style' | 'room_type' | 'cultural'
  synonyms        JSONB NOT NULL DEFAULT '[]',   -- ['minotti spa', 'MINOTTI', 'minotti s.p.a.']
  approved        BOOLEAN NOT NULL DEFAULT FALSE,
  usage_count     INTEGER NOT NULL DEFAULT 0,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, type, slug)
);

CREATE INDEX IF NOT EXISTS idx_tag_registry_type ON tag_registry (type, approved, usage_count DESC);

COMMENT ON TABLE tag_registry IS 'Tag Registry™ — normalizzazione + synonyms. Sostituisce gradualmente i tag liberi.';


-- ── 4. PRODUCT INTELLIGENCE EVENTS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS product_usage_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL,        -- media_library.id (Product Inspiration™)
  brand_id        UUID,                 -- FK brands.id (denormalized for fast aggregation)
  project_id      UUID,                 -- FK projects.id (nullable)
  moodboard_id    UUID,                 -- FK moodboards.id (nullable)
  edition_id      UUID,                 -- FK cultural_edition_drafts.id (nullable)
  market_code     TEXT,                 -- es. 'usa_miami'
  usage_type      TEXT NOT NULL,
    -- 'added_to_moodboard' | 'added_to_project' | 'used_in_cultural_edition'
    -- | 'used_in_presentation' | 'used_in_magazine'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_usage_product ON product_usage_events (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_usage_brand   ON product_usage_events (brand_id, market_code);
CREATE INDEX IF NOT EXISTS idx_product_usage_tenant  ON product_usage_events (tenant_id, created_at DESC);

COMMENT ON TABLE product_usage_events IS 'Product Intelligence™ — analytics foundation. Eventi di utilizzo Product Inspirations™ per future query (brand più usati a Miami, ecc.).';


-- ── 5. SUPPLIER_CATALOGS extensions ──────────────────────────────────
ALTER TABLE supplier_catalogs
  ADD COLUMN IF NOT EXISTS brand_id      UUID REFERENCES brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES brand_collections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_catalogs_brand_id ON supplier_catalogs (brand_id);
