"""Apply migration 059 — Curated References™ tables (Phase F2.1).

Idempotent. Safe to re-run.
"""
import os, sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ.get('DATABASE_URL')
if not DB_URL:
    print("DATABASE_URL not set"); sys.exit(1)

MIG = (Path(__file__).resolve().parent.parent.parent /
       'supabase' / 'migrations' / '059_curated_references.sql')


def main() -> int:
    print(f"Applying {MIG.name} …")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(MIG.read_text())
    print("  ✓ schema ready (curated_collections + saved_references)")
    # Verify
    cur.execute("SELECT to_regclass('public.curated_collections'), to_regclass('public.saved_references')")
    cc, sr = cur.fetchone()
    print(f"  curated_collections → {cc} · saved_references → {sr}")
    cur.close(); conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
