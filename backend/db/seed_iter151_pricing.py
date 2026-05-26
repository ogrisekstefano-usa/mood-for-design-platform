"""
ITER151c — Pricing page redesign (editorial ecosystem access)
─────────────────────────────────────────────────────────────────────────────
Replaces the basic page_hero + page_intro of /versioni-prezzi with four
new editorial sections that read like an architectural journal, NOT a
SaaS pricing page:

  1. pricing_hero_cinematic    — full-bleed cinematic environment hero
  2. pricing_philosophy        — typographic intermezzo (no chrome)
  3. pricing_tiers_editorial   — 3 vertical editorial tier cards (modalità)
  4. pricing_ecosystem_note    — onboarding / formazione / team dedicato

All blocks + media are CMS-managed via the Page Editor (auto-discovery).
The pricing values are EDITORIAL placeholders (italic, secondary) — the
real billing engine arrives with Stripe in a later iteration.

Run:  python /app/backend/db/seed_iter151_pricing.py
"""
import asyncio
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

import asyncpg
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')

CORP_SLUG = os.environ.get('CORPORATE_TENANT_SLUG', 'studio')


# ── 1) HERO (editorial cinematic) ───────────────────────────────────────
HERO_BLOCKS = [
    ('site.pricing', 'hero.eyebrow', 'eyebrow',
     {'it': 'Modalità operative'}),
    ('site.pricing', 'hero.title', 'headline',
     {'it': 'Scegli il livello di ecosistema.'}),
    ('site.pricing', 'hero.subtitle', 'body',
     {'it': 'MOOD non è un software da acquistare. È un atelier digitale a cui accedere — con il ritmo, la profondità e la cura che il tuo lavoro richiede.'}),
]

# ── 2) PHILOSOPHY (typographic intermezzo) ──────────────────────────────
PHILOSOPHY_BLOCKS = [
    ('site.pricing', 'philosophy.eyebrow', 'eyebrow',
     {'it': 'Un invito, non una sottoscrizione'}),
    ('site.pricing', 'philosophy.headline', 'headline',
     {'it': 'Ogni studio entra in MOOD nel modo che gli appartiene.'}),
    ('site.pricing', 'philosophy.body', 'body',
     {'it': 'Per questo non parliamo di piani, ma di modalità operative. Sono soglie diverse di intensità, profondità di accompagnamento e ampiezza dell\'ecosistema — pensate per accogliere il professionista singolo, lo studio strutturato e il gruppo internazionale. La cifra è una conseguenza, non il punto di partenza.'}),
]

# ── 3) TIERS — three operating modes ────────────────────────────────────
# tone: each tier is a "modalità", not a "plan". Prices are italic
# secondary — never the protagonist.
TIERS = [
    {
        'key': '01',
        'eyebrow': 'Studio',
        'title': 'Atelier individuale',
        'subtitle': 'Per il professionista che progetta in autonomia.',
        'body': "L'accesso essenziale all'ecosistema MOOD: moodboard editoriali, libreria materiali curata, design journey personale e magazine integrato. Pensato per chi conduce ogni progetto in prima persona, dalla prima ispirazione alla consegna.",
        'price': 'da € 89 / mese',
        'price_caption': 'IVA esclusa · fatturazione annuale',
        'inclusions': [
            'Moodboards illimitate',
            'Design Journey personale',
            'Libreria materiali curata',
            'Magazine editoriale integrato',
            'Supporto editoriale via email',
        ],
        'cta': 'Inizia il percorso',
    },
    {
        'key': '02',
        'eyebrow': 'Atelier',
        'title': 'Studio professionale',
        'subtitle': 'Per il team che firma progetti complessi.',
        'body': "L'ecosistema completo per lo studio strutturato: collaborazione multi-utente, governance redazionale, hotspot storytelling sui progetti e accesso anticipato alle nuove sezioni del magazine. Include onboarding curato e una sessione di formazione iniziale dedicata.",
        'price': 'da € 249 / mese',
        'price_caption': 'fino a 8 collaboratori · IVA esclusa',
        'inclusions': [
            'Tutto della modalità Studio',
            'Collaborazione fino a 8 utenti',
            'Hotspot storytelling sui progetti',
            'Governance editoriale avanzata',
            'Onboarding cinematografico dedicato',
        ],
        'cta': 'Richiedi accesso Atelier',
    },
    {
        'key': '03',
        'eyebrow': 'Maison',
        'title': 'Gruppo & multi-brand',
        'subtitle': 'Per la struttura che orchestra più studi e mercati.',
        'body': "L'accesso integrale: multi-tenant, governance multi-marchio, intelligence editoriale dedicata, presenza redazionale curata e team relazionale a disposizione. Una collaborazione, più che una licenza — costruita insieme, su misura del vostro mondo.",
        'price': 'su richiesta',
        'price_caption': 'progetto modellato sulle vostre esigenze',
        'inclusions': [
            'Tutto della modalità Atelier',
            'Multi-tenant & multi-brand',
            'Editorial intelligence dedicata',
            'Team relazionale a disposizione',
            'Workshop strategici annuali',
        ],
        'cta': 'Parliamone',
    },
]

