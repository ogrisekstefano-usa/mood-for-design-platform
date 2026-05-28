"""Apply migration 105 — Client Profile Configs (ITER162 rev3)."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "105_client_profile_configs.sql")
conn = psycopg2.connect(os.environ["DATABASE_URL"]); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_name = 'client_profile_configs'")
print("tables:", cur.fetchall())
cur.close(); conn.close()
print("✅ 105 applied")
