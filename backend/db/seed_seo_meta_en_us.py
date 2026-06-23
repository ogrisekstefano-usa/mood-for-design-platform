"""
seed_seo_meta_en_us.py
Upsert SEO meta (seo.title, seo.description) per EN-US su tutte le 8 pagine pubbliche.
Idempotente. Run: cd /app/backend && python -m db.seed_seo_meta_en_us
"""
import asyncio
from database import AsyncSessionLocal
from sqlalchemy import text
from tenant_resolver import get_corporate_tenant

# §E copy
SEO_EN: dict[str, dict[str, str]] = {
    "site.home": {
        "seo.title": (
            "MOOD for DESIGN — Editorial OS for interior design studios and architects"
        ),
        "seo.description": (
            "Design Journey™ and Blueprint™: the methodology and editorial infrastructure "
            "for the contemporary design project. For studios, showrooms, and design brands."
        ),
        "seo.h1": "A new way to lead, narrate, and preserve a project.",
    },
    "site.audience": {
        "seo.title": (
            "Who MOOD is for — Studios, architects, showrooms, design brands"
        ),
        "seo.description": (
            "Interior designers, architects, furniture retailers, luxury showrooms, "
            "multi-location organizations, and brands: see how MOOD speaks to each."
        ),
        "seo.h1": (
            "For studios that believe how a project is told matters "
            "as much as the project itself."
        ),
    },
    "site.features": {
        "seo.title": (
            "What Blueprint™ makes possible — Editorial outcomes for your studio"
        ),
        "seo.description": (
            "Memory, continuity, editorial voice, material curation, client conversation, "
            "ecosystem, studio archive. Everything Blueprint™ enables."
        ),
        "seo.h1": "An editorial configuration for the entire project.",
    },
    "site.pricing": {
        "seo.title": "Blueprint™ configurations — How to adopt MOOD for DESIGN",
        "seo.description": (
            "Blueprint™ isn't bought. It's configured. Three steps to entering "
            "the MOOD for DESIGN ecosystem."
        ),
        "seo.h1": "Blueprint™ isn't bought. It's configured.",
    },
    "site.blueprint": {
        "seo.title": "Blueprint™ — The editorial infrastructure for the design project",
        "seo.description": (
            "Blueprint™ coordinates, preserves, and connects the work of the studio. "
            "Not software: the editorial workspace for the contemporary project."
        ),
        "seo.h1": "Blueprint™ is not software. It's where the Journey™ lives.",
    },
    "site.training": {
        "seo.title": "Training — MOOD Academy",
        "seo.description": (
            "Programs, tutorials, live sessions for learning the editorial language "
            "of the contemporary project. Included in every Blueprint™ configuration."
        ),
        "seo.h1": "Learning the editorial craft of the project.",
    },
    "site.faq": {
        "seo.title": "FAQ — Frequently asked questions about MOOD for DESIGN",
        "seo.description": (
            "Answers to the most common questions about Design Journey™, Blueprint™, "
            "configuration, onboarding, and international markets."
        ),
        "seo.h1": "Frequently asked questions about MOOD for DESIGN.",
    },
    "site.about": {
        "seo.title": "About — MOOD for DESIGN and the Design Journey™ methodology",
        "seo.description": (
            "Where Design Journey™ comes from: years of international experience in "
            "the design sector, developed in the United States and refined across "
            "European markets."
        ),
        "seo.h1": "Where Design Journey™ comes from.",
    },
}

# IT fallbacks (update only if value is empty/missing)
SEO_IT_FALLBACK: dict[str, dict[str, str]] = {
    "site.home": {
        "seo.h1": "Un nuovo modo di guidare, narrare e preservare un progetto.",
    },
    "site.audience": {
        "seo.h1": "Per gli studi che credono che il modo di raccontare un progetto valga quanto il progetto stesso.",
    },
    "site.features": {
        "seo.h1": "Una configurazione editoriale per l'intero progetto.",
    },
    "site.pricing": {
        "seo.h1": "Blueprint™ non si acquista. Si configura.",
    },
    "site.training": {
        "seo.h1": "Imparare il mestiere editoriale del progetto.",
    },
    "site.faq": {
        "seo.h1": "Domande frequenti su MOOD for DESIGN.",
    },
    "site.about": {
        "seo.h1": "Da dove viene Design Journey™.",
    },
}


async def upsert_block_translation(
    s, tid: str, namespace: str, block_key: str, locale: str, value: str
):
    block_id = (await s.execute(text("""
        INSERT INTO editorial_blocks
          (id, scope, tenant_id, namespace, block_key, block_type,
           source_locale, source_value, source_hash, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), 'tenant', :tid, :ns, :bk, 'text',
                'it-IT', :sv, '', true, NOW(), NOW())
        ON CONFLICT (tenant_id, namespace, block_key)
        DO UPDATE SET updated_at = NOW()
        RETURNING id
    """), {"tid": tid, "ns": namespace, "bk": block_key, "sv": value})).scalar_one()

    return (await s.execute(text("""
        INSERT INTO editorial_block_translations
          (id, block_id, locale, value, status, generated_by,
           source_hash, locked, created_at, updated_at)
        VALUES (gen_random_uuid(), :bid, :loc, :val,
                'manual', 'seed-seo-phase2', '', false, NOW(), NOW())
        ON CONFLICT (block_id, locale)
        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        RETURNING (xmax = 0) AS was_insert
    """), {"bid": block_id, "loc": locale, "val": value})).fetchone()


async def run():
    tenant = await get_corporate_tenant()
    tid = tenant["id"]
    total_ins = total_upd = 0

    async with AsyncSessionLocal() as s:
        for namespace, keys in SEO_EN.items():
            for block_key, en_val in keys.items():
                result = await upsert_block_translation(
                    s, tid, namespace, block_key, "en-US", en_val
                )
                if result and result[0]: total_ins += 1
                else: total_upd += 1

        # IT h1 fallbacks (only seo.h1 which may not exist)
        for namespace, keys in SEO_IT_FALLBACK.items():
            for block_key, it_val in keys.items():
                await upsert_block_translation(
                    s, tid, namespace, block_key, "it-IT", it_val
                )

        await s.commit()

    print(f"✅  SEO meta EN-US: {total_ins} inserted, {total_upd} updated")


if __name__ == "__main__":
    asyncio.run(run())
