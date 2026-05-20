-- ────────────────────────────────────────────────────────────────────
-- 059_curated_references.sql — Phase F2.1 · Curated References™
--
-- Due nuove tabelle per supportare il "Visual Atelier" workflow:
--   • curated_collections    — micro-collezioni curatoriali per studio
--   • saved_references       — singoli asset salvati dentro le collections
--
-- Naming Italian-aware:
--   "Curated References™" è il termine UI ufficiale. NON Favorites,
--   NON Bookmarks, NON Saved Items.
--
-- Storia: il nome `reference_collections` era già occupato da una feature
-- advisor diversa (atmosphere_direction/project_vertical) — abbiamo
-- scelto `curated_collections` per evitare collisione.
-- ────────────────────────────────────────────────────────────────────

-- ── 1. CURATED COLLECTIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS curated_collections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id           UUID,                                 -- profile_id creator (NULL allowed for tenant-shared)
  title             TEXT NOT NULL,
  description       TEXT,
  tags              JSONB NOT NULL DEFAULT '[]',          -- free-form: ["Miami warm", "Cliente Riva", …]
  cover_asset_id    UUID,                                 -- media_library.id (no FK — soft link)
  visibility        TEXT NOT NULL DEFAULT 'team',
    -- 'private' | 'team' | 'client_visible'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS curated_collections_tenant_idx
  ON curated_collections (tenant_id);
CREATE INDEX IF NOT EXISTS curated_collections_user_idx
  ON curated_collections (tenant_id, user_id);


-- ── 2. SAVED REFERENCES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_references (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id                  UUID,                          -- profile_id (chi ha salvato)
  visual_asset_id          UUID NOT NULL,                 -- media_library.id (soft link)
  curated_collection_id    UUID REFERENCES curated_collections(id) ON DELETE SET NULL,
    -- NULL = "salvato senza collezione" (scratchpad-like)
  note                     TEXT,
  tags                     JSONB NOT NULL DEFAULT '[]',   -- free-form per-asset tags
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saved_references_tenant_idx
  ON saved_references (tenant_id);
CREATE INDEX IF NOT EXISTS saved_references_collection_idx
  ON saved_references (curated_collection_id);
CREATE INDEX IF NOT EXISTS saved_references_asset_idx
  ON saved_references (tenant_id, visual_asset_id);

-- Same (tenant, asset, collection) → only one row.
-- Allow same asset in MULTIPLE collections, but NOT duplicated inside one.
CREATE UNIQUE INDEX IF NOT EXISTS saved_references_unique_in_collection_idx
  ON saved_references (tenant_id, COALESCE(curated_collection_id, '00000000-0000-0000-0000-000000000000'::uuid), visual_asset_id);
