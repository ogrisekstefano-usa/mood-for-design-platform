-- ─────────────────────────────────────────────────────────────────────────
-- Phase P0.6.G — Locale Profiles refactor.
--
-- Replaces market_positioning_profiles with locale_profiles using composite
-- locale codes (IT_IT, EN_US, EN_GB, EN_AE, DE_DE, FR_FR, ES_ES).
--
-- WHY: EN_US, EN_GB and EN_AE share the English language but require
-- fundamentally different cultural positioning. The market-level architecture
-- conflated them; the locale-level architecture treats each as its own
-- editorial profile with its own vocabulary, CTA style and atmosphere
-- language.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS locale_profiles (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  locale_code          TEXT         NOT NULL UNIQUE,    -- IT_IT, EN_US, EN_GB, EN_AE, …
  language             TEXT         NOT NULL,           -- it, en, de, fr, es
  market               TEXT         NOT NULL,           -- IT, US, GB, AE, DE, FR, ES
  display_name         TEXT         NOT NULL,           -- "Italia", "United Kingdom", "UAE", …

  emotional_style      TEXT         NOT NULL,
  luxury_style         TEXT         NOT NULL,
  hospitality_style    TEXT         NOT NULL,
  editorial_tone       TEXT         NOT NULL,

  cta_style            TEXT         NOT NULL,
  investment_language  TEXT         NOT NULL,
  atmosphere_language  TEXT         NOT NULL,

  focus                JSONB        NOT NULL DEFAULT '[]'::jsonb,
  vocabulary_rules     JSONB        NOT NULL DEFAULT '[]'::jsonb,
  forbidden_patterns   JSONB        NOT NULL DEFAULT '[]'::jsonb,
  positioning_examples JSONB        NOT NULL DEFAULT '[]'::jsonb,

  system_brief         TEXT         NOT NULL,
  -- Verbatim LLM system context for this locale. The AI repositions,
  -- never translates. Example for EN_AE:
  --   "Write for a UAE hospitality-oriented luxury audience seeking prestige,
  --    sensory richness and iconic atmosphere…"

  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locale_profiles_language ON locale_profiles(language);
CREATE INDEX IF NOT EXISTS idx_locale_profiles_market   ON locale_profiles(market);

-- ─────────────────────────────────────────────────────────────────────────
-- proposal_market_versions → add locale_code (keep market_code for legacy)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE proposal_market_versions
  ADD COLUMN IF NOT EXISTS locale_code TEXT;

UPDATE proposal_market_versions
   SET locale_code = CASE market_code
     WHEN 'IT'  THEN 'IT_IT'
     WHEN 'US'  THEN 'EN_US'
     WHEN 'UK'  THEN 'EN_GB'
     WHEN 'UAE' THEN 'EN_AE'
     WHEN 'DE'  THEN 'DE_DE'
     WHEN 'FR'  THEN 'FR_FR'
     WHEN 'ES'  THEN 'ES_ES'
     ELSE market_code
   END
 WHERE locale_code IS NULL;

DROP INDEX IF EXISTS uniq_pmv_per_market;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pmv_per_locale
  ON proposal_market_versions(proposal_id, locale_code);

-- ─────────────────────────────────────────────────────────────────────────
-- proposals → add locale_code so the live row exposes the active locale
-- (existing `market` column kept for backward compatibility)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS locale_code TEXT;
