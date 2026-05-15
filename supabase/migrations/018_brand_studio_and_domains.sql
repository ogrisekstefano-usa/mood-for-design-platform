-- =====================================================================
-- 018_brand_studio_and_domains.sql — Brand Studio + Domains + Theme presets
-- =====================================================================
-- Adds:
--   • tenants.branding_settings, tenants.theme_settings (jsonb live theme)
--   • tenant_domains (custom domain CRUD + verification state machine)
--   • theme_presets (seeded curated presets, super_admin can add more)
--
-- Brand identity files (logos / favicons) are stored in the Supabase
-- bucket `tenant-branding` — created out-of-band by ops, not by SQL.
-- =====================================================================

-- ── 1. Extend tenants ──────────────────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS branding_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS theme_settings    jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tenants.branding_settings IS
  'Tenant identity overrides: public_brand_name, tagline, manifesto, logos, social_links, contact';
COMMENT ON COLUMN tenants.theme_settings IS
  'Tenant theme overrides: palette, typography, radius, shadow, density, preset_key';

-- ── 2. tenant_domains — custom domain CRUD ─────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_domains (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hostname            text NOT NULL,                          -- studiox.moodfordesign.com OR design.studiox.com
  kind                text NOT NULL DEFAULT 'custom',         -- subdomain | custom | apex
  is_primary          boolean NOT NULL DEFAULT false,
  verification_token  text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  verification_status text NOT NULL DEFAULT 'pending',        -- pending | verified | failed
  ssl_status          text NOT NULL DEFAULT 'pending',        -- pending | issued | failed
  last_checked_at     timestamptz,
  dns_target          text,                                   -- CNAME target we expect (e.g. moodfordesign.com)
  dns_records         jsonb NOT NULL DEFAULT '[]'::jsonb,     -- snapshot of required DNS records
  deleted_at          timestamptz,                            -- soft delete
  created_by          uuid REFERENCES users_profile(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_domains_hostname ON tenant_domains (lower(hostname)) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_domains_tenant ON tenant_domains (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_domains_status ON tenant_domains (verification_status);

COMMENT ON TABLE tenant_domains IS 'Custom domains/subdomains attached to a tenant. Verification is manual (DNS) for now; future webhook integration with Vercel API is planned.';

-- ── 3. theme_presets — curated by super_admin ──────────────────────────
CREATE TABLE IF NOT EXISTS theme_presets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text UNIQUE NOT NULL,            -- editorial | luxury | warm | monochrome | minimal | scandinavian | gallery | stone
  label         text NOT NULL,
  description   text,
  preview_url   text,
  vibe_tags     text[] NOT NULL DEFAULT '{}',
  theme         jsonb NOT NULL,                  -- full theme payload (palette + typography + radius + shadow + density)
  is_default    boolean NOT NULL DEFAULT false,
  sort_order    integer NOT NULL DEFAULT 100,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 4. Seed the curated presets ────────────────────────────────────────
-- Palette schema:
--   primary · secondary · accent · background · surface · text_primary
--   text_secondary · border · success · warning · danger
-- Typography schema:
--   display: <css family>
--   body: <css family>
INSERT INTO theme_presets (key, label, description, vibe_tags, sort_order, theme, is_default) VALUES
('editorial', 'Editorial', 'Magazine-grade contrast, Playfair × Montserrat', ARRAY['serif','contrast','minimal'], 10, '{
  "palette": {
    "primary": "#00C9B3", "secondary": "#33DCC6", "accent": "#7EE6DA",
    "background": "#0F0F10", "surface": "#16171A",
    "text_primary": "#F4F5F7", "text_secondary": "#C8CACE",
    "border": "rgba(244,245,247,0.10)",
    "success": "#22C55E", "warning": "#F59E0B", "danger": "#EF4444"
  },
  "typography": { "display": "Playfair Display", "body": "Montserrat" },
  "radius": "2px", "density": "comfortable", "shadow": "soft"
}'::jsonb, TRUE),
('luxury', 'Luxury', 'Brass accents on charcoal · Cormorant × Manrope', ARRAY['serif','warm','dark'], 20, '{
  "palette": {
    "primary": "#C9A36E", "secondary": "#D9BE91", "accent": "#E7CFB0",
    "background": "#111111", "surface": "#161616",
    "text_primary": "#F1ECE3", "text_secondary": "#C9C3B8",
    "border": "rgba(241,236,227,0.10)",
    "success": "#86C68E", "warning": "#E4B95F", "danger": "#E07A5F"
  },
  "typography": { "display": "Cormorant Garamond", "body": "Manrope" },
  "radius": "0px", "density": "spacious", "shadow": "soft"
}'::jsonb, FALSE),
('warm', 'Warm', 'Terracotta on cream · Fraunces × Inter', ARRAY['serif','warm','light'], 30, '{
  "palette": {
    "primary": "#C57B57", "secondary": "#D8A47F", "accent": "#F1B392",
    "background": "#F6EFE6", "surface": "#FFFFFF",
    "text_primary": "#2A2522", "text_secondary": "#615853",
    "border": "rgba(42,37,34,0.10)",
    "success": "#5C8C5A", "warning": "#D4A24C", "danger": "#B5523B"
  },
  "typography": { "display": "Fraunces", "body": "Inter" },
  "radius": "4px", "density": "comfortable", "shadow": "medium"
}'::jsonb, FALSE),
('monochrome', 'Monochrome', 'Editorial black & white · DM Serif × Plus Jakarta', ARRAY['serif','high-contrast','minimal'], 40, '{
  "palette": {
    "primary": "#0A0A0A", "secondary": "#262626", "accent": "#7C7C7C",
    "background": "#FFFFFF", "surface": "#F7F7F7",
    "text_primary": "#0A0A0A", "text_secondary": "#525252",
    "border": "rgba(10,10,10,0.10)",
    "success": "#16A34A", "warning": "#CA8A04", "danger": "#DC2626"
  },
  "typography": { "display": "DM Serif Display", "body": "Plus Jakarta Sans" },
  "radius": "0px", "density": "compact", "shadow": "none"
}'::jsonb, FALSE),
('minimal', 'Minimal', 'Quiet luxury · Inter Tight everywhere', ARRAY['sans','clean','calm'], 50, '{
  "palette": {
    "primary": "#0F172A", "secondary": "#334155", "accent": "#64748B",
    "background": "#FAFAFA", "surface": "#FFFFFF",
    "text_primary": "#0F172A", "text_secondary": "#475569",
    "border": "rgba(15,23,42,0.08)",
    "success": "#10B981", "warning": "#F59E0B", "danger": "#EF4444"
  },
  "typography": { "display": "Inter Tight", "body": "Inter Tight" },
  "radius": "8px", "density": "comfortable", "shadow": "soft"
}'::jsonb, FALSE),
('scandinavian', 'Scandinavian', 'Pale linen · DM Serif × Plus Jakarta', ARRAY['serif','light','airy'], 60, '{
  "palette": {
    "primary": "#3D5A57", "secondary": "#82A09C", "accent": "#C8C5BC",
    "background": "#FBF9F4", "surface": "#FFFFFF",
    "text_primary": "#1F3936", "text_secondary": "#566866",
    "border": "rgba(31,57,54,0.08)",
    "success": "#7CA084", "warning": "#D2A359", "danger": "#B5523B"
  },
  "typography": { "display": "DM Serif Display", "body": "Plus Jakarta Sans" },
  "radius": "4px", "density": "spacious", "shadow": "soft"
}'::jsonb, FALSE),
('gallery', 'Gallery', 'Art-gallery dark · Playfair × Space Grotesk', ARRAY['serif','dark','gallery'], 70, '{
  "palette": {
    "primary": "#E4DFD1", "secondary": "#9C8E73", "accent": "#D4A24C",
    "background": "#1A1816", "surface": "#252220",
    "text_primary": "#E4DFD1", "text_secondary": "#A8A299",
    "border": "rgba(228,223,209,0.08)",
    "success": "#A6C68A", "warning": "#E4B95F", "danger": "#D4796E"
  },
  "typography": { "display": "Playfair Display", "body": "Space Grotesk" },
  "radius": "0px", "density": "spacious", "shadow": "medium"
}'::jsonb, FALSE),
('stone', 'Stone & Material', 'Stone palette · Cormorant × Manrope', ARRAY['serif','natural','stone'], 80, '{
  "palette": {
    "primary": "#6B6E71", "secondary": "#8B8E92", "accent": "#A8A29E",
    "background": "#F5F4F1", "surface": "#FFFFFF",
    "text_primary": "#292524", "text_secondary": "#57534E",
    "border": "rgba(41,37,36,0.10)",
    "success": "#6F8C5A", "warning": "#D4A24C", "danger": "#B85C5C"
  },
  "typography": { "display": "Cormorant Garamond", "body": "Manrope" },
  "radius": "2px", "density": "comfortable", "shadow": "soft"
}'::jsonb, FALSE)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  vibe_tags = EXCLUDED.vibe_tags,
  sort_order = EXCLUDED.sort_order,
  theme = EXCLUDED.theme,
  is_default = EXCLUDED.is_default,
  updated_at = now();
