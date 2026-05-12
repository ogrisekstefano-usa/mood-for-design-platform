"""Super Admin — cross-tenant management.

Routes prefixed at /api/super. All require role=super_admin.
"""
import uuid
import re
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from pydantic import BaseModel, Field
from middleware.auth import get_current_user
from core.permissions import (
    is_super_admin, P_SUPER_TENANTS_READ, P_SUPER_TENANTS_WRITE,
    P_SUPER_TENANTS_DELETE, P_SUPER_MODULES, P_SUPER_FEATURES,
    P_SUPER_IMPERSONATE, P_SUPER_ANALYTICS,
)
from core.tenant_context import (
    get_tenant_settings, upsert_tenant_setting, audit_log, require_permission,
)
from core.modules import get_all_modules, default_enabled_modules
from core.feature_flags import get_all_flags, resolve_flags
from database import db

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _slugify(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")
    return s[:40] or "studio"


# ── Schemas ──────────────────────────────────────────────────────────────────
class TenantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: Optional[str] = None
    default_language: str = "en-US"
    plan: str = "trial"


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None  # active | suspended | archived
    plan: Optional[str] = None
    default_language: Optional[str] = None
    active_languages: Optional[list] = None


class ModulesUpdate(BaseModel):
    enabled: list  # list of module IDs


class FlagsUpdate(BaseModel):
    overrides: dict  # {flag_id: bool}


# ── Tenants list / detail ────────────────────────────────────────────────────
@router.get("/tenants")
def list_tenants(
    status: str = Query(None),
    q: str = Query(None),
    limit: int = Query(100, le=500),
    current_user: dict = Depends(require_permission(P_SUPER_TENANTS_READ)),
):
    client = db()
    query = client.table("tenants").select("*")
    if status:
        query = query.eq("status", status)
    r = query.order("created_at", desc=True).limit(limit).execute()
    tenants = r.data or []
    if q:
        ql = q.lower()
        tenants = [t for t in tenants if ql in (t.get("name") or "").lower() or ql in (t.get("slug") or "").lower()]

    # Enrich with member count + last activity (1 extra query batch each — small N)
    for t in tenants:
        mc = client.table("users_profile").select("id", count="exact").eq("tenant_id", t["id"]).execute()
        t["member_count"] = mc.count or 0
        plan_setting = get_tenant_settings(t["id"], "plan", {"name": "trial"})
        t["plan"] = plan_setting.get("name") if isinstance(plan_setting, dict) else "trial"
    return {"data": tenants, "total": len(tenants)}


@router.get("/tenants/{tenant_id}")
def get_tenant_detail(tenant_id: str,
                      current_user: dict = Depends(require_permission(P_SUPER_TENANTS_READ))):
    client = db()
    r = client.table("tenants").select("*").eq("id", tenant_id).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Tenant not found")
    t = r.data[0]

    members = client.table("users_profile").select("id, email, first_name, last_name, role, status").eq("tenant_id", tenant_id).execute()
    leads_count = (client.table("leads").select("id", count="exact").eq("tenant_id", tenant_id).execute().count) or 0
    projects_count = (client.table("projects").select("id", count="exact").eq("tenant_id", tenant_id).execute().count) or 0
    proposals_count = (client.table("proposals").select("id", count="exact").eq("tenant_id", tenant_id).execute().count) or 0
    moodboards_count = (client.table("moodboards").select("id", count="exact").eq("tenant_id", tenant_id).execute().count) or 0

    enabled_modules = get_tenant_settings(tenant_id, "modules.enabled", None) or default_enabled_modules()
    flag_overrides = get_tenant_settings(tenant_id, "feature_flags", {}) or {}
    plan = get_tenant_settings(tenant_id, "plan", {"name": "trial"})

    return {
        "tenant": t,
        "members": members.data or [],
        "usage": {
            "leads": leads_count, "projects": projects_count,
            "proposals": proposals_count, "moodboards": moodboards_count,
        },
        "enabled_modules": enabled_modules,
        "feature_flags": resolve_flags(flag_overrides),
        "feature_flag_overrides": flag_overrides,
        "plan": plan,
    }


# ── Create tenant (super-admin orchestration; does NOT create auth user) ─────
@router.post("/tenants", status_code=201)
def create_tenant(body: TenantCreate,
                  current_user: dict = Depends(require_permission(P_SUPER_TENANTS_WRITE))):
    client = db()
    slug = (body.slug or _slugify(body.name)) + "-" + str(uuid.uuid4())[:6]
    tid = str(uuid.uuid4())
    now = _now()
    client.table("tenants").insert({
        "id": tid, "name": body.name, "slug": slug, "status": "active",
        "default_language": body.default_language,
        "active_languages": ["en-US", "en-GB", "it", "fr", "de", "es"],
        "created_at": now, "updated_at": now,
    }).execute()
    upsert_tenant_setting(tid, "plan", {"name": body.plan})
    upsert_tenant_setting(tid, "modules.enabled", default_enabled_modules())
    audit_log(tid, current_user["profile_id"], "tenant.create",
              resource_type="tenant", resource_id=tid, metadata={"name": body.name})
    return {"id": tid, "slug": slug, "name": body.name}


# ── Update tenant ────────────────────────────────────────────────────────────
@router.put("/tenants/{tenant_id}")
def update_tenant(tenant_id: str, body: TenantUpdate,
                  current_user: dict = Depends(require_permission(P_SUPER_TENANTS_WRITE))):
    client = db()
    payload = {k: v for k, v in body.model_dump().items() if v is not None and k != "plan"}
    if payload:
        payload["updated_at"] = _now()
        r = client.table("tenants").update(payload).eq("id", tenant_id).execute()
        if not r.data:
            raise HTTPException(404, "Tenant not found")
    if body.plan is not None:
        upsert_tenant_setting(tenant_id, "plan", {"name": body.plan})
    audit_log(tenant_id, current_user["profile_id"], "tenant.update",
              resource_type="tenant", resource_id=tenant_id, metadata=payload)
    return {"message": "updated"}


@router.delete("/tenants/{tenant_id}")
def delete_tenant(tenant_id: str,
                  current_user: dict = Depends(require_permission(P_SUPER_TENANTS_DELETE))):
    """Soft-delete: status='archived'."""
    client = db()
    r = client.table("tenants").update({"status": "archived", "updated_at": _now()}).eq("id", tenant_id).execute()
    if not r.data:
        raise HTTPException(404, "Tenant not found")
    audit_log(tenant_id, current_user["profile_id"], "tenant.archive",
              resource_type="tenant", resource_id=tenant_id)
    return {"message": "archived"}


# ── Module activation ────────────────────────────────────────────────────────
@router.put("/tenants/{tenant_id}/modules")
def set_modules(tenant_id: str, body: ModulesUpdate,
                current_user: dict = Depends(require_permission(P_SUPER_MODULES))):
    upsert_tenant_setting(tenant_id, "modules.enabled", body.enabled)
    audit_log(tenant_id, current_user["profile_id"], "modules.update",
              resource_type="tenant", resource_id=tenant_id, metadata={"enabled": body.enabled})
    return {"enabled": body.enabled}


# ── Feature flags ────────────────────────────────────────────────────────────
@router.put("/tenants/{tenant_id}/feature-flags")
def set_flags(tenant_id: str, body: FlagsUpdate,
              current_user: dict = Depends(require_permission(P_SUPER_FEATURES))):
    current = get_tenant_settings(tenant_id, "feature_flags", {}) or {}
    current.update(body.overrides)
    upsert_tenant_setting(tenant_id, "feature_flags", current)
    audit_log(tenant_id, current_user["profile_id"], "flags.update",
              resource_type="tenant", resource_id=tenant_id, metadata={"overrides": body.overrides})
    return {"feature_flags": resolve_flags(current), "overrides": current}


# ── Global analytics ─────────────────────────────────────────────────────────
@router.get("/stats")
def global_stats(current_user: dict = Depends(require_permission(P_SUPER_ANALYTICS))):
    client = db()
    def cnt(table, **filters):
        q = client.table(table).select("id", count="exact")
        for k, v in filters.items():
            q = q.eq(k, v)
        return q.execute().count or 0
    return {
        "tenants": {
            "total": cnt("tenants"),
            "active": cnt("tenants", status="active"),
            "suspended": cnt("tenants", status="suspended"),
            "archived": cnt("tenants", status="archived"),
        },
        "users": cnt("users_profile"),
        "leads": cnt("leads"),
        "projects": cnt("projects"),
        "proposals": cnt("proposals"),
        "moodboards": cnt("moodboards"),
        "magazine_posts": cnt("magazine_posts"),
    }


@router.get("/audit-logs")
def audit_logs(tenant_id: str = Query(None),
               limit: int = Query(50, le=200),
               current_user: dict = Depends(require_permission(P_SUPER_TENANTS_READ))):
    client = db()
    q = client.table("audit_logs").select("*")
    if tenant_id:
        q = q.eq("tenant_id", tenant_id)
    r = q.order("created_at", desc=True).limit(limit).execute()
    return {"data": r.data or []}


# ── Impersonation token (issues a marker only; backend honors X-Tenant-Override header) ─
@router.post("/tenants/{tenant_id}/impersonate")
def impersonate(tenant_id: str,
                current_user: dict = Depends(require_permission(P_SUPER_IMPERSONATE))):
    client = db()
    r = client.table("tenants").select("id, name, slug, status").eq("id", tenant_id).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Tenant not found")
    audit_log(tenant_id, current_user["profile_id"], "tenant.impersonate.start",
              resource_type="tenant", resource_id=tenant_id)
    return {"tenant": r.data[0], "instruction": "Set header X-Tenant-Override=<tenant_id> for impersonated calls."}


# ── Module + Flag catalogs (so super-admin UI can render dynamic toggles) ────
@router.get("/catalog/modules")
def catalog_modules(current_user: dict = Depends(require_permission(P_SUPER_MODULES))):
    return {"modules": get_all_modules()}


@router.get("/catalog/flags")
def catalog_flags(current_user: dict = Depends(require_permission(P_SUPER_FEATURES))):
    return {"flags": get_all_flags()}
