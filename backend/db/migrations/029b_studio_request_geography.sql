-- Migration 029b — Studio Request Geography
-- ─────────────────────────────────────────────────────────────────
-- Adds proper geo columns to studio_requests + bridge table for the
-- new "Target Countries" multi-select. Pure additive.

ALTER TABLE studio_requests
  ADD COLUMN IF NOT EXISTS primary_operating_market_id UUID
    REFERENCES markets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS headquarter_country_iso CHAR(2),
  ADD COLUMN IF NOT EXISTS headquarter_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS headquarter_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS mapbox_place_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sr_op_market
  ON studio_requests(primary_operating_market_id);
CREATE INDEX IF NOT EXISTS idx_sr_hq_country
  ON studio_requests(headquarter_country_iso);

CREATE TABLE IF NOT EXISTS studio_request_target_countries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_request_id UUID NOT NULL REFERENCES studio_requests(id) ON DELETE CASCADE,
  country_iso2      CHAR(2) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (studio_request_id, country_iso2)
);

CREATE INDEX IF NOT EXISTS idx_srtc_request
  ON studio_request_target_countries(studio_request_id);
CREATE INDEX IF NOT EXISTS idx_srtc_country
  ON studio_request_target_countries(country_iso2);
