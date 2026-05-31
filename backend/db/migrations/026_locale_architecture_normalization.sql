-- ─────────────────────────────────────────────────────────────────────
-- Migration 026 — Locale Architecture Normalization
-- Date: 2026-05-31
-- Authority: LOCALE_ARCHITECTURE_DIRECTIVE.md (binding directive)
--
-- Scope:
--   1. Normalize `platform_languages.code` to BCP-47 with region tag (xx-XX)
--   2. Normalize `editorial_block_translations.locale` to same format
--   3. Add missing locales pre-registered (disabled): es-MX, pt-BR, pt-PT
--   4. Update default + enabled state per user MVP decision:
--      ENABLED: it-IT, en-US
--      DISABLED (pre-registered): en-GB, fr-FR, de-DE, es-ES, es-MX,
--                                  ar-AE, pt-BR, pt-PT, zh-CN, ja-JP
--
-- Strategy:
--   • IDEMPOTENT — re-runnable safely
--   • ADDITIVE primary path (INSERT… ON CONFLICT)
--   • Renaming step uses transaction + UPDATE (not DELETE/INSERT)
--   • editorial_block_translations dedup before rename
--
-- This migration touches CMS-related tables only.
-- NOT-IMPACTED: users, studio_requests, studio_relations,
--               access_magic_links, tenants (data unaffected)
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. platform_languages — add missing columns if absent ──────────
-- (schema already canonical, just ensure all needed columns exist)

-- Already present per inspection:
--   code, name, native_name, region, dial_code,
--   enabled, public_enabled, blueprint_enabled, default_locale,
--   rtl, fallback_locale, sort_order, ai_translation_enabled,
--   short_label, base_code, metadata, created_at, updated_at
--
-- No ALTER needed. Schema is compatible with LOCALE_ARCHITECTURE_DIRECTIVE §4.

-- ── 2. Normalize platform_languages.code → xx-XX ───────────────────
-- For each language without region tag, update code to BCP-47 form.
-- Idempotent: if already in xx-XX form, no-op.

-- Italian: it → it-IT
UPDATE platform_languages
   SET code = 'it-IT',
       region = 'IT',
       short_label = 'IT-IT',
       updated_at = now()
 WHERE code = 'it';

-- German: de → de-DE
UPDATE platform_languages
   SET code = 'de-DE',
       region = 'DE',
       short_label = 'DE-DE',
       updated_at = now()
 WHERE code = 'de';

-- Spanish: es → es-ES
UPDATE platform_languages
   SET code = 'es-ES',
       region = 'ES',
       short_label = 'ES-ES',
       name = 'Spanish (Spain)',
       updated_at = now()
 WHERE code = 'es';

-- French: fr → fr-FR
UPDATE platform_languages
   SET code = 'fr-FR',
       region = 'FR',
       short_label = 'FR-FR',
       updated_at = now()
 WHERE code = 'fr';

-- Arabic: ar → ar-AE
UPDATE platform_languages
   SET code = 'ar-AE',
       region = 'AE',
       short_label = 'AR-AE',
       updated_at = now()
 WHERE code = 'ar';

-- Chinese: zh → zh-CN
UPDATE platform_languages
   SET code = 'zh-CN',
       region = 'CN',
       short_label = 'ZH-CN',
       name = 'Chinese (Simplified)',
       updated_at = now()
 WHERE code = 'zh';

-- Japanese: ja → ja-JP
UPDATE platform_languages
   SET code = 'ja-JP',
       region = 'JP',
       short_label = 'JA-JP',
       updated_at = now()
 WHERE code = 'ja';

-- ── 3. Pre-register missing locales (disabled) ─────────────────────
INSERT INTO platform_languages
  (code, name, native_name, region, dial_code,
   enabled, public_enabled, blueprint_enabled, default_locale,
   rtl, fallback_locale, sort_order, ai_translation_enabled,
   short_label, base_code, metadata)
VALUES
  ('es-MX', 'Spanish (Mexico)', 'Español', 'MX', '+52',
   false, false, false, false, false, 'es-ES', 65, true,
   'ES-MX', 'es', '{}'::jsonb),
  ('pt-BR', 'Portuguese (Brazil)', 'Português', 'BR', '+55',
   false, false, false, false, false, 'en-US', 75, true,
   'PT-BR', 'pt', '{}'::jsonb),
  ('pt-PT', 'Portuguese (Portugal)', 'Português', 'PT', '+351',
   false, false, false, false, false, 'pt-BR', 76, true,
   'PT-PT', 'pt', '{}'::jsonb)
ON CONFLICT (code) DO UPDATE
  SET updated_at = now();

-- ── 4. Enforce MVP enablement state ────────────────────────────────
-- User MVP decision: enabled = it-IT, en-US only

UPDATE platform_languages SET enabled = true,  blueprint_enabled = true,  public_enabled = true,  updated_at = now() WHERE code = 'it-IT';
UPDATE platform_languages SET enabled = true,  blueprint_enabled = true,  public_enabled = true,  updated_at = now() WHERE code = 'en-US';
UPDATE platform_languages SET enabled = false, blueprint_enabled = false, public_enabled = false, updated_at = now() WHERE code IN ('en-GB','fr-FR','de-DE','es-ES','es-MX','ar-AE','pt-BR','pt-PT','zh-CN','ja-JP');

