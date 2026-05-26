"""Apply migration 096 — Sprint F · F4 timeline events realtime publication."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DB_URL = os.environ["DATABASE_URL"]
MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "096_realtime_publication_events.sql")

conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())
cur.execute("SELECT pubname, tablename FROM pg_publication_tables WHERE schemaname='public' AND tablename='relationship_events'")
for r in cur.fetchall(): print(' publication:', r)
cur.execute("SELECT relreplident FROM pg_class WHERE oid = 'public.relationship_events'::regclass")
print(f"  replica_identity: {cur.fetchone()[0]!r} (expect 'f')")
cur.close(); conn.close()
print("\n✅ 096 applied · timeline events realtime publication active.")
