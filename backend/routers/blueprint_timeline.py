"""Blueprint Timeline router (M2 · D4 founder mirror).

Surfaces:
  GET /api/blueprint/timeline
  GET /api/blueprint/timeline/filter-options

Scope: forced to JWT tenant_slug (founder). Visibility 'admin_only'
entries are filtered out via catalog flag.
"""
from __future__ import annotations
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from database import AsyncSessionLocal
from routers._auth import require_admin_tenant
from services import timeline as tl

router = APIRouter(prefix="/api/blueprint", tags=["blueprint-timeline"])


async def _tenant_id(tenant: dict) -> str:
    tid = tenant.get("id")
    if not tid:
        raise HTTPException(status_code=403, detail="No tenant in scope")
    return str(tid)


@router.get("/timeline")
async def get_my_timeline(
    sources:     Optional[str] = Query(None),
    type_codes:  Optional[str] = Query(None),
    since:       Optional[datetime] = Query(None),
    until:       Optional[datetime] = Query(None),
    contact_id:  Optional[str] = Query(None),
    manual_only: bool = Query(False),
    cursor:      Optional[str] = Query(None),
    limit:       int = Query(30, ge=1, le=100),
    tenant: dict = Depends(require_admin_tenant),
):
    tid = await _tenant_id(tenant)
    async with AsyncSessionLocal() as s:
        return await tl.list_timeline(
            s, tenant_id=tid, scope="founder",
            sources=[x.strip() for x in sources.split(",")] if sources else None,
            type_codes=[x.strip() for x in type_codes.split(",")] if type_codes else None,
            since=since, until=until,
            contact_id=contact_id,
            manual_only=manual_only,
            cursor=cursor, limit=limit,
        )


@router.get("/timeline/filter-options")
async def get_my_timeline_filter_options(
    tenant: dict = Depends(require_admin_tenant),
):
    tid = await _tenant_id(tenant)
    async with AsyncSessionLocal() as s:
        return await tl.list_filter_options(s, tenant_id=tid, scope="founder")
