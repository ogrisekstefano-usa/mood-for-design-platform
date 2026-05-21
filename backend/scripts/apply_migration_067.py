"""Apply migration 067 — Sprint ITER127 · Language Command Center™."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ['DATABASE_URL']
MIG = (Path(__file__).resolve().parent.parent.parent /
       'supabase' / 'migrations' / '067_language_command_center.sql')

print(f"Applying {MIG.name} …")
conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())
for t in ('localization_overrides', 'localization_audit_runs'):
    cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_name=%s", (t,))
    print(f"  {t}: {'✅' if cur.fetchone()[0] else '❌'}")
cur.close(); conn.close()
print("✅ 067 applied.")
