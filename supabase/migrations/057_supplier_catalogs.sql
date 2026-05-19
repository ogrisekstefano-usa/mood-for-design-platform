-- ────────────────────────────────────────────────────────────────────
-- 057_supplier_catalogs.sql — Supplier Catalog Import™ foundation.
--
-- Non è un PIM, non è un ERP, non è ecommerce. È un layer curatoriale
-- per importare cataloghi fornitore autorizzati in Inspirations™ come
-- Product Inspirations™ taggate, riusabili dentro moodboard, progetti,
-- Cultural Editions™.
--
-- Architettura: tutti gli asset finiscono in `media_library` con
-- `is_inspiration=true` + `inspiration_meta.inspiration_type='product'`
-- (no archivio duplicato). `supplier_catalogs` è solo il record
-- "catalogo sorgente" che li raggruppa.
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS supplier_catalogs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identità editoriale del catalogo
  brand                TEXT NOT NULL,
  supplier_name        TEXT,          -- alias commerciale se differente dal brand
  collection           TEXT,           -- 'Bonaldo 26 Collection', '2026 Preview', ecc.
  catalog_year         INTEGER,
  category             TEXT,           -- 'arredi'|'cucine'|'bagni'|'illuminazione'|'outdoor'|'pietra_materiali'|'tessuti'|'decorazione'|'contract'|'altro'

  -- File sorgente (PDF originale o ZIP) — riferimento alla riga media_library
  source_file_id       UUID,           -- FK soft a media_library.id (il PDF/ZIP originale)
  source_file_url      TEXT,           -- URL signed per quick access
  source_file_kind     TEXT,           -- 'pdf'|'zip'|'images'|'mixed'

  -- Stato dell'import
  status               TEXT NOT NULL DEFAULT 'draft',
    -- 'draft'        appena creato, ancora da uplodare
    -- 'extracting'   estrazione in corso
    -- 'review'       candidati estratti, in attesa di selezione utente
    -- 'imported'     asset selezionati persistiti come Product Inspirations
    -- 'archived'

  -- Tagging batch — viene applicato a TUTTI gli asset importati dal catalogo.
  -- Stessi vocabolari di inspiration_meta — è un default applicabile,
  -- ogni asset può poi essere ri-taggato singolarmente.
  default_atmosphere   JSONB NOT NULL DEFAULT '[]',
  default_material     JSONB NOT NULL DEFAULT '[]',
  default_markets      JSONB NOT NULL DEFAULT '[]',
  default_luxury_level TEXT,
  default_hospitality_profile TEXT,
  default_room_type    TEXT,

  -- Diritti / attribuzione (Soft compliance)
  rights_status        TEXT NOT NULL DEFAULT 'uploaded_by_tenant',
    -- 'uploaded_by_tenant' | 'supplier_authorized' | 'external_reference' | 'unknown'

  -- Conteggi (denormalizzati per perf — aggiornati su finalize/import)
  candidate_count      INTEGER NOT NULL DEFAULT 0,
  imported_count       INTEGER NOT NULL DEFAULT 0,

  -- Risultato grezzo dell'estrazione (per la review page)
  extraction_payload   JSONB NOT NULL DEFAULT '{}',
    -- { "candidates": [
    --     { "image_url": "...", "page_number": 6, "product_name": "Flatiron table",
    --       "designer": "Mauro Lipparini", "category_hint": "Tavoli", "selected": true,
    --       "media_id": null }
    --   ],
    --   "pdf_pages": int, "extraction_method": "pymupdf",
    --   "warnings": [...]
    -- }

  created_by           UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_catalogs_tenant
  ON supplier_catalogs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_catalogs_brand
  ON supplier_catalogs (tenant_id, brand);

COMMENT ON TABLE supplier_catalogs IS
  'Cataloghi fornitore importati dal tenant. NON è un PIM — è un layer di ingestione editoriale verso Inspirations™.';

-- ── media_library expansion (no schema breaking change; inspiration_meta is JSONB) ──
-- I campi product-specific NON sono nuove colonne fisiche: vivono dentro
-- `inspiration_meta` JSONB con le seguenti keys (documentate qui):
--   inspiration_type           'editorial' | 'product'
--   supplier_catalog_id        UUID → supplier_catalogs.id
--   brand                      TEXT
--   collection                 TEXT
--   product_name               TEXT
--   product_category           TEXT
--   designer                   TEXT
--   page_number                INTEGER
--   rights_status              TEXT
--   supplier_reference         TEXT
--   (atmosphere_tags, material_tags, market_codes, hospitality_profile, luxury_level già esistenti)

-- Indice partial per ritrovare velocemente i Product Inspirations
CREATE INDEX IF NOT EXISTS idx_media_library_product_inspirations
  ON media_library (tenant_id, created_at DESC)
  WHERE is_inspiration = TRUE AND inspiration_meta->>'inspiration_type' = 'product';

-- Indice per filtrare per brand
CREATE INDEX IF NOT EXISTS idx_media_library_inspiration_brand
  ON media_library ((inspiration_meta->>'brand'))
  WHERE is_inspiration = TRUE;
