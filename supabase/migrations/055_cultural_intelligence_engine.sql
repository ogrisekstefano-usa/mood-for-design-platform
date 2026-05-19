-- ────────────────────────────────────────────────────────────────────
-- 055_cultural_intelligence_engine.sql — Hybrid 3-layer engine
--
-- Layer 1 · Vision Analysis      → external (OpenAI gpt-5.1 vision)
-- Layer 2 · MOOD Cultural Engine™ → proprietary (this DB schema)
-- Layer 3 · Editorial Interpretation™ → LLM narrative (Claude/GPT)
--
-- Result of all 3 stages is cached inside media_library.cultural_reading
-- and split into raw_vision_signals / mapped_cultural_descriptors /
-- editorial_interpretation for debugging and future retraining.
-- ────────────────────────────────────────────────────────────────────

-- 1. media_library cultural_reading column
ALTER TABLE media_library
  ADD COLUMN IF NOT EXISTS cultural_reading JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS media_library_cultural_reading_gin
  ON media_library USING GIN (cultural_reading);

COMMENT ON COLUMN media_library.cultural_reading IS
  'Hybrid Cultural Intelligence Engine cache: {status, raw_vision_signals, mapped_cultural_descriptors, editorial_interpretation, market_resonance, provider_meta, generated_at}';


-- 2. cultural_descriptors — proprietary taxonomy of design cultures
CREATE TABLE IF NOT EXISTS cultural_descriptors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,                  -- 'resort_living'
  category     TEXT NOT NULL,                         -- 'spatial_behavior' | 'architectural_language' | ...
  label        TEXT NOT NULL,                         -- human-readable italian label
  description  TEXT,                                  -- editorial micro-narrative
  weight       NUMERIC(4,2) NOT NULL DEFAULT 1.0,     -- importance multiplier (1.0-3.0)
  signal_keys  JSONB NOT NULL DEFAULT '[]'::jsonb,    -- ['indoor_outdoor_continuity','hospitality_orientation'] : which vision signals activate this descriptor
  signal_thresholds JSONB NOT NULL DEFAULT '{}'::jsonb, -- {'indoor_outdoor_continuity': 0.6, ...} minimum signal to activate
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cultural_descriptors_category_idx ON cultural_descriptors(category);


-- 3. market_cultural_profiles — per-market cultural identity
CREATE TABLE IF NOT EXISTS market_cultural_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_code     TEXT UNIQUE NOT NULL,               -- 'usa_miami'
  market_label    TEXT NOT NULL,                      -- 'USA · Miami'
  city            TEXT,
  country         TEXT,
  descriptors     JSONB NOT NULL DEFAULT '{}'::jsonb, -- {'resort_living': 3, 'tropical_continuity': 3, ...}
  anti_patterns   JSONB NOT NULL DEFAULT '[]'::jsonb, -- ['rigid_urban_layering','cold_severity']
  narrative       TEXT,                               -- editorial signature
  climate_behavior TEXT,                              -- 'tropical' | 'mediterranean' | 'desert_luxury' | 'nordic_restraint' | 'alpine_intimacy'
  luxury_profile   TEXT,                              -- 'scenic' | 'monumental' | 'discreet' | 'refined'
  hospitality_behavior TEXT,                          -- 'entertainment' | 'ceremonial' | 'introspective' | 'urban_social'
  spatial_psychology   TEXT,                          -- 'open_continuity' | 'vertical_layering' | 'gallery_intimate' | ...
  material_tendencies  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS market_cultural_profiles_code_idx ON market_cultural_profiles(market_code);


-- 4. market_reference_sets — curated training images (Foundation, empty in Fase 1)
CREATE TABLE IF NOT EXISTS market_reference_sets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_code    TEXT NOT NULL,
  media_id       UUID REFERENCES media_library(id) ON DELETE SET NULL,
  reference_kind TEXT NOT NULL DEFAULT 'positive', -- 'positive' | 'anti_pattern'
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS market_reference_sets_market_idx ON market_reference_sets(market_code);

COMMENT ON TABLE market_reference_sets IS
  'Foundation for proprietary MOOD curated dataset — populated manually in Fase 2.';
