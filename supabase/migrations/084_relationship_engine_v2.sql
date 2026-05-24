-- ────────────────────────────────────────────────────────────────────
-- 084_relationship_engine_v2.sql · ITER148 · Sprint A
-- MOOD RELATIONSHIP ENGINE™ — ONE catalog, ONE engine.
--
-- Unifica e supera `lead_intake_questions` (deprecato, mantenuto solo
-- per backward compatibility). Nuovo modello gerarchico:
--   relationship_question_groups → relationship_questions
--     → relationship_question_options
-- Più `relationship_answer_events` (audit + analytics signals).
--
-- Estende `leads` con campi relazionali (temperature, assigned designer,
-- first journey link) per supportare il Relationship Memory Engine.
--
-- Idempotent (ALTER … IF NOT EXISTS · CREATE TABLE IF NOT EXISTS).
-- ────────────────────────────────────────────────────────────────────

-- ── 1 · leads · relationship layer ─────────────────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS relationship_temperature NUMERIC(4,2) NOT NULL DEFAULT 0.0,
    -- 0.00 = cold / 1.00 = warm · derived from interaction signals
  ADD COLUMN IF NOT EXISTS designer_assigned UUID,
    -- FK soft to users_profile.id (no hard FK to allow studio-wide assignment)
  ADD COLUMN IF NOT EXISTS first_journey_id UUID;
    -- FK soft to projects.id · first journey originated from this lead

CREATE INDEX IF NOT EXISTS leads_relationship_temperature_idx
  ON leads (relationship_temperature DESC);
CREATE INDEX IF NOT EXISTS leads_designer_assigned_idx
  ON leads (designer_assigned);


-- ── 2 · relationship_question_groups ───────────────────────────────
CREATE TABLE IF NOT EXISTS relationship_question_groups (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_key               TEXT NOT NULL UNIQUE,
    -- 'atmosphere' | 'materials' | 'lifestyle' | 'project_timing' | 'budget_range' …
  display_order           INT NOT NULL DEFAULT 100,
  label_default           TEXT NOT NULL,
    -- editorial label (e.g. "Atmosfera che cerchi")
  sublabel_default        TEXT,
    -- supporting micro-copy
  applies_to_lead_type    TEXT,
    -- 'private_client' | 'professional' | NULL (both)
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rel_q_groups_order_idx
  ON relationship_question_groups (display_order, is_active);


-- ── 3 · relationship_questions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS relationship_questions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id                UUID NOT NULL REFERENCES relationship_question_groups(id) ON DELETE CASCADE,
  question_key            TEXT NOT NULL UNIQUE,
  question_type           TEXT NOT NULL,
    -- 'single_choice' | 'multi_choice' | 'slider' | 'chips' | 'visual_choice' | 'ranking'
  max_selections          INT,
    -- valid for multi_choice / chips / ranking
  prompt_default          TEXT NOT NULL,
    -- editorial prompt ("Che atmosfera cerchi?")
  helper_default          TEXT,
    -- subtitle / context line
  is_required             BOOLEAN NOT NULL DEFAULT FALSE,
  display_order           INT NOT NULL DEFAULT 100,
  applies_to_lead_type    TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rel_q_type_chk CHECK (question_type IN
    ('single_choice','multi_choice','slider','chips','visual_choice','ranking'))
);

CREATE INDEX IF NOT EXISTS rel_q_group_order_idx
  ON relationship_questions (group_id, display_order);
CREATE INDEX IF NOT EXISTS rel_q_active_idx
  ON relationship_questions (is_active, display_order);


-- ── 4 · relationship_question_options ──────────────────────────────
CREATE TABLE IF NOT EXISTS relationship_question_options (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id             UUID NOT NULL REFERENCES relationship_questions(id) ON DELETE CASCADE,
  value                   TEXT NOT NULL,
    -- canonical machine value (e.g. 'walnut', 'minimal_silent')
  label_default           TEXT NOT NULL,
    -- editorial label ("Walnut")
  helper_default          TEXT,
    -- subtitle / atmosphere hint
  tag_cluster             JSONB NOT NULL DEFAULT '[]'::jsonb,
  atmosphere              JSONB NOT NULL DEFAULT '[]'::jsonb,
  material                JSONB NOT NULL DEFAULT '[]'::jsonb,
  cultural_register       TEXT,
  luxury_tier             TEXT,
  intent_weight           NUMERIC(4,2) NOT NULL DEFAULT 0.0,
  image_url               TEXT,
    -- visual_choice support (Media Library URL)
  display_order           INT NOT NULL DEFAULT 100,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, value)
);

CREATE INDEX IF NOT EXISTS rel_q_opt_question_idx
  ON relationship_question_options (question_id, display_order);


-- ── 5 · relationship_answer_events ─────────────────────────────────
-- Append-only event log of every closed-answer choice. Source of truth
-- for analytics + AI tagging + Relationship Memory aggregation.
CREATE TABLE IF NOT EXISTS relationship_answer_events (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  lead_id                 UUID,
    -- soft FK to leads
  account_id              UUID,
    -- soft FK to accounts (post-progression)
  question_key            TEXT NOT NULL,
  option_value            TEXT,
    -- nullable for 'slider' / 'ranking' raw answers
  raw_value               JSONB,
    -- structured answer when option_value is insufficient
  group_key               TEXT,
    -- denorm for fast analytics
  occurred_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_surface          TEXT,
    -- 'intake_wizard' | 'continuation_interview' | 'designer_form'
  session_id              UUID,
    -- correlate answers from the same session
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS rel_answer_events_tenant_lead_idx
  ON relationship_answer_events (tenant_id, lead_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS rel_answer_events_group_idx
  ON relationship_answer_events (group_key, occurred_at DESC);
CREATE INDEX IF NOT EXISTS rel_answer_events_session_idx
  ON relationship_answer_events (session_id);


-- ── 6 · view · runtime catalog (groups + questions + options) ──────
-- Single source of truth for `/api/relationships/intake/groups`.
CREATE OR REPLACE VIEW relationship_catalog_v1 AS
SELECT
  g.id            AS group_id,
  g.group_key,
  g.display_order AS group_order,
  g.label_default AS group_label,
  g.sublabel_default AS group_sublabel,
  g.applies_to_lead_type AS group_applies_to,
  q.id            AS question_id,
  q.question_key,
  q.question_type,
  q.max_selections,
  q.prompt_default AS question_prompt,
  q.helper_default AS question_helper,
  q.is_required,
  q.display_order AS question_order,
  o.id            AS option_id,
  o.value         AS option_value,
  o.label_default AS option_label,
  o.helper_default AS option_helper,
  o.tag_cluster,
  o.atmosphere,
  o.material,
  o.cultural_register,
  o.luxury_tier,
  o.intent_weight,
  o.image_url,
  o.display_order AS option_order
FROM relationship_question_groups g
JOIN relationship_questions q
  ON q.group_id = g.id AND q.is_active
LEFT JOIN relationship_question_options o
  ON o.question_id = q.id AND o.is_active
WHERE g.is_active;


-- ── 7 · deprecation marker on legacy table ─────────────────────────
COMMENT ON TABLE lead_intake_questions IS
  'DEPRECATED (ITER148 Sprint A · 25 Feb 2026). Use relationship_question_groups + relationship_questions + relationship_question_options. Kept for backward compatibility of /api/relationships/intake/questions.';
