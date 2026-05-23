"""Apply migration 069 — ITER138 Atelier Dashboard™ DB-driven content model."""
import os, sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ['DATABASE_URL']
MIG = (Path(__file__).resolve().parent.parent.parent /
       'supabase' / 'migrations' / '069_atelier_dashboard.sql')

print(f"Applying {MIG.name} …")
conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())

for table in ('atelier_dashboard_config', 'atelier_dashboard_media', 'atelier_dashboard_quotes'):
    cur.execute(f"SELECT count(*) FROM {table}")
    n = cur.fetchone()[0]
    print(f"  {table:35s} → {n} rows")

cur.close(); conn.close()
print("✅ 069 applied.")
