"""
seed_pricing_en_us.py
─────────────────────────────────────────────────────────────────────────────
Phase 3 — Task 2: Seed the 84 missing EN-US translations for site.pricing.

Covers:
  • comparison.row_01-12  (label + v01-v04 each → 60 blocks, rows 10-12 empty)
  • ecosystem.cta_label + pillar_01-03 title/body  (7 blocks)
  • tier_04.inc_1-5  (5 blocks, empty)
  • tier_05.*  (13 blocks, empty — tier_05 is a future tier placeholder)

Idempotente. Run: cd /app/backend && python -m db.seed_pricing_en_us
"""
import asyncio
from database import AsyncSessionLocal
from sqlalchemy import text
from tenant_resolver import get_corporate_tenant


# ── Comparison table rows ──────────────────────────────────────────────────
# Old-format blocks (row_NN_label / row_NN_v0X)
COMPARISON_EN: dict[str, str] = {
    # Row 01 — Users
    "comparison.row_01_label": "Users included",
    "comparison.row_01_v01":   "1",
    "comparison.row_01_v02":   "Up to 5",
    "comparison.row_01_v03":   "Up to 15",
    "comparison.row_01_v04":   "Unlimited",
    # Row 02 — Moodboards
    "comparison.row_02_label": "Unlimited moodboards",
    "comparison.row_02_v01":   "✓",
    "comparison.row_02_v02":   "✓",
    "comparison.row_02_v03":   "✓",
    "comparison.row_02_v04":   "✓",
    # Row 03 — Media library
    "comparison.row_03_label": "Media library",
    "comparison.row_03_v01":   "10 GB",
    "comparison.row_03_v02":   "100 GB",
    "comparison.row_03_v03":   "500 GB",
    "comparison.row_03_v04":   "Unlimited",
    # Row 04 — Design Journey™
    "comparison.row_04_label": "Design Journey™",
    "comparison.row_04_v01":   "—",
    "comparison.row_04_v02":   "—",
    "comparison.row_04_v03":   "✓",
    "comparison.row_04_v04":   "✓",
    # Row 05 — Client Portal
    "comparison.row_05_label": "Client Portal",
    "comparison.row_05_v01":   "✓",
    "comparison.row_05_v02":   "✓",
    "comparison.row_05_v03":   "✓",
    "comparison.row_05_v04":   "✓",
    # Row 06 — Advanced analytics
    "comparison.row_06_label": "Advanced analytics",
    "comparison.row_06_v01":   "—",
    "comparison.row_06_v02":   "—",
    "comparison.row_06_v03":   "✓",
    "comparison.row_06_v04":   "✓",
    # Row 07 — Integrations
    "comparison.row_07_label": "Integrations",
    "comparison.row_07_v01":   "—",
    "comparison.row_07_v02":   "—",
    "comparison.row_07_v03":   "✓",
    "comparison.row_07_v04":   "✓",
    # Row 08 — Support
    "comparison.row_08_label": "Support",
    "comparison.row_08_v01":   "Email",
    "comparison.row_08_v02":   "Priority",
    "comparison.row_08_v03":   "Priority",
    "comparison.row_08_v04":   "Dedicated",
    # Row 09 — Included training
    "comparison.row_09_label": "Included training",
    "comparison.row_09_v01":   "—",
    "comparison.row_09_v02":   "✓",
    "comparison.row_09_v03":   "✓",
    "comparison.row_09_v04":   "✓",
    # Rows 10-12 — empty in IT too; keep empty for EN-US
    "comparison.row_10_label": "",
    "comparison.row_10_v01":   "",
    "comparison.row_10_v02":   "",
    "comparison.row_10_v03":   "",
    "comparison.row_10_v04":   "",
    "comparison.row_11_label": "",
    "comparison.row_11_v01":   "",
    "comparison.row_11_v02":   "",
    "comparison.row_11_v03":   "",
    "comparison.row_11_v04":   "",
    "comparison.row_12_label": "",
    "comparison.row_12_v01":   "",
    "comparison.row_12_v02":   "",
    "comparison.row_12_v03":   "",
    "comparison.row_12_v04":   "",
}


