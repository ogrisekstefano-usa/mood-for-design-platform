-- ITER193 · Phase 1 · MOOD Design Knowledge Graph™ Engine
-- ─────────────────────────────────────────────────────────────────────
-- Migration: 118_iter193_design_knowledge_graph.sql
--
-- Adds the semantic layer on top of the Knowledge Factory:
--   • 4 canonical entity tables (spaces, features, styles, markets)
--   • 9 specific M:N relationship tables (hot paths)
--   • 1 generic knowledge_graph_edges table (cold paths, extensibility)
--   • ALTER products: market_relevance JSONB (Market Intelligence Layer)
--
-- All canonical entities are seeded with ~90 baseline rows.
-- markets_canonical is hierarchical (country → city) for future
-- city-level targeting (Chicago, Miami, NYC, Dubai, Milano, London…).
-- ─────────────────────────────────────────────────────────────────────

-- §1 · spaces_canonical ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spaces_canonical (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NULL,
  space_key         TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  category          TEXT,
  description_i18n  JSONB NOT NULL DEFAULT '{}'::jsonb,
  keywords          JSONB NOT NULL DEFAULT '[]'::jsonb,
  parent_space_id   UUID NULL REFERENCES spaces_canonical(id) ON DELETE SET NULL,
  is_global         BOOLEAN NOT NULL DEFAULT TRUE,
  metadata_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, space_key)
);
CREATE INDEX IF NOT EXISTS idx_spaces_key ON spaces_canonical(space_key);

-- §2 · features_canonical ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS features_canonical (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NULL,
  feature_key       TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  category          TEXT,
  description_i18n  JSONB NOT NULL DEFAULT '{}'::jsonb,
  keywords          JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_global         BOOLEAN NOT NULL DEFAULT TRUE,
  metadata_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, feature_key)
);
CREATE INDEX IF NOT EXISTS idx_features_key ON features_canonical(feature_key);

-- §3 · styles_canonical ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS styles_canonical (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NULL,
  style_key         TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  era               TEXT,
  mood_tags         JSONB NOT NULL DEFAULT '[]'::jsonb,
  description_i18n  JSONB NOT NULL DEFAULT '{}'::jsonb,
  keywords          JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_global         BOOLEAN NOT NULL DEFAULT TRUE,
  metadata_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, style_key)
);
CREATE INDEX IF NOT EXISTS idx_styles_key ON styles_canonical(style_key);

-- §4 · markets_canonical (hierarchical: country → region → city) ──────
CREATE TABLE IF NOT EXISTS markets_canonical (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NULL,
  market_key        TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  region            TEXT,                          -- 'NA' | 'EU' | 'APAC' | 'ME'
  segment           TEXT,                          -- 'luxury_residential' | 'hospitality' | …
  geo_level         TEXT NOT NULL DEFAULT 'country',  -- 'global' | 'region' | 'country' | 'city' | 'segment'
  parent_market_id  UUID NULL REFERENCES markets_canonical(id) ON DELETE SET NULL,
  market_size_tier  TEXT,                          -- 'tier1' | 'tier2' | 'tier3'
  description_i18n  JSONB NOT NULL DEFAULT '{}'::jsonb,
  keywords          JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_global         BOOLEAN NOT NULL DEFAULT TRUE,
  metadata_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, market_key)
);
CREATE INDEX IF NOT EXISTS idx_markets_key   ON markets_canonical(market_key);
CREATE INDEX IF NOT EXISTS idx_markets_geo   ON markets_canonical(geo_level);
CREATE INDEX IF NOT EXISTS idx_markets_parent ON markets_canonical(parent_market_id);


-- ─────────────────────────────────────────────────────────────────────
-- §5-13 · RELATIONSHIP TABLES (hot paths) ─────────────────────────────
-- ─────────────────────────────────────────────────────────────────────

-- §5 · product_spaces
CREATE TABLE IF NOT EXISTS product_spaces (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  space_id         UUID NOT NULL REFERENCES spaces_canonical(id) ON DELETE CASCADE,
  source           TEXT NOT NULL DEFAULT 'auto',
  confidence_score NUMERIC(4,3),
  evidence         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, space_id)
);
CREATE INDEX IF NOT EXISTS idx_product_spaces_space ON product_spaces(space_id);

