-- ============================================================
-- MOOD for DESIGN — Supabase Schema (Idempotent, Production-Grade)
-- ONE database → multi-tenant → multi-frontend → multi-locale
-- Safe to run multiple times.
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- LOCALES (global registry)
-- ============================================================
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

-- ============================================================
-- TENANTS (production-grade: plans, limits, modules, theming)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id                 VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  slug               VARCHAR(100) UNIQUE NOT NULL,
  name               VARCHAR(255) NOT NULL,
  domain             VARCHAR(255),
  config             JSONB DEFAULT '{}'::jsonb,
  is_active          BOOLEAN DEFAULT TRUE,
  -- Plan & quotas
  active_plan        VARCHAR(50) DEFAULT 'starter',
  max_users          INTEGER DEFAULT 3,
  max_projects       INTEGER DEFAULT 1,
  max_storage_gb     INTEGER DEFAULT 5,
  enabled_modules    JSONB DEFAULT '[]'::jsonb,
  -- Theming
  theme_settings     JSONB DEFAULT '{}'::jsonb,
  branding_settings  JSONB DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure new columns exist on pre-existing installations (idempotent)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS active_plan       VARCHAR(50) DEFAULT 'starter';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_users         INTEGER DEFAULT 3;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_projects      INTEGER DEFAULT 1;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_storage_gb    INTEGER DEFAULT 5;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS enabled_modules   JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS theme_settings    JSONB DEFAULT '{}'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS branding_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_tenants_slug   ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);

