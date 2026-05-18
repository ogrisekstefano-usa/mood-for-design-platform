-- Phase S-IDENTITY — Step 1B
-- International Presence™ — Positioning Modes + Market Behavior + Spanish split
--
-- Architecture decisions:
--   • Studio-level positioning choices (positioning_mode, business_intent,
--     primary_audience, cultural_editorial_lens) live in
--     tenant_markets.custom_settings (already JSONB). No DDL needed there.
--
--   • Platform catalog gains:
--       markets.market_behavior        (jsonb)  — per-market default Market Behavior™
--       markets.cta_style_default      (text)   — preferred CTA voice for the audience
--       markets.luxury_perception      (text)   — short editorial luxury reading
--
--   • Spanish split: keep the legacy 'spanish_latam' but add two siblings:
--       spain_iberian       (es-ES, Europe)
--       spanish_mexico      (es-MX, Americas)
--
--   • USA structure already supports `usa_national / usa_east_coast /
--     usa_south_florida / usa_west_coast`. Domestic vs international
--     positioning is a STUDIO-level choice stored under custom_settings
--     and is NOT a new market record.
--
--   • Asia (Singapore / Hong Kong / Japan) is intentionally NOT seeded
--     yet per the directive — architecture remains compatible when added.

ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS market_behavior     JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cta_style_default   TEXT,
  ADD COLUMN IF NOT EXISTS luxury_perception   TEXT;

-- ── Italy ─────────────────────────────────────────────────────────────
UPDATE markets SET
  market_behavior = COALESCE(market_behavior, '{}'::jsonb) || jsonb_build_object(
    'decision_speed',         'slow_relational',
    'relationship_weight',    'very_high',
    'specification_depth',    'medium',
    'hospitality_relevance',  'high',
    'emotional_pacing',       'continuous_continuity',
    'material_sensitivity',   'very_high',
    'trust_requirement',      'human_advisor',
    'preferred_cta_style',    'soft_consultation'
  ),
  cta_style_default = COALESCE(cta_style_default, 'Iniziamo il dialogo'),
  luxury_perception = COALESCE(luxury_perception, 'Continuità materica e cultura del fatto.')
WHERE code = 'italy';

-- ── USA (national + regional) ─────────────────────────────────────────
UPDATE markets SET
  market_behavior = COALESCE(market_behavior, '{}'::jsonb) || jsonb_build_object(
    'decision_speed',         'fast_inspiration_loop',
    'relationship_weight',    'medium',
    'specification_depth',    'medium',
    'hospitality_relevance',  'high',
    'emotional_pacing',       'aspirational_lifestyle',
    'material_sensitivity',   'medium_high',
    'trust_requirement',      'process_clarity',
    'preferred_cta_style',    'schedule_consultation'
  ),
  cta_style_default = COALESCE(cta_style_default, 'Schedule a consultation'),
  luxury_perception = COALESCE(luxury_perception, 'Aspirational ownership and curated lifestyle.')
WHERE code IN ('usa_national', 'usa_east_coast', 'usa_south_florida', 'usa_west_coast');

-- ── UK / Ireland ──────────────────────────────────────────────────────
UPDATE markets SET
  market_behavior = COALESCE(market_behavior, '{}'::jsonb) || jsonb_build_object(
    'decision_speed',         'considered',
    'relationship_weight',    'high',
    'specification_depth',    'high',
    'hospitality_relevance',  'medium',
    'emotional_pacing',       'restrained_editorial',
    'material_sensitivity',   'high',
    'trust_requirement',      'editorial_authority',
    'preferred_cta_style',    'request_introduction'
  ),
  cta_style_default = COALESCE(cta_style_default, 'Request an introduction'),
  luxury_perception = COALESCE(luxury_perception, 'Heritage modernism, quiet editorial cadence.')
WHERE code = 'uk_ireland';

-- ── France ────────────────────────────────────────────────────────────
UPDATE markets SET
  market_behavior = COALESCE(market_behavior, '{}'::jsonb) || jsonb_build_object(
    'decision_speed',         'slow_deeper',
    'relationship_weight',    'high',
    'specification_depth',    'high',
    'hospitality_relevance',  'high',
    'emotional_pacing',       'salon_paced',
    'material_sensitivity',   'very_high',
    'trust_requirement',      'cultural_legitimacy',
    'preferred_cta_style',    'discreet_consultation'
  ),
  cta_style_default = COALESCE(cta_style_default, 'Demander un rendez-vous'),
  luxury_perception = COALESCE(luxury_perception, 'Savoir-faire et intimité d''hôtel particulier.')
WHERE code IN ('france_fr_europe', 'france_fr');

