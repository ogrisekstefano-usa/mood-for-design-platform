"""Apply migration 131 — KE-001 Knowledge Engine Production Reliability™."""
import os, sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "131_ke001_reliability.sql")
if not MIG.exists():
    print(f"missing: {MIG}"); sys.exit(1)

url = os.environ.get("DATABASE_URL")
if not url:
    print("DATABASE_URL not set"); sys.exit(1)

conn = psycopg2.connect(url); conn.autocommit = True; cur = conn.cursor()
print(f"Migration: {MIG.name} ({MIG.stat().st_size:,} bytes)")
cur.execute(MIG.read_text())

print("\nVerifying schema:")
for tbl in ("extraction_event_log",):
    cur.execute("SELECT COUNT(*) FROM information_schema.columns WHERE table_name=%s", (tbl,))
    print(f"  {tbl}: {cur.fetchone()[0]} columns")
cur.execute("SELECT column_name FROM information_schema.columns "
            "WHERE table_name='extraction_jobs' AND column_name IN "
            "('last_seen_at','last_activity_at','stalled_at','worker_id',"
            " 'estimated_remaining_seconds','parent_job_id') ORDER BY column_name")
print("  extraction_jobs new cols:", [r[0] for r in cur.fetchall()])
cur.execute("SELECT COUNT(*) FROM information_schema.views WHERE table_name='extraction_event_log_to_purge'")
print(f"  view extraction_event_log_to_purge exists: {bool(cur.fetchone()[0])}")
cur.execute("SELECT pg_get_constraintdef(oid) FROM pg_constraint "
            "WHERE conname='extraction_jobs_status_chk'")
print(f"  status CHECK: {cur.fetchone()[0]}")

cur.close(); conn.close()
print("\nMigration 131 applied · KE-001 foundation ready")
