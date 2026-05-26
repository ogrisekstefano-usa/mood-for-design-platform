"""ITER154.R3 · Seed one demo client user against the active MOOD tenant.

Idempotent. Safe to re-run.

Creates: client@moodfordesign.com / Blueprint2024!  (role=client)
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from datetime import datetime, timezone
from database import db, get_admin_client

EMAIL = "client@moodfordesign.com"
PASSWORD = "Blueprint2024!"
FIRST = "Marco"
LAST = "Bianchi"

sb = db()
adm = get_admin_client()

# 1. Resolve active MOOD tenant
tenants = sb.table("tenants").select("id, slug, name").limit(1).execute().data
if not tenants:
    raise SystemExit("No tenant configured.")
tenant = tenants[0]
tenant_id = tenant["id"]
print(f"→ tenant: {tenant['name']} ({tenant_id})")

# 2. Ensure auth user (idempotent)
try:
    auth_uid = None
    page = 1
    while True:
        existing = adm.auth.admin.list_users(page=page, per_page=200)
        users = existing if isinstance(existing, list) else (getattr(existing, "users", None) or [])
        if not users:
            break
        for u in users:
            if (getattr(u, "email", None) or "").lower() == EMAIL.lower():
                auth_uid = u.id
                break
        if auth_uid or len(users) < 200:
            break
        page += 1
    if not auth_uid:
        res = adm.auth.admin.create_user({
            "email": EMAIL,
            "password": PASSWORD,
            "email_confirm": True,
            "user_metadata": {"first_name": FIRST, "last_name": LAST},
        })
        auth_uid = res.user.id if hasattr(res, "user") else res["user"]["id"]
        print(f"→ created auth user {auth_uid}")
    else:
        adm.auth.admin.update_user_by_id(auth_uid, {"password": PASSWORD, "email_confirm": True})
        print(f"→ updated auth user {auth_uid}")
except Exception as e:
    print(f"auth bootstrap failed: {e}")
    raise

# 3. Ensure users_profile row
now = datetime.now(timezone.utc).isoformat()
existing_prof = (sb.table("users_profile").select("id").eq("auth_user_id", auth_uid).limit(1).execute()).data
if existing_prof:
    pid = existing_prof[0]["id"]
    sb.table("users_profile").update({
        "tenant_id": tenant_id,
        "email": EMAIL,
        "first_name": FIRST,
        "last_name": LAST,
        "role": "client",
        "updated_at": now,
    }).eq("id", pid).execute()
    print(f"→ profile {pid} updated")
else:
    res = sb.table("users_profile").insert({
        "auth_user_id": auth_uid,
        "tenant_id": tenant_id,
        "email": EMAIL,
        "first_name": FIRST,
        "last_name": LAST,
        "role": "client",
        "created_at": now,
        "updated_at": now,
    }).execute()
    pid = res.data[0]["id"]
    print(f"→ profile {pid} created")

print(f"\n✅ Client demo ready · {EMAIL} / {PASSWORD}")
