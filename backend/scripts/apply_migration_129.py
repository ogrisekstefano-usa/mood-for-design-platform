"""Apply migration 129 — Review Workspace™ V3 foundation (idempotent).

Adds (no existing table touched):
  - entity_operational_usage (SSoT FUTURE USES™)
  - entity_future_uses_v     (aggregated view)
  - knowledge_impact_events  (ROI ledger)
  - entity_project_impact    (M7 placeholder, no economic KPIs)
"""
import os
import sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MIG_PATH = (Path(__file__).resolve().parent.parent.parent /
            "supabase" / "migrations" / "129_review_workspace_v3.sql")

if not MIG_PATH.exists():
    print(f"Migration file not found: {MIG_PATH}")
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not set in backend/.env")
    sys.exit(1)

print(f"Migration: {MIG_PATH.name}")
conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

sql = MIG_PATH.read_text()
print(f"SQL size: {len(sql):,} chars")
cur.execute(sql)

print("\nVerifying schema state ...")
for tbl in ("entity_operational_usage", "knowledge_impact_events", "entity_project_impact"):
    cur.execute(
        "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = %s",
        (tbl,),
    )
    cols = cur.fetchone()[0]
    cur.execute(f"SELECT COUNT(*) FROM {tbl}")
    rows = cur.fetchone()[0]
    print(f"  {tbl}: {cols} columns / {rows} rows")

cur.execute(
    "SELECT COUNT(*) FROM information_schema.views WHERE table_name = 'entity_future_uses_v'"
)
print(f"  entity_future_uses_v view exists: {bool(cur.fetchone()[0])}")

cur.close()
conn.close()
print("\nMigration 129 applied")
