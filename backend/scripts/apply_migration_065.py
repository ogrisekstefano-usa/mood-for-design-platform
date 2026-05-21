"""Apply migration 065 — Sprint ITER124 · ALE Persistent Translation Layer™."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ['DATABASE_URL']
MIG = (Path(__file__).resolve().parent.parent.parent /
       'supabase' / 'migrations' / '065_ale_translation_memory.sql')

print(f"Applying {MIG.name} …")
conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())

# Verify
for table in ('message_translations', 'tenant_dnt_registry', 'studio_translation_preferences'):
    cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_name = %s", (table,))
    exists = cur.fetchone()[0]
    print(f"  {table}: {'✅' if exists else '❌'}")

cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name='client_messages' AND column_name='source_locale'
""")
print(f"  client_messages.source_locale → {cur.fetchone()}")

cur.close(); conn.close()
print("✅ 065 applied.")
