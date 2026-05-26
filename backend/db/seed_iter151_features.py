"""
ITER151b — Features page redesign (mockup-based)
─────────────────────────────────────────────────────────────────────────────
Replaces the basic page_hero + page_intro of /caratteristiche with two
new sections:

  1. feature_hero_split    — split layout, text on black left, photo right
  2. feature_numbered_list — 5 numbered feature rows with screenshots

All blocks + media are CMS-managed via the Page Editor (auto-discovery).

Run:  python /app/backend/db/seed_iter151_features.py
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


# ── 1) Editorial blocks (IT seed) ───────────────────────────────────────
HERO_BLOCKS = [
    ('site.features', 'hero.eyebrow', 'eyebrow', {'it': 'La nostra comunità'}),
    ('site.features', 'hero.title',   'headline',{'it': 'Progettato per chi progetta il futuro.'}),
    ('site.features', 'hero.body',    'body',    {'it': 'MOOD si adatta al tuo modo di lavorare, non il contrario. Ogni studio, ogni cliente, ogni progetto ha il suo flusso. Noi lo valorizziamo.'}),
    ('site.features', 'hero.cta',     'cta',     {'it': 'Scopri a chi ci rivolgiamo'}),
]

FEATURES = [
    ('01', 'moodboards',     'Moodboards',          'Dai forma alle idee.',                'Raccogli ispirazioni, materiali e immagini in moodboard dinamiche e organizzate.'),
    ('02', 'design_journey', 'Design Journey™',     'Ogni progetto, nel suo percorso.',    'Segui ogni fase: ispirazione, proposta, approvazione, sviluppo. Sempre con chiarezza.'),
    ('03', 'media_library',  'Media Library',       'Tutto il tuo mondo visivo.',          'Organizza, cerca e utilizza ogni contenuto con intelligenza e semplicità.'),
    ('04', 'hotspot',        'Hotspot Storytelling','Racconta ogni dettaglio.',            'Trasforma le immagini in esperienze interattive che comunicano valore.'),
    ('05', 'magazine',       'Editorial Magazine',  'Contenuti che costruiscono cultura.', 'Pubblica articoli, trend e storie che ispirano e posizionano il tuo studio.'),
]

# Extra empty slots (item_06 → item_15) — declared so they show up in the
# Page Editor as empty, ready to be filled. Public site hides empties.
EXTRA_SLOTS = [f'{n:02d}' for n in range(6, 16)]

ITEM_BLOCKS = []
for num, _slug, eyebrow, title, body in FEATURES:
    ITEM_BLOCKS += [
        ('site.features', f'item_{num}.eyebrow', 'eyebrow', {'it': eyebrow}),
        ('site.features', f'item_{num}.title',   'headline',{'it': title}),
        ('site.features', f'item_{num}.body',    'body',    {'it': body}),
    ]
# Declare 10 extra empty slots so the Page Editor shows editable rows
for num in EXTRA_SLOTS:
    ITEM_BLOCKS += [
        ('site.features', f'item_{num}.eyebrow', 'eyebrow', {'it': ''}),
        ('site.features', f'item_{num}.title',   'headline',{'it': ''}),
        ('site.features', f'item_{num}.body',    'body',    {'it': ''}),
    ]


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
        """SELECT id, alt_text, category, file_name FROM media_library
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

        # Upsert all blocks
        all_blocks = HERO_BLOCKS + ITEM_BLOCKS
        for ns, bk, bt, locs in all_blocks:
            await upsert_editorial_block(conn, tid, ns, bk, bt, locs)
        print(f"  ✓ editorial_blocks upserted: {len(all_blocks)}")

        # Pick default media UUIDs (uses existing media_library)
        media_ids = await find_media(conn, tid, n=6)
        if not media_ids:
            print("⚠ No media in library — placeholder seed will leave images empty")
        else:
            print(f"  ✓ found {len(media_ids)} media defaults")
        hero_media = media_ids[0] if media_ids else None
        item_media = (media_ids[1:] + media_ids)[:5]  # cycle if fewer

        # Get the features page
        page = await conn.fetchrow(
            "SELECT id FROM cms_pages WHERE tenant_id=$1 AND page_key='features'",
            tid,
        )
        if not page:
            raise SystemExit("Page 'features' not found — run seed_iter151_pages.py first")

        # Replace existing page_hero / page_intro / feature_* with our 2 new sections
        await conn.execute(
            """DELETE FROM cms_sections
               WHERE page_id = $1
                 AND section_type IN ('page_hero','page_intro','feature_hero_split','feature_numbered_list')""",
            page['id'],
        )

        # SECTION 1: feature_hero_split
        hero_settings = {
            'blocks': {
                'eyebrow':   'site.features.hero.eyebrow',
                'title':     'site.features.hero.title',
                'body':      'site.features.hero.body',
                'cta_label': 'site.features.hero.cta',
            },
            'media':  {'background': hero_media} if hero_media else {},
            'links':  {'cta_href': '/dedicato-a'},
        }
        await conn.execute(
            """INSERT INTO cms_sections
                 (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'feature_hero_split', 0, true, $3::jsonb, NOW(), NOW())""",
            tid, page['id'], json.dumps(hero_settings),
        )

        # SECTION 2: feature_numbered_list with 15 items declared in blocks
        list_blocks = {}
        list_media = {}
        all_nums = [f[0] for f in FEATURES] + EXTRA_SLOTS
        for idx, num in enumerate(all_nums):
            list_blocks[f'item_{num}_eyebrow'] = f'site.features.item_{num}.eyebrow'
            list_blocks[f'item_{num}_title']   = f'site.features.item_{num}.title'
            list_blocks[f'item_{num}_body']    = f'site.features.item_{num}.body'
            # Only assign media for the first 5 (existing). New slots are picker-ready.
            if idx < len(item_media):
                list_media[f'item_{num}'] = item_media[idx]
        list_settings = {'blocks': list_blocks, 'media': list_media}
        await conn.execute(
            """INSERT INTO cms_sections
                 (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'feature_numbered_list', 1, true, $3::jsonb, NOW(), NOW())""",
            tid, page['id'], json.dumps(list_settings),
        )
        print("  ✓ 2 sections inserted (feature_hero_split + feature_numbered_list)")

        # Update SEO meta for IT locale
        await conn.execute(
            """UPDATE cms_pages SET locale_meta = jsonb_set(
                 COALESCE(locale_meta, '{}'::jsonb), '{it}',
                 jsonb_build_object('title','Caratteristiche — MOOD for DESIGN',
                                    'description','L''ecosistema MOOD: moodboard, design journey, media library, hotspot storytelling, editorial magazine.'), true
               ) WHERE id = $1""",
            page['id'],
        )
        print("  ✓ SEO meta updated")
        print("\n✅ ITER151b Features page rebuild completed.")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
