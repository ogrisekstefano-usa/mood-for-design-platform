-- ────────────────────────────────────────────────────────────────────
-- 090_design_direction_engine.sql · ITER152 · SPRINT D
-- Design Direction™ — relationship intelligence layer
--
-- 1. relationship_direction_signals — granular signals ingested
--    from onboarding answers, conversation, magazine, moodboard
-- 2. relationship_direction_snapshots — editorial distillations
--    persisted as "design identity moments" (AI-distilled)
--
-- Idempotent.
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS relationship_direction_signals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  lead_id             UUID,
  client_profile_id   UUID,
  signal_type         TEXT NOT NULL,
    -- atmosphere | materials | lifestyle | cultural_register
    -- | spatial_behavior | emotional_rhythm | hospitality_tendency
    -- | color_language | project_energy | visual_alignment
  signal_key          TEXT NOT NULL,
    -- normalised key inside the type ("warm_contemporary",
    --  "oak", "slow_living", "milan_editorial", …)
  signal_value        TEXT,
    -- raw human-readable label
  confidence          NUMERIC(3,2) NOT NULL DEFAULT 0.50,
  weight              NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  source_type         TEXT NOT NULL,
    -- onboarding | conversation | moodboard | magazine
    -- | inspiration | journey_event | manual
  source_reference_id UUID,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rds_type_chk CHECK (signal_type IN (
    'atmosphere','materials','lifestyle','cultural_register',
    'spatial_behavior','emotional_rhythm','hospitality_tendency',
    'color_language','project_energy','visual_alignment'
  ))
);

CREATE INDEX IF NOT EXISTS rds_lead_idx
  ON relationship_direction_signals (lead_id, signal_type, created_at DESC);
CREATE INDEX IF NOT EXISTS rds_client_idx
  ON relationship_direction_signals (client_profile_id, signal_type, created_at DESC);
CREATE INDEX IF NOT EXISTS rds_tenant_idx
  ON relationship_direction_signals (tenant_id, created_at DESC);


CREATE TABLE IF NOT EXISTS relationship_direction_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  lead_id             UUID,
  client_profile_id   UUID,
  atmosphere_summary  JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- { headline, narrative, chips: [...] }
  material_summary    JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- { headline, narrative, materials: [{name, tone}] }
  lifestyle_summary   JSONB NOT NULL DEFAULT '{}'::jsonb,
  cultural_summary    JSONB NOT NULL DEFAULT '{}'::jsonb,
  palette_summary     JSONB NOT NULL DEFAULT '{}'::jsonb,
  narrative_summary   TEXT,
    -- editorial paragraph synthesising the whole moment
  signals_count       INT NOT NULL DEFAULT 0,
  generated_by        TEXT NOT NULL DEFAULT 'claude-sonnet',
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rdsn_lead_idx
  ON relationship_direction_snapshots (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rdsn_client_idx
  ON relationship_direction_snapshots (client_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rdsn_tenant_idx
  ON relationship_direction_snapshots (tenant_id, created_at DESC);
