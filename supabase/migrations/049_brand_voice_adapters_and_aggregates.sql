-- ────────────────────────────────────────────────────────────────────
-- 049_brand_voice_adapters_and_aggregates.sql
--
-- A · Brand Voice Adapters: 8 editorial dimensions per tenant that
--     orient brand expression WITHIN macro-cultural foundations.
--     Strategic foundations remain locked.
--
-- B · Signal Aggregates: rollup table for fast read queries without
--     scanning raw events. Phase 1 foundation — Phase 2 cron job
--     will populate it on schedule.
-- ────────────────────────────────────────────────────────────────────

-- ── A · Brand Voice Adapters ──────────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS brand_voice_adapters JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tenants.brand_voice_adapters IS
  'Editorial dimensions the tenant can adjust within the cultural foundation:
   tone_warmth (-2..+2), hospitality_level, visual_boldness, editorial_pacing,
   architectural_intensity, emotional_intensity, material_storytelling, cta_style.
   Each value is a small signed integer centered at 0 (neutral).';


-- ── B · Signal Aggregates ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_signal_aggregates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  market_code     TEXT,
  submarket_code  TEXT,
  event_type      TEXT NOT NULL,
  window_key      TEXT NOT NULL,           -- '24h' | '7d' | '30d'
  event_count     INTEGER NOT NULL DEFAULT 0,
  unique_sessions INTEGER NOT NULL DEFAULT 0,
  last_event_at   TIMESTAMPTZ,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_aggregates_dim ON market_signal_aggregates(
  tenant_id, COALESCE(market_code,''), COALESCE(submarket_code,''), event_type, window_key
);
CREATE INDEX IF NOT EXISTS idx_aggregates_tenant      ON market_signal_aggregates(tenant_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_aggregates_submarket   ON market_signal_aggregates(submarket_code, window_key, event_count DESC);

COMMENT ON TABLE  market_signal_aggregates IS
  'Pre-computed rollups of market_behavior_events by tenant × submarket × event_type × window.
   Phase 1 = foundation table. Phase 2 = scheduled job populates it. Used by
   Market Insights™ to render counts without scanning raw events.';
