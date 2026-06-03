"""Notifications router · M4 Internal Notification Center
=====================================================================

Mounted at ``/api/notifications``.

Endpoints (all scoped to the authenticated user — strict RBAC, no
cross-user access):

  GET    /                       list (filters: only_unread, archived, category, since, limit)
  GET    /unread-count           {count, high_priority_count}
  GET    /categories             catalog (DB-driven)
  PATCH  /{id}/read              mark single as read
  POST   /mark-all-read          bulk
  POST   /{id}/archive           soft-delete a notification
  POST   /archive-read           bulk archive read notifications
  GET    /preferences            per-user category toggles
  PATCH  /preferences/{key}      update {in_app_enabled}
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel

from core.tenant_context import get_tenant_context
from core.permissions import is_super_admin
from database import db

router = APIRouter()


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_auth(ctx: dict) -> str:
    pid = ctx.get("profile_id")
    if not pid:
        raise HTTPException(401, "Missing profile context.")
    return pid


# ──────────────────────────────────────────────────────────────────────
# CATALOG
# ──────────────────────────────────────────────────────────────────────
@router.get("/categories")
def list_categories(active_only: bool = Query(True),
                    ctx: dict = Depends(get_tenant_context)):
    _require_auth(ctx)
    c = db()
    q = c.table("notification_categories").select("*").order("sort_order")
    if active_only:
        q = q.eq("active", True)
    res = q.execute()
    return {"data": res.data or []}


# ──────────────────────────────────────────────────────────────────────
# LIST + COUNTS
# ──────────────────────────────────────────────────────────────────────
@router.get("")
@router.get("/")
def list_notifications(
    only_unread: bool = Query(False),
    archived: bool = Query(False),
    category: Optional[str] = Query(None),
    since: Optional[str] = Query(None),
    limit: int = Query(60, ge=1, le=200),
    ctx: dict = Depends(get_tenant_context),
):
    pid = _require_auth(ctx)
    c = db()
    q = (c.table("relationship_notifications").select("*")
         .eq("tenant_id", ctx["tenant_id"])
         .eq("recipient_user_id", pid))
    if archived:
        q = q.not_.is_("archived_at", "null")
    else:
        q = q.is_("archived_at", "null")
    if only_unread:
        q = q.is_("read_at", "null")
    if category:
        q = q.eq("category_key", category)
    if since:
        q = q.gt("created_at", since)
    q = q.order("created_at", desc=True).limit(limit)
    res = q.execute()
    return {"data": res.data or [], "polled_at": _iso()}


@router.get("/unread-count")
def unread_count(ctx: dict = Depends(get_tenant_context)):
    pid = _require_auth(ctx)
    c = db()
    base = (c.table("relationship_notifications")
            .select("id", count="exact")
            .eq("tenant_id", ctx["tenant_id"])
            .eq("recipient_user_id", pid)
            .is_("archived_at", "null")
            .is_("read_at", "null"))
    total = base.execute().count or 0

    high = (c.table("relationship_notifications")
            .select("id", count="exact")
            .eq("tenant_id", ctx["tenant_id"])
            .eq("recipient_user_id", pid)
            .is_("archived_at", "null")
            .is_("read_at", "null")
            .eq("priority", "high")
            .execute().count or 0)
    return {"count": total, "high_priority_count": high}


# ──────────────────────────────────────────────────────────────────────
# MARK READ / ARCHIVE
# ──────────────────────────────────────────────────────────────────────
def _load_for_user(notification_id: str, ctx: dict):
    pid = _require_auth(ctx)
    c = db()
    r = (c.table("relationship_notifications").select("*")
         .eq("id", notification_id).limit(1).execute())
    if not r.data:
        raise HTTPException(404, "Notification not found.")
    row = r.data[0]
    if row["recipient_user_id"] != pid or row["tenant_id"] != ctx["tenant_id"]:
        # Strict RBAC — no cross-user access
        raise HTTPException(403, "Forbidden.")
    return c, row


@router.patch("/{notification_id}/read")
def mark_read(notification_id: str = Path(...),
              ctx: dict = Depends(get_tenant_context)):
    c, row = _load_for_user(notification_id, ctx)
    if row.get("read_at"):
        return {"ok": True, "already_read": True}
    c.table("relationship_notifications").update({"read_at": _iso()})\
        .eq("id", notification_id).execute()
    return {"ok": True}


@router.post("/mark-all-read")
def mark_all_read(ctx: dict = Depends(get_tenant_context)):
    pid = _require_auth(ctx)
    c = db()
    c.table("relationship_notifications").update({"read_at": _iso()})\
        .eq("tenant_id", ctx["tenant_id"])\
        .eq("recipient_user_id", pid)\
        .is_("read_at", "null")\
        .is_("archived_at", "null")\
        .execute()
    return {"ok": True}


@router.post("/{notification_id}/archive")
def archive(notification_id: str = Path(...),
            ctx: dict = Depends(get_tenant_context)):
    c, row = _load_for_user(notification_id, ctx)
    now = _iso()
    patch = {"archived_at": now}
    if not row.get("read_at"):
        patch["read_at"] = now
    c.table("relationship_notifications").update(patch)\
        .eq("id", notification_id).execute()
    return {"ok": True}


@router.post("/archive-read")
def archive_read(ctx: dict = Depends(get_tenant_context)):
    pid = _require_auth(ctx)
    c = db()
    c.table("relationship_notifications").update({"archived_at": _iso()})\
        .eq("tenant_id", ctx["tenant_id"])\
        .eq("recipient_user_id", pid)\
        .not_.is_("read_at", "null")\
        .is_("archived_at", "null")\
        .execute()
    return {"ok": True}


# ──────────────────────────────────────────────────────────────────────
# PREFERENCES (foundation)
# ──────────────────────────────────────────────────────────────────────
class PreferencePatchBody(BaseModel):
    in_app_enabled: bool


@router.get("/preferences")
def list_preferences(ctx: dict = Depends(get_tenant_context)):
    """Returns one row per category, merging defaults with user overrides."""
    pid = _require_auth(ctx)
    c = db()
    cats = (c.table("notification_categories").select("*")
            .eq("active", True).order("sort_order").execute().data) or []
    prefs = (c.table("notification_preferences").select("*")
             .eq("tenant_id", ctx["tenant_id"])
             .eq("user_id", pid).execute().data) or []
    by_key = {p["category_key"]: p for p in prefs}
    out = []
    for cat in cats:
        p = by_key.get(cat["key"]) or {}
        out.append({
            "category_key":   cat["key"],
            "label_it":       cat["label_it"],
            "label_en":       cat["label_en"],
            "icon":           cat["icon"],
            "default_priority": cat["default_priority"],
            "in_app_enabled": bool(p.get("in_app_enabled", True)),
            "updated_at":     p.get("updated_at"),
        })
    return {"data": out}


@router.patch("/preferences/{category_key}")
def patch_preference(category_key: str = Path(...),
                     body: PreferencePatchBody = ...,
                     ctx: dict = Depends(get_tenant_context)):
    pid = _require_auth(ctx)
    c = db()
    # Validate category
    cat = (c.table("notification_categories").select("key")
           .eq("key", category_key).limit(1).execute().data)
    if not cat:
        raise HTTPException(404, "Unknown category.")
    # Upsert pref
    row = {
        "tenant_id":     ctx["tenant_id"],
        "user_id":       pid,
        "category_key":  category_key,
        "in_app_enabled": bool(body.in_app_enabled),
        "updated_at":    _iso(),
    }
    existing = (c.table("notification_preferences").select("id")
                .eq("tenant_id", ctx["tenant_id"])
                .eq("user_id", pid)
                .eq("category_key", category_key)
                .limit(1).execute().data)
    if existing:
        c.table("notification_preferences").update(row)\
            .eq("id", existing[0]["id"]).execute()
    else:
        row["id"] = str(uuid.uuid4())
        c.table("notification_preferences").insert(row).execute()
    return {"ok": True}


# ──────────────────────────────────────────────────────────────────────
# ADMIN / DEBUG
# ──────────────────────────────────────────────────────────────────────
@router.post("/_debug/run-followup-overdue-cron")
def run_followup_overdue_cron(ctx: dict = Depends(get_tenant_context)):
    """Manually fire the daily followup_overdue scan (super_admin only).

    Useful for QA / verification — production schedule is 08:00 Europe/Rome.
    """
    if not is_super_admin(ctx.get("role")):
        raise HTTPException(403, "super_admin only")
    from services.notification_cron import followup_overdue_scan
    return followup_overdue_scan()


@router.post("/_debug/publish")
def debug_publish(
    body: dict,
    ctx: dict = Depends(get_tenant_context),
):
    """Manually emit a notification (super_admin only · QA helper).

    Body: {category_key, recipient_user_id?, narrative?, payload?, priority?}
    Defaults to the current user as recipient.
    """
    if not is_super_admin(ctx.get("role")):
        raise HTTPException(403, "super_admin only")
    from services.notification_publisher import publish, reset_catalog_cache
    reset_catalog_cache()
    nid = publish(
        tenant_id=ctx["tenant_id"],
        recipient_user_id=body.get("recipient_user_id") or ctx["profile_id"],
        category_key=body.get("category_key", ""),
        narrative=body.get("narrative"),
        title=body.get("title"),
        payload=body.get("payload") or {},
        priority=body.get("priority"),
        sender_user_id=ctx["profile_id"],
        sender_type="system",
    )
    return {"ok": bool(nid), "id": nid}

