-- Phase S-CONNECT Step 3 — Projects Studio™
-- Portfolio Cultural Adaptation Studio (NOT a project manager).
--
-- The OPERATIONAL project (workspace `projects` table) and the PUBLIC
-- PORTFOLIO project are two different concepts. The portfolio surfaces
-- live here and never carry CRM/workflow concerns.
--
-- Architecture (hybrid, per user directive):
--   • portfolio_projects        → MASTER public record (1 per project)
--   • portfolio_project_variants → market-native cultural variants
--
-- Variants are NOT translations — they reinterpret the project's
-- emotional framing, material vocabulary, hospitality tone, aspirational
-- narrative, luxury perception and pacing for the target market.

CREATE TABLE IF NOT EXISTS portfolio_projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug              TEXT NOT NULL,
  title             TEXT NOT NULL,
  category          TEXT,              -- residential / hospitality / commercial / atelier
  subtitle          TEXT,
  story_body        JSONB DEFAULT '[]'::jsonb,  -- master narrative blocks
  gallery           JSONB DEFAULT '[]'::jsonb,  -- [{id, url, caption, role}, …]
  cover_image_url   TEXT,
  client            TEXT,
  location          TEXT,
  year              INTEGER,
  material_palette  JSONB DEFAULT '[]'::jsonb,  -- ["calacatta", "walnut", …]
  default_locale    TEXT DEFAULT 'it-IT',
  status            TEXT DEFAULT 'draft',  -- draft | published
  is_published      BOOLEAN DEFAULT FALSE,
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_tenant ON portfolio_projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_published ON portfolio_projects(tenant_id, is_published);

CREATE TABLE IF NOT EXISTS portfolio_project_variants (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id          UUID NOT NULL REFERENCES portfolio_projects(id) ON DELETE CASCADE,
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  market_id          UUID REFERENCES markets(id) ON DELETE SET NULL,
  market_code        TEXT,             -- denormalised for fast public lookup
  target_locale      TEXT NOT NULL,    -- BCP-47

  -- Cultural reinterpretation surface (NOT translation)
  variant_title         TEXT,
  cultural_angle        TEXT,          -- emotional framing
  material_language     JSONB DEFAULT '{}'::jsonb,
  hospitality_tone      TEXT,
  aspirational_narrative TEXT,
  luxury_perception     TEXT,
  story_body            JSONB DEFAULT '[]'::jsonb,   -- adapted blocks
  gallery_overrides     JSONB DEFAULT '{}'::jsonb,    -- {hero_image_id, captions_by_id, order}
  cta_set               JSONB DEFAULT '[]'::jsonb,
  seo                   JSONB DEFAULT '{}'::jsonb,

  -- Workflow (4-spine: draft → composing → ready → published)
  status            TEXT DEFAULT 'draft',
  is_published      BOOLEAN DEFAULT FALSE,
  published_at      TIMESTAMPTZ,

  -- AI composition signals
  composed_by_ai    BOOLEAN DEFAULT FALSE,
  composed_at       TIMESTAMPTZ,
  composer_version  TEXT,
  performance_signals JSONB DEFAULT '{}'::jsonb,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (master_id, target_locale)
);
CREATE INDEX IF NOT EXISTS idx_ppv_master ON portfolio_project_variants(master_id);
CREATE INDEX IF NOT EXISTS idx_ppv_tenant ON portfolio_project_variants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ppv_locale ON portfolio_project_variants(tenant_id, target_locale, is_published);
