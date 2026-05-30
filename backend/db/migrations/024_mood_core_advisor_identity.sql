-- ────────────────────────────────────────────────────────────────────
-- 024 — MOOD Advisor Program™ · Chunk 2 (Identity & Scoping)
--
-- 1. Drop 4 orphan advisor_* tables (zero rows, no Python references):
--      advisor_referrals
--      advisor_commission_periods
--      advisor_activity_months
--      advisor_reports
--    These were left over from an earlier iteration that never landed.
--    The new commission model (Chunks 3–6) is built around actual cash
--    received (tenant_payments) — these monthly-tally tables don't fit.
--
-- 2. ALTER advisor_profiles:
--      • ensure user_id FK to users(id) for advisor identity linkage
--      • ON DELETE SET NULL — never cascade-delete an advisor when a
--        user row is removed
-- ────────────────────────────────────────────────────────────────────

-- Defensive backup — copy the orphan rows into companion *_archive tables
-- before dropping. Even though they're empty today, this is the safety
-- net the user explicitly requested ("Backup logico prima della rimozione").
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='advisor_referrals_archive') THEN
    EXECUTE 'CREATE TABLE advisor_referrals_archive AS TABLE advisor_referrals';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='advisor_commission_periods_archive') THEN
    EXECUTE 'CREATE TABLE advisor_commission_periods_archive AS TABLE advisor_commission_periods';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='advisor_activity_months_archive') THEN
    EXECUTE 'CREATE TABLE advisor_activity_months_archive AS TABLE advisor_activity_months';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='advisor_reports_archive') THEN
    EXECUTE 'CREATE TABLE advisor_reports_archive AS TABLE advisor_reports';
  END IF;
END$$;

DROP TABLE IF EXISTS advisor_referrals          CASCADE;
DROP TABLE IF EXISTS advisor_commission_periods CASCADE;
DROP TABLE IF EXISTS advisor_activity_months    CASCADE;
DROP TABLE IF EXISTS advisor_reports            CASCADE;

-- ── advisor_profiles.user_id linkage ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='advisor_profiles'
       AND column_name='user_id'
  ) THEN
    ALTER TABLE advisor_profiles ADD COLUMN user_id uuid;
  END IF;
END$$;

-- Add FK if not already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
     WHERE tc.table_schema='public'
       AND tc.table_name='advisor_profiles'
       AND tc.constraint_type='FOREIGN KEY'
       AND kcu.column_name='user_id'
  ) THEN
    ALTER TABLE advisor_profiles
      ADD CONSTRAINT advisor_profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS advisor_profiles_user_id_unique
  ON advisor_profiles(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS advisor_profiles_status_idx
  ON advisor_profiles(status);
