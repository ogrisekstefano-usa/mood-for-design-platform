"""
ITER-AccessV2 — Update editorial copy for the expanded access model.

• Adds `site.access.studio_pending.*` (Studio application in review).
• Rewrites `site.access.concierge.cta` from "Scrivici" to
  "Richiedi una presentazione", per the updated business rules.
"""
import asyncio
from sqlalchemy import text

from database import AsyncSessionLocal
from tenant_resolver import get_corporate_tenant


COPY = {
    # ─── concierge CTA rewrite ────────────────────────────────────
    "concierge.headline":        {"it": "Non troviamo ancora uno spazio progettuale associato a questa email."},
    "concierge.body":            {"it": "Il tuo invito potrebbe essere ancora in approvazione. Lo studio MOOD for DESIGN può continuare il percorso insieme a te."},
    "concierge.cta":             {"it": "Richiedi una presentazione"},

    # ─── studio_pending — application in review ───────────────────
    "studio_pending.headline":   {"it": "La tua application è in lettura."},
    "studio_pending.body":       {"it": "Il team curatoriale di MOOD sta leggendo il tuo studio. Riceverai un Magic Link non appena l'ecosistema sarà aperto."},
    "studio_pending.cta":        {"it": "Torna al sito"},
}


async def seed():
    tenant = await get_corporate_tenant()
    tenant_id = tenant["id"]
    NAMESPACE = "site.access"
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
    print(f"site.access (v2) seed: {inserted} new, {updated} refreshed, "
          f"{translations} translations.")


if __name__ == "__main__":
    asyncio.run(seed())
