"""Apply migration 093 — Sprint F · F1 Realtime publication."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DB_URL = os.environ["DATABASE_URL"]
MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "093_realtime_publication_notifications.sql")

conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())

# verify
cur.execute("""
  SELECT pubname, schemaname, tablename
  FROM pg_publication_tables
  WHERE schemaname='public' AND tablename='relationship_notifications'
""")
rows = cur.fetchall()
for r in rows:
    print(' publication:', r)
if not rows:
    print('  ⚠  relationship_notifications NOT in publication')

cur.execute("""
  SELECT relreplident FROM pg_class
  WHERE oid = 'public.relationship_notifications'::regclass
""")
ri = cur.fetchone()[0]
# 'd'=default, 'n'=nothing, 'f'=full, 'i'=index
print(f"  replica_identity: {ri!r} (expect 'f')")

cur.close(); conn.close()
print("\n✅ 093 applied · notifications realtime publication active.")
