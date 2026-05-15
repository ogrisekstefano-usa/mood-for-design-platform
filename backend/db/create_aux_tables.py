"""
Create corporate-only auxiliary tables (forms persistence) that are NOT part
of the existing Blueprint schema. Idempotent.
"""
import asyncio
import os
import sys
from pathlib import Path
import asyncpg
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / '.env')

DDL = """
-- contact submissions (per tenant)
CREATE TABLE IF NOT EXISTS contact_submissions (
  id            TEXT PRIMARY KEY,
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT,
  email         TEXT,
  company       TEXT,
  inquiry_type  TEXT,
  message       TEXT,
  locale_code   TEXT,
  status        TEXT DEFAULT 'new',
  reference     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contact_tenant ON contact_submissions(tenant_id, created_at DESC);

-- newsletter subscribers (per tenant, unique email)
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id          TEXT PRIMARY KEY,
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  locale_code TEXT,
  status      TEXT DEFAULT 'active',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- studio registrations (onboarding intake)
CREATE TABLE IF NOT EXISTS studio_registrations (
  id           TEXT PRIMARY KEY,
  studio_name  TEXT NOT NULL,
  slug         TEXT NOT NULL,
  email        TEXT NOT NULL,
  first_name   TEXT,
  last_name    TEXT,
  role         TEXT DEFAULT 'studio_owner',
  plan         TEXT DEFAULT 'starter',
  locale_code  TEXT,
  status       TEXT DEFAULT 'provisioning',
  tenant_id    UUID REFERENCES tenants(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_studio_reg_email ON studio_registrations(email);
CREATE INDEX IF NOT EXISTS idx_studio_reg_slug  ON studio_registrations(slug);
"""


async def main():
    conn = await asyncpg.connect(os.environ['SESSION_POOLER_URL'], command_timeout=60)
    try:
        await conn.execute(DDL)
        print("✓ corporate aux tables ready (contact/newsletter/studio_registrations)")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
