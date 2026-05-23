"""Apply migration 077 — ITER144 Navigation Runtime + Audit."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ['DATABASE_URL']
MIG = (Path(__file__).resolve().parent.parent.parent /
       'supabase' / 'migrations' / '077_navigation_runtime_and_audit.sql')

print(f"Applying {MIG.name}…")
conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())

cur.execute("SELECT COUNT(*) FROM feature_modules_registry")
print(f"feature_modules_registry rows: {cur.fetchone()[0]}")

cur.execute("""SELECT nav_group, COUNT(*)
               FROM feature_modules_registry
               WHERE nav_group IS NOT NULL
               GROUP BY nav_group ORDER BY MIN(group_position)""")
print("\nNavigation groups:")
for g, n in cur.fetchall():
    print(f"  {g:24s} → {n} modules")

cur.execute("SELECT to_regclass('configuration_change_events')")
print(f"\nconfiguration_change_events: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM tenant_configuration")
print(f"tenant_configuration rows: {cur.fetchone()[0]}")

cur.close(); conn.close()
print("\n✅ 077 applied.")
