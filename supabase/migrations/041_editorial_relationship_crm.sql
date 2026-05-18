-- ─────────────────────────────────────────────────────────────────────────
-- Phase R-CRM-2 — Editorial Relationship CRM™ EVOLUTION.
-- ─────────────────────────────────────────────────────────────────────────
-- This migration evolves the generic CRM foundation (migration 034) into a
-- luxury, editorial, A&D-native Relationship Orchestration Layer.
--
-- Architecture additions (5 new tables + 1 view + extended accounts schema):
--
--   1. accounts (extended)              + market_id, cultural_profile,
--                                         hospitality_positioning,
--                                         editorial_register_affinity,
--                                         design_intent_summary,
--                                         luxury_perception_axis,
--                                         relationship_journey_stage (canonical)
--   2. account_markets (NEW)            — many-to-many for multi-market accounts
--   3. relationship_engagement_signals  — every editorial signal (viewed
--                                         article, viewed project, CTA click,
--                                         sample request, …)
--   4. relationship_affinities          — computed intelligence snapshots
--                                         (1:1 with account, refreshed)
--   5. relationship_projects            — formal junction account ↔ projects
--   6. relationship_inspirations        — junction account ↔ design_references
--   7. relationship_material_affinities — material attraction tracking with
--                                         attraction_score
--   8. relationship_intelligence_v      — computed view exposing intelligence
--                                         signals for UI dashboards
--
-- Plus: seed migration of editorial-native journey stages into
-- relationship_lookups under the existing 'lifecycle_stage' group (so the
-- transition is non-breaking — old stages stay active, new stages are
-- added with higher sort_order priority).
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Extend accounts table ──────────────────────────────────────────
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS market_id                      UUID,
  ADD COLUMN IF NOT EXISTS cultural_profile               JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS hospitality_positioning        TEXT,
                                                          -- ceremonial | discrete | wellness-oriented
                                                          -- | experiential | family-first | corporate
  ADD COLUMN IF NOT EXISTS editorial_register_affinity    TEXT,
                                                          -- e.g. 'Ceremonial Hospitality'
                                                          -- (matches markets.cultural_profile.editorial_register)
  ADD COLUMN IF NOT EXISTS design_intent_summary          TEXT,
                                                          -- 1-paragraph "what this relationship is about"
  ADD COLUMN IF NOT EXISTS luxury_perception_axis         TEXT,
                                                          -- heritage_first | innovation_first |
                                                          -- material_first | atmosphere_first
  ADD COLUMN IF NOT EXISTS relationship_journey_stage     TEXT;
                                                          -- canonical Editorial Journey stage
                                                          -- (mirrors lifecycle_stage when set)

CREATE INDEX IF NOT EXISTS idx_accounts_tenant_market
  ON accounts(tenant_id, market_id) WHERE market_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_journey
  ON accounts(tenant_id, relationship_journey_stage);


-- ── 2. account_markets — multi-market relationships ──────────────────
CREATE TABLE IF NOT EXISTS account_markets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  market_id     UUID NOT NULL,
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  engagement_strength NUMERIC(5,2),         -- 0-100, computed from signals
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, market_id)
);
CREATE INDEX IF NOT EXISTS idx_account_markets_account ON account_markets(account_id);
CREATE INDEX IF NOT EXISTS idx_account_markets_market  ON account_markets(market_id);


