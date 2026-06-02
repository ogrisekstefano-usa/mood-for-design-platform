#!/usr/bin/env python3
"""Apply migration 122 — extraction_jobs table."""
from __future__ import annotations
import os, sys, pathlib, psycopg2
from dotenv import load_dotenv

ROOT = pathlib.Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")
SQL_PATH = ROOT / "supabase" / "migrations" / "122_iter197_extraction_jobs.sql"
DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("ERROR: DATABASE_URL missing", file=sys.stderr); sys.exit(2)


def main():
    sql = SQL_PATH.read_text(encoding="utf-8")
    conn = psycopg2.connect(DB_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            cur.execute("SELECT to_regclass('public.extraction_jobs')")
            row = cur.fetchone()
        conn.commit()
        print(f"✅ Migration 122 applied. extraction_jobs table: {row}")
    except Exception as e:
        conn.rollback()
        print(f"❌ {e}", file=sys.stderr); sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
