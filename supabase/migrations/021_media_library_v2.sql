-- =====================================================================
-- 021_media_library_v2.sql — Media Library + Material Registry
-- =====================================================================
-- Phase N: turns media_library from passive registry into an operational
-- asset layer with soft versioning, collections, link/usage map, and a
-- first-class material registry.
--
-- ARCHITECTURE
-- ────────────
-- • media_library extended with width / height / duration / mime / checksum,
--   description, dominant_color, focal_point, plus soft-version pointers
--   (replaces_id + replaced_by_id + archived_at).
--
-- • media_collections + media_collection_items — curated sets like
--   "Marmi Calacatta 2026" or "Renderings Villa Roma". Tenant-scoped.
--
-- • media_links — single table that records WHERE an asset is used:
--   project / moodboard / cms_page / cms_section / article / material /
--   storefront_page / proposal. Powers the "Used in: 3 projects, 2 boards,
--   1 magazine article" usage map without forcing every entity to know
--   about the library schema.
--
-- • material_registry — first-class operational entity, NOT a tag. A
--   Material has its own page, technical metadata (finish, thickness,
--   origin, supplier, sku), and a set of typed asset attachments via
--   material_assets (role = slab / finish / render / catalog / spec / detail).
--
-- VERSIONING — soft
-- ─────────────────
-- A replace operation:
--   1. inserts a NEW media_library row (the replacement)
--   2. sets new.replaces_id   = old.id
--   3. sets old.replaced_by_id = new.id
--   4. stamps old.archived_at = NOW() (still queryable for history)
--   5. moves every media_links row pointing at old → new
--   6. moves every direct FK reference if requested
--
-- The old asset stays accessible for audit / rollback.
-- =====================================================================
BEGIN;

