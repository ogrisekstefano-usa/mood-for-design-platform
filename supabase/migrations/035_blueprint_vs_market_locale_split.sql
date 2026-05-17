-- ─────────────────────────────────────────────────────────────────────────
-- Phase R-MARKET-1A — Three-Layer Locale Architecture.
--
-- Establishes the clear separation requested by product:
--
--   LAYER 1 — Blueprint UI Locales (internal CRM workspace)
--     • Strict BCP-47 locales (it-IT, en-US, en-GB, es-ES, fr-FR, de-DE).
--     • CRM-core terminology (lifecycle_stage, account_type, source,
--       interaction_type, action_type, priority, visibility_level,
--       relationship_health, communication_preference) becomes
--       PLATFORM-LEVEL (`scope = 'platform'`, tenant_id IS NULL).
--       Tenants cannot rename or override "Lead", "Prospect", … — those
--       are the canonical MOOD workflow words. They can be TRANSLATED
--       (per-locale label JSONB) but never tenant-customised.
--     • Stylistic vocabularies (style, material, atmosphere, budget_range,
--       timing_range, room_type, project_category) remain TENANT-LEVEL
--       (`scope = 'tenant'`, tenant_id NOT NULL). Each showroom/studio
--       owns its design lexicon.
--     • Resolution: tenant rows override platform rows when both share
--       (group_key, value_key). For CRM-core groups, tenants get the
--       platform row only — UPDATEs from tenant scope are rejected at
--       the API layer (defence in depth).
--
--   LAYER 2 — Frontend Market Locales (storefront content targeting)
--     New `markets` + `tenant_markets` tables. A MARKET is NOT a language:
--     it bundles locale + countries + cultural_profile + tone_of_voice +
--     cta_style + currency + units + SEO intent + (future) sub-regions.
--     The 13 seed markets (DACH, France/FR-EU, UK & Ireland, USA National,
--     USA East Coast, USA South/Florida, USA West Coast, GCC Luxury,
--     Central America, Spanish LatAm, Brazil, Scandinavia, Italy) are
--     PLATFORM-LEVEL: only Super Admins create/edit them; tenants can
--     only toggle which markets they target.
--
--   LAYER 3 — Editorial Market Localization
--     The existing `locale_profiles` + `reference_locale_interpretations`
--     (migrations 029, 032) continue to power cultural reinterpretation.
--     Future phase will join markets → locale_profiles → editorial output.
--
-- ─────────────────────────────────────────────────────────────────────────


-- 1. Split relationship_lookups: platform-level vs tenant-level. ──────────

-- Allow NULL tenant_id for platform rows.
ALTER TABLE relationship_lookups
  ALTER COLUMN tenant_id DROP NOT NULL;

-- Scope discriminator.
ALTER TABLE relationship_lookups
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'tenant'
    CHECK (scope IN ('platform', 'tenant'));

-- Replace the (tenant_id, group_key, value_key) UNIQUE constraint with two
-- partial unique indexes — one for platform rows (tenant_id IS NULL),
-- one for tenant rows. PostgreSQL only treats NULLs as distinct under the
-- default UNIQUE, so without these we could end up with multiple platform
-- rows for the same (group_key, value_key).
ALTER TABLE relationship_lookups
  DROP CONSTRAINT IF EXISTS relationship_lookups_tenant_id_group_key_value_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lookups_platform_value
  ON relationship_lookups (group_key, value_key)
  WHERE scope = 'platform' AND tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lookups_tenant_value
  ON relationship_lookups (tenant_id, group_key, value_key)
  WHERE scope = 'tenant' AND tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lookups_platform_group
  ON relationship_lookups (group_key, sort_order)
  WHERE scope = 'platform' AND active = TRUE;


-- 2. markets — platform-level catalog of editorial target markets. ────────
CREATE TABLE IF NOT EXISTS markets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stable machine code (snake_case). NEVER tenant-customisable.
  code               TEXT UNIQUE NOT NULL,
                     -- 'italy', 'dach', 'france_fr_europe', 'uk_ireland',
                     -- 'usa_national', 'usa_east_coast', 'usa_south_florida',
                     -- 'usa_west_coast', 'gcc_luxury', 'central_america',
                     -- 'spanish_latam', 'brazil', 'scandinavia'

  -- Per-locale display name (BCP-47 JSONB).
  display_name       JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Geographic grouping.
  macro_region       TEXT NOT NULL,
                     -- 'europe' | 'north_america' | 'mena' | 'latam' | 'asia_pacific'
  countries          JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ISO 3166-1 alpha-2: ['DE','AT','CH']

  -- Locale resolution.
  primary_locale     TEXT NOT NULL,                       -- BCP-47: 'de-DE'
  fallback_locale    TEXT NOT NULL DEFAULT 'en-US',       -- BCP-47

  -- Commercial/format defaults.
  currency           TEXT NOT NULL DEFAULT 'EUR',         -- ISO 4217
  measurement_system TEXT NOT NULL DEFAULT 'metric'
                     CHECK (measurement_system IN ('metric','imperial')),

  -- Editorial / AI profile (free-form JSONB so the AI engine can extend
  -- it without DDL). Seeded per market — not generated.
  cultural_profile   JSONB NOT NULL DEFAULT '{}'::jsonb,
  tone_of_voice      JSONB NOT NULL DEFAULT '{}'::jsonb,
  cta_style          JSONB NOT NULL DEFAULT '{}'::jsonb,
  seo_intent         JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Future city/region segmentation (Miami / NYC / LA / Chicago / Texas /
  -- Aspen for usa_national). Data only — no geo routing in this phase.
  sub_regions        JSONB NOT NULL DEFAULT '[]'::jsonb,

  active             BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order         INTEGER NOT NULL DEFAULT 0,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_markets_active_sort
  ON markets (active, sort_order);
CREATE INDEX IF NOT EXISTS idx_markets_macro_region
  ON markets (macro_region, active);


-- 3. tenant_markets — N:N join. Tenant selects their target markets. ──────
CREATE TABLE IF NOT EXISTS tenant_markets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  market_id       UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
                  -- Exactly one default market per tenant — enforced at API.
  sort_order      INTEGER NOT NULL DEFAULT 0,

  -- Per-tenant overrides on top of market defaults (tone tweaks, custom
  -- CTA labels, etc.). Editable by Tenant Owner. NEVER touches `markets`.
  custom_settings JSONB NOT NULL DEFAULT '{}'::jsonb,

  activated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, market_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_markets_active
  ON tenant_markets (tenant_id, is_active, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_markets_default
  ON tenant_markets (tenant_id)
  WHERE is_default = TRUE;
