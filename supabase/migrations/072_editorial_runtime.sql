-- ────────────────────────────────────────────────────────────────────
-- 072_editorial_runtime.sql — ITER143A+ · Dynamic Editorial Runtime™
--
-- Curated content orchestration layer. ZERO hardcoded content policy:
-- every editorial string (hero, CTA, label, helper, placeholder, chip,
-- empty state, validation copy, footer, etc.) lives in `editorial_blocks`
-- with per-locale variants in `editorial_block_translations`.
--
-- Scope model
-- ───────────
--   • scope='system'  → governed by SuperAdmin · tenant_id IS NULL.
--                       Used for: blueprint.moodfordesign.com public
--                       experience (begin-journey, professionals, header,
--                       footer, marketing CTAs, onboarding narrative).
--   • scope='tenant'  → governed by tenant_admin · tenant_id REQUIRED.
--                       Used for: studio.* tenants editing their own
--                       intro / partnership / portfolio copy.
--
-- Locale chain
-- ────────────
--   Each block has a source_locale (the language the studio wrote it in).
--   Translations are generated via ALE (semantic rewrite, not literal).
--   The resolver NEVER crosses language families on fallback:
--     en-US → en-GB → en   (allowed)
--     en-US → it          (FORBIDDEN — strict locale chain)
--   When no variant exists for the requested locale family, the API
--   returns NULL for that key so the frontend can render an empty/
--   skeleton state rather than leak a foreign language.
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS editorial_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope           TEXT NOT NULL CHECK (scope IN ('system','tenant')),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  namespace       TEXT NOT NULL,             -- e.g. 'site.begin_journey'
  block_key       TEXT NOT NULL,             -- e.g. 'hero.title'
  page_key        TEXT,                      -- 'begin-journey' (for page bundles)
  block_type      TEXT NOT NULL DEFAULT 'text',
    -- 'hero_title' | 'hero_subtitle' | 'cta_label' | 'label' | 'placeholder'
    -- | 'helper' | 'chip' | 'empty_state' | 'validation' | 'toast'
    -- | 'narrative' | 'footer' | 'meta' | 'text'
  source_locale   TEXT NOT NULL DEFAULT 'it',
  source_value    TEXT NOT NULL,
  source_hash     TEXT NOT NULL,             -- sha1 of source_value, for drift detect
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Uniqueness: a key is unique within (scope, tenant_id, namespace).
  -- For scope=system, tenant_id is NULL → we add a partial unique index below.
  CONSTRAINT editorial_blocks_tenant_consistency CHECK (
    (scope = 'system' AND tenant_id IS NULL) OR
    (scope = 'tenant' AND tenant_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS editorial_blocks_system_unique
  ON editorial_blocks (namespace, block_key)
  WHERE scope = 'system';

CREATE UNIQUE INDEX IF NOT EXISTS editorial_blocks_tenant_unique
  ON editorial_blocks (tenant_id, namespace, block_key)
  WHERE scope = 'tenant';

CREATE INDEX IF NOT EXISTS editorial_blocks_page_idx
  ON editorial_blocks (page_key, scope) WHERE is_active = TRUE;


CREATE TABLE IF NOT EXISTS editorial_block_translations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id        UUID NOT NULL REFERENCES editorial_blocks(id) ON DELETE CASCADE,
  locale          TEXT NOT NULL,        -- BCP-47, lowercased canonical (e.g. 'en-us')
  value           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'auto'
                  CHECK (status IN ('auto','manual','stale','source')),
  source_hash     TEXT,                 -- hash of source at translation time
  generated_by    TEXT NOT NULL DEFAULT 'ale',
                  -- 'ale' | 'human' | 'seed'
  model           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (block_id, locale)
);

CREATE INDEX IF NOT EXISTS editorial_block_translations_locale_idx
  ON editorial_block_translations (locale);