-- ── 3. relationship_engagement_signals — every editorial signal ──────
CREATE TABLE IF NOT EXISTS relationship_engagement_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,

  signal_type     TEXT NOT NULL,
                  -- viewed_article | viewed_market_edition | viewed_project | viewed_moodboard
                  -- | viewed_material | clicked_cta | submitted_form | requested_sample
                  -- | requested_showroom_visit | requested_consultation | downloaded_proposal
                  -- | shared_article | saved_inspiration | opened_email | watched_video
                  -- | scrolled_long_form | quoted_material | specified_product

  -- Polymorphic target: the editorial entity the user engaged with.
  entity_type     TEXT,
                  -- magazine_article | magazine_variant | project | moodboard | material
                  -- | cms_section | form | cta_block | design_reference | hero_section
  entity_id       UUID,

  -- Cultural overlay: which market & locale was the user reading?
  market_id       UUID,
  locale_code     TEXT,
  surface         TEXT,
                  -- public_storefront | editorial_email | direct_share | embedded_widget
                  -- | client_proposal | review_link

  -- Editorial taxonomy snapshot (denormalised so we can build affinity
  -- aggregates without joining magazine_articles each time)
  editorial_register   TEXT,
  atmosphere_tags      JSONB NOT NULL DEFAULT '[]'::jsonb,
  material_tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
  cta_label            TEXT,
  cta_intent           TEXT,                 -- private_consultation | showroom_visit | …

  -- Quantitative signal weight (for affinity scoring)
  signal_weight        NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  dwell_seconds        INTEGER,              -- for view-type signals
  scroll_depth_pct     INTEGER,              -- for long-form engagement

  occurred_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id           TEXT,                 -- correlates multi-signal sessions
  metadata             JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_engagement_account_time
  ON relationship_engagement_signals(account_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_tenant_signal
  ON relationship_engagement_signals(tenant_id, signal_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_market
  ON relationship_engagement_signals(tenant_id, market_id) WHERE market_id IS NOT NULL;


-- ── 4. relationship_affinities — computed intelligence (1:1) ─────────
CREATE TABLE IF NOT EXISTS relationship_affinities (
  account_id                       UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  tenant_id                        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  most_engaged_market_edition_id   UUID,
  preferred_atmosphere             TEXT,
  preferred_atmosphere_tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_materials              JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_cta_intent             TEXT,
  preferred_editorial_register     TEXT,

  -- Behavioural orientations (0-100, derived from signal mix)
  hospitality_orientation_score    NUMERIC(5,2),
  specification_orientation_score  NUMERIC(5,2),
  long_form_engagement_score       NUMERIC(5,2),
  editorial_cadence_score          NUMERIC(5,2),
  luxury_perception_alignment      NUMERIC(5,2),

  -- Snapshot freshness
  signal_count_total               INTEGER NOT NULL DEFAULT 0,
  last_signal_at                   TIMESTAMPTZ,
  computed_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Free-form derived intelligence the AI layer may attach
  intelligence_payload             JSONB NOT NULL DEFAULT '{}'::jsonb
);


-- ── 5. relationship_projects — formal junction (account ↔ projects) ─
CREATE TABLE IF NOT EXISTS relationship_projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL,                -- references portfolio_projects(id)

  role              TEXT NOT NULL DEFAULT 'client',
                    -- client | architect | specifier | observer | referral_source
  collaboration_stage TEXT,                       -- canonical journey stage at time of linkage
  notes             TEXT,
  linked_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_by         UUID,
  UNIQUE (account_id, project_id, role)
);
CREATE INDEX IF NOT EXISTS idx_rel_projects_account ON relationship_projects(account_id);
CREATE INDEX IF NOT EXISTS idx_rel_projects_project ON relationship_projects(project_id);


-- ── 6. relationship_inspirations — junction account ↔ design_references
CREATE TABLE IF NOT EXISTS relationship_inspirations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  reference_id      UUID NOT NULL,                -- references design_references(id)

  source            TEXT NOT NULL DEFAULT 'saved_by_account',
                    -- saved_by_account | shared_by_advisor | inferred_from_engagement
  resonance_note    TEXT,
  saved_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, reference_id)
);
CREATE INDEX IF NOT EXISTS idx_rel_inspirations_account ON relationship_inspirations(account_id);


-- ── 7. relationship_material_affinities — material attraction tracking
CREATE TABLE IF NOT EXISTS relationship_material_affinities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  material_id       UUID NOT NULL,                -- references materials(id) or material_registry

  attraction_score  NUMERIC(5,2) NOT NULL DEFAULT 50.0,
  signal_count      INTEGER NOT NULL DEFAULT 0,
  last_engaged_at   TIMESTAMPTZ,
  sample_requested  BOOLEAN NOT NULL DEFAULT FALSE,
  specified         BOOLEAN NOT NULL DEFAULT FALSE,
  notes             TEXT,
  UNIQUE (account_id, material_id)
);
CREATE INDEX IF NOT EXISTS idx_rel_material_account
  ON relationship_material_affinities(account_id, attraction_score DESC);


-- ── 8. relationship_intelligence_v — convenience view ───────────────
DROP VIEW IF EXISTS relationship_intelligence_v;
CREATE VIEW relationship_intelligence_v AS
SELECT
  a.id                                 AS account_id,
  a.tenant_id,
  a.account_name,
  a.account_type,
  a.lifecycle_stage,
  a.relationship_journey_stage,
  a.market_id,
  a.cultural_profile,
  a.hospitality_positioning,
  a.editorial_register_affinity,
  a.luxury_perception_axis,
  a.last_activity_at,

  -- Aggregated signal counts (since beginning of time — frontend may
  -- request windowed variants via the endpoint instead of this view).
  COALESCE(sigc.signal_count_total, 0)             AS signal_count_total,
  COALESCE(sigc.signal_count_30d,   0)             AS signal_count_30d,
  COALESCE(sigc.signal_count_7d,    0)             AS signal_count_7d,
  sigc.last_signal_at,

  -- Affinity snapshot (computed by the affinity service or AI batch)
  aff.most_engaged_market_edition_id,
  aff.preferred_atmosphere,
  aff.preferred_atmosphere_tags,
  aff.preferred_materials,
  aff.preferred_cta_intent,
  aff.preferred_editorial_register,
  aff.hospitality_orientation_score,
  aff.specification_orientation_score,
  aff.long_form_engagement_score,
  aff.editorial_cadence_score,
  aff.luxury_perception_alignment,
  aff.computed_at                                  AS affinity_computed_at,

  -- Quick relationship link counts (helps drive UI badges)
  (SELECT COUNT(*) FROM relationship_projects     rp WHERE rp.account_id = a.id) AS linked_project_count,
  (SELECT COUNT(*) FROM relationship_inspirations ri WHERE ri.account_id = a.id) AS linked_inspiration_count,
  (SELECT COUNT(*) FROM relationship_material_affinities rm WHERE rm.account_id = a.id) AS material_affinity_count,
  (SELECT COUNT(*) FROM account_markets           am WHERE am.account_id = a.id) AS market_count
