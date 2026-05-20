-- ────────────────────────────────────────────────────────────────────
-- 063_journey_root_entity.sql · Sprint G.1 · Semantic Architecture Lock
--
-- This migration is NOT a "technical add columns" pass. It is the
-- semantic anchor of the Design Journey OS™: every artifact and every
-- relationship must reflect the Journey as the root operational entity.
--
-- Idempotent. Reversible. Zero data loss.
-- See /app/memory/G1_SEMANTIC_ARCHITECTURE_LOCK.md for the full spec.
-- ────────────────────────────────────────────────────────────────────

-- ── §1. JOURNEY ROOT LINK ──────────────────────────────────────────
-- A Journey now points to an Account explicitly (FK soft, nullable to
-- preserve compatibility with project-only legacy data). A Journey also
-- carries a richer lifecycle_state superset that augments the existing
-- overall_status (which is preserved for backward compat).

ALTER TABLE design_journeys
  ADD COLUMN IF NOT EXISTS account_id     UUID,        -- soft FK to accounts(id)
  ADD COLUMN IF NOT EXISTS lifecycle_state TEXT;

-- Canonical lifecycle_state superset (CHECK as soft validation: NULL OK).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'design_journeys_lifecycle_chk'
  ) THEN
    ALTER TABLE design_journeys
      ADD CONSTRAINT design_journeys_lifecycle_chk
      CHECK (lifecycle_state IS NULL OR lifecycle_state IN (
        'conversation_open',  -- pre-journey, only Account exists (G.2 entry)
        'in_progress',        -- viaggio aperto, capitoli in evoluzione
        'presenting',         -- capitoli condivisi, attesa voce
        'drifting',           -- silenzio prolungato dopo presented (analytics)
        'on_pause',           -- pausa volontaria
        'approved',           -- direzione condivisa raggiunta
        'closed',             -- certified closure (compat con overall_status)
        'editioned',          -- cultural edition generata (G.10)
        'abandoned'           -- viaggio interrotto senza closure
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS design_journeys_account_idx
  ON design_journeys (tenant_id, account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS design_journeys_lifecycle_idx
  ON design_journeys (tenant_id, lifecycle_state) WHERE lifecycle_state IS NOT NULL;


-- ── §2. ARTIFACT ROOT LINKS ────────────────────────────────────────
-- Each step-bound artifact now knows its Journey + Step. Soft FKs:
-- nullable, no REFERENCES (preserves legacy rows; broken refs are
-- handled by the application layer via the journey_artifacts VIEW).

ALTER TABLE moodboards
  ADD COLUMN IF NOT EXISTS journey_id   UUID,
  ADD COLUMN IF NOT EXISTS milestone_id UUID;

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS journey_id   UUID,
  ADD COLUMN IF NOT EXISTS milestone_id UUID;

ALTER TABLE curated_collections
  ADD COLUMN IF NOT EXISTS journey_id   UUID,
  ADD COLUMN IF NOT EXISTS milestone_id UUID;

CREATE INDEX IF NOT EXISTS moodboards_journey_idx
  ON moodboards (tenant_id, journey_id) WHERE journey_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS moodboards_milestone_idx
  ON moodboards (milestone_id) WHERE milestone_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS proposals_journey_idx
  ON proposals (tenant_id, journey_id) WHERE journey_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS proposals_milestone_idx
  ON proposals (milestone_id) WHERE milestone_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS curated_collections_journey_idx
  ON curated_collections (tenant_id, journey_id) WHERE journey_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS curated_collections_milestone_idx
  ON curated_collections (milestone_id) WHERE milestone_id IS NOT NULL;


-- ── §3. CANONICAL EVENT TAXONOMY ───────────────────────────────────
-- The existing event_type stays free-text for legacy. event_canon is
-- the new canonical taxonomy used by analytics, notifications, future
-- AI memory, and Journey Pulse views.

ALTER TABLE journey_timeline_events
  ADD COLUMN IF NOT EXISTS event_canon TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journey_timeline_events_canon_chk'
  ) THEN
    ALTER TABLE journey_timeline_events
      ADD CONSTRAINT journey_timeline_events_canon_chk
      CHECK (event_canon IS NULL OR event_canon IN (
        'journey_created',
        'brief_started',
        'inspirations_aligned',
        'moodboard_uploaded',
        'revision_requested',
        'version_approved',
        'client_feedback_added',
        'journey_paused',
        'journey_abandoned',
        'journey_completed'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS journey_timeline_events_canon_idx
  ON journey_timeline_events (tenant_id, event_canon, created_at DESC)
  WHERE event_canon IS NOT NULL;


-- ── §4. JOURNEY HEALTH SIGNALS (analytics readiness) ───────────────
-- Background analytics-emitted flags: drift_warning, silence_alert,
-- reorient_overdue, bridge_pause. Resolved (cleared) when corrective
-- action happens. Append-only ledger semantics + soft resolve.

CREATE TABLE IF NOT EXISTS journey_health_signals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  journey_id    UUID NOT NULL REFERENCES design_journeys(id) ON DELETE CASCADE,
  milestone_id  UUID,                                  -- optional
  signal_kind   TEXT NOT NULL CHECK (signal_kind IN (
                  'drift_warning',       -- >30gg conversation_open senza voce
                  'silence_alert',       -- >14gg presented senza feedback
                  'reorient_overdue',    -- >21gg revision_requested senza nuova version
                  'bridge_pause'         -- >30gg tra approved e step successivo
                )),
  severity      TEXT NOT NULL DEFAULT 'soft'
                  CHECK (severity IN ('soft','attention','urgent')),
  observed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS journey_health_signals_open_idx
  ON journey_health_signals (tenant_id, journey_id, observed_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS journey_health_signals_kind_idx
  ON journey_health_signals (tenant_id, signal_kind, observed_at DESC);


-- ── §5. VIEW journey_artifacts — unified read ──────────────────────
-- One query path that returns every artifact tied to a Journey,
-- regardless of which underlying table it lives in. Includes legacy
-- rows via project_id fallback so the UI doesn't need to know the
-- physical sharding.

DROP VIEW IF EXISTS journey_artifacts;
CREATE VIEW journey_artifacts AS
SELECT
  COALESCE(m.journey_id, j.id)            AS journey_id,
  m.milestone_id                          AS milestone_id,
  'moodboard'::text                       AS artifact_type,
  m.id                                    AS artifact_id,
  m.tenant_id                             AS tenant_id,
  m.title                                 AS title,
  m.status::text                          AS status,
  m.created_by                            AS created_by,
  m.created_at                            AS created_at,
  m.updated_at                            AS updated_at,
  m.archived_at                           AS archived_at
FROM moodboards m
LEFT JOIN design_journeys j
       ON j.project_id = m.project_id AND j.tenant_id = m.tenant_id
WHERE m.deleted_at IS NULL

UNION ALL

SELECT
  COALESCE(p.journey_id, j.id)            AS journey_id,
  p.milestone_id                          AS milestone_id,
  'proposal'::text                        AS artifact_type,
  p.id                                    AS artifact_id,
  p.tenant_id                             AS tenant_id,
  p.title                                 AS title,
  p.status::text                          AS status,
  p.created_by                            AS created_by,
  p.created_at                            AS created_at,
  p.updated_at                            AS updated_at,
  NULL::timestamptz                       AS archived_at
FROM proposals p
LEFT JOIN design_journeys j
       ON j.project_id = p.project_id AND j.tenant_id = p.tenant_id

UNION ALL

SELECT
  cc.journey_id                           AS journey_id,
  cc.milestone_id                         AS milestone_id,
  'curated_collection'::text              AS artifact_type,
  cc.id                                   AS artifact_id,
  cc.tenant_id                            AS tenant_id,
  cc.title                                AS title,
  cc.visibility::text                     AS status,
  cc.user_id                              AS created_by,
  cc.created_at                           AS created_at,
  cc.updated_at                           AS updated_at,
  NULL::timestamptz                       AS archived_at
FROM curated_collections cc;

COMMENT ON VIEW journey_artifacts IS
  'G.1 · Semantic union of all step-bound artifacts per Journey. Reads from moodboards/proposals/curated_collections with legacy project_id fallback. Read-only.';


-- ── §6. BACKFILLS — best-effort, idempotent ────────────────────────

-- §6.1 design_journeys.account_id ← relationship_projects.account_id
-- via project_id match. Best-effort: leaves NULL if not found.
UPDATE design_journeys j
SET account_id = rp.account_id
FROM relationship_projects rp
WHERE rp.tenant_id = j.tenant_id
  AND rp.project_id = j.project_id
  AND j.account_id IS NULL;

-- §6.2 design_journeys.lifecycle_state ← derive from overall_status
-- ('in_progress' → in_progress, 'closed' → closed). New journeys may
-- start with 'conversation_open' (Sprint G.2 will set it explicitly).
UPDATE design_journeys
SET lifecycle_state = CASE
  WHEN overall_status = 'closed' THEN 'closed'
  WHEN overall_status = 'in_progress' THEN 'in_progress'
  ELSE 'in_progress'
END
WHERE lifecycle_state IS NULL;

-- §6.3 moodboards.journey_id + milestone_id ← via project_id lookup.
-- Heuristic for milestone_id: moodboard_direction (the canonical step).
WITH lookup AS (
  SELECT m.id AS moodboard_id,
         j.id AS jid,
         (SELECT mi.id FROM journey_milestones mi
            WHERE mi.journey_id = j.id
              AND mi.milestone_type = 'moodboard_direction'
            LIMIT 1) AS mid
  FROM moodboards m
  JOIN design_journeys j
    ON j.project_id = m.project_id AND j.tenant_id = m.tenant_id
  WHERE m.journey_id IS NULL
)
UPDATE moodboards mm
SET journey_id = lk.jid,
    milestone_id = COALESCE(mm.milestone_id, lk.mid)
FROM lookup lk
WHERE mm.id = lk.moodboard_id;

-- §6.4 proposals.journey_id + milestone_id ← via project_id lookup.
-- Heuristic for milestone_id: final_presentation.
WITH lookup AS (
  SELECT p.id AS proposal_id,
         j.id AS jid,
         (SELECT mi.id FROM journey_milestones mi
            WHERE mi.journey_id = j.id
              AND mi.milestone_type = 'final_presentation'
            LIMIT 1) AS mid
  FROM proposals p
  JOIN design_journeys j
    ON j.project_id = p.project_id AND j.tenant_id = p.tenant_id
  WHERE p.journey_id IS NULL
)
UPDATE proposals pp
SET journey_id = lk.jid,
    milestone_id = COALESCE(pp.milestone_id, lk.mid)
FROM lookup lk
WHERE pp.id = lk.proposal_id;

-- §6.5 journey_timeline_events.event_canon ← derive from legacy event_type
UPDATE journey_timeline_events
SET event_canon = CASE event_type
  WHEN 'journey_started'              THEN 'journey_created'
  WHEN 'journey_closed'               THEN 'journey_completed'
  WHEN 'milestone_started'            THEN 'brief_started'
  WHEN 'milestone_revision_requested' THEN 'revision_requested'
  WHEN 'milestone_approved'           THEN 'version_approved'
  WHEN 'milestone_partially_approved' THEN 'version_approved'
  WHEN 'client_voice'                 THEN 'client_feedback_added'
  WHEN 'chapter_added'                THEN 'client_feedback_added'
  ELSE NULL
END
WHERE event_canon IS NULL;


-- ── §7. SEMANTIC COMMENTS (documentation in the DB) ────────────────

COMMENT ON COLUMN design_journeys.account_id IS
  'G.1 · Soft FK to accounts(id). Lets Journey hang off Account directly without traversing relationship_projects. NULL allowed for legacy/orphan journeys.';
COMMENT ON COLUMN design_journeys.lifecycle_state IS
  'G.1 · Canonical journey lifecycle: conversation_open|in_progress|presenting|drifting|on_pause|approved|closed|editioned|abandoned. Augments (not replaces) overall_status.';

COMMENT ON COLUMN moodboards.journey_id IS 'G.1 · Soft FK to design_journeys(id). Step Artifact anchor.';
COMMENT ON COLUMN moodboards.milestone_id IS 'G.1 · Soft FK to journey_milestones(id). Typically moodboard_direction.';
COMMENT ON COLUMN proposals.journey_id IS 'G.1 · Soft FK to design_journeys(id).';
COMMENT ON COLUMN proposals.milestone_id IS 'G.1 · Soft FK to journey_milestones(id). Typically final_presentation.';
COMMENT ON COLUMN curated_collections.journey_id IS 'G.1 · Soft FK to design_journeys(id). NULL when collection is a global studio archive.';
COMMENT ON COLUMN curated_collections.milestone_id IS 'G.1 · Soft FK to journey_milestones(id).';

COMMENT ON COLUMN journey_timeline_events.event_canon IS
  'G.1 · Canonical event taxonomy used by analytics + AI memory: journey_created|brief_started|inspirations_aligned|moodboard_uploaded|revision_requested|version_approved|client_feedback_added|journey_paused|journey_abandoned|journey_completed.';

COMMENT ON TABLE journey_health_signals IS
  'G.1 · Background-emitted journey health flags (drift_warning, silence_alert, reorient_overdue, bridge_pause). Soft-resolve via resolved_at.';

-- ── End of 063_journey_root_entity.sql ─────────────────────────────