-- Ensure exactly 1 default = it-IT
UPDATE platform_languages SET default_locale = false WHERE default_locale = true;
UPDATE platform_languages SET default_locale = true,  updated_at = now() WHERE code = 'it-IT';

-- Update fallback_locale references (was pointing to en-US which is unchanged)
-- Update any references that still pointed to old codes (now normalized)
UPDATE platform_languages SET fallback_locale = 'es-ES' WHERE fallback_locale = 'es';
UPDATE platform_languages SET fallback_locale = 'de-DE' WHERE fallback_locale = 'de';
UPDATE platform_languages SET fallback_locale = 'fr-FR' WHERE fallback_locale = 'fr';
UPDATE platform_languages SET fallback_locale = 'it-IT' WHERE fallback_locale = 'it';
UPDATE platform_languages SET fallback_locale = 'ar-AE' WHERE fallback_locale = 'ar';

-- ── 5. Normalize editorial_block_translations.locale ───────────────
-- Map old codes → canonical xx-XX.
-- Use staging dedup: if both old and new exist for same block_id, prefer most recent.

-- 5a. Dedup: where same block has both 'it' AND 'it-it' or 'it-IT', keep newest
WITH dedup_targets AS (
  SELECT block_id, locale,
         ROW_NUMBER() OVER (
           PARTITION BY block_id, LOWER(locale)
           ORDER BY updated_at DESC, id DESC
         ) AS rn
  FROM editorial_block_translations
  WHERE LOWER(locale) IN ('it', 'it-it', 'en-us', 'en-gb', 'en-uk',
                          'de', 'de-de', 'es', 'es-es',
                          'fr', 'fr-fr')
)
DELETE FROM editorial_block_translations
WHERE id IN (
  SELECT t.id FROM editorial_block_translations t
  JOIN dedup_targets d ON d.block_id = t.block_id AND d.locale = t.locale
  WHERE d.rn > 1
);

-- 5b. Rename to canonical form (case-correct)
-- Note: `en-uk` is an alias for `en-GB`
UPDATE editorial_block_translations SET locale = 'it-IT', updated_at = now() WHERE locale IN ('it', 'it-it');
UPDATE editorial_block_translations SET locale = 'en-US', updated_at = now() WHERE locale IN ('en-us');
UPDATE editorial_block_translations SET locale = 'en-GB', updated_at = now() WHERE locale IN ('en-gb', 'en-uk');
UPDATE editorial_block_translations SET locale = 'de-DE', updated_at = now() WHERE locale IN ('de', 'de-de');
UPDATE editorial_block_translations SET locale = 'es-ES', updated_at = now() WHERE locale IN ('es', 'es-es');
UPDATE editorial_block_translations SET locale = 'fr-FR', updated_at = now() WHERE locale IN ('fr', 'fr-fr');

-- 5c. After rename, if any duplicate (block_id, locale) remain, keep newest
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY block_id, locale
           ORDER BY updated_at DESC, id DESC
         ) AS rn
  FROM editorial_block_translations
)
DELETE FROM editorial_block_translations
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ── 6. Ensure uniqueness constraint exists ─────────────────────────
-- Already constrained via PK + unique (block_id, locale) implicit on practice
-- Add explicit unique index if missing
CREATE UNIQUE INDEX IF NOT EXISTS uq_editorial_block_tx_unique
  ON editorial_block_translations(block_id, locale);

-- ── 7. Ensure default uniqueness on platform_languages ─────────────
-- Drop old conflicting index if exists, then add partial unique
DROP INDEX IF EXISTS uq_platform_languages_default;
CREATE UNIQUE INDEX uq_platform_languages_default
  ON platform_languages((default_locale))
  WHERE default_locale = true;

-- ── 8. Update editorial_blocks.source_locale references ────────────
-- Where source_locale was 'it', update to 'it-IT'
UPDATE editorial_blocks
   SET source_locale = 'it-IT', updated_at = now()
 WHERE source_locale = 'it';

UPDATE editorial_blocks
   SET source_locale = 'en-US', updated_at = now()
 WHERE source_locale = 'en-us';

-- ── 9. Audit log ───────────────────────────────────────────────────
-- Insert into a generic audit table if exists (skipped if not present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_audit_log') THEN
    INSERT INTO platform_audit_log(event_type, payload, created_at)
    VALUES (
      'migration_026_locale_normalization',
      jsonb_build_object(
        'migration', '026_locale_architecture_normalization',
        'enabled_at_mvp', ARRAY['it-IT','en-US'],
        'pre_registered_disabled', ARRAY['en-GB','fr-FR','de-DE','es-ES','es-MX','ar-AE','pt-BR','pt-PT','zh-CN','ja-JP'],
        'default_locale', 'it-IT'
      ),
      now()
    );
  END IF;
END $$;

COMMIT;

-- ── 10. Verification queries (manual checkpoint) ───────────────────
-- After applying, validate with:
--   SELECT code, enabled, default_locale, rtl FROM platform_languages ORDER BY sort_order;
--   SELECT DISTINCT locale FROM editorial_block_translations ORDER BY locale;
--   SELECT DISTINCT source_locale FROM editorial_blocks ORDER BY source_locale;
