-- ─────────────────────────────────────────────────────────────────────────
-- Phase P0.6.F — Market Perspective™ (Cultural Design Intelligence™)
-- NOT localization. Cultural repositioning.
--
-- The same project must produce DIFFERENT emotional narratives, positioning,
-- vocabulary and investment framing depending on the target market.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_positioning_profiles (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  market_code        TEXT         NOT NULL UNIQUE,        -- IT, US, UAE, UK, FR, DE, ES
  locale             TEXT         NOT NULL,               -- it, en, fr, de, es
  display_name       TEXT         NOT NULL,
  emotional_tone     TEXT         NOT NULL,
  hospitality_style  TEXT         NOT NULL,
  luxury_style       TEXT         NOT NULL,
  investment_framing TEXT         NOT NULL,
  focus              JSONB        NOT NULL DEFAULT '[]'::jsonb,   -- ["materials","proportion",...]
  vocabulary         JSONB        NOT NULL DEFAULT '[]'::jsonb,   -- ["equilibrio","materia",...]
  forbidden_patterns JSONB        NOT NULL DEFAULT '[]'::jsonb,   -- ["luxury home goods cliché",...]
  narrative_examples JSONB        NOT NULL DEFAULT '[]'::jsonb,
  system_brief       TEXT         NOT NULL,
  -- The system_brief is injected verbatim into the LLM system prompt for this
  -- market. Example: "You are positioning this project for a German
  -- architectural audience valuing rigor, precision, material discipline…"
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_profiles_locale
  ON market_positioning_profiles(locale);

-- ─────────────────────────────────────────────────────────────────────────
-- Proposal version log — every time the user switches market on a proposal
-- and the system re-composes, we snapshot the result here so the advisor
-- can compare or revert.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proposal_market_versions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL,
  proposal_id         UUID        NOT NULL,
  market_code         TEXT        NOT NULL,
  locale              TEXT        NOT NULL,
  sections            JSONB       NOT NULL,
  headline            TEXT,
  positioning_summary TEXT,
  generated_by        UUID,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active           BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_pmv_proposal
  ON proposal_market_versions(proposal_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pmv_proposal_active
  ON proposal_market_versions(proposal_id) WHERE is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pmv_per_market
  ON proposal_market_versions(proposal_id, market_code);
