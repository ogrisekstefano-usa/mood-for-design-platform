#!/usr/bin/env python3
"""Applier for migration 117 · Founding Brands Program™ Phase 1."""
from __future__ import annotations
import os, sys, pathlib, psycopg2
from dotenv import load_dotenv

ROOT = pathlib.Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")
MIG = ROOT / "supabase" / "migrations" / "117_iter192_brand_import_sessions.sql"

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("ERROR: DATABASE_URL missing", file=sys.stderr); sys.exit(2)

def main():
    sql = MIG.read_text(encoding="utf-8")
    conn = psycopg2.connect(DB_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            cur.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema='public'
                  AND table_name IN ('brand_import_sessions','materials_canonical',
                                     'designers_canonical','collections_canonical',
                                     'stories_canonical','vision_cache')
                ORDER BY table_name
            """)
            tables = [r[0] for r in cur.fetchall()]
            cur.execute("""
                CREATE TABLE IF NOT EXISTS public.schema_migrations (
                    version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now()
                );
                INSERT INTO public.schema_migrations(version)
                VALUES ('117_iter192_brand_import_sessions.sql')
                ON CONFLICT (version) DO NOTHING;
            """)
        conn.commit()
        print(f"✅ Migration 117 applied. Tables: {tables}")
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}", file=sys.stderr); sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
