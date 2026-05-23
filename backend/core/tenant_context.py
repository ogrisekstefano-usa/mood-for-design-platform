"""Tenant context resolution + impersonation support.

A super_admin may pass `X-Tenant-Override: <tenant_id>` to operate inside another
tenant's data (audit-logged). Regular users always use their profile.tenant_id.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import HTTPException, Request, Depends
from middleware.auth import get_current_user
from core.permissions import is_super_admin, has_permission
from database import db

logger = logging.getLogger(__name__)


def get_tenant_context(request: Request, current_user: dict = Depends(get_current_user)) -> dict:
    """Resolve effective tenant_id with the following precedence:

      1. Explicit `X-Tenant-Override` (super_admin only — audit-logged).
      2. Host-based subdomain resolution (`request.state.resolved_tenant`
         populated by TenantResolverMiddleware) — but ONLY honoured when
         the resolved tenant matches the user's own tenant or when the
         user is a super_admin (security: prevent tenant_admin of A from
         operating against tenant B by spoofing the Host header).
      3. JWT bearer's profile.tenant_id (default).
    """
    effective_tid = current_user["tenant_id"]
    impersonating = False
    resolved_subdomain: Optional[str] = None

    # (1) explicit override
    override = request.headers.get("X-Tenant-Override")
    if override and is_super_admin(current_user.get("role")):
        client = db()
        r = client.table("tenants").select("id, status").eq("id", override).limit(1).execute()
        if not r.data:
            raise HTTPException(404, "Override tenant not found")
        effective_tid = override
        impersonating = True

    # (2) subdomain-derived tenant (security-gated)
    elif getattr(request.state, "resolved_tenant", None):
        rt = request.state.resolved_tenant
        resolved_subdomain = rt.get("subdomain")
        host_tid = rt.get("tenant_id")
        if host_tid and host_tid == current_user["tenant_id"]:
            # User landing on their own subdomain — pass-through.
            effective_tid = host_tid
        elif host_tid and is_super_admin(current_user.get("role")):
            # SuperAdmin browsing into a tenant subdomain → impersonation.
            effective_tid = host_tid
            impersonating = True
        # else: mismatched subdomain → ignore (return user's own tenant)

    return {
        **current_user,
        "tenant_id": effective_tid,
        "impersonating": impersonating,
        "resolved_subdomain": resolved_subdomain,
    }


def get_tenant_settings(tenant_id: str, key: str, default=None):
    client = db()
    r = client.table("tenant_settings").select("value_json").eq("tenant_id", tenant_id).eq("key", key).limit(1).execute()
    if r.data:
        return r.data[0].get("value_json") or default
    return default


def upsert_tenant_setting(tenant_id: str, key: str, value: dict):
    client = db()
    now = datetime.now(timezone.utc).isoformat()
    existing = client.table("tenant_settings").select("id").eq("tenant_id", tenant_id).eq("key", key).limit(1).execute()
    if existing.data:
        client.table("tenant_settings").update({"value_json": value, "updated_at": now}).eq("id", existing.data[0]["id"]).execute()
    else:
        client.table("tenant_settings").insert({
            "id": str(uuid.uuid4()), "tenant_id": tenant_id, "key": key,
            "value_json": value, "created_at": now, "updated_at": now,
        }).execute()


def audit_log(tenant_id: Optional[str], user_id: Optional[str], action: str,
              resource_type: Optional[str] = None, resource_id: Optional[str] = None,
              metadata: Optional[Dict[str, Any]] = None):
    try:
        client = db()
        client.table("audit_logs").insert({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id, "user_id": user_id,
            "action": action,
            "resource_type": resource_type, "resource_id": resource_id,
            "metadata_json": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.warning(f"audit_log failed: {e}")


def require_permission(*perms: str):
    """FastAPI dependency that checks the user has every listed permission.

    Wraps `get_tenant_context` so the resulting dict has tenant scope (incl.
    impersonation) AND permission gating in one shot. Use this on every
    business-data route — never bare `Depends(get_tenant_context)` for
    sensitive endpoints.
    """
    def checker(ctx: dict = Depends(get_tenant_context)):
        role = ctx.get("role")
        for p in perms:
            if not has_permission(role, p):
                raise HTTPException(403, f"Missing permission: {p}")
        return ctx
    return checker
