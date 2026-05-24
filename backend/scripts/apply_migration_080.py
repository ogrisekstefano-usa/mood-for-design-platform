"""Apply migration 080 — ITER146 Core Module Safety™ (is_core_critical)."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ['DATABASE_URL']
MIG = (Path(__file__).resolve().parent.parent.parent /
       'supabase' / 'migrations' / '080_core_critical_modules.sql')

print(f"Applying {MIG.name}…")
conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())

cur.execute("""
  SELECT code, is_core, is_core_critical, default_state
  FROM feature_modules_registry
  WHERE is_core_critical = TRUE
  ORDER BY position
""")
print("\nCore-critical modules:")
for code, is_core, crit, default_state in cur.fetchall():
    print(f"  {code:25s} is_core={is_core!s:5s} critical={crit!s:5s} default={default_state}")

cur.execute("SELECT COUNT(*) FROM feature_modules_registry WHERE is_core_critical = TRUE")
n = cur.fetchone()[0]
print(f"\nTotal critical modules: {n}")
assert n >= 6, f"expected at least 6 critical modules, got {n}"

cur.close(); conn.close()
print("\n✅ 080 applied.")
