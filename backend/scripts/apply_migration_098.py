"""Apply migration 098 — Guided Tour"""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "098_guided_tour.sql")
conn = psycopg2.connect(os.environ["DATABASE_URL"]); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())
cur.execute("SELECT count(*) FROM guided_tour_config WHERE tour_key='studio_first_login'")
print(f"seeded steps: {cur.fetchone()[0]}")
cur.close(); conn.close()
print("✅ 098 applied")
