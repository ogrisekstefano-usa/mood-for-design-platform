"""Apply migration 068 — ITER132 · Editorial Runtime Translation Layer™."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ['DATABASE_URL']
MIG = (Path(__file__).resolve().parent.parent.parent /
       'supabase' / 'migrations' / '068_editorial_translations.sql')

print(f"Applying {MIG.name} …")
conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())

cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_name = 'editorial_translations'")
print(f"  editorial_translations: {'✅' if cur.fetchone()[0] else '❌'}")
cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name='editorial_translations' ORDER BY ordinal_position
""")
for col in cur.fetchall():
    print(f"   · {col[0]}")
cur.close(); conn.close()
print("✅ 068 applied.")
