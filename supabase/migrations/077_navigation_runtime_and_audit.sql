-- ────────────────────────────────────────────────────────────────────
-- 077_navigation_runtime_and_audit.sql · ITER144
-- NAVIGATION RUNTIME™ + THEME RUNTIME™ + CONFIGURATION AUDIT TRAIL™
--
-- This migration is purely additive on top of 076 and is the freeze
-- step that makes ITER144 a runtime-driven architecture:
--
--   • feature_modules_registry gains the columns required to fully
--     describe the navigation tree (group, icon, route, visibility,
--     parent_code, section_label).
--   • tenant_configuration gains a `branding` JSONB blob, a
--     `navigation_overrides` JSONB (per-tenant menu visibility/order),
--     and a `custom_domain` field (future-ready freeze).
--   • configuration_change_events: full audit trail of every PATCH on
--     tenant_configuration / platform_feature_defaults.
-- ────────────────────────────────────────────────────────────────────

-- 1. Extend feature_modules_registry with navigation metadata.
ALTER TABLE feature_modules_registry
  ADD COLUMN IF NOT EXISTS nav_route        TEXT,
  ADD COLUMN IF NOT EXISTS nav_icon         TEXT,
  ADD COLUMN IF NOT EXISTS nav_group        TEXT,
  ADD COLUMN IF NOT EXISTS nav_section_label TEXT,
  ADD COLUMN IF NOT EXISTS nav_visibility   TEXT NOT NULL DEFAULT 'tenant'
    CHECK (nav_visibility IN ('public','tenant','tenant_admin','super_admin','root_superadmin')),
  ADD COLUMN IF NOT EXISTS nav_end_match    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nav_has_mark     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nav_test_id      TEXT,
  ADD COLUMN IF NOT EXISTS nav_lazy_chunk   TEXT,
  ADD COLUMN IF NOT EXISTS group_position   INTEGER NOT NULL DEFAULT 100;

-- 2. Extend tenant_configuration with branding + nav overrides + custom domain.
ALTER TABLE tenant_configuration
  ADD COLUMN IF NOT EXISTS branding             JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS navigation_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_domain        TEXT,
  ADD COLUMN IF NOT EXISTS custom_email_identity JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Configuration audit trail.
CREATE TABLE IF NOT EXISTS configuration_change_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
  actor_user_id   UUID,
  actor_email     TEXT,
  event_type      TEXT NOT NULL,
    -- 'tenant.configuration.patch', 'platform.feature_default.patch',
    -- 'tenant.module.toggle', 'tenant.branding.patch', …
  scope           TEXT NOT NULL DEFAULT 'tenant'
                  CHECK (scope IN ('tenant','platform')),
  source          TEXT,                          -- 'tenant_admin_ui','blueprint_admin','api','seed'
  module_code     TEXT,                          -- when relevant
  diff_before     JSONB NOT NULL DEFAULT '{}'::jsonb,
  diff_after      JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS configuration_change_events_tenant_idx
  ON configuration_change_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS configuration_change_events_event_type_idx
  ON configuration_change_events (event_type, created_at DESC);

-- 4. Seed the canonical feature_modules_registry — one row per module
-- that today lives hardcoded inside Sidebar.jsx + App.js. ITER144 freeze.
INSERT INTO feature_modules_registry
  (code, display_name, category, description, default_state, required_role,
   is_core, position, nav_route, nav_icon, nav_group, nav_section_label,
   nav_visibility, nav_end_match, nav_has_mark, group_position)
