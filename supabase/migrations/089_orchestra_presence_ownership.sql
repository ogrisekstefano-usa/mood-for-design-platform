-- ────────────────────────────────────────────────────────────────────
-- 089_orchestra_presence_ownership.sql · ITER151 · SPRINT C
-- Real Human Presence · Relationship Ownership™ · Curatorial Booking
--
-- 1. Extend `call_requests` for curatorial booking flow
-- 2. Create `designer_presence` (narrative states · NOT online/offline)
-- 3. Create `relationship_ownership` (primary/secondary/collaborators)
--
-- Idempotent.
-- ────────────────────────────────────────────────────────────────────

-- ── 1 · call_requests · curatorial extension ───────────────────────
ALTER TABLE call_requests
  ADD COLUMN IF NOT EXISTS client_timezone   TEXT,
  ADD COLUMN IF NOT EXISTS designer_timezone TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_slot    JSONB,
  ADD COLUMN IF NOT EXISTS confirmed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by      UUID,
  ADD COLUMN IF NOT EXISTS reschedule_slots  JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS designer_note     TEXT,
  ADD COLUMN IF NOT EXISTS conversation_kind TEXT DEFAULT 'discovery';
    -- discovery | proposal_review | material_walk | site_walk | follow_up


-- ── 2 · designer_presence ──────────────────────────────────────────
-- NOT online/offline. Narrative editorial states the designer chooses
-- to reveal to clients. One row per designer (upsert by designer_id).
CREATE TABLE IF NOT EXISTS designer_presence (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  designer_id         UUID NOT NULL UNIQUE,
  state_key           TEXT NOT NULL DEFAULT 'in_studio',
    -- in_studio | reviewing_materials | curating_inspirations
    -- | preparing_concepts | in_presentation | with_clients
    -- | site_visit | away
  state_label_it      TEXT,
  state_label_en      TEXT,
  note                TEXT,  -- optional editorial micro-line
  timezone            TEXT,  -- IANA tz (Europe/Rome, …)
  expires_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dpr_state_chk CHECK (state_key IN
    ('in_studio','reviewing_materials','curating_inspirations',
     'preparing_concepts','in_presentation','with_clients',
     'site_visit','away'))
);

CREATE INDEX IF NOT EXISTS dpr_tenant_idx ON designer_presence (tenant_id);


-- ── 3 · relationship_ownership ─────────────────────────────────────
-- Multi-role assignment per lead. role: primary | secondary | observer
-- | collaborator. Primary is unique per (tenant, lead).
CREATE TABLE IF NOT EXISTS relationship_ownership (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  lead_id             UUID NOT NULL,
  designer_id         UUID NOT NULL,
  role                TEXT NOT NULL DEFAULT 'collaborator',
    -- primary | secondary | collaborator | observer
  specialty           TEXT,  -- "Material Direction", "Site Coordination"…
  added_by            UUID,
  added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rel_own_role_chk CHECK (role IN
    ('primary','secondary','collaborator','observer'))
);

CREATE UNIQUE INDEX IF NOT EXISTS rel_own_unique
  ON relationship_ownership (tenant_id, lead_id, designer_id);
CREATE UNIQUE INDEX IF NOT EXISTS rel_own_one_primary
  ON relationship_ownership (tenant_id, lead_id)
  WHERE role = 'primary';
CREATE INDEX IF NOT EXISTS rel_own_designer_idx
  ON relationship_ownership (designer_id, role);
