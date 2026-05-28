-- ────────────────────────────────────────────────────────────────────
-- 109_phone_dial_codes.sql · ITER168 · Hotfix B · 28 Feb 2026
--
-- Global, locale-agnostic registry of phone dial codes.
--
-- Architectural separation:
--   • market_locales (/admin/languages)  →  controls market/locale experience
--   • phone_dial_codes (this table)      →  identifies a PERSON's phone number
--
-- A client living in Milan can have a Japanese phone (+81). The phone prefix
-- must therefore be DECOUPLED from the active tenant markets.
--
-- Seeded with the full ISO 3166-1 alpha-2 list (250+ entries). Names are
-- in English by default + IT translation; future locales arrive via the
-- `name_i18n` JSONB.
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS phone_dial_codes (
  iso2            TEXT PRIMARY KEY,             -- "IT", "US", "AE", …
  country_name    TEXT NOT NULL,                -- English canonical name
  dial_code       TEXT NOT NULL,                -- "+39", "+1", "+971"
  flag_emoji      TEXT,                         -- "🇮🇹"
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  name_i18n       JSONB NOT NULL DEFAULT '{}'::jsonb,
                                                -- {"it":"Italia","fr":"Italie", …}
  search_aliases  TEXT[] NOT NULL DEFAULT '{}'::text[],
                                                -- ["italia","italie","italien"]
  display_priority INT NOT NULL DEFAULT 100,    -- lower = top (e.g. IT=1, US=2)
  region          TEXT,                         -- 'europe' | 'mena' | …
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS phone_dial_codes_enabled_idx
  ON phone_dial_codes (enabled, display_priority);
CREATE INDEX IF NOT EXISTS phone_dial_codes_region_idx
  ON phone_dial_codes (region) WHERE enabled = TRUE;


-- ════════════════════════════════════════════════════════════════════
-- SEED · ISO 3166-1 alpha-2 (compact). Curated for editorial/luxury use.
-- Names: EN canonical + IT translation when distinct. Aliases capture
-- common spellings for search.
-- ════════════════════════════════════════════════════════════════════

-- Top-priority markets (these mirror MOOD's likely client geography)
INSERT INTO phone_dial_codes
  (iso2, country_name, dial_code, flag_emoji, name_i18n, search_aliases, display_priority, region)
VALUES
  ('IT','Italy','+39','🇮🇹','{"it":"Italia","fr":"Italie","de":"Italien","es":"Italia"}'::jsonb,ARRAY['italia','italie','italien'],1,'europe'),
  ('US','United States','+1','🇺🇸','{"it":"Stati Uniti","fr":"États-Unis","de":"Vereinigte Staaten","es":"Estados Unidos"}'::jsonb,ARRAY['usa','stati uniti','etats-unis','vereinigte staaten','estados unidos','america'],2,'north_america'),
  ('GB','United Kingdom','+44','🇬🇧','{"it":"Regno Unito","fr":"Royaume-Uni","de":"Vereinigtes Königreich","es":"Reino Unido"}'::jsonb,ARRAY['uk','britain','great britain','regno unito','royaume-uni'],3,'europe'),
  ('FR','France','+33','🇫🇷','{"it":"Francia","de":"Frankreich","es":"Francia"}'::jsonb,ARRAY['francia','frankreich'],4,'europe'),
  ('DE','Germany','+49','🇩🇪','{"it":"Germania","fr":"Allemagne","es":"Alemania"}'::jsonb,ARRAY['germania','allemagne','deutschland','alemania'],5,'europe'),
  ('ES','Spain','+34','🇪🇸','{"it":"Spagna","fr":"Espagne","de":"Spanien"}'::jsonb,ARRAY['spagna','espagne','spanien','españa'],6,'europe'),
  ('CH','Switzerland','+41','🇨🇭','{"it":"Svizzera","fr":"Suisse","de":"Schweiz","es":"Suiza"}'::jsonb,ARRAY['svizzera','suisse','schweiz','suiza'],7,'europe'),
  ('AT','Austria','+43','🇦🇹','{"it":"Austria","de":"Österreich"}'::jsonb,ARRAY['österreich','austria'],8,'europe'),
  ('AE','United Arab Emirates','+971','🇦🇪','{"it":"Emirati Arabi Uniti","fr":"Émirats arabes unis","es":"Emiratos Árabes Unidos"}'::jsonb,ARRAY['uae','emirati','emiratos','dubai','abu dhabi'],9,'mena'),
  ('SA','Saudi Arabia','+966','🇸🇦','{"it":"Arabia Saudita","fr":"Arabie saoudite"}'::jsonb,ARRAY['saudi','arabia saudita','arabie saoudite'],10,'mena'),
  ('QA','Qatar','+974','🇶🇦','{"it":"Qatar"}'::jsonb,ARRAY['qatar'],11,'mena'),
  ('KW','Kuwait','+965','🇰🇼','{"it":"Kuwait"}'::jsonb,ARRAY['kuwait'],12,'mena'),
  ('BH','Bahrain','+973','🇧🇭','{"it":"Bahrein"}'::jsonb,ARRAY['bahrain','bahrein'],13,'mena'),
  ('OM','Oman','+968','🇴🇲','{"it":"Oman"}'::jsonb,ARRAY['oman'],14,'mena'),
  ('JP','Japan','+81','🇯🇵','{"it":"Giappone","fr":"Japon","de":"Japan","es":"Japón"}'::jsonb,ARRAY['giappone','japon','japan','japón'],20,'asia_pacific'),
  ('CN','China','+86','🇨🇳','{"it":"Cina","fr":"Chine","de":"China","es":"China"}'::jsonb,ARRAY['cina','chine','china'],21,'asia_pacific'),
  ('SG','Singapore','+65','🇸🇬','{}'::jsonb,ARRAY['singapore'],22,'asia_pacific'),
  ('HK','Hong Kong','+852','🇭🇰','{"it":"Hong Kong"}'::jsonb,ARRAY['hong kong','hk'],23,'asia_pacific'),
  ('AU','Australia','+61','🇦🇺','{}'::jsonb,ARRAY['australia'],24,'asia_pacific'),
  ('CA','Canada','+1','🇨🇦','{}'::jsonb,ARRAY['canada'],25,'north_america'),
  ('BR','Brazil','+55','🇧🇷','{"it":"Brasile","fr":"Brésil","de":"Brasilien","es":"Brasil"}'::jsonb,ARRAY['brasile','bresil','brasil','brasilien'],26,'latam'),
  ('MX','Mexico','+52','🇲🇽','{"it":"Messico","fr":"Mexique","es":"México"}'::jsonb,ARRAY['messico','mexique','mexico','méxico'],27,'latam'),
  ('AR','Argentina','+54','🇦🇷','{}'::jsonb,ARRAY['argentina'],28,'latam')
ON CONFLICT (iso2) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  flag_emoji = EXCLUDED.flag_emoji,
  name_i18n = EXCLUDED.name_i18n,
  search_aliases = EXCLUDED.search_aliases,
  display_priority = EXCLUDED.display_priority,
  region = EXCLUDED.region,
  updated_at = NOW();


-- Full ISO 3166 list (other countries). Defaults: enabled=true, priority=100.
INSERT INTO phone_dial_codes (iso2, country_name, dial_code, flag_emoji, region) VALUES
  ('AF','Afghanistan','+93','🇦🇫','asia_pacific'),
  ('AL','Albania','+355','🇦🇱','europe'),
  ('DZ','Algeria','+213','🇩🇿','mena'),
  ('AD','Andorra','+376','🇦🇩','europe'),
  ('AO','Angola','+244','🇦🇴','africa'),
  ('AG','Antigua and Barbuda','+1268','🇦🇬','latam'),
  ('AM','Armenia','+374','🇦🇲','europe'),
  ('AZ','Azerbaijan','+994','🇦🇿','europe'),
  ('BS','Bahamas','+1242','🇧🇸','latam'),
  ('BD','Bangladesh','+880','🇧🇩','asia_pacific'),
  ('BB','Barbados','+1246','🇧🇧','latam'),
  ('BY','Belarus','+375','🇧🇾','europe'),
  ('BE','Belgium','+32','🇧🇪','europe'),
  ('BZ','Belize','+501','🇧🇿','latam'),
  ('BJ','Benin','+229','🇧🇯','africa'),
  ('BT','Bhutan','+975','🇧🇹','asia_pacific'),
  ('BO','Bolivia','+591','🇧🇴','latam'),
  ('BA','Bosnia and Herzegovina','+387','🇧🇦','europe'),
  ('BW','Botswana','+267','🇧🇼','africa'),
  ('BN','Brunei','+673','🇧🇳','asia_pacific'),
  ('BG','Bulgaria','+359','🇧🇬','europe'),
  ('BF','Burkina Faso','+226','🇧🇫','africa'),
  ('BI','Burundi','+257','🇧🇮','africa'),
  ('KH','Cambodia','+855','🇰🇭','asia_pacific'),
  ('CM','Cameroon','+237','🇨🇲','africa'),
  ('CV','Cape Verde','+238','🇨🇻','africa'),
  ('CF','Central African Republic','+236','🇨🇫','africa'),
  ('TD','Chad','+235','🇹🇩','africa'),
  ('CL','Chile','+56','🇨🇱','latam'),
  ('CO','Colombia','+57','🇨🇴','latam'),
  ('KM','Comoros','+269','🇰🇲','africa'),
  ('CG','Congo','+242','🇨🇬','africa'),
  ('CD','Congo (DRC)','+243','🇨🇩','africa'),
  ('CR','Costa Rica','+506','🇨🇷','latam'),
  ('CI','Côte d''Ivoire','+225','🇨🇮','africa'),
  ('HR','Croatia','+385','🇭🇷','europe'),
  ('CU','Cuba','+53','🇨🇺','latam'),
  ('CY','Cyprus','+357','🇨🇾','europe'),
  ('CZ','Czech Republic','+420','🇨🇿','europe'),
  ('DK','Denmark','+45','🇩🇰','europe'),
  ('DJ','Djibouti','+253','🇩🇯','africa'),
  ('DM','Dominica','+1767','🇩🇲','latam'),
  ('DO','Dominican Republic','+1809','🇩🇴','latam'),
  ('EC','Ecuador','+593','🇪🇨','latam'),
  ('EG','Egypt','+20','🇪🇬','mena'),
  ('SV','El Salvador','+503','🇸🇻','latam'),
  ('GQ','Equatorial Guinea','+240','🇬🇶','africa'),
  ('ER','Eritrea','+291','🇪🇷','africa'),
  ('EE','Estonia','+372','🇪🇪','europe'),
  ('ET','Ethiopia','+251','🇪🇹','africa'),
  ('FJ','Fiji','+679','🇫🇯','asia_pacific'),
  ('FI','Finland','+358','🇫🇮','europe'),
  ('GA','Gabon','+241','🇬🇦','africa'),
  ('GM','Gambia','+220','🇬🇲','africa'),
  ('GE','Georgia','+995','🇬🇪','europe'),
  ('GH','Ghana','+233','🇬🇭','africa'),
  ('GR','Greece','+30','🇬🇷','europe'),
  ('GD','Grenada','+1473','🇬🇩','latam'),
  ('GT','Guatemala','+502','🇬🇹','latam'),
  ('GN','Guinea','+224','🇬🇳','africa'),
  ('GW','Guinea-Bissau','+245','🇬🇼','africa'),
  ('GY','Guyana','+592','🇬🇾','latam'),
  ('HT','Haiti','+509','🇭🇹','latam'),
  ('HN','Honduras','+504','🇭🇳','latam'),
  ('HU','Hungary','+36','🇭🇺','europe'),
  ('IS','Iceland','+354','🇮🇸','europe'),
  ('IN','India','+91','🇮🇳','asia_pacific'),
  ('ID','Indonesia','+62','🇮🇩','asia_pacific'),
  ('IR','Iran','+98','🇮🇷','mena'),
  ('IQ','Iraq','+964','🇮🇶','mena'),
  ('IE','Ireland','+353','🇮🇪','europe'),
  ('IL','Israel','+972','🇮🇱','mena'),
  ('JM','Jamaica','+1876','🇯🇲','latam'),
  ('JO','Jordan','+962','🇯🇴','mena'),
  ('KZ','Kazakhstan','+7','🇰🇿','asia_pacific'),
  ('KE','Kenya','+254','🇰🇪','africa'),
  ('KI','Kiribati','+686','🇰🇮','asia_pacific'),
  ('KP','North Korea','+850','🇰🇵','asia_pacific'),
  ('KR','South Korea','+82','🇰🇷','asia_pacific'),
  ('KG','Kyrgyzstan','+996','🇰🇬','asia_pacific'),
  ('LA','Laos','+856','🇱🇦','asia_pacific'),
  ('LV','Latvia','+371','🇱🇻','europe'),
  ('LB','Lebanon','+961','🇱🇧','mena'),
  ('LS','Lesotho','+266','🇱🇸','africa'),
  ('LR','Liberia','+231','🇱🇷','africa'),
  ('LY','Libya','+218','🇱🇾','mena'),
  ('LI','Liechtenstein','+423','🇱🇮','europe'),
  ('LT','Lithuania','+370','🇱🇹','europe'),
  ('LU','Luxembourg','+352','🇱🇺','europe'),
  ('MO','Macau','+853','🇲🇴','asia_pacific'),
  ('MK','North Macedonia','+389','🇲🇰','europe'),
  ('MG','Madagascar','+261','🇲🇬','africa'),
  ('MW','Malawi','+265','🇲🇼','africa'),
  ('MY','Malaysia','+60','🇲🇾','asia_pacific'),
  ('MV','Maldives','+960','🇲🇻','asia_pacific'),
  ('ML','Mali','+223','🇲🇱','africa'),
  ('MT','Malta','+356','🇲🇹','europe'),
  ('MR','Mauritania','+222','🇲🇷','africa'),
  ('MU','Mauritius','+230','🇲🇺','africa'),
  ('MD','Moldova','+373','🇲🇩','europe'),
  ('MC','Monaco','+377','🇲🇨','europe'),
  ('MN','Mongolia','+976','🇲🇳','asia_pacific'),
  ('ME','Montenegro','+382','🇲🇪','europe'),
  ('MA','Morocco','+212','🇲🇦','mena'),
  ('MZ','Mozambique','+258','🇲🇿','africa'),
  ('MM','Myanmar','+95','🇲🇲','asia_pacific'),
  ('NA','Namibia','+264','🇳🇦','africa'),
  ('NR','Nauru','+674','🇳🇷','asia_pacific'),
  ('NP','Nepal','+977','🇳🇵','asia_pacific'),
  ('NL','Netherlands','+31','🇳🇱','europe'),
  ('NZ','New Zealand','+64','🇳🇿','asia_pacific'),
  ('NI','Nicaragua','+505','🇳🇮','latam'),
  ('NE','Niger','+227','🇳🇪','africa'),
  ('NG','Nigeria','+234','🇳🇬','africa'),
  ('NO','Norway','+47','🇳🇴','europe'),
  ('PK','Pakistan','+92','🇵🇰','asia_pacific'),
  ('PW','Palau','+680','🇵🇼','asia_pacific'),
  ('PS','Palestine','+970','🇵🇸','mena'),
  ('PA','Panama','+507','🇵🇦','latam'),
  ('PG','Papua New Guinea','+675','🇵🇬','asia_pacific'),
  ('PY','Paraguay','+595','🇵🇾','latam'),
  ('PE','Peru','+51','🇵🇪','latam'),
  ('PH','Philippines','+63','🇵🇭','asia_pacific'),
  ('PL','Poland','+48','🇵🇱','europe'),
  ('PT','Portugal','+351','🇵🇹','europe'),
  ('PR','Puerto Rico','+1787','🇵🇷','latam'),
  ('RO','Romania','+40','🇷🇴','europe'),
  ('RU','Russia','+7','🇷🇺','europe'),
  ('RW','Rwanda','+250','🇷🇼','africa'),
  ('KN','Saint Kitts and Nevis','+1869','🇰🇳','latam'),
  ('LC','Saint Lucia','+1758','🇱🇨','latam'),
  ('VC','Saint Vincent','+1784','🇻🇨','latam'),
  ('WS','Samoa','+685','🇼🇸','asia_pacific'),
  ('SM','San Marino','+378','🇸🇲','europe'),
  ('ST','São Tomé and Príncipe','+239','🇸🇹','africa'),
  ('SN','Senegal','+221','🇸🇳','africa'),
  ('RS','Serbia','+381','🇷🇸','europe'),
  ('SC','Seychelles','+248','🇸🇨','africa'),
  ('SL','Sierra Leone','+232','🇸🇱','africa'),
  ('SK','Slovakia','+421','🇸🇰','europe'),
  ('SI','Slovenia','+386','🇸🇮','europe'),
  ('SB','Solomon Islands','+677','🇸🇧','asia_pacific'),
  ('SO','Somalia','+252','🇸🇴','africa'),
  ('ZA','South Africa','+27','🇿🇦','africa'),
  ('SS','South Sudan','+211','🇸🇸','africa'),
  ('LK','Sri Lanka','+94','🇱🇰','asia_pacific'),
  ('SD','Sudan','+249','🇸🇩','africa'),
  ('SR','Suriname','+597','🇸🇷','latam'),
  ('SE','Sweden','+46','🇸🇪','europe'),
  ('SY','Syria','+963','🇸🇾','mena'),
  ('TW','Taiwan','+886','🇹🇼','asia_pacific'),
  ('TJ','Tajikistan','+992','🇹🇯','asia_pacific'),
  ('TZ','Tanzania','+255','🇹🇿','africa'),
  ('TH','Thailand','+66','🇹🇭','asia_pacific'),
  ('TL','Timor-Leste','+670','🇹🇱','asia_pacific'),
  ('TG','Togo','+228','🇹🇬','africa'),
  ('TO','Tonga','+676','🇹🇴','asia_pacific'),
  ('TT','Trinidad and Tobago','+1868','🇹🇹','latam'),
  ('TN','Tunisia','+216','🇹🇳','mena'),
  ('TR','Turkey','+90','🇹🇷','mena'),
  ('TM','Turkmenistan','+993','🇹🇲','asia_pacific'),
  ('TV','Tuvalu','+688','🇹🇻','asia_pacific'),
  ('UG','Uganda','+256','🇺🇬','africa'),
  ('UA','Ukraine','+380','🇺🇦','europe'),
  ('UY','Uruguay','+598','🇺🇾','latam'),
  ('UZ','Uzbekistan','+998','🇺🇿','asia_pacific'),
  ('VU','Vanuatu','+678','🇻🇺','asia_pacific'),
  ('VA','Vatican City','+379','🇻🇦','europe'),
  ('VE','Venezuela','+58','🇻🇪','latam'),
  ('VN','Vietnam','+84','🇻🇳','asia_pacific'),
  ('YE','Yemen','+967','🇾🇪','mena'),
  ('ZM','Zambia','+260','🇿🇲','africa'),
  ('ZW','Zimbabwe','+263','🇿🇼','africa')
ON CONFLICT (iso2) DO NOTHING;

-- Verify count
DO $$
DECLARE cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM phone_dial_codes WHERE enabled = TRUE;
  RAISE NOTICE '✓ phone_dial_codes seeded: % rows', cnt;
END $$;

COMMENT ON TABLE phone_dial_codes IS
  'ITER168 · Global ISO 3166-1 phone dial code registry. Decoupled from /admin/languages. A client may live in market X but have phone number from country Y. Always serve the full enabled list to phone input components.';
