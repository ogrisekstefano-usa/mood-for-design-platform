-- ────────────────────────────────────────────────────────────────────
-- 070_atelier_media_orchestration.sql — Atelier Media Direction™
--
-- ITER138 · MEDIA ORCHESTRATION REFINEMENT™
--
-- Extends atelier_dashboard_media with native upload pipeline fields:
-- • original_asset_url       — full-size uploaded asset (Supabase Storage public URL)
-- • optimized_asset_url      — 1920w optimized variant
-- • thumbnail_asset_url      — 480w thumbnail variant
-- • blurhash                 — compact placeholder (BlurHash 4×3)
-- • storage_bucket           — Supabase bucket (default: tenant-assets)
-- • storage_path             — relative path within bucket
-- • mime_type / file_bytes   — provenance
-- • width_px / height_px     — original dimensions (post-rotation)
-- • crop_profile             — JSONB { x, y, w, h } (0..1 normalized)
-- • grain_level              — 0..1 cinematic grain
-- • vignette_level           — 0..1 vignette darkness
-- • warmth_offset            — -0.5..+0.5 manual warmth
-- • cyan_atmosphere          — 0..1 atelier cyan tint
-- • uploaded_by              — author FK
--
-- The legacy file_url column is preserved for backward compat — new uploads
-- fill it with optimized_asset_url so existing reads keep working.
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE atelier_dashboard_media
  ADD COLUMN IF NOT EXISTS original_asset_url   TEXT,
  ADD COLUMN IF NOT EXISTS optimized_asset_url  TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_asset_url  TEXT,
  ADD COLUMN IF NOT EXISTS blurhash             TEXT,
  ADD COLUMN IF NOT EXISTS storage_bucket       TEXT,
  ADD COLUMN IF NOT EXISTS storage_path         TEXT,
  ADD COLUMN IF NOT EXISTS mime_type            TEXT,
  ADD COLUMN IF NOT EXISTS file_bytes           BIGINT,
  ADD COLUMN IF NOT EXISTS width_px             INTEGER,
  ADD COLUMN IF NOT EXISTS height_px            INTEGER,
  ADD COLUMN IF NOT EXISTS crop_profile         JSONB,
  ADD COLUMN IF NOT EXISTS grain_level          NUMERIC(3,2) DEFAULT 0.00 CHECK (grain_level BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS vignette_level       NUMERIC(3,2) DEFAULT 0.00 CHECK (vignette_level BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS warmth_offset        NUMERIC(3,2) DEFAULT 0.00 CHECK (warmth_offset BETWEEN -0.5 AND 0.5),
  ADD COLUMN IF NOT EXISTS cyan_atmosphere      NUMERIC(3,2) DEFAULT 0.00 CHECK (cyan_atmosphere BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS uploaded_by          UUID REFERENCES users_profile(id);

CREATE INDEX IF NOT EXISTS atelier_media_storage_idx
  ON atelier_dashboard_media (storage_bucket, storage_path);

-- New grading presets vocabulary (kept loose as TEXT for forward compat).
-- Documented values applicable in 'grading_profile':
--   'nordic_silence'        — restraint, slight cool desaturation
--   'midnight_editorial'    — deep blacks, low saturation, cinematic cool
--   'aman_warmth'           — hospitality warmth, soft sepia bias
--   'architectural_dawn'    — early-light clarity, gentle uplift
--   'nordic_cinematic'      — legacy default
--   'warm_hospitality'      — legacy
--   'editorial_neutral'     — legacy
--   'desaturated_film'      — legacy
