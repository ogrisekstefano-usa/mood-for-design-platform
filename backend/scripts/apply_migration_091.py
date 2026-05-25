"""Apply migration 091 — Studio Orchestra™."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DB_URL = os.environ["DATABASE_URL"]
MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "091_studio_orchestra.sql")

conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())
for tbl in ("studio_team_members", "relationship_notifications"):
    cur.execute("SELECT column_name FROM information_schema.columns "
                "WHERE table_name=%s ORDER BY ordinal_position", (tbl,))
    cols = [r[0] for r in cur.fetchall()]
    print(f"\u2713 {tbl}: {len(cols)} cols")
cur.execute("SELECT trigger_name FROM information_schema.triggers "
            "WHERE event_object_table='relationship_events'")
trigs = [r[0] for r in cur.fetchall()]
print("triggers on relationship_events:", trigs)
cur.close(); conn.close()
print("\n\u2705 091 applied · Studio Orchestra ready.")
