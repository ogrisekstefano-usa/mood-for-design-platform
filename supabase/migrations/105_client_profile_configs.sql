-- ────────────────────────────────────────────────────────────────────
-- 105_client_profile_configs.sql · ITER162 rev3
-- CMS gestione preset + placeholders Client Profile dal Command Center.
--
-- Una riga per tenant. JSONB flessibile per crescere senza migration.
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_profile_configs (
  tenant_id    UUID PRIMARY KEY,
  preset_key   TEXT NOT NULL DEFAULT 'atelier',
  placeholders JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {hero, atmosphere, lifestyle, materials, priority, nextStep, referente_fallback}
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cpc_preset_chk CHECK (preset_key IN ('atelier','axis','gallery','residence'))
);
