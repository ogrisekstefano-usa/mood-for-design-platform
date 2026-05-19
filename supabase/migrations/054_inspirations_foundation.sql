-- ────────────────────────────────────────────────────────────────────
-- 054_inspirations_foundation.sql — Inspirations™ as a layer on
-- top of media_library. NO duplicate table for files. Just two new
-- columns + a join table for relations.
-- ────────────────────────────────────────────────────────────────────

-- 1. Tagga la media_library con il flag inspiration + metadata editoriali
ALTER TABLE media_library
  ADD COLUMN IF NOT EXISTS is_inspiration   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS inspiration_meta JSONB   NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_url       TEXT,
  ADD COLUMN IF NOT EXISTS source_kind      TEXT;          -- 'upload' | 'pinterest' | 'instagram' | 'url'

CREATE INDEX IF NOT EXISTS media_library_inspiration_idx
  ON media_library (tenant_id, is_inspiration)
  WHERE is_inspiration = TRUE;

CREATE INDEX IF NOT EXISTS media_library_inspiration_meta_gin
  ON media_library USING GIN (inspiration_meta);

COMMENT ON COLUMN media_library.is_inspiration IS
  'Layer Inspirations™: lo stesso file appare sia nella Media Library sia nellarchivio editoriale Inspirations™. Mai duplicato fisicamente.';
COMMENT ON COLUMN media_library.inspiration_meta IS
  'Cultural editorial metadata: atmosphere_tags, material_tags, market_codes, style_tags, palette, hospitality_profile, luxury_level, brand, collection, product_name, material_family, supplier_reference.';


-- 2. Relazioni leggere fra inspiration e altre entità del sistema
-- (moodboard, project, account, cultural_edition_draft, material, magazine_post)
CREATE TABLE IF NOT EXISTS inspiration_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  media_id      UUID NOT NULL REFERENCES media_library(id) ON DELETE CASCADE,
  target_type   TEXT NOT NULL,        -- 'moodboard' | 'project' | 'account' | 'cultural_edition' | 'material' | 'magazine_post'
  target_id     TEXT NOT NULL,
  note          TEXT,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, media_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS inspiration_links_media_idx
  ON inspiration_links (tenant_id, media_id);
CREATE INDEX IF NOT EXISTS inspiration_links_target_idx
  ON inspiration_links (tenant_id, target_type, target_id);

COMMENT ON TABLE inspiration_links IS
  'Relazioni leggere fra una Inspiration e altre entità — moodboard, project, account, cultural edition, material. Mai duplica il file.';