VALUES
  -- Studio Pulse
  ('dashboard',          'Dashboard',             'core',       'Studio mission control.',                   'enabled','tenant',TRUE,  10, '/dashboard',              'LayoutDashboard','studio-pulse','Studio Pulse',     'tenant',TRUE, TRUE,  10),

  -- Design Journey
  ('journey_index',      'All Journeys',          'core',       'Index of every project journey.',           'enabled','tenant',TRUE,  20, '/workspace/projects',     'Compass',         'design-journey','Design Journey',  'tenant',FALSE,FALSE, 20),
  ('begin_journey',      'Start a Journey',       'core',       'Onboarding wizard for new journeys.',       'enabled','tenant',TRUE,  21, '/begin-journey',          'Sparkles',        'design-journey','Design Journey',  'tenant',FALSE,TRUE,  20),

  -- Curatorial Atlas
  ('inspirations',       'Inspirations',          'content',    'Creative memory archive.',                  'enabled','tenant',FALSE, 30, '/inspirations',           'Bookmark',        'curatorial-atlas','Curatorial Atlas','tenant',TRUE, FALSE, 30),
  ('brand_atlas',        'Brand Atlas',           'content',    'Curated brand registry.',                   'enabled','tenant',FALSE, 31, '/inspirations/brands',    'Sparkles',        'curatorial-atlas','Curatorial Atlas','tenant',FALSE,TRUE,  30),
  ('material_view',      'Material View',         'content',    'Tactile materials archive.',                'enabled','tenant',FALSE, 32, '/inspirations/materials', 'Palette',         'curatorial-atlas','Curatorial Atlas','tenant',FALSE,TRUE,  30),
  ('media_library',      'Media Library',         'content',    'Atelier media governance.',                 'enabled','tenant',FALSE, 33, '/library',                'FolderOpen',      'curatorial-atlas','Curatorial Atlas','tenant',FALSE,FALSE, 30),
  ('cultural_editions',  'Cultural Editions',     'intelligence','Per-market editorial editions.',           'enabled','tenant',FALSE, 34, '/workspace/cultural-editions','Globe',       'curatorial-atlas','Curatorial Atlas','tenant',FALSE,TRUE,  30),

  -- Client Relations
  ('crm_accounts',       'Accounts',              'growth',     'CRM accounts and relationships.',           'enabled','tenant',FALSE, 40, '/crm/accounts',           'Users',           'client-relations','Client Relations','tenant',FALSE,FALSE, 40),
  ('crm_follow_ups',     'Voice Log',             'growth',     'Open conversations and follow-ups.',        'enabled','tenant',FALSE, 41, '/crm/follow-ups',         'BellRing',        'client-relations','Client Relations','tenant',FALSE,FALSE, 40),
  ('crm_archived',       'Memory',                'growth',     'Archived conversations.',                   'enabled','tenant',FALSE, 42, '/crm/archived',           'Archive',         'client-relations','Client Relations','tenant',FALSE,FALSE, 40),

  -- Content Studio (tenant_admin)
  ('editorial_calendar', 'Editorial Calendar',    'content',    'Editorial planning calendar.',              'enabled','tenant_admin',FALSE, 50, '/blueprint/editorial-calendar','CalendarDays','content-studio','Content Studio','tenant_admin',FALSE,FALSE, 50),
  ('magazine',           'Magazine',              'content',    'Editorial magazine module.',                'enabled','tenant_admin',FALSE, 51, '/blueprint/editorial',    'BookOpen',        'content-studio','Content Studio','tenant_admin',FALSE,FALSE, 50),
  ('design_stories',     'Design Stories',        'content',    'Curated project stories studio.',           'enabled','tenant_admin',FALSE, 52, '/blueprint/projects-studio','Quote',         'content-studio','Content Studio','tenant_admin',FALSE,FALSE, 50),
  ('publishing_queue',   'Publishing Queue',      'content',    'Editorial publishing inbox.',               'enabled','tenant_admin',FALSE, 53, '/editorial/inbox',        'Inbox',           'content-studio','Content Studio','tenant_admin',FALSE,FALSE, 50),
  ('market_matrix',      'Market Matrix',         'intelligence','Per-market editorial matrix.',             'enabled','tenant_admin',FALSE, 54, '/blueprint/markets',      'Globe2',          'content-studio','Content Studio','tenant_admin',FALSE,FALSE, 50),
  ('web_presence',       'Web Presence',          'content',    'Public website orchestration.',             'enabled','tenant_admin',FALSE, 55, '/blueprint/experience',   'LayoutTemplate',  'content-studio','Content Studio','tenant_admin',FALSE,FALSE, 50),

  -- Studio OS
  ('team',               'Team',                  'core',       'Workspace members.',                        'enabled','tenant',FALSE, 60, '/settings/members',       'Users',           'studio-os','Studio OS',           'tenant',FALSE,FALSE, 60),
  ('insights',           'Insights',              'intelligence','Studio analytics.',                        'enabled','tenant',FALSE, 61, '/insights',               'LineChart',       'studio-os','Studio OS',           'tenant',FALSE,FALSE, 60),
  ('studio_identity',    'Studio Identity',       'core',       'Brand & theme settings.',                   'enabled','tenant_admin',FALSE, 62, '/settings/brand',         'Palette',         'studio-os','Studio OS',           'tenant_admin',FALSE,TRUE,  60),
  ('forms_journeys',     'Forms & Journeys',      'core',       'Forms and onboarding journeys.',            'enabled','tenant_admin',FALSE, 63, '/blueprint/forms-journeys','Sparkle',        'studio-os','Studio OS',           'tenant_admin',FALSE,FALSE, 60),
  ('studio_voice',       'Studio Voice',          'core',       'Voice and editorial tone settings.',        'enabled','tenant_admin',FALSE, 64, '/blueprint/studio-voice', 'Mic2',            'studio-os','Studio OS',           'tenant_admin',FALSE,FALSE, 60),
  ('language_cc',        'Language Command Center','intelligence','Localization governance.',                'enabled','tenant_admin',FALSE, 65, '/admin/language/heatmap', 'Languages',       'studio-os','Studio OS',           'tenant_admin',FALSE,FALSE, 60),
  ('integrations',       'Integrations',          'core',       'Third-party integrations.',                 'enabled','tenant_admin',FALSE, 66, '/settings/integrations',  'Plug',            'studio-os','Studio OS',           'tenant_admin',FALSE,FALSE, 60),
  ('billing',            'Billing',               'core',       'Subscription and billing.',                 'enabled','tenant_admin',FALSE, 67, '/settings/plan',          'Receipt',         'studio-os','Studio OS',           'tenant_admin',FALSE,FALSE, 60),
  ('settings_workspace', 'Workspace',             'core',       'Workspace settings.',                       'enabled','tenant_admin',TRUE,  68, '/settings',               'Settings',        'studio-os','Studio OS',           'tenant_admin',TRUE, FALSE, 60),

  -- Platform / Blueprint Command Center
  ('blueprint_admin',    'Super Admin',           'platform',   'Blueprint Command Center.',                 'enabled','super_admin',TRUE, 90, '/admin',                  'Shield',          'platform','Platform',              'super_admin',FALSE,FALSE,90)
