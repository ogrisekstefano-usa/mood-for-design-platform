-- ============================================================
-- MOOD for DESIGN — Supabase Schema
-- Run this in Supabase SQL Editor to initialize the database.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Locales ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locales (
  code         VARCHAR(20) PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  flag         VARCHAR(10),
  is_active    BOOLEAN DEFAULT TRUE,
  is_default   BOOLEAN DEFAULT FALSE
);

INSERT INTO locales (code, name, flag, is_active, is_default) VALUES
  ('it',    'Italiano',       'IT', true,  false),
  ('en-us', 'English (US)',   'EN', true,  true),
  ('en-uk', 'English (UK)',   'EN', true,  false),
  ('fr',    'Français',       'FR', true,  false),
  ('de',    'Deutsch',        'DE', true,  false),
  ('es',    'Español',        'ES', true,  false)
ON CONFLICT (code) DO NOTHING;

-- ── Tenants ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id          VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  name        VARCHAR(255) NOT NULL,
  domain      VARCHAR(255),
  config      JSONB DEFAULT '{}'::jsonb,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

INSERT INTO tenants (id, slug, name, domain, config, is_active) VALUES
  (
    'mood-corporate-001',
    'mood-corporate',
    'MOOD for DESIGN',
    'www.moodfordesign.com',
    '{"theme":"editorial-luxury","primary_locale":"en-us","locales_enabled":["it","en-us","en-uk","fr","de","es"],"brand_color":"#00C9B3","font_heading":"Playfair Display","font_body":"Montserrat"}'::jsonb,
    true
  )
ON CONFLICT (slug) DO NOTHING;

-- ── Pages ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
  id           VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id    VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE,
  slug         VARCHAR(200) NOT NULL,
  template     VARCHAR(100) DEFAULT 'corporate-default',
  is_published BOOLEAN DEFAULT TRUE,
  seo          JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_pages_tenant_slug ON pages(tenant_id, slug);

-- ── Sections ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sections (
  id            VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  page_id       VARCHAR(36) REFERENCES pages(id) ON DELETE CASCADE,
  tenant_id     VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE,
  type          VARCHAR(100) NOT NULL,
  config        JSONB DEFAULT '{}'::jsonb,
  display_order INTEGER DEFAULT 0,
  is_enabled    BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sections_page ON sections(page_id);
CREATE INDEX IF NOT EXISTS idx_sections_tenant ON sections(tenant_id);

-- ── Section Content (multilingual) ────────────────────────────
CREATE TABLE IF NOT EXISTS section_content (
  id          VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  section_id  VARCHAR(36) REFERENCES sections(id) ON DELETE CASCADE,
  locale_code VARCHAR(20) REFERENCES locales(code),
  content     JSONB DEFAULT '{}'::jsonb,
  UNIQUE(section_id, locale_code)
);

CREATE INDEX IF NOT EXISTS idx_section_content_section ON section_content(section_id);

-- ── Navigation Items ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS navigation_items (
  id            VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id     VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE,
  nav_group     VARCHAR(50) DEFAULT 'main',
  key           VARCHAR(100) NOT NULL,
  href          VARCHAR(500) NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_nav_tenant ON navigation_items(tenant_id);

-- ── Navigation Content (multilingual labels) ──────────────────
CREATE TABLE IF NOT EXISTS navigation_content (
  id          VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  nav_item_id VARCHAR(36) REFERENCES navigation_items(id) ON DELETE CASCADE,
  locale_code VARCHAR(20) REFERENCES locales(code),
  label       VARCHAR(500) NOT NULL,
  UNIQUE(nav_item_id, locale_code)
);

-- ── Pricing Plans ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pricing_plans (
  id                       VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id                VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE,
  slug                     VARCHAR(100) UNIQUE NOT NULL,
  price_monthly            NUMERIC(10,2),
  price_yearly             NUMERIC(10,2),
  currency                 VARCHAR(10) DEFAULT 'EUR',
  is_featured              BOOLEAN DEFAULT FALSE,
  is_active                BOOLEAN DEFAULT TRUE,
  display_order            INTEGER DEFAULT 0,
  badge                    VARCHAR(100),
  stripe_price_id_monthly  VARCHAR(255),
  stripe_price_id_yearly   VARCHAR(255)
);

-- ── Pricing Plan Content (multilingual) ───────────────────────
CREATE TABLE IF NOT EXISTS pricing_plan_content (
  id          VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  plan_id     VARCHAR(36) REFERENCES pricing_plans(id) ON DELETE CASCADE,
  locale_code VARCHAR(20) REFERENCES locales(code),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  cta_text    VARCHAR(100) DEFAULT 'Get Started',
  features    JSONB DEFAULT '[]'::jsonb,
  UNIQUE(plan_id, locale_code)
);

-- ── Journal Posts ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_posts (
  id             VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id      VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE,
  slug           VARCHAR(300) NOT NULL,
  featured_image VARCHAR(1000),
  category       VARCHAR(100),
  author_name    VARCHAR(255),
  published_at   TIMESTAMPTZ,
  is_published   BOOLEAN DEFAULT FALSE,
  UNIQUE(tenant_id, slug)
);

-- ── Journal Post Content (multilingual) ───────────────────────
CREATE TABLE IF NOT EXISTS journal_post_content (
  id          VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  post_id     VARCHAR(36) REFERENCES journal_posts(id) ON DELETE CASCADE,
  locale_code VARCHAR(20) REFERENCES locales(code),
  title       VARCHAR(500) NOT NULL,
  excerpt     TEXT,
  body        TEXT,
  UNIQUE(post_id, locale_code)
);

-- ============================================================
-- ACTIVATION STEPS (after creating tables above):
-- 1. Run the Python seed migration:
--    python /app/backend/db/seed_migration.py
-- 2. Set DATABASE_URL in /app/backend/.env:
--    DATABASE_URL=postgresql://postgres.[REF]:[PWD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
-- 3. Restart backend: sudo supervisorctl restart backend
-- ============================================================
