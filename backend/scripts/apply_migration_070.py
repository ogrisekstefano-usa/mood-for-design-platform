"""Apply migration 070 — ITER138 Atelier Media Orchestration™."""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ['DATABASE_URL']
MIG = (Path(__file__).resolve().parent.parent.parent /
       'supabase' / 'migrations' / '070_atelier_media_orchestration.sql')

print(f"Applying {MIG.name} …")
conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()
cur.execute(MIG.read_text())

cur.execute("""
    SELECT column_name
      FROM information_schema.columns
     WHERE table_name = 'atelier_dashboard_media'
       AND column_name IN (
         'original_asset_url','optimized_asset_url','thumbnail_asset_url',
         'blurhash','storage_bucket','storage_path','mime_type','file_bytes',
         'width_px','height_px','crop_profile','grain_level','vignette_level',
         'warmth_offset','cyan_atmosphere','uploaded_by')
     ORDER BY column_name
""")
cols = [r[0] for r in cur.fetchall()]
print(f"  atelier_dashboard_media · {len(cols)}/16 new columns present:")
for c in cols:
    print(f"    · {c}")

cur.close(); conn.close()
print("✅ 070 applied.")
