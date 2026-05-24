"""Apply migration 078 — ITER146.A Lead Pipeline Orchestration™."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
MIG = (Path(__file__).resolve().parent.parent.parent /
       'supabase' / 'migrations' / '078_lead_pipeline_extension.sql')

print(f"Applying {MIG.name}…")
conn = psycopg2.connect(os.environ['DATABASE_URL']); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())

cur.execute("""SELECT column_name FROM information_schema.columns
               WHERE table_name='leads' ORDER BY ordinal_position""")
cols = [r[0] for r in cur.fetchall()]
print(f"leads columns ({len(cols)}):")
for c in cols:
    marker = " ★" if c in ("onboarding_path", "professional_category",
                            "collaboration_intent", "market_sector",
                            "company_name", "company_website",
                            "portfolio_url", "runtime_identity",
                            "pipeline_stage") else ""
    print(f"  · {c}{marker}")
cur.close(); conn.close()
print("\n✅ 078 applied.")
