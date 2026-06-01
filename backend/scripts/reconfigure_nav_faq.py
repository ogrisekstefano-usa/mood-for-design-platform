"""
Reconfigure the corporate navigation:
  • Move "support" from right → main, rename to FAQ, switch href to /faq.
  • Keep only "login" + "activate_blueprint" on the right.
  • Update the editorial_block site.nav.support label to "FAQ" (it-IT, en-US).
"""
import asyncio, json, sys
sys.path.insert(0, '/app/backend')
from sqlalchemy import text
from database import AsyncSessionLocal


async def main():
    async with AsyncSessionLocal() as s:
        row = (await s.execute(text("""
            SELECT id, settings FROM cms_sections
             WHERE section_type='navigation' AND deleted_at IS NULL
             LIMIT 1
        """))).mappings().first()
        if not row:
            print("No navigation section."); return
        sid = row['id']
        settings = dict(row['settings'] or {})

        items = settings.get('items') or []
        for it in items:
            if it.get('key') == 'support':
                it['key']       = 'faq'
                it['href']      = '/faq'
                it['fallback']  = 'FAQ'
                it['position']  = 'main'
                it['label_block'] = 'site.nav.faq'

        # Re-order: main items in the order audience/features/pricing/training/faq,
        # then right items login/activate_blueprint
        order = ['audience', 'features', 'pricing', 'training', 'faq',
                 'login', 'activate_blueprint']
        items.sort(key=lambda x: order.index(x['key']) if x['key'] in order else 99)
        settings['items'] = items

        await s.execute(text("""
            UPDATE cms_sections SET settings = CAST(:js AS jsonb)
             WHERE id = :id
        """), {"id": sid, "js": json.dumps(settings)})

        # Rename the editorial block from site.nav.support → site.nav.faq
        # Update tab also the label values.
        await s.execute(text("""
            UPDATE editorial_blocks
               SET block_key = 'site.nav.faq', source_value = 'FAQ'
             WHERE namespace = 'site' AND block_key = 'site.nav.support'
        """))
        # translations
        await s.execute(text("""
            UPDATE editorial_block_translations t
               SET value = 'FAQ'
              FROM editorial_blocks b
             WHERE t.block_id = b.id
               AND b.namespace = 'site' AND b.block_key = 'site.nav.faq'
        """))
        await s.commit()

        # Bump cache by clearing cms_cache rows for nav
        try:
            await s.execute(text("DELETE FROM cms_cache WHERE key LIKE 'site:nav:%'"))
            await s.commit()
        except Exception:
            pass

        print("Navigation reconfigured.")
        print("Final order:", [i['key'] for i in items])


if __name__ == '__main__':
    asyncio.run(main())