-- §6 · product_features
CREATE TABLE IF NOT EXISTS product_features (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  feature_id       UUID NOT NULL REFERENCES features_canonical(id) ON DELETE CASCADE,
  source           TEXT NOT NULL DEFAULT 'auto',
  confidence_score NUMERIC(4,3),
  evidence         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, feature_id)
);
CREATE INDEX IF NOT EXISTS idx_product_features_feature ON product_features(feature_id);

-- §7 · product_styles
CREATE TABLE IF NOT EXISTS product_styles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  style_id         UUID NOT NULL REFERENCES styles_canonical(id) ON DELETE CASCADE,
  source           TEXT NOT NULL DEFAULT 'auto',
  confidence_score NUMERIC(4,3),
  evidence         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, style_id)
);
CREATE INDEX IF NOT EXISTS idx_product_styles_style ON product_styles(style_id);

-- §8 · product_markets
CREATE TABLE IF NOT EXISTS product_markets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  market_id        UUID NOT NULL REFERENCES markets_canonical(id) ON DELETE CASCADE,
  source           TEXT NOT NULL DEFAULT 'auto',
  relevance_score  NUMERIC(4,3),
  evidence         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, market_id)
);
CREATE INDEX IF NOT EXISTS idx_product_markets_market ON product_markets(market_id);

-- §9 · material_styles
CREATE TABLE IF NOT EXISTS material_styles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id      UUID NOT NULL REFERENCES materials_canonical(id) ON DELETE CASCADE,
  style_id         UUID NOT NULL REFERENCES styles_canonical(id) ON DELETE CASCADE,
  source           TEXT NOT NULL DEFAULT 'auto',
  confidence_score NUMERIC(4,3),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (material_id, style_id)
);

-- §10 · material_spaces
CREATE TABLE IF NOT EXISTS material_spaces (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id      UUID NOT NULL REFERENCES materials_canonical(id) ON DELETE CASCADE,
  space_id         UUID NOT NULL REFERENCES spaces_canonical(id) ON DELETE CASCADE,
  source           TEXT NOT NULL DEFAULT 'auto',
  confidence_score NUMERIC(4,3),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (material_id, space_id)
);

-- §11 · story_markets
CREATE TABLE IF NOT EXISTS story_markets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id         UUID NOT NULL REFERENCES stories_canonical(id) ON DELETE CASCADE,
  market_id        UUID NOT NULL REFERENCES markets_canonical(id) ON DELETE CASCADE,
  source           TEXT NOT NULL DEFAULT 'auto',
  relevance_score  NUMERIC(4,3),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (story_id, market_id)
);

-- §12 · brand_styles
CREATE TABLE IF NOT EXISTS brand_styles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  style_id         UUID NOT NULL REFERENCES styles_canonical(id) ON DELETE CASCADE,
  product_count    INTEGER NOT NULL DEFAULT 0,
  affinity_score   NUMERIC(4,3),
  source           TEXT NOT NULL DEFAULT 'auto',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, style_id)
);

-- §13 · brand_markets
CREATE TABLE IF NOT EXISTS brand_markets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  market_id        UUID NOT NULL REFERENCES markets_canonical(id) ON DELETE CASCADE,
  product_count    INTEGER NOT NULL DEFAULT 0,
  relevance_score  NUMERIC(4,3),
  source           TEXT NOT NULL DEFAULT 'auto',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, market_id)
);


