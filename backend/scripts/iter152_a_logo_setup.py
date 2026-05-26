"""
ITER152 · Fase A · Logo + Tenant Setup
======================================
Downloads brand assets (logo + favicon), uploads to Supabase Storage,
registers them in media_library, and wires the primary MOOD tenant.

NO files under /public/brand. Everything DB-driven.
"""
import os, uuid, hashlib, mimetypes
from pathlib import Path
import requests
import psycopg2
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
SUPA_URL = os.environ["SUPABASE_URL"]
SUPA_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DB_URL   = os.environ["DATABASE_URL"]
ADMIN_EMAIL = "admin@moodfordesign.com"

LOGO_URL    = "https://customer-assets.emergentagent.com/job_content-hub-pro-22/artifacts/8tkv5wwy_logo_mood_for_design_color.png"
FAVICON_URL = "https://customer-assets.emergentagent.com/job_content-hub-pro-22/artifacts/j023mk7i_logotipo_OO.png"

sb = create_client(SUPA_URL, SUPA_KEY)
conn = psycopg2.connect(DB_URL); conn.autocommit = True
cur = conn.cursor()

# Identify primary tenant + admin
cur.execute("SELECT id FROM tenants WHERE slug='studio' OR is_demo=true ORDER BY created_at LIMIT 1")
TENANT_ID = cur.fetchone()[0]
cur.execute("SELECT id FROM users_profile WHERE email=%s", (ADMIN_EMAIL,))
ADMIN_ID = cur.fetchone()[0]
print(f"Tenant: {TENANT_ID}\nAdmin:  {ADMIN_ID}")

BUCKET = "media"
def _ensure_bucket():
    try:
        sb.storage.create_bucket(BUCKET, options={"public": True})
        print(f"  ✓ bucket '{BUCKET}' created")
    except Exception:
        pass  # already exists

def upload(url: str, kind: str, category: str) -> dict:
    print(f"\n▸ {kind} · downloading {url[-60:]}")
    blob = requests.get(url, timeout=30).content
    digest = hashlib.sha256(blob).hexdigest()[:16]
    mime = "image/png"
    ext = ".png"
    path = f"{TENANT_ID}/brand/{kind}_{digest}{ext}"
    try:
        sb.storage.from_(BUCKET).upload(path, blob,
                                        file_options={"content-type": mime,
                                                      "upsert": "true"})
    except Exception as e:
        # already there is fine
        if "duplicate" not in str(e).lower() and "exists" not in str(e).lower():
            raise
    public_url = sb.storage.from_(BUCKET).get_public_url(path)
    print(f"  ✓ uploaded → {public_url[:80]}…")

    # Register in media_library
    media_id = str(uuid.uuid4())
    cur.execute("""
      INSERT INTO media_library
        (id, tenant_id, uploaded_by, bucket, storage_path, file_url,
         file_type, file_name, file_size, mime_type, category, alt_text,
         checksum_sha256, metadata_json, created_at)
      VALUES (%s, %s, %s, %s, %s, %s,
              'image', %s, %s, %s, %s, %s,
              %s, %s::jsonb, NOW())
      ON CONFLICT DO NOTHING
      RETURNING id""",
      (media_id, TENANT_ID, ADMIN_ID, BUCKET, path, public_url,
       f"{kind}{ext}", len(blob), mime, category,
       f"MOOD for DESIGN {kind}", digest, '{"brand": true}'))
    row = cur.fetchone()
    if row:
        print(f"  ✓ media_library registered id={row[0]}")
        media_id = row[0]
    return {"id": media_id, "url": public_url, "path": path}

_ensure_bucket()
logo = upload(LOGO_URL, "logo", "branding")
favicon = upload(FAVICON_URL, "favicon", "branding")

# Update tenant
cur.execute("""
  UPDATE tenants
     SET name='MOOD for DESIGN',
         logo_url=%s,
         primary_color='#00C9B3',
         secondary_color='#0E0D0B',
         default_language='it',
         active_languages=%s,
         branding_settings=COALESCE(branding_settings,'{}'::jsonb)
                          || %s::jsonb,
         theme_settings=COALESCE(theme_settings,'{}'::jsonb)
                       || %s::jsonb,
         is_demo=false,
         status='active',
         updated_at=NOW()
   WHERE id=%s""",
   (logo["url"],
    ["it", "en"],
    f'{{"logo_url":"{logo["url"]}","favicon_url":"{favicon["url"]}","logo_media_id":"{logo["id"]}","favicon_media_id":"{favicon["id"]}"}}',
    '{"atelier_preset":"editorial_warm","primary_accent":"#00C9B3"}',
    TENANT_ID))
print("\n✓ tenant updated · logo + favicon + branding persisted in DB")

# Tenant_atelier_identity update
cur.execute("""
  UPDATE tenant_atelier_identity
     SET logo_url=%s,
         favicon_url=%s,
         brand_name='MOOD for DESIGN',
         tagline='Italian Design Studios',
         updated_at=NOW()
   WHERE tenant_id=%s
""", (logo["url"], favicon["url"], TENANT_ID))
print(f"  ✓ tenant_atelier_identity updated · {cur.rowcount} row(s)")

print("\n=== FINAL STATE ===")
cur.execute("SELECT name, slug, logo_url, status, is_demo FROM tenants WHERE id=%s", (TENANT_ID,))
print(cur.fetchone())
print(f"\n✅ Logo + favicon persisted via media_library.")
print(f"   Logo URL    : {logo['url']}")
print(f"   Favicon URL : {favicon['url']}")
