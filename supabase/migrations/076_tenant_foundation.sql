-- ────────────────────────────────────────────────────────────────────
-- 076_tenant_foundation.sql · ITER144
-- TENANT CONFIGURATION FOUNDATION™ + FEATURE FLAGS FREEZE™
--
-- Architectural promise frozen here:
--   1 platform  ·  N tenants  ·  1 codebase  ·  N configurations.
--
-- We add 5 tables:
--   • tenant_settings              — per-tenant configuration store
--   • feature_modules_registry     — canonical platform modules (code, category…)
--   • platform_feature_defaults    — global default visibility/state per module
--   • tenant_snapshots             — Golden Snapshot™ packs (Luxury, Retail…)
--   • tenant_snapshot_applications — audit of which snapshot a tenant was
--                                    born from / re-seeded with
-- ────────────────────────────────────────────────────────────────────

-- 1. tenant_configuration — single source of truth for per-tenant config.
--    (Distinct from the legacy `tenant_settings` key/value table, which
--    we leave untouched for back-compat.)
CREATE TABLE IF NOT EXISTS tenant_configuration (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  logo_url                TEXT,
  favicon_url             TEXT,
  primary_color           TEXT,
  secondary_color         TEXT,
  typography_preset       TEXT,            -- 'editorial-serif', 'modern-sans', …
  homepage_variant        TEXT,            -- 'variant_a', 'variant_b', …
  editorial_tone          TEXT,            -- 'luxury_minimal', 'warm_residential', …
  enabled_locales         JSONB DEFAULT '[]'::jsonb,    -- ["it-IT","en-US",…]
  default_locale          TEXT,
  enabled_modules         JSONB DEFAULT '{}'::jsonb,    -- {"crm":true,"editorial":false,…}
  onboarding_mode         TEXT,            -- 'editorial', 'commercial', 'hybrid'
  design_journey_variant  TEXT,            -- 'three_step', 'single_form', …
  cta_style               TEXT,            -- 'cinematic', 'direct', …
  feature_flags           JSONB DEFAULT '{}'::jsonb,    -- {"market_intelligence":"beta",…}
  runtime_metadata        JSONB DEFAULT '{}'::jsonb,    -- free-form per-tenant data
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

-- 2. feature_modules_registry — canonical platform modules.
CREATE TABLE IF NOT EXISTS feature_modules_registry (
  code            TEXT PRIMARY KEY,         -- 'crm','editorial','advisor_network',…
  display_name    TEXT NOT NULL,
  category        TEXT NOT NULL,            -- 'core','growth','intelligence','content'
  description     TEXT,
  default_state   TEXT NOT NULL DEFAULT 'enabled'
                  CHECK (default_state IN ('enabled','disabled','beta','hidden','locked')),
  required_role   TEXT,                     -- optional role gate (tenant_admin / super_admin / …)
  position        INTEGER NOT NULL DEFAULT 100,
  is_core         BOOLEAN NOT NULL DEFAULT FALSE,  -- core modules can't be disabled
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. platform_feature_defaults — operator-level global default override
-- (kept distinct from `default_state` so the registry stays declarative
-- and overrides stay audit-able).
CREATE TABLE IF NOT EXISTS platform_feature_defaults (
  module_code     TEXT PRIMARY KEY REFERENCES feature_modules_registry(code) ON DELETE CASCADE,
  state           TEXT NOT NULL
                  CHECK (state IN ('enabled','disabled','beta','hidden','locked')),
  updated_by      UUID,                     -- users_profile.id
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. tenant_snapshots — Golden Snapshot™ packs (read-only registry).
CREATE TABLE IF NOT EXISTS tenant_snapshots (
  code            TEXT PRIMARY KEY,         -- 'luxury_interior','retail_kitchen',…
  display_name    TEXT NOT NULL,
  summary         TEXT,
  category        TEXT,                     -- 'residential','retail','hospitality'…
  position        INTEGER NOT NULL DEFAULT 100,
  content         JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- content shape: {settings:{…}, modules:{…},
    --                 editorial:{…}, seeds:{moodboards:[…], journeys:[…]}}
  is_locked       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. tenant_snapshot_applications — audit log: which tenant got which
-- snapshot and when. Foundation only; the actual reseed orchestration
-- comes in ITER144B.
CREATE TABLE IF NOT EXISTS tenant_snapshot_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_code   TEXT NOT NULL REFERENCES tenant_snapshots(code),
  action          TEXT NOT NULL DEFAULT 'apply'
                  CHECK (action IN ('apply','reseed','rollback')),
  initiated_by    UUID,                     -- users_profile.id
  notes           TEXT,
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tenant_snapshot_applications_tenant_idx
  ON tenant_snapshot_applications (tenant_id, applied_at DESC);

-- Ensure the Golden Demo Tenant™ has a tenant_configuration row.
INSERT INTO tenant_configuration (tenant_id, primary_color, secondary_color,
                              typography_preset, homepage_variant, editorial_tone,
                              enabled_locales, default_locale,
                              onboarding_mode, design_journey_variant, cta_style)
SELECT id, '#7ce4f5', '#e8ebf0', 'editorial-serif', 'variant_a',
       'luxury_minimal', '["it-IT","en-US","fr-FR","de-DE","es-ES"]'::jsonb,
       'it-IT', 'editorial', 'three_step', 'cinematic'
  FROM tenants WHERE slug='studio'
ON CONFLICT (tenant_id) DO NOTHING;
