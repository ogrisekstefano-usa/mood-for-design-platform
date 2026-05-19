-- ────────────────────────────────────────────────────────────────────
-- 048_market_intelligence_engine.sql — Phase 1 Foundation
--
-- 3 tabelle per il Market Intelligence Engine™ (Geo-Cultural Adaptive
-- System). Foundation only — niente AI logic, niente pattern recognition.
-- Solo schema, indici, FK e privacy-by-design (no PII).
--
--   1. market_submarkets        — taxonomy geo-culturale + profili
--   2. market_behavior_events   — segnali anonimi (no profiling)
--   3. market_insights          — narrative editoriali tenant-scoped
-- ────────────────────────────────────────────────────────────────────

-- ── 1. SUBMARKETS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_submarkets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     TEXT NOT NULL UNIQUE,           -- e.g. 'usa_miami', 'italy_milano'
  macro_market_code        TEXT NOT NULL,                  -- FK soft to markets.code (no hard FK to keep flexible)
  country_code             TEXT NOT NULL,                  -- ISO-3166-1 alpha-2
  region_type              TEXT NOT NULL DEFAULT 'city',   -- 'city' | 'metro' | 'region' | 'island' | 'coast'
  display_name             JSONB NOT NULL DEFAULT '{}',    -- {it-IT: "Milano", en-US: "Milan", ...}
  locale_code              TEXT,                           -- primary locale of the submarket (it-IT, en-US, ...)
  sort_order               INT NOT NULL DEFAULT 0,
  active                   BOOLEAN NOT NULL DEFAULT TRUE,

  -- ── Cultural profile (human-readable keyword arrays, per locale) ──
  -- Shape: { "it-IT": ["narrativo","emotivo",...], "en-US": [...] }
  editorial_profile        JSONB NOT NULL DEFAULT '{}',
  luxury_profile           JSONB NOT NULL DEFAULT '{}',
  consultation_style       JSONB NOT NULL DEFAULT '{}',
  visual_behavior          JSONB NOT NULL DEFAULT '{}',
  decision_rhythm          JSONB NOT NULL DEFAULT '{}',
  relationship_expectation JSONB NOT NULL DEFAULT '{}',
  hospitality_profile      JSONB NOT NULL DEFAULT '{}',
  cta_psychology           JSONB NOT NULL DEFAULT '{}',
  visual_rhythm            JSONB NOT NULL DEFAULT '{}',
  design_culture           JSONB NOT NULL DEFAULT '{}',
  seo_behavior             JSONB NOT NULL DEFAULT '{}',
  publishing_windows       JSONB NOT NULL DEFAULT '{}',

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submarkets_macro    ON market_submarkets(macro_market_code) WHERE active;
CREATE INDEX IF NOT EXISTS idx_submarkets_country  ON market_submarkets(country_code)      WHERE active;
CREATE INDEX IF NOT EXISTS idx_submarkets_sort     ON market_submarkets(macro_market_code, sort_order);

COMMENT ON TABLE  market_submarkets IS
  'Geo-cultural submarket taxonomy. Each row = a culturally distinct micro-market within a macro market (e.g. Miami within USA). All cultural fields are designer-facing keyword arrays per locale — NO technical jargon.';

-- ── 2. BEHAVIOR EVENTS (anonimi) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_behavior_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,                       -- which tenant's content was viewed
  session_hash    TEXT NOT NULL,                       -- HMAC-SHA256(ip+ua+day) — NO raw IP, rotates daily
  market_code     TEXT,                                -- inferred macro market
  submarket_code  TEXT,                                -- inferred submarket
  locale_code     TEXT,                                -- visitor locale
  event_type      TEXT NOT NULL,                       -- 'gallery_open' | 'hotspot_open' | 'article_read' | 'cta_open' | 'project_view' | 'material_focus' | ...
  event_data      JSONB NOT NULL DEFAULT '{}',         -- bounded shape: {resource_id, resource_type, dwell_ms, scroll_depth_pct, ...}
  geo_country     TEXT,                                -- ISO-3166-1 alpha-2 (NEVER more granular than region)
  geo_region      TEXT,                                -- ISO-3166-2 subdivision (e.g. 'US-FL', 'IT-25')
  geo_city        TEXT,                                -- city name (low-res, never lat/long)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_tenant_created  ON market_behavior_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_market          ON market_behavior_events(market_code, submarket_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type            ON market_behavior_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_session         ON market_behavior_events(session_hash, created_at DESC);

COMMENT ON TABLE  market_behavior_events IS
  'Anonymous behavioral signals for cultural intelligence. NO PII: ip/ua are hashed daily into session_hash, geography is region-level only (never coordinates). Used as raw material for editorial insight generation — never exposed as analytics dashboards.';

-- ── 3. INSIGHTS (editorial narratives) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS market_insights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  market_code     TEXT,                                -- optional: insight scoped to a macro
  submarket_code  TEXT,                                -- optional: insight scoped to a submarket
  locale_code     TEXT,                                -- locale of the insight text
  insight_type    TEXT NOT NULL DEFAULT 'editorial',   -- 'editorial' | 'cta' | 'visual' | 'hospitality' | 'material' | 'pacing'
  headline        TEXT NOT NULL,                       -- "Il Nord Est italiano reagisce meglio a narrative progettuali più tecniche."
  narrative       TEXT NOT NULL,                       -- 2-3 sentence editorial body
  recommendation  TEXT,                                -- "Considera di aprire i progetti con un dettaglio costruttivo …"
  evidence_score  NUMERIC(5,2),                        -- 0-100 — confidence (Phase 2 only; nullable Phase 1)
  status          TEXT NOT NULL DEFAULT 'draft',       -- 'draft' | 'published' | 'dismissed' | 'archived'
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_at    TIMESTAMPTZ,
  dismissed_by    UUID
);

CREATE INDEX IF NOT EXISTS idx_insights_tenant_status ON market_insights(tenant_id, status, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_market        ON market_insights(market_code, submarket_code) WHERE status = 'published';

COMMENT ON TABLE  market_insights IS
  'Editorial insight narratives generated from behavioral signals. NEVER raw metrics (no CTR%, no bounce rate). Tone: Financial Times × AD × Monocle. Strategic Co-Pilot, not autopilot.';
