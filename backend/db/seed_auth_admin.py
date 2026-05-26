"""Seed the first admin user for tenant 'studio'."""
import asyncio, os, sys, bcrypt
from pathlib import Path
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))
import asyncpg
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')


async def main():
    email = os.environ.get('ADMIN_EMAIL', 'admin@moodfordesign.com').strip().lower()
    pwd   = os.environ.get('ADMIN_PASSWORD', 'MoodAdmin2026!')
    slug  = os.environ.get('CORPORATE_TENANT_SLUG', 'studio')

    conn = await asyncpg.connect(os.environ['DATABASE_URL'], statement_cache_size=0)
    try:
        t = await conn.fetchrow("SELECT id FROM tenants WHERE slug=$1", slug)
        if not t:
            raise SystemExit(f"tenant '{slug}' not found")
        tid = t['id']

        existing = await conn.fetchrow(
            "SELECT id, password_hash FROM users WHERE tenant_id=$1 AND lower(email)=$2",
            tid, email,
        )
        hashed = bcrypt.hashpw(pwd.encode(), bcrypt.gensalt(rounds=12)).decode()
        if existing is None:
            await conn.execute(
                """INSERT INTO users (tenant_id, email, password_hash, full_name, role, is_active)
                   VALUES ($1, $2, $3, 'MOOD Admin', 'admin', TRUE)""",
                tid, email, hashed,
            )
            print(f"  ✓ admin user created: {email} @ tenant '{slug}'")
        else:
            # Update password if env value has changed
            if not bcrypt.checkpw(pwd.encode(), existing['password_hash'].encode()):
                await conn.execute(
                    "UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2",
                    hashed, existing['id'],
                )
                print(f"  ✓ admin password updated for: {email}")
            else:
                print(f"  • admin already up to date: {email}")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
