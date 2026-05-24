"""Apply migration 083 — Sidebar polish."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DB_URL = os.environ["DATABASE_URL"]
MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "083_nav_registry_polish.sql")

print(f"Applying {MIG.name}…")
conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())

cur.execute("SELECT code, display_name, nav_group, nav_route FROM feature_modules_registry "
            "WHERE code IN ('settings_workspace','integrations','billing','forms_journeys','language_cc') "
            "ORDER BY code")
for r in cur.fetchall():
    print(r)
cur.close(); conn.close()
print("✅ 083 applied.")
