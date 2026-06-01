-- Migration 028 — Studio Activation Flow V2 catalogs
-- ─────────────────────────────────────────────────────────────────────
-- Adds DB-driven catalogs for the new visitor funnel:
--   • studio_archetypes_v2 — categorie studio (Interior Design,
--                            Architecture, Showroom, Retailer,
--                            Design & Build, Brand, Other)
--   • studio_help_topics    — opzioni del "Come possiamo aiutarti?"
--   • studio_request_help_areas — N:M tra richiesta e topic scelti
-- NO hardcoded copy. Tutta la label/description vive su editorial_blocks
-- con namespace 'studio_v2.archetype' e 'studio_v2.help'.

CREATE TABLE IF NOT EXISTS studio_archetypes_v2 (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT NOT NULL UNIQUE,
  display_order      INT  NOT NULL DEFAULT 100,
  icon_key           TEXT NOT NULL,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  maps_to_archetype  TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_archetypes_v2_active
  ON studio_archetypes_v2(is_active, display_order);

CREATE TABLE IF NOT EXISTS studio_help_topics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,
  display_order       INT  NOT NULL DEFAULT 100,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  maps_to_experience  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_help_topics_active
  ON studio_help_topics(is_active, display_order);

CREATE TABLE IF NOT EXISTS studio_request_help_areas (
  request_id        UUID NOT NULL REFERENCES studio_requests(id) ON DELETE CASCADE,
  help_topic_code   TEXT NOT NULL,
  other_text        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (request_id, help_topic_code)
);

CREATE INDEX IF NOT EXISTS idx_studio_request_help_areas_req
  ON studio_request_help_areas(request_id);

-- Seed: 7 archetipi e 6 topic
INSERT INTO studio_archetypes_v2 (code, display_order, icon_key, maps_to_archetype) VALUES
  ('interior_design',  10, 'Sofa',         'interior_studio'),
  ('architecture',     20, 'Building2',    'architecture_firm'),
  ('showroom',         30, 'Store',        'luxury_showroom'),
  ('retailer',         40, 'ShoppingBag',  'design_retail'),
  ('design_build',     50, 'Hammer',       'interior_studio'),
  ('brand',            60, 'Tag',          'design_retail'),
  ('other',            70, 'MoreHorizontal','interior_studio')
ON CONFLICT (code) DO NOTHING;

INSERT INTO studio_help_topics (code, display_order, maps_to_experience) VALUES
  ('process_design',      10, 'design_journey_os'),
  ('materials',           20, 'material_intelligence'),
  ('client_presentation', 30, 'moodboard_experience'),
  ('team_coordination',   40, 'design_journey_os'),
  ('business_growth',     50, 'client_presentation_flow'),
  ('other',               60, NULL)
ON CONFLICT (code) DO NOTHING;

-- Add dial_code column on markets if not present (used by Step 3 phone prefix)
ALTER TABLE markets ADD COLUMN IF NOT EXISTS dial_code TEXT;
UPDATE markets SET dial_code = COALESCE(dial_code, CASE code
  WHEN 'IT'  THEN '+39'
  WHEN 'FR'  THEN '+33'
  WHEN 'DE'  THEN '+49'
  WHEN 'ES'  THEN '+34'
  WHEN 'GB'  THEN '+44'
  WHEN 'US'  THEN '+1'
  WHEN 'AE'  THEN '+971'
  WHEN 'PT'  THEN '+351'
  WHEN 'BR'  THEN '+55'
  WHEN 'CN'  THEN '+86'
  WHEN 'JP'  THEN '+81'
  WHEN 'MX'  THEN '+52'
  WHEN 'NA'  THEN NULL
  ELSE NULL
END);
