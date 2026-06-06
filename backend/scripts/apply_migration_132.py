"""Apply migration 132 — KE-005B · Knowledge-Native Surfaces™ Foundation."""
import os, sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MIG = (Path(__file__).resolve().parent.parent.parent /
       "supabase" / "migrations" / "132_ke005b_knowledge_native_surfaces.sql")
if not MIG.exists():
    print(f"missing: {MIG}"); sys.exit(1)

url = os.environ.get("DATABASE_URL")
if not url:
    print("DATABASE_URL not set"); sys.exit(1)

conn = psycopg2.connect(url); conn.autocommit = True; cur = conn.cursor()
print(f"Migration: {MIG.name} ({MIG.stat().st_size:,} bytes)")
cur.execute(MIG.read_text())

print("\nVerifying schema:")
cur.execute("""SELECT column_name, data_type, is_nullable, column_default
               FROM information_schema.columns
               WHERE table_name='moodboard_elements' AND column_name='entity_id'""")
row = cur.fetchone()
print(f"  moodboard_elements.entity_id: {row}")
cur.execute("""SELECT column_name, data_type, is_nullable
               FROM information_schema.columns
               WHERE table_name='journey_milestones' AND column_name='entity_refs'""")
row = cur.fetchone()
print(f"  journey_milestones.entity_refs: {row}")
cur.execute("SELECT indexname FROM pg_indexes WHERE tablename='moodboard_elements' AND indexname='idx_moodboard_elements_entity_id'")
print(f"  idx_moodboard_elements_entity_id: {bool(cur.fetchone())}")
cur.execute("SELECT indexname FROM pg_indexes WHERE tablename='journey_milestones' AND indexname='idx_journey_milestones_entity_refs'")
print(f"  idx_journey_milestones_entity_refs: {bool(cur.fetchone())}")
cur.execute("SELECT COUNT(*) FROM information_schema.views WHERE table_name='entity_usage_lookup_v'")
print(f"  view entity_usage_lookup_v exists: {bool(cur.fetchone()[0])}")

cur.close(); conn.close()
print("\nMigration 132 applied · KE-005B foundation ready")
