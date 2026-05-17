"""Phase R-MARKET-1A — Seed the platform-level Markets catalog.

  cd /app/backend && python3 scripts/seed_markets.py

Idempotent: upserts by `code`. 13 markets covering MOOD's initial luxury
distribution footprint. Each market is NOT a language — it bundles a
locale + cultural profile + tone of voice + CTA style + currency + units
+ SEO intent + sub-regions, so the storefront can produce
*market-adapted content*, not mere translations.

Demo tenant auto-attaches Italy as default + the 5 European + USA
National + GCC + UK markets via `tenant_markets`. Other markets stay
inactive for the demo so the team can showcase the activation flow.
"""
import sys, uuid
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')
from database import db


def _iso(): return datetime.now(timezone.utc).isoformat()


# 13 markets. Each is locale+culture+intent — NOT a synonym for language.
MARKETS = [
    {
        'code': 'italy',
        'display_name': {
            'it-IT': 'Italia', 'en-US': 'Italy', 'en-GB': 'Italy',
            'es-ES': 'Italia', 'fr-FR': 'Italie', 'de-DE': 'Italien',
        },
        'macro_region': 'europe',
        'countries': ['IT', 'SM', 'VA'],
        'primary_locale': 'it-IT',
        'fallback_locale': 'en-GB',
        'currency': 'EUR',
        'measurement_system': 'metric',
        'cultural_profile': {
            'design_culture': 'editorial craftsmanship · materia · sprezzatura',
            'aesthetic_pillars': ['warm minimalism', 'contemporary italian', 'quiet luxury'],
            'editorial_register': 'serif-led, intimate, made-to-measure narrative',
        },
        'tone_of_voice': {
            'register': 'editorial-intimate',
            'pronoun': 'tu (warm) / Lei (formal-luxury)',
            'cadence': 'slow · italic asides · craft anecdotes',
        },
        'cta_style': {
            'shape': 'rectangular-pill, gold-on-onyx',
            'verbs': ['Scopri', 'Richiedi', 'Prenota una visita', 'Inizia il tuo progetto'],
        },
        'seo_intent': {
            'keywords_primary': ['interior design Italia', 'arredo su misura', 'progetti residenziali Italia'],
            'hreflang': 'it-IT',
        },
        'sub_regions': [],
        'sort_order': 10,
    },
    {
        'code': 'dach',
        'display_name': {
            'it-IT': 'DACH', 'en-US': 'DACH', 'en-GB': 'DACH',
            'es-ES': 'DACH', 'fr-FR': 'DACH', 'de-DE': 'DACH',
        },
        'macro_region': 'europe',
        'countries': ['DE', 'AT', 'CH', 'LI'],
        'primary_locale': 'de-DE',
        'fallback_locale': 'en-US',
        'currency': 'EUR',
        'measurement_system': 'metric',
        'cultural_profile': {
            'design_culture': 'precision · understated luxury · Bauhaus heritage',
            'aesthetic_pillars': ['soft brutalism', 'quiet luxury', 'organic modern'],
            'editorial_register': 'precise, evidence-led, restrained',
        },
        'tone_of_voice': {'register': 'professional-restrained', 'pronoun': 'Sie', 'cadence': 'measured · technical clarity'},
        'cta_style': {'shape': 'rectangular, monochrome', 'verbs': ['Entdecken', 'Anfragen', 'Termin vereinbaren']},
        'seo_intent': {'keywords_primary': ['Innenarchitektur Luxus', 'Interior Design München Wien Zürich'], 'hreflang': 'de-DE'},
        'sub_regions': [],
        'sort_order': 20,
    },
    {
        'code': 'france_fr_europe',
        'display_name': {
            'it-IT': 'Francia · Europa francofona', 'en-US': 'France / French-speaking Europe',
            'en-GB': 'France / French-speaking Europe', 'es-ES': 'Francia / Europa francófona',
            'fr-FR': 'France / Europe francophone', 'de-DE': 'Frankreich / Frankophones Europa',
        },
        'macro_region': 'europe',
        'countries': ['FR', 'BE', 'LU', 'MC'],
        'primary_locale': 'fr-FR',
        'fallback_locale': 'en-GB',
        'currency': 'EUR',
        'measurement_system': 'metric',
        'cultural_profile': {
            'design_culture': 'savoir-faire · raffinement · atelier tradition',
            'aesthetic_pillars': ['classic contemporary', 'quiet luxury', 'mediterranean'],
            'editorial_register': 'savoir-faire prose · understated codes of luxury',
        },
        'tone_of_voice': {'register': 'sophisticated-confidential', 'pronoun': 'vous', 'cadence': 'literary'},
        'cta_style': {'shape': 'thin-pill, ink-on-cream', 'verbs': ['Découvrir', 'Demander', 'Prendre rendez-vous']},
        'seo_intent': {'keywords_primary': ['architecte intérieur luxe Paris', 'décoration sur-mesure'], 'hreflang': 'fr-FR'},
        'sub_regions': [],
        'sort_order': 30,
    },
    {
        'code': 'uk_ireland',
        'display_name': {
            'it-IT': 'Regno Unito & Irlanda', 'en-US': 'UK & Ireland', 'en-GB': 'UK & Ireland',
            'es-ES': 'Reino Unido e Irlanda', 'fr-FR': 'Royaume-Uni & Irlande', 'de-DE': 'UK & Irland',
        },
        'macro_region': 'europe',
        'countries': ['GB', 'IE', 'IM', 'JE', 'GG'],
        'primary_locale': 'en-GB',
        'fallback_locale': 'en-US',
        'currency': 'GBP',
        'measurement_system': 'imperial',
        'cultural_profile': {
            'design_culture': 'heritage · craftsmanship · British eclecticism',
            'aesthetic_pillars': ['classic contemporary', 'quiet luxury'],
            'editorial_register': 'understated, dry-wit, broadsheet voice',
        },
        'tone_of_voice': {'register': 'editorial-broadsheet', 'pronoun': 'you', 'cadence': 'measured, dry'},
        'cta_style': {'shape': 'rectangular, ink-on-stone', 'verbs': ['Discover', 'Enquire', 'Book a viewing']},
        'seo_intent': {'keywords_primary': ['luxury interior designer London', 'bespoke interiors UK'], 'hreflang': 'en-GB'},
        'sub_regions': [],
        'sort_order': 40,
    },
    {
        'code': 'usa_national',
        'display_name': {
            'it-IT': 'USA Nazionale', 'en-US': 'USA National', 'en-GB': 'USA (Nationwide)',
            'es-ES': 'EE. UU. Nacional', 'fr-FR': 'États-Unis (national)', 'de-DE': 'USA National',
        },
        'macro_region': 'north_america',
        'countries': ['US'],
        'primary_locale': 'en-US',
        'fallback_locale': 'en-GB',
        'currency': 'USD',
        'measurement_system': 'imperial',
        'cultural_profile': {
            'design_culture': 'aspirational luxury · curated minimalism · regional diversity',
            'aesthetic_pillars': ['quiet luxury', 'organic modern', 'soft brutalism'],
            'editorial_register': 'confident, magazine-led, aspirational',
        },
        'tone_of_voice': {'register': 'aspirational-direct', 'pronoun': 'you', 'cadence': 'energetic, declarative'},
        'cta_style': {'shape': 'pill, gold', 'verbs': ['Discover', 'Inquire', 'Schedule a consultation', 'Start your project']},
        'seo_intent': {'keywords_primary': ['luxury interior design USA', 'high-end interior designer'], 'hreflang': 'en-US'},
        # Future regional segmentation seeded as DATA (not active routing).
        'sub_regions': [
            {
                'code': 'miami_south_florida', 'parent_market': 'usa_national',
                'display_name': {'en-US': 'Miami / South Florida', 'en-GB': 'Miami / South Florida'},
                'states': ['FL'], 'cities_anchor': ['Miami', 'Palm Beach', 'Naples', 'Fort Lauderdale'],
                'cultural_profile': 'Latin-American luxury · tropical modernism · waterfront resort living',
                'aesthetic_pillars': ['mediterranean', 'organic modern', 'quiet luxury'],
            },
            {
                'code': 'new_york_tri_state', 'parent_market': 'usa_national',
                'display_name': {'en-US': 'New York / Tri-State', 'en-GB': 'New York / Tri-State'},
                'states': ['NY', 'NJ', 'CT'], 'cities_anchor': ['Manhattan', 'Brooklyn', 'Greenwich', 'Hamptons'],
                'cultural_profile': 'editorial sophistication · prewar grandeur · cosmopolitan',
                'aesthetic_pillars': ['classic contemporary', 'quiet luxury'],
            },
            {
                'code': 'los_angeles_california', 'parent_market': 'usa_national',
                'display_name': {'en-US': 'Los Angeles / California', 'en-GB': 'Los Angeles / California'},
                'states': ['CA'], 'cities_anchor': ['Beverly Hills', 'Malibu', 'Bel Air', 'Montecito'],
                'cultural_profile': 'indoor-outdoor living · canyon modernism · California cool',
                'aesthetic_pillars': ['organic modern', 'mediterranean', 'warm minimalism'],
            },
            {
                'code': 'chicago_midwest', 'parent_market': 'usa_national',
                'display_name': {'en-US': 'Chicago / Midwest', 'en-GB': 'Chicago / Midwest'},
                'states': ['IL', 'WI', 'MI', 'MN'], 'cities_anchor': ['Chicago', 'Lake Forest', 'Wayzata'],
                'cultural_profile': 'Prairie-school heritage · understated luxury · architectural rigour',
                'aesthetic_pillars': ['classic contemporary', 'soft brutalism'],
            },
            {
                'code': 'texas', 'parent_market': 'usa_national',
                'display_name': {'en-US': 'Texas', 'en-GB': 'Texas'},
                'states': ['TX'], 'cities_anchor': ['Dallas', 'Houston', 'Austin'],
                'cultural_profile': 'ranch-luxury · oil-money classicism · open-plan grandeur',
                'aesthetic_pillars': ['classic contemporary', 'organic modern'],
            },
            {
                'code': 'aspen_mountain_luxury', 'parent_market': 'usa_national',
                'display_name': {'en-US': 'Aspen / Mountain Luxury', 'en-GB': 'Aspen / Mountain Luxury'},
                'states': ['CO', 'UT', 'WY', 'MT'], 'cities_anchor': ['Aspen', 'Vail', 'Park City', 'Jackson Hole'],
                'cultural_profile': 'alpine modernism · seasonal retreat · stone-and-timber luxury',
                'aesthetic_pillars': ['warm minimalism', 'soft brutalism', 'organic modern'],
            },
        ],
        'sort_order': 50,
    },
    {
        'code': 'usa_east_coast',
        'display_name': {'en-US': 'USA East Coast', 'en-GB': 'USA East Coast', 'it-IT': 'USA Costa Est'},
        'macro_region': 'north_america', 'countries': ['US'],
        'primary_locale': 'en-US', 'fallback_locale': 'en-GB',
        'currency': 'USD', 'measurement_system': 'imperial',
        'cultural_profile': {'design_culture': 'editorial sophistication · prewar grandeur', 'aesthetic_pillars': ['classic contemporary', 'quiet luxury']},
        'tone_of_voice': {'register': 'editorial-broadsheet', 'pronoun': 'you'},
        'cta_style': {'shape': 'pill, ink', 'verbs': ['Discover', 'Inquire']},
        'seo_intent': {'keywords_primary': ['interior designer NYC', 'Hamptons interiors'], 'hreflang': 'en-US'},
        'sub_regions': [],
        'sort_order': 60,
    },
    {
        'code': 'usa_south_florida',
        'display_name': {'en-US': 'USA South / Florida', 'en-GB': 'USA South / Florida', 'it-IT': 'USA Sud / Florida'},
        'macro_region': 'north_america', 'countries': ['US'],
        'primary_locale': 'en-US', 'fallback_locale': 'en-GB',
        'currency': 'USD', 'measurement_system': 'imperial',
        'cultural_profile': {'design_culture': 'tropical modernism · resort living · Latin-American luxury', 'aesthetic_pillars': ['mediterranean', 'organic modern']},
        'tone_of_voice': {'register': 'aspirational-warm'},
        'cta_style': {'shape': 'pill, gold', 'verbs': ['Discover', 'Inquire', 'Schedule a visit']},
        'seo_intent': {'keywords_primary': ['Miami luxury interior design', 'Palm Beach interior designer'], 'hreflang': 'en-US'},
        'sub_regions': [],
        'sort_order': 70,
    },
    {
        'code': 'usa_west_coast',
        'display_name': {'en-US': 'USA West Coast', 'en-GB': 'USA West Coast', 'it-IT': 'USA Costa Ovest'},
        'macro_region': 'north_america', 'countries': ['US'],
        'primary_locale': 'en-US', 'fallback_locale': 'en-GB',
        'currency': 'USD', 'measurement_system': 'imperial',
        'cultural_profile': {'design_culture': 'indoor-outdoor · canyon modernism · California cool', 'aesthetic_pillars': ['organic modern', 'warm minimalism']},
        'tone_of_voice': {'register': 'editorial-warm'},
        'cta_style': {'shape': 'pill, sage', 'verbs': ['Discover', 'Inquire']},
        'seo_intent': {'keywords_primary': ['Los Angeles interior designer luxury', 'San Francisco bespoke interiors'], 'hreflang': 'en-US'},
        'sub_regions': [],
        'sort_order': 80,
    },
    {
        'code': 'gcc_luxury',
        'display_name': {
            'it-IT': 'GCC · Mercato Luxury', 'en-US': 'GCC Luxury Market', 'en-GB': 'GCC Luxury Market',
            'es-ES': 'Mercado Lujo GCC', 'fr-FR': 'Marché de Luxe CCG', 'de-DE': 'GCC Luxusmarkt',
        },
        'macro_region': 'mena',
        'countries': ['AE', 'SA', 'QA', 'KW', 'BH', 'OM'],
        # Future architecture: ar-AE will join when AI translator is ready.
        'primary_locale': 'en-AE',
        'fallback_locale': 'en-GB',
        'currency': 'AED',
        'measurement_system': 'metric',
        'cultural_profile': {
            'design_culture': 'majlis tradition · gold ornament · contemporary maximalism',
            'aesthetic_pillars': ['classic contemporary', 'quiet luxury', 'sculptural'],
            'editorial_register': 'reverent, ceremonial, hospitality-first',
        },
        'tone_of_voice': {'register': 'reverent-hospitable', 'pronoun': 'you (formal)', 'cadence': 'ceremonial'},
        'cta_style': {'shape': 'gold-pill, serif label', 'verbs': ['Discover', 'Request', 'Arrange a visit']},
        'seo_intent': {'keywords_primary': ['luxury interior designer Dubai', 'Abu Dhabi villa interiors', 'majlis design'], 'hreflang': 'en-AE'},
        'sub_regions': [],
        'sort_order': 90,
    },
    {
        'code': 'central_america',
        'display_name': {
            'it-IT': 'America Centrale', 'en-US': 'Central America', 'en-GB': 'Central America',
            'es-ES': 'Centroamérica', 'fr-FR': 'Amérique centrale', 'de-DE': 'Mittelamerika',
        },
        'macro_region': 'latam',
        'countries': ['MX', 'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA'],
        # FUTURE: es-MX once translator is enabled. For now es-ES with cultural tone-of-voice override.
        'primary_locale': 'es-ES',
        'fallback_locale': 'en-US',
        'currency': 'USD',
        'measurement_system': 'metric',
        'cultural_profile': {
            'design_culture': 'colonial-tropical · talavera · indoor-outdoor patios',
            'aesthetic_pillars': ['mediterranean', 'organic modern', 'warm minimalism'],
        },
        'tone_of_voice': {'register': 'warm-aspirational', 'pronoun': 'usted'},
        'cta_style': {'shape': 'pill, terracotta', 'verbs': ['Descubrir', 'Solicitar', 'Reservar una visita']},
        'seo_intent': {'keywords_primary': ['diseño de interiores lujo México', 'arquitectura residencial Centroamérica'], 'hreflang': 'es-419'},
        # Future locale variants ready (es-MX, es-CR) — wire in Phase 1B.
        'sub_regions': [],
        'sort_order': 100,
    },
    {
        'code': 'spanish_latam',
        'display_name': {
            'it-IT': 'America Latina spagnola', 'en-US': 'Spanish-speaking LatAm', 'en-GB': 'Spanish-speaking LatAm',
            'es-ES': 'Latinoamérica hispanohablante', 'fr-FR': 'Amérique latine hispanophone', 'de-DE': 'Spanisches Lateinamerika',
        },
        'macro_region': 'latam',
        'countries': ['AR', 'CL', 'CO', 'PE', 'EC', 'UY', 'PY', 'BO', 'VE', 'DO', 'CU', 'PR'],
        # FUTURE: es-MX/es-CO/es-AR variants planned.
        'primary_locale': 'es-ES',
        'fallback_locale': 'en-US',
        'currency': 'USD',
        'measurement_system': 'metric',
        'cultural_profile': {
            'design_culture': 'modernist heritage (Niemeyer · Barragán) · botanical luxury',
            'aesthetic_pillars': ['organic modern', 'soft brutalism', 'mediterranean'],
        },
        'tone_of_voice': {'register': 'literary-warm', 'pronoun': 'usted / vos (regional)'},
        'cta_style': {'shape': 'pill, ink', 'verbs': ['Descubrir', 'Consultar', 'Solicitar cita']},
        'seo_intent': {'keywords_primary': ['arquitectura interior lujo Buenos Aires', 'diseño residencial Bogotá'], 'hreflang': 'es-419'},
        'sub_regions': [],
        'sort_order': 110,
    },
    {
        'code': 'brazil',
        'display_name': {
            'it-IT': 'Brasile', 'en-US': 'Brazil', 'en-GB': 'Brazil',
            'es-ES': 'Brasil', 'fr-FR': 'Brésil', 'de-DE': 'Brasilien',
        },
        'macro_region': 'latam',
        'countries': ['BR'],
        # FUTURE: pt-BR once translator is enabled.
        'primary_locale': 'en-US',
        'fallback_locale': 'es-ES',
        'currency': 'BRL',
        'measurement_system': 'metric',
        'cultural_profile': {
            'design_culture': 'tropical modernism · Niemeyer-school · botanical sensuality',
            'aesthetic_pillars': ['organic modern', 'soft brutalism'],
        },
        'tone_of_voice': {'register': 'lyrical-warm'},
        'cta_style': {'shape': 'pill, sage', 'verbs': ['Descobrir', 'Solicitar', 'Agendar visita']},
        'seo_intent': {'keywords_primary': ['design de interiores luxo São Paulo', 'arquitetura residencial Rio'], 'hreflang': 'pt-BR'},
        'sub_regions': [],
        'sort_order': 120,
    },
    {
        'code': 'scandinavia',
        'display_name': {
            'it-IT': 'Scandinavia', 'en-US': 'Scandinavia', 'en-GB': 'Scandinavia',
            'es-ES': 'Escandinavia', 'fr-FR': 'Scandinavie', 'de-DE': 'Skandinavien',
        },
        'macro_region': 'europe',
        'countries': ['SE', 'NO', 'DK', 'FI', 'IS'],
        # English-first as agreed (en-GB fallback). Native Nordic locales in future phase.
        'primary_locale': 'en-GB',
        'fallback_locale': 'en-US',
        'currency': 'EUR',
        'measurement_system': 'metric',
        'cultural_profile': {
            'design_culture': 'hygge · craft-led minimalism · light-honesty',
            'aesthetic_pillars': ['warm minimalism', 'japandi', 'quiet luxury'],
            'editorial_register': 'plain-spoken, restrained, light-first',
        },
        'tone_of_voice': {'register': 'plain-spoken-restrained', 'pronoun': 'you'},
        'cta_style': {'shape': 'rectangular, ink-on-cream', 'verbs': ['Discover', 'Enquire']},
        'seo_intent': {'keywords_primary': ['Scandinavian interior design', 'Nordic minimalism residential'], 'hreflang': 'en-GB'},
        'sub_regions': [],
        'sort_order': 130,
    },
]


