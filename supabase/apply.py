#!/usr/bin/env python3
"""
Migration runner — applies pending /app/supabase/migrations/*.sql files.

Each migration runs inside a single transaction. On success, its filename is
recorded in `public.schema_migrations`. On failure, the transaction rolls back
and the runner exits with code 1.

Usage:
    python3 /app/supabase/apply.py             # apply all pending
    python3 /app/supabase/apply.py --list      # list applied/pending
    python3 /app/supabase/apply.py --dry-run   # show what would run
"""
import os
import sys
import argparse
import pathlib
import psycopg2
from dotenv import load_dotenv

ROOT = pathlib.Path(__file__).resolve().parent
MIG_DIR = ROOT / "migrations"
load_dotenv(ROOT.parent / "backend" / ".env")

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("ERROR: DATABASE_URL missing from /app/backend/.env", file=sys.stderr)
    sys.exit(2)


def connect():
    return psycopg2.connect(DB_URL)


def ensure_schema_migrations(conn):
    """Bootstrap the tracking table itself."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS public.schema_migrations (
                version    TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ DEFAULT now()
            );
        """)
    conn.commit()


def applied_versions(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT version FROM public.schema_migrations ORDER BY version")
        return {r[0] for r in cur.fetchall()}


def pending_files():
    return sorted(
        f for f in MIG_DIR.glob("*.sql")
        if f.stem != "001_baseline_2026_05_13"  # baseline is documentation-only
    )


def apply_one(conn, file_path):
    sql = file_path.read_text()
    with conn.cursor() as cur:
        cur.execute(sql)
        cur.execute(
            "INSERT INTO public.schema_migrations (version) VALUES (%s)",
            (file_path.name,),
        )
    conn.commit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--list", action="store_true", help="list applied/pending")
    parser.add_argument("--dry-run", action="store_true", help="show what would run")
    args = parser.parse_args()

    conn = connect()
    ensure_schema_migrations(conn)
    applied = applied_versions(conn)
    all_files = pending_files()

    if args.list:
        for f in all_files:
            mark = "✓" if f.name in applied else " "
            print(f"  [{mark}] {f.name}")
        return

    pending = [f for f in all_files if f.name not in applied]
    if not pending:
        print("Nothing to apply. Schema is up to date.")
        return

    print(f"Applying {len(pending)} migration(s):")
    for f in pending:
        print(f"  → {f.name}")
        if args.dry_run:
            continue
        try:
            apply_one(conn, f)
            print(f"    ✓ applied")
        except Exception as e:
            conn.rollback()
            print(f"    ✗ FAILED: {e}")
            sys.exit(1)

    if args.dry_run:
        print("(dry run, no changes committed)")


if __name__ == "__main__":
    main()
