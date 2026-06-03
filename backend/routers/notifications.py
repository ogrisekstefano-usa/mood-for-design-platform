"""Notification Center router (M4).

REST surface for the bell + drawer + preferences pane.

Scope: any authenticated user. Every endpoint hard-filters by
`recipient_user_id = auth.user.id` to enforce RBAC.
"""
from __future__ import annotations
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from database import AsyncSessionLocal
from routers.auth import get_current_user
from services import notifications as svc

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# ─── schemas ──────────────────────────────────────────────────────────────

class MarkReadIn(BaseModel):
    ids: Optional[List[UUID]] = None
    all_for_user: bool = Field(default=False, alias="all")

    class Config:
        populate_by_name = True


class PreferenceItem(BaseModel):
    notification_type: str
    in_app_enabled: Optional[bool] = True
    email_enabled:  Optional[bool] = False
    push_enabled:   Optional[bool] = False


class PreferencesIn(BaseModel):
    items: List[PreferenceItem]


# ─── endpoints ────────────────────────────────────────────────────────────

@router.get("")
async def list_notifications(
    user:            dict        = Depends(get_current_user),
    limit:           int         = Query(30, ge=1, le=100),
    cursor:          Optional[str] = Query(None),
    category:        Optional[str] = Query(None, description="lifecycle|activity|followup|access|assignment|review"),
    only_unread:     bool          = Query(False),
    only_critical:   bool          = Query(False, description="Filter priority IN (high, urgent)"),
    type_codes:      Optional[str] = Query(None, description="csv list of type codes"),
):
    """Paginated list of notifications for the bell drawer."""
    pri = ["high", "urgent"] if only_critical else None
    tcs = [t.strip() for t in type_codes.split(",")] if type_codes else None
    async with AsyncSessionLocal() as s:
        return await svc.list_for_user(
            s, user_id=UUID(user["id"]),
            limit=limit, cursor=cursor,
            category=category, only_unread=only_unread,
            priority_in=pri, type_codes=tcs,
        )


@router.get("/unread-count")
async def unread_count(user: dict = Depends(get_current_user)):
    """Fast counter for the bell badge. Returns total + breakdown + has_critical."""
    async with AsyncSessionLocal() as s:
        return await svc.unread_count(s, user_id=UUID(user["id"]))


@router.post("/mark-read")
async def mark_read(
    body: MarkReadIn,
    user: dict = Depends(get_current_user),
):
    """Mark notifications as read. Body: `{ids: [..]}` or `{all: true}`."""
    if not body.ids and not body.all_for_user:
        raise HTTPException(status_code=400, detail="ids[] or all=true required")
    async with AsyncSessionLocal() as s:
        n = await svc.mark_read(
            s, user_id=UUID(user["id"]),
            ids=body.ids, all_for_user=body.all_for_user,
        )
        await s.commit()
        return {"updated": n}


@router.post("/{notif_id}/archive")
async def archive(
    notif_id: UUID,
    user:     dict = Depends(get_current_user),
):
    """Hide a notification from the drawer (preserves audit history)."""
    async with AsyncSessionLocal() as s:
        ok = await svc.archive(s, user_id=UUID(user["id"]), notif_id=notif_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Notification not found")
        await s.commit()
        return {"ok": True}


@router.get("/categories")
async def categories(user: dict = Depends(get_current_user)):
    """Catalog of platform_notification_types (active only). Used by FE filters."""
    async with AsyncSessionLocal() as s:
        return {"items": await svc.list_categories(s)}


@router.get("/preferences")
async def get_preferences(user: dict = Depends(get_current_user)):
    """Per-user opt-in matrix. Returns all active types with effective values."""
    async with AsyncSessionLocal() as s:
        return {"items": await svc.get_preferences(s, user_id=UUID(user["id"]))}


@router.patch("/preferences")
async def set_preferences(
    body: PreferencesIn,
    user: dict = Depends(get_current_user),
):
    """Bulk upsert preferences. email/push stored future-ready (no send in M4)."""
    async with AsyncSessionLocal() as s:
        n = await svc.set_preferences(
            s, user_id=UUID(user["id"]),
            items=[i.model_dump() for i in body.items],
        )
        await s.commit()
        return {"updated": n}
