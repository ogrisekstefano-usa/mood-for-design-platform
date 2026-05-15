-- ============================================================================
-- 019_session_i_journal_media_engine.sql
-- MOOD for DESIGN — Session I
-- Journal/Editorial Engine + Media Library extensions + Draft/Published + AI
-- ============================================================================
-- Idempotent. Tenant-aware. Soft-delete. Audit fields.
-- DO NOT create duplicate tables. Extends existing Blueprint schema.
-- ============================================================================

BEGIN;

-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUM: article_type ──────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE journal_article_type AS ENUM (
    'editorial','project_story','trend_report','interview',
    'product_focus','material_focus','mood_inspiration','case_study'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ENUM: article_status (4-stage workflow) ─────────────────────────────────
DO $$ BEGIN
  CREATE TYPE journal_article_status AS ENUM (
    'draft','review','approved','published','archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ENUM: revision_action ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE revision_action AS ENUM (
    'create','autosave','manual_save','publish','revert','archive','restore'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ENUM: ai_assist_action ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE ai_assist_action AS ENUM (
    'topics','outline','seo','excerpt','copy','translate',
    'categorize','photo_direction','image_prompt'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 1. CMS_ASSETS — Extend with editorial-grade fields (idempotent)
-- ============================================================================
ALTER TABLE cms_assets ADD COLUMN IF NOT EXISTS caption          jsonb       NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE cms_assets ADD COLUMN IF NOT EXISTS photographer     text;
ALTER TABLE cms_assets ADD COLUMN IF NOT EXISTS copyright        text;
ALTER TABLE cms_assets ADD COLUMN IF NOT EXISTS dominant_color   text;        -- hex
ALTER TABLE cms_assets ADD COLUMN IF NOT EXISTS palette          jsonb       NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE cms_assets ADD COLUMN IF NOT EXISTS mime_type        text;
ALTER TABLE cms_assets ADD COLUMN IF NOT EXISTS file_size_bytes  bigint;
ALTER TABLE cms_assets ADD COLUMN IF NOT EXISTS aspect_ratio     numeric(6,3);
ALTER TABLE cms_assets ADD COLUMN IF NOT EXISTS hotspots         jsonb       NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE cms_assets ADD COLUMN IF NOT EXISTS variants         jsonb       NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE cms_assets ADD COLUMN IF NOT EXISTS folder_path      text        DEFAULT '/';
ALTER TABLE cms_assets ADD COLUMN IF NOT EXISTS locale           text;        -- optional pinning
ALTER TABLE cms_assets ADD COLUMN IF NOT EXISTS deleted_at       timestamptz;
ALTER TABLE cms_assets ADD COLUMN IF NOT EXISTS created_by       uuid;
ALTER TABLE cms_assets ADD COLUMN IF NOT EXISTS updated_by       uuid;

CREATE INDEX IF NOT EXISTS idx_cms_assets_tenant_active
  ON cms_assets(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cms_assets_folder
  ON cms_assets(tenant_id, folder_path) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cms_assets_tags
  ON cms_assets USING GIN(tags);

-- ============================================================================
-- 2. JOURNAL_CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS journal_categories (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug            text NOT NULL,
  parent_id       uuid REFERENCES journal_categories(id) ON DELETE SET NULL,
  locale_meta     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {locale: {name, description}}
  cover_asset_id  uuid REFERENCES cms_assets(id) ON DELETE SET NULL,
  sort_order      int  NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  deleted_at      timestamptz,
  created_by      uuid,
  updated_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_journal_categories_tenant_active
  ON journal_categories(tenant_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. JOURNAL_TAGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS journal_tags (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug            text NOT NULL,
  locale_meta     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {locale: {label}}
  tag_group       text,                                  -- material|style|designer|country|year|other
  deleted_at      timestamptz,
  created_by      uuid,
  updated_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_journal_tags_tenant
  ON journal_tags(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_journal_tags_group
  ON journal_tags(tenant_id, tag_group) WHERE deleted_at IS NULL;

-- ============================================================================
-- 4. JOURNAL_ARTICLES (draft/published architecture)
-- ============================================================================
CREATE TABLE IF NOT EXISTS journal_articles (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  article_type         journal_article_type NOT NULL DEFAULT 'editorial',
  status               journal_article_status NOT NULL DEFAULT 'draft',
  -- localization
  canonical_locale     text NOT NULL DEFAULT 'en-us',
  translated_locales   text[] NOT NULL DEFAULT ARRAY[]::text[],
  -- relations
  hero_asset_id        uuid REFERENCES cms_assets(id) ON DELETE SET NULL,
  author_profile_id    uuid,
  author_display_name  text,
  -- AI metadata
  ai_generated         boolean NOT NULL DEFAULT false,
  ai_metadata          jsonb   NOT NULL DEFAULT '{}'::jsonb,
  -- editorial relations
  related_article_ids  uuid[]  NOT NULL DEFAULT ARRAY[]::uuid[],
  -- workflow timestamps
  scheduled_publish_at timestamptz,
  published_at         timestamptz,
  archived_at          timestamptz,
  published_by         uuid,
  -- snapshots (draft/published JSON-tree for fast rendering)
  draft_json           jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_json       jsonb NOT NULL DEFAULT '{}'::jsonb,
  reading_time_minutes int,
  -- soft delete + audit
  deleted_at           timestamptz,
  created_by           uuid,
  updated_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_journal_articles_tenant_status
  ON journal_articles(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_journal_articles_published
  ON journal_articles(tenant_id, status, published_at DESC) WHERE status='published' AND deleted_at IS NULL;

-- ============================================================================
-- 5. ARTICLE_LOCALIZATIONS — per-locale metadata + denormalized blocks
-- ============================================================================
CREATE TABLE IF NOT EXISTS article_localizations (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id         uuid NOT NULL REFERENCES journal_articles(id) ON DELETE CASCADE,
  locale_code        text NOT NULL,
  slug               text NOT NULL,
  title              text NOT NULL,
  excerpt            text,
  seo_title          text,
  seo_description    text,
  canonical_url      text,
  og_image_asset_id  uuid REFERENCES cms_assets(id) ON DELETE SET NULL,
  ai_generated       boolean NOT NULL DEFAULT false,
  ai_metadata        jsonb   NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  updated_at         timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(article_id, locale_code),
  UNIQUE(locale_code, slug)
);
CREATE INDEX IF NOT EXISTS idx_article_loc_article
  ON article_localizations(article_id);

-- ============================================================================
-- 6. JOURNAL_ARTICLE_BLOCKS — section-based article builder
-- ============================================================================
CREATE TABLE IF NOT EXISTS journal_article_blocks (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id    uuid NOT NULL REFERENCES journal_articles(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  block_type    text NOT NULL,           -- hero_cinematic|full_image|paragraph|two_columns|gallery_masonry|quote|video|cta|designer_bio|product_hotspot_image|related_articles|divider|spacer
  sort_order    int  NOT NULL DEFAULT 0,
  visible       boolean NOT NULL DEFAULT true,
  locale_content jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {locale: {...}}
  settings       jsonb NOT NULL DEFAULT '{}'::jsonb,
  asset_refs     uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  deleted_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  updated_at     timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_article_blocks_article
  ON journal_article_blocks(article_id, sort_order) WHERE deleted_at IS NULL;

-- ============================================================================
-- 7. ARTICLE_HOTSPOTS — shoppable/storytelling hotspots on images
-- ============================================================================
CREATE TABLE IF NOT EXISTS article_hotspots (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id    uuid REFERENCES journal_articles(id) ON DELETE CASCADE,
  asset_id      uuid NOT NULL REFERENCES cms_assets(id) ON DELETE CASCADE,
  block_id      uuid REFERENCES journal_article_blocks(id) ON DELETE CASCADE,
  x             numeric(6,3) NOT NULL,    -- 0..100 percentage
  y             numeric(6,3) NOT NULL,
  label         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {locale: text}
  tooltip       jsonb NOT NULL DEFAULT '{}'::jsonb,
  url           text,
  open_blank    boolean NOT NULL DEFAULT true,
  product_ref   uuid,                      -- future products linkage
  sort_order    int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hotspots_article
  ON article_hotspots(article_id);
CREATE INDEX IF NOT EXISTS idx_hotspots_asset
  ON article_hotspots(asset_id);

-- ============================================================================
-- 8. ARTICLE_CATEGORY_MAP + ARTICLE_TAG_MAP (M:N)
-- ============================================================================
CREATE TABLE IF NOT EXISTS article_category_map (
  article_id  uuid NOT NULL REFERENCES journal_articles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES journal_categories(id) ON DELETE CASCADE,
  sort_order  int  NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, category_id)
);

CREATE TABLE IF NOT EXISTS article_tag_map (
  article_id  uuid NOT NULL REFERENCES journal_articles(id) ON DELETE CASCADE,
  tag_id      uuid NOT NULL REFERENCES journal_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

-- ============================================================================
-- 9. REVISION_LOG — generic audit trail for draft/publish/rollback
-- ============================================================================
CREATE TABLE IF NOT EXISTS content_revisions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type   text NOT NULL,                     -- 'journal_article'|'cms_page'|'cms_section'
  entity_id     uuid NOT NULL,
  action        revision_action NOT NULL,
  snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  diff_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id      uuid,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_revisions_entity
  ON content_revisions(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revisions_tenant
  ON content_revisions(tenant_id, created_at DESC);

-- ============================================================================
-- 10. AI_ASSIST_LOGS — observability for AI calls (token usage, latency)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_assist_logs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         uuid,
  provider        text NOT NULL,
  model           text NOT NULL,
  action          ai_assist_action NOT NULL,
  prompt          text,
  response_text   text,
  response_json   jsonb,
  tokens_input    int,
  tokens_output   int,
  latency_ms      int,
  cost_usd        numeric(10,5),
  entity_type     text,
  entity_id       uuid,
  locale          text,
  success         boolean NOT NULL DEFAULT true,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_logs_tenant_created
  ON ai_assist_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_action
  ON ai_assist_logs(action, created_at DESC);

-- ============================================================================
-- 11. CMS_PAGES — Add draft/published JSON snapshots (for new workflow)
-- ============================================================================
ALTER TABLE cms_pages   ADD COLUMN IF NOT EXISTS draft_json       jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE cms_pages   ADD COLUMN IF NOT EXISTS published_json   jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE cms_pages   ADD COLUMN IF NOT EXISTS approval_stage   text;
ALTER TABLE cms_pages   ADD COLUMN IF NOT EXISTS deleted_at       timestamptz;
ALTER TABLE cms_sections ADD COLUMN IF NOT EXISTS deleted_at      timestamptz;

-- ============================================================================
-- 12. updated_at triggers (idempotent)
-- ============================================================================
CREATE OR REPLACE FUNCTION mood_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT unnest(ARRAY[
      'journal_articles','journal_categories','journal_tags',
      'journal_article_blocks','article_localizations','article_hotspots',
      'cms_assets'
    ]) AS t LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_touch_updated_at ON %I; '||
      'CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON %I '||
      'FOR EACH ROW EXECUTE FUNCTION mood_touch_updated_at();',
      r.t, r.t
    );
  END LOOP;
END $$;

-- ============================================================================
-- REGISTER MIGRATION
-- ============================================================================
INSERT INTO schema_migrations (version, applied_at)
VALUES ('019_session_i_journal_media_engine.sql', NOW())
ON CONFLICT DO NOTHING;

COMMIT;
