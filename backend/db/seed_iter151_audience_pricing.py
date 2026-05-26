"""
ITER151h — Audience rebuild + Pricing tier expansion + Comparison table
─────────────────────────────────────────────────────────────────────────────
1. /dedicato-a (audience): replaces page_hero/intro with
     audience_hero_split + editorial_body_with_photo
2. /versioni-prezzi (pricing): adds 2 empty extra tier slots (tier_04/05)
   and a pricing_comparison_table section after the editorial tiers.
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


# ── AUDIENCE ────────────────────────────────────────────────────────────
AUDIENCE_BLOCKS = [
    ('site.audience', 'hero.eyebrow', 'eyebrow', {'it': 'La nostra comunità'}),
    ('site.audience', 'hero.title',   'headline',{'it': 'Progettato per chi progetta il futuro.'}),
    ('site.audience', 'hero.body',    'body',
     {'it': 'MOOD si adatta al tuo modo di lavorare, non il contrario. Ogni studio, ogni cliente, ogni progetto ha il suo flusso. Noi lo valorizziamo.'}),
    ('site.audience', 'hero.cta',     'cta', {'it': 'Scopri a chi ci rivolgiamo'}),

    ('site.audience', 'body.eyebrow', 'eyebrow', {'it': 'A chi ci rivolgiamo'}),
    ('site.audience', 'body.title',   'headline',
     {'it': 'Studi che progettano spazi, esperienze e relazioni.'}),
    ('site.audience', 'body.body',    'body',
     {'it': "MOOD nasce per chi non si accontenta di gestire progetti — ma li cura.\n\nArchitetti, interior designer, studi di progettazione, showroom curatoriali, retailer di design: ogni realtà che lavora con il bello, e con la complessità di farlo accadere, trova in MOOD un alleato editoriale.\n\nNon vendiamo software: offriamo un modo di lavorare. Un atelier digitale che parla la vostra lingua — fatta di materiali, luce, dettagli, relazioni che durano nel tempo."}),
]

# ── PRICING — extra tier_04 / tier_05 (empty source slots) ─────────────
PRICING_EXTRA_TIER_BLOCKS = []
for k in ['04', '05']:
    for f in ['eyebrow','title','subtitle','body','price','price_caption','cta',
              'inc_1','inc_2','inc_3','inc_4','inc_5']:
        btype = {
            'eyebrow':'eyebrow','title':'headline','subtitle':'body','body':'body',
            'price':'body','price_caption':'body','cta':'cta',
            'inc_1':'body','inc_2':'body','inc_3':'body','inc_4':'body','inc_5':'body',
        }[f]
        PRICING_EXTRA_TIER_BLOCKS.append(
            ('site.pricing', f'tier_{k}.{f}', btype, {'it': ''}),
        )

# ── PRICING — comparison table (sample IT seed) ────────────────────────
PRICING_COMPARISON_BLOCKS = [
    ('site.pricing', 'comparison.title', 'headline',
     {'it': 'Confronta tutte le funzionalità.'}),
    ('site.pricing', 'comparison.footer_note', 'body',
     {'it': 'Hai esigenze specifiche? Parla con il nostro team per una soluzione personalizzata.'}),
    ('site.pricing', 'comparison.contact_cta', 'cta', {'it': 'Contatta il team'}),

    # Tier names
    ('site.pricing', 'comparison.tier_01_name', 'cta', {'it': 'Essential'}),
    ('site.pricing', 'comparison.tier_02_name', 'cta', {'it': 'Studio'}),
    ('site.pricing', 'comparison.tier_03_name', 'cta', {'it': 'Professional'}),
    ('site.pricing', 'comparison.tier_04_name', 'cta', {'it': 'Enterprise'}),

    # Rows
    ('site.pricing', 'comparison.row_01_label', 'body', {'it': 'Utenti inclusi'}),
    ('site.pricing', 'comparison.row_01_v01',   'body', {'it': '1'}),
    ('site.pricing', 'comparison.row_01_v02',   'body', {'it': 'Fino a 5'}),
    ('site.pricing', 'comparison.row_01_v03',   'body', {'it': 'Fino a 15'}),
    ('site.pricing', 'comparison.row_01_v04',   'body', {'it': 'Illimitati'}),

    ('site.pricing', 'comparison.row_02_label', 'body', {'it': 'Moodboard illimitate'}),
    ('site.pricing', 'comparison.row_02_v01',   'body', {'it': '✓'}),
    ('site.pricing', 'comparison.row_02_v02',   'body', {'it': '✓'}),
    ('site.pricing', 'comparison.row_02_v03',   'body', {'it': '✓'}),
    ('site.pricing', 'comparison.row_02_v04',   'body', {'it': '✓'}),

    ('site.pricing', 'comparison.row_03_label', 'body', {'it': 'Libreria media'}),
    ('site.pricing', 'comparison.row_03_v01',   'body', {'it': '10 GB'}),
    ('site.pricing', 'comparison.row_03_v02',   'body', {'it': '100 GB'}),
    ('site.pricing', 'comparison.row_03_v03',   'body', {'it': '500 GB'}),
    ('site.pricing', 'comparison.row_03_v04',   'body', {'it': 'Illimitata'}),

    ('site.pricing', 'comparison.row_04_label', 'body', {'it': 'Design Journey™'}),
    ('site.pricing', 'comparison.row_04_v01',   'body', {'it': '-'}),
    ('site.pricing', 'comparison.row_04_v02',   'body', {'it': '-'}),
    ('site.pricing', 'comparison.row_04_v03',   'body', {'it': '✓'}),
    ('site.pricing', 'comparison.row_04_v04',   'body', {'it': '✓'}),

    ('site.pricing', 'comparison.row_05_label', 'body', {'it': 'Client Portal'}),
    ('site.pricing', 'comparison.row_05_v01',   'body', {'it': '✓'}),
    ('site.pricing', 'comparison.row_05_v02',   'body', {'it': '✓'}),
    ('site.pricing', 'comparison.row_05_v03',   'body', {'it': '✓'}),
    ('site.pricing', 'comparison.row_05_v04',   'body', {'it': '✓'}),

    ('site.pricing', 'comparison.row_06_label', 'body', {'it': 'Analytics avanzate'}),
    ('site.pricing', 'comparison.row_06_v01',   'body', {'it': '-'}),
    ('site.pricing', 'comparison.row_06_v02',   'body', {'it': '-'}),
    ('site.pricing', 'comparison.row_06_v03',   'body', {'it': '✓'}),
    ('site.pricing', 'comparison.row_06_v04',   'body', {'it': '✓'}),

    ('site.pricing', 'comparison.row_07_label', 'body', {'it': 'Integrazioni'}),
    ('site.pricing', 'comparison.row_07_v01',   'body', {'it': '-'}),
    ('site.pricing', 'comparison.row_07_v02',   'body', {'it': '-'}),
    ('site.pricing', 'comparison.row_07_v03',   'body', {'it': '✓'}),
    ('site.pricing', 'comparison.row_07_v04',   'body', {'it': '✓'}),

    ('site.pricing', 'comparison.row_08_label', 'body', {'it': 'Supporto'}),
    ('site.pricing', 'comparison.row_08_v01',   'body', {'it': 'Email'}),
    ('site.pricing', 'comparison.row_08_v02',   'body', {'it': 'Prioritario'}),
    ('site.pricing', 'comparison.row_08_v03',   'body', {'it': 'Prioritario'}),
    ('site.pricing', 'comparison.row_08_v04',   'body', {'it': 'Dedicato'}),

    ('site.pricing', 'comparison.row_09_label', 'body', {'it': 'Formazione inclusa'}),
    ('site.pricing', 'comparison.row_09_v01',   'body', {'it': '-'}),
    ('site.pricing', 'comparison.row_09_v02',   'body', {'it': '✓'}),
    ('site.pricing', 'comparison.row_09_v03',   'body', {'it': '✓'}),
    ('site.pricing', 'comparison.row_09_v04',   'body', {'it': '✓'}),
]
# Empty rows 10-12 so admins can add more from the page editor
for n in range(10, 13):
    k = str(n).zfill(2)
    PRICING_COMPARISON_BLOCKS.append(
        ('site.pricing', f'comparison.row_{k}_label', 'body', {'it': ''}),
    )
    for vi in ['01','02','03','04']:
        PRICING_COMPARISON_BLOCKS.append(
            ('site.pricing', f'comparison.row_{k}_v{vi}', 'body', {'it': ''}),
        )


async def upsert_editorial_block(conn, tenant_id, ns, bk, btype, locales):
    src_val = locales.get('it', '')
    if src_val is None:
        src_val = ''
    sh = hashlib.sha256(src_val.encode('utf-8')).hexdigest()
    row = await conn.fetchrow(
        """
        INSERT INTO editorial_blocks
          (id, scope, tenant_id, namespace, block_key, block_type,
           source_locale, source_value, source_hash, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), 'tenant', $1, $2, $3, $4, 'it', $5, $6, true, NOW(), NOW())
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
            VALUES (gen_random_uuid(), $1, $2, $3, 'manual', 'seed', $4, false, NOW(), NOW())
            ON CONFLICT (block_id, locale) DO UPDATE SET
              value=EXCLUDED.value, status='manual', source_hash=EXCLUDED.source_hash, updated_at=NOW()
            """,
            bid, loc, val, sh,
        )


async def find_media(conn, tenant_id, n=8):
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
        tenant = await conn.fetchrow("SELECT id FROM tenants WHERE slug=$1", CORP_SLUG)
        tid = tenant['id']
        print(f"→ Tenant: {CORP_SLUG} ({tid})")

        all_blocks = AUDIENCE_BLOCKS + PRICING_EXTRA_TIER_BLOCKS + PRICING_COMPARISON_BLOCKS
        for ns, bk, bt, locs in all_blocks:
            await upsert_editorial_block(conn, tid, ns, bk, bt, locs)
        print(f"  ✓ editorial_blocks upserted: {len(all_blocks)}")

        media_ids = await find_media(conn, tid, n=8)
        hero_media = media_ids[0] if media_ids else None
        body_media = media_ids[1] if len(media_ids) > 1 else hero_media

        # ── AUDIENCE — rebuild ────────────────────────────────────────
        audience = await conn.fetchrow("SELECT id FROM cms_pages WHERE tenant_id=$1 AND page_key='audience'", tid)
        if not audience:
            raise SystemExit("Page 'audience' not found")

        await conn.execute(
            """DELETE FROM cms_sections WHERE page_id=$1 AND section_type=ANY($2::text[])""",
            audience['id'],
            ['page_hero','page_intro','audience_hero_split','editorial_body_with_photo'],
        )

        await conn.execute(
            """INSERT INTO cms_sections (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'audience_hero_split', 0, true, $3::jsonb, NOW(), NOW())""",
            tid, audience['id'],
            json.dumps({
                'blocks': {
                    'eyebrow':   'site.audience.hero.eyebrow',
                    'title':     'site.audience.hero.title',
                    'body':      'site.audience.hero.body',
                    'cta_label': 'site.audience.hero.cta',
                },
                'media': {'background': hero_media} if hero_media else {},
                'links': {'cta_href': '#a-chi-ci-rivolgiamo'},
            }),
        )
        await conn.execute(
            """INSERT INTO cms_sections (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'editorial_body_with_photo', 1, true, $3::jsonb, NOW(), NOW())""",
            tid, audience['id'],
            json.dumps({
                'blocks': {
                    'eyebrow': 'site.audience.body.eyebrow',
                    'title':   'site.audience.body.title',
                    'body':    'site.audience.body.body',
                },
                'media': {'photo': body_media} if body_media else {},
                'options': {'reverse': False, 'background': '#050606'},
            }),
        )
        print("  ✓ /dedicato-a: 2 sections inserted")

        # ── PRICING — extend tiers section + add comparison table ────
        pricing = await conn.fetchrow("SELECT id FROM cms_pages WHERE tenant_id=$1 AND page_key='pricing'", tid)
        if not pricing:
            raise SystemExit("Page 'pricing' not found")

        # Add tier_04 and tier_05 slots to the existing pricing_tiers_editorial section
        section = await conn.fetchrow(
            "SELECT id, settings FROM cms_sections WHERE page_id=$1 AND section_type='pricing_tiers_editorial' LIMIT 1",
            pricing['id'],
        )
        if section:
            settings = section['settings']
            if isinstance(settings, str):
                settings = json.loads(settings)
            blocks = settings.get('blocks', {})
            links = settings.get('links', {})
            for k in ['04', '05']:
                blocks[f'tier_{k}_eyebrow']       = f'site.pricing.tier_{k}.eyebrow'
                blocks[f'tier_{k}_title']         = f'site.pricing.tier_{k}.title'
                blocks[f'tier_{k}_subtitle']      = f'site.pricing.tier_{k}.subtitle'
                blocks[f'tier_{k}_body']          = f'site.pricing.tier_{k}.body'
                blocks[f'tier_{k}_price']         = f'site.pricing.tier_{k}.price'
                blocks[f'tier_{k}_price_caption'] = f'site.pricing.tier_{k}.price_caption'
                blocks[f'tier_{k}_cta']           = f'site.pricing.tier_{k}.cta'
                for i in range(1, 6):
                    blocks[f'tier_{k}_inc_{i}'] = f'site.pricing.tier_{k}.inc_{i}'
                links[f'tier_{k}_href'] = '/dedicato-a'
            settings['blocks'] = blocks
            settings['links']  = links
            await conn.execute(
                "UPDATE cms_sections SET settings=$1::jsonb, updated_at=NOW() WHERE id=$2",
                json.dumps(settings), section['id'],
            )
            print("  ✓ pricing tiers extended (tier_04 + tier_05 declared)")

        # Add comparison_table section (sort_order 3, before ecosystem_note which is at 3)
        # First push ecosystem_note to 4
        await conn.execute(
            "UPDATE cms_sections SET sort_order=4 WHERE page_id=$1 AND section_type='pricing_ecosystem_note'",
            pricing['id'],
        )
        # Delete any existing comparison_table to be idempotent
        await conn.execute(
            "DELETE FROM cms_sections WHERE page_id=$1 AND section_type='pricing_comparison_table'",
            pricing['id'],
        )
        comparison_blocks = {
            'title':        'site.pricing.comparison.title',
            'footer_note':  'site.pricing.comparison.footer_note',
            'contact_cta':  'site.pricing.comparison.contact_cta',
            'tier_01_name': 'site.pricing.comparison.tier_01_name',
            'tier_02_name': 'site.pricing.comparison.tier_02_name',
            'tier_03_name': 'site.pricing.comparison.tier_03_name',
            'tier_04_name': 'site.pricing.comparison.tier_04_name',
        }
        for n in range(1, 13):
            k = str(n).zfill(2)
            comparison_blocks[f'row_{k}_label'] = f'site.pricing.comparison.row_{k}_label'
            for vi in ['01','02','03','04']:
                comparison_blocks[f'row_{k}_v{vi}'] = f'site.pricing.comparison.row_{k}_v{vi}'

        await conn.execute(
            """INSERT INTO cms_sections (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'pricing_comparison_table', 3, true, $3::jsonb, NOW(), NOW())""",
            tid, pricing['id'],
            json.dumps({'blocks': comparison_blocks, 'links': {'contact_cta_href': '/supporto'}}),
        )
        print("  ✓ pricing comparison table inserted")

        # SEO meta
        await conn.execute(
            """UPDATE cms_pages SET locale_meta = jsonb_set(COALESCE(locale_meta,'{}'::jsonb), '{it}',
                 jsonb_build_object('title','Dedicato a — MOOD for DESIGN',
                                    'description','Studi di architettura, interior designer, showroom curatoriali e retailer di design. MOOD si adatta al tuo modo di lavorare.'), true)
               WHERE id=$1""", audience['id'])
        print("  ✓ SEO meta updated")
        print("\n✅ ITER151h Audience + Pricing comparison completed.")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
