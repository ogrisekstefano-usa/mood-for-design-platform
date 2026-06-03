"""Blueprint CRM router (M1 · D4 founder mirror).

Same shape as `admin_crm` but tenant-scoped to the JWT's `tenant_slug`.
"""
from __future__ import annotations
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body, Header
from sqlalchemy import text

from database import AsyncSessionLocal
from routers._auth import require_admin_tenant
from services import tenant_contacts as tc
from services import relationship_activities as ra


def _decode_user_id_from_auth(authorization: Optional[str]) -> Optional[str]:
    """Best-effort extraction of `sub` claim from Bearer JWT."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        from routers.auth import decode_token
        claims = decode_token(authorization.split(None, 1)[1].strip())
        return claims.get("sub")
    except Exception:
        return None


router = APIRouter(prefix="/api/blueprint", tags=["blueprint-crm"])


async def _tenant_id_from_scope(tenant: dict) -> str:
    """Resolve tenant.id from the require_admin_tenant payload."""
    tid = tenant.get("id")
    if not tid:
        raise HTTPException(status_code=403, detail="No tenant in scope")
    return str(tid)


# ─── Overview ─────────────────────────────────────────────────────────

@router.get("/overview")
async def overview(tenant: dict = Depends(require_admin_tenant)):
    tid = await _tenant_id_from_scope(tenant)
    async with AsyncSessionLocal() as s:
        t = (await s.execute(text("""
            SELECT t.id, t.name, t.slug, t.status, t.created_at,
                   t.tenant_relationship_owner_user_id,
                   coalesce(ou.full_name, ou.email) AS tenant_owner_display
              FROM tenants t
              LEFT JOIN users ou ON ou.id = t.tenant_relationship_owner_user_id
             WHERE t.id = CAST(:tid AS uuid)
        """), {"tid": tid})).mappings().first()
        if not t:
            raise HTTPException(status_code=404, detail="Tenant not found")
        relation = (await s.execute(text("""
            SELECT sr.id, sr.studio_name, sr.city, sr.country, sr.website,
                   sr.contact_email, sr.last_activity_at,
                   coalesce(au.full_name, au.email) AS advisor_display
              FROM studio_relations sr
              LEFT JOIN users au ON au.id = sr.owner_advisor_id
             WHERE sr.tenant_id = CAST(:tid AS uuid)
             ORDER BY sr.created_at DESC LIMIT 1
        """), {"tid": tid})).mappings().first()
        kpis = {
            "contacts_total": (await s.execute(text(
                "SELECT count(*) FROM tenant_contacts WHERE tenant_id = CAST(:tid AS uuid) AND status='active'"),
                {"tid": tid})).scalar(),
            "activities_30d": (await s.execute(text(
                "SELECT count(*) FROM relationship_activities WHERE tenant_id = CAST(:tid AS uuid) AND archived_at IS NULL AND occurred_at >= NOW() - INTERVAL '30 days'"),
                {"tid": tid})).scalar(),
            "last_activity_at": (await s.execute(text(
                "SELECT max(occurred_at) FROM relationship_activities WHERE tenant_id = CAST(:tid AS uuid) AND archived_at IS NULL"),
                {"tid": tid})).scalar(),
        }
    primary = await tc.list_contacts(tid, status="active")
    return {
        "tenant":   dict(t),
        "relation": dict(relation) if relation else None,
        "primary_contact": next((c for c in primary if c["is_primary"]),
                                 primary[0] if primary else None),
        "kpis": kpis,
        "recent_activities": (await ra.list_activities(tid, limit=3))["items"],
    }


# ─── Contacts (founder D4) ────────────────────────────────────────────

@router.get("/contacts")
async def list_my_contacts(
    role: Optional[str] = Query(None),
    status: Optional[str] = Query("active"),
    q: Optional[str] = Query(None),
    tenant: dict = Depends(require_admin_tenant),
):
    tid = await _tenant_id_from_scope(tenant)
    return await tc.list_contacts(tid, role_code=role, status=status, q=q)


@router.get("/contacts/{cid}")
async def get_my_contact(cid: str,
                           tenant: dict = Depends(require_admin_tenant)):
    tid = await _tenant_id_from_scope(tenant)
    return await tc.get_contact(tid, cid)


@router.post("/contacts")
async def create_my_contact(payload: dict = Body(...),
                             tenant: dict = Depends(require_admin_tenant)):
    tid = await _tenant_id_from_scope(tenant)
    # Defensive: strip any owner-change attempts (D4)
    payload.pop("relationship_owner_user_id", None)
    payload.pop("tenant_relationship_owner_user_id", None)
    # Auto-derive studio_relation_id so timeline events can attach
    async with AsyncSessionLocal() as s:
        rel_id = (await s.execute(text("""
            SELECT id FROM studio_relations WHERE tenant_id = CAST(:tid AS uuid)
             ORDER BY created_at DESC LIMIT 1
        """), {"tid": tid})).scalar()
    return await tc.create_contact(
        tid, payload, actor_user_id=None,
        studio_relation_id=str(rel_id) if rel_id else None,
        source_default="manual")


@router.patch("/contacts/{cid}")
async def update_my_contact(cid: str, payload: dict = Body(...),
                              tenant: dict = Depends(require_admin_tenant)):
    tid = await _tenant_id_from_scope(tenant)
    # D4: founder cannot change owner
    payload.pop("relationship_owner_user_id", None)
    payload.pop("tenant_relationship_owner_user_id", None)
    return await tc.update_contact(tid, cid, payload,
                                    allow_owner_change=False)


@router.delete("/contacts/{cid}")
async def archive_my_contact(cid: str,
                               tenant: dict = Depends(require_admin_tenant)):
    tid = await _tenant_id_from_scope(tenant)
    return await tc.archive_contact(tid, cid)


@router.post("/contacts/{cid}/set-primary")
async def set_primary_my_contact(cid: str,
                                   tenant: dict = Depends(require_admin_tenant)):
    tid = await _tenant_id_from_scope(tenant)
    return await tc.set_primary(tid, cid)


# ─── Activities (preview + quick-action) ─────────────────────────────

@router.get("/activities")
async def list_my_activities(
    contact_id: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    tenant: dict = Depends(require_admin_tenant),
):
    tid = await _tenant_id_from_scope(tenant)
    return (await ra.list_activities(tid, contact_id=contact_id, limit=limit))["items"]


@router.post("/activities/quick")
async def quick_my_activity(payload: dict = Body(...),
                              tenant: dict = Depends(require_admin_tenant),
                              authorization: Optional[str] = Header(default=None)):
    tid = await _tenant_id_from_scope(tenant)
    user_id = _decode_user_id_from_auth(authorization)
    if not user_id:
        # Fallback: look up the founder user via studio_relations.contact_email
        async with AsyncSessionLocal() as s:
            user_id = (await s.execute(text("""
                SELECT u.id FROM users u
                  JOIN studio_relations sr ON lower(sr.contact_email) = lower(u.email)
                 WHERE sr.tenant_id = CAST(:tid AS uuid)
                   AND u.role = 'owner'
                 ORDER BY u.created_at DESC LIMIT 1
            """), {"tid": tid})).scalar()
    if not user_id:
        raise HTTPException(status_code=403, detail="No founder identity")
    return await ra.create_quick_activity(tid, payload, owner_user_id=str(user_id))
