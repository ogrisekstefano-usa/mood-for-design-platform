-- 045_image_filters.sql
-- Lightweight image refinement filters on media_library assets.
--
-- Stores: { brightness, contrast, saturation, rotate } as a simple JSON object.
-- focal_point already exists as a separate JSONB column (021_media_library_v2).
--
-- Rendering: applied via CSS `filter:` string at render time on storefront,
-- Blueprint previews, Projects, Magazine, Moodboards, Media Library.
--
-- Idempotent — IF NOT EXISTS.

ALTER TABLE media_library
  ADD COLUMN IF NOT EXISTS filters JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN media_library.filters IS
  'Lightweight image refinement: { brightness, contrast, saturation, rotate }. Applied via CSS filter at render time.';
