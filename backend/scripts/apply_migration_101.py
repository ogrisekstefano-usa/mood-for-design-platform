"""Apply migration 101 — Mount Editorial Copy CMS in nav."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "101_editorial_copy_nav.sql")
conn = psycopg2.connect(os.environ["DATABASE_URL"]); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())
cur.execute("SELECT code, nav_route, nav_group FROM feature_modules_registry WHERE code='editorial_copy_cms'")
print("mounted:", cur.fetchone())
cur.close(); conn.close()
print("✅ 101 applied")
