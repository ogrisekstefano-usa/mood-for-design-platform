"""Apply migration 084 — Relationship Engine v2.

ITER148 Sprint A · Unifies the question catalog under one schema:
  relationship_question_groups → relationship_questions →
    relationship_question_options + relationship_answer_events.

Also extends `leads` with relationship_temperature / designer_assigned /
first_journey_id.
"""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DB_URL = os.environ["DATABASE_URL"]
MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "084_relationship_engine_v2.sql")

print(f"Applying {MIG.name}…")
conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())

# Verify
cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name='leads'
      AND column_name IN ('relationship_temperature','designer_assigned','first_journey_id')
""")
cols = sorted(r[0] for r in cur.fetchall())
print(f"leads · new columns ({len(cols)}/3): {cols}")
assert len(cols) == 3, f"expected 3, got {len(cols)}"

for t in ('relationship_question_groups', 'relationship_questions',
          'relationship_question_options', 'relationship_answer_events'):
    cur.execute(f"SELECT to_regclass('public.{t}')")
    r = cur.fetchone()[0]
    print(f"  {t}: {r}")
    assert r == t

cur.execute("SELECT to_regclass('public.relationship_catalog_v1')")
print(f"  view relationship_catalog_v1: {cur.fetchone()[0]}")

cur.close(); conn.close()
print("✅ 084 applied.")