-- ─────────────────────────────────────────────────────────────────────
-- §14 · GENERIC knowledge_graph_edges (cold paths · extensibility) ────
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NULL,
  source_type  TEXT NOT NULL,
  source_id    UUID NOT NULL,
  target_type  TEXT NOT NULL,
  target_id    UUID NOT NULL,
  edge_type    TEXT NOT NULL DEFAULT 'related',
  weight       NUMERIC(4,3),
  evidence     JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_type, source_id, target_type, target_id, edge_type)
);
CREATE INDEX IF NOT EXISTS idx_kge_source ON knowledge_graph_edges(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_kge_target ON knowledge_graph_edges(target_type, target_id);


-- §15 · products.market_relevance ─────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS market_relevance JSONB NOT NULL DEFAULT '{}'::jsonb;
-- {us, eu, apac, me, hospitality, residential, retail}


-- ─────────────────────────────────────────────────────────────────────
-- §16 · SEED VOCABULARY  (~90 entries, all is_global=TRUE) ────────────
-- ─────────────────────────────────────────────────────────────────────

-- SPACES (20)
INSERT INTO spaces_canonical (space_key, display_name, category, keywords) VALUES
  ('living_room',   'Living Room',     'residential',
    '["living room","salotto","soggiorno","lounge area","sitting room","living area"]'::jsonb),
  ('dining_room',   'Dining Room',     'residential',
    '["dining room","sala da pranzo","pranzo","dining area","mesa","dining","tavola"]'::jsonb),
  ('kitchen',       'Kitchen',         'residential',
    '["kitchen","cucina","kitchen island","cocina","cuisine"]'::jsonb),
  ('bathroom',      'Bathroom',        'residential',
    '["bathroom","bagno","bath","powder room","toilet"]'::jsonb),
  ('bedroom',       'Bedroom',         'residential',
    '["bedroom","camera da letto","camera","letto","chamber"]'::jsonb),
  ('master_bedroom','Master Bedroom',  'residential',
    '["master bedroom","master suite","camera padronale","suite"]'::jsonb),
  ('outdoor',       'Outdoor',         'residential',
    '["outdoor","esterni","garden","giardino","patio","terrace","terrazza","exterior"]'::jsonb),
  ('hospitality',   'Hospitality',     'commercial',
    '["hospitality","hotel","albergo","resort","spa","contract hospitality"]'::jsonb),
  ('lobby',         'Lobby',           'commercial',
    '["lobby","reception","entrance hall","atrio"]'::jsonb),
  ('lounge',        'Lounge',          'mixed',
    '["lounge","relax area","lounge bar","waiting"]'::jsonb),
  ('restaurant',    'Restaurant',      'commercial',
    '["restaurant","ristorante","dining hall","fine dining","bistro"]'::jsonb),
  ('spa',           'Spa & Wellness',  'commercial',
    '["spa","wellness","massage","sauna","hammam"]'::jsonb),
  ('retail',        'Retail',          'commercial',
    '["retail","boutique","showroom","store","shop"]'::jsonb),
  ('workplace',     'Workplace',       'commercial',
    '["workplace","office","uffici","co-working","meeting room","corporate"]'::jsonb),
  ('residential',   'Residential',     'residential',
    '["residential","home","casa","domestic","private"]'::jsonb),
  ('luxury_residential','Luxury Residential','residential',
    '["luxury residential","villa","penthouse","mansion","luxury home"]'::jsonb),
  ('contract',      'Contract',        'commercial',
    '["contract","commercial","public"]'::jsonb),
  ('wellness',      'Wellness',        'commercial',
    '["wellness","fitness","gym","yoga","meditation"]'::jsonb),
  ('private_dining','Private Dining',  'commercial',
    '["private dining","private room","chef table"]'::jsonb),
  ('terrace',       'Terrace',         'residential',
    '["terrace","terrazzo","balcony","balcone","roof terrace"]'::jsonb)
ON CONFLICT (tenant_id, space_key) DO NOTHING;

-- FEATURES (30)
INSERT INTO features_canonical (feature_key, display_name, category, keywords) VALUES
  ('relax',           'Relax',           'functional',
    '["relax","comfort","comfortable","lounging","reclining"]'::jsonb),
  ('modular',         'Modular',         'functional',
    '["modular","modulare","modulable","sectional","componibile","componible"]'::jsonb),
  ('storage',         'Storage',         'functional',
    '["storage","contenitore","contenitivo","drawer","cassetto","shelf","ripostiglio"]'::jsonb),
  ('wireless_charging','Wireless Charging','technical',
    '["wireless charging","qi charge","induction charge","ricarica wireless"]'::jsonb),
  ('acoustic',        'Acoustic',        'technical',
    '["acoustic","acustico","sound absorbing","insonorizzante","phonic"]'::jsonb),
  ('dimmable',        'Dimmable',        'technical',
    '["dimmable","dimmerabile","dimming","intensity adjustable"]'::jsonb),
  ('integrated_lighting','Integrated Lighting','technical',
    '["integrated lighting","illuminazione integrata","built-in light","light feature"]'::jsonb),
  ('outdoor_rated',   'Outdoor Rated',   'technical',
    '["outdoor rated","weather resistant","resistente intemperie","all-weather","uv resistant"]'::jsonb),
  ('sustainable',     'Sustainable',     'sustainability',
    '["sustainable","sostenibile","fsc","responsibly sourced","eco-friendly","ecocompatibile"]'::jsonb),
  ('reclaimed_material','Reclaimed Material','sustainability',
    '["reclaimed","recuperat","riciclat","recycled","upcycled","salvage"]'::jsonb),
  ('fire_resistant',  'Fire Resistant',  'technical',
    '["fire resistant","fire retardant","ignifugo","resistente al fuoco","class 1"]'::jsonb),
  ('water_resistant', 'Water Resistant', 'technical',
    '["water resistant","waterproof","impermeabile","resistente acqua"]'::jsonb),
  ('customizable',    'Customizable',    'functional',
    '["customizable","bespoke","personalizzato","made to measure","su misura","tailored"]'::jsonb),
  ('foldable',        'Foldable',        'functional',
    '["foldable","pieghevole","folding","collapsible","ripiegabile"]'::jsonb),
  ('motorized',       'Motorized',       'technical',
    '["motorized","motorizzato","electric","elettrico","powered","reclining motor"]'::jsonb),
  ('easy_clean',      'Easy Clean',      'functional',
    '["easy clean","easy to clean","facile pulizia","stain resistant","antimacchia"]'::jsonb),
  ('hypoallergenic',  'Hypoallergenic',  'functional',
    '["hypoallergenic","anallergico","allergy friendly","anti-allergy"]'::jsonb),
  ('handcrafted',     'Handcrafted',     'sustainability',
    '["handcrafted","handmade","fatto a mano","artigianale","manualità"]'::jsonb),
  ('ergonomic',       'Ergonomic',       'functional',
    '["ergonomic","ergonomico","posture support","supporto lombare"]'::jsonb),
  ('compact',         'Compact',         'functional',
    '["compact","compatto","space saving","salva spazio","small footprint"]'::jsonb),
  ('extendable',      'Extendable',      'functional',
    '["extendable","estensibile","extending","allungabile","expandable"]'::jsonb),
  ('stackable',       'Stackable',       'functional',
    '["stackable","impilabile","stack","accatastabile"]'::jsonb),
  ('rotating',        'Rotating',        'functional',
    '["rotating","girevole","swivel","ruotabile","turning"]'::jsonb),
  ('integrated_tech', 'Integrated Tech', 'technical',
    '["integrated tech","smart","domotica","connected","iot","app control"]'::jsonb),
  ('multifunctional', 'Multifunctional', 'functional',
    '["multifunctional","multifunzionale","multi-purpose","convertibile","convertible"]'::jsonb),
  ('cordless',        'Cordless',        'technical',
    '["cordless","wireless","senza fili","battery powered"]'::jsonb),
  ('led',             'LED',             'technical',
    '["led","light emitting diode","led source","sorgente led"]'::jsonb),
  ('removable_cover', 'Removable Cover', 'functional',
    '["removable cover","sfoderabile","washable cover","fodera sfoderabile"]'::jsonb),
  ('artisanal',       'Artisanal',       'sustainability',
    '["artisanal","artigianale","master craftsman","savoir-faire","traditional method"]'::jsonb),
  ('biophilic',       'Biophilic',       'sustainability',
    '["biophilic","natural","nature-inspired","biofilico","living wall","greenery"]'::jsonb)
ON CONFLICT (tenant_id, feature_key) DO NOTHING;

-- STYLES (15)
INSERT INTO styles_canonical (style_key, display_name, era, mood_tags, keywords) VALUES
  ('contemporary',   'Contemporary',   'contemporary',
    '["modern","current","fresh"]'::jsonb,
    '["contemporary","contemporaneo","modern","current","today"]'::jsonb),
  ('minimal',        'Minimal',        'contemporary',
    '["essential","clean","pure"]'::jsonb,
    '["minimal","minimalist","minimalista","essential","essenziale","pure lines"]'::jsonb),
  ('organic',        'Organic',        'contemporary',
    '["natural","warm","soft"]'::jsonb,
    '["organic","organico","natural","naturale","soft shapes","forme morbide"]'::jsonb),
  ('scandinavian',   'Scandinavian',   'modern',
    '["light","airy","functional"]'::jsonb,
    '["scandinavian","scandinavo","nordic","scandinave","danish design"]'::jsonb),
  ('industrial',     'Industrial',     'modern',
    '["raw","metal","factory"]'::jsonb,
    '["industrial","industriale","loft","raw","steel","metal","exposed"]'::jsonb),
  ('luxury',         'Luxury',         'contemporary',
    '["opulent","refined","exclusive"]'::jsonb,
    '["luxury","lusso","luxe","premium","high-end","exclusive","esclusivo"]'::jsonb),
  ('mediterranean',  'Mediterranean',  'classic',
    '["warm","earthy","sun-drenched"]'::jsonb,
    '["mediterranean","mediterraneo","tuscan","provençal","greek","aegean"]'::jsonb),
  ('architectural',  'Architectural',  'contemporary',
    '["sculptural","monolithic","statement"]'::jsonb,
    '["architectural","architettonico","sculptural","monolithic","monolitico"]'::jsonb),
  ('timeless',       'Timeless',       'classic',
    '["enduring","iconic","heritage"]'::jsonb,
    '["timeless","senza tempo","iconic","classic","intramontabile"]'::jsonb),
  ('mid_century',    'Mid-Century',    'modern',
    '["retro","wood","tapered legs"]'::jsonb,
    '["mid century","mid-century","modernismo","scandinavian modern","retro"]'::jsonb),
  ('brutalist',      'Brutalist',      'modern',
    '["concrete","massive","raw"]'::jsonb,
    '["brutalist","brutalismo","raw concrete","cement","beton brut"]'::jsonb),
  ('italian_modern', 'Italian Modern', 'modern',
    '["refined","craftsmanship","made in italy"]'::jsonb,
    '["italian modern","made in italy","italian design","design italiano","milano design"]'::jsonb),
  ('japandi',        'Japandi',        'contemporary',
    '["zen","calm","craft"]'::jsonb,
    '["japandi","japan scandi","zen","wabi-sabi","minimal japanese"]'::jsonb),
  ('art_deco',       'Art Deco',       'classic',
    '["gold","geometric","glamorous"]'::jsonb,
    '["art deco","art déco","1920s","gatsby","decorative geometric"]'::jsonb),
  ('biomorphic',     'Biomorphic',     'contemporary',
    '["curved","sculptural","fluid"]'::jsonb,
    '["biomorphic","sculptural curves","fluid shapes","forme fluide","amorphous"]'::jsonb)
ON CONFLICT (tenant_id, style_key) DO NOTHING;

-- MARKETS · 11 country-level + 8 city-level + 6 segmented combos = 25
-- ── countries (NA / EU / APAC / ME) ──
INSERT INTO markets_canonical (market_key, display_name, region, geo_level, segment, market_size_tier, keywords) VALUES
  ('usa',     'United States',  'NA',   'country', 'mixed',  'tier1',
    '["usa","united states","america","stati uniti","us market"]'::jsonb),
  ('canada',  'Canada',         'NA',   'country', 'mixed',  'tier2',
    '["canada","canadian"]'::jsonb),
  ('italy',   'Italy',          'EU',   'country', 'mixed',  'tier1',
    '["italy","italia","italian market","made in italy"]'::jsonb),
  ('germany', 'Germany',        'EU',   'country', 'mixed',  'tier1',
    '["germany","germania","deutschland","german market"]'::jsonb),
  ('uk',      'United Kingdom', 'EU',   'country', 'mixed',  'tier1',
    '["uk","united kingdom","britain","london market","british"]'::jsonb),
  ('france',  'France',         'EU',   'country', 'mixed',  'tier1',
    '["france","francia","french market"]'::jsonb),
  ('spain',   'Spain',          'EU',   'country', 'mixed',  'tier2',
    '["spain","spagna","spanish market"]'::jsonb),
  ('uae',     'United Arab Emirates','ME','country','luxury_residential','tier1',
    '["uae","united arab emirates","emirati","dubai market","abu dhabi"]'::jsonb),
  ('saudi',   'Saudi Arabia',   'ME',   'country', 'luxury_residential','tier1',
    '["saudi arabia","arabia saudita","riyadh"]'::jsonb),
  ('japan',   'Japan',          'APAC', 'country', 'mixed',  'tier1',
    '["japan","giappone","tokyo market","japanese"]'::jsonb),
  ('china',   'China',          'APAC', 'country', 'mixed',  'tier1',
    '["china","cina","shanghai","beijing","mainland china"]'::jsonb)
ON CONFLICT (tenant_id, market_key) DO NOTHING;

-- ── cities (Phase 1 baseline; admin-extensible) ──
INSERT INTO markets_canonical (market_key, display_name, region, geo_level, segment, market_size_tier, keywords) VALUES
  ('city_new_york', 'New York',  'NA',   'city',    'luxury_residential', 'tier1',
    '["new york","nyc","manhattan","brooklyn"]'::jsonb),
  ('city_miami',    'Miami',     'NA',   'city',    'luxury_residential', 'tier1',
    '["miami","miami beach","south beach","florida"]'::jsonb),
  ('city_chicago',  'Chicago',   'NA',   'city',    'mixed',              'tier2',
    '["chicago","chi-town"]'::jsonb),
  ('city_los_angeles','Los Angeles','NA','city',    'luxury_residential', 'tier1',
    '["los angeles","la","beverly hills","hollywood"]'::jsonb),
  ('city_milano',   'Milano',    'EU',   'city',    'design_hub',         'tier1',
    '["milano","milan","brera","fuorisalone","salone del mobile"]'::jsonb),
  ('city_london',   'London',    'EU',   'city',    'luxury_residential', 'tier1',
    '["london","londra","mayfair","chelsea","kensington"]'::jsonb),
  ('city_paris',    'Paris',     'EU',   'city',    'luxury_residential', 'tier1',
    '["paris","parigi","saint-germain"]'::jsonb),
  ('city_dubai',    'Dubai',     'ME',   'city',    'luxury_residential', 'tier1',
    '["dubai","palm jumeirah","downtown dubai","emirates"]'::jsonb)
ON CONFLICT (tenant_id, market_key) DO NOTHING;

-- ── segmented combos (cross-segment markets) ──
INSERT INTO markets_canonical (market_key, display_name, region, geo_level, segment, market_size_tier, keywords) VALUES
  ('hospitality_usa',          'Hospitality USA',          'NA',   'segment', 'hospitality',        'tier1',
    '["hospitality usa","us hotel","us resort","american hospitality"]'::jsonb),
  ('luxury_residential_usa',   'Luxury Residential USA',   'NA',   'segment', 'luxury_residential', 'tier1',
    '["luxury residential usa","high-end american","us luxury home"]'::jsonb),
  ('contract_europe',          'Contract Europe',          'EU',   'segment', 'contract',           'tier1',
    '["contract europe","european contract","commercial europe"]'::jsonb),
  ('hospitality_apac',         'Hospitality APAC',         'APAC', 'segment', 'hospitality',        'tier1',
    '["hospitality apac","asian hotel","apac resort"]'::jsonb),
  ('retail_europe',            'Retail Europe',            'EU',   'segment', 'retail',             'tier1',
    '["retail europe","european retail","boutique europe"]'::jsonb),
  ('hospitality_me',           'Hospitality Middle East',  'ME',   'segment', 'hospitality',        'tier1',
    '["hospitality middle east","dubai hotel","luxury me hospitality"]'::jsonb)
ON CONFLICT (tenant_id, market_key) DO NOTHING;


-- §17 · GRANT service_role ────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT ALL ON spaces_canonical,features_canonical,styles_canonical,markets_canonical,'
         || 'product_spaces,product_features,product_styles,product_markets,'
         || 'material_styles,material_spaces,story_markets,brand_styles,brand_markets,'
         || 'knowledge_graph_edges TO service_role';
  END IF;
END $$;


-- §18 · feature flag ──────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'settings'
  ) THEN
    UPDATE tenants
       SET settings = COALESCE(settings, '{}'::jsonb)
                      || '{"design_knowledge_graph_v1": true}'::jsonb,
           updated_at = NOW()
     WHERE COALESCE(settings, '{}'::jsonb) ? 'design_knowledge_graph_v1' = false;
  END IF;
END $$;


COMMENT ON TABLE spaces_canonical IS    'ITER193 · Spaces vocabulary (Living Room, Hospitality, Outdoor…). Admin-extensible.';
COMMENT ON TABLE features_canonical IS  'ITER193 · Features vocabulary (Modular, Acoustic, Sustainable…). Admin-extensible.';
COMMENT ON TABLE styles_canonical IS    'ITER193 · Styles vocabulary (Contemporary, Minimal, Italian Modern…). Admin-extensible.';
COMMENT ON TABLE markets_canonical IS   'ITER193 · Markets vocabulary (countries + cities + segments). Hierarchical via parent_market_id.';
COMMENT ON TABLE knowledge_graph_edges IS 'ITER193 · Generic graph edges for non-hot-path relationships.';

-- ── End of 118_iter193_design_knowledge_graph.sql ────────────────────
