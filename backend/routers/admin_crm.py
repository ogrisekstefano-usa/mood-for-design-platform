"""Admin CRM router (M1).

Surfaces:
  - /api/admin/tenants                     list (paginated, filters, search)
  - /api/admin/tenants/{tid}/overview      header KPI + primary + recent
  - /api/admin/tenants/{tid}/contacts/*    CRUD multi-contact
  - /api/admin/tenants/{tid}/activities/*  preview + quick-action (M1)
  - /api/admin/tenants/{tid}/assign-owner  organization-level owner
  - /api/admin/users/eligible-owners       picker (admin/editor/advisor)

Scope:
  - role admin/editor → all tenants
  - role advisor      → only tenants linked via studio_relations.owner_advisor_id
"""
from __future__ import annotations
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy import text

from database import AsyncSessionLocal
from routers._advisor_scope import require_advisor_scope
from services import tenant_contacts as tc
from services import relationship_activities as ra

router = APIRouter(prefix="/api/admin", tags=["admin-crm"])


def _scope_clause(scope: dict, tenant_col: str = "t.id",
                  relation_col: str = "sr.owner_advisor_id") -> tuple[str, dict]:
    """Build WHERE clause based on advisor scope."""
    if scope["is_super_admin"]:
        return "TRUE", {}
    advisor_id = scope.get("advisor_id")
    if not advisor_id:
        # Advisor without identity → see nothing
        return "FALSE", {}
    # Tenant must be linked to a studio_relation owned by this advisor
    return (
        f"EXISTS (SELECT 1 FROM studio_relations sr "
        f" WHERE sr.tenant_id = {tenant_col} AND {relation_col} = CAST(:scope_advisor_id AS uuid))",
        {"scope_advisor_id": advisor_id},
    )


# ─── Tenants list ─────────────────────────────────────────────────────

@router.get("/tenants")
async def list_tenants(
    advisor:  Optional[str] = Query(None),
    market:   Optional[str] = Query(None),
    status:   Optional[str] = Query(None),
    role:     Optional[str] = Query(None),    # filter by tenant having a contact with this role
    q:        Optional[str] = Query(None),
    limit:    int = Query(50, ge=1, le=200),
    offset:   int = Query(0, ge=0),
    scope: dict = Depends(require_advisor_scope),
):
    scope_where, scope_params = _scope_clause(scope)
    where = [scope_where, "t.slug <> 'mood-corporate'"]
    params: dict[str, Any] = {"limit": limit, "offset": offset, **scope_params}

    if status:
        where.append("t.status = :status")
        params["status"] = status
    if advisor:
        where.append("EXISTS (SELECT 1 FROM studio_relations sr WHERE sr.tenant_id = t.id AND sr.owner_advisor_id = CAST(:advisor AS uuid))")
        params["advisor"] = advisor
    if market:
        where.append("EXISTS (SELECT 1 FROM studio_relations sr WHERE sr.tenant_id = t.id AND sr.country = :market)")
        params["market"] = market
    if role:
        where.append("EXISTS (SELECT 1 FROM tenant_contacts c WHERE c.tenant_id = t.id AND c.role_code = :role AND c.status='active')")
        params["role"] = role
    if q:
        where.append("""(
            to_tsvector('simple',
                coalesce(t.name,'')||' '||coalesce(t.slug,'')
            ) @@ plainto_tsquery('simple', :q)
            OR EXISTS (SELECT 1 FROM studio_relations sr WHERE sr.tenant_id = t.id AND
              to_tsvector('simple',
                coalesce(sr.studio_name,'')||' '||coalesce(sr.website,'')||' '||coalesce(sr.legal_name,'')
              ) @@ plainto_tsquery('simple', :q)
            )
        )""")
        params["q"] = q

    sql = f"""
        SELECT t.id, t.name, t.slug, t.status, t.created_at,
               sr.studio_name, sr.city, sr.country,
               sr.owner_advisor_id,
               coalesce(au.full_name, au.email) AS advisor_display,
               (SELECT count(*) FROM tenant_contacts c
                 WHERE c.tenant_id = t.id AND c.status='active')      AS contacts_count,
               (SELECT count(*) FROM relationship_activities a
                 WHERE a.tenant_id = t.id
                   AND a.next_step_due_at IS NOT NULL
                   AND a.completed_at   IS NULL
                   AND a.archived_at    IS NULL)                      AS open_followups_count,
               (SELECT count(*) FROM relationship_activities a
                 WHERE a.tenant_id = t.id
                   AND a.next_step_due_at IS NOT NULL
                   AND a.next_step_due_at < NOW()
                   AND a.completed_at   IS NULL
                   AND a.archived_at    IS NULL)                      AS overdue_followups_count,
               sr.last_activity_at,
               t.tenant_relationship_owner_user_id,
               coalesce(ou.full_name, ou.email)   AS tenant_owner_display
          FROM tenants t
          LEFT JOIN studio_relations sr ON sr.tenant_id = t.id
          LEFT JOIN users au ON au.id = sr.owner_advisor_id
          LEFT JOIN users ou ON ou.id = t.tenant_relationship_owner_user_id
         WHERE {' AND '.join(where)}
         ORDER BY coalesce(sr.last_activity_at, t.created_at) DESC NULLS LAST
         LIMIT :limit OFFSET :offset
    """
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(text(sql), params)).mappings().all()
        total = (await s.execute(text(
            f"SELECT count(*) FROM tenants t WHERE {' AND '.join(where)}"
        ), params)).scalar()
    return {"items": [dict(r) for r in rows], "total": total, "limit": limit, "offset": offset}


