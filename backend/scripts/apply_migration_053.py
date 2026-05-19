"""Apply migration 053_cultural_edition_drafts via DATABASE_URL."""
import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')

DB_URL = os.environ.get('DATABASE_URL')
if not DB_URL:
    print("DATABASE_URL not set"); sys.exit(1)

MIGRATION_FILE = Path(__file__).resolve().parent.parent.parent / 'supabase' / 'migrations' / '053_cultural_edition_drafts.sql'
sql = MIGRATION_FILE.read_text()

print(f"Applying {MIGRATION_FILE.name} …")
conn = psycopg2.connect(DB_URL)
conn.autocommit = True
cur = conn.cursor()
cur.execute(sql)
print("OK — cultural_edition_drafts ready.")
cur.close(); conn.close()
