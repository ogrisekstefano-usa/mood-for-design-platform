"""
M2 Data Readiness Validation — Pre-Implementation Gate

Checks Martinel tenant has enough real data to render a meaningful
Relationship Timeline before we invest in M2 code:

  * tenant exists
  * tenant_relationship_owner_user_id assigned
  * >= 3 contacts in tenant_contacts (active)
  * >= 5 activities in relationship_activities
  * v_relationship_timeline returns rows for this tenant
  * unique event type_codes present (timeline diversity)

Exit code:
  0 = READY_FOR_M2_IMPLEMENTATION
  1 = NEEDS_REWORK (data gap)
"""

import asyncio
import os
import sys
import json
from pathlib import Path

# Ensure backend importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]


async def main() -> int:
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        # Locate Martinel tenant
        tenant = await conn.fetchrow(
            """
            SELECT id, slug, name, tenant_relationship_owner_user_id
            FROM tenants
            WHERE slug ILIKE '%martinel%' OR name ILIKE '%martinel%'
            ORDER BY created_at ASC
            LIMIT 1
            """
        )
        if not tenant:
            print("[FAIL] Martinel tenant not found.")
            return 1

        tid = tenant["id"]
        owner_id = tenant["tenant_relationship_owner_user_id"]
        print(f"[OK ] Tenant: {tenant['name']} (slug={tenant['slug']}, id={tid})")

        # Make owner lookup tolerant — users table is in auth schema, drop owner display
        if not owner_id:
            print("[FAIL] tenant_relationship_owner_user_id is NULL")
            owner_ok = False
        else:
            print(f"[OK ] Relationship owner user_id: {owner_id}")
            owner_ok = True

        # Contacts
        contacts = await conn.fetch(
            """
            SELECT id, first_name, last_name, role_code, archived_at
            FROM tenant_contacts
            WHERE tenant_id = $1
            ORDER BY created_at ASC
            """,
            tid,
        )
        active = [c for c in contacts if c["archived_at"] is None]
        archived = [c for c in contacts if c["archived_at"] is not None]
        print(f"[..] Contacts: {len(contacts)} total ({len(active)} active, {len(archived)} archived)")
        for c in contacts[:10]:
            tag = "ARCH" if c["archived_at"] else "ACT "
            name = f"{c['first_name'] or ''} {c['last_name'] or ''}".strip()
            print(f"      - [{tag}] {name} ({c['role_code']})")
        contacts_ok = len(active) >= 3

        # Activities
        activities = await conn.fetch(
            """
            SELECT id, activity_type_code, occurred_at, contact_id
            FROM relationship_activities
            WHERE tenant_id = $1
            ORDER BY occurred_at DESC
            """,
            tid,
        )
        print(f"[..] Activities: {len(activities)} total")
        for a in activities[:10]:
            print(f"      - {a['activity_type_code']:<15} @ {a['occurred_at']}")
        activities_ok = len(activities) >= 5

        # Timeline view
        timeline = await conn.fetch(
            """
            SELECT source, type_code, at
            FROM v_relationship_timeline
            WHERE tenant_id = $1
            ORDER BY at DESC
            """,
            tid,
        )
        by_source = {}
        by_type = {}
        for row in timeline:
            by_source[row["source"]] = by_source.get(row["source"], 0) + 1
            by_type[row["type_code"]] = by_type.get(row["type_code"], 0) + 1
        print(f"[..] Timeline rows: {len(timeline)}")
        print(f"      by source: {by_source}")
        print(f"      distinct type_codes: {len(by_type)}")
        for tc, n in sorted(by_type.items(), key=lambda x: -x[1])[:10]:
            print(f"        - {tc:<28} x{n}")
        timeline_ok = len(timeline) >= 5 and len(by_type) >= 3

        # Summary
        print("\n=== SUMMARY ===")
        checks = {
            "Owner assigned": owner_ok,
            "Active contacts >= 3": contacts_ok,
            "Activities >= 5": activities_ok,
            "Timeline rows >= 5 & type diversity >= 3": timeline_ok,
        }
        all_ok = True
        for label, ok in checks.items():
            mark = "PASS" if ok else "FAIL"
            print(f"  [{mark}] {label}")
            if not ok:
                all_ok = False

        if all_ok:
            print("\n=> READY_FOR_M2_IMPLEMENTATION")
            return 0
        print("\n=> NEEDS_REWORK (data gap — seed/backfill required before M2 code)")
        return 1
    finally:
        await conn.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