# ─── Tenant overview ──────────────────────────────────────────────────

@router.get("/tenants/{tid}/overview")
async def tenant_overview(tid: str, scope: dict = Depends(require_advisor_scope)):
    # Enforce scope: advisor must own a relation on this tenant
    if not scope["is_super_admin"]:
        async with AsyncSessionLocal() as s:
            ok = (await s.execute(text("""
                SELECT 1 FROM studio_relations
                 WHERE tenant_id = CAST(:tid AS uuid)
                   AND owner_advisor_id = CAST(:advisor AS uuid)
                 LIMIT 1
            """), {"tid": tid, "advisor": scope.get("advisor_id")})).scalar()
        if not ok:
            raise HTTPException(status_code=404, detail="Tenant not in scope")

    async with AsyncSessionLocal() as s:
        tenant = (await s.execute(text("""
            SELECT t.id, t.name, t.slug, t.status, t.created_at,
                   t.tenant_relationship_owner_user_id,
                   t.tenant_relationship_owner_assigned_at,
                   coalesce(ou.full_name, ou.email) AS tenant_owner_display
              FROM tenants t
              LEFT JOIN users ou ON ou.id = t.tenant_relationship_owner_user_id
             WHERE t.id = CAST(:tid AS uuid)
        """), {"tid": tid})).mappings().first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        relation = (await s.execute(text("""
            SELECT sr.id, sr.studio_name, sr.city, sr.country, sr.website,
                   sr.contact_email, sr.phone_prefix, sr.phone_number,
                   sr.owner_advisor_id, sr.last_activity_at,
                   coalesce(au.full_name, au.email) AS advisor_display,
                   au.email AS advisor_email
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

    primary = await tc.list_contacts(tid, status="active", limit=200)
    primary_contact = next((c for c in primary if c["is_primary"]), primary[0] if primary else None)
    recent = (await ra.list_activities(tid, limit=3))["items"]

    return {
        "tenant":   dict(tenant),
        "relation": dict(relation) if relation else None,
        "primary_contact": primary_contact,
        "kpis": kpis,
        "recent_activities": recent,
    }


# ─── Contacts CRUD ────────────────────────────────────────────────────

@router.get("/tenants/{tid}/contacts")
async def list_contacts(
    tid: str,
    role: Optional[str] = Query(None),
    status: Optional[str] = Query("active"),
    owner: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    scope: dict = Depends(require_advisor_scope),
):
    # Advisor scope enforcement
    if not scope["is_super_admin"]:
        async with AsyncSessionLocal() as s:
            ok = (await s.execute(text("""
                SELECT 1 FROM studio_relations WHERE tenant_id = CAST(:tid AS uuid)
                   AND owner_advisor_id = CAST(:a AS uuid) LIMIT 1
            """), {"tid": tid, "a": scope.get("advisor_id")})).scalar()
        if not ok:
            raise HTTPException(status_code=404, detail="Tenant not in scope")
    return await tc.list_contacts(tid, role_code=role, status=status,
                                  owner_user_id=owner, q=q)


@router.get("/tenants/{tid}/contacts/{cid}")
async def get_contact(tid: str, cid: str,
                      scope: dict = Depends(require_advisor_scope)):
    return await tc.get_contact(tid, cid)


@router.post("/tenants/{tid}/contacts")
async def create_contact(tid: str, payload: dict = Body(...),
                          scope: dict = Depends(require_advisor_scope)):
    rel_id = None
    async with AsyncSessionLocal() as s:
        rel_id = (await s.execute(text("""
            SELECT id FROM studio_relations WHERE tenant_id = CAST(:tid AS uuid)
             ORDER BY created_at DESC LIMIT 1
        """), {"tid": tid})).scalar()
    return await tc.create_contact(
        tid, payload, actor_user_id=scope.get("user_id"),
        studio_relation_id=str(rel_id) if rel_id else None,
        source_default="manual")


@router.patch("/tenants/{tid}/contacts/{cid}")
async def update_contact(tid: str, cid: str, payload: dict = Body(...),
                          scope: dict = Depends(require_advisor_scope)):
    return await tc.update_contact(tid, cid, payload,
                                    actor_user_id=scope.get("user_id"),
                                    allow_owner_change=True)


@router.delete("/tenants/{tid}/contacts/{cid}")
async def archive_contact(tid: str, cid: str,
                           scope: dict = Depends(require_advisor_scope)):
    return await tc.archive_contact(tid, cid, actor_user_id=scope.get("user_id"))


@router.post("/tenants/{tid}/contacts/{cid}/set-primary")
async def set_primary(tid: str, cid: str,
                       scope: dict = Depends(require_advisor_scope)):
    return await tc.set_primary(tid, cid, actor_user_id=scope.get("user_id"))


@router.post("/tenants/{tid}/contacts/{cid}/assign-owner")
async def assign_contact_owner(tid: str, cid: str, payload: dict = Body(...),
                                scope: dict = Depends(require_advisor_scope)):
    owner = payload.get("relationship_owner_user_id")
    return await tc.assign_owner(tid, cid, owner,
                                  actor_user_id=scope.get("user_id"))


# ─── Activities preview + quick action ────────────────────────────────

@router.get("/tenants/{tid}/activities")
async def list_activities(tid: str,
                           contact_id: Optional[str] = Query(None),
                           limit: int = Query(10, ge=1, le=50),
                           scope: dict = Depends(require_advisor_scope)):
    return (await ra.list_activities(tid, contact_id=contact_id, limit=limit))["items"]


@router.post("/tenants/{tid}/activities/quick")
async def quick_activity(tid: str, payload: dict = Body(...),
                          scope: dict = Depends(require_advisor_scope)):
    if not scope.get("user_id"):
        raise HTTPException(status_code=403, detail="No user identity")
    return await ra.create_quick_activity(tid, payload,
                                           owner_user_id=scope["user_id"])


# ─── Tenant relationship owner (organization-level) ───────────────────

@router.post("/tenants/{tid}/assign-owner")
async def assign_tenant_owner(tid: str, payload: dict = Body(...),
                               scope: dict = Depends(require_advisor_scope)):
    """Set/clear the organization-level relationship_owner_user_id."""
    if not scope["is_super_admin"] and scope.get("user_id") != payload.get("tenant_relationship_owner_user_id"):
        # Advisor can only self-assign
        raise HTTPException(status_code=403, detail="Only admin/editor or self-assign")
    new_owner = payload.get("tenant_relationship_owner_user_id")
    async with AsyncSessionLocal() as s:
        r = await s.execute(text("""
            UPDATE tenants
               SET tenant_relationship_owner_user_id = CAST(:o AS uuid),
                   tenant_relationship_owner_assigned_at = NOW(),
                   tenant_relationship_owner_assigned_by = CAST(:by AS uuid)
             WHERE id = CAST(:tid AS uuid)
            RETURNING id, tenant_relationship_owner_user_id,
                      tenant_relationship_owner_assigned_at
        """), {"o": new_owner, "by": scope.get("user_id"), "tid": tid})
        row = r.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Tenant not found")
        await s.commit()
    return dict(row)


# ─── Eligible owners picker ───────────────────────────────────────────

@router.get("/users/eligible-owners")
async def eligible_owners(q: Optional[str] = Query(None),
                           limit: int = Query(50, ge=1, le=200),
                           scope: dict = Depends(require_advisor_scope)):
    where = ["lower(role) IN ('admin','editor','advisor')"]
    params: dict[str, Any] = {"limit": limit}
    if q:
        where.append("(lower(email) LIKE :q OR lower(coalesce(full_name,'')) LIKE :q)")
        params["q"] = f"%{q.lower()}%"
    sql = f"""
        SELECT id, email, full_name, role,
               coalesce(full_name, email) AS display
          FROM users WHERE {' AND '.join(where)}
         ORDER BY display
         LIMIT :limit
    """
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(text(sql), params)).mappings().all()
    return [dict(r) for r in rows]


# ─── Global search ────────────────────────────────────────────────────

@router.get("/search")
async def global_search(q: str = Query(...),
                         limit: int = Query(20, ge=1, le=50),
                         scope: dict = Depends(require_advisor_scope)):
    if not q.strip():
        return {"q": q, "results": []}
    results: list[dict] = []
    async with AsyncSessionLocal() as s:
        # Tenant matches (scope-aware)
        scope_where, scope_params = _scope_clause(scope)
        rows = (await s.execute(text(f"""
            SELECT t.id, t.name, t.slug, sr.studio_name, sr.city, sr.country
              FROM tenants t
              LEFT JOIN studio_relations sr ON sr.tenant_id = t.id
             WHERE {scope_where}
               AND (
                 to_tsvector('simple', coalesce(t.name,'')||' '||coalesce(t.slug,''))
                   @@ plainto_tsquery('simple', :q)
                 OR (sr.id IS NOT NULL AND
                     to_tsvector('simple',
                       coalesce(sr.studio_name,'')||' '||coalesce(sr.website,'')||' '||coalesce(sr.legal_name,''))
                     @@ plainto_tsquery('simple', :q))
               )
             LIMIT :limit
        """), {**scope_params, "q": q, "limit": limit})).mappings().all()
        for r in rows:
            sub = (r['studio_name'] or r['name'] or '').strip()
            city = (r['city'] or '').strip()
            country = (r['country'] or '').strip()
            sub_parts = [p for p in [city, country] if p]
            results.append({
                "type": "tenant",
                "id": str(r['id']),
                "label": r['studio_name'] or r['name'],
                "subtitle": " · ".join(sub_parts) if sub_parts else (r['slug'] or ''),
                "url": f"/command-center/tenants/{r['id']}",
            })

        # Contact matches
        rows = (await s.execute(text(f"""
            SELECT c.id, c.tenant_id, c.first_name, c.last_name, c.email, c.role_code,
                   sr.studio_name
              FROM tenant_contacts c
              LEFT JOIN studio_relations sr ON sr.tenant_id = c.tenant_id
             WHERE c.status='active'
               AND ({scope_where.replace('t.id','c.tenant_id')})
               AND to_tsvector('simple',
                     coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')||' '||
                     coalesce(c.email,'')||' '||coalesce(c.phone_number,''))
                   @@ plainto_tsquery('simple', :q)
             LIMIT :limit
        """), {**scope_params, "q": q, "limit": limit})).mappings().all()
        for r in rows:
            full = f"{r['first_name']} {r['last_name'] or ''}".strip()
            results.append({
                "type": "contact",
                "id": str(r['id']),
                "label": f"{full} · {r['role_code']}",
                "subtitle": f"{r['studio_name'] or ''} · {r['email'] or ''}".strip(' ·'),
                "url": f"/command-center/tenants/{r['tenant_id']}?tab=contacts&contact={r['id']}",
            })

    return {"q": q, "results": results[:limit]}