# ── Ecosystem note pillars ─────────────────────────────────────────────────
ECOSYSTEM_EN: dict[str, str] = {
    "ecosystem.cta_label":       "Explore support",
    "ecosystem.pillar_01_title": "Curated onboarding",
    "ecosystem.pillar_01_body":  (
        "A guided onboarding journey: importing your existing projects, "
        "configuring your workspace, and calibrating your editorial voice "
        "together with our editorial team."
    ),
    "ecosystem.pillar_02_title": "Continuous learning",
    "ecosystem.pillar_02_body":  (
        "A library of live sessions, monthly masterclasses, and exclusive "
        "content to sharpen your editorial use of Blueprint™ and stay aligned "
        "with new sections of the magazine."
    ),
    "ecosystem.pillar_03_title": "Dedicated team",
    "ecosystem.pillar_03_body":  (
        "A human point of reference — not a ticket. From Blueprint Practice "
        "onwards, a person who knows you, follows you, and accompanies you "
        "through the decisive moments of your project."
    ),
}


# ── Tier 04 inclusions (empty in IT; mirror as empty EN-US) ───────────────
TIER_04_EN: dict[str, str] = {
    "tier_04.inc_1": "",
    "tier_04.inc_2": "",
    "tier_04.inc_3": "",
    "tier_04.inc_4": "",
    "tier_04.inc_5": "",
}


# ── Tier 05 — future tier placeholder (empty) ────────────────────────────
TIER_05_EN: dict[str, str] = {
    "tier_05.eyebrow":        "",
    "tier_05.title":          "",
    "tier_05.subtitle":       "",
    "tier_05.body":           "",
    "tier_05.price":          "",
    "tier_05.price_caption":  "",
    "tier_05.cta":            "",
    "tier_05.inc_1":          "",
    "tier_05.inc_2":          "",
    "tier_05.inc_3":          "",
    "tier_05.inc_4":          "",
    "tier_05.inc_5":          "",
}


ALL_BLOCKS: dict[str, str] = {
    **COMPARISON_EN,
    **ECOSYSTEM_EN,
    **TIER_04_EN,
    **TIER_05_EN,
}


# ── Helpers ───────────────────────────────────────────────────────────────
async def upsert_translation(s, block_id: str, locale: str, value: str) -> bool:
    result = (await s.execute(text("""
        INSERT INTO editorial_block_translations
          (id, block_id, locale, value, status, generated_by,
           source_hash, locked, created_at, updated_at)
        VALUES (gen_random_uuid(), :bid, :loc, :val,
                'manual', 'seed-pricing-en-us', '', false, NOW(), NOW())
        ON CONFLICT (block_id, locale)
        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        RETURNING (xmax = 0) AS was_insert
    """), {"bid": block_id, "loc": locale, "val": value})).fetchone()
    return bool(result and result[0])


async def get_block_id(s, tid: str, namespace: str, block_key: str) -> str | None:
    row = (await s.execute(text("""
        SELECT id FROM editorial_blocks
        WHERE tenant_id = :tid AND namespace = :ns AND block_key = :bk
    """), {"tid": tid, "ns": namespace, "bk": block_key})).fetchone()
    return str(row[0]) if row else None


# ── Main ──────────────────────────────────────────────────────────────────
async def run():
    tenant = await get_corporate_tenant()
    tid = tenant["id"]
    ins = upd = skipped = 0

    async with AsyncSessionLocal() as s:
        for full_key, en_value in ALL_BLOCKS.items():
            # full_key is like "comparison.row_01_label" — split off namespace
            # All belong to site.pricing namespace; block_key is the full_key as stored
            block_id = await get_block_id(s, tid, "site.pricing", full_key)
            if block_id is None:
                skipped += 1
                print(f"  ⚠ block not found: site.pricing / {full_key}")
                continue
            was_insert = await upsert_translation(s, block_id, "en-US", en_value)
            if was_insert:
                ins += 1
            else:
                upd += 1

        await s.commit()

    print(f"\n✅  site.pricing EN-US: {ins} inserted, {upd} updated, {skipped} skipped (not found)")


if __name__ == "__main__":
    asyncio.run(run())
