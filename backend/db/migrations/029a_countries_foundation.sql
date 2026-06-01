-- Migration 029a — Countries Foundation
-- ─────────────────────────────────────────────────────────────────
-- Global ISO-3166-1 catalog (~250 records). Used by:
--   • Studio V2 Step 2 — Headquarter country picker
--   • Studio V2 Step 2 — Target countries multi-select
--   • Future Geo Intelligence dashboard
-- Seed payload lives in scripts/seed_countries.py (one-shot).

CREATE TABLE IF NOT EXISTS countries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iso2         CHAR(2) NOT NULL UNIQUE,
  iso3         CHAR(3) NOT NULL UNIQUE,
  name_en      TEXT NOT NULL,
  name_local   TEXT,
  continent    TEXT,
  region       TEXT,
  flag_emoji   TEXT,
  dial_code    TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INT     NOT NULL DEFAULT 100,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_countries_active   ON countries(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_countries_iso2     ON countries(iso2);
CREATE INDEX IF NOT EXISTS idx_countries_continent ON countries(continent);
