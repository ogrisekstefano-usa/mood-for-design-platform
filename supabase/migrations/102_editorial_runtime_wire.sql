-- ============================================================
-- 102 · ITER155.R2 · Runtime Editorial Overrides™
-- ============================================================
-- Add i18n_keys mapping to editorial_phrases so each editable
-- scope (eyebrow/title/body/cta) can resolve to a static i18n
-- key consumed by useT() at runtime.
-- Example mapping:
--   public.home.header_cta.cta  → "nav.new_journey"
--   studio.dashboard.kpi_active_journeys.title
--     → "atelier.dashboard.kpi.active_journeys"
-- ============================================================

ALTER TABLE editorial_phrases
  ADD COLUMN IF NOT EXISTS i18n_keys JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Seed practical i18n mappings on existing phrases. These prove
-- the wiring end-to-end; migration C will cover the rest.

UPDATE editorial_phrases
SET i18n_keys = '{"cta":"nav.new_journey"}'::jsonb
WHERE phrase_key = 'header_cta'
  AND surface_id IN (SELECT id FROM editorial_surfaces WHERE code = 'public.home');

UPDATE editorial_phrases
SET i18n_keys = '{"title":"atelier.dashboard.kpi.active_journeys"}'::jsonb
WHERE phrase_key = 'kpi_active_journeys'
  AND surface_id IN (SELECT id FROM editorial_surfaces WHERE code = 'studio.dashboard');

UPDATE editorial_phrases
SET i18n_keys = '{"body":"atelier.dashboard.hero.summary_template"}'::jsonb
WHERE phrase_key = 'hero_summary'
  AND surface_id IN (SELECT id FROM editorial_surfaces WHERE code = 'studio.dashboard');