# Demo tenant attaches these markets out-of-the-box. Italy = default.
DEMO_TENANT_MARKETS = [
    ('italy',             True,  True),   # default
    ('dach',              True,  False),
    ('france_fr_europe',  True,  False),
    ('uk_ireland',        True,  False),
    ('usa_national',      True,  False),
    ('gcc_luxury',        True,  False),
    # Remaining markets seeded inactive — surface them in the activation flow.
    ('usa_east_coast',    False, False),
    ('usa_south_florida', False, False),
    ('usa_west_coast',    False, False),
    ('central_america',   False, False),
    ('spanish_latam',     False, False),
    ('brazil',            False, False),
    ('scandinavia',       False, False),
]


def upsert_market(c, m):
    existing = (c.table('markets').select('id')
                .eq('code', m['code']).limit(1).execute().data or [])
    row = {
        'code':               m['code'],
        'display_name':       m['display_name'],
        'macro_region':       m['macro_region'],
        'countries':          m['countries'],
        'primary_locale':     m['primary_locale'],
        'fallback_locale':    m['fallback_locale'],
        'currency':           m['currency'],
        'measurement_system': m['measurement_system'],
        'cultural_profile':   m['cultural_profile'],
        'tone_of_voice':      m['tone_of_voice'],
        'cta_style':          m['cta_style'],
        'seo_intent':         m['seo_intent'],
        'sub_regions':        m['sub_regions'],
        'sort_order':         m['sort_order'],
        'active':             True,
        'updated_at':         _iso(),
    }
    if existing:
        c.table('markets').update(row).eq('id', existing[0]['id']).execute()
        return existing[0]['id'], False
    row['id'] = str(uuid.uuid4())
    row['created_at'] = _iso()
    c.table('markets').insert(row).execute()
    return row['id'], True


