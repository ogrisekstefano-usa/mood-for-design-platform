-- 046_advisor_network.sql
-- ─────────────────────────────────────────────────────────────────────
-- ADVISOR NETWORK — Premium Partner Advisory System
--
-- A trusted, relationship-oriented referral layer that rewards
-- ACTIVATION + ADOPTION (not signup). Six tables:
--   advisor_profiles          — partner identity / commission config
--   advisor_referrals         — advisor ↔ tenant link + lifecycle
--   advisor_activity_months   — monthly tenant activity snapshot
--   advisor_commission_periods— 6-month commission evaluation windows
--   advisor_reports           — visit/call/training/support reports
--   advisor_notes             — internal notes (visibility scoped)
--
-- Plus role 'advisor' in users.role enum.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. ROLE ──────────────────────────────────────────────────────────
-- This codebase uses Supabase auth (auth.users) + users_profile, with
-- role as TEXT in users_profile. No enum to alter — advisor is plain text.


-- ── 2. ADVISOR PROFILES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advisor_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID UNIQUE,                   -- references auth.users(id) logically
  advisor_code                TEXT UNIQUE NOT NULL,
  name                        TEXT NOT NULL,
  email                       TEXT,
  phone                       TEXT,
  territory                   TEXT,                          -- "Lombardia · IT" etc.
  status                      TEXT NOT NULL DEFAULT 'active',-- active · paused · archived
  commission_percentage       NUMERIC(5,2) DEFAULT 15.00,
  default_discount_percentage NUMERIC(5,2) DEFAULT 0.00,
  payout_cycle_months         INT NOT NULL DEFAULT 6,
  minimum_qualified_months    INT NOT NULL DEFAULT 6,        -- of 6
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_advisor_profiles_status ON advisor_profiles(status);


-- ── 3. ADVISOR REFERRALS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advisor_referrals (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id                  UUID NOT NULL REFERENCES advisor_profiles(id) ON DELETE CASCADE,
  tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  referral_code               TEXT NOT NULL,
  signup_date                 TIMESTAMPTZ,
  activation_date             TIMESTAMPTZ,
  subscription_status         TEXT,                          -- trial · paid · cancelled · past_due
  discount_applied            NUMERIC(5,2) DEFAULT 0,
  commission_percentage       NUMERIC(5,2) DEFAULT 15.00,
  current_health_status       TEXT DEFAULT 'pending',        -- healthy · stable · needs_support · at_risk · dormant
  last_activity_date          TIMESTAMPTZ,
  current_period_start        TIMESTAMPTZ,
  current_period_end          TIMESTAMPTZ,
  commission_eligible         BOOLEAN DEFAULT FALSE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)                                          -- one advisor per tenant ever
);
CREATE INDEX IF NOT EXISTS idx_advisor_referrals_advisor ON advisor_referrals(advisor_id);
CREATE INDEX IF NOT EXISTS idx_advisor_referrals_health  ON advisor_referrals(current_health_status);


-- ── 4. MONTHLY ACTIVITY SNAPSHOT ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS advisor_activity_months (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_referral_id           UUID NOT NULL REFERENCES advisor_referrals(id) ON DELETE CASCADE,
  year                          INT  NOT NULL,
  month                         INT  NOT NULL,                 -- 1..12
  active_days                   INT  NOT NULL DEFAULT 0,
  days_in_month                 INT  NOT NULL,
  activity_rate                 NUMERIC(5,4) NOT NULL DEFAULT 0,
  qualifies_activity_threshold  BOOLEAN NOT NULL DEFAULT FALSE,
  computed_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (advisor_referral_id, year, month)
);


-- ── 5. COMMISSION PERIODS (6 months) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS advisor_commission_periods (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id                UUID NOT NULL REFERENCES advisor_profiles(id) ON DELETE CASCADE,
  advisor_referral_id       UUID NOT NULL REFERENCES advisor_referrals(id) ON DELETE CASCADE,
  period_start              DATE NOT NULL,
  period_end                DATE NOT NULL,
  months_qualified          INT  NOT NULL DEFAULT 0,
  months_total              INT  NOT NULL DEFAULT 6,
  revenue_base              NUMERIC(12,2) DEFAULT 0,
  commission_percentage     NUMERIC(5,2) DEFAULT 0,
  commission_amount         NUMERIC(12,2) DEFAULT 0,
  status                    TEXT NOT NULL DEFAULT 'pending',   -- pending · eligible · not_eligible · approved · paid
  computed_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by               UUID,
  approved_at               TIMESTAMPTZ,
  paid_at                   TIMESTAMPTZ,
  UNIQUE (advisor_referral_id, period_start)
);
CREATE INDEX IF NOT EXISTS idx_commission_periods_advisor ON advisor_commission_periods(advisor_id, status);


-- ── 6. ADVISOR REPORTS (visit / call / support …) ───────────────────
CREATE TABLE IF NOT EXISTS advisor_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id      UUID NOT NULL REFERENCES advisor_profiles(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
  report_type     TEXT NOT NULL,            -- visit · call · onboarding · training · support · feedback · issue · follow_up
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  title           TEXT,
  summary         TEXT,
  adoption_blockers TEXT,
  support_needed  TEXT,
  outcome         TEXT,
  next_step       TEXT,
  follow_up_date  DATE,
  attendees       TEXT,                     -- "Maria Rossi, Marco Bianchi"
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_advisor_reports_advisor   ON advisor_reports(advisor_id);
CREATE INDEX IF NOT EXISTS idx_advisor_reports_tenant    ON advisor_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_advisor_reports_followup  ON advisor_reports(follow_up_date) WHERE follow_up_date IS NOT NULL;


-- ── 7. ADVISOR NOTES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advisor_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id  UUID NOT NULL REFERENCES advisor_profiles(id) ON DELETE CASCADE,
  tenant_id   UUID REFERENCES tenants(id) ON DELETE SET NULL,
  note        TEXT NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'advisor_only',  -- advisor_only · superadmin
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ── 8. ACTIVITY EVENTS RAW STREAM (for active-day counting) ─────────
-- We piggyback on the existing `audit_log` table if present, otherwise
-- create a slim activity_events table. Tenants emit one row per
-- meaningful action; the activity-month aggregator counts distinct days.
CREATE TABLE IF NOT EXISTS tenant_activity_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID,
  event_type  TEXT NOT NULL,                -- login · project_update · moodboard_edit · crm_action · article_publish · media_upload …
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tact_tenant_date ON tenant_activity_events(tenant_id, created_at);


-- ── 9. UPDATED_AT TRIGGERS ──────────────────────────────────────────
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION advisor_set_updated_at() RETURNS TRIGGER AS $f$
  BEGIN NEW.updated_at = now(); RETURN NEW; END
  $f$ LANGUAGE plpgsql;
EXCEPTION WHEN duplicate_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_advisor_profiles_upd  BEFORE UPDATE ON advisor_profiles
    FOR EACH ROW EXECUTE FUNCTION advisor_set_updated_at();
  CREATE TRIGGER trg_advisor_referrals_upd BEFORE UPDATE ON advisor_referrals
    FOR EACH ROW EXECUTE FUNCTION advisor_set_updated_at();
  CREATE TRIGGER trg_advisor_reports_upd   BEFORE UPDATE ON advisor_reports
    FOR EACH ROW EXECUTE FUNCTION advisor_set_updated_at();
  CREATE TRIGGER trg_advisor_notes_upd     BEFORE UPDATE ON advisor_notes
    FOR EACH ROW EXECUTE FUNCTION advisor_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
