-- 064 · Sprint G.2 · welcome_token per accesso pubblico al Journey appena nato.
ALTER TABLE design_journeys
  ADD COLUMN IF NOT EXISTS welcome_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS design_journeys_welcome_token_idx
  ON design_journeys (welcome_token) WHERE welcome_token IS NOT NULL;

COMMENT ON COLUMN design_journeys.welcome_token IS
  'G.2 · URL-safe 32-byte token che dà accesso pubblico read-only alla welcome surface del journey appena nato. NULL per journey creati internamente o legacy.';
