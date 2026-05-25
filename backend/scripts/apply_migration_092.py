"""Apply migration 092 — Notification activation polish."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DB_URL = os.environ["DATABASE_URL"]
MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "092_notifications_activation.sql")

conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())
cur.execute("SELECT trigger_name, action_timing, event_manipulation FROM information_schema.triggers "
            "WHERE event_object_table='relationship_events'")
for r in cur.fetchall(): print(' trigger:', r)
cur.execute("SELECT routine_name FROM information_schema.routines "
            "WHERE routine_name LIKE 'fn_emit%'")
for r in cur.fetchall(): print(' function:', r[0])
cur.close(); conn.close()
print("\n\u2705 092 applied · notifications polish active.")