-- ── 1. media_library extensions ──────────────────────────────────────
ALTER TABLE media_library
  ADD COLUMN IF NOT EXISTS width            INTEGER,
  ADD COLUMN IF NOT EXISTS height           INTEGER,
  ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS mime_type        TEXT,
  ADD COLUMN IF NOT EXISTS checksum_sha256  TEXT,
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS dominant_color   TEXT,
  ADD COLUMN IF NOT EXISTS focal_point      JSONB,
  ADD COLUMN IF NOT EXISTS archived_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replaces_id      UUID REFERENCES media_library(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replaced_by_id   UUID REFERENCES media_library(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version_number   INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS media_library_tenant_idx        ON media_library(tenant_id);
CREATE INDEX IF NOT EXISTS media_library_tenant_archived   ON media_library(tenant_id, archived_at);
CREATE INDEX IF NOT EXISTS media_library_replaced_by_idx   ON media_library(replaced_by_id);
CREATE INDEX IF NOT EXISTS media_library_tags_gin          ON media_library USING GIN (tags);
CREATE INDEX IF NOT EXISTS media_library_category_idx      ON media_library(tenant_id, category);
CREATE INDEX IF NOT EXISTS media_library_mime_idx          ON media_library(tenant_id, mime_type);

COMMENT ON COLUMN media_library.replaces_id IS
  'If this asset is a replacement, points to the asset it replaced. Soft versioning chain head = NULL.';
COMMENT ON COLUMN media_library.replaced_by_id IS
  'If this asset has been superseded, points to the newer version. Active assets = NULL.';
COMMENT ON COLUMN media_library.archived_at IS
  'Soft archive timestamp. archived assets are excluded from default list views but stay queryable.';


-- ── 2. media_collections + items ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  -- 'project_assets' | 'curated' | 'inspiration' | 'material' | 'render' | 'system'
  kind            TEXT NOT NULL DEFAULT 'curated',
  cover_asset_id  UUID REFERENCES media_library(id) ON DELETE SET NULL,
  metadata_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by      UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS media_collections_tenant_idx ON media_collections(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON media_collections TO service_role;
GRANT SELECT ON media_collections TO authenticated, anon;

CREATE TABLE IF NOT EXISTS media_collection_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  collection_id  UUID NOT NULL REFERENCES media_collections(id) ON DELETE CASCADE,
  asset_id       UUID NOT NULL REFERENCES media_library(id) ON DELETE CASCADE,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  note           TEXT,
  added_by       UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (collection_id, asset_id)
);

CREATE INDEX IF NOT EXISTS media_collection_items_collection_idx ON media_collection_items(collection_id, sort_order);
CREATE INDEX IF NOT EXISTS media_collection_items_asset_idx      ON media_collection_items(asset_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON media_collection_items TO service_role;
GRANT SELECT ON media_collection_items TO authenticated, anon;


-- ── 3. media_links — asset usage map ─────────────────────────────────
CREATE TABLE IF NOT EXISTS media_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id      UUID NOT NULL REFERENCES media_library(id) ON DELETE CASCADE,
  -- 'project' | 'moodboard' | 'moodboard_block' | 'cms_page' | 'cms_section'
  -- 'magazine_article' | 'magazine_paragraph' | 'material' | 'storefront_page'
  -- 'proposal' | 'inspiration' | 'branding_asset'
  entity_type   TEXT NOT NULL,
  entity_id     UUID,
  -- Free-form role inside the entity (e.g. 'hero', 'thumbnail', 'slab_main',
  -- 'cover', 'gallery_item'). Used to disambiguate when an entity uses an
  -- asset in more than one slot.
  role          TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by    UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (asset_id, entity_type, entity_id, role)
);

CREATE INDEX IF NOT EXISTS media_links_tenant_idx          ON media_links(tenant_id);
CREATE INDEX IF NOT EXISTS media_links_asset_idx           ON media_links(asset_id);
CREATE INDEX IF NOT EXISTS media_links_entity_idx          ON media_links(entity_type, entity_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON media_links TO service_role;
GRANT SELECT ON media_links TO authenticated, anon;


-- ── 4. material_registry — first-class material entity ──────────────
CREATE TABLE IF NOT EXISTS material_registry (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug              TEXT NOT NULL,
  name              TEXT NOT NULL,
  -- e.g. 'stone' | 'wood' | 'fabric' | 'metal' | 'glass' | 'ceramic' | 'leather' | 'paint' | 'other'
  category          TEXT,
  -- Free-form sub-category ("quartzite", "oak veneer", "boucle wool", ...)
  subcategory       TEXT,
  supplier          TEXT,
  supplier_sku      TEXT,
  finish            TEXT,
  -- "20mm" | "1.2cm" | "8oz" etc — kept as free text so different materials
  -- can describe their own metric (thickness for stone, weight for fabric).
  thickness         TEXT,
  origin            TEXT,
  -- Short editorial description (markdown allowed)
  description       TEXT,
  -- Technical notes (markdown allowed) — fire rating, durability, care...
  technical_notes   TEXT,
  -- Free-form tags
  tags              JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Single "hero" image for cards / list views
  primary_asset_id  UUID REFERENCES media_library(id) ON DELETE SET NULL,
  dominant_color    TEXT,
  metadata_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  status            TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'discontinued' | 'archived'
  archived_at       TIMESTAMPTZ,
  created_by        UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS material_registry_tenant_idx   ON material_registry(tenant_id);
CREATE INDEX IF NOT EXISTS material_registry_category_idx ON material_registry(tenant_id, category);
CREATE INDEX IF NOT EXISTS material_registry_tags_gin     ON material_registry USING GIN (tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON material_registry TO service_role;
GRANT SELECT ON material_registry TO authenticated, anon;


-- ── 5. material_assets — M2M material ↔ asset, with role ────────────
CREATE TABLE IF NOT EXISTS material_assets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  material_id  UUID NOT NULL REFERENCES material_registry(id) ON DELETE CASCADE,
  asset_id     UUID NOT NULL REFERENCES media_library(id) ON DELETE CASCADE,
  -- 'slab' | 'finish' | 'render' | 'catalog' | 'spec' | 'detail' | 'application' | 'swatch'
  role         TEXT NOT NULL DEFAULT 'detail',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  caption      TEXT,
  created_by   UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (material_id, asset_id, role)
);

CREATE INDEX IF NOT EXISTS material_assets_material_idx ON material_assets(material_id, sort_order);
CREATE INDEX IF NOT EXISTS material_assets_asset_idx    ON material_assets(asset_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON material_assets TO service_role;
GRANT SELECT ON material_assets TO authenticated, anon;


-- ── 6. Trigger: keep media_library.updated_at fresh ─────────────────
CREATE OR REPLACE FUNCTION media_library_bump_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_media_library_bump_updated_at ON media_library;
CREATE TRIGGER trg_media_library_bump_updated_at
  BEFORE UPDATE ON media_library
  FOR EACH ROW EXECUTE FUNCTION media_library_bump_updated_at();

CREATE OR REPLACE FUNCTION material_registry_bump_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_material_registry_bump_updated_at ON material_registry;
CREATE TRIGGER trg_material_registry_bump_updated_at
  BEFORE UPDATE ON material_registry
  FOR EACH ROW EXECUTE FUNCTION material_registry_bump_updated_at();


-- ── 7. View: media_with_usage_count (read helper) ───────────────────
CREATE OR REPLACE VIEW media_with_usage AS
SELECT
  m.*,
  COALESCE((SELECT COUNT(*) FROM media_links l WHERE l.asset_id = m.id), 0)::INTEGER AS usage_count
FROM media_library m;

GRANT SELECT ON media_with_usage TO service_role, authenticated, anon;

COMMIT;
