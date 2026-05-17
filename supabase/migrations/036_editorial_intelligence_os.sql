-- ─────────────────────────────────────────────────────────────────────────
-- Phase E-1A — Editorial Intelligence Operating System™
--
-- This is NOT a multi-language blog. It is the foundation of MOOD's
-- CULTURAL EDITORIAL ENGINE — every published variant is a
-- market-native reinterpretation of a central editorial direction,
-- never a flat translation.
--
-- Four tables:
--   1. editorial_masters   — the central editorial DIRECTION (memory):
--      conceptual direction, emotional objective, target psychology,
--      architectural tone, SEO intent, hospitality positioning,
--      material language, CTA intent, canonical article seed.
--   2. editorial_variants  — market-native reinterpretations (NOT
--      translations). N per master × market (seasonal / edition / A-B).
--      Carries BOTH the published locale version AND an internal
--      Blueprint-locale "understanding translation" used only for
--      review (never indexed / never published).
--   3. editorial_revisions — append-only history. Each request stores
--      structured option keys from the platform `revision_option`
--      lookup + a before/after snapshot.
--   4. editorial_cta_clicks — every CTA interaction on a variant.
--      Linked to article, market, cultural tone, project intent. Fed
--      directly into the Relationship CRM (Account + Contact +
--      Interaction). Stored signals: hotspots opened, materials viewed,
--      references saved, atmosphere context, time on article. No
--      aggressive analytics — just structured intelligence.
-- ─────────────────────────────────────────────────────────────────────────


-- 1. editorial_masters ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS editorial_masters (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Stable, human-friendly code (URL-safe). NOT slugged per-variant.
  code                     TEXT NOT NULL,
  title                    TEXT NOT NULL,
  canonical_locale         TEXT NOT NULL DEFAULT 'it-IT',   -- BCP-47

  -- THE CENTRAL EDITORIAL DIRECTION (memory).
  conceptual_direction     TEXT,                                  -- one-paragraph editorial brief
  emotional_objective      JSONB NOT NULL DEFAULT '{}'::jsonb,    -- {primary_feeling, secondary_feeling, ...}
  target_psychology        JSONB NOT NULL DEFAULT '{}'::jsonb,    -- {audience_archetype, mindset, fears, desires}
  architectural_tone       JSONB NOT NULL DEFAULT '{}'::jsonb,    -- {keywords, references}
  hospitality_positioning  JSONB NOT NULL DEFAULT '{}'::jsonb,    -- how the studio receives the reader
  material_language        JSONB NOT NULL DEFAULT '{}'::jsonb,    -- preferred materials/textures
  cta_intent               JSONB NOT NULL DEFAULT '{}'::jsonb,    -- what action the editor hopes for
  seo_intent               JSONB NOT NULL DEFAULT '{}'::jsonb,    -- editorial-grade intent, NOT keyword spam
  baseline_imagery         JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{url, role, alt, attribution}]
  canonical_article_seed   JSONB NOT NULL DEFAULT '{}'::jsonb,    -- {title, body_blocks} in canonical_locale

  -- Editorial taxonomy / discoverability.
  taxonomy                 JSONB NOT NULL DEFAULT '{}'::jsonb,    -- {categories[], tags[], topics[]}

  -- Lifecycle.
  master_status            TEXT NOT NULL DEFAULT 'draft',
                           -- draft | direction_defined | active | archived
  primary_owner_id         UUID,
  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at              TIMESTAMPTZ,

  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_editorial_masters_tenant_status
  ON editorial_masters (tenant_id, master_status);