# ── 4) ECOSYSTEM NOTE — onboarding / formazione / team ─────────────────
ECOSYSTEM_BLOCKS = [
    ('site.pricing', 'ecosystem.eyebrow', 'eyebrow',
     {'it': 'Più che un software'}),
    ('site.pricing', 'ecosystem.headline', 'headline',
     {'it': 'Entrare in MOOD significa entrare in un metodo.'}),
    ('site.pricing', 'ecosystem.body', 'body',
     {'it': "Ogni modalità include più del semplice accesso alla piattaforma: c'è un percorso di ingresso curato, una formazione editoriale continua e — dalla modalità Atelier in avanti — un riferimento umano che vi accompagna nelle fasi cruciali del lavoro. Perché un ecosistema è tale solo se respira con voi."}),
    ('site.pricing', 'ecosystem.pillar_01_title', 'headline',
     {'it': 'Onboarding curato'}),
    ('site.pricing', 'ecosystem.pillar_01_body', 'body',
     {'it': "Un percorso di ingresso ritmato: importazione dei vostri progetti esistenti, configurazione del workspace e calibrazione della voce editoriale insieme alla nostra redazione."}),
    ('site.pricing', 'ecosystem.pillar_02_title', 'headline',
     {'it': 'Formazione continua'}),
    ('site.pricing', 'ecosystem.pillar_02_body', 'body',
     {'it': "Una libreria di sessioni live, masterclass mensili e contenuti riservati per affinare l'uso editoriale dello strumento e restare allineati alle nuove sezioni del magazine."}),
    ('site.pricing', 'ecosystem.pillar_03_title', 'headline',
     {'it': 'Team dedicato'}),
    ('site.pricing', 'ecosystem.pillar_03_body', 'body',
     {'it': "Un riferimento umano — non un ticket. Dalla modalità Atelier in poi, una persona vi conosce, vi segue e vi accompagna nei momenti decisivi del progetto."}),
    ('site.pricing', 'ecosystem.cta_label', 'cta',
     {'it': 'Esplora il supporto'}),
]

# Assemble TIER editorial blocks
TIER_BLOCKS = []
for t in TIERS:
    k = t['key']
    TIER_BLOCKS += [
        ('site.pricing', f'tier_{k}.eyebrow',       'eyebrow', {'it': t['eyebrow']}),
        ('site.pricing', f'tier_{k}.title',         'headline',{'it': t['title']}),
        ('site.pricing', f'tier_{k}.subtitle',      'body',    {'it': t['subtitle']}),
        ('site.pricing', f'tier_{k}.body',          'body',    {'it': t['body']}),
        ('site.pricing', f'tier_{k}.price',         'body',    {'it': t['price']}),
        ('site.pricing', f'tier_{k}.price_caption', 'body',    {'it': t['price_caption']}),
        ('site.pricing', f'tier_{k}.cta',           'cta',     {'it': t['cta']}),
    ]
    for i, inc in enumerate(t['inclusions'], start=1):
        TIER_BLOCKS.append(
            ('site.pricing', f'tier_{k}.inc_{i}', 'body', {'it': inc}),
        )


