"""
Apply migration 028_studio_v2_catalog.sql against the configured DB.
"""
import asyncio, os, sys
sys.path.insert(0, '/app/backend')
from sqlalchemy import text
from database import AsyncSessionLocal

SQL_PATH = '/app/backend/db/migrations/028_studio_v2_catalog.sql'


async def main():
    sql = open(SQL_PATH).read()
    async with AsyncSessionLocal() as s:
        # Run each statement separately so partial failures are visible
        for stmt in [s.strip() for s in sql.split(';') if s.strip()]:
            try:
                await s.execute(text(stmt))
            except Exception as e:
                print(f"WARN: {e}\n  stmt={stmt[:120]}")
        await s.commit()
    # Verify
    async with AsyncSessionLocal() as s:
        r1 = (await s.execute(text(
            "SELECT code, display_order, icon_key FROM studio_archetypes_v2 ORDER BY display_order"
        ))).mappings().all()
        r2 = (await s.execute(text(
            "SELECT code, maps_to_experience FROM studio_help_topics ORDER BY display_order"
        ))).mappings().all()
        r3 = (await s.execute(text(
            "SELECT COUNT(*) FROM markets WHERE dial_code IS NOT NULL"
        ))).scalar()
        print(f"archetypes: {len(r1)}")
        for r in r1: print(" •", dict(r))
        print(f"help_topics: {len(r2)}")
        for r in r2: print(" •", dict(r))
        print(f"markets with dial_code: {r3}")


if __name__ == '__main__':
    asyncio.run(main())
