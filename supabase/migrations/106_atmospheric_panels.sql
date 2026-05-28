-- ─────────────────────────────────────────────────────────────────────
-- ITER168 · Atmospheric Panels™ + Emotional Interpretation Layer™
-- First emotional intelligence surface of Blueprint Chameleon™.
--
-- These are NOT moodboard cards. They are orchestratable emotional
-- compositions used to interpret a client's first tensions and
-- atmospheres. Future Blueprint Chameleon™ work will compose them
-- dynamically per market / locale / brief signal.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS atmospheric_panels (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- NULL tenant_id ⇒ platform-shared panel (governed by root admin).
  -- Non-null ⇒ tenant-specific override / extension.

  slug                TEXT NOT NULL,
  title               TEXT NOT NULL,
  -- Editorial interpretation title — "Quiet Materials", "Warm
  -- Reflection", "Light & Stillness". NEVER a category like
  -- "Modern Living" / "Japandi".

  -- ── Emotional interpretation taxonomy (Chameleon™) ──
  emotional_tone      TEXT NOT NULL DEFAULT 'calm',
  --  calm | warm | reflective | ceremonial | editorial
  --  hospitality | contemplative | energetic

  light_temperature   TEXT NOT NULL DEFAULT 'neutral',
  --  cool | neutral | warm | sunset

  spatial_density     TEXT NOT NULL DEFAULT 'minimal',
  --  minimal | balanced | layered

  motion_level        TEXT NOT NULL DEFAULT 'still',
  --  still | soft | dynamic

  materiality         TEXT[] NOT NULL DEFAULT '{}',
  --  e.g. {travertino, lino, bronzo}

  cultural_influence  TEXT[] NOT NULL DEFAULT '{}',
  --  e.g. {italian, japandi-adjacent, hospitality}

  hospitality_index   SMALLINT NOT NULL DEFAULT 50,
  --  0 → austere · 100 → fully hospitable

  -- ── Asset stack (cinematic, NO Pinterest cards) ──
  visual_assets       JSONB NOT NULL DEFAULT '[]'::jsonb,
  --  [{url, kind:'image'|'video'|'gradient', alt, focal_point}]

  overlay_tone        TEXT NULL,
  --  'cream-veil' | 'bronze-veil' | 'cool-glass' | 'sunset-haze'

  -- ── Market & locale affinity for Chameleon™ orchestration ──
  locale_affinity     TEXT[] NOT NULL DEFAULT '{}',
  --  ISO-style: {'it-IT', 'en-US'}
  market_affinity     TEXT[] NOT NULL DEFAULT '{}',
  --  ISO 3166-1 alpha-2: {'IT', 'US', 'AE'}

  -- ── Editorial body (interpretive, NEVER directive) ──
  interpretation      TEXT NULL,
  --  Short 2-line editorial paragraph: what we begin to perceive.

  display_order       SMALLINT NOT NULL DEFAULT 100,
  active              BOOLEAN  NOT NULL DEFAULT TRUE,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT atmospheric_panels_tone_check
    CHECK (emotional_tone IN ('calm','warm','reflective','ceremonial',
                              'editorial','hospitality','contemplative','energetic')),
  CONSTRAINT atmospheric_panels_light_check
    CHECK (light_temperature IN ('cool','neutral','warm','sunset')),
  CONSTRAINT atmospheric_panels_density_check
    CHECK (spatial_density IN ('minimal','balanced','layered')),
  CONSTRAINT atmospheric_panels_motion_check
    CHECK (motion_level IN ('still','soft','dynamic')),
  CONSTRAINT atmospheric_panels_hospitality_check
    CHECK (hospitality_index BETWEEN 0 AND 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS atmospheric_panels_slug_tenant_uniq
  ON atmospheric_panels (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

CREATE INDEX IF NOT EXISTS atmospheric_panels_active_idx
  ON atmospheric_panels (active, display_order);

CREATE INDEX IF NOT EXISTS atmospheric_panels_tone_idx
  ON atmospheric_panels (emotional_tone, active);

-- ── Optional per-locale copy overrides (titles / interpretation) ──
CREATE TABLE IF NOT EXISTS atmospheric_panel_locales (
  panel_id          UUID NOT NULL REFERENCES atmospheric_panels(id) ON DELETE CASCADE,
  locale            TEXT NOT NULL,
  title             TEXT NULL,
  interpretation    TEXT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (panel_id, locale)
);

COMMENT ON TABLE atmospheric_panels IS
  'ITER168 · Atmospheric Panels™. Emotional compositions used by the
  Chameleon™ Emotional Interpretation Layer. NEVER stock photos.';
