-- ────────────────────────────────────────────────────────────────────
-- 110_platform_languages.sql · ITER168 · Hotfix B · 28 Feb 2026
--
-- Migrate the LANGUAGE_REGISTRY from a static JS file + localStorage
-- override into a real Supabase-backed table.
--
-- After this migration, `/admin/languages` saves to DB (not localStorage)
-- and every frontend reader (phone prefix, market selector, switchers)
-- consumes the canonical DB rows via `/api/platform/languages`.
--
-- Seeded with the 9 entries currently in languages.js to preserve current
-- behavior (it, en-US, en-GB, fr, de, es, ar, zh, ja).
-- Idempotent · ON CONFLICT(code) DO UPDATE only the operational toggles.
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_languages (
  code                    TEXT PRIMARY KEY,    -- BCP-47 or short ('it', 'en-US')
  name                    TEXT NOT NULL,       -- English canonical
  native_name             TEXT NOT NULL,       -- Native script
  region                  TEXT,                -- ISO 3166-1 alpha-2 of primary country
  dial_code               TEXT,                -- Default phone prefix for this locale (display hint only)
  enabled                 BOOLEAN NOT NULL DEFAULT TRUE,
  public_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  blueprint_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  default_locale          BOOLEAN NOT NULL DEFAULT FALSE,
  rtl                     BOOLEAN NOT NULL DEFAULT FALSE,
  fallback_locale         TEXT,
  sort_order              INT NOT NULL DEFAULT 100,
  ai_translation_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  short_label             TEXT,                -- 'IT', 'EN-US', …
  base_code               TEXT,                -- 'it', 'en', 'fr', …
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_languages_enabled_idx
  ON platform_languages (enabled, sort_order);
CREATE INDEX IF NOT EXISTS platform_languages_public_idx
  ON platform_languages (public_enabled, sort_order) WHERE public_enabled = TRUE;
CREATE INDEX IF NOT EXISTS platform_languages_blueprint_idx
  ON platform_languages (blueprint_enabled, sort_order) WHERE blueprint_enabled = TRUE;

-- Ensure ONLY ONE default_locale=true (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS platform_languages_one_default
  ON platform_languages ((1)) WHERE default_locale = TRUE;


-- ── Seed initial 9 languages (mirrors languages.js current state) ──
INSERT INTO platform_languages
  (code, name, native_name, region, dial_code, enabled, public_enabled, blueprint_enabled, default_locale, rtl, fallback_locale, sort_order, ai_translation_enabled, short_label, base_code)
VALUES
  ('it',    'Italian',           'Italiano',     'IT', '+39',  TRUE,  TRUE,  TRUE,  TRUE,  FALSE, 'en-US', 10, TRUE,  'IT',    'it'),
  ('en-US', 'English (US)',      'English (US)', 'US', '+1',   TRUE,  TRUE,  TRUE,  FALSE, FALSE, 'en-US', 20, TRUE,  'EN-US', 'en'),
  ('en-GB', 'English (UK)',      'English (UK)', 'GB', '+44',  TRUE,  TRUE,  TRUE,  FALSE, FALSE, 'en-US', 30, TRUE,  'EN-UK', 'en'),
  ('fr',    'French',            'Français',     'FR', '+33',  TRUE,  TRUE,  TRUE,  FALSE, FALSE, 'en-US', 40, TRUE,  'FR',    'fr'),
  ('de',    'German',            'Deutsch',      'DE', '+49',  TRUE,  TRUE,  TRUE,  FALSE, FALSE, 'en-US', 50, TRUE,  'DE',    'de'),
  ('es',    'Spanish',           'Español',      'ES', '+34',  TRUE,  TRUE,  TRUE,  FALSE, FALSE, 'en-US', 60, TRUE,  'ES',    'es'),
  ('ar',    'Arabic (UAE)',      'العربية',       'AE', '+971', TRUE,  TRUE,  FALSE, FALSE, TRUE,  'en-US', 70, TRUE,  'AE',    'ar'),
  ('zh',    'Chinese (Simpl.)',  '中文',         'CN', '+86',  FALSE, FALSE, FALSE, FALSE, FALSE, 'en-US', 80, TRUE,  'ZH',    'zh'),
  ('ja',    'Japanese',          '日本語',       'JP', '+81',  FALSE, FALSE, FALSE, FALSE, FALSE, 'en-US', 90, TRUE,  'JA',    'ja')
ON CONFLICT (code) DO UPDATE SET
  region               = EXCLUDED.region,
  dial_code            = EXCLUDED.dial_code,
  -- DO NOT overwrite admin toggle state on re-run; just update metadata
  updated_at           = NOW();

DO $$ DECLARE cnt INT; BEGIN
  SELECT COUNT(*) INTO cnt FROM platform_languages WHERE enabled = TRUE;
  RAISE NOTICE '✓ platform_languages seeded: % enabled / % total',
    cnt, (SELECT COUNT(*) FROM platform_languages);
END $$;

COMMENT ON TABLE platform_languages IS
  'ITER168 · Single source of truth for language/locale availability across MOOD. Replaces the static LANGUAGE_REGISTRY in frontend/src/site/content/languages.js. Admins manage via /admin/languages → /api/admin/platform/languages.';
