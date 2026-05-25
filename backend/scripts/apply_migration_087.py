"""Apply migration 087 — Relationship Live Engine™ (Sprint A)."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DB_URL = os.environ["DATABASE_URL"]
MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "087_relationship_live_engine.sql")

conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())

for tbl in ("relationship_events", "relationship_status", "call_requests"):
    cur.execute(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = %s ORDER BY ordinal_position", (tbl,))
    cols = [r[0] for r in cur.fetchall()]
    print(f"\u2713 {tbl}: {len(cols)} cols")
    print("  ", cols)

cur.close(); conn.close()
print("\n\u2705 087 applied · Relationship Live Engine ready.")
