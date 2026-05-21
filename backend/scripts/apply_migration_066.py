"""Apply migration 066 — Sprint ITER125 · Studio Voice™."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ['DATABASE_URL']
MIG = (Path(__file__).resolve().parent.parent.parent /
       'supabase' / 'migrations' / '066_studio_voice.sql')

print(f"Applying {MIG.name} …")
conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())

for table in ('studio_vocabulary', 'studio_translation_corrections'):
    cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_name = %s", (table,))
    print(f"  {table}: {'✅' if cur.fetchone()[0] else '❌'}")

for col in ('previous_localized_text', 'usage_count'):
    cur.execute("SELECT column_name FROM information_schema.columns "
                "WHERE table_name='message_translations' AND column_name=%s", (col,))
    print(f"  message_translations.{col} → {cur.fetchone()}")

cur.close(); conn.close()
print("✅ 066 applied.")
