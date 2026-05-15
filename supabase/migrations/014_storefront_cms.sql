-- =============================================================================
-- Storefront CMS™ — Tenant public-facing content engine
-- Migration 014 · the persistence layer for the Cinematic Storefront Studio
--
-- ARCHITECTURE
-- ────────────
-- Strictly tenant-scoped, multilingual-first, future-AI-ready.
-- Three tables form the foundation:
--   • cms_pages    — one row per (tenant, page_key); holds page metadata,
--                    status (draft/published/scheduled), publish timing,
--                    locale_meta (per-locale SEO + completion percentage).
--   • cms_sections — ordered list of sections per page; each section has a
--                    section_type, visibility flag, and a locale_content JSONB
--                    bag (per-locale overrides) + settings JSONB (layout knobs).
--   • cms_assets   — every image uploaded through the storefront editor;
--                    tracks Supabase Storage path, focal_point, alt_text per
--                    locale, "used_in" reverse-index for safe deletion.
--
-- LOCALE STRATEGY
-- ───────────────
-- `locale_content` is a JSONB { _default: {...}, it: {...}, en-US: {...}, ... }.
-- Frontend resolves via the shared registry fallback chain.
-- A future AI translation job writes to `ai_translated_locales` and bumps
-- `locale_completion` so the editor can show "translated by AI · needs review".
--
-- PUBLISH WORKFLOW
-- ────────────────
-- status ∈ { draft, published, scheduled, archived }
-- A `scheduled_publish_at` timestamp + a periodic worker (future) can flip
-- scheduled → published automatically. For now Status moves manually via API.
--
-- DUPLICATION
-- ───────────
-- `source_tenant_id` traceability for future "Clone this tenant's storefront
-- as starting template" feature (SuperAdmin marketplace).
-- =============================================================================
BEGIN;

-- ── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE cms_page_status AS ENUM ('draft', 'published', 'scheduled', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cms_asset_source AS ENUM ('upload', 'stock', 'external_url');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── cms_pages ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cms_pages (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_key               TEXT NOT NULL,
  -- one of: 'home' | 'projects' | 'start_project' | 'professionals' | 'navigation' | 'ui'
  -- (Session B locks to these 6; future iterations may open custom pages)
  title                  TEXT,
  -- Per-locale SEO + completion telemetry:
  --   {
  --     "_default": { "seo_title": "...", "seo_description": "..." },
  --     "it":       { "seo_title": "...", "seo_description": "...", "completion": 1.0 },
  --     "en-US":    { "completion": 0.4 }
  --   }
  locale_meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Top-level page content for non-section pages (navigation, ui).
  -- Section-based pages (home/projects/etc.) keep this empty and use cms_sections.
  page_content           JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                 cms_page_status NOT NULL DEFAULT 'draft',
  scheduled_publish_at   TIMESTAMPTZ,
  published_at           TIMESTAMPTZ,
  -- Future AI translation pipeline tracking
  ai_translated_locales  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- Future approval workflow (designer → tenant_admin)
  approval_stage         TEXT,  -- null | 'pending_review' | 'approved' | 'changes_requested'
  approval_meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Tenant duplication traceability
  source_tenant_id       UUID,
  source_page_id         UUID,
  created_by             UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  updated_by             UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cms_pages_tenant_key_uq UNIQUE (tenant_id, page_key)
);

CREATE INDEX IF NOT EXISTS cms_pages_tenant_idx ON cms_pages(tenant_id);
CREATE INDEX IF NOT EXISTS cms_pages_status_idx ON cms_pages(status);
CREATE INDEX IF NOT EXISTS cms_pages_page_content_gin ON cms_pages USING GIN (page_content);
CREATE INDEX IF NOT EXISTS cms_pages_locale_meta_gin ON cms_pages USING GIN (locale_meta);

-- ── cms_sections ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cms_sections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_id           UUID NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  section_type      TEXT NOT NULL,
  -- e.g. 'hero', 'dual_cta', 'value_props', 'projects_grid', 'newsletter',
  -- 'wizard_step', 'professional_step', 'nav_top', 'footer_columns', ...
  sort_order        INTEGER NOT NULL DEFAULT 0,
  visible           BOOLEAN NOT NULL DEFAULT TRUE,
  -- Locale-keyed content for ALL text fields of this section:
  --   { "_default": {...}, "it": {...}, "en-US": {...}, ... }
  locale_content    JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Per-instance settings (layout variant, atmosphere, asset refs, etc.)
  settings          JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Reverse-index of cms_assets used by this section (helps "used_in").
  asset_refs        UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cms_sections_tenant_idx ON cms_sections(tenant_id);
CREATE INDEX IF NOT EXISTS cms_sections_page_idx   ON cms_sections(page_id, sort_order);
CREATE INDEX IF NOT EXISTS cms_sections_locale_gin ON cms_sections USING GIN (locale_content);

-- ── cms_assets ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cms_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source          cms_asset_source NOT NULL DEFAULT 'upload',
  -- Supabase Storage path inside the `tenant-assets` bucket. For external_url
  -- assets this is null and `public_url` carries the absolute URL.
  storage_bucket  TEXT,
  storage_path    TEXT,
  public_url      TEXT NOT NULL,
  -- Locale-keyed alt text { "_default": "...", "it": "...", "en-US": "..." }
  alt_text        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Focal point in percentages (0..1 for both x and y) for cover/contain fits
  focal_point     JSONB NOT NULL DEFAULT '{"x": 0.5, "y": 0.5}'::jsonb,
  -- { width, height, mime, size_bytes }
  dimensions      JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Tags for future search/filter ("hero", "interior", "kitchen", "warm")
  tags            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- Reverse-index of where this asset is currently referenced:
  --   [{ page_id, section_id, field }]
  used_in         JSONB NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by     UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cms_assets_tenant_idx ON cms_assets(tenant_id);
CREATE INDEX IF NOT EXISTS cms_assets_tags_gin   ON cms_assets USING GIN (tags);

-- ── Permissions (RLS disabled — enforced backend) ───────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON cms_pages    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON cms_sections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON cms_assets   TO service_role;
GRANT SELECT ON cms_pages, cms_sections, cms_assets TO authenticated, anon;

COMMIT;
