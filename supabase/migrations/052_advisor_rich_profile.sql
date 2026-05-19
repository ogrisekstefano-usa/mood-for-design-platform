-- ────────────────────────────────────────────────────────────────────
-- 052_advisor_rich_profile.sql
--
-- Sprint SuperAdmin+Advisor v1 (Feb 2026):
-- adds the three editorial fields used by the AdvisorEditDrawer so the
-- advisor record can hold:
--   • market_specialization  jsonb array of free-form tags
--   • relationship_tags      jsonb array of relational keywords
--   • notes                  internal narrative notes
--
-- Idempotent.
-- ────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE advisor_profiles
  ADD COLUMN IF NOT EXISTS market_specialization JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS relationship_tags     JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notes                 TEXT;

COMMIT;
