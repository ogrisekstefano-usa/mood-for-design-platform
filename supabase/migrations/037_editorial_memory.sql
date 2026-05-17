-- ─────────────────────────────────────────────────────────────────────────
-- Phase E-1B — Editorial Memory™ foundation.
--
-- editorial_market_learnings — aggregated, append-only intelligence
-- learned per market over time. Fed by:
--   • CTA click signals (atmosphere_context, hotspots_opened, materials_viewed)
--   • Conversion ratios per tier
--   • Revision frequency / option co-occurrence
--   • Approval timing
--   • Pacing/tone preference per market
--
-- It is NEVER presented to the end user as "AI learning". The Blueprint
-- surface refers to it as "Market Learning" / "Cultural Calibration".
-- editorial_composition_log — audit trail of every composition call
-- (compose_variant / refine_editorial_angle / rebalance_hospitality_tone
-- / generate_internal_translation). The user never sees "AI request" —
-- this is for engineering observability only.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS editorial_market_learnings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  market_id          UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,

  -- A pattern_key namespaces the signal:
  --   'preferred_pacing'            → which pacing label converts best
  --   'preferred_tone'              → which editorial_tone resonates
  --   'cta_tier_conversion'         → soft/medium/strong conversion ratio
  --   'cta_intent_resonance'        → which cta_intent earns clicks
  --   'atmosphere_signal_density'   → atmosphere_tags that correlate with strong CTAs
  --   'material_curiosity'          → materials_viewed → CTA tier
  --   'hotspot_engagement'          → hotspot opens → CTA tier
  --   'revision_option_pattern'     → which revisions repeat for this market
  --   'approval_cadence'            → median time to approval
  pattern_key        TEXT NOT NULL,

  signal_payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
                     -- e.g. {"top_pacing":"ceremonial","support":0.62,"sample":47}

  -- Statistical confidence (0..1) — driven by sample size and signal stability.
  confidence         NUMERIC(4,3) NOT NULL DEFAULT 0.0,
  sample_size        INTEGER NOT NULL DEFAULT 0,

  -- The composer uses learnings with confidence >= 0.55. Lower scores are
  -- still stored (so we can show "emerging trends" in the future).
  observed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recomputed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, market_id, pattern_key)
);

CREATE INDEX IF NOT EXISTS idx_editorial_market_learnings_market
  ON editorial_market_learnings (market_id, confidence DESC);


CREATE TABLE IF NOT EXISTS editorial_composition_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  variant_id      UUID REFERENCES editorial_variants(id) ON DELETE SET NULL,

  -- 'compose' | 'refine_angle' | 'rebalance_tone' | 'internal_translation'
  operation       TEXT NOT NULL,

  -- Module composition trace — which fragments contributed to the prompt.
  composition_trace JSONB NOT NULL DEFAULT '[]'::jsonb,
                    -- [{module:'sensory_atmosphere', sig:'miami_south_florida', tokens:412}, …]

  model_used      TEXT,                    -- 'anthropic/claude-sonnet-4-5-20250929'
  duration_ms     INTEGER,
  tokens_in       INTEGER,
  tokens_out      INTEGER,
  outcome         TEXT NOT NULL DEFAULT 'ok',    -- 'ok' | 'parse_error' | 'timeout' | 'error'
  error_brief     TEXT,
  result_preview  TEXT,                    -- first 200 chars of structured result

  -- Editorial-grade meta the user MAY see in audit views.
  user_facing_label TEXT,                  -- 'Composing editorial direction…'
  requested_by_user_id UUID,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_editorial_composition_log_variant
  ON editorial_composition_log (variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_editorial_composition_log_tenant
  ON editorial_composition_log (tenant_id, created_at DESC);
