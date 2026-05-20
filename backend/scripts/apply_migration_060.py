"""Apply migration 060 — Client Preview Link™ tables (Sprint F2.4)."""
import os, sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ.get('DATABASE_URL')
if not DB_URL:
    print("DATABASE_URL not set"); sys.exit(1)

MIG = (Path(__file__).resolve().parent.parent.parent /
       'supabase' / 'migrations' / '060_client_preview_links.sql')


def main() -> int:
    print(f"Applying {MIG.name} …")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(MIG.read_text())
    cur.execute("""
      SELECT to_regclass('public.preview_tokens'),
             to_regclass('public.client_preview_feedback'),
             to_regclass('public.client_preview_views')
    """)
    pt, fb, vw = cur.fetchone()
    print(f"  preview_tokens → {pt}")
    print(f"  client_preview_feedback → {fb}")
    print(f"  client_preview_views → {vw}")
    cur.close(); conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
