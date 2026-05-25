"""Apply migration 094 — Sprint F · F2 chat realtime publication."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DB_URL = os.environ["DATABASE_URL"]
MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "094_realtime_publication_messages.sql")

conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())

cur.execute("""
  SELECT pubname, schemaname, tablename
  FROM pg_publication_tables
  WHERE schemaname='public' AND tablename='relationship_messages'
""")
for r in cur.fetchall():
    print(' publication:', r)

cur.execute("""
  SELECT relreplident FROM pg_class
  WHERE oid = 'public.relationship_messages'::regclass
""")
print(f"  replica_identity: {cur.fetchone()[0]!r} (expect 'f')")
cur.close(); conn.close()
print("\n✅ 094 applied · chat realtime publication active.")
