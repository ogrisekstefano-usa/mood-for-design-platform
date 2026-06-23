"""
seed_studio_v2_landing_keys.py
Aggiunge le 4 chiavi mancanti del landing funnel /studio al manifest studio_v2.ui.
Idempotente (ON CONFLICT DO UPDATE).
Run: cd /app/backend && python -m db.seed_studio_v2_landing_keys
"""
import asyncio
from database import AsyncSessionLocal
from sqlalchemy import text
from tenant_resolver import get_corporate_tenant

LANDING_KEYS: dict[str, dict[str, str]] = {
    "landing.headline": {
        "it-IT": "Candidati a MOOD.",
        "en-US": "Apply your studio to MOOD.",
    },
    "landing.subheadline": {
        "it-IT": "Completa la candidatura in 3 minuti. Un Advisor MOOD ti contatterà.",
        "en-US": "Complete the request in 3 minutes. A MOOD Advisor will contact you.",
    },
    "landing.cta_start": {
        "it-IT": "Inizia",
        "en-US": "Begin",
    },
    "landing.link_signin": {
        "it-IT": "Hai già un account? Accedi",
        "en-US": "Already have an account? Sign in",
    },
}


async def run():
    tenant = await get_corporate_tenant()
    tid = tenant["id"]
    inserted = 0
    updated = 0

    async with AsyncSessionLocal() as s:
        for block_key, locales in LANDING_KEYS.items():
            # Upsert block
            block_id = (await s.execute(text("""
                INSERT INTO editorial_blocks
                  (id, scope, tenant_id, namespace, block_key, block_type,
                   source_locale, source_value, source_hash, is_active, created_at, updated_at)
                VALUES (gen_random_uuid(), 'tenant', :tid, 'studio_v2.ui', :bk, 'text',
                        'it-IT', :sv, '', true, NOW(), NOW())
                ON CONFLICT (tenant_id, namespace, block_key)
                DO UPDATE SET updated_at = NOW()
                RETURNING id
            """), {"tid": tid, "bk": block_key, "sv": locales.get("it-IT", "")})).scalar_one()

            for locale, value in locales.items():
                result = (await s.execute(text("""
                    INSERT INTO editorial_block_translations
                      (id, block_id, locale, value, status, generated_by,
                       source_hash, locked, created_at, updated_at)
                    VALUES (gen_random_uuid(), :bid, :loc, :val,
                            'manual', 'seed', '', false, NOW(), NOW())
                    ON CONFLICT (block_id, locale)
                    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                    RETURNING (xmax = 0) AS was_insert
                """), {"bid": block_id, "loc": locale, "val": value})).fetchone()
                if result and result[0]:
                    inserted += 1
                else:
                    updated += 1

        await s.commit()

    print(f"✅  studio_v2.ui landing keys: {inserted} inserted, {updated} updated")


if __name__ == "__main__":
    asyncio.run(run())
