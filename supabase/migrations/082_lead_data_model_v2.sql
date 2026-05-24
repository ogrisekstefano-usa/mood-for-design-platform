-- ────────────────────────────────────────────────────────────────────
-- 082_lead_data_model_v2.sql · ITER148 · Phase 1
-- CRM RELATIONSHIP MEMORY™ — Lead Data Model 2.0
--
-- Foundation per il Relationship Memory Engine™.
-- Estende `leads` con uno strato strutturato di closed-answers
-- (80-90% domande chiuse), behavioral tags, signal projections,
-- e progression_state Lead→Prospect→Account.
--
-- NO breaking change: tutte le colonne sono additive con default safe.
-- NO RLS (multi-tenancy server-side, in linea con policy MOOD).
-- ────────────────────────────────────────────────────────────────────

-- ── leads · structured intake + behavioral signals ─────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS closed_answers         JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- canonical answers keyed by question_key (e.g. {"space_typology":"residence",
    --   "atmosphere_dominant":["nordic_silence","japandi"]})
  ADD COLUMN IF NOT EXISTS behavioral_tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- computed cluster tags (e.g. ["residential","nordic_register","atelier_tier"])
  ADD COLUMN IF NOT EXISTS ai_tags                JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- reserved for LLM-inferred enrichment (Phase 1.5)
  ADD COLUMN IF NOT EXISTS atmosphere_signals     JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- top atmosphere signals projected from answers (max 3)
  ADD COLUMN IF NOT EXISTS material_signals       JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- top material signals projected from answers (max 3)
  ADD COLUMN IF NOT EXISTS cultural_register      TEXT,
    -- 'editorial' | 'concierge' | 'consultative' | 'discovery'
  ADD COLUMN IF NOT EXISTS luxury_perception_tier TEXT,
    -- 'atelier' | 'couture' | 'pret_a_porter' | 'exploratory'
  ADD COLUMN IF NOT EXISTS progression_state      TEXT NOT NULL DEFAULT 'lead',
    -- 'lead' | 'prospect' | 'account' | 'dormant' | 'archived'
  ADD COLUMN IF NOT EXISTS progression_score      NUMERIC(4,2) NOT NULL DEFAULT 0.0,
    -- 0.0 - 1.0 — completeness × signal density × intent strength
  ADD COLUMN IF NOT EXISTS narrative_seed         TEXT,
    -- optional open enrichment (max 300 chars), never required
  ADD COLUMN IF NOT EXISTS intake_completed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intake_version         TEXT DEFAULT 'v2_iter148';

-- Defensive value checks (CHECK constraints additive, no failure on legacy NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_progression_state_chk'
  ) THEN
    ALTER TABLE leads ADD CONSTRAINT leads_progression_state_chk
      CHECK (progression_state IN ('lead','prospect','account','dormant','archived'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_cultural_register_chk'
  ) THEN
    ALTER TABLE leads ADD CONSTRAINT leads_cultural_register_chk
      CHECK (cultural_register IS NULL OR cultural_register IN
        ('editorial','concierge','consultative','discovery'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_luxury_tier_chk'
  ) THEN
    ALTER TABLE leads ADD CONSTRAINT leads_luxury_tier_chk
      CHECK (luxury_perception_tier IS NULL OR luxury_perception_tier IN
        ('atelier','couture','pret_a_porter','exploratory'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS leads_progression_state_idx
  ON leads (progression_state);
CREATE INDEX IF NOT EXISTS leads_progression_score_idx
  ON leads (progression_score DESC);
CREATE INDEX IF NOT EXISTS leads_cultural_register_idx
  ON leads (cultural_register);
CREATE INDEX IF NOT EXISTS leads_luxury_tier_idx
  ON leads (luxury_perception_tier);

-- GIN per query "leads con tag X" / "leads con material Y"
CREATE INDEX IF NOT EXISTS leads_behavioral_tags_gin
  ON leads USING GIN (behavioral_tags);
CREATE INDEX IF NOT EXISTS leads_atmosphere_signals_gin
  ON leads USING GIN (atmosphere_signals);
CREATE INDEX IF NOT EXISTS leads_material_signals_gin
  ON leads USING GIN (material_signals);

-- ── lead_intake_questions · closed-question catalog ────────────────
-- Catalogo runtime-driven dei quesiti di intake. NESSUNA hardcoded
-- question lato frontend — la UI legge da qui. Tag clusters mappano
-- ogni opzione ai behavioral_tags via lead_intake_engine.
CREATE TABLE IF NOT EXISTS lead_intake_questions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_key            TEXT NOT NULL UNIQUE,
  section_key             TEXT NOT NULL,
    -- 'space' | 'atmosphere' | 'material' | 'cultural' | 'engagement' | 'narrative'
  question_type           TEXT NOT NULL,
    -- 'single' | 'multi' | 'open'
  max_selections          INT,
    -- valid only for 'multi'
  options                 JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- [{value:'residence', tag_cluster:['residential','private_living'],
    --   atmosphere:[], material:[], cultural_register:null, luxury_tier:null}, …]
  is_required             BOOLEAN NOT NULL DEFAULT FALSE,
  display_order           INT NOT NULL DEFAULT 100,
  applies_to_lead_type    TEXT,
    -- 'private_client' | 'professional' | NULL (entrambi)
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lead_intake_q_type_chk
    CHECK (question_type IN ('single','multi','open')),
  CONSTRAINT lead_intake_q_section_chk
    CHECK (section_key IN
      ('space','atmosphere','material','cultural','engagement','narrative'))
);

CREATE INDEX IF NOT EXISTS lead_intake_q_section_idx
  ON lead_intake_questions (section_key, display_order);
CREATE INDEX IF NOT EXISTS lead_intake_q_active_idx
  ON lead_intake_questions (is_active, display_order);
CREATE INDEX IF NOT EXISTS lead_intake_q_lead_type_idx
  ON lead_intake_questions (applies_to_lead_type);
