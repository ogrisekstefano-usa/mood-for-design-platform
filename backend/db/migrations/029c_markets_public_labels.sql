-- Migration 029c — Markets Public Labels
-- ─────────────────────────────────────────────────────────────────
-- 1) Add `public_enabled` to distinguish internal-only markets from
--    visitor-facing ones.
-- 2) Sanitise display_name JSONB so the visitor never sees codes
--    like 'spanish_latam' or 'usa_national'.

ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS public_enabled BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE markets SET display_name = display_name
  || jsonb_build_object(
       'it-IT', CASE code
         WHEN 'italy'                THEN 'Italia'
         WHEN 'dach'                 THEN 'DACH (Germania, Austria, Svizzera)'
         WHEN 'france_fr_europe'     THEN 'Francia e Europa francofona'
         WHEN 'uk_ireland'           THEN 'Regno Unito e Irlanda'
         WHEN 'spain_iberian'        THEN 'Spagna e Portogallo'
         WHEN 'scandinavia'          THEN 'Scandinavia'
         WHEN 'usa_national'         THEN 'Stati Uniti (Nazionale)'
         WHEN 'usa_east_coast'       THEN 'Stati Uniti · Costa Est'
         WHEN 'usa_south_florida'    THEN 'Stati Uniti · Sud e Florida'
         WHEN 'usa_midwest'          THEN 'Stati Uniti · Midwest'
         WHEN 'usa_mountain_central' THEN 'Stati Uniti · Mountain e Centro'
         WHEN 'usa_west_coast'       THEN 'Stati Uniti · Costa Ovest'
         WHEN 'gcc_luxury'           THEN 'Golfo Persico e Medio Oriente'
         WHEN 'central_america'      THEN 'America Centrale'
         WHEN 'spanish_latam'        THEN 'America Latina'
         WHEN 'brazil'               THEN 'Brasile'
         WHEN 'spanish_mexico'       THEN 'Messico'
         ELSE display_name->>'it-IT'
       END,
       'en-US', CASE code
         WHEN 'italy'                THEN 'Italy'
         WHEN 'dach'                 THEN 'DACH (Germany, Austria, Switzerland)'
         WHEN 'france_fr_europe'     THEN 'France and French-speaking Europe'
         WHEN 'uk_ireland'           THEN 'United Kingdom and Ireland'
         WHEN 'spain_iberian'        THEN 'Spain and Portugal'
         WHEN 'scandinavia'          THEN 'Scandinavia'
         WHEN 'usa_national'         THEN 'United States (National)'
         WHEN 'usa_east_coast'       THEN 'United States · East Coast'
         WHEN 'usa_south_florida'    THEN 'United States · South and Florida'
         WHEN 'usa_midwest'          THEN 'United States · Midwest'
         WHEN 'usa_mountain_central' THEN 'United States · Mountain and Central'
         WHEN 'usa_west_coast'       THEN 'United States · West Coast'
         WHEN 'gcc_luxury'           THEN 'Gulf and Middle East'
         WHEN 'central_america'      THEN 'Central America'
         WHEN 'spanish_latam'        THEN 'Latin America'
         WHEN 'brazil'               THEN 'Brazil'
         WHEN 'spanish_mexico'       THEN 'Mexico'
         ELSE display_name->>'en-US'
       END
     )
WHERE code IN (
  'italy','dach','france_fr_europe','uk_ireland','spain_iberian',
  'scandinavia','usa_national','usa_east_coast','usa_south_florida',
  'usa_midwest','usa_mountain_central','usa_west_coast','gcc_luxury',
  'central_america','spanish_latam','brazil','spanish_mexico'
);

-- Keep internal-only markets out of the public funnel by default.
-- (For now everything stays public; toggle from Command Center later.)
UPDATE markets SET public_enabled = TRUE WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_markets_public
  ON markets(active, public_enabled, sort_order);