ON CONFLICT (code) DO UPDATE SET
  display_name      = EXCLUDED.display_name,
  category          = EXCLUDED.category,
  description       = EXCLUDED.description,
  default_state     = EXCLUDED.default_state,
  required_role     = EXCLUDED.required_role,
  is_core           = EXCLUDED.is_core,
  position          = EXCLUDED.position,
  nav_route         = EXCLUDED.nav_route,
  nav_icon          = EXCLUDED.nav_icon,
  nav_group         = EXCLUDED.nav_group,
  nav_section_label = EXCLUDED.nav_section_label,
  nav_visibility    = EXCLUDED.nav_visibility,
  nav_end_match     = EXCLUDED.nav_end_match,
  nav_has_mark      = EXCLUDED.nav_has_mark,
  group_position    = EXCLUDED.group_position,
  updated_at        = NOW();

-- 5. Seed Golden Demo Tenant™ branding defaults if empty.
UPDATE tenant_configuration
SET branding = '{
      "logo_url": null,
      "monogram": "M",
      "font_heading": "Cormorant Garamond",
      "font_body": "Inter",
      "color_primary": "#7ce4f5",
      "color_secondary": "#e8ebf0",
      "color_canvas": "#050608",
      "radius_scale": "soft",
      "glass_intensity": "medium"
    }'::jsonb
WHERE (branding = '{}'::jsonb OR branding IS NULL)
  AND tenant_id IN (SELECT id FROM tenants WHERE slug = 'studio');
