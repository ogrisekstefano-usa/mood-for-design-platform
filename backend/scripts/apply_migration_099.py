"""Apply migration 099 — Sidebar cleanup (hide Voice Log placeholder)."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "099_sidebar_cleanup.sql")
conn = psycopg2.connect(os.environ["DATABASE_URL"]); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())
cur.execute("SELECT code, nav_group, nav_route FROM feature_modules_registry WHERE code='client_relations_voice_log'")
print("voice_log row:", cur.fetchone())
cur.close(); conn.close()
print("✅ 099 applied")