def attach_tenant_markets(c, tenant_id):
    inserted = 0
    for sort_order, (code, active, is_default) in enumerate(DEMO_TENANT_MARKETS):
        m = (c.table('markets').select('id').eq('code', code).limit(1).execute().data or [])
        if not m:
            print(f'  ⚠ market {code} not seeded — skipping')
            continue
        mid = m[0]['id']
        existing = (c.table('tenant_markets').select('id')
                    .eq('tenant_id', tenant_id).eq('market_id', mid)
                    .limit(1).execute().data or [])
        row = {
            'tenant_id':  tenant_id,
            'market_id':  mid,
            'is_active':  active,
            'is_default': is_default,
            'sort_order': sort_order,
            'updated_at': _iso(),
        }
        if existing:
            c.table('tenant_markets').update(row).eq('id', existing[0]['id']).execute()
        else:
            row['id'] = str(uuid.uuid4())
            c.table('tenant_markets').insert(row).execute()
            inserted += 1
    return inserted


def main():
    c = db()
    print('Phase R-MARKET-1A — seeding markets catalog')
    created = updated = 0
    for m in MARKETS:
        _, was_new = upsert_market(c, m)
        if was_new: created += 1
        else:       updated += 1
    print(f'  ✓ {created} markets created · {updated} updated · {len(MARKETS)} total')

    # Demo tenant linkage
    demo = (c.table('tenants').select('id').eq('slug', 'mood-demo-studio-81a09e').limit(1).execute().data or [])
    if demo:
        inserted = attach_tenant_markets(c, demo[0]['id'])
        print(f'  ✓ demo tenant_markets: {inserted} new · {len(DEMO_TENANT_MARKETS) - inserted} kept')
    else:
        print('  ⚠ demo tenant missing — skipping tenant_markets attach')


if __name__ == '__main__':
    main()
