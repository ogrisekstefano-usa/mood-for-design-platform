"""Admin Activities router (M3 · Activity Log Advanced™)."""
from __future__ import annotations
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import text

from database import AsyncSessionLocal
from routers._advisor_scope import require_advisor_scope
from services import relationship_activities as ra

router = APIRouter(prefix="/api/admin", tags=["admin-activities-m3"])


async def _enforce_scope_on_tenant(scope: dict, tid: str) -> None:
    if scope["is_super_admin"]:
        return
    async with AsyncSessionLocal() as s:
        ok = (await s.execute(text("""
            SELECT 1 FROM studio_relations
             WHERE tenant_id = CAST(:tid AS uuid)
               AND owner_advisor_id = CAST(:a AS uuid) LIMIT 1
        """), {"tid": tid, "a": scope.get("advisor_id")})).scalar()
    if not ok:
        raise HTTPException(404, "Tenant not in scope")


@router.get("/tenants/{tid}/activities/open-followups")
async def open_followups(tid: str, owner: Optional[str] = None,
                         limit: int = Query(30, ge=1, le=100),
                         scope: dict = Depends(require_advisor_scope)):
    await _enforce_scope_on_tenant(scope, tid)
    return await ra.list_open_followups(tid, owner_user_id=owner, limit=limit)


@router.get("/tenants/{tid}/activities/search")
async def search(tid: str, q: str = Query(..., min_length=1),
                 limit: int = Query(30, ge=1, le=100),
                 scope: dict = Depends(require_advisor_scope)):
    await _enforce_scope_on_tenant(scope, tid)
    return await ra.list_activities(tid, q=q, limit=limit)


@router.get("/tenants/{tid}/activities/v2")
async def list_v2(
    tid: str,
    contact_id: Optional[str] = None,
    activity_type_code: Optional[str] = None,
    activity_outcome_code: Optional[str] = None,
    source_code: Optional[str] = None,
    owner_user_id: Optional[str] = None,
    created_by: Optional[str] = None,
    status: str = "all",
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
    due_since: Optional[datetime] = None,
    due_until: Optional[datetime] = None,
    q: Optional[str] = None,
    cursor: Optional[str] = None,
    limit: int = Query(30, ge=1, le=100),
    scope: dict = Depends(require_advisor_scope),
):
    await _enforce_scope_on_tenant(scope, tid)
    cur_at, cur_id = None, None
    if cursor:
        import base64, json
        try:
            data = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
            cur_at, cur_id = data.get("at"), data.get("id")
        except Exception:
            raise HTTPException(422, "invalid cursor")
    return await ra.list_activities(
        tid, contact_id=contact_id,
        activity_type_code=activity_type_code,
        activity_outcome_code=activity_outcome_code,
        source_code=source_code,
        owner_user_id=owner_user_id, created_by=created_by, status=status,
        since=since.isoformat() if since else None,
        until=until.isoformat() if until else None,
        due_since=due_since.isoformat() if due_since else None,
        due_until=due_until.isoformat() if due_until else None,
        q=q, cursor_at=cur_at, cursor_id=cur_id, limit=limit,
    )


@router.post("/tenants/{tid}/activities")
async def create(tid: str, payload: dict = Body(...),
                 scope: dict = Depends(require_advisor_scope)):
    await _enforce_scope_on_tenant(scope, tid)
    actor = scope.get("user_id")
    return await ra.create_activity(tid, payload,
                                     owner_user_id=payload.get("owner_user_id") or actor,
                                     created_by=actor,
                                     default_source=payload.get("source_code") or "advisor")


@router.get("/tenants/{tid}/activities/{aid}")
async def get_one(tid: str, aid: str,
                  scope: dict = Depends(require_advisor_scope)):
    await _enforce_scope_on_tenant(scope, tid)
    return await ra.get_activity(tid, aid)


@router.patch("/tenants/{tid}/activities/{aid}")
async def patch_one(tid: str, aid: str, payload: dict = Body(...),
                    scope: dict = Depends(require_advisor_scope)):
    await _enforce_scope_on_tenant(scope, tid)
    # Server-side defense: tenant_id/created_at/created_by/archived_at immutable
    for k in ("tenant_id", "created_at", "created_by", "archived_at", "id"):
        payload.pop(k, None)
    return await ra.update_activity(tid, aid, payload, actor_user_id=scope.get("user_id"))


@router.delete("/tenants/{tid}/activities/{aid}")
async def archive_one(tid: str, aid: str,
                      scope: dict = Depends(require_advisor_scope)):
    await _enforce_scope_on_tenant(scope, tid)
    return await ra.archive_activity(tid, aid, actor_user_id=scope.get("user_id"))


@router.post("/tenants/{tid}/activities/{aid}/complete")
async def complete_one(tid: str, aid: str, payload: dict = Body(default={}),
                       scope: dict = Depends(require_advisor_scope)):
    await _enforce_scope_on_tenant(scope, tid)
    return await ra.complete_activity(
        tid, aid,
        outcome_code=payload.get("activity_outcome_code"),
        actor_user_id=scope.get("user_id"))


@router.post("/tenants/{tid}/activities/{aid}/reopen")
async def reopen_one(tid: str, aid: str,
                     scope: dict = Depends(require_advisor_scope)):
    await _enforce_scope_on_tenant(scope, tid)
    return await ra.reopen_activity(tid, aid, actor_user_id=scope.get("user_id"))
