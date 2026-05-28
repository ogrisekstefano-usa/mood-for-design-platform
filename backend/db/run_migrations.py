"""
Apply pending SQL migrations from /app/backend/db/migrations/ to Supabase.
Idempotent — skips files already in schema_migrations.
"""
import asyncio, os, sys
from pathlib import Path
import asyncpg
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / '.env')
MIG_DIR = Path(__file__).parent / 'migrations'


async def main():
    conn = await asyncpg.connect(os.environ['SESSION_POOLER_URL'], command_timeout=120)
    try:
        applied = {r['version'] for r in await conn.fetch("SELECT version FROM schema_migrations")}
        files = sorted(MIG_DIR.glob('*.sql'))
        if not files:
            print("No migration files found")
            return
        for f in files:
            if f.name in applied:
                print(f"  ↩ {f.name} already applied — skipped")
                continue
            print(f"  → applying {f.name} ...")
            sql = f.read_text()
            try:
                async with conn.transaction():
                    await conn.execute(sql)
                    await conn.execute(
                        "INSERT INTO schema_migrations (version) VALUES ($1) "
                        "ON CONFLICT (version) DO NOTHING",
                        f.name,
                    )
                print(f"  ✓ {f.name} applied")
            except Exception as e:
                print(f"  ✗ {f.name} FAILED: {e}")
                raise
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
