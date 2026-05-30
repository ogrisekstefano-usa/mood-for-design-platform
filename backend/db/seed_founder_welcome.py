"""
Tenant Lifecycle — Founder Welcome editorial copy.

Cinematic first-access moment played when a founder lands on /admin/welcome
right after the Magic Link of the Open Studio Ecosystem™. Not a tutorial.
Not a checklist. A short editorial paragraph that says:

   "Il tuo ecosistema è pronto."

Then a single CTA to enter the workspace.
"""
import asyncio
from sqlalchemy import text

from database import AsyncSessionLocal
from tenant_resolver import get_corporate_tenant


COPY = {
    "founder.welcome.eyebrow":  {"it": "Open Studio Ecosystem"},
    "founder.welcome.headline": {"it": "Il tuo ecosistema è pronto."},
    "founder.welcome.sublead":  {"it": "MOOD ha aperto lo spazio del tuo studio. Da qui curi la composizione editoriale, l'identità, le esperienze. Un advisor ti accompagnerà nei prossimi passi."},
    "founder.welcome.tenant.label":   {"it": "Lo studio"},
    "founder.welcome.founder.label":  {"it": "Il founder"},
    "founder.welcome.advisor.label":  {"it": "L'advisor curatoriale"},
    "founder.welcome.modules.label":  {"it": "Le esperienze attivate"},
    "founder.welcome.language.label": {"it": "Lingua principale"},
    "founder.welcome.enter_cta":      {"it": "Entra nello studio"},
    "founder.welcome.signature":      {"it": "Con cura,\\nIl team curatoriale di MOOD"},
}


async def seed():
    tenant = await get_corporate_tenant()
    tenant_id = tenant["id"]
    NAMESPACE = "admin.founder"
    inserted = updated = translations = 0

    async with AsyncSessionLocal() as s:
        for block_key, locales in COPY.items():
            source_value = locales.get("it") or next(iter(locales.values()))
            row = (await s.execute(
                text("""
                    INSERT INTO editorial_blocks
                      (id, scope, tenant_id, namespace, block_key, block_type,
                       source_locale, source_value, source_hash, is_active,
                       created_at, updated_at)
                    VALUES (gen_random_uuid(), 'tenant', :tid, :ns, :bk, 'body',
                            'it', :sv, '', true, NOW(), NOW())
                    ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE
                       SET source_value = EXCLUDED.source_value,
                           updated_at   = NOW()
                    RETURNING id, (xmax = 0) AS inserted
                """),
                {"tid": tenant_id, "ns": NAMESPACE, "bk": block_key, "sv": source_value},
            )).first()
            block_id = row[0]
            if row[1]: inserted += 1
            else:      updated  += 1
            for locale, value in locales.items():
                await s.execute(
                    text("""
                        INSERT INTO editorial_block_translations
                          (id, block_id, locale, value, status, generated_by,
                           source_hash, locked, created_at, updated_at)
                        VALUES (gen_random_uuid(), :bid, :loc, :val, 'manual',
                                'system-seed', '', false, NOW(), NOW())
                        ON CONFLICT (block_id, locale) DO UPDATE
                           SET value = EXCLUDED.value, updated_at = NOW()
                    """),
                    {"bid": block_id, "loc": locale, "val": value},
                )
                translations += 1
        await s.commit()
    print(f"admin.founder welcome seed: {inserted} new, {updated} refreshed.")


if __name__ == "__main__":
    asyncio.run(seed())
