-- ────────────────────────────────────────────────────────────────────
-- 087_relationship_live_engine.sql · ITER150 · SPRINT A
-- REAL RELATIONSHIP ENGINE™ · client ↔ designer live synchronization
--
-- New unified `relationship_events` table — the "heartbeat" of the
-- platform. Every meaningful client action emits one row here.
--
-- Plus `relationship_status` — single row per lead, denormalised
-- status pointer for fast Status Bar™ reads.
--
-- Idempotent.
-- ────────────────────────────────────────────────────────────────────

-- ── 1 · relationship_events ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS relationship_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  lead_id             UUID,
  account_id          UUID,
  client_profile_id   UUID,
  designer_id         UUID,
    -- assigned designer at the moment of the event (soft FK users_profile.id)
  event_type          TEXT NOT NULL,
    -- briefing_started | briefing_completed | call_requested
    -- | message_sent   | moodboard_viewed   | proposal_opened
    -- | approval_requested | approval_confirmed
    -- | designer_assigned | designer_changed | timeline_progressed
    -- | file_uploaded | client_returned | project_direction_updated
    -- | status_changed | journey_resumed
  actor_type          TEXT NOT NULL DEFAULT 'system',
    -- 'client' | 'designer' | 'studio' | 'system'
  actor_id            UUID,
  actor_label         TEXT,
    -- denormalised "Sofia", "Studio Atelier" etc for fast read
  narrative           TEXT,
    -- editorial sentence ("Sofia ha riaperto il moodboard dopo 3 giorni")
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  visibility          TEXT NOT NULL DEFAULT 'both',
    -- 'client' | 'designer' | 'both' | 'studio'
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rel_events_actor_chk CHECK
    (actor_type IN ('client','designer','studio','system')),
  CONSTRAINT rel_events_vis_chk CHECK
    (visibility IN ('client','designer','both','studio'))
);

CREATE INDEX IF NOT EXISTS rel_events_designer_idx
  ON relationship_events (designer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS rel_events_lead_idx
  ON relationship_events (lead_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS rel_events_tenant_idx
  ON relationship_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS rel_events_client_idx
  ON relationship_events (client_profile_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS rel_events_type_idx
  ON relationship_events (event_type, occurred_at DESC);


-- ── 2 · relationship_status (Status Bar™) ──────────────────────────
-- One pointer per lead with the current journey state. Updated on
-- relevant events. Visible to both client and designer.
CREATE TABLE IF NOT EXISTS relationship_status (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  lead_id             UUID UNIQUE,
  status_key          TEXT NOT NULL DEFAULT 'awaiting_brief',
    -- awaiting_brief | reviewing_answers | preparing_direction
    -- | waiting_client_feedback | proposal_shared | approval_pending
    -- | journey_complete
  status_label_it     TEXT,
  status_label_en     TEXT,
  last_event_id       UUID,
  last_event_at       TIMESTAMPTZ,
  updated_by          UUID,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rel_status_key_chk CHECK (status_key IN (
    'awaiting_brief','reviewing_answers','preparing_direction',
    'waiting_client_feedback','proposal_shared','approval_pending',
    'journey_complete'
  ))
);

CREATE INDEX IF NOT EXISTS rel_status_tenant_idx
  ON relationship_status (tenant_id);


-- ── 3 · call_requests (Sprint A foothold for Sprint C booking) ─────
-- Persists "Book a Call" intents. Designer dashboard reads pending
-- requests directly. Sprint C wires the full booking flow on top.
CREATE TABLE IF NOT EXISTS call_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  lead_id             UUID,
  client_profile_id   UUID,
  designer_id         UUID,
  status              TEXT NOT NULL DEFAULT 'pending',
    -- pending | confirmed | rescheduled | rejected | completed
  preferred_slots     JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- [{ "start": ISO, "end": ISO, "tz": "Europe/Rome" }, …]
  timezone            TEXT,
  client_note         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT call_req_status_chk CHECK (status IN
    ('pending','confirmed','rescheduled','rejected','completed'))
);

CREATE INDEX IF NOT EXISTS call_req_designer_idx
  ON call_requests (designer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS call_req_tenant_idx
  ON call_requests (tenant_id, created_at DESC);
