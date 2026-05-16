-- ─────────────────────────────────────────────────────────────────────────
-- Phase P0.6.G — Strategic Direction™ locale alignment.
--
-- Adds `locale_code` (composite IT_IT / EN_US / EN_GB / EN_AE / DE_DE /
-- FR_FR / ES_ES) to `project_ai_briefs` so the Strategic Direction™ engine
-- consumes locale_profiles instead of generic language codes.
--
-- Keeps `market` and `locale` columns for backward compatibility.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE project_ai_briefs
  ADD COLUMN IF NOT EXISTS locale_code TEXT;

UPDATE project_ai_briefs
   SET locale_code = CASE COALESCE(market, '')
     WHEN 'IT'  THEN 'IT_IT'
     WHEN 'US'  THEN 'EN_US'
     WHEN 'UK'  THEN 'EN_GB'
     WHEN 'GB'  THEN 'EN_GB'
     WHEN 'UAE' THEN 'EN_AE'
     WHEN 'AE'  THEN 'EN_AE'
     WHEN 'DE'  THEN 'DE_DE'
     WHEN 'FR'  THEN 'FR_FR'
     WHEN 'ES'  THEN 'ES_ES'
     ELSE 'IT_IT'
   END
 WHERE locale_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_ai_briefs_locale_code
  ON project_ai_briefs(locale_code);
