"""
Advisor scope helper — derives the current viewer's advisor identity
from a Bearer JWT or admin-key session, and exposes a typed context
the routers can use to scope data without leaking other advisors'
relations.

Identity model:
  • studio_requests.assigned_advisor_id  → FK users(id)
  • studio_relations.owner_advisor_id    → FK users(id)
  • advisor_followups.advisor_id         → FK users(id)
  • advisor_profiles.user_id             → FK users(id) (1:1 metadata)

So the canonical "advisor identifier" in MOOD is the **users.id** of a
user with role='advisor' (or admin/editor for super-admin shadows).
The `advisor_profiles` row carries metadata (commission %, territory).

Returned shape:
  {
    "role":           "admin" | "editor" | "advisor" | "owner",
    "is_super_admin": bool,                  # True for admin/editor
    "advisor_id":     uuid str | None,       # = users.id for role=advisor
    "user_id":        uuid str | None,
    "email":          str | None,
    "tenant":         tenant row dict,
  }
"""
from __future__ import annotations

import os
from typing import Optional

from fastapi import Header, HTTPException
from sqlalchemy import text

from database import AsyncSessionLocal
from tenant_resolver import get_corporate_tenant, _load_by_slug

ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY")

SUPER_ADMIN_ROLES = {"admin", "editor"}
ADVISOR_ROLE = "advisor"
# Roles allowed to reach /command-center surfaces.
# P0-A Tenant Isolation: 'owner' is INTENTIONALLY excluded — Founders
# must never reach pipeline, studio_requests, or cross-tenant relations.
# Endpoints that legitimately serve a Founder (e.g. tenant manifest,
# editorial copy for their own surface) use require_admin_tenant, which
# is tenant-bound for owners.
ALLOWED_ROLES = SUPER_ADMIN_ROLES | {ADVISOR_ROLE}


async def _has_advisor_profile(user_id: str) -> bool:
    """Confirm that the user is registered as an active advisor."""
    async with AsyncSessionLocal() as s:
        row = (await s.execute(
            text("""
                SELECT 1 FROM advisor_profiles
                 WHERE user_id = CAST(:uid AS uuid)
                   AND status = 'active'
                 LIMIT 1
            """),
            {"uid": user_id},
        )).mappings().first()
    return row is not None


async def require_advisor_scope(
    x_tenant_slug: str | None = Header(default=None),
    x_admin_key:   str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    """
    Tenant-scoped admin guard with advisor identity resolution.

    Accepts either:
      • Authorization: Bearer <jwt>   (role admin/editor/advisor/owner)
      • X-Admin-Key: <key>            matching ADMIN_API_KEY env
                                       (treated as super admin in dev)

    Anonymous → 401. Role outside ALLOWED_ROLES → 403.
    Advisor without a linked advisor_profiles row → 403.
    """
    role: str | None = None
    user_id: str | None = None
    email: str | None = None
    tenant_slug_from_jwt: str | None = None

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(None, 1)[1].strip()
        try:
            from routers.auth import decode_token
            claims = decode_token(token)
        except Exception as e:
            raise HTTPException(status_code=401, detail="Invalid session") from e
        role = (claims.get("role") or "").lower()
        user_id = claims.get("sub")
        email = claims.get("email")
        tenant_slug_from_jwt = claims.get("tenant_slug")
        if role not in ALLOWED_ROLES:
            raise HTTPException(status_code=403, detail="Insufficient role")
    elif ADMIN_API_KEY and x_admin_key == ADMIN_API_KEY:
        # Dev fallback — treated as super admin (no user_id).
        role = "admin"
    else:
        raise HTTPException(status_code=401, detail="Authentication required")

    slug = x_tenant_slug or tenant_slug_from_jwt
    if slug:
        tenant = await _load_by_slug(slug)
        if not tenant:
            raise HTTPException(status_code=404, detail=f"Tenant '{slug}' not found")
    else:
        tenant = await get_corporate_tenant()

    is_super_admin = role in SUPER_ADMIN_ROLES
    advisor_id: Optional[str] = None
    if role == ADVISOR_ROLE:
        if not user_id:
            raise HTTPException(status_code=403, detail="Advisor identity missing")
        if not await _has_advisor_profile(user_id):
            raise HTTPException(status_code=403, detail="Advisor profile not found")
        # Canonical advisor identifier == users.id (matches FK schema).
        advisor_id = user_id

    return {
        "role": role,
        "is_super_admin": is_super_admin,
        "advisor_id": advisor_id,
        "user_id": user_id,
        "email": email,
        "tenant": tenant,
    }