-- Bootstrap the corporate tenant
INSERT INTO tenants (
  id, slug, name, domain, config, is_active,
  active_plan, max_users, max_projects, max_storage_gb,
  enabled_modules, theme_settings, branding_settings
) VALUES (
  'mood-corporate-001',
  'mood-corporate',
  'MOOD for DESIGN',
  'www.moodfordesign.com',
  '{"theme":"editorial-luxury","primary_locale":"en-us","locales_enabled":["it","en-us","en-uk","fr","de","es"]}'::jsonb,
  true,
  'platform-owner',
  9999, 9999, 9999,
  '["cms","journal","storefront","pricing","newsletter","contact"]'::jsonb,
  '{"font_heading":"Playfair Display","font_body":"Montserrat","brand_color":"#00C9B3"}'::jsonb,
  '{"logo_url":"https://customer-assets.emergentagent.com/job_editorial-platform-4/artifacts/kfe510tt_Artboard%201.png","favicon_url":null}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- MEMBERSHIPS (RBAC: who has access to which tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS memberships (
  id             VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id      VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE,
  user_id        VARCHAR(36) NOT NULL,  -- references future users table (Supabase Auth uid or local users)
  email          VARCHAR(255),
  role           VARCHAR(50) DEFAULT 'member',  -- owner|admin|editor|member|viewer
  status         VARCHAR(30) DEFAULT 'active',  -- active|invited|suspended|removed
  invited_by     VARCHAR(36),
  invited_at     TIMESTAMPTZ,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user   ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_email  ON memberships(email);

-- ============================================================
-- PAGES (legacy — CMS-rendered pages)
-- ============================================================
CREATE TABLE IF NOT EXISTS pages (
  id           VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id    VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE,
  slug         VARCHAR(200) NOT NULL,
  template     VARCHAR(100) DEFAULT 'corporate-default',
  is_published BOOLEAN DEFAULT TRUE,
  seo          JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

ALTER TABLE pages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_pages_tenant_slug ON pages(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_pages_published   ON pages(tenant_id, is_published);

-- ============================================================
-- SECTIONS (page → ordered sections)
-- ============================================================
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

CREATE INDEX IF NOT EXISTS idx_sections_page   ON sections(page_id);
CREATE INDEX IF NOT EXISTS idx_sections_tenant ON sections(tenant_id);

-- ============================================================
-- SECTION_CONTENT (multilingual)
-- ============================================================
CREATE TABLE IF NOT EXISTS section_content (
  id          VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  section_id  VARCHAR(36) REFERENCES sections(id) ON DELETE CASCADE,
  locale_code VARCHAR(20) REFERENCES locales(code),
  content     JSONB DEFAULT '{}'::jsonb,
  UNIQUE(section_id, locale_code)
);

CREATE INDEX IF NOT EXISTS idx_section_content_section ON section_content(section_id);

-- ============================================================
-- STOREFRONT_PAGES (draft/published architecture, JSON-tree per page)
-- Used by tenants for their own digital storefronts via Blueprint editor.
-- ============================================================
CREATE TABLE IF NOT EXISTS storefront_pages (
  id              VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id       VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE,
  slug            VARCHAR(200) NOT NULL,
  locale_code     VARCHAR(20) REFERENCES locales(code),
  seo_meta        JSONB DEFAULT '{}'::jsonb,
  is_published    BOOLEAN DEFAULT FALSE,
  draft_json      JSONB DEFAULT '{}'::jsonb,
  published_json  JSONB DEFAULT '{}'::jsonb,
  draft_updated_at     TIMESTAMPTZ DEFAULT NOW(),
  published_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug, locale_code)
);

CREATE INDEX IF NOT EXISTS idx_storefront_tenant_slug   ON storefront_pages(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_storefront_published     ON storefront_pages(tenant_id, is_published);

-- ============================================================
-- NAVIGATION_ITEMS + NAVIGATION_CONTENT
-- ============================================================
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

CREATE TABLE IF NOT EXISTS navigation_content (
  id          VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  nav_item_id VARCHAR(36) REFERENCES navigation_items(id) ON DELETE CASCADE,
  locale_code VARCHAR(20) REFERENCES locales(code),
  label       VARCHAR(500) NOT NULL,
  UNIQUE(nav_item_id, locale_code)
);

-- ============================================================
-- PRICING_PLANS + PRICING_PLAN_CONTENT
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_plans (
  id                       VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id                VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE,
  slug                     VARCHAR(100) NOT NULL,
  price_monthly            NUMERIC(10,2),
  price_yearly             NUMERIC(10,2),
  currency                 VARCHAR(10) DEFAULT 'EUR',
  is_featured              BOOLEAN DEFAULT FALSE,
  is_active                BOOLEAN DEFAULT TRUE,
  display_order            INTEGER DEFAULT 0,
  badge                    VARCHAR(100),
  stripe_price_id_monthly  VARCHAR(255),
  stripe_price_id_yearly   VARCHAR(255),
  UNIQUE(tenant_id, slug)
);

-- For pre-existing DBs that may have a global unique on slug only
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pricing_plans_slug_key'
  ) THEN
    EXECUTE 'ALTER TABLE pricing_plans DROP CONSTRAINT pricing_plans_slug_key';
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_pricing_tenant ON pricing_plans(tenant_id);

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

-- ============================================================
-- JOURNAL_ARTICLES (rich editorial: hero + gallery + hotspots + AI + SEO)
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_articles (
  id                   VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id            VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE,
  slug                 VARCHAR(300) NOT NULL,
  canonical_locale     VARCHAR(20) REFERENCES locales(code) DEFAULT 'en-us',
  translated_locales   JSONB DEFAULT '[]'::jsonb,         -- ['it','en-us',...]
  hero_image           VARCHAR(1000),
  gallery_images       JSONB DEFAULT '[]'::jsonb,         -- [{url, alt, credit}]
  hotspots             JSONB DEFAULT '[]'::jsonb,         -- [{x,y,product_id,note}]
  category             VARCHAR(100),
  category_id          VARCHAR(36),
  tags                 JSONB DEFAULT '[]'::jsonb,
  author_name          VARCHAR(255),
  ai_generated         BOOLEAN DEFAULT FALSE,
  ai_metadata          JSONB DEFAULT '{}'::jsonb,         -- {model, prompt_id, generated_at}
  seo                  JSONB DEFAULT '{}'::jsonb,         -- {locale: {title, description, og_image}}
  is_published         BOOLEAN DEFAULT FALSE,
  published_at         TIMESTAMPTZ,
  draft_json           JSONB DEFAULT '{}'::jsonb,
  published_json       JSONB DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_journal_tenant_slug ON journal_articles(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_journal_published   ON journal_articles(tenant_id, is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_category    ON journal_articles(category_id);

-- ============================================================
-- JOURNAL_ARTICLE_CONTENT (multilingual title/excerpt/body)
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_article_content (
  id           VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  article_id   VARCHAR(36) REFERENCES journal_articles(id) ON DELETE CASCADE,
  locale_code  VARCHAR(20) REFERENCES locales(code),
  title        VARCHAR(500) NOT NULL,
  excerpt      TEXT,
  body         TEXT,
  UNIQUE(article_id, locale_code)
);

CREATE INDEX IF NOT EXISTS idx_journal_content_article ON journal_article_content(article_id);

-- ============================================================
-- LEGACY journal_posts kept for backwards-compat reads; new code uses journal_articles
-- ============================================================
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
-- CONTACT_SUBMISSIONS + NEWSLETTER_SUBSCRIBERS (form persistence)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_submissions (
  id            VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id     VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(255),
  email         VARCHAR(255),
  company       VARCHAR(255),
  inquiry_type  VARCHAR(50),
  message       TEXT,
  locale_code   VARCHAR(20),
  status        VARCHAR(30) DEFAULT 'new',
  reference     VARCHAR(50),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_tenant ON contact_submissions(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id          VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id   VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL,
  locale_code VARCHAR(20),
  status      VARCHAR(30) DEFAULT 'active',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- ============================================================
-- STUDIO_REGISTRATIONS (Phase-1 onboarding intake)
-- ============================================================
CREATE TABLE IF NOT EXISTS studio_registrations (
  id           VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  studio_name  VARCHAR(255) NOT NULL,
  slug         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) NOT NULL,
  first_name   VARCHAR(255),
  last_name    VARCHAR(255),
  role         VARCHAR(50) DEFAULT 'studio_owner',
  plan         VARCHAR(50) DEFAULT 'starter',
  locale_code  VARCHAR(20),
  status       VARCHAR(30) DEFAULT 'provisioning',
  tenant_id    VARCHAR(36) REFERENCES tenants(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_reg_email ON studio_registrations(email);
CREATE INDEX IF NOT EXISTS idx_studio_reg_slug  ON studio_registrations(slug);
