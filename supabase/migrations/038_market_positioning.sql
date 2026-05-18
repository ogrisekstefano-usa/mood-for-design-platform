-- Phase S-IDENTITY — Step 1
-- International Presence™ — market positioning attributes
--
-- Add editorial-grade positioning fields to the `markets` catalog. These
-- are PLATFORM defaults; tenants override via `tenant_markets.custom_settings`.
-- The four canonical fields per the directive:
--   • editorial_tone       — voice / cadence of the editorial register
--   • luxury_positioning   — material-culture posture of the market
--   • hospitality_profile  — emotional welcome model
--   • storefront_behavior  — how the storefront should orchestrate itself
--
-- We keep the existing `tone_of_voice`, `cultural_profile`, `cta_style`
-- columns as legacy fields (used by the editorial composer) untouched.
ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS editorial_tone      TEXT,
  ADD COLUMN IF NOT EXISTS luxury_positioning  TEXT,
  ADD COLUMN IF NOT EXISTS hospitality_profile TEXT,
  ADD COLUMN IF NOT EXISTS storefront_behavior TEXT;

-- Seed editorial positioning for the canonical markets the platform ships
-- with. Tenants can override via custom_settings without touching the
-- platform catalog.
UPDATE markets SET
  editorial_tone      = COALESCE(editorial_tone,      'Progettuale · cultura del fatto'),
  luxury_positioning  = COALESCE(luxury_positioning,  'Restrained Material Culture'),
  hospitality_profile = COALESCE(hospitality_profile, 'Continuità artigianale'),
  storefront_behavior = COALESCE(storefront_behavior, 'Slow editorial unfolding')
WHERE code = 'italy';

UPDATE markets SET
  editorial_tone      = COALESCE(editorial_tone,      'Aspirational interior direction'),
  luxury_positioning  = COALESCE(luxury_positioning,  'Emotional Ownership'),
  hospitality_profile = COALESCE(hospitality_profile, 'International advisory'),
  storefront_behavior = COALESCE(storefront_behavior, 'Cinematic narrative pacing')
WHERE code = 'usa_national';

UPDATE markets SET
  editorial_tone      = COALESCE(editorial_tone,      'Quiet British editorial'),
  luxury_positioning  = COALESCE(luxury_positioning,  'Heritage Modernism'),
  hospitality_profile = COALESCE(hospitality_profile, 'Discrete advisory'),
  storefront_behavior = COALESCE(storefront_behavior, 'Restrained editorial cadence')
WHERE code = 'uk_ireland';

UPDATE markets SET
  editorial_tone      = COALESCE(editorial_tone,      'French savoir-faire'),
  luxury_positioning  = COALESCE(luxury_positioning,  'Couture Material Direction'),
  hospitality_profile = COALESCE(hospitality_profile, 'Hôtel particulier intimacy'),
  storefront_behavior = COALESCE(storefront_behavior, 'Salon-paced unveiling')
WHERE code IN ('france_fr_europe', 'france_fr');

UPDATE markets SET
  editorial_tone      = COALESCE(editorial_tone,      'Mediterranean editorial warmth'),
  luxury_positioning  = COALESCE(luxury_positioning,  'Sun-drenched material restraint'),
  hospitality_profile = COALESCE(hospitality_profile, 'Slow Mediterranean welcome'),
  storefront_behavior = COALESCE(storefront_behavior, 'Light-led narrative')
WHERE code = 'spanish_latam';

UPDATE markets SET
  editorial_tone      = COALESCE(editorial_tone,      'Ingenieurskultur · Werkbund precision'),
  luxury_positioning  = COALESCE(luxury_positioning,  'Engineered Material Honesty'),
  hospitality_profile = COALESCE(hospitality_profile, 'Precise advisory'),
  storefront_behavior = COALESCE(storefront_behavior, 'Structural editorial pacing')
WHERE code = 'dach';

UPDATE markets SET
  editorial_tone      = COALESCE(editorial_tone,      'Ceremonial editorial register'),
  luxury_positioning  = COALESCE(luxury_positioning,  'Ceremonial Materiality'),
  hospitality_profile = COALESCE(hospitality_profile, 'Private hospitality atmospheres'),
  storefront_behavior = COALESCE(storefront_behavior, 'Prestige restraint unveiling')
WHERE code = 'gcc_luxury';
