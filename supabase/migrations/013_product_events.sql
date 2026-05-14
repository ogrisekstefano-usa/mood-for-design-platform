-- =============================================================================
-- Blueprint Telemetry — product-event log (lightweight).
-- Migration 013 · simple append-only event table for product insights.
--
-- ARCHITECTURE NOTE: this is NOT an audit log (we already have audit_log) and
-- NOT a server activity feed (we already have collab_activity). This table is
-- the raw stream of UI events the product team uses to understand HOW the
-- builder is being used: which templates are popular, how often designers
-- drag, how many exports per week, etc.
--
-- We intentionally keep the schema generic: any UI action emits an event
-- with a slug (`event_type`) + free-form JSONB payload. Future analytics
-- queries roll the events up by type / tenant / week. NO indexes on payload
-- columns for MVP — full table scans on aggregate jobs are fine until volume
-- justifies otherwise.
-- =============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS product_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  -- Slug — namespaced by surface, e.g.:
  --   moodboard.template_applied | moodboard.skeleton_applied
  --   moodboard.blank_created | moodboard.from_scratch
  --   moodboard.block_added | moodboard.exported | moodboard.shared
  event_type   TEXT NOT NULL,
  -- Optional entity refs the UI was acting on.
  entity_type  TEXT,
  entity_id    UUID,
  -- Arbitrary client payload — must remain non-PII.
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Session UUID generated client-side so anonymous events from the public
  -- review route can be correlated within a single visit.
  session_id   TEXT,
  ua           TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS product_events_tenant_idx
  ON product_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_events_type_idx
  ON product_events(event_type, created_at DESC);

COMMIT;
