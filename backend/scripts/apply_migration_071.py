"""Apply migration 071 — ITER142 · SaaS Foundation."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ['DATABASE_URL']
MIG = (Path(__file__).resolve().parent.parent.parent /
       'supabase' / 'migrations' / '071_saas_foundation.sql')

print(f"Applying {MIG.name}…")
conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())

cur.execute("SELECT position, code, display_name FROM atelier_presets_registry ORDER BY position")
print("\n=== Atelier preset registry ===")
for p, c, d in cur.fetchall():
    print(f"  {p:02d} · {d:25s}  [{c}]")

cur.execute("SELECT COUNT(*) FROM tenant_atelier_identity")
print(f"\ntenant_atelier_identity rows: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM email_events")
print(f"email_events rows: {cur.fetchone()[0]}")

cur.execute("""SELECT to_regclass('tenant_subdomain_lookup')""")
print(f"tenant_subdomain_lookup view: {cur.fetchone()[0]}")

cur.close(); conn.close()
print("\n✅ 071 applied.")
