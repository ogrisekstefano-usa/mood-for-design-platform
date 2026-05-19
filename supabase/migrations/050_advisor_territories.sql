-- ────────────────────────────────────────────────────────────────────
-- 050_advisor_territories.sql — Relationship Territory Intelligence™
-- Phase 1: structured geo selection (Mapbox-backed) per advisor.
--
-- The legacy `advisor_profiles.territory` text field is retained for
-- backward compatibility, but the canonical truth lives here.
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS advisor_territories (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id         UUID NOT NULL REFERENCES advisor_profiles(id) ON DELETE CASCADE,
  territory_type     TEXT NOT NULL DEFAULT 'city',
    -- 'country' | 'macro_region' | 'state_province' | 'metropolitan_area' | 'city_cluster' | 'custom'
  country_code       TEXT,                              -- ISO-3166-1 alpha-2
  region             TEXT,                              -- e.g. 'Lombardia', 'Florida'
  sub_region         TEXT,                              -- e.g. 'Veneto', 'South Florida'
  city               TEXT,                              -- e.g. 'Milano', 'Miami'
  geo_label          TEXT NOT NULL,                     -- canonical display label
  mapbox_place_id    TEXT,                              -- e.g. 'place.123456'
  mapbox_place_type  TEXT,                              -- 'place' | 'region' | 'country' | ...
  latitude           NUMERIC(9,6),
  longitude          NUMERIC(9,6),
  bbox               JSONB,                             -- [west, south, east, north] when provided by Mapbox
  coverage_radius_km INTEGER,
  is_primary         BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adv_terr_advisor ON advisor_territories(advisor_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_adv_terr_country ON advisor_territories(country_code) WHERE country_code IS NOT NULL;

-- Only one primary per advisor (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS uq_adv_terr_primary
  ON advisor_territories(advisor_id) WHERE is_primary = TRUE;

COMMENT ON TABLE  advisor_territories IS
  'Structured geographic territories for advisors. Phase 1 = Mapbox-backed selector. Phase 2 = territory analytics. Phase 3 = adaptive matching.';
