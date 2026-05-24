"""Apply migration 081 — ITER147 editorial_block_translations.locked."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DB_URL = os.environ["DATABASE_URL"]
MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "081_profile_identity_locked.sql")

print(f"Applying {MIG.name}…")
conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())
cur.execute("""SELECT column_name, data_type, column_default
               FROM information_schema.columns
               WHERE table_name='editorial_block_translations'
                 AND column_name='locked'""")
row = cur.fetchone()
print(f"locked column → {row}")
assert row, "locked column was not created"
cur.close(); conn.close()
print("✅ 081 applied.")
