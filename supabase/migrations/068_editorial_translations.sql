-- ITER132 · Editorial Runtime Translation Layer™ · Translation Memory
-- backing table.
--
-- Stores ALE-translated DB content (inspirations, moodboards, cultural
-- editions, brand atlas, presence-stream entries…). Keyed by a content
-- hash that includes the source/target locale + cultural directive
-- version so the same source can carry multiple cached translations
-- (e.g. "cinematic" vs "restrained" tone variants in the future).
--
-- The table is tenant-scoped but readable to the service layer; routers
-- never touch it directly.

CREATE TABLE IF NOT EXISTS public.editorial_translations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    content_hash        text NOT NULL,
    source_locale       text NOT NULL DEFAULT 'it',
    target_locale       text NOT NULL,
    source_text         text NOT NULL,
    translated_text     text NOT NULL,
    -- Editorial governance
    review_status       text NOT NULL DEFAULT 'ai_suggested'
                          CHECK (review_status IN ('ai_suggested', 'reviewed', 'locked_approved', 'rejected')),
    locked              boolean NOT NULL DEFAULT false,
    reviewed_by         uuid,
    reviewed_at         timestamptz,
    -- Lineage
    model               text,
    directive_version   text NOT NULL DEFAULT 'iter132.v1',
    source_field        text,            -- e.g. "inspiration.title", "cultural_edition.summary"
    ai_generated        boolean NOT NULL DEFAULT true,
    manual_refined      boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (content_hash)
);

CREATE INDEX IF NOT EXISTS idx_edt_tenant_locale
  ON public.editorial_translations (tenant_id, target_locale);
CREATE INDEX IF NOT EXISTS idx_edt_review_status
  ON public.editorial_translations (review_status);
CREATE INDEX IF NOT EXISTS idx_edt_locked
  ON public.editorial_translations (locked) WHERE locked = true;

COMMENT ON TABLE public.editorial_translations IS
  'ITER132 · ALE-on-read translation memory for DB-seeded / AI-generated editorial content. Keyed by content_hash = sha1(source_locale|target_locale|directive_version|normalised_text).';