async def upsert_editorial_block(conn, tenant_id, ns, bk, btype, locales):
    src_val = locales.get('it') or next(iter(locales.values()))
    sh = hashlib.sha256(src_val.encode('utf-8')).hexdigest()
    row = await conn.fetchrow(
        """
        INSERT INTO editorial_blocks
          (id, scope, tenant_id, namespace, block_key, block_type,
           source_locale, source_value, source_hash, is_active, created_at, updated_at)
        VALUES
          (gen_random_uuid(), 'tenant', $1, $2, $3, $4, 'it', $5, $6, true, NOW(), NOW())
        ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE SET
          block_type=EXCLUDED.block_type, source_value=EXCLUDED.source_value,
          source_hash=EXCLUDED.source_hash, updated_at=NOW()
        RETURNING id
        """,
        tenant_id, ns, bk, btype, src_val, sh,
    )
    bid = row['id']
    for loc, val in locales.items():
        await conn.execute(
            """
            INSERT INTO editorial_block_translations
              (id, block_id, locale, value, status, generated_by, source_hash, locked, created_at, updated_at)
            VALUES
              (gen_random_uuid(), $1, $2, $3, 'manual', 'seed', $4, false, NOW(), NOW())
            ON CONFLICT (block_id, locale) DO UPDATE SET
              value=EXCLUDED.value, status='manual', source_hash=EXCLUDED.source_hash, updated_at=NOW()
            """,
            bid, loc, val, sh,
        )


async def find_media(conn, tenant_id, n=6):
    """Pick the n most recently uploaded non-archived images as defaults."""
    rows = await conn.fetch(
        """SELECT id FROM media_library
           WHERE tenant_id = $1 AND archived_at IS NULL
           ORDER BY created_at DESC LIMIT $2""",
        tenant_id, n,
    )
    return [str(r['id']) for r in rows]


