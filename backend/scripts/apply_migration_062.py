"""Apply migration 062 — Milestone Dialogue (Sprint F.B)."""
import os, sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ.get('DATABASE_URL')
if not DB_URL: print("DATABASE_URL not set"); sys.exit(1)

MIG = (Path(__file__).resolve().parent.parent.parent /
       'supabase' / 'migrations' / '062_milestone_dialogue.sql')

def main() -> int:
    print(f"Applying {MIG.name} …")
    conn = psycopg2.connect(DB_URL); conn.autocommit = True
    cur = conn.cursor()
    cur.execute(MIG.read_text())
    cur.execute("""SELECT to_regclass('public.milestone_versions'),
                          to_regclass('public.milestone_feedback')""")
    v, f = cur.fetchone()
    print(f"  milestone_versions → {v}")
    print(f"  milestone_feedback → {f}")
    cur.close(); conn.close()
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
