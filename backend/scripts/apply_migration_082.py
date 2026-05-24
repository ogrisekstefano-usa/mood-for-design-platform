"""Apply migration 082 — ITER148.Phase1 Lead Data Model 2.0."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DB_URL = os.environ["DATABASE_URL"]
MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "082_lead_data_model_v2.sql")

print(f"Applying {MIG.name}…")
conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())

# Verify new columns on `leads`
cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name='leads'
      AND column_name IN ('closed_answers','behavioral_tags','ai_tags',
        'atmosphere_signals','material_signals','cultural_register',
        'luxury_perception_tier','progression_state','progression_score',
        'narrative_seed','intake_completed_at','intake_version')
    ORDER BY column_name
""")
cols = [r[0] for r in cur.fetchall()]
print(f"leads new columns ({len(cols)}/12): {cols}")
assert len(cols) == 12, f"Expected 12 new columns on leads, got {len(cols)}"

# Verify lead_intake_questions
cur.execute("""SELECT to_regclass('public.lead_intake_questions')""")
print(f"lead_intake_questions → {cur.fetchone()[0]}")

cur.close(); conn.close()
print("✅ 082 applied.")
