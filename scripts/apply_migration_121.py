#!/usr/bin/env python3
"""Apply migration 121 · Journey Mail Workspace sidebar module."""
from __future__ import annotations
import os, sys, pathlib, psycopg2
from dotenv import load_dotenv

ROOT = pathlib.Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")
SQL_PATH = ROOT / "supabase" / "migrations" / "121_iter187b_journey_mail_module.sql"
DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("ERROR: DATABASE_URL missing", file=sys.stderr); sys.exit(2)


def main():
    sql = SQL_PATH.read_text(encoding="utf-8")
    conn = psycopg2.connect(DB_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            cur.execute("SELECT code, nav_group, nav_route FROM feature_modules_registry WHERE code='journey_mail_workspace'")
            row = cur.fetchone()
        conn.commit()
        print(f"✅ Migration 121 applied. Module row: {row}")
    except Exception as e:
        conn.rollback()
        print(f"❌ {e}", file=sys.stderr); sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
