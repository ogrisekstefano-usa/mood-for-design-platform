"""Member Management — list, invite (magic-link), update role/status, remove.

RBAC:
  - tenant_admin → manages members of their own tenant (cannot touch other tenants
                   or escalate someone to super_admin).
  - super_admin  → manages members of any tenant (via X-Tenant-Override).
  - Everyone else → 403.

Invite flow:
  1. tenant_admin POSTs /api/members/invite with email + first/last + role
  2. We create the Supabase auth.user via Admin API + a placeholder users_profile
     row with status='invited'
  3. We trigger a magic-link / invite email from Supabase Auth so the recipient
     can set their password
  4. An entry in `member_invites` tracks who invited whom + supports resend
"""
import os
import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from core.tenant_context import require_permission, audit_log
from core.permissions import (
    P_TENANT_MEMBERS_READ, P_TENANT_MEMBERS_WRITE,
    is_super_admin, ROLE_PERMISSIONS,
)
from core.licensing import assert_capacity, get_tenant_license, get_tenant_usage
from database import db, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Constants ────────────────────────────────────────────────────────────────
# Roles assignable WITHIN a tenant by tenant_admin / super_admin.
# `super_admin` is explicitly EXCLUDED from tenant_admin's reach — only an
# existing super_admin can grant super_admin (out of band).
TENANT_ASSIGNABLE_ROLES = {
    "tenant_admin", "designer", "client",
    # Reserved for future personas — already supported by the RBAC engine,
    # surfaced in the UI as soon as we map them in permissions.py.
    "editor", "project_manager", "analyst", "ad_partner",
    # ITER177 Phase 0 · Team Foundation — new operator roles.
    "sales", "advisor",
}

