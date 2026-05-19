-- ────────────────────────────────────────────────────────────────────
-- 047_market_intelligence.sql — Humanized Market Matrix™
--
-- Adds a single JSONB column to store designer-facing market
-- intelligence: short editorial keywords + multilingual insight
-- panels (tone, visual style, CTA behavior, client expectations,
-- imagery, headlines, cultural pitfalls).
--
-- Shape:
--   {
--     "keywords": {
--       "it-IT": ["narrativo","emotivo",...],
--       "en-US": [...], ...
--     },
--     "insights": {
--       "it-IT": {
--         "tone": "...", "visual_style": "...", "cta_behavior": "...",
--         "client_expectations": "...", "imagery": "...",
--         "headlines": "...", "pitfalls": "..."
--       },
--       ...
--     }
--   }
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS market_intelligence JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN markets.market_intelligence IS
  'Designer-facing Market Matrix data: humanized keywords + multilingual insight panels (tone/visual_style/cta_behavior/client_expectations/imagery/headlines/pitfalls).';
