"""Apply migration 103 — Published Design Journeys™ (ITER157.B)."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "103_published_design_journeys.sql")
conn = psycopg2.connect(os.environ["DATABASE_URL"]); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('published_design_journeys',
                         'published_design_journey_translations')
    ORDER BY table_name
""")
rows = cur.fetchall()
print("tables created:", [r[0] for r in rows])
cur.close(); conn.close()
print("✅ 103 applied")
