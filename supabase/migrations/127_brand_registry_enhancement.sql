-- ────────────────────────────────────────────────────────────────────
-- 127_brand_registry_enhancement.sql · MOOD Brand Registry™
-- Multi-category + Tag System foundation (Knowledge Graph™ ready)
--
-- Backward-compatible: `brands.category` (singular) stays untouched
-- for legacy callers. New canonical fields:
--   • brands.categories  JSONB[]  — multi-select categories (slug array)
--   • brands.tag_slugs   JSONB[]  — reusable tags (slug array, FK by slug)
-- Catalog tables:
--   • brand_categories_catalog   — Blueprint-managed, multilingual
--   • tag_registry.is_suggested  — promoted in UI as suggested chips
--
-- Idempotent.
-- ────────────────────────────────────────────────────────────────────

-- ──────────────────────────────────────────────────────────────
-- 1. BRAND CATEGORIES CATALOG (multilingual, Blueprint-managed)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_categories_catalog (
  key            TEXT PRIMARY KEY,
  label_it       TEXT NOT NULL,
  label_en       TEXT NOT NULL,
  description_it TEXT,
  description_en TEXT,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_suggested   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order     INT NOT NULL DEFAULT 100,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bcc_active_idx
  ON brand_categories_catalog (active, sort_order);

-- Seed 18 canonical categories (idempotent)
INSERT INTO brand_categories_catalog
  (key, label_it, label_en, is_suggested, sort_order)
VALUES
  ('arredi',           'Arredi',            'Furniture',           true,  10),
  ('cucine',           'Cucine',            'Kitchens',            true,  20),
  ('bagno',            'Bagno',             'Bathroom',            true,  30),
  ('outdoor',          'Outdoor',           'Outdoor',             true,  40),
  ('lighting',         'Lighting',          'Lighting',            true,  50),
  ('rivestimenti',     'Rivestimenti',      'Surfaces',            true,  60),
  ('porte',            'Porte',             'Doors',               false, 70),
  ('finestre',         'Finestre',          'Windows',             false, 80),
  ('tessili',          'Tessili',           'Textiles',            false, 90),
  ('complementi',      'Complementi',       'Accessories',         true,  100),
  ('contract',         'Contract',          'Contract',            true,  110),
  ('office',           'Office',            'Office',              false, 120),
  ('hospitality',      'Hospitality',       'Hospitality',         true,  130),
  ('wellness',         'Wellness',          'Wellness',            false, 140),
  ('walk_in_closets',  'Cabine Armadio',    'Walk-in Closets',     false, 150),
  ('storage_systems',  'Sistemi Contenimento', 'Storage Systems',  false, 160),
  ('accessories',      'Accessori',         'Accessories',         false, 170),
  ('custom_furniture', 'Arredi su misura',  'Custom Furniture',    false, 180)
ON CONFLICT (key) DO UPDATE SET
  label_it       = EXCLUDED.label_it,
  label_en       = EXCLUDED.label_en,
  is_suggested   = EXCLUDED.is_suggested,
  sort_order     = EXCLUDED.sort_order,
  updated_at     = NOW();


-- ──────────────────────────────────────────────────────────────
-- 2. EXTEND brands · multi-category + tag arrays
-- ──────────────────────────────────────────────────────────────
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS categories JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS tag_slugs  JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS brands_categories_gin
  ON brands USING gin (categories);
CREATE INDEX IF NOT EXISTS brands_tag_slugs_gin
  ON brands USING gin (tag_slugs);

-- Backfill: legacy `category` (singular) → categories[0]
UPDATE brands
   SET categories = jsonb_build_array(category)
 WHERE category IS NOT NULL
   AND category <> ''
   AND (categories = '[]'::jsonb OR categories IS NULL);


-- ──────────────────────────────────────────────────────────────
-- 3. EXTEND tag_registry · suggested flag
-- ──────────────────────────────────────────────────────────────
ALTER TABLE tag_registry
  ADD COLUMN IF NOT EXISTS is_suggested BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS tag_registry_type_suggested_idx
  ON tag_registry (type, is_suggested, usage_count DESC);

-- Seed initial brand-typed suggested tags (idempotent on (tenant_id, type, slug))
-- These act as starting catalog · tenant-private tags can be added freely.
INSERT INTO tag_registry (id, tenant_id, slug, label, type, synonyms, approved, usage_count, is_suggested, created_at, updated_at)
SELECT gen_random_uuid(), NULL, x.slug, x.label, 'brand', '[]'::jsonb, true, 0, true, NOW(), NOW()
FROM (VALUES
  ('made-in-italy',         'made in italy'),
  ('lusso',                 'lusso'),
  ('design-contemporaneo',  'design contemporaneo'),
  ('personalizzazione',     'personalizzazione'),
  ('contract',              'contract'),
  ('artigianale',           'artigianale'),
  ('sostenibile',           'sostenibile'),
  ('high-end',              'high-end'),
  ('custom-made',           'custom made'),
  ('minimal',               'minimal'),
  ('luxury',                'luxury'),
  ('hospitality',           'hospitality'),
  ('technology',            'technology')
) AS x(slug, label)
WHERE NOT EXISTS (
  SELECT 1 FROM tag_registry tr
  WHERE tr.tenant_id IS NULL
    AND tr.type = 'brand'
    AND tr.slug = x.slug
);
