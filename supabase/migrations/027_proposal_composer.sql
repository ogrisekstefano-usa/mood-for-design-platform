-- ───────────────────────────────────────────────────────────────────────
-- Phase P0.6.D — Compose Proposal™
-- Extends `proposals` with editorial composer fields. The classic
-- columns (title, description, total_value, currency, status, version)
-- remain — Compose Proposal™ adds the cinematic editorial layer on top.
-- ───────────────────────────────────────────────────────────────────────

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS sections            JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS style               TEXT,
  -- 'residential' | 'hospitality' | 'retail' | 'developer' | 'investor' | 'private_client'
  ADD COLUMN IF NOT EXISTS narrative_tone      TEXT,
  -- 'minimal_editorial' | 'warm_mediterranean' | 'quiet_luxury' | 'architectural' |
  -- 'bold_hospitality' | 'collector_level'
  ADD COLUMN IF NOT EXISTS investment_tier     TEXT,
  -- 'essential_direction' | 'elevated_residential' | 'signature_hospitality' | 'collector_level'
  ADD COLUMN IF NOT EXISTS market              TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url     TEXT,
  ADD COLUMN IF NOT EXISTS source_direction_id UUID,
  ADD COLUMN IF NOT EXISTS show_numeric_pricing BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sections_included   JSONB NOT NULL DEFAULT '[]'::jsonb;
-- sections_included: ordered array of enabled section keys, e.g.
--   ["opening","strategic_direction","visual_inspirations","material_language",
--    "project_vision","suggested_scope","investment","timeline","signature"]

CREATE INDEX IF NOT EXISTS idx_proposals_style
  ON proposals(tenant_id, style);
CREATE INDEX IF NOT EXISTS idx_proposals_source_direction
  ON proposals(source_direction_id);
