"""Apply migration 107 — Design Journey™ Operational Lock (ITER168 Phase 1).

Idempotent. Safe to re-run.
"""
import os
import sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MIG_PATH = (Path(__file__).resolve().parent.parent.parent /
            "supabase" / "migrations" / "107_dj_operational_lock.sql")

if not MIG_PATH.exists():
    print(f"❌ Migration file not found: {MIG_PATH}")
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not set in backend/.env")
    sys.exit(1)

print(f"📂 Migration: {MIG_PATH.name}")
print(f"🔌 Connecting to Supabase Postgres ...")
conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

sql = MIG_PATH.read_text()
print(f"📐 SQL size: {len(sql):,} chars")
cur.execute(sql)

# Verify
print("\n🔍 Verifying schema state ...")
cur.execute("""
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_name = 'moodboards'
      AND column_name IN ('scope','room_key','chapter_key','visibility','approval_state','journey_id')
    ORDER BY column_name
""")
for row in cur.fetchall():
    print(f"   moodboards.{row[0]}: nullable={row[1]}, type={row[2]}")

cur.execute("""
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'design_journeys' AND column_name = 'account_id'
""")
for row in cur.fetchall():
    print(f"   design_journeys.{row[0]}: nullable={row[1]}")

cur.execute("""
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'journey_milestones'
      AND column_name IN ('is_applicable','skipped_at','reopened_at','parallel_track')
    ORDER BY column_name
""")
cols = [r[0] for r in cur.fetchall()]
print(f"   journey_milestones new cols: {cols}")

cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('moodboard_rooms','moodboard_chapters','journey_briefs')
    ORDER BY table_name
""")
tables = [r[0] for r in cur.fetchall()]
print(f"   new tables: {tables}")

cur.execute("SELECT COUNT(*) FROM moodboard_rooms")
print(f"   moodboard_rooms rows: {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(*) FROM moodboard_chapters")
print(f"   moodboard_chapters rows: {cur.fetchone()[0]}")

cur.execute("""
    SELECT viewname FROM pg_views WHERE viewname = 'journey_overview'
""")
print(f"   view journey_overview: {bool(cur.fetchall())}")

cur.execute("""
    SELECT proname FROM pg_proc WHERE proname = 'sync_leads_progression_from_account'
""")
print(f"   trigger fn sync_leads_progression_from_account: {bool(cur.fetchall())}")

cur.close()
conn.close()
print("\n✅ Migration 107 applied")
