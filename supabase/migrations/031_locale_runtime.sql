-- ─────────────────────────────────────────────────────────────────────────
-- Phase P0.2.A — LocalizationRuntime™ foundation.
--
-- Adds the persistence layer for the runtime locale resolution chain:
--   1. user preferred locale       → users_profile.preferred_locale_code
--   2. project locale              → already on projects.locale_code (P0.6.G)
--   3. lead locale                 → leads.locale_code (NEW)
--   4. tenant default locale       → tenants.default_locale_code (NEW)
--   5. browser locale              → header-only (no DB)
--   6. system fallback             → 'IT_IT' (hard-coded in runtime)
--
-- Browser locale is a WEAK signal — never overrides user / project / lead.
-- ─────────────────────────────────────────────────────────────────────────

-- Tenant default locale ---------------------------------------------------
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS default_locale_code TEXT;

UPDATE tenants
   SET default_locale_code = 'IT_IT'
 WHERE default_locale_code IS NULL;

-- User preferred locale ---------------------------------------------------
ALTER TABLE users_profile
  ADD COLUMN IF NOT EXISTS preferred_locale_code TEXT;

CREATE INDEX IF NOT EXISTS idx_users_profile_preferred_locale
  ON users_profile(preferred_locale_code)
  WHERE preferred_locale_code IS NOT NULL;

-- Lead locale -------------------------------------------------------------
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS locale_code TEXT;

-- Backfill lead locale from country (best-effort, keeps NULL if no mapping).
UPDATE leads
   SET locale_code = CASE COALESCE(UPPER(country), '')
     WHEN 'IT'  THEN 'IT_IT'
     WHEN 'US'  THEN 'EN_US'
     WHEN 'UK'  THEN 'EN_GB'
     WHEN 'GB'  THEN 'EN_GB'
     WHEN 'AE'  THEN 'EN_AE'
     WHEN 'UAE' THEN 'EN_AE'
     WHEN 'DE'  THEN 'DE_DE'
     WHEN 'FR'  THEN 'FR_FR'
     WHEN 'ES'  THEN 'ES_ES'
     ELSE NULL
   END
 WHERE locale_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_locale_code
  ON leads(locale_code)
  WHERE locale_code IS NOT NULL;

-- Projects: add locale_code so the resolver chain can read it directly.
-- (Migration 029 only added locale_code to proposals & proposal_market_versions.)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS locale_code TEXT;

-- Backfill from metadata_json.country / language when present.
UPDATE projects
   SET locale_code = CASE COALESCE(UPPER(metadata_json->>'country'), '')
     WHEN 'IT'  THEN 'IT_IT'
     WHEN 'US'  THEN 'EN_US'
     WHEN 'UK'  THEN 'EN_GB'
     WHEN 'GB'  THEN 'EN_GB'
     WHEN 'AE'  THEN 'EN_AE'
     WHEN 'UAE' THEN 'EN_AE'
     WHEN 'DE'  THEN 'DE_DE'
     WHEN 'FR'  THEN 'FR_FR'
     WHEN 'ES'  THEN 'ES_ES'
     ELSE NULL
   END
 WHERE locale_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_locale_code
  ON projects(locale_code)
  WHERE locale_code IS NOT NULL;
