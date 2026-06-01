-- Migration 030 — Geographic refinements
-- ─────────────────────────────────────────────────────────────────
-- 1) studio_requests.headquarter_region (state/province from Mapbox)
-- 2) studio_request_target_countries: priority (1..N) + status enum

ALTER TABLE studio_requests
  ADD COLUMN IF NOT EXISTS headquarter_region TEXT;

ALTER TABLE studio_request_target_countries
  ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status   TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('active', 'planned'));

CREATE INDEX IF NOT EXISTS idx_srtc_priority
  ON studio_request_target_countries(studio_request_id, priority);
