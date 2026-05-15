"""
Apply schema.sql to Supabase via Session Pooler.
Run: python /app/backend/db/apply_schema.py
Idempotent — safe to run multiple times.
"""
import asyncio, os
from pathlib import Path
import asyncpg
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / '.env')


async def apply():
    url = os.environ['SESSION_POOLER_URL']
    schema_path = Path(__file__).parent / 'schema.sql'
    sql = schema_path.read_text()

    conn = await asyncpg.connect(url, command_timeout=60)
    try:
        # Execute as a single script — preserves PL/pgSQL DO blocks.
        await conn.execute(sql)
        print("✓ schema.sql applied successfully")

        tables = await conn.fetch("""
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
        """)
        print(f"✓ {len(tables)} tables in public schema:")
        for t in tables:
            print(f"   - {t['tablename']}")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(apply())