async def main():
    db_url = os.environ['DATABASE_URL']
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        tenant = await conn.fetchrow("SELECT id FROM tenants WHERE slug = $1", CORP_SLUG)
        if not tenant:
            raise SystemExit(f"Tenant '{CORP_SLUG}' not found")
        tid = tenant['id']
        print(f"→ Tenant: {CORP_SLUG} ({tid})")

        all_blocks = HERO_BLOCKS + PHILOSOPHY_BLOCKS + TIER_BLOCKS + ECOSYSTEM_BLOCKS
        for ns, bk, bt, locs in all_blocks:
            await upsert_editorial_block(conn, tid, ns, bk, bt, locs)
        print(f"  ✓ editorial_blocks upserted: {len(all_blocks)}")

        media_ids = await find_media(conn, tid, n=6)
        if not media_ids:
            print("⚠ No media in library — slots will be empty (picker-ready)")
        else:
            print(f"  ✓ found {len(media_ids)} media defaults")
        hero_media = media_ids[0] if media_ids else None
        # cycle to provide 3 tier images
        tier_media = (media_ids[1:] + media_ids)[:3] if media_ids else []

        page = await conn.fetchrow(
            "SELECT id FROM cms_pages WHERE tenant_id=$1 AND page_key='pricing'",
            tid,
        )
        if not page:
            raise SystemExit("Page 'pricing' not found — run seed_iter151_pages.py first")

        await conn.execute(
            """DELETE FROM cms_sections
               WHERE page_id = $1
                 AND section_type IN (
                   'page_hero','page_intro',
                   'pricing_hero_cinematic','pricing_philosophy',
                   'pricing_tiers_editorial','pricing_ecosystem_note',
                   'pricing_cards'
                 )""",
            page['id'],
        )

        # SECTION 1: pricing_hero_cinematic
        hero_settings = {
            'blocks': {
                'eyebrow':  'site.pricing.hero.eyebrow',
                'title':    'site.pricing.hero.title',
                'subtitle': 'site.pricing.hero.subtitle',
            },
            'media': {'background': hero_media} if hero_media else {},
        }
        await conn.execute(
            """INSERT INTO cms_sections
                 (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'pricing_hero_cinematic', 0, true, $3::jsonb, NOW(), NOW())""",
            tid, page['id'], json.dumps(hero_settings),
        )

        # SECTION 2: pricing_philosophy
        philosophy_settings = {
            'blocks': {
                'eyebrow':  'site.pricing.philosophy.eyebrow',
                'headline': 'site.pricing.philosophy.headline',
                'body':     'site.pricing.philosophy.body',
            },
        }
        await conn.execute(
            """INSERT INTO cms_sections
                 (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'pricing_philosophy', 1, true, $3::jsonb, NOW(), NOW())""",
            tid, page['id'], json.dumps(philosophy_settings),
        )

        # SECTION 3: pricing_tiers_editorial
        tier_blocks_settings = {}
        tier_media_settings = {}
        tier_links_settings = {}
        for idx, t in enumerate(TIERS):
            k = t['key']
            tier_blocks_settings[f'tier_{k}_eyebrow']       = f'site.pricing.tier_{k}.eyebrow'
            tier_blocks_settings[f'tier_{k}_title']         = f'site.pricing.tier_{k}.title'
            tier_blocks_settings[f'tier_{k}_subtitle']      = f'site.pricing.tier_{k}.subtitle'
            tier_blocks_settings[f'tier_{k}_body']          = f'site.pricing.tier_{k}.body'
            tier_blocks_settings[f'tier_{k}_price']         = f'site.pricing.tier_{k}.price'
            tier_blocks_settings[f'tier_{k}_price_caption'] = f'site.pricing.tier_{k}.price_caption'
            tier_blocks_settings[f'tier_{k}_cta']           = f'site.pricing.tier_{k}.cta'
            for i in range(1, len(t['inclusions']) + 1):
                tier_blocks_settings[f'tier_{k}_inc_{i}'] = f'site.pricing.tier_{k}.inc_{i}'
            if idx < len(tier_media):
                tier_media_settings[f'tier_{k}'] = tier_media[idx]
            tier_links_settings[f'tier_{k}_href'] = '/dedicato-a'
        tiers_settings = {
            'blocks':  tier_blocks_settings,
            'media':   tier_media_settings,
            'links':   tier_links_settings,
            'options': {'featured_index': 1},
        }
        await conn.execute(
            """INSERT INTO cms_sections
                 (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'pricing_tiers_editorial', 2, true, $3::jsonb, NOW(), NOW())""",
            tid, page['id'], json.dumps(tiers_settings),
        )

        # SECTION 4: pricing_ecosystem_note
        ecosystem_settings = {
            'blocks': {
                'eyebrow':         'site.pricing.ecosystem.eyebrow',
                'headline':        'site.pricing.ecosystem.headline',
                'body':            'site.pricing.ecosystem.body',
                'pillar_01_title': 'site.pricing.ecosystem.pillar_01_title',
                'pillar_01_body':  'site.pricing.ecosystem.pillar_01_body',
                'pillar_02_title': 'site.pricing.ecosystem.pillar_02_title',
                'pillar_02_body':  'site.pricing.ecosystem.pillar_02_body',
                'pillar_03_title': 'site.pricing.ecosystem.pillar_03_title',
                'pillar_03_body':  'site.pricing.ecosystem.pillar_03_body',
                'cta_label':       'site.pricing.ecosystem.cta_label',
            },
            'links': {'cta_href': '/supporto'},
        }
        await conn.execute(
            """INSERT INTO cms_sections
                 (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'pricing_ecosystem_note', 3, true, $3::jsonb, NOW(), NOW())""",
            tid, page['id'], json.dumps(ecosystem_settings),
        )
        print("  ✓ 4 sections inserted (hero_cinematic + philosophy + tiers + ecosystem)")

        # SEO meta
        await conn.execute(
            """UPDATE cms_pages SET locale_meta = jsonb_set(
                 COALESCE(locale_meta, '{}'::jsonb), '{it}',
                 jsonb_build_object('title','Versioni e Prezzi — MOOD for DESIGN',
                                    'description','MOOD non è un software da acquistare. È un atelier digitale a cui accedere. Tre modalità operative per professionisti, studi e gruppi.'), true
               ) WHERE id = $1""",
            page['id'],
        )
        print("  ✓ SEO meta updated")
        print("\n✅ ITER151c Pricing page rebuild completed.")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
