-- ─────────────────────────────────────────────────────────────────
-- 066 · Sprint ITER125 · Studio Voice™
--       Editorial Language Memory + Translation Governance
--
-- Builds on iter124 (`message_translations`, `tenant_dnt_registry`,
-- `studio_translation_preferences`) and adds:
--
--   1. studio_vocabulary           — per-tenant editorial term pairs
--                                    (IT→EN: "materico"→"material-rich")
--   2. studio_translation_corrections — manual rewrites of an LLM output
--                                    (audit trail + Learning System™)
--   3. message_translations.previous_text — track edits for the
--                                    Translation Memory Inspector™.
--
-- Reused (no schema change):
--   - studio_translation_preferences  · Studio Language DNA™ profile
--     (tone preset, vocabulary, communication style, density, hospitality)
--     stored as preference_key='language_dna' + preference_value JSONB.
--   - message_translations.review_status='locked_approved'
--     · the Lock-Approved flag (sacred — never re-translated).
-- ─────────────────────────────────────────────────────────────────
BEGIN;

-- ── 1) studio_vocabulary ───────────────────────────────────────
-- Editorial term pairs the studio wants enforced in EVERY translation.
-- Injected into the LLM prompt as a "preferred vocabulary" addendum,
-- and used as a post-translation guard (if the model deviated, the
-- guard rewrites the output to match the locked term).
--
-- Example:
--   source_term='materico'  · locale_pair='it→en-US'
--   preferred_translation='material-rich'
--   category='material'
--   is_active=true
CREATE TABLE IF NOT EXISTS studio_vocabulary (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_term            text NOT NULL,
    source_locale          text NOT NULL,
    target_locale          text NOT NULL,
    preferred_translation  text NOT NULL,
    category               text NOT NULL DEFAULT 'editorial'
                           CHECK (category IN ('editorial','material','atmosphere',
                                               'spatial','relational','technical')),
    notes                  text,
    is_active              boolean NOT NULL DEFAULT true,
    usage_count            int NOT NULL DEFAULT 0,
    created_by             uuid REFERENCES users_profile(id) ON DELETE SET NULL,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_studio_vocabulary_term
    ON studio_vocabulary (tenant_id, lower(source_term), source_locale, target_locale);
CREATE INDEX IF NOT EXISTS ix_studio_vocabulary_tenant_active
    ON studio_vocabulary (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS ix_studio_vocabulary_locale_pair
    ON studio_vocabulary (tenant_id, source_locale, target_locale, is_active);

COMMENT ON TABLE studio_vocabulary IS
  'ITER125 · Studio Voice™ preferred vocabulary. Editorial term pairs the studio wants enforced. Read by the ALE prompt builder + applied as a post-translation guard.';


-- ── 2) studio_translation_corrections ─────────────────────────
-- Audit trail of manual rewrites. Each correction is a teachable moment
-- for the Learning System™: future prompts include recent corrections
-- as few-shot calibration ("you wrote X, the studio rewrote it as Y").
CREATE TABLE IF NOT EXISTS studio_translation_corrections (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- variant we corrected (FK to message_translations.id; soft via uuid type only,
    -- since variants can be invalidated and we want the audit trail to survive)
    variant_id              uuid,
    source_locale           text NOT NULL,
    target_locale           text NOT NULL,
    original_text           text NOT NULL,
    ai_translation          text NOT NULL,
    studio_translation      text NOT NULL,
    rationale               text,
    corrected_by            uuid REFERENCES users_profile(id) ON DELETE SET NULL,
    created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_studio_corrections_tenant
    ON studio_translation_corrections (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_studio_corrections_locale_pair
    ON studio_translation_corrections (tenant_id, source_locale, target_locale, created_at DESC);

COMMENT ON TABLE studio_translation_corrections IS
  'ITER125 · Learning System™. Audit trail of studio rewrites. The most recent ~5 corrections (per locale pair) are injected into the prompt as few-shot calibration examples.';


-- ── 3) Edit tracking on message_translations ───────────────────
ALTER TABLE message_translations
    ADD COLUMN IF NOT EXISTS previous_localized_text text;

COMMENT ON COLUMN message_translations.previous_localized_text IS
  'ITER125 · Previous localized_text before manual correction. Empty for AI-only variants. Powers the Translation Memory Inspector™ "before/after" view.';


-- ── 4) Usage counter on message_translations ──────────────────
ALTER TABLE message_translations
    ADD COLUMN IF NOT EXISTS usage_count int NOT NULL DEFAULT 1;
COMMENT ON COLUMN message_translations.usage_count IS
  'ITER125 · How many cache hits this variant has served. Bumped on every cache hit (best-effort).';

COMMIT;
