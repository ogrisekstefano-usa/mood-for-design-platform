"""Apply migration 125 — ITER204 Studio Library Bridge™ (idempotent)."""
import os
import sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MIG_PATH = (Path(__file__).resolve().parent.parent.parent /
            "supabase" / "migrations" / "125_iter204_studio_library_bridge.sql")

if not MIG_PATH.exists():
    print(f"Migration file not found: {MIG_PATH}")
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not set in backend/.env")
    sys.exit(1)

print(f"Migration: {MIG_PATH.name}")
conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

sql = MIG_PATH.read_text()
print(f"SQL size: {len(sql):,} chars")
cur.execute(sql)

print("\nVerifying schema state ...")
cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'studio_library_items'
    ORDER BY ordinal_position
""")
for row in cur.fetchall():
    print(f"  studio_library_items.{row[0]}: {row[1]} (nullable={row[2]})")

cur.execute("SELECT COUNT(*) FROM studio_library_items")
print(f"  studio_library_items rows: {cur.fetchone()[0]}")

cur.execute("""
    SELECT code, display_name, nav_route, nav_group
    FROM feature_modules_registry
    WHERE code = 'studio_library'
""")
for row in cur.fetchall():
    print(f"  module registered: {row}")

cur.close()
conn.close()
print("\nMigration 125 applied")
