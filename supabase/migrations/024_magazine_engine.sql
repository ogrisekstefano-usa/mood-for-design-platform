-- ───────────────────────────────────────────────────────────────────────
-- Phase Y.1 — Editorial Lead Generation Engine
-- Magazine articles + Design References™ (hotspots) + moodboard candidates
-- ───────────────────────────────────────────────────────────────────────
-- Project-driven, NOT product-driven. No ecommerce semantics.
-- Tenant-scoped end-to-end. RLS deferred (server-side enforcement).
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS magazine_articles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft',  -- draft | published | archived
  cover_url       TEXT,
  hero_url        TEXT,
  scope           TEXT NOT NULL DEFAULT 'tenant', -- 'tenant' (showroom/studio journal) | 'corporate' (MOOD master journal)
  -- Localized editorial bag (i18n).
  -- Shape:
  --   { "<locale>": { "title": "...", "kicker": "...", "summary": "...",
  --                   "meta_title": "...", "meta_description": "...",
  --                   "category_label": "..." } }
  locale_content  JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Body blocks: ordered array of editorial blocks.
  -- Shape:
  --   [{ "id": "blk_...", "type": "hero|paragraph|quote|gallery|image|cta|material_focus",
  --      "image_url": "...", "alt": "...", "locale_content": {"<locale>":{"text":"..."}},
  --      "settings": {...} }]
  body_blocks     JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Categorization + SEO
  category_slug   TEXT,
  tags            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  default_locale  TEXT NOT NULL DEFAULT 'it',
  reading_minutes INTEGER,
  -- Publication metadata
  published_at    TIMESTAMPTZ,
  published_by    UUID REFERENCES users_profile(id),
  created_by      UUID REFERENCES users_profile(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Lightweight engagement counters (incremented best-effort by public API)
  view_count      INTEGER NOT NULL DEFAULT 0,
  save_count      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT magazine_articles_slug_per_tenant UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_magazine_articles_tenant_status
  ON magazine_articles(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_magazine_articles_pub_at
  ON magazine_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_magazine_articles_scope
  ON magazine_articles(scope, status);

-- ───────────────────────────────────────────────────────────────────────
-- DESIGN REFERENCES™ (internally: article_hotspots)
-- ───────────────────────────────────────────────────────────────────────
-- Editorial hotspot attached to an image-bearing body block.
-- NEVER a product picker. Always a design reference (material/finish/atmosphere).

CREATE TABLE IF NOT EXISTS article_hotspots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  article_id            UUID NOT NULL REFERENCES magazine_articles(id) ON DELETE CASCADE,
  -- Identifies the body block (one of body_blocks[].id). Stored loosely:
  -- the article_id is the strict tenant boundary; block_id is editorial glue.
  block_id              TEXT NOT NULL,
  -- Normalized 0..100 percentage coordinates so the hotspot tracks across
  -- responsive image renders.
  x_pct                 NUMERIC(5,2) NOT NULL,
  y_pct                 NUMERIC(5,2) NOT NULL,
  -- Reference taxonomy
  reference_type        TEXT NOT NULL DEFAULT 'atmosphere',
  -- material | product | fabric | lighting | furniture | finish |
  -- atmosphere | color_palette | custom
  -- Localized panel content
  locale_content        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { "<locale>": { "label": "...", "description": "...", "cta_label": "..." } }
  -- Linked entities (all optional, all tenant-scoped at app layer)
  linked_material_id    UUID,
  linked_asset_id       UUID,
  linked_article_id     UUID REFERENCES magazine_articles(id) ON DELETE SET NULL,
  linked_project_id     UUID,
  linked_collection_id  UUID,
  -- Project-action semantics (NEVER ecommerce)
  cta_action            TEXT NOT NULL DEFAULT 'save_to_project',
  -- save_to_project | discuss_with_advisor | add_to_moodboard |
  -- explore_material | request_similar | open_article | open_material
  sort_order            INTEGER NOT NULL DEFAULT 0,
  visible               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_article_hotspots_article
  ON article_hotspots(article_id, visible);
CREATE INDEX IF NOT EXISTS idx_article_hotspots_tenant
  ON article_hotspots(tenant_id);

-- ───────────────────────────────────────────────────────────────────────
-- MOODBOARD CANDIDATES — what a client SAVED while reading.
-- NOT yet a moodboard; a reference shortlist the studio's advisor reviews.
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS moodboard_candidates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_user_id      UUID REFERENCES users_profile(id) ON DELETE CASCADE,
  -- Anonymous capture path: stash a soft-lead identity here while we
  -- create / link a real profile. Backend will reconcile on signup.
  anonymous_lead_id   UUID,
  project_id          UUID,
  assignee_user_id    UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  -- Source
  source_type         TEXT NOT NULL,
  -- article_hotspot | media_asset | material | article
  source_id           UUID,
  source_article_id   UUID REFERENCES magazine_articles(id) ON DELETE SET NULL,
  source_hotspot_id   UUID REFERENCES article_hotspots(id) ON DELETE SET NULL,
  -- Captured snapshot (so the candidate survives if the source moves)
  title               TEXT,
  description         TEXT,
  image_url           TEXT,
  reference_type      TEXT,
  -- Lifecycle
  status              TEXT NOT NULL DEFAULT 'saved',
  -- saved | sent_to_advisor | added_to_moodboard | dismissed
  advisor_note        TEXT,
  -- Attribution
  source_locale       TEXT,
  source_referrer     TEXT,
  source_utm          JSONB,
  -- Audit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moodboard_candidates_tenant_client
  ON moodboard_candidates(tenant_id, client_user_id);
CREATE INDEX IF NOT EXISTS idx_moodboard_candidates_assignee
  ON moodboard_candidates(assignee_user_id, status);
CREATE INDEX IF NOT EXISTS idx_moodboard_candidates_article
  ON moodboard_candidates(source_article_id);

-- ───────────────────────────────────────────────────────────────────────
-- Soft lead capture for anonymous "Save this reference" flow.
-- Reconciled into a real profile when the visitor completes signup /
-- adaptive onboarding (Phase V).
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS magazine_anonymous_leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  first_name      TEXT,
  last_name       TEXT,
  project_type    TEXT,
  city            TEXT,
  country         TEXT,
  source_article_id UUID REFERENCES magazine_articles(id) ON DELETE SET NULL,
  source_hotspot_id UUID REFERENCES article_hotspots(id) ON DELETE SET NULL,
  source_locale   TEXT,
  source_referrer TEXT,
  source_utm      JSONB,
  consumed_at     TIMESTAMPTZ,
  consumed_profile_id UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anon_leads_tenant_email
  ON magazine_anonymous_leads(tenant_id, email);