FROM accounts a
LEFT JOIN (
  SELECT
    account_id,
    COUNT(*)                                                      AS signal_count_total,
    COUNT(*) FILTER (WHERE occurred_at > NOW() - INTERVAL '30 days') AS signal_count_30d,
    COUNT(*) FILTER (WHERE occurred_at > NOW() - INTERVAL '7 days')  AS signal_count_7d,
    MAX(occurred_at)                                              AS last_signal_at
  FROM relationship_engagement_signals
  GROUP BY account_id
) sigc ON sigc.account_id = a.id
LEFT JOIN relationship_affinities aff ON aff.account_id = a.id;


-- ── 9. Seed Editorial Journey™ canonical stages ──────────────────────
-- Ensure the UNIQUE constraint exists (older deployments may have created
-- the table without it). Idempotent.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'relationship_lookups'::regclass
      AND contype = 'u'
      AND conname = 'relationship_lookups_tenant_group_value_uniq'
  ) THEN
    -- First de-duplicate any orphan rows that might block the constraint.
    DELETE FROM relationship_lookups a
    USING relationship_lookups b
    WHERE a.id > b.id
      AND a.tenant_id = b.tenant_id
      AND a.group_key = b.group_key
      AND a.value_key = b.value_key;
    BEGIN
      ALTER TABLE relationship_lookups
        ADD CONSTRAINT relationship_lookups_tenant_group_value_uniq
        UNIQUE (tenant_id, group_key, value_key);
    EXCEPTION WHEN duplicate_table THEN NULL;
    END;
  END IF;
END $$;

-- We add them as new `lifecycle_stage` rows (legacy stages remain) so that
-- /relationship-lookups returns both — UI can filter on `metadata.canonical=true`.
-- This is idempotent (UNIQUE constraint on (tenant_id, group_key, value_key)).
INSERT INTO relationship_lookups (tenant_id, group_key, value_key, label, sort_order, active, metadata)
SELECT t.id, 'lifecycle_stage', stage.value_key, stage.label, stage.sort_order, TRUE, stage.metadata
FROM tenants t
CROSS JOIN (VALUES
  ('discovery',               '{"it":"Scoperta","en":"Discovery"}'::jsonb,                              100, '{"canonical":true,"editorial_journey":true,"tone":"first-contact"}'::jsonb),
  ('inspiration',             '{"it":"Ispirazione","en":"Inspiration"}'::jsonb,                         110, '{"canonical":true,"editorial_journey":true,"tone":"exploration"}'::jsonb),
  ('editorial_engagement',    '{"it":"Coinvolgimento editoriale","en":"Editorial Engagement"}'::jsonb,  120, '{"canonical":true,"editorial_journey":true,"tone":"narrative"}'::jsonb),
  ('project_conversation',    '{"it":"Conversazione di progetto","en":"Project Conversation"}'::jsonb,  130, '{"canonical":true,"editorial_journey":true,"tone":"qualification"}'::jsonb),
  ('material_exploration',    '{"it":"Esplorazione materiali","en":"Material Exploration"}'::jsonb,     140, '{"canonical":true,"editorial_journey":true,"tone":"specification"}'::jsonb),
  ('strategic_direction',     '{"it":"Direzione strategica","en":"Strategic Direction"}'::jsonb,        150, '{"canonical":true,"editorial_journey":true,"tone":"design-direction"}'::jsonb),
  ('specification',           '{"it":"Specifica","en":"Specification"}'::jsonb,                         160, '{"canonical":true,"editorial_journey":true,"tone":"technical"}'::jsonb),
  ('proposal',                '{"it":"Proposta","en":"Proposal"}'::jsonb,                               170, '{"canonical":true,"editorial_journey":true,"tone":"commercial"}'::jsonb),
  ('active_collaboration',    '{"it":"Collaborazione attiva","en":"Active Collaboration"}'::jsonb,      180, '{"canonical":true,"editorial_journey":true,"tone":"delivery"}'::jsonb),
  ('long_term_relationship',  '{"it":"Relazione a lungo termine","en":"Long-Term Relationship"}'::jsonb,190, '{"canonical":true,"editorial_journey":true,"tone":"maintenance"}'::jsonb)
) AS stage(value_key, label, sort_order, metadata)
ON CONFLICT (tenant_id, group_key, value_key) DO NOTHING;


GRANT USAGE ON SCHEMA public TO service_role, authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  account_markets,
  relationship_engagement_signals,
  relationship_affinities,
  relationship_projects,
  relationship_inspirations,
  relationship_material_affinities
TO service_role, authenticated;
GRANT SELECT ON relationship_intelligence_v TO service_role, authenticated, anon;

COMMIT;
