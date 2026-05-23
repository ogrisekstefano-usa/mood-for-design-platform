-- ────────────────────────────────────────────────────────────────────
-- 069_atelier_dashboard.sql — Atelier Dashboard™ DB-driven content model
--
-- ITER138 · Phase 2 (post-cinematic refinement) — Wave B Dashboard
-- removes ALL hardcoded mock content (hero images, fallback projects,
-- inspiration quotes) from the frontend. Every visible bit of dashboard
-- chrome is now tenant-scoped, locale-aware, and admin-editable.
--
-- Three entities:
--   • atelier_dashboard_config — per-tenant + per-locale (or default ALL)
--     hero copy + image binding + overlay profile + KPI mapping
--   • atelier_dashboard_media  — media bank (hero / project_card / inspiration)
--     with focal point + grading profile + locale variant
--   • atelier_dashboard_quotes — Daily Inspiration quote library
--
-- Coordinates with existing Media Library (uploads, media_assets table)
-- via media_asset_id FK when applicable. All three tables are tenant-
-- scoped; NULL tenant_id rows act as global system defaults visible to
-- every tenant until overridden.
-- ────────────────────────────────────────────────────────────────────

-- ── 1. ATELIER DASHBOARD CONFIG ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS atelier_dashboard_config (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- NULL = global system default (visible to every tenant that has no override)

  locale                   TEXT NOT NULL DEFAULT '*',
    -- '*' = applies to every locale (default)
    -- 'it-IT', 'en-US', 'fr-FR' etc. = locale-scoped override

  -- Hero composition
  hero_eyebrow             TEXT,         -- "Studio Pulse™ · Project Rhythm"
  hero_greeting_morning    TEXT,         -- "Good morning"
  hero_greeting_afternoon  TEXT,         -- "Good afternoon"
  hero_greeting_evening    TEXT,         -- "Good evening"
  hero_summary_template    TEXT,         -- "{active} Journeys unfolding · {voices} voices received today"
  hero_signature           TEXT,         -- "Let's shape beautiful spaces."

  hero_media_id            UUID,         -- FK to atelier_dashboard_media (hero image)
  hero_overlay_profile     TEXT DEFAULT 'cinematic_left',
    -- 'cinematic_left' | 'cinematic_full' | 'minimal' | 'warm_hospitality'

  -- KPI labels (4 slots — labels editorial)
  kpi_active_label         TEXT,         -- "Active Journeys"
  kpi_dossier_label        TEXT,         -- "Dossier in progress"
  kpi_awaiting_label       TEXT,         -- "Awaiting feedback"
  kpi_deliveries_label     TEXT,         -- "Deliveries this week"

  -- Section labels
  section_projects_title   TEXT,         -- "Journeys unfolding"
  section_projects_cta     TEXT,         -- "See all"
  section_activity_title   TEXT,         -- "Recent activity"
  section_milestones_title TEXT,         -- "Upcoming milestones"
  section_inspiration_title TEXT,        -- "Daily inspiration"

  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID REFERENCES users_profile(id),
  UNIQUE (tenant_id, locale)
);

CREATE INDEX IF NOT EXISTS atelier_dashboard_config_tenant_idx
  ON atelier_dashboard_config (tenant_id, locale);


-- ── 2. ATELIER DASHBOARD MEDIA ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS atelier_dashboard_media (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- NULL = global system asset

  media_kind               TEXT NOT NULL,
    -- 'hero' | 'project_card_fallback' | 'inspiration'

  file_url                 TEXT NOT NULL,
  media_asset_id           UUID,        -- optional FK to media_assets (Media Library)
  alt_text                 TEXT,

  -- Cinematic art direction controls
  focal_point_x            NUMERIC(4,3) DEFAULT 0.500 CHECK (focal_point_x BETWEEN 0 AND 1),
  focal_point_y            NUMERIC(4,3) DEFAULT 0.500 CHECK (focal_point_y BETWEEN 0 AND 1),
  grading_profile          TEXT DEFAULT 'nordic_cinematic',
    -- 'nordic_cinematic' | 'warm_hospitality' | 'editorial_neutral' | 'desaturated_film'
  overlay_intensity        NUMERIC(3,2) DEFAULT 0.45 CHECK (overlay_intensity BETWEEN 0 AND 1),
  brightness_offset        NUMERIC(3,2) DEFAULT 0.00 CHECK (brightness_offset BETWEEN -0.5 AND 0.5),

  locale                   TEXT NOT NULL DEFAULT '*',
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order               INTEGER NOT NULL DEFAULT 0,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID REFERENCES users_profile(id)
);

CREATE INDEX IF NOT EXISTS atelier_dashboard_media_kind_idx
  ON atelier_dashboard_media (tenant_id, media_kind, is_active, sort_order);


