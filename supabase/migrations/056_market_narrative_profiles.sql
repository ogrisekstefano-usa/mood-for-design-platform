-- ────────────────────────────────────────────────────────────────────
-- 056_market_narrative_profiles.sql — Market Narrative Profiles™
--
-- Quarto layer dell'Editorial Intelligence Stack di MOOD:
--   Brand Voice™         (persistente · identità studio)
--   Narrative Mode™      (contestuale · tono singolo contenuto)
--   Presentation Context™(contestuale · contesto output)
--   Market Narrative Profile™ (cultura narrativa geografica)
--
-- Il profilo di mercato NON sovrascrive Brand Voice — la *influenza*
-- culturalmente. Esempio: studio milanese tecnico + mercato Miami →
-- output più caldo, hospitality, lifestyle, MA sempre riconoscibilmente
-- milanese.
--
-- Fase 1: integrazione SOLO con Cultural Edition™. Le altre superfici
-- (Inspirations, Moodboards, Editorial articles) restano foundation-ready
-- ma non ancora wired.
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_narrative_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_code                 TEXT NOT NULL UNIQUE,         -- 'usa_miami', 'italy_milano', …
  label                       TEXT NOT NULL,                -- 'USA · Miami'

  -- Direzione narrativa: array curato di parole-chiave editoriali
  -- italiane/inglesi (es. ['Hospitality','Cinematic','Warm Luxury']).
  narrative_direction         JSONB NOT NULL DEFAULT '[]',

  -- Bias culturali (array di stringhe editoriali, NON pesi numerici).
  narrative_intensity_bias    TEXT,           -- es. 'verso cinematic'
  vocabulary_bias             JSONB NOT NULL DEFAULT '[]',
  emotional_bias              JSONB NOT NULL DEFAULT '[]',
  hospitality_bias            JSONB NOT NULL DEFAULT '[]',
  luxury_expression           TEXT,
  storytelling_density        TEXT,
  editorial_style             TEXT,

  -- Pattern da evitare (la voce del mercato che NON suona come questo mercato).
  anti_patterns               JSONB NOT NULL DEFAULT '[]',

  -- Nota curatoriale italiana mostrata in UI ("Mercato orientato a…").
  curator_note                TEXT NOT NULL,

  -- Suggerimenti di default (allineati a editorial_interpreter.NARRATIVE_MODES e NARRATIVE_INTENSITY).
  suggested_narrative_mode    TEXT NOT NULL,
  suggested_intensity         TEXT NOT NULL,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_narrative_profiles_code
  ON market_narrative_profiles (market_code);

COMMENT ON TABLE market_narrative_profiles IS
  'Cultura narrativa geografica per Cultural Edition™. Influenza soft, NON override sulla Brand Voice.';

-- ── Estensione cultural_edition_drafts per tracciare suggested vs final ──
-- Questi campi permetteranno (in futuro) Cultural Pattern Learning™ e
-- Relationship Intelligence™ — differenza tra ciò che MOOD suggerisce e
-- ciò che il designer effettivamente sceglie.
ALTER TABLE cultural_edition_drafts
  ADD COLUMN IF NOT EXISTS market_narrative_profile_id UUID
    REFERENCES market_narrative_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suggested_narrative_mode    TEXT,
  ADD COLUMN IF NOT EXISTS suggested_intensity         TEXT,
  ADD COLUMN IF NOT EXISTS selected_narrative_mode     TEXT,
  ADD COLUMN IF NOT EXISTS selected_intensity          TEXT,
  ADD COLUMN IF NOT EXISTS manual_override             BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS applied_market_biases       JSONB NOT NULL DEFAULT '{}';
