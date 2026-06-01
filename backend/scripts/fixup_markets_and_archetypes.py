"""
Fix-up data after user feedback:
  • markets.primary_locale for Brazil → pt-BR (was wrongly en-US)
  • studio_v2.archetype.*.description rewritten to stay broad
    ('mondo design' generale, not narrowed to 'arredamento').
"""
import asyncio, sys, hashlib
sys.path.insert(0, '/app/backend')
from sqlalchemy import text
from database import AsyncSessionLocal
from tenant_resolver import get_corporate_tenant


# ─── New archetype descriptions ─────────────────────────────────────
DESCRIPTIONS = {
    'interior_design': {
        'it-IT': "Studi che progettano spazi e ambienti.",
        'en-US': "Studios designing spaces and environments.",
    },
    'architecture': {
        'it-IT': "Studi di architettura e progettazione integrata.",
        'en-US': "Architecture practices and integrated design.",
    },
    'showroom': {
        'it-IT': "Spazi espositivi del mondo design.",
        'en-US': "Exhibition spaces in the design world.",
    },
    'retailer': {
        'it-IT': "Realtà commerciali del mondo design.",
        'en-US': "Retail businesses in the design world.",
    },
    'design_build': {
        'it-IT': "Realtà integrate che progettano e realizzano.",
        'en-US': "Integrated firms that design and deliver.",
    },
    'brand': {
        'it-IT': "Brand del mondo design.",
        'en-US': "Brands in the design world.",
    },
    'other': {
        'it-IT': "Una realtà del mondo design che vuole esplorare MOOD.",
        'en-US': "A design-world practice that wants to explore MOOD.",
    },
}


async def main():
    tenant = await get_corporate_tenant()
    tid = tenant['id']
    async with AsyncSessionLocal() as s:
        # Brazil locale fix
        await s.execute(text("""
            UPDATE markets SET primary_locale = 'pt-BR'
             WHERE code = 'brazil'
        """))

        # Update each description block
        for code, locs in DESCRIPTIONS.items():
            src = locs['it-IT']
            src_hash = hashlib.sha256(src.encode('utf-8')).hexdigest()
            bid_row = (await s.execute(text("""
                INSERT INTO editorial_blocks
                  (id, tenant_id, namespace, block_key, source_value,
                   source_hash, is_active, scope)
                VALUES (gen_random_uuid(), :t, 'studio_v2.archetype',
                        :k, :v, :h, TRUE, 'tenant')
                ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE
                  SET source_value = EXCLUDED.source_value,
                      source_hash  = EXCLUDED.source_hash
                RETURNING id
            """), {"t": tid, "k": f"{code}.description",
                   "v": src, "h": src_hash})).mappings().first()
            bid = bid_row['id']
            for loc, val in locs.items():
                await s.execute(text("""
                    INSERT INTO editorial_block_translations
                      (id, block_id, locale, value)
                    VALUES (gen_random_uuid(), :bid, :loc, :val)
                    ON CONFLICT (block_id, locale) DO UPDATE
                      SET value = EXCLUDED.value
                """), {"bid": bid, "loc": loc, "val": val})

        # Bust caches
        try:
            await s.execute(text("DELETE FROM cms_cache WHERE key LIKE 'markets:%'"))
        except Exception:
            pass
        await s.commit()
    print("Patched markets + archetype descriptions.")


if __name__ == '__main__':
    asyncio.run(main())
