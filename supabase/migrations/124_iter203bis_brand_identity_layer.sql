-- ITER203-BIS · BRAND IDENTITY LAYER™
-- Persistent identity (not placeholders) on the brands table.
-- Drives the Brand Atlas card visual treatment when no hero image exists.

ALTER TABLE brands
    ADD COLUMN IF NOT EXISTS brand_language TEXT,
    ADD COLUMN IF NOT EXISTS hero_strategy  TEXT;

COMMENT ON COLUMN brands.brand_language IS 'ITER203-BIS · 1-line design language (es. "Quiet luxury seating, sculptural silhouettes")';
COMMENT ON COLUMN brands.hero_strategy  IS 'ITER203-BIS · visual treatment slug used by Brand Atlas card when no hero image (es. iconic_product, quarry_project_texture, flagship_environment, bathroom_environment, editorial_portrait, material_swatch). Chameleon-overridable.';

-- Seed real identities for the 16 curated brands (+ ARBI tenant-private).
-- This is data, not hardcoded UI. Frontend renders by reading these fields.
UPDATE brands SET positioning='Contemporary Bathroom Architecture',
                  hero_strategy='bathroom_environment',
                  brand_language='Architettura del benessere, materiali nobili, dettaglio tecnico italiano'
 WHERE lower(name) IN ('arbi test bathroom','arbi','arbi arredobagno');

UPDATE brands SET positioning='Design della Luce',
                  hero_strategy='iconic_product',
                  brand_language='Luce come scultura, illuminazione architettonica italiana'
 WHERE lower(name) = 'artemide';

UPDATE brands SET positioning='Pietra Naturale Italiana',
                  hero_strategy='quarry_project_texture',
                  brand_language='Marmi e graniti, superfici scolpite, eredità geologica'
 WHERE lower(name) = 'margraf';

UPDATE brands SET positioning='Cucina d''Autore',
                  hero_strategy='flagship_environment',
                  brand_language='Architettura culinaria, lusso silenzioso, modularità italiana'
 WHERE lower(name) = 'boffi';

UPDATE brands SET positioning='Architettura del Salotto',
                  hero_strategy='flagship_environment',
                  brand_language='Sedute sculturali, lusso silenzioso, prodotti icona del Made in Italy'
 WHERE lower(name) = 'b&b italia';

UPDATE brands SET positioning='Patrimonio del Design',
                  hero_strategy='iconic_product',
                  brand_language='Mobili icona, dialogo con il modernismo italiano'
 WHERE lower(name) = 'cassina';

UPDATE brands SET positioning='Living Contemporaneo',
                  hero_strategy='flagship_environment',
                  brand_language='Imbottiti morbidi, italianità sartoriale'
 WHERE lower(name) = 'flexform';

UPDATE brands SET positioning='Scultura Imbottita',
                  hero_strategy='iconic_product',
                  brand_language='Forme audaci, colori vivaci, design provocatorio italiano'
 WHERE lower(name) = 'edra';

UPDATE brands SET positioning='Disegno della Seduta',
                  hero_strategy='iconic_product',
                  brand_language='Sedute icona, eleganza materica, atmosfera ovattata'
 WHERE lower(name) = 'minotti';

UPDATE brands SET positioning='Architettura Domestica',
                  hero_strategy='flagship_environment',
                  brand_language='Sistemi giorno e notte, eredità milanese, modularità integrata'
 WHERE lower(name) IN ('molteni&c','molteni c','molteni');

UPDATE brands SET positioning='Living System',
                  hero_strategy='flagship_environment',
                  brand_language='Pareti attrezzate, modularità invisibile, integrazione architettonica'
 WHERE lower(name) = 'rimadesio';

UPDATE brands SET positioning='Sistemi di Arredo Globali',
                  hero_strategy='flagship_environment',
                  brand_language='Cucine, armadi, living: sistema completo italiano'
 WHERE lower(name) = 'poliform';

UPDATE brands SET positioning='Heritage Imbottito',
                  hero_strategy='iconic_product',
                  brand_language='Sedute storiche di Antonio Citterio, lusso architettonico'
 WHERE lower(name) = 'maxalto';

UPDATE brands SET positioning='Design Contemporaneo',
                  hero_strategy='iconic_product',
                  brand_language='Mobili contemporanei, accessibilità, design italiano essenziale'
 WHERE lower(name) = 'bonaldo';

UPDATE brands SET positioning='Tavoli d''Autore',
                  hero_strategy='iconic_product',
                  brand_language='Tavoli e sedie scultorei, ricerca sul materiale'
 WHERE lower(name) = 'cattelan italia';

UPDATE brands SET positioning='Architectural Lighting',
                  hero_strategy='iconic_product',
                  brand_language='Apparecchi minimalisti, luce diffusa, raffinatezza milanese'
 WHERE lower(name) = 'flos';
