"""Apply migration 100 — Editorial Copy CMS · Surface Governance System™."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "100_editorial_copy_cms.sql")
conn = psycopg2.connect(os.environ["DATABASE_URL"]); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())
cur.execute("SELECT count(*) FROM editorial_surfaces")
print(f"surfaces: {cur.fetchone()[0]}")
cur.execute("SELECT count(*) FROM editorial_phrases")
print(f"phrases: {cur.fetchone()[0]}")
cur.close(); conn.close()
print("✅ 100 applied")