VALID_STATUS = {"active", "invited", "suspended"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate_role(role: str, *, allow_super_admin: bool = False):
    if allow_super_admin and role == "super_admin":
        return
    if role not in TENANT_ASSIGNABLE_ROLES:
        raise HTTPException(400, f"Role '{role}' is not assignable")


# ── Schemas ─────────────────────────────────────────────────────────────────
class MemberOut(BaseModel):
    id: str
    auth_user_id: Optional[str] = None
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str
    status: str
    avatar_url: Optional[str] = None
    last_login_at: Optional[str] = None
    invited_at: Optional[str] = None
    accepted_at: Optional[str] = None
    suspended_at: Optional[str] = None
    created_at: Optional[str] = None


class InviteCreate(BaseModel):
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    role: str


class MemberUpdate(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None  # active | suspended (cannot revert to invited)
    first_name: Optional[str] = Field(default=None, max_length=80)
    last_name: Optional[str] = Field(default=None, max_length=80)


# ── Helpers ─────────────────────────────────────────────────────────────────
def _supabase_invite_user(email: str, redirect_to: Optional[str], metadata: dict) -> dict:
    """Trigger a Supabase magic-link invite for the user.

    Uses the Admin API (`/auth/v1/admin/generate_link`) with type `invite` so
    Supabase creates the auth.user AND sends the invite email (if SMTP is
    configured in the Supabase project — recommended).
    """
    url = f"{SUPABASE_URL}/auth/v1/admin/invite"
    payload = {"email": email, "data": metadata}
    if redirect_to:
        payload["redirect_to"] = redirect_to
    r = requests.post(
        url,
        json=payload,
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    if r.status_code not in (200, 201):
        msg = ""
        try:
            j = r.json()
            msg = j.get("msg") or j.get("error_description") or j.get("error") or str(j)
        except Exception:
            msg = r.text
        raise HTTPException(r.status_code, f"Supabase invite failed: {msg}")
    return r.json()


def _supabase_create_user_no_email(email: str, metadata: dict) -> dict:
    """Fallback: create a confirmed user without sending email (when SMTP not
    available in Supabase project). The frontend will then call /forgot-password
    so the user can set their own password.
    """
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    r = requests.post(
        url,
        json={"email": email, "email_confirm": True, "user_metadata": metadata},
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    if r.status_code not in (200, 201):
        try:
            err = r.json().get("msg") or r.text
        except Exception:
            err = r.text
        raise HTTPException(r.status_code, f"Supabase create user failed: {err}")
    return r.json()


from routers.profile import _resign_avatar_url


def _profile_to_member(p: dict) -> MemberOut:
    return MemberOut(
        id=p["id"],
        auth_user_id=p.get("auth_user_id"),
        email=p.get("email", ""),
        first_name=p.get("first_name"),
        last_name=p.get("last_name"),
        role=p.get("role", ""),
        status=p.get("status") or "active",
        # ITER147 HOTFIX · tenant-assets bucket is private → re-sign
        # legacy /public/ URLs at read-time so member avatars render.
        avatar_url=_resign_avatar_url(p.get("avatar_url")),
        last_login_at=p.get("last_login_at"),
        invited_at=p.get("invited_at"),
        accepted_at=p.get("accepted_at"),
        suspended_at=p.get("suspended_at"),
        created_at=p.get("created_at"),
    )


# ── Endpoints ───────────────────────────────────────────────────────────────
@router.get("", response_model=List[MemberOut])
def list_members(
    status_filter: Optional[str] = None,
    include_clients: bool = False,
    ctx: dict = Depends(require_permission(P_TENANT_MEMBERS_READ)),
):
    """List Team members of the current tenant (effective tenant via impersonation).

    ITER177 Phase 0 · Team ≠ CRM separation. Clients (`role='client'`)
    are excluded by default — they belong to the CRM module
    (`/relations/accounts`). Pass `include_clients=true` to override.
    """
    client = db()
    q = client.table("users_profile").select("*").eq("tenant_id", ctx["tenant_id"])
    if not include_clients:
        q = q.neq("role", "client")
    if status_filter and status_filter in VALID_STATUS:
        q = q.eq("status", status_filter)
    r = q.order("created_at", desc=False).execute()
    return [_profile_to_member(p) for p in (r.data or [])]


@router.get("/roles")
def list_assignable_roles(ctx: dict = Depends(require_permission(P_TENANT_MEMBERS_READ))):
    """Return roles a tenant_admin can assign, with their permission set.

    The frontend uses this to build the role-picker dynamically — NO hardcoded
    role list in the UI. Super-admin sees the same list + can additionally
    grant super_admin out of band.
    """
    roles = []
    for role in sorted(TENANT_ASSIGNABLE_ROLES):
        roles.append({
            "key": role,
            "permissions": sorted(list(ROLE_PERMISSIONS.get(role, set()))),
        })
    return {"roles": roles, "is_super_admin": is_super_admin(ctx.get("role"))}


@router.post("/invite", response_model=MemberOut, status_code=201)
def invite_member(
    body: InviteCreate,
    ctx: dict = Depends(require_permission(P_TENANT_MEMBERS_WRITE)),
):
    """Invite a new member to the current tenant via Supabase magic link.

    Idempotent on email — if a profile already exists in the tenant, returns 409.
    """
    _validate_role(body.role)
    email = body.email.lower().strip()
    client = db()
    tenant_id = ctx["tenant_id"]

    # ── License capacity gate — blocks BEFORE we hit Supabase Auth.
    # Raises 403 LICENSE_LIMIT_REACHED with current/limit so the frontend
    # can show "Upgrade plan" banner without an extra round-trip.
    assert_capacity(tenant_id, "users")

    # Already in this tenant?
    existing_in_tenant = (
        client.table("users_profile").select("*")
        .eq("email", email).eq("tenant_id", tenant_id).limit(1).execute()
    )
    if existing_in_tenant.data:
        raise HTTPException(409, "A member with this email already exists in the tenant")

    # Already exists globally on another tenant? For MVP we block; a future
    # multi-tenant per user flow will create a tenant_memberships row instead.
    existing_global = (
        client.table("users_profile").select("id, tenant_id, auth_user_id")
        .eq("email", email).limit(1).execute()
    )
    if existing_global.data:
        # If the same auth.user exists, we won't recreate them — we just create
        # an additional membership for them. But we still create a row in
        # users_profile for THIS tenant so existing tenant-scoped queries work.
        existing_auth_user_id = existing_global.data[0].get("auth_user_id")
    else:
        existing_auth_user_id = None

    # 1. Trigger invite via Supabase (or fall back to silent create)
    metadata = {"first_name": body.first_name, "last_name": body.last_name,
                "tenant_id": tenant_id, "invited_role": body.role}
    auth_user_id = existing_auth_user_id
    invite_sent = False
    if not auth_user_id:
        try:
            inv = _supabase_invite_user(email, redirect_to=None, metadata=metadata)
            auth_user_id = (inv.get("user") or {}).get("id") or inv.get("id")
            invite_sent = True
        except HTTPException as e:
            # Most common failure: SMTP not configured. Fall back to silent
            # admin-create so onboarding still works (the admin will hand
            # over the password offline or the user uses /forgot-password).
            logger.warning(f"Supabase invite failed, falling back to silent create: {e.detail}")
            created = _supabase_create_user_no_email(email, metadata)
            auth_user_id = (created.get("user") or {}).get("id") or created.get("id")

    if not auth_user_id:
        raise HTTPException(500, "Could not provision auth user")

    # 2. Create users_profile row in INVITED state
    profile_id = str(uuid.uuid4())
    now = _now_iso()
    client.table("users_profile").insert({
        "id": profile_id,
        "auth_user_id": auth_user_id,
        "tenant_id": tenant_id,
        "email": email,
        "first_name": body.first_name,
        "last_name": body.last_name,
        "role": body.role,
        "status": "invited",
        "invited_by": ctx["profile_id"],
        "invited_at": now,
        "created_at": now,
        "updated_at": now,
    }).execute()

    # 3. Create membership (multi-tenant future-proof)
    client.table("tenant_memberships").insert({
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "profile_id": profile_id,
        "role": body.role,
        "status": "invited",
        "is_primary": True,
        "invited_by": ctx["profile_id"],
        "invited_at": now,
        "created_at": now,
        "updated_at": now,
    }).execute()

    # 4. Audit + invite log
    client.table("member_invites").upsert({
        "tenant_id": tenant_id,
        "email": email,
        "first_name": body.first_name,
        "last_name": body.last_name,
        "role": body.role,
        "invited_by": ctx["profile_id"],
        "status": "sent" if invite_sent else "sent_silent",
        "sent_at": now,
        "metadata_json": {"profile_id": profile_id, "invite_email_dispatched": invite_sent},
        "updated_at": now,
    }, on_conflict="tenant_id,email").execute()

    audit_log(tenant_id, ctx["profile_id"], "member.invited",
              resource_type="profile", resource_id=profile_id,
              metadata={"email": email, "role": body.role, "invite_email_dispatched": invite_sent})

    fresh = client.table("users_profile").select("*").eq("id", profile_id).limit(1).execute()
    return _profile_to_member(fresh.data[0])


@router.post("/{member_id}/resend-invite", response_model=MemberOut)
def resend_invite(
    member_id: str,
    ctx: dict = Depends(require_permission(P_TENANT_MEMBERS_WRITE)),
):
    client = db()
    r = client.table("users_profile").select("*").eq("id", member_id).eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Member not found")
    m = r.data[0]
    if m.get("status") != "invited":
        raise HTTPException(400, "Member is not in 'invited' state")

    metadata = {"first_name": m.get("first_name"), "last_name": m.get("last_name"),
                "tenant_id": ctx["tenant_id"], "invited_role": m.get("role")}
    try:
        _supabase_invite_user(m["email"], redirect_to=None, metadata=metadata)
    except HTTPException as e:
        # Even if email fails, increment resend count for audit.
        logger.warning(f"Resend invite failed: {e.detail}")

    now = _now_iso()
    # Bump resend count + last_resent_at on the matching invite row.
    inv = client.table("member_invites").select("*").eq("tenant_id", ctx["tenant_id"]).eq("email", m["email"]).limit(1).execute()
    if inv.data:
        client.table("member_invites").update({
            "resend_count": (inv.data[0].get("resend_count") or 0) + 1,
            "last_resent_at": now,
            "updated_at": now,
        }).eq("id", inv.data[0]["id"]).execute()

    audit_log(ctx["tenant_id"], ctx["profile_id"], "member.invite_resent",
              resource_type="profile", resource_id=member_id,
              metadata={"email": m["email"]})

    return _profile_to_member(m)


@router.patch("/{member_id}", response_model=MemberOut)
def update_member(
    member_id: str,
    body: MemberUpdate,
    ctx: dict = Depends(require_permission(P_TENANT_MEMBERS_WRITE)),
):
    """Change role or status. tenant_admin cannot self-demote the LAST admin."""
    client = db()
    r = client.table("users_profile").select("*").eq("id", member_id).eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Member not found")
    m = r.data[0]

    # Block self-edit of role/status to prevent foot-guns
    if m["id"] == ctx["profile_id"] and (body.role or body.status):
        raise HTTPException(400, "You cannot modify your own role or status")

    # Block tenant_admin from touching a super_admin
    if m.get("role") == "super_admin" and not is_super_admin(ctx.get("role")):
        raise HTTPException(403, "Only a super_admin can modify a super_admin")

    update = {"updated_at": _now_iso()}
    audit_meta = {}

    # Identity fields (first_name / last_name) — editable by anyone with write
    # permission (including the user editing themselves).
    if body.first_name is not None:
        fn = body.first_name.strip()
        if fn != (m.get("first_name") or ""):
            update["first_name"] = fn or None
            audit_meta["first_name_from"] = m.get("first_name")
            audit_meta["first_name_to"] = fn or None
    if body.last_name is not None:
        ln = body.last_name.strip()
        if ln != (m.get("last_name") or ""):
            update["last_name"] = ln or None
            audit_meta["last_name_from"] = m.get("last_name")
            audit_meta["last_name_to"] = ln or None

    if body.role is not None:
        _validate_role(body.role, allow_super_admin=is_super_admin(ctx.get("role")))
        # Don't let tenant_admin demote the last remaining admin in their tenant
        if body.role != "tenant_admin" and m.get("role") == "tenant_admin":
            others = client.table("users_profile").select("id") \
                .eq("tenant_id", ctx["tenant_id"]).eq("role", "tenant_admin") \
                .neq("id", member_id).execute()
            if not others.data:
                raise HTTPException(400, "Cannot demote the last tenant_admin")
        update["role"] = body.role
        audit_meta["role_from"] = m.get("role")
        audit_meta["role_to"] = body.role

    if body.status is not None:
        if body.status not in {"active", "suspended"}:
            raise HTTPException(400, "Status must be 'active' or 'suspended'")
        update["status"] = body.status
        audit_meta["status_from"] = m.get("status")
        audit_meta["status_to"] = body.status
        if body.status == "suspended":
            update["suspended_at"] = _now_iso()
            update["suspended_by"] = ctx["profile_id"]
        else:
            update["suspended_at"] = None
            update["suspended_by"] = None

    if len(update) == 1:  # only updated_at
        return _profile_to_member(m)

    client.table("users_profile").update(update).eq("id", member_id).execute()
    # Mirror role/status to memberships
    mem_update = {k: v for k, v in update.items() if k in ("role", "status") or k == "updated_at"}
    if mem_update:
        client.table("tenant_memberships").update(mem_update) \
            .eq("tenant_id", ctx["tenant_id"]).eq("profile_id", member_id).execute()

    audit_log(ctx["tenant_id"], ctx["profile_id"], "member.updated",
              resource_type="profile", resource_id=member_id,
              metadata=audit_meta)

    fresh = client.table("users_profile").select("*").eq("id", member_id).limit(1).execute()
    return _profile_to_member(fresh.data[0])


@router.delete("/{member_id}")
def remove_member(
    member_id: str,
    ctx: dict = Depends(require_permission(P_TENANT_MEMBERS_WRITE)),
):
    """Remove a member from the current tenant.

    For MVP this also deletes the users_profile row (since profile is
    tenant-scoped). The auth.user is NOT deleted — if they exist in
    another tenant or as super_admin elsewhere they can still log in.
    """
    client = db()
    r = client.table("users_profile").select("*").eq("id", member_id).eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Member not found")
    m = r.data[0]

    if m["id"] == ctx["profile_id"]:
        raise HTTPException(400, "You cannot remove yourself")
    if m.get("role") == "super_admin" and not is_super_admin(ctx.get("role")):
        raise HTTPException(403, "Only a super_admin can remove a super_admin")
    # Protect last admin
    if m.get("role") == "tenant_admin":
        others = client.table("users_profile").select("id") \
            .eq("tenant_id", ctx["tenant_id"]).eq("role", "tenant_admin") \
            .neq("id", member_id).execute()
        if not others.data:
            raise HTTPException(400, "Cannot remove the last tenant_admin")

    client.table("tenant_memberships").delete() \
        .eq("tenant_id", ctx["tenant_id"]).eq("profile_id", member_id).execute()
    client.table("users_profile").delete().eq("id", member_id).execute()

    audit_log(ctx["tenant_id"], ctx["profile_id"], "member.removed",
              resource_type="profile", resource_id=member_id,
              metadata={"email": m.get("email"), "role": m.get("role")})

    return {"deleted": True, "id": member_id}
