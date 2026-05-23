#!/usr/bin/env python3
"""
seed_demo_users.py — Bootstrap demo accounts for repeatable test setups.

Creates (idempotent):
  1. designer@moodfordesign.com / Designer2024!     → role `designer`,     tenant MOOD Demo Studio
  2. client@moodfordesign.com   / Client2024!       → role `client`,       tenant MOOD Demo Studio
  3. studio2@moodfordesign.com  / Studio2024!       → role `tenant_admin`, tenant MOOD Demo Showroom

Usage:
    cd /app/backend && python3 scripts/seed_demo_users.py

Skips users that already exist. Safe to re-run.

Auto-updates /app/memory/test_credentials.md with current capabilities/limitations.
"""
import os
import sys
import uuid
import pathlib
from datetime import datetime, timezone

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(pathlib.Path(__file__).resolve().parent.parent / ".env")

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
client = create_client(SUPABASE_URL, SERVICE_KEY)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def find_tenant_by_slug(slug: str):
    r = client.table("tenants").select("*").eq("slug", slug).limit(1).execute()
    return r.data[0] if r.data else None


def find_profile_by_email(email: str):
    r = client.table("users_profile").select("*").eq("email", email).limit(1).execute()
    return r.data[0] if r.data else None


def ensure_user(email: str, password: str, first_name: str, last_name: str,
                tenant_slug: str, role: str) -> dict:
    """Create or verify a demo user. Returns the resulting users_profile row."""
    existing = find_profile_by_email(email)
    tenant = find_tenant_by_slug(tenant_slug)
    if not tenant:
        raise RuntimeError(f"Tenant not found for slug={tenant_slug}")

    if existing:
        # If existing has the right role + tenant, we're done
        if existing.get("role") == role and existing.get("tenant_id") == tenant["id"]:
            print(f"  ✓ {email:40s} (already exists, role={role}, tenant={tenant_slug})")
            return existing
        # Otherwise, sync role + tenant
        client.table("users_profile").update({
            "role": role,
            "tenant_id": tenant["id"],
            "first_name": first_name,
            "last_name": last_name,
            "status": "active",
            "updated_at": _now_iso(),
        }).eq("id", existing["id"]).execute()
        print(f"  ✓ {email:40s} (updated → role={role}, tenant={tenant_slug})")
        return existing

    # 1. Create the Supabase auth user
    try:
        auth_resp = client.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"first_name": first_name, "last_name": last_name},
        })
        auth_user_id = auth_resp.user.id
    except Exception as e:
        # If the auth.user exists but no profile (recovery), look it up
        msg = str(e).lower()
        if "already" in msg or "registered" in msg or "duplicate" in msg:
            # Find by email via admin API
            page = client.auth.admin.list_users()
            existing_auth = next((u for u in page if (u.email or "").lower() == email), None)
            if not existing_auth:
                raise RuntimeError(f"Auth user exists but cannot find: {email}")
            auth_user_id = existing_auth.id
            # Reset password to ensure repeatable test access
            client.auth.admin.update_user_by_id(auth_user_id, {"password": password})
        else:
            raise

    # 2. Create profile
    profile_id = str(uuid.uuid4())
    now = _now_iso()
    client.table("users_profile").insert({
        "id": profile_id,
        "auth_user_id": auth_user_id,
        "tenant_id": tenant["id"],
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "role": role,
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }).execute()
    print(f"  ✓ {email:40s} (CREATED, role={role}, tenant={tenant_slug})")
    return find_profile_by_email(email)


def ensure_second_tenant():
    """Ensure MOOD Demo Showroom tenant (Golden Demo Tenant™) exists.

    ITER143D: slug freeze → `studio`. Was `mood-demo` historically.
    Both lookups supported for idempotency on legacy databases.
    """
    showroom = find_tenant_by_slug("studio") or find_tenant_by_slug("mood-demo")
    if showroom:
        # If the legacy slug is still in place, rename it.
        if showroom.get("slug") == "mood-demo":
            client.table("tenants").update({"slug": "studio",
                                            "is_demo": True,
                                            "updated_at": _now_iso()})\
                .eq("id", showroom["id"]).execute()
            print("  ✓ Renamed legacy slug 'mood-demo' → 'studio'")
            showroom = find_tenant_by_slug("studio")
        return showroom
    tid = str(uuid.uuid4())
    now = _now_iso()
    client.table("tenants").insert({
        "id": tid,
        "name": "MOOD Demo Showroom",
        "slug": "studio",
        "status": "active",
        "is_demo": True,
        "default_language": "en-US",
        "active_languages": ["en-US", "en-GB", "it", "fr"],
        "created_at": now,
        "updated_at": now,
    }).execute()
    print("  ✓ Tenant created: MOOD Demo Showroom (slug=studio · Golden Demo Tenant™)")
    return find_tenant_by_slug("studio")


DEMO_USERS = [
    {
        "email": "designer@moodfordesign.com",
        "password": "Designer2024!",
        "first_name": "Giulia",
        "last_name": "Ferri",
        "tenant_slug": "mood-demo-studio-81a09e",
        "role": "designer",
        "scope": "Daily designer on MOOD Demo Studio. Can read projects, RW moodboards & proposals, RW storage. CANNOT manage leads, branding, members, or impersonate.",
    },
    {
        "email": "client@moodfordesign.com",
        "password": "Client2024!",
        "first_name": "Marco",
        "last_name": "Bianchi",
        "tenant_slug": "mood-demo-studio-81a09e",
        "role": "client",
        "scope": "Client of MOOD Demo Studio. READ-ONLY on projects/moodboards/proposals. Can APPROVE proposals. NO access to dashboard chrome, settings, admin, branding, members.",
    },
    {
        "email": "studio2@moodfordesign.com",
        "password": "Studio2024!",
        "first_name": "Alessandro",
        "last_name": "Conti",
        "tenant_slug": "mood-demo",
        "role": "tenant_admin",
        "scope": "Owner of MOOD Demo Showroom (isolated tenant). Full tenant_admin permissions but ONLY on Showroom data. MUST NOT see any MOOD Demo Studio data.",
    },
]


def main():
    print("→ Ensuring tenants…")
    studio = find_tenant_by_slug("mood-demo-studio-81a09e")
    if not studio:
        raise RuntimeError("MOOD Demo Studio tenant missing — bootstrap the platform first")
    print(f"  ✓ MOOD Demo Studio    ({studio['id']})")
    showroom = ensure_second_tenant()
    print(f"  ✓ MOOD Demo Showroom  ({showroom['id']})")

    print("\n→ Ensuring demo users…")
    for u in DEMO_USERS:
        ensure_user(
            email=u["email"], password=u["password"],
            first_name=u["first_name"], last_name=u["last_name"],
            tenant_slug=u["tenant_slug"], role=u["role"],
        )

    print("\n✓ Demo seed complete.")
    print("\nAccounts (also in /app/memory/test_credentials.md):")
    print(f"  super_admin   : demo@moodfordesign.com     / Blueprint2024!")
    for u in DEMO_USERS:
        print(f"  {u['role']:13s}: {u['email']:30s}/ {u['password']}")


if __name__ == "__main__":
    main()