-- ── 3. ATELIER DASHBOARD QUOTES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS atelier_dashboard_quotes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- NULL = global curated quote (every tenant sees it)

  quote_text               TEXT NOT NULL,
  quote_author             TEXT,         -- "Coco Chanel" / "Dieter Rams" / etc
  quote_source             TEXT,         -- "Atelier voice library" / "Dieter Rams · Ten Principles"
  locale                   TEXT NOT NULL DEFAULT 'en-US',
    -- the locale this quote is authored in; ALE layer translates on-read

  media_id                 UUID REFERENCES atelier_dashboard_media(id) ON DELETE SET NULL,
    -- optional accompanying atmospheric image for the inspiration card

  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  schedule_starts_at       TIMESTAMPTZ,
  schedule_ends_at         TIMESTAMPTZ,
  sort_order               INTEGER NOT NULL DEFAULT 0,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID REFERENCES users_profile(id)
);

CREATE INDEX IF NOT EXISTS atelier_dashboard_quotes_active_idx
  ON atelier_dashboard_quotes (tenant_id, is_active, sort_order);


-- ── 4. GLOBAL SEED CONTENT (system fallback — visible to every tenant
--    until they create their own override). Tagged with NULL tenant_id.
-- ────────────────────────────────────────────────────────────────────

-- Hero asset · Aman-style moody architectural interior (Nordic warmth)
INSERT INTO atelier_dashboard_media (
  tenant_id, media_kind, file_url, alt_text, grading_profile, overlay_intensity, locale, sort_order
) VALUES (
  NULL, 'hero',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2400&q=85',
  'Architectural luxury interior with fireplace, wood walls and atmospheric light',
  'nordic_cinematic', 0.55, '*', 0
)
ON CONFLICT DO NOTHING;

-- Inspiration atmospheric landscape · Nordic lake/fjord at dusk
INSERT INTO atelier_dashboard_media (
  tenant_id, media_kind, file_url, alt_text, grading_profile, overlay_intensity, locale, sort_order
) VALUES (
  NULL, 'inspiration',
  'https://images.unsplash.com/photo-1465056836041-7f43ac27dcb5?auto=format&fit=crop&w=1600&q=85',
  'Atmospheric mountain landscape at dusk · Nordic stillness',
  'nordic_cinematic', 0.65, '*', 0
)
ON CONFLICT DO NOTHING;

-- 4 project card fallback covers · dark moody Nordic architecture family
INSERT INTO atelier_dashboard_media (tenant_id, media_kind, file_url, alt_text, grading_profile, overlay_intensity, locale, sort_order) VALUES
(NULL, 'project_card_fallback',
 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1400&q=80',
 'Nordic lake retreat at dusk', 'nordic_cinematic', 0.50, '*', 0),
(NULL, 'project_card_fallback',
 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80',
 'Dark moody luxury living room', 'nordic_cinematic', 0.50, '*', 1),
(NULL, 'project_card_fallback',
 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1400&q=80',
 'Heritage architectural interior with warm shadows', 'nordic_cinematic', 0.50, '*', 2),
(NULL, 'project_card_fallback',
 'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=1400&q=80',
 'Coastal architecture at dusk · cinematic atmosphere', 'nordic_cinematic', 0.50, '*', 3)
ON CONFLICT DO NOTHING;

-- 4 curated inspiration quotes (en-US source — ALE translates on read)
INSERT INTO atelier_dashboard_quotes (tenant_id, quote_text, quote_author, quote_source, locale, sort_order) VALUES
(NULL, 'Simplicity is the keynote of all true elegance.', 'Coco Chanel',
 'Atelier voice library · classic',                   'en-US', 0),
(NULL, 'The details are not the details. They make the design.', 'Charles Eames',
 'Atelier voice library · classic',                   'en-US', 1),
(NULL, 'Less, but better.', 'Dieter Rams',
 'Atelier voice library · Ten Principles',            'en-US', 2),
(NULL, 'Form follows emotion.', 'Hartmut Esslinger',
 'Atelier voice library · industrial design',         'en-US', 3)
ON CONFLICT DO NOTHING;

-- Global default config row (NULL tenant_id, '*' locale)
INSERT INTO atelier_dashboard_config (
  tenant_id, locale,
  hero_eyebrow, hero_greeting_morning, hero_greeting_afternoon, hero_greeting_evening,
  hero_summary_template, hero_signature,
  hero_overlay_profile,
  kpi_active_label, kpi_dossier_label, kpi_awaiting_label, kpi_deliveries_label,
  section_projects_title, section_projects_cta,
  section_activity_title, section_milestones_title, section_inspiration_title
) VALUES (
  NULL, '*',
  'Studio Pulse™ · Project Rhythm',
  'Good morning', 'Good afternoon', 'Good evening',
  '{active} Journeys unfolding · {voices} voices received today',
  'Let''s shape beautiful spaces.',
  'cinematic_left',
  'Active Journeys', 'Dossier in progress', 'Awaiting feedback', 'Deliveries this week',
  'Journeys unfolding', 'See all',
  'Recent activity', 'Upcoming milestones', 'Daily inspiration'
)
ON CONFLICT (tenant_id, locale) DO NOTHING;
