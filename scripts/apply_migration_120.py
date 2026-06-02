#!/usr/bin/env python3
"""Applier for migration 120 · Journey Mail Intelligence™ Phase 1."""
from __future__ import annotations
import os, sys, pathlib, psycopg2
from dotenv import load_dotenv

ROOT = pathlib.Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")
MIG = ROOT / "supabase" / "migrations" / "120_iter187a_email_mailboxes.sql"
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
                   AND table_name IN ('email_mailboxes','email_mailbox_cursors',
                                       'email_messages','email_attachments',
                                       'email_links','email_outbound_sent',
                                       'mailbox_member_grants')
                 ORDER BY table_name
            """)
            tables = [r[0] for r in cur.fetchall()]
        conn.commit()
        print(f"✅ Migration 120 applied. Tables: {tables}")
        if len(tables) != 7:
            print(f"⚠️  Expected 7 tables, found {len(tables)}", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}", file=sys.stderr); sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