-- 2. editorial_variants ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS editorial_variants (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  master_id                UUID NOT NULL REFERENCES editorial_masters(id) ON DELETE CASCADE,
  market_id                UUID NOT NULL REFERENCES markets(id) ON DELETE RESTRICT,

  -- Multiple variants per (master × market) are allowed.
  variant_slug             TEXT NOT NULL,                  -- URL-safe; unique within (master, market, edition, season)
  editorial_edition        TEXT,                            -- 'launch', 'fall_2026', 'gcc_winter', ...
  season_code              TEXT,                            -- 'ss26', 'fw26', 'evergreen', ...

  -- Target market context (denormalised from markets for fast read).
  target_locale            TEXT NOT NULL,                   -- BCP-47, e.g. 'de-DE'
  target_sub_region        TEXT,                            -- e.g. 'miami_south_florida'
  blueprint_review_locale  TEXT NOT NULL DEFAULT 'it-IT',   -- BCP-47 of the editor's Blueprint UI

  -- Published market version (the REAL article).
  title                    TEXT NOT NULL DEFAULT '',
  excerpt                  TEXT,
  body_blocks              JSONB NOT NULL DEFAULT '[]'::jsonb,
  hero_image_url           TEXT,
  hotspot_data             JSONB NOT NULL DEFAULT '[]'::jsonb,
  video_refs               JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Internal "understanding translation" — for the editor ONLY.
  -- {title, excerpt, body_blocks} mirrored into blueprint_review_locale.
  -- NEVER indexed, NEVER published, NEVER returned by public endpoints.
  internal_translation     JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Editorial signature.
  cultural_angle           TEXT,                            -- short editorial pitch
  tone_label               TEXT,                            -- value_key from `editorial_tone` lookup
  pacing_label             TEXT,                            -- value_key from `editorial_pacing` lookup

  -- SEO (editorial-grade, NOT keyword spam).
  seo                      JSONB NOT NULL DEFAULT '{}'::jsonb,
                           -- {seo_title, meta_description, hreflang, focus_intent, og_image}

  -- Multi-tier CTAs (soft / medium / strong). Each CTA carries:
  --   { id, tier, label, action, cta_intent, target_url, account_seed_stage }
  cta_set                  JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Workflow status (platform lookup `article_status`).
  status                   TEXT NOT NULL DEFAULT 'draft',
                           -- draft | direction_defined | ai_composing |
                           -- ready_for_editorial_review | revision_requested |
                           -- approved | scheduled | published | archived
  scheduled_at             TIMESTAMPTZ,
  published_at             TIMESTAMPTZ,
  is_published             BOOLEAN NOT NULL DEFAULT FALSE,
  indexable                BOOLEAN NOT NULL DEFAULT TRUE,
                           -- Mirrors SEO: published variants are indexable.
                           -- The internal_translation is ALWAYS non-indexable.

  assigned_editor_user_id  UUID,
  revision_count           INTEGER NOT NULL DEFAULT 0,
  last_revision_at         TIMESTAMPTZ,

  -- Cached structured intelligence signals (no Google Analytics-style
  -- aggressive tracking — just structured editorial signals).
  performance_signals      JSONB NOT NULL DEFAULT '{}'::jsonb,
                           -- {cta_click_count_by_tier, hotspot_opens, references_saved, …}

  ai_meta                  JSONB NOT NULL DEFAULT '{}'::jsonb,
                           -- filled in Phase E-1B: {model, tokens, latency_ms, prompt_id}

  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at              TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_editorial_variants_slug
  ON editorial_variants (master_id, market_id, COALESCE(editorial_edition, ''), COALESCE(season_code, ''), variant_slug);
CREATE INDEX IF NOT EXISTS idx_editorial_variants_tenant_status
  ON editorial_variants (tenant_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_editorial_variants_master
  ON editorial_variants (master_id);
CREATE INDEX IF NOT EXISTS idx_editorial_variants_market
  ON editorial_variants (market_id);
CREATE INDEX IF NOT EXISTS idx_editorial_variants_published
  ON editorial_variants (tenant_id, is_published, published_at DESC)
  WHERE is_published = TRUE;


-- 3. editorial_revisions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS editorial_revisions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  variant_id               UUID NOT NULL REFERENCES editorial_variants(id) ON DELETE CASCADE,

  requested_by_user_id     UUID,
  requested_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Structured option keys from platform `revision_option` lookup
  -- (e.g. 'increase_hospitality_resonance', 'reduce_luxury_intensity', …).
  revision_options         JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes                    TEXT,
  scope                    TEXT NOT NULL DEFAULT 'full',
                           -- full | title_only | body_only | cta_only | seo_only | imagery_only

  -- Append-only diff snapshots.
  before_snapshot          JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_snapshot           JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Filled in Phase E-1B when AI regenerates.
  ai_response_meta         JSONB NOT NULL DEFAULT '{}'::jsonb,

  status                   TEXT NOT NULL DEFAULT 'pending',
                           -- pending | applied | rejected | superseded
  applied_at               TIMESTAMPTZ,
  applied_by_user_id       UUID
);

CREATE INDEX IF NOT EXISTS idx_editorial_revisions_variant
  ON editorial_revisions (variant_id, requested_at DESC);


-- 4. editorial_cta_clicks ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS editorial_cta_clicks (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  variant_id               UUID NOT NULL REFERENCES editorial_variants(id) ON DELETE CASCADE,
  market_id                UUID NOT NULL REFERENCES markets(id) ON DELETE RESTRICT,

  -- CTA payload (lookup-driven).
  cta_id                   TEXT,                              -- the id inside variant.cta_set
  cta_tier                 TEXT NOT NULL,                     -- soft | medium | strong
  cta_action               TEXT,                              -- e.g. 'book_showroom_visit'
  cta_intent               TEXT,                              -- value_key from cta_intent lookup
                                                              -- (contact_studio, ask_materials, book_visit,
                                                              --  share_inspiration, send_floor_plan,
                                                              --  start_project, book_discovery_session)

  -- Editorial intelligence signals — NEVER aggressive analytics.
  atmosphere_context       JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {atmosphere_tags[], scroll_depth_pct}
  device_locale            TEXT,                                -- BCP-47 reported by browser
  time_on_article_sec      INTEGER,
  hotspots_opened          JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{hotspot_id, ts_offset_sec}]
  materials_viewed         JSONB NOT NULL DEFAULT '[]'::jsonb,
  references_saved         JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- CRM linkage. Filled by /api/public/editorial/cta-click when it creates
  -- (or links to) the Account+Contact in the Relationship CRM.
  resulting_lifecycle_stage TEXT,
                           -- new_inquiry | lead | discovery (platform lookup)
  resulting_intent_label   TEXT,
                           -- value_key from `editorial_lead_intent` lookup
                           -- (inspiration_interest | qualified_editorial_lead | discovery_request)
  account_id               UUID REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id               UUID REFERENCES contacts(id) ON DELETE SET NULL,
  interaction_id           UUID REFERENCES interactions(id) ON DELETE SET NULL,

  utm                      JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent_label         TEXT,
  ip_country               TEXT,                                -- ISO 3166-1 alpha-2; OPTIONAL, no routing yet.
  referrer                 TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_editorial_cta_clicks_variant
  ON editorial_cta_clicks (variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_editorial_cta_clicks_market
  ON editorial_cta_clicks (market_id, cta_tier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_editorial_cta_clicks_account
  ON editorial_cta_clicks (account_id) WHERE account_id IS NOT NULL;
