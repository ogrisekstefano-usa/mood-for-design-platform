#!/usr/bin/env python3
"""Standalone applier for migration 116 (Brand Knowledge Factory Phase 1).

Idempotent — re-running is safe (all DDL uses CREATE IF NOT EXISTS).
Bypasses the global apply.py runner because earlier seed-style migrations
have non-idempotent UPDATEs that re-fail on cold DBs.
"""
from __future__ import annotations

import os
import sys
import pathlib
import psycopg2
from dotenv import load_dotenv

ROOT = pathlib.Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")
MIG_FILE = ROOT / "supabase" / "migrations" / "116_brand_knowledge_factory_phase1.sql"

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("ERROR: DATABASE_URL missing", file=sys.stderr)
    sys.exit(2)

def main():
    sql = MIG_FILE.read_text(encoding="utf-8")
    conn = psycopg2.connect(DB_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            # Verify tables exist
            cur.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema='public'
                  AND table_name IN ('source_documents','product_sections','products','product_assets')
                ORDER BY table_name
            """)
            tables = [r[0] for r in cur.fetchall()]
            # Mark in schema_migrations
            cur.execute("""
                CREATE TABLE IF NOT EXISTS public.schema_migrations (
                    version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now()
                );
                INSERT INTO public.schema_migrations(version) VALUES ('116_brand_knowledge_factory_phase1.sql')
                ON CONFLICT (version) DO NOTHING;
            """)
        conn.commit()
        print("✅ Migration 116 applied successfully.")
        print(f"   Tables present: {tables}")
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