-- ── DACH ──────────────────────────────────────────────────────────────
UPDATE markets SET
  market_behavior = COALESCE(market_behavior, '{}'::jsonb) || jsonb_build_object(
    'decision_speed',         'slow_specification_first',
    'relationship_weight',    'medium',
    'specification_depth',    'very_high',
    'hospitality_relevance',  'low_medium',
    'emotional_pacing',       'precision_first',
    'material_sensitivity',   'very_high',
    'trust_requirement',      'technical_honesty',
    'preferred_cta_style',    'request_specification'
  ),
  cta_style_default = COALESCE(cta_style_default, 'Beratungstermin vereinbaren'),
  luxury_perception = COALESCE(luxury_perception, 'Engineered material honesty and architectural precision.')
WHERE code = 'dach';

-- ── GCC ───────────────────────────────────────────────────────────────
UPDATE markets SET
  market_behavior = COALESCE(market_behavior, '{}'::jsonb) || jsonb_build_object(
    'decision_speed',         'measured',
    'relationship_weight',    'very_high',
    'specification_depth',    'medium',
    'hospitality_relevance',  'very_high',
    'emotional_pacing',       'ceremonial_restraint',
    'material_sensitivity',   'high',
    'trust_requirement',      'prestige_reference',
    'preferred_cta_style',    'private_consultation'
  ),
  cta_style_default = COALESCE(cta_style_default, 'Arrange a private consultation'),
  luxury_perception = COALESCE(luxury_perception, 'Ceremonial materiality and private hospitality scale.')
WHERE code = 'gcc_luxury';

-- ── Existing legacy Spanish market (covers LatAm) ─────────────────────
UPDATE markets SET
  market_behavior = COALESCE(market_behavior, '{}'::jsonb) || jsonb_build_object(
    'decision_speed',         'medium_warm',
    'relationship_weight',    'high',
    'specification_depth',    'medium',
    'hospitality_relevance',  'very_high',
    'emotional_pacing',       'social_warmth',
    'material_sensitivity',   'medium',
    'trust_requirement',      'relational_referral',
    'preferred_cta_style',    'invitation_to_dialogue'
  ),
  cta_style_default = COALESCE(cta_style_default, 'Iniciemos la conversación'),
  luxury_perception = COALESCE(luxury_perception, 'Hospitalidad cálida y aspiración mediterránea social.')
WHERE code = 'spanish_latam';

-- ── NEW: Spain / Iberian Europe ───────────────────────────────────────
INSERT INTO markets (
  code, display_name, primary_locale, macro_region,
  editorial_tone, luxury_positioning, hospitality_profile, storefront_behavior,
  cta_style_default, luxury_perception, market_behavior
)
SELECT
  'spain_iberian',
  jsonb_build_object('en-US', 'Spain / Iberian Europe', 'es-ES', 'España / Europa Ibérica', 'it-IT', 'Spagna / Europa Iberica'),
  'es-ES', 'europe',
  'Mediterranean architectural conviviality',
  'Contemporary Iberian Editorial',
  'Convivial Mediterranean welcome',
  'Light-led Iberian editorial cadence',
  'Concertemos una visita',
  'Convivencia mediterránea y honestidad arquitectónica.',
  jsonb_build_object(
    'decision_speed',         'medium',
    'relationship_weight',    'high',
    'specification_depth',    'medium_high',
    'hospitality_relevance',  'high',
    'emotional_pacing',       'mediterranean_editorial',
    'material_sensitivity',   'high',
    'trust_requirement',      'architectural_legitimacy',
    'preferred_cta_style',    'editorial_consultation'
  )
WHERE NOT EXISTS (SELECT 1 FROM markets WHERE code = 'spain_iberian');

-- ── NEW: Spanish Mexico Luxury Residential ────────────────────────────
INSERT INTO markets (
  code, display_name, primary_locale, macro_region,
  editorial_tone, luxury_positioning, hospitality_profile, storefront_behavior,
  cta_style_default, luxury_perception, market_behavior
)
SELECT
  'spanish_mexico',
  jsonb_build_object('en-US', 'Mexico Luxury Residential', 'es-MX', 'México Residencial Luxury', 'it-IT', 'Messico Residenziale Luxury'),
  'es-MX', 'americas',
  'Emotional Mediterranean-Americas crossing',
  'International Residential Aspiration',
  'Family hospitality with international refinement',
  'Cinematic emotional unfolding',
  'Reservemos una consulta privada',
  'Lujo emocional, puente cultural Europa-Américas.',
  jsonb_build_object(
    'decision_speed',         'medium_fast',
    'relationship_weight',    'very_high',
    'specification_depth',    'medium',
    'hospitality_relevance',  'very_high',
    'emotional_pacing',       'family_aspirational',
    'material_sensitivity',   'medium_high',
    'trust_requirement',      'international_references',
    'preferred_cta_style',    'private_advisory'
  )
WHERE NOT EXISTS (SELECT 1 FROM markets WHERE code = 'spanish_mexico');

-- ── Verification index — fast lookup of behavior by market code ───────
CREATE INDEX IF NOT EXISTS idx_markets_behavior_gin ON markets USING GIN (market_behavior);
