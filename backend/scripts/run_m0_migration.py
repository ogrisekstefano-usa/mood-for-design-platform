"""M0 runner — Relationship OS Foundation.

Esegue, in ordine:
  1. db/migrations/031_relationship_os_foundation.sql
  2. seed_relationship_event_types.py
  3. seed_contact_roles.py
  4. seed_activity_types.py
  5. seed_contact_sources.py
  6. ADD CONSTRAINT FK studio_relationship_events.event_type_code (dopo seed)
  7. Backfill event_type_code da kind storici (best-effort, fallback NULL)

Idempotent: re-run safe.
Usage: python3 backend/scripts/run_m0_migration.py
"""
from __future__ import annotations
import asyncio, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import AsyncSessionLocal
from sqlalchemy import text


MIGRATION_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "db", "migrations", "031_relationship_os_foundation.sql",
)

# Map storico `studio_relationship_events.kind` → new `event_type_code`.
# Best-effort: kind sconosciuti restano NULL (visibili in audit).
KIND_TO_CODE: dict[str, str] = {
    "relation_opened":           "relation_opened",
    "studio_request_submitted":  "studio_request_submitted",
    "status_changed":            "status_changed",
    "temperature_changed":       "temperature_changed",
    "ownership_changed":         "ownership_changed",
    "qualification_done":        "qualification_done",
    "activated":                 "activated",
    "archived":                  "archived",
    "note_added":                "note_added",
    "visit_recorded":            "visit_recorded",
    "presentation_scheduled":    "presentation_scheduled",
    "presentation_delivered":    "presentation_delivered",
    "ecosystem_aligned":         "ecosystem_aligned",
    # legacy aliases
    "lead_qualified":            "qualification_done",
    "tenant_activated":          "activated",
}


async def run_migration_file() -> None:
    print(f"[M0] applying {MIGRATION_PATH}")
    with open(MIGRATION_PATH, "r") as f:
        sql = f.read()
    # Strip the file-level BEGIN/COMMIT — we want SQLAlchemy to manage tx.
    # The DDL itself is auto-committed in PG; we just need a single connection
    # to run the multi-statement script via asyncpg's simple query protocol.
    sql_stripped = sql.replace("BEGIN;", "").replace("COMMIT;", "")
    async with AsyncSessionLocal() as s:
        raw_conn = await s.connection()
        # Get the underlying asyncpg connection
        asyncpg_conn = await raw_conn.get_raw_connection()
        await asyncpg_conn.driver_connection.execute(sql_stripped)
        await s.commit()
    print("[M0] migration applied OK")


async def run_seed(name: str) -> int:
    print(f"[M0] seeding {name} ...")
    mod = __import__(f"scripts.{name}", fromlist=["main"])
    return await mod.main()


async def add_event_type_fk_and_backfill() -> None:
    """After seeds exist, attach FK on studio_relationship_events.event_type_code
    (only if not already attached) and backfill from historical `kind`."""
    async with AsyncSessionLocal() as s:
        # Backfill (best-effort)
        cnt = 0
        for kind, code in KIND_TO_CODE.items():
            r = await s.execute(text("""
                UPDATE studio_relationship_events
                   SET event_type_code = :code
                 WHERE kind = :kind
                   AND event_type_code IS NULL
            """), {"kind": kind, "code": code})
            cnt += r.rowcount or 0
        await s.commit()
        print(f"[M0] backfilled event_type_code on {cnt} historical rows")

        # Attach FK if not already there
        exists = (await s.execute(text("""
            SELECT 1
              FROM information_schema.table_constraints
             WHERE table_name = 'studio_relationship_events'
               AND constraint_name = 'fk_sre_event_type_code'
        """))).scalar()
        if not exists:
            await s.execute(text("""
                ALTER TABLE studio_relationship_events
                  ADD CONSTRAINT fk_sre_event_type_code
                  FOREIGN KEY (event_type_code)
                  REFERENCES platform_relationship_event_types(code)
                  DEFERRABLE INITIALLY DEFERRED
            """))
            await s.commit()
            print("[M0] FK fk_sre_event_type_code added")
        else:
            print("[M0] FK fk_sre_event_type_code already present")


async def main() -> int:
    t0 = time.time()
    await run_migration_file()

    seeds = [
        "seed_relationship_event_types",
        "seed_contact_roles",
        "seed_activity_types",
        "seed_contact_sources",
    ]
    for s in seeds:
        rc = await run_seed(s)
        if rc != 0:
            print(f"[M0] FATAL: seed {s} returned {rc}")
            return rc

    await add_event_type_fk_and_backfill()
    print(f"[M0] DONE in {time.time()-t0:.2f}s")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
