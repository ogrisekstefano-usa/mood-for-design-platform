-- ────────────────────────────────────────────────────────────────────
-- 053_cultural_edition_drafts.sql — Cultural Edition™ Flow Activation
--
-- Tabella reale per le edizioni culturali create dalla wizard:
-- da un contenuto base (progetto / moodboard / showcase) genera una
-- "versione mercato" — bozza editoriale adattata tono / CTA / palette
-- materica / riferimenti culturali per uno specifico submarket.
--
-- Non è una sales pipeline. È un atto editoriale.
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cultural_edition_drafts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Contenuto base
  source_type        TEXT NOT NULL,            -- 'project' | 'moodboard' | 'showcase' | 'material_selection'
  source_id          TEXT NOT NULL,            -- riferimento opaco (UUID o slug)
  source_title       TEXT,                     -- snapshot del titolo al momento della creazione
  source_payload     JSONB NOT NULL DEFAULT '{}', -- snapshot di campi rilevanti (descrizione, atmosfera, materiali…)

  -- Mercato di destinazione
  target_market      TEXT NOT NULL,            -- codice mercato curato (es. 'usa_miami')
  target_market_label TEXT,                    -- etichetta umana (es. 'USA · Miami')
  target_locale      TEXT NOT NULL DEFAULT 'it-IT',

  -- Ambito di adattamento (checkbox del wizard)
  adaptation_scope   JSONB NOT NULL DEFAULT '[]', -- ['tone','cta','material_palette','imagery','cultural_refs','headlines','atmosphere']

  -- Output editoriale
  status             TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'in_review' | 'approved' | 'archived'
  market_version     JSONB NOT NULL DEFAULT '{}',   -- {headline, lede, body, cta_label, cta_subtext, atmosphere_notes, material_notes, imagery_notes, cultural_notes}
  generation_meta    JSONB NOT NULL DEFAULT '{}',   -- {model, source, generated_at, fallback}

  note               TEXT,                      -- briefing editoriale opzionale
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cultural_edition_drafts_tenant
  ON cultural_edition_drafts (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cultural_edition_drafts_source
  ON cultural_edition_drafts (tenant_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_cultural_edition_drafts_market
  ON cultural_edition_drafts (tenant_id, target_market);

COMMENT ON TABLE cultural_edition_drafts IS
  'Edizioni culturali: versioni mercato di un contenuto base. Editorial-first, never sales-pipeline.';
