-- =============================================================================
-- Blueprint Client Collaboration Layer™ — Generic foundation
-- Migration 012 · the shared review / feedback / approval infrastructure used
-- by Moodboard Builder PRO™ AND (future) Proposal Builder PRO™.
--
-- ARCHITECTURE RULE: every table uses (entity_type, entity_id) so the same
-- engine serves any future collaborative canvas. No "moodboard_id" foreign
-- keys here — those are application-level references kept in entity_id.
--
--   entity_type ∈ { 'moodboard', 'proposal', ... }
--   entity_id   = primary key of the host entity
--
-- All tables are tenant-scoped. Activity is a first-class table (not derived
-- from updated_at) so the timeline reads naturally as a creative
-- conversation, not as an audit log.
-- =============================================================================
BEGIN;

-- ── Comments (anchored x,y pins + threaded replies) ─────────────────────────
CREATE TABLE IF NOT EXISTS collab_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  -- Optional page/canvas-page scoping. For moodboards this is moodboard_pages.id.
  page_id         UUID,
  -- Thread root → if NULL, this row IS the root. Replies set this to the
  -- root comment id. Keeping a flat single-level structure for MVP.
  parent_id       UUID REFERENCES collab_comments(id) ON DELETE CASCADE,
  -- Anchored pin (percentages 0..100 relative to the page canvas) so the pin
  -- survives canvas resize. NULL = unanchored page-level comment.
  pin_x           NUMERIC(6,3),
  pin_y           NUMERIC(6,3),
  -- Comment classification — purely visual / informational, never enforced.
  -- Values: suggestion | issue | inspiration | approval_note
  kind            TEXT NOT NULL DEFAULT 'suggestion',
  body            TEXT NOT NULL,
  -- Author identity. If author_id is set the comment came from an
  -- authenticated user. Otherwise we capture client-side name/email at
  -- first comment (frictionless luxury) and persist locally in their browser.
  author_id       UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  author_role     TEXT NOT NULL DEFAULT 'client',
  -- designer | pm | client | super_admin (drives pin color in the UI)
  author_name     TEXT,
  author_email    TEXT,
  -- Resolution state — designer can mark a comment "resolved" when addressed.
  resolved        BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS collab_comments_entity_idx
  ON collab_comments(tenant_id, entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS collab_comments_page_idx
  ON collab_comments(entity_type, entity_id, page_id);
CREATE INDEX IF NOT EXISTS collab_comments_parent_idx
  ON collab_comments(parent_id);
CREATE INDEX IF NOT EXISTS collab_comments_unresolved_idx
  ON collab_comments(entity_type, entity_id) WHERE resolved = FALSE;

-- ── Page status (per page decisions: pending/approved/revision/rejected) ────
CREATE TABLE IF NOT EXISTS collab_page_status (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  page_id         UUID NOT NULL,
  -- pending_review | approved | revision_requested | rejected
  status          TEXT NOT NULL DEFAULT 'pending_review',
  decision_note   TEXT,
  decided_by_role TEXT,
  decided_by_id   UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  decided_by_name TEXT,
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One status row per (entity, page). Upsert target.
  UNIQUE (entity_type, entity_id, page_id)
);
CREATE INDEX IF NOT EXISTS collab_page_status_entity_idx
  ON collab_page_status(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS collab_page_status_status_idx
  ON collab_page_status(entity_type, entity_id, status);

-- ── Activity timeline ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collab_activity (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  page_id         UUID,
  -- comment_added | comment_resolved | page_approved | page_revision_requested |
  -- page_rejected | inspiration_added | version_snapshot | client_emotional_milestone |
  -- handoff_to_proposal | review_opened | review_closed
  event_type      TEXT NOT NULL,
  -- Compact human summary (already localized OR a translation key). Frontend
  -- decides; we store as plain text so the timeline never depends on
  -- runtime tables to render.
  summary         TEXT NOT NULL,
  payload_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id        UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  actor_role      TEXT,
  actor_name      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS collab_activity_entity_idx
  ON collab_activity(tenant_id, entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS collab_activity_event_idx
  ON collab_activity(event_type);

-- ── Client inspirations (client-side reference uploads) ─────────────────────
-- A separate table from `inspirations_items` (designer-owned creative archive)
-- because the lifecycle is different: these are uploads made by an
-- UNAUTHENTICATED client during a review session, and need to be ingested
-- (or auto-converted) into the designer's archive later.
CREATE TABLE IF NOT EXISTS collab_inspirations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  -- image | pdf | link | note
  type            TEXT NOT NULL DEFAULT 'image',
  title           TEXT,
  description     TEXT,
  asset_url       TEXT,
  thumbnail_url   TEXT,
  source_url      TEXT,
  metadata_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by_role TEXT NOT NULL DEFAULT 'client',
  uploaded_by_id  UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  uploaded_by_name TEXT,
  uploaded_by_email TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS collab_inspirations_entity_idx
  ON collab_inspirations(tenant_id, entity_type, entity_id, created_at DESC);

-- ── Version snapshots (lightweight revision history) ────────────────────────
CREATE TABLE IF NOT EXISTS collab_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  -- Monotonic per (entity_type, entity_id). The router computes the next
  -- value on insert so clients don't race on this.
  version_number  INTEGER NOT NULL,
  label           TEXT,
  -- Free-form designer note: "Updated after Marco's feedback"
  note            TEXT,
  -- Frozen snapshot of (pages + elements) at the moment of capture. The
  -- frontend can render a read-only diff or full restore later.
  snapshot_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by      UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, version_number)
);
CREATE INDEX IF NOT EXISTS collab_versions_entity_idx
  ON collab_versions(tenant_id, entity_type, entity_id, version_number DESC);

-- ── Permission grants ───────────────────────────────────────────────────────
-- Add COLLAB read/write to the same roles that get MOODBOARDS access. The
-- application-layer permission system (core/permissions.py) does the actual
-- enforcement; this comment is for tracking.
--   designer, owner, super_admin → write
--   client → public-route only (no permission grant required)

COMMIT;
