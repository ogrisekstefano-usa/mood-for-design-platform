-- ITER148 · Phase 2 · Media System Unificato™ · foundations
-- 
-- Adds three new tables on top of the existing `media_library` archive:
-- 
--   media_asset_variants   · non-destructive crop + filter metadata
--   media_asset_usage      · Used-In™ relational map (asset → where used)
--   media_filter_presets   · runtime-driven filter registry
-- 
-- Hard rule: the underlying file in `media_library` stays IMMUTABLE.
-- All variants are pure metadata pointing back at one master asset.

-- ───────────────────────────────────────────────────────────────────
-- media_filter_presets — DB-driven filter registry
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.media_filter_presets (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid,                              -- NULL = global preset
    preset_key    text NOT NULL,                     -- e.g. editorial_matte
    label         text NOT NULL,
    description   text,
    css_filter    text NOT NULL,                     -- CSS `filter` string
    overlay_color text,                              -- optional overlay
    overlay_alpha numeric DEFAULT 0,                 -- 0..1
    is_active     boolean DEFAULT true,
    display_order int DEFAULT 100,
    created_at    timestamptz DEFAULT now()
);

-- Each global preset_key is unique; tenants may override with their own row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_filter_presets_global_key
    ON public.media_filter_presets(preset_key)
    WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_filter_presets_tenant_key
    ON public.media_filter_presets(tenant_id, preset_key)
    WHERE tenant_id IS NOT NULL;

-- Seed the 8 official atelier filters — these are GLOBAL (tenant_id NULL)
INSERT INTO public.media_filter_presets (preset_key, label, description, css_filter, overlay_color, overlay_alpha, display_order)
VALUES
  ('none',              'Original',           'Untouched master image',                                'none',                                                       NULL,        0,    10),
  ('editorial_matte',   'Editorial Matte',    'Printed-page matte · soft contrast',                    'contrast(0.95) saturate(0.9) brightness(0.98)',              '#0B0F1A',   0.10, 20),
  ('warm_ivory',        'Warm Ivory',         'Hospitality glow · ivory cast',                         'sepia(0.18) brightness(1.04) saturate(0.96)',                '#F2EFE6',   0.06, 30),
  ('cyan_atelier',      'Cyan Atelier',       'Cinematic cool · architectural rigor',                  'saturate(0.85) hue-rotate(-8deg) brightness(0.96)',          '#00C9B3',   0.06, 40),
  ('black_white',       'Black & White',      'Pure monochrome',                                       'grayscale(1) contrast(1.05)',                                NULL,        0,    50),
  ('sepia',             'Sepia',              'Archival warmth · timeless',                            'sepia(0.85) contrast(1.02) brightness(1.02)',                NULL,        0,    60),
  ('desaturated',       'Desaturated',        'Muted palette · editorial restraint',                   'saturate(0.55) contrast(0.98)',                              NULL,        0,    70),
  ('cinematic_shadow',  'Cinematic Shadow',   'Deep blacks · midnight register',                       'contrast(1.10) brightness(0.92) saturate(0.95)',             '#050816',   0.18, 80)
ON CONFLICT DO NOTHING;

-- ───────────────────────────────────────────────────────────────────
-- media_asset_variants — non-destructive crop + filter compositions
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.media_asset_variants (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL,
    asset_id          uuid NOT NULL,                  -- → media_library.id
    variant_key       text NOT NULL,                  -- hero_landscape · editorial_portrait …
    label             text,                           -- optional human label
    -- normalised crop rectangle (0..1 against the master)
    crop_x            numeric DEFAULT 0,
    crop_y            numeric DEFAULT 0,
    crop_width        numeric DEFAULT 1,
    crop_height       numeric DEFAULT 1,
    -- focal point inside the crop (0..1)
    focal_x           numeric DEFAULT 0.5,
    focal_y           numeric DEFAULT 0.5,
    zoom              numeric DEFAULT 1.0,
    filter_preset     text DEFAULT 'none',            -- → media_filter_presets.preset_key
    overlay_strength  numeric DEFAULT 0,              -- 0..1 · multiplies preset overlay_alpha
    aspect_ratio      text,                           -- e.g. '16:9' · derived but cached
    usage_hint        text,                           -- e.g. 'hero · magazine cover'
    created_by        uuid,
    created_at        timestamptz DEFAULT now(),
    updated_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_media_variants_asset ON public.media_asset_variants(asset_id);
CREATE INDEX IF NOT EXISTS ix_media_variants_tenant_key ON public.media_asset_variants(tenant_id, variant_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_variants_asset_key
    ON public.media_asset_variants(asset_id, variant_key);

-- ───────────────────────────────────────────────────────────────────
-- media_asset_usage — Used-In™ relational map
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.media_asset_usage (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL,
    asset_id      uuid NOT NULL,                      -- → media_library.id
    variant_id    uuid,                               -- optional → media_asset_variants.id
    entity_type   text NOT NULL,                      -- homepage · magazine · journey · moodboard · memory · inspiration · onboarding · proposal
    entity_id     uuid,                               -- pointer · nullable for singletons (homepage)
    usage_role    text,                               -- hero · cover · tile · banner · inline
    created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_media_usage_asset ON public.media_asset_usage(asset_id);
CREATE INDEX IF NOT EXISTS ix_media_usage_entity ON public.media_asset_usage(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_media_usage_tenant ON public.media_asset_usage(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_usage_dedupe
    ON public.media_asset_usage(asset_id, entity_type, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(usage_role, ''));

-- ───────────────────────────────────────────────────────────────────
-- READ permissions — open these tables to the service role and
-- authenticated users; cross-tenant isolation is enforced at the
-- application layer (consistent with media_library).
-- ───────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_asset_variants TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_asset_usage    TO authenticated, service_role;
GRANT SELECT                         ON public.media_filter_presets TO authenticated, service_role, anon;
