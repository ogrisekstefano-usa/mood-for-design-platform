-- ─────────────────────────────────────────────────────────────────────────
-- Phase P0.2.C — Editorial Cultural Variants.
--
-- 1. Extends `article_localizations` with the editorial fields required by
--    the Magazine Cultural Variants spec (intro, storytelling_summary,
--    emotional_direction, cta_copy, approved_by).
--
-- 2. Creates `hotspot_locale_variants` so the same article hotspot can be
--    repositioned per locale_profile (NOT translated — culturally
--    repositioned, e.g. "Materia porosa" → "Sensorial stone statement").
--
-- IMPORTANT: variants are NEVER translations. They are market-native
-- editorial repositionings keyed by locale_code (IT_IT, EN_US, EN_GB,
-- EN_AE, DE_DE, FR_FR, ES_ES).
-- ─────────────────────────────────────────────────────────────────────────

-- ── Article localizations: editorial enrichment ─────────────────────────
ALTER TABLE article_localizations
  ADD COLUMN IF NOT EXISTS intro                  TEXT,
  ADD COLUMN IF NOT EXISTS storytelling_summary   TEXT,
  ADD COLUMN IF NOT EXISTS emotional_direction    TEXT,
  ADD COLUMN IF NOT EXISTS cta_copy               TEXT,
  ADD COLUMN IF NOT EXISTS approved_by            UUID,
  ADD COLUMN IF NOT EXISTS approved_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS generated_by           UUID;

CREATE INDEX IF NOT EXISTS idx_article_localizations_locale_article
  ON article_localizations(article_id, locale_code);

-- ── Hotspot locale variants ─────────────────────────────────────────────
-- One row per (hotspot_id, locale_code) — same hotspot, completely
-- different emotional framing across EN_US / EN_GB / EN_AE etc.
CREATE TABLE IF NOT EXISTS hotspot_locale_variants (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hotspot_id         UUID NOT NULL REFERENCES article_hotspots(id) ON DELETE CASCADE,
  locale_code        TEXT NOT NULL,
  title              TEXT,
  narrative          TEXT,
  cta_copy           TEXT,
  emotional_framing  TEXT,
  atmosphere         TEXT,
  ai_generated       BOOLEAN NOT NULL DEFAULT FALSE,
  ai_metadata        JSONB,
  generated_by       UUID,
  generated_at       TIMESTAMPTZ,
  approved_by        UUID,
  approved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hotspot_id, locale_code)
);

CREATE INDEX IF NOT EXISTS idx_hotspot_locale_variants_hotspot
  ON hotspot_locale_variants(hotspot_id);
CREATE INDEX IF NOT EXISTS idx_hotspot_locale_variants_tenant_locale
  ON hotspot_locale_variants(tenant_id, locale_code);
