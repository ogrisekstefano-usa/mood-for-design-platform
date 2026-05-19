"""Apply migration 057_supplier_catalogs."""
import os, sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ.get('DATABASE_URL')
if not DB_URL:
    print("DATABASE_URL not set"); sys.exit(1)

MIG = Path(__file__).resolve().parent.parent.parent / 'supabase' / 'migrations' / '057_supplier_catalogs.sql'
sql = MIG.read_text()
print(f"Applying {MIG.name} …")
conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor(); cur.execute(sql)
print("✅ supplier_catalogs ready.")
cur.close(); conn.close()
