-- ─────────────────────────────────────────────────────────────────
-- 065 · Sprint ITER124 · Adaptive Language Experience™
--       Persistent Translation Layer™
--
-- Adds:
--   1. message_translations          — per-message localized variants
--                                      keyed by (message_id, target_locale)
--   2. tenant_dnt_registry           — tenant-scoped Do-Not-Translate lexicon
--                                      (brands, materials, designers, collections)
--   3. studio_translation_preferences — Studio Voice Learning™ foundation
--                                      (per-tenant tone/style overrides)
--   4. client_messages.source_locale — real source language of each message
-- ─────────────────────────────────────────────────────────────────
BEGIN;

-- ── 1) message_translations ────────────────────────────────────
-- A message has 1 original + N localized variants. Each variant
-- is stable: same original_text → same localized_text (immutability rule).
-- When original_text changes, downstream code invalidates all variants
-- for the affected message_id.
CREATE TABLE IF NOT EXISTS message_translations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- The source content the translation is bound to. message_id is a free
    -- identifier (it can be a client_messages.id, milestone_note.id,
    -- timeline_event.id, …) — the type lives in `surface` so the same
    -- table serves every ALE consumer.
    message_id          text NOT NULL,
    surface             text NOT NULL DEFAULT 'client_message',
    source_locale       text NOT NULL,
    target_locale       text NOT NULL,
    original_text       text NOT NULL,
    -- sha1(original_text) — used to detect edits to invalidate variants.
    original_hash       text NOT NULL,
    localized_text      text NOT NULL,
    translation_model   text,
    confidence_score    real,
    -- AI-only · reviewed · locked-approved (review system foundation)
    review_status       text NOT NULL DEFAULT 'ai_only'
                        CHECK (review_status IN ('ai_only','human_reviewed','locked_approved')),
    reviewed_by         uuid REFERENCES users_profile(id) ON DELETE SET NULL,
    reviewed_at         timestamptz,
    -- monotonic per (message_id, target_locale): bumped on regeneration after edit.
    translation_version int NOT NULL DEFAULT 1,
    duration_ms         int,
    metadata_json       jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_message_translations_message_target
    ON message_translations (message_id, target_locale, translation_version);
CREATE INDEX IF NOT EXISTS ix_message_translations_message_target_latest
    ON message_translations (message_id, target_locale, translation_version DESC);
CREATE INDEX IF NOT EXISTS ix_message_translations_tenant
    ON message_translations (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_message_translations_source_locale
    ON message_translations (tenant_id, source_locale);
CREATE INDEX IF NOT EXISTS ix_message_translations_target_locale
    ON message_translations (tenant_id, target_locale);
-- Translation Memory™ reuse: same (tenant, source_locale, target_locale,
-- original_hash) → reuse identical localized_text for another message_id.
CREATE INDEX IF NOT EXISTS ix_message_translations_memory_lookup
    ON message_translations (tenant_id, source_locale, target_locale, original_hash);

COMMENT ON TABLE message_translations IS
  'ITER124 · ALE Persistent Translation Layer. Stable localized variants keyed by (message_id, target_locale, translation_version). Immutability rule: same original_text → same localized_text. Invalidation: on source edit, new row with bumped translation_version.';

COMMENT ON COLUMN message_translations.surface IS
  'Source surface: client_message, milestone_note, timeline_event, journey_comment, revision_request, shared_thought, site_evolution_note, dossier_remark.';

COMMENT ON COLUMN message_translations.review_status IS
  'AI-only: machine output. Human-reviewed: studio member checked. Locked-approved: editorial sign-off, never re-translated.';


-- ── 2) tenant_dnt_registry ─────────────────────────────────────
-- Per-tenant Do-Not-Translate lexicon. Brand names, material codenames,
-- proper nouns the studio uses. Extends the platform-wide DEFAULT_DNT_TERMS.
CREATE TABLE IF NOT EXISTS tenant_dnt_registry (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    term          text NOT NULL,
    category      text NOT NULL DEFAULT 'protected_term'
                  CHECK (category IN ('brand','material','designer','collection',
                                       'studio','protected_term')),
    active        boolean NOT NULL DEFAULT true,
    metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_dnt_registry_term
    ON tenant_dnt_registry (tenant_id, term);
CREATE INDEX IF NOT EXISTS ix_tenant_dnt_registry_active
    ON tenant_dnt_registry (tenant_id, active);

COMMENT ON TABLE tenant_dnt_registry IS
  'ITER124 · Tenant-scoped DNT lexicon. Merged with the platform-wide DEFAULT_DNT_TERMS at translation time. Categories: brand, material, designer, collection, studio, protected_term.';


-- ── 3) studio_translation_preferences ──────────────────────────
-- Studio Voice Learning™ foundation. Per-tenant editorial overrides
-- so each studio can develop a stable bilingual voice over time.
CREATE TABLE IF NOT EXISTS studio_translation_preferences (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- e.g. 'tone', 'terminology', 'preferred_wording', 'avoid_terms'
    preference_key   text NOT NULL,
    locale_pair      text,  -- e.g. 'it→en-US'; NULL = applies to all pairs
    preference_value jsonb NOT NULL,
    notes            text,
    created_by       uuid REFERENCES users_profile(id) ON DELETE SET NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_studio_translation_preferences_tenant
    ON studio_translation_preferences (tenant_id, preference_key);

COMMENT ON TABLE studio_translation_preferences IS
  'ITER124 · Studio Voice Learning™ foundation. Per-tenant editorial overrides: tone, terminology, preferred wording, avoid terms. Read by the ALE prompt builder at translation time.';


-- ── 4) client_messages.source_locale ───────────────────────────
-- The actual language the message was authored in. Stops ALE
-- from assuming IT for studio replies / EN for client messages.
ALTER TABLE client_messages
    ADD COLUMN IF NOT EXISTS source_locale text;

COMMENT ON COLUMN client_messages.source_locale IS
  'ITER124 · Actual language the message was authored in (IT, EN-US, FR, …). Populated at send time from the sender''s UI locale. NULL on legacy rows.';


-- ── 5) Seed platform defaults into tenant_dnt_registry ─────────
-- We DO NOT seed default terms here — the platform-wide DEFAULT_DNT_TERMS
-- in services/relational_translation.py is already applied implicitly.
-- The registry is for tenant-specific additions only.

COMMIT;
