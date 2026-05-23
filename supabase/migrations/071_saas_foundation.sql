-- ────────────────────────────────────────────────────────────────────
-- 071_saas_foundation.sql — ITER142 · SaaS Foundation & Atelier Preset Registry
--
-- Adds the three foundation tables/columns required for proper SaaS
-- governance on top of the existing multi-tenant base:
--
--   • atelier_presets_registry  (NEW) — canonical, frozen list of
--                                 6 Atelier presets the user has named.
--                                 NO rename runtime. NO new names without
--                                 a migration. SuperAdmin-only writes.
--
--   • tenant_atelier_preset     (NEW) — per-tenant active preset choice
--                                 + per-tenant overrides (logo, palette,
--                                 accent, locale defaults). Tenant_admin
--                                 may write here.
--
--   • tenant_domains.subdomain  (DERIVED VIEW) — tenant_domains already
--                                 stores `hostname`. We only add a
--                                 generated column `subdomain` so the
--                                 resolver can index it cheaply.
--
-- The existing tenant_domains schema (hostname / domain_type / ssl_status
-- / verification_*) is preserved as-is.
-- ────────────────────────────────────────────────────────────────────

-- ───── Atelier preset registry (frozen names) ─────────────────
CREATE TABLE IF NOT EXISTS atelier_presets_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,           -- e.g. 'nordic_emotions'
  display_name    TEXT NOT NULL,                  -- e.g. 'NORDIC EMOTIONS™'
  position        INTEGER NOT NULL,               -- 1..6 fixed ordering
  summary         TEXT,
  filter_json     JSONB NOT NULL DEFAULT '{}',    -- brightness/contrast/saturate/hue/sepia
  grain_level     NUMERIC(3,2) NOT NULL DEFAULT 0.08 CHECK (grain_level BETWEEN 0 AND 1),
  vignette_level  NUMERIC(3,2) NOT NULL DEFAULT 0.25 CHECK (vignette_level BETWEEN 0 AND 1),
  warmth_offset   NUMERIC(3,2) NOT NULL DEFAULT 0.00 CHECK (warmth_offset BETWEEN -0.5 AND 0.5),
  cyan_atmosphere NUMERIC(3,2) NOT NULL DEFAULT 0.10 CHECK (cyan_atmosphere BETWEEN 0 AND 1),
  is_locked       BOOLEAN NOT NULL DEFAULT TRUE,  -- TRUE = SuperAdmin-only write
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (position)
);

-- Seed the 6 canonical presets (idempotent).
INSERT INTO atelier_presets_registry (code, display_name, position, summary, filter_json, grain_level, vignette_level, warmth_offset, cyan_atmosphere)
VALUES
  ('nordic_emotions',   'NORDIC EMOTIONS™',    1,
   'Restraint. Cool desaturation. Architectural calm.',
   '{"brightness":0.62,"saturate":0.55,"contrast":1.18,"hue_rotate_deg":-8,"sepia":0}'::jsonb,
   0.08, 0.30, -0.05, 0.18),
  ('milano_editoriale', 'MILANO EDITORIALE™',  2,
   'Editorial precision. Deep blacks. Cinematic register.',
   '{"brightness":0.48,"saturate":0.42,"contrast":1.32,"hue_rotate_deg":-14,"sepia":0}'::jsonb,
   0.18, 0.55, -0.10, 0.28),
  ('desert_atelier',    'DESERT ATELIER™',     3,
   'Warm hospitality. Soft sepia bias. Fireplace register.',
   '{"brightness":0.78,"saturate":0.88,"contrast":1.06,"hue_rotate_deg":8,"sepia":0.14}'::jsonb,
   0.10, 0.25, 0.18, 0.00),
  ('japanese_gallery',  'JAPANESE GALLERY™',   4,
   'Wabi-sabi. Soft light. Editorial neutrality.',
   '{"brightness":0.86,"saturate":0.62,"contrast":1.04,"hue_rotate_deg":-3,"sepia":0.04}'::jsonb,
   0.04, 0.18, 0.02, 0.06),
  ('mood_for_design',   'MOOD for DESIGN™',    5,
   'House voice. Architectural dawn. Editorial precision.',
   '{"brightness":0.88,"saturate":0.72,"contrast":1.10,"hue_rotate_deg":-3,"sepia":0.06}'::jsonb,
   0.05, 0.18, 0.05, 0.08),
  ('bloom_atelier',     'BLOOM ATELIER™',      6,
   'Soft botanic warmth. Floral grading. Hospitality.',
   '{"brightness":0.92,"saturate":0.95,"contrast":1.02,"hue_rotate_deg":4,"sepia":0.10}'::jsonb,
   0.06, 0.22, 0.12, 0.04)
ON CONFLICT (code) DO UPDATE SET
  display_name    = EXCLUDED.display_name,
  position        = EXCLUDED.position,
  summary         = EXCLUDED.summary,
  filter_json     = EXCLUDED.filter_json,
  grain_level     = EXCLUDED.grain_level,
  vignette_level  = EXCLUDED.vignette_level,
  warmth_offset   = EXCLUDED.warmth_offset,
  cyan_atmosphere = EXCLUDED.cyan_atmosphere,
  updated_at      = NOW();


-- ───── Per-tenant Atelier preset selection + identity overrides ───
CREATE TABLE IF NOT EXISTS tenant_atelier_identity (
  tenant_id           UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  active_preset_code  TEXT NOT NULL DEFAULT 'mood_for_design'
                       REFERENCES atelier_presets_registry(code),
  logo_url            TEXT,
  palette_override    JSONB,                 -- {primary, secondary, accent, ink}
  accent_system       JSONB,
  editorial_tone      TEXT,                  -- e.g. 'editorial' | 'warm' | 'cinematic'
  default_locale      TEXT,                  -- e.g. 'it-IT'
  fallback_locales    JSONB DEFAULT '[]',    -- e.g. ['it','en']
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ───── Subdomain index on tenant_domains for {slug}.moodfordesign.com ─
-- The existing `hostname` column already holds the full host. We add a
-- functional index that lets the resolver match a subdomain prefix
-- without scanning the table.
CREATE INDEX IF NOT EXISTS tenant_domains_hostname_idx
  ON tenant_domains (lower(hostname));

-- Soft view that exposes "subdomain part" of moodfordesign.com hostnames
-- — convenience for the runtime resolver. Production keeps using hostname.
CREATE OR REPLACE VIEW tenant_subdomain_lookup AS
SELECT
  td.tenant_id,
  td.hostname,
  CASE
    WHEN lower(td.hostname) LIKE '%.moodfordesign.com'
      THEN split_part(lower(td.hostname), '.', 1)
    ELSE NULL
  END AS subdomain,
  td.is_primary,
  td.domain_type,
  td.ssl_status,
  td.verification_status,
  t.slug AS tenant_slug,
  t.name AS tenant_name
FROM tenant_domains td
JOIN tenants t ON t.id = td.tenant_id
WHERE td.deleted_at IS NULL;


-- ───── Email events table (P1 prep — empty for now) ──────────────
CREATE TABLE IF NOT EXISTS email_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,        -- 'lead_capture' | 'onboarding' | 'proposal_ready' | …
  recipient   TEXT NOT NULL,
  subject     TEXT,
  template    TEXT,
  status      TEXT NOT NULL DEFAULT 'queued',  -- queued | sent | failed | bounced
  provider    TEXT,                  -- 'supabase' | 'resend' | 'sendgrid'
  provider_id TEXT,                  -- external message id
  error       TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS email_events_tenant_idx ON email_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS email_events_status_idx ON email_events (status, created_at DESC);
