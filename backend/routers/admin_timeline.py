"""Admin Timeline router (M2).

Surfaces:
  GET /api/admin/tenants/{tid}/timeline
  GET /api/admin/tenants/{tid}/timeline/filter-options

Scope: advisor/admin. Advisor must own a studio_relation on the tenant.
"""
from __future__ import annotations
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text

from database import AsyncSessionLocal
from routers._advisor_scope import require_advisor_scope
from services import timeline as tl

router = APIRouter(prefix="/api/admin", tags=["admin-timeline"])


async def _enforce_scope_on_tenant(scope: dict, tid: str) -> None:
    if scope["is_super_admin"]:
        return
    async with AsyncSessionLocal() as s:
        ok = (await s.execute(text("""
            SELECT 1 FROM studio_relations
             WHERE tenant_id = CAST(:tid AS uuid)
               AND owner_advisor_id = CAST(:a AS uuid)
             LIMIT 1
        """), {"tid": tid, "a": scope.get("advisor_id")})).scalar()
    if not ok:
        raise HTTPException(status_code=404, detail="Tenant not in scope")


@router.get("/tenants/{tid}/timeline")
async def get_timeline(
    tid: str,
    sources:       Optional[str] = Query(None, description="csv list: event,email,activity"),
    type_codes:    Optional[str] = Query(None, description="csv list"),
    since:         Optional[datetime] = Query(None),
    until:         Optional[datetime] = Query(None),
    owner:         Optional[str] = Query(None),
    contact_id:    Optional[str] = Query(None),
    manual_only:   bool = Query(False),
    cursor:        Optional[str] = Query(None),
    limit:         int = Query(30, ge=1, le=100),
    scope: dict = Depends(require_advisor_scope),
):
    await _enforce_scope_on_tenant(scope, tid)
    async with AsyncSessionLocal() as s:
        return await tl.list_timeline(
            s, tenant_id=tid, scope="admin",
            sources=[x.strip() for x in sources.split(",")] if sources else None,
            type_codes=[x.strip() for x in type_codes.split(",")] if type_codes else None,
            since=since, until=until,
            owner_user_id=owner, contact_id=contact_id,
            manual_only=manual_only,
            cursor=cursor, limit=limit,
        )


@router.get("/tenants/{tid}/timeline/filter-options")
async def get_timeline_filter_options(
    tid: str, scope: dict = Depends(require_advisor_scope),
):
    await _enforce_scope_on_tenant(scope, tid)
    async with AsyncSessionLocal() as s:
        return await tl.list_filter_options(s, tenant_id=tid, scope="admin")
