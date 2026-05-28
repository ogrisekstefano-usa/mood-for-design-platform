"""
ITER160 — Seed editorial copy for Movements I (Entrance) + II (Practice).

Namespaces:
  studio.activation.entrance.*
  studio.activation.practice.*
  studio.activation.archetype.<key>.title|body

Tone: editorial / architectural / hospitality. Italian-first authored,
EN/FR/DE/ES intentionally left empty here — the locale switcher is
hidden until manual editorial review of the translations is complete
(per user direction).
"""
import asyncio
from sqlalchemy import text

from database import AsyncSessionLocal
from tenant_resolver import get_corporate_tenant


COPY = {
    # ────────────────────────── Movement I — Entrance
    "entrance.eyebrow": {
        "it": "Composizione",
    },
    "entrance.headline": {
        "it": "Apri un nuovo capitolo del tuo studio.",
    },
    "entrance.sublead": {
        "it": "MOOD for DESIGN compone lo spazio operativo delle pratiche che modellano l'interior contemporaneo.",
    },
    "entrance.cta": {
        "it": "Inizia la composizione",
    },
    "entrance.return_link": {
        "it": "Sei già dentro MOOD?",
    },
    "entrance.return_destination": {
        "it": "Continua il tuo Design Journey",
    },

    # ────────────────────────── Movement II — Practice
    "practice.eyebrow": {
        "it": "Movimento secondo",
    },
    "practice.headline": {
        "it": "Da quale pratica entri in MOOD?",
    },
    "practice.sublead": {
        "it": "Ogni pratica compone in modo diverso. Da qui prepariamo il tuo ecosistema editoriale.",
    },
    "practice.confirm_line": {
        "it": "Entri in MOOD come {practice}.",
    },
    "practice.continue_cta": {
        "it": "Continua",
    },
    "practice.fallback_line": {
        "it": "La tua pratica vive altrove?",
    },
    "practice.fallback_link": {
        "it": "Componiamola insieme",
    },

    # ────────────────────────── Archetypes (6)
    "archetype.interior_studio.title": {
        "it": "Studio di Interior Design",
    },
    "archetype.interior_studio.body": {
        "it": "Pratiche che compongono ambienti residenziali e dell'ospitalità con sguardo autoriale.",
    },
    "archetype.luxury_showroom.title": {
        "it": "Showroom Luxury",
    },
    "archetype.luxury_showroom.body": {
        "it": "Spazi in cui materiali, marchi e clienti si incontrano in un dialogo curato.",
    },
    "archetype.architecture_firm.title": {
        "it": "Studio di Architettura",
    },
    "archetype.architecture_firm.body": {
        "it": "Pratiche che disegnano l'involucro architettonico e i suoi interni come una sola materia.",
    },
    "archetype.material_gallery.title": {
        "it": "Galleria di Materiali",
    },
    "archetype.material_gallery.body": {
        "it": "Curatori di finiture, superfici e materiali che portano una memoria progettuale.",
    },
    "archetype.design_retail.title": {
        "it": "Design Retail",
    },
    "archetype.design_retail.body": {
        "it": "Selezionatori che portano oggetti d'autore a un pubblico esigente e contemporaneo.",
    },
    "archetype.stone_specialist.title": {
        "it": "Specialisti della Pietra",
    },
    "archetype.stone_specialist.body": {
        "it": "Custodi della pietra naturale — dalla cava all'interno progettato.",
    },
}


async def seed():
    tenant = await get_corporate_tenant()
    tenant_id = tenant["id"]
    inserted = 0
    updated  = 0
    translations = 0
    NAMESPACE = "studio.activation"
    async with AsyncSessionLocal() as s:
        # Wipe any prior incorrectly-namespaced rows from earlier seed runs.
        await s.execute(
            text("DELETE FROM editorial_blocks "
                 "WHERE tenant_id = :tid "
                 "  AND namespace LIKE 'studio.activation.%'"),
            {"tid": tenant_id},
        )
        for sub_key, locales in COPY.items():
            # The resolver treats the FIRST two dot-segments as the namespace.
            # Everything that follows is the block_key. So for sub_key
            # 'archetype.interior_studio.title' we store it as
            #   namespace = 'studio.activation'
            #   block_key = 'archetype.interior_studio.title'
            block_key = sub_key
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
            if row[1]:
                inserted += 1
            else:
                updated += 1
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
    print(f"studio.activation seed (Movements I + II): "
          f"{inserted} new blocks, {updated} refreshed, {translations} translations.")


if __name__ == "__main__":
    asyncio.run(seed())
