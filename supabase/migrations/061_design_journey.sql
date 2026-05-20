-- ────────────────────────────────────────────────────────────────────
-- 061_design_journey.sql — Phase F.A · Design Journey™ Foundation
--
-- Tre tabelle per la spina dorsale del progetto:
--   • design_journeys          — un journey per progetto
--   • journey_milestones       — 10 pietre miliari narrative
--   • journey_timeline_events  — eventi narrativi italiani
-- ────────────────────────────────────────────────────────────────────

-- ── 1. DESIGN JOURNEYS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS design_journeys (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id              UUID NOT NULL,                   -- soft FK to projects
  current_milestone_id    UUID,                            -- soft FK to journey_milestones
  overall_status          TEXT NOT NULL DEFAULT 'in_progress',
    -- 'in_progress' | 'closed'
  started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at               TIMESTAMPTZ,
  created_by              UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS design_journeys_project_idx
  ON design_journeys (tenant_id, project_id);


-- ── 2. JOURNEY MILESTONES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journey_milestones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id          UUID NOT NULL REFERENCES design_journeys(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  milestone_type      TEXT NOT NULL,
    -- 'brief' | 'inspirations' | 'moodboard_direction' | 'material_direction'
    -- 'concept_design' | 'technical_package' | 'curated_selections'
    -- 'site_evolution' | 'final_presentation' | 'certified_closure'
  title               TEXT NOT NULL,
  description         TEXT,
  order_index         INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'not_started',
    -- 'not_started' | 'in_progress' | 'presented' | 'revision_requested'
    -- 'partially_approved' | 'approved' | 'closed'
  started_at          TIMESTAMPTZ,
  presented_at        TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ,
  owner_user_id       UUID,
  linked_entity_type  TEXT,                                -- 'moodboard' | 'inspiration_collection' | etc.
  linked_entity_id    UUID,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS journey_milestones_journey_idx
  ON journey_milestones (journey_id, order_index);


-- ── 3. JOURNEY TIMELINE EVENTS ──────────────────────────────────────
-- Storia narrativa del progetto. NON technical log.
CREATE TABLE IF NOT EXISTS journey_timeline_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id          UUID NOT NULL REFERENCES design_journeys(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  milestone_id        UUID,                                -- soft FK
  event_type          TEXT NOT NULL,
    -- 'journey_started' | 'milestone_started' | 'milestone_presented'
    -- 'milestone_revision_requested' | 'milestone_approved'
    -- 'milestone_partially_approved' | 'milestone_closed'
    -- 'journey_closed' | 'note'
  narrative_text      TEXT NOT NULL,                       -- italian editorial sentence
  created_by          UUID,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS journey_timeline_events_journey_idx
  ON journey_timeline_events (journey_id, created_at DESC);
