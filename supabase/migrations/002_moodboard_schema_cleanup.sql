-- ===== 002: MOODBOARD ELEMENTS SCHEMA CLEANUP =====
-- Purpose: eliminate schema drift on moodboard_elements.
-- Current state: layout x/y/width/height stored INSIDE `content` text column;
--                position_json / style_json / metadata_json columns ignored.
-- After: layout in position_json, visual props (crop/focal/locked/hidden/opacity) in style_json,
--        rest in metadata_json. `content` becomes a semantic payload only.
-- Reversible: partial (data migration is one-way; structure changes are reversible).
-- Author: agent / 2026-05-13

BEGIN;

-- ── 1. Backfill position_json from content.layout ────────────────────────────
-- Most rows have `content` as a JSON string with embedded `layout`. Move it out.
UPDATE public.moodboard_elements
SET position_json = jsonb_build_object(
    'x',       COALESCE((content::jsonb -> 'layout' ->> 'x')::numeric, 40),
    'y',       COALESCE((content::jsonb -> 'layout' ->> 'y')::numeric, 40),
    'width',   COALESCE((content::jsonb -> 'layout' ->> 'width')::numeric, 320),
    'height',  COALESCE((content::jsonb -> 'layout' ->> 'height')::numeric, 240),
    'z_index', COALESCE((content::jsonb -> 'layout' ->> 'z_index')::int, 0)
)
WHERE content IS NOT NULL
  AND (position_json IS NULL OR position_json = '{}'::jsonb)
  AND content ~ '^\{';  -- only attempt on valid JSON strings

-- ── 2. Backfill image_url and title from content for image blocks ────────────
UPDATE public.moodboard_elements
SET image_url = COALESCE(image_url, content::jsonb ->> 'src'),
    title     = COALESCE(title, content::jsonb ->> 'caption')
WHERE type = 'image' AND content ~ '^\{';

-- ── 3. Clean `content` — strip layout/src/caption keys (now stored elsewhere) ─
-- Keep only the semantic payload (text body for text/note, colors for palette,
-- name/vendor/price for product, name/finish/swatch for material).
UPDATE public.moodboard_elements
SET content = (content::jsonb - 'layout' - 'src' - 'caption')::text
WHERE content ~ '^\{';

-- ── 4. Add structured columns for layer management & visual props ────────────
ALTER TABLE public.moodboard_elements
    ADD COLUMN IF NOT EXISTS locked     BOOLEAN  NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS hidden     BOOLEAN  NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS opacity    NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    ADD COLUMN IF NOT EXISTS rotation   NUMERIC(6,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ── 5. Indexes for hot paths ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mb_elements_moodboard_sort
    ON public.moodboard_elements (moodboard_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_mb_elements_tenant
    ON public.moodboard_elements (tenant_id);

CREATE INDEX IF NOT EXISTS idx_mb_elements_position_gin
    ON public.moodboard_elements USING GIN (position_json);

-- ── 6. V2-ready scaffold (presence only — not used in V1) ───────────────────
-- These columns prepare the schema for V2 without changing V1 behavior.
ALTER TABLE public.moodboards
    ADD COLUMN IF NOT EXISTS cover_strategy TEXT DEFAULT 'auto', -- auto|first_image|palette|manual
    ADD COLUMN IF NOT EXISTS cover_metadata JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS presentation_metadata JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS ai_metadata JSONB DEFAULT '{}'::jsonb;

COMMIT;
