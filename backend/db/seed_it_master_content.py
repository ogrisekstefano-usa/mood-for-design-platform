"""
seed_it_master_content.py
─────────────────────────────────────────────────────────────────────────────
Phase 3 — Task 2: Surgical UPDATE of IT copy (source_value + it-IT translation)
for site.home, site.features, site.pricing.

Rules:
  • Forbidden words removed: piattaforma, software, utenti (as per lexical rules)
  • Only updates `source_value` (editorial_blocks) + it-IT (editorial_block_translations)
  • EN-US translations are NOT touched (they live in editorial_block_translations only)
  • Idempotente (ON CONFLICT DO UPDATE)

Run: cd /app/backend && python -m db.seed_it_master_content
"""
import asyncio
import hashlib
import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

import asyncpg
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')

CORP_SLUG = os.environ.get('CORPORATE_TENANT_SLUG', 'studio')


# ── Corrections: (namespace, block_key, new_it_value) ─────────────────────
# Each entry: UPDATE editorial_blocks.source_value AND editorial_block_translations
#             WHERE locale='it-IT' for the given block.
# Values are the definitive IT master copy — no forbidden words.

CORRECTIONS = [
    # ── site.home ──────────────────────────────────────────────────────────
    (
        'site.home', 'hero.subtitle_accent',
        'Un ecosistema editoriale per studi, showroom e clienti del design contemporaneo.',
    ),

    # ── site.pricing — comparison table (old-format: underscore keys) ─────
    (
        'site.pricing', 'comparison.row_01_label',
        # "Utenti inclusi" → neutral / non-branded
        'Accessi inclusi',
    ),

    # ── site.pricing — comparison table (new-format: dot keys) ─────────────
    (
        'site.pricing', 'comparison.row_01.label',
        # "Piattaforma Blueprint completa" → feature-neutral
        'Blueprint completo',
    ),
    (
        'site.pricing', 'comparison.row_13.label',
        # "Aggiornamenti piattaforma" → brand-neutral
        'Aggiornamenti Blueprint',
    ),

    # ── site.pricing — ecosystem section ──────────────────────────────────
    (
        'site.pricing', 'ecosystem.eyebrow',
        # "Più di un software" → editorial register
        "Più di un'infrastruttura",
    ),
    (
        'site.pricing', 'ecosystem.headline',
        # "Blueprint è una piattaforma più un metodo." → editorial register
        'Blueprint è un metodo editoriale. E un ecosistema.',
    ),

    # ── site.pricing — tier bodies ─────────────────────────────────────────
    (
        'site.pricing', 'tier_01.body',
        # "Tutta la piattaforma Blueprint..." → remove "piattaforma"
        "L'intero ecosistema Blueprint per la gestione del lavoro quotidiano. "
        'Onboarding guidato, supporto email, formazione iniziale.',
    ),
]


# ── Helpers ────────────────────────────────────────────────────────────────
async def update_block(conn, tenant_id, namespace, block_key, new_value):
    # 1. Fetch block id
    row = await conn.fetchrow(
        """
        SELECT id FROM editorial_blocks
        WHERE tenant_id = $1 AND namespace = $2 AND block_key = $3
        """,
        tenant_id, namespace, block_key,
    )
    if not row:
        print(f"  ⚠ NOT FOUND: {namespace}.{block_key}")
        return False

    block_id = row['id']
    new_hash  = hashlib.sha256(new_value.encode('utf-8')).hexdigest()

    # 2. Update source_value (the IT master)
    await conn.execute(
        """
        UPDATE editorial_blocks
           SET source_value = $1,
               source_hash  = $2,
               updated_at   = NOW()
         WHERE id = $3
        """,
        new_value, new_hash, block_id,
    )

    # 3. Upsert the it-IT translation row
    await conn.execute(
        """
        INSERT INTO editorial_block_translations
          (id, block_id, locale, value, status, generated_by,
           source_hash, locked, created_at, updated_at)
        VALUES
          (gen_random_uuid(), $1, 'it-IT', $2, 'manual', 'seed-it-master',
           $3, false, NOW(), NOW())
        ON CONFLICT (block_id, locale) DO UPDATE
          SET value       = EXCLUDED.value,
              status      = 'manual',
              generated_by = 'seed-it-master',
              source_hash  = EXCLUDED.source_hash,
              updated_at   = NOW()
        """,
        block_id, new_value, new_hash,
    )
    return True


# ── Main ──────────────────────────────────────────────────────────────────
async def main():
    db_url = os.environ['DATABASE_URL']
    conn   = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        tenant = await conn.fetchrow("SELECT id FROM tenants WHERE slug = $1", CORP_SLUG)
        if not tenant:
            raise SystemExit(f"Tenant '{CORP_SLUG}' not found")
        tid = tenant['id']
        print(f"→ Tenant: {CORP_SLUG} ({tid})")

        ok = 0
        for ns, bk, val in CORRECTIONS:
            updated = await update_block(conn, tid, ns, bk, val)
            if updated:
                ok += 1
                print(f"  ✓ {ns}.{bk}")

        print(f"\n✅  IT master content: {ok}/{len(CORRECTIONS)} blocks updated")
        print("\n── Post-update audit ─────────────────────────────────────────────")

        # Quick verification: no more forbidden words in site.home / site.pricing / site.features
        for word in ['piattaforma', 'software', 'utenti inclusi']:
            hits = await conn.fetch(
                """
                SELECT eb.namespace, eb.block_key, ebt.value
                FROM editorial_blocks eb
                JOIN editorial_block_translations ebt ON ebt.block_id = eb.id
                WHERE eb.tenant_id = $1
                  AND eb.namespace IN ('site.home', 'site.features', 'site.pricing')
                  AND ebt.locale = 'it-IT'
                  AND ebt.value ILIKE $2
                """,
                tid, f'%{word}%',
            )
            if hits:
                print(f"  ❌ STILL FOUND '{word}': {len(hits)} blocks")
                for h in hits[:3]:
                    print(f"     {h['namespace']}.{h['block_key']}: {h['value'][:60]}")
            else:
                print(f"  ✓ '{word}' — zero occurrences in home/features/pricing IT")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
