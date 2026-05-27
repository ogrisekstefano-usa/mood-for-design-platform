"""
Reseed footer with minimal Apple-style structure:
- 1 nav column (Esplora): 4 main page links
- 1 legal column (Legale): 3 legal links
- Social: instagram + linkedin
- Brand logo + locale picker handled in component

Run: python -m db.reseed_footer_minimal
"""
import asyncio, json, os, sys, hashlib
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

import asyncpg
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')

CORP_SLUG = 'studio'

# (namespace, block_key, source_value, translations)
BLOCKS = [
    ('site.footer', 'col.explore.heading',  'Esplora',
        {'it':'Esplora','en-us':'Explore','en-uk':'Explore','fr':'Explorer','de':'Entdecken','es':'Explorar'}),
    ('site.footer', 'col.explore.audience', 'Dedicato a',
        {'it':'Dedicato a','en-us':'Audience','en-uk':'Audience','fr':'Dédié à','de':'Zielgruppe','es':'Dedicado a'}),
    ('site.footer', 'col.explore.features', 'Caratteristiche',
        {'it':'Caratteristiche','en-us':'Features','en-uk':'Features','fr':'Fonctionnalités','de':'Funktionen','es':'Características'}),
    ('site.footer', 'col.explore.pricing',  'Versioni e Prezzi',
        {'it':'Versioni e Prezzi','en-us':'Editions & Pricing','en-uk':'Editions & Pricing','fr':'Versions & Prix','de':'Versionen & Preise','es':'Ediciones y Precios'}),
    ('site.footer', 'col.explore.training', 'Formazione',
        {'it':'Formazione','en-us':'Training','en-uk':'Training','fr':'Formation','de':'Schulung','es':'Formación'}),

    ('site.footer', 'col.legal.heading',  'Legale',
        {'it':'Legale','en-us':'Legal','en-uk':'Legal','fr':'Mentions','de':'Rechtliches','es':'Legal'}),
    ('site.footer', 'col.legal.privacy',  'Privacy Policy',
        {'it':'Privacy Policy','en-us':'Privacy Policy','en-uk':'Privacy Policy','fr':'Confidentialité','de':'Datenschutz','es':'Privacidad'}),
    ('site.footer', 'col.legal.cookies',  'Cookie Policy',
        {'it':'Cookie Policy','en-us':'Cookie Policy','en-uk':'Cookie Policy','fr':'Cookies','de':'Cookies','es':'Cookies'}),
    ('site.footer', 'col.legal.terms',    'Termini di Servizio',
        {'it':'Termini di Servizio','en-us':'Terms of Service','en-uk':'Terms of Service','fr':'Conditions','de':'Bedingungen','es':'Términos'}),
]

LINKS = [
    {'key':'h_exp','href':'#','label_block':'site.footer.col.explore.heading','fallback':'Esplora','isHeading':True,'visible':True},
    {'key':'audience','href':'/dedicato-a','label_block':'site.footer.col.explore.audience','fallback':'Dedicato a','visible':True},
    {'key':'features','href':'/caratteristiche','label_block':'site.footer.col.explore.features','fallback':'Caratteristiche','visible':True},
    {'key':'pricing','href':'/versioni-prezzi','label_block':'site.footer.col.explore.pricing','fallback':'Versioni e Prezzi','visible':True},
    {'key':'training','href':'/formazione','label_block':'site.footer.col.explore.training','fallback':'Formazione','visible':True},
]
LEGAL = [
    {'key':'h_leg','href':'#','label_block':'site.footer.col.legal.heading','fallback':'Legale','isHeading':True,'visible':True},
    {'key':'privacy','href':'/privacy','label_block':'site.footer.col.legal.privacy','fallback':'Privacy Policy','visible':True},
    {'key':'cookies','href':'/cookies','label_block':'site.footer.col.legal.cookies','fallback':'Cookie Policy','visible':True},
    {'key':'terms','href':'/terms','label_block':'site.footer.col.legal.terms','fallback':'Termini di Servizio','visible':True},
]
SOCIAL = [
    {'key':'instagram','href':'https://instagram.com/moodfordesign','icon':'instagram','target':'_blank','visible':True},
    {'key':'linkedin','href':'https://linkedin.com/company/moodfordesign','icon':'linkedin','target':'_blank','visible':True},
]
COPYRIGHT = '© 2026 MOOD for DESIGN. Tutti i diritti riservati.'


async def upsert_block(conn, tid, ns, bk, src_val, locales):
    sh = hashlib.sha256(src_val.encode()).hexdigest()
    row = await conn.fetchrow(
        """
        INSERT INTO editorial_blocks
          (id, scope, tenant_id, namespace, block_key, block_type,
           source_locale, source_value, source_hash, is_active, created_at, updated_at)
        VALUES
          (gen_random_uuid(), 'tenant', $1, $2, $3, 'label', 'it', $4, $5, true, NOW(), NOW())
        ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE SET
          source_value=EXCLUDED.source_value, source_hash=EXCLUDED.source_hash, updated_at=NOW()
        RETURNING id
        """, tid, ns, bk, src_val, sh)
    bid = row['id']
    for loc, val in locales.items():
        await conn.execute(
            """
            INSERT INTO editorial_block_translations
              (id, block_id, locale, value, status, generated_by, source_hash, locked, created_at, updated_at)
            VALUES
              (gen_random_uuid(), $1, $2, $3, 'manual', 'reseed_footer_minimal', $4, false, NOW(), NOW())
            ON CONFLICT (block_id, locale) DO UPDATE SET
              value=EXCLUDED.value, status='manual', source_hash=EXCLUDED.source_hash, updated_at=NOW()
            """, bid, loc, val, sh)


async def main():
    db_url = os.environ['DATABASE_URL']
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        tenant = await conn.fetchrow("SELECT id FROM tenants WHERE slug=$1", CORP_SLUG)
        if not tenant: raise SystemExit("tenant not found")
        tid = tenant['id']
        print(f"→ tenant={tid}")

        # 1) upsert blocks
        for ns, bk, src, locs in BLOCKS:
            await upsert_block(conn, tid, ns, bk, src, locs)
        print(f"  ✓ blocks: {len(BLOCKS)}")

        # 2) Upsert footer section in cms_sections (section_type='footer')
        page = await conn.fetchrow(
            "SELECT id FROM cms_pages WHERE tenant_id=$1 AND page_key='footer'", tid)
        if not page:
            page = await conn.fetchrow(
                """INSERT INTO cms_pages (id, tenant_id, page_key, title, status,
                                          locale_meta, created_at, updated_at)
                   VALUES (gen_random_uuid(), $1, 'footer', 'Footer', 'published',
                           '{}'::jsonb, NOW(), NOW())
                   RETURNING id""", tid)
        page_id = page['id']
        settings = {
            'links': LINKS, 'legal': LEGAL, 'social': SOCIAL,
            'copyright': COPYRIGHT, 'manifesto': '',
        }
        await conn.execute(
            "DELETE FROM cms_sections WHERE page_id=$1 AND section_type='footer'",
            page_id)
        await conn.execute(
            """INSERT INTO cms_sections (id, tenant_id, page_id, section_type, sort_order,
                                          visible, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'footer', 0, true,
                       $3::jsonb, NOW(), NOW())""",
            tid, page_id, json.dumps(settings))
        print("  ✓ footer section written")

        print("\n✅ footer reseeded (minimal Apple-style 2-col + locale).")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
