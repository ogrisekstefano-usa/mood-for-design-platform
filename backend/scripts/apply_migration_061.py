"""Apply migration 061 — Design Journey™ tables (Phase F.A)."""
import os, sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ.get('DATABASE_URL')
if not DB_URL: print("DATABASE_URL not set"); sys.exit(1)

MIG = (Path(__file__).resolve().parent.parent.parent /
       'supabase' / 'migrations' / '061_design_journey.sql')

def main() -> int:
    print(f"Applying {MIG.name} …")
    conn = psycopg2.connect(DB_URL); conn.autocommit = True
    cur = conn.cursor()
    cur.execute(MIG.read_text())
    cur.execute("""SELECT to_regclass('public.design_journeys'),
                          to_regclass('public.journey_milestones'),
                          to_regclass('public.journey_timeline_events')""")
    j, m, e = cur.fetchone()
    print(f"  design_journeys → {j}")
    print(f"  journey_milestones → {m}")
    print(f"  journey_timeline_events → {e}")
    cur.close(); conn.close()
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
