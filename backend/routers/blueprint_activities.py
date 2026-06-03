"""Blueprint Activities router (M3 · founder mirror with D1 gating)."""
from __future__ import annotations
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Body, Depends, HTTPException, Query

from routers._auth import require_admin_tenant
from services import relationship_activities as ra

router = APIRouter(prefix="/api/blueprint", tags=["blueprint-activities-m3"])


def _tid(tenant: dict) -> str:
    tid = tenant.get("id")
    if not tid:
        raise HTTPException(403, "no tenant in scope")
    return str(tid)


def _user_id(tenant: dict) -> str:
    return str(tenant.get("user_id") or "")


# ─── Strip pattern (D1): founder cannot escalate immutable / privileged fields
_FOUNDER_STRIP = ("owner_user_id", "created_by", "tenant_id",
                  "archived_at", "created_at", "id")


@router.get("/activities/open-followups")
async def my_open_followups(limit: int = Query(30, ge=1, le=100),
                            tenant: dict = Depends(require_admin_tenant)):
    return await ra.list_open_followups(_tid(tenant), limit=limit)


@router.get("/activities/search")
async def my_search(q: str = Query(..., min_length=1),
                    limit: int = Query(30, ge=1, le=100),
                    tenant: dict = Depends(require_admin_tenant)):
    return await ra.list_activities(_tid(tenant), q=q, limit=limit)


@router.get("/activities/v2")
async def my_list_v2(
    contact_id: Optional[str] = None,
    activity_type_code: Optional[str] = None,
    activity_outcome_code: Optional[str] = None,
    source_code: Optional[str] = None,
    status: str = "all",
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
    due_since: Optional[datetime] = None,
    due_until: Optional[datetime] = None,
    q: Optional[str] = None,
    cursor: Optional[str] = None,
    limit: int = Query(30, ge=1, le=100),
    tenant: dict = Depends(require_admin_tenant),
):
    cur_at, cur_id = None, None
    if cursor:
        import base64, json
        try:
            data = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
            cur_at, cur_id = data.get("at"), data.get("id")
        except Exception:
            raise HTTPException(422, "invalid cursor")
    return await ra.list_activities(
        _tid(tenant), contact_id=contact_id,
        activity_type_code=activity_type_code,
        activity_outcome_code=activity_outcome_code,
        source_code=source_code, status=status,
        since=since.isoformat() if since else None,
        until=until.isoformat() if until else None,
        due_since=due_since.isoformat() if due_since else None,
        due_until=due_until.isoformat() if due_until else None,
        q=q, cursor_at=cur_at, cursor_id=cur_id, limit=limit,
    )


@router.post("/activities")
async def my_create(payload: dict = Body(...),
                    tenant: dict = Depends(require_admin_tenant)):
    # D1: force owner = self · created_by = self
    payload.pop("owner_user_id", None)
    payload.pop("created_by", None)
    payload.pop("tenant_id", None)
    actor = _user_id(tenant)
    return await ra.create_activity(
        _tid(tenant), payload,
        owner_user_id=actor, created_by=actor,
        default_source=payload.get("source_code") or "founder",
    )


@router.get("/activities/{aid}")
async def my_get(aid: str, tenant: dict = Depends(require_admin_tenant)):
    return await ra.get_activity(_tid(tenant), aid)


@router.patch("/activities/{aid}")
async def my_patch(aid: str, payload: dict = Body(...),
                   tenant: dict = Depends(require_admin_tenant)):
    for k in _FOUNDER_STRIP:
        payload.pop(k, None)
    return await ra.update_activity(_tid(tenant), aid, payload,
                                     actor_user_id=_user_id(tenant))


@router.delete("/activities/{aid}")
async def my_archive(aid: str, tenant: dict = Depends(require_admin_tenant)):
    # D1: founder può archiviare SOLO le proprie attività (created_by == self).
    activity = await ra.get_activity(_tid(tenant), aid)
    if str(activity.get("created_by") or "") != _user_id(tenant):
        raise HTTPException(status_code=403, detail={
            "code": "delete_not_allowed",
            "message": "Solo l'autore dell'attività può archiviarla. "
                       "Le attività di altri membri del team restano per audit trail.",
            "created_by_display": activity.get("created_by_display"),
        })
    return await ra.archive_activity(_tid(tenant), aid,
                                      actor_user_id=_user_id(tenant))


@router.post("/activities/{aid}/complete")
async def my_complete(aid: str, payload: dict = Body(default={}),
                      tenant: dict = Depends(require_admin_tenant)):
    return await ra.complete_activity(
        _tid(tenant), aid,
        outcome_code=payload.get("activity_outcome_code"),
        actor_user_id=_user_id(tenant))


@router.post("/activities/{aid}/reopen")
async def my_reopen(aid: str, tenant: dict = Depends(require_admin_tenant)):
    return await ra.reopen_activity(_tid(tenant), aid,
                                     actor_user_id=_user_id(tenant))
