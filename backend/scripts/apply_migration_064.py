"""Apply migration 064 — Sprint G.2 · welcome_token."""
import os, sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ['DATABASE_URL']
MIG = (Path(__file__).resolve().parent.parent.parent /
       'supabase' / 'migrations' / '064_journey_welcome_token.sql')

print(f"Applying {MIG.name} …")
conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())
cur.execute("SELECT column_name FROM information_schema.columns "
            "WHERE table_name='design_journeys' AND column_name='welcome_token'")
print("  design_journeys.welcome_token →", cur.fetchone())
cur.close(); conn.close()
print("✅ 064 applied.")
