"""Studio Orchestra™ · Notifications + Team · ITER153 Sprint E
=====================================================================

Mounted on `/api/orchestra-e`. Sibling of Sprint C `/api/orchestra`.

  NOTIFICATIONS (per current user):
    GET   /notifications?since=ISO&limit=50
    GET   /notifications/unread-count
    PATCH /notifications/{id}/read
    POST  /notifications/mark-all-read

  STUDIO TEAM:
    GET   /team                            (members of current tenant)
    POST  /team                            (add a member)
    PATCH /team/{member_id}                (edit role/bio/specialties)
    DELETE /team/{member_id}
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query
from pydantic import BaseModel

from core.tenant_context import get_tenant_context
from database import db

router = APIRouter()

_STUDIO_ROLES = {
    "designer", "creative_director", "interior_designer",
    "studio_member", "tenant_admin", "super_admin",
}

ROLE_LABELS = {
    "founder":             {"it": "Fondatore",            "en": "Founder"},
    "creative_director":   {"it": "Direzione creativa",   "en": "Creative Director"},
    "interior_designer":   {"it": "Interior designer",    "en": "Interior Designer"},
    "material_specialist": {"it": "Specialista materiali","en": "Material Specialist"},
    "architect":           {"it": "Architetto",           "en": "Architect"},
    "project_coordinator": {"it": "Project coordinator",  "en": "Project Coordinator"},
    "account_director":    {"it": "Account director",     "en": "Account Director"},
    "collaborator":        {"it": "Collaboratore",        "en": "Collaborator"},
    "observer":            {"it": "Osservatore",          "en": "Observer"},
}


def _iso() -> str: return datetime.now(timezone.utc).isoformat()


def _require_auth(ctx: dict) -> str:
    pid = ctx.get("profile_id")
    if not pid:
        raise HTTPException(401, "Missing profile context.")
    return pid


def _require_studio(ctx: dict):
    if (ctx.get("role") or "").lower() not in _STUDIO_ROLES:
        raise HTTPException(403, "Studio surface only.")


# ─────────────────────────────────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────────────────────────────────
@router.get("/notifications")
def list_notifications(
    since: Optional[str] = Query(None),
    limit: int = Query(60, ge=1, le=200),
    only_unread: bool = Query(False),
    ctx: dict = Depends(get_tenant_context),
):
    pid = _require_auth(ctx)
    c = db()
    q = (c.table("relationship_notifications").select("*")
         .eq("tenant_id", ctx["tenant_id"])
         .eq("recipient_user_id", pid)
         .is_("archived_at", "null")
         .order("created_at", desc=True).limit(limit))
    if since:
        q = q.gt("created_at", since)
    if only_unread:
        q = q.is_("read_at", "null")
    res = q.execute()
    return {"data": res.data or [], "polled_at": _iso()}


@router.get("/notifications/unread-count")
def unread_count(ctx: dict = Depends(get_tenant_context)):
    pid = _require_auth(ctx)
    c = db()
    r = (c.table("relationship_notifications")
         .select("id", count="exact")
         .eq("tenant_id", ctx["tenant_id"])
         .eq("recipient_user_id", pid)
         .is_("archived_at", "null")
         .is_("read_at", "null").execute())
    return {"count": r.count or 0}


@router.patch("/notifications/{notification_id}/read")
def mark_read(
    notification_id: str = Path(...),
    ctx: dict = Depends(get_tenant_context),
):
    pid = _require_auth(ctx)
    c = db()
    r = (c.table("relationship_notifications").select("*")
         .eq("id", notification_id).limit(1).execute())
    if not r.data:
        raise HTTPException(404, "Notification not found.")
    if r.data[0]["recipient_user_id"] != pid:
        raise HTTPException(403, "Cross-recipient.")
    if r.data[0].get("read_at"):
        return {"ok": True, "already_read": True}
    c.table("relationship_notifications").update({"read_at": _iso()})\
        .eq("id", notification_id).execute()
    return {"ok": True}


@router.post("/notifications/mark-all-read")
def mark_all_read(ctx: dict = Depends(get_tenant_context)):
    pid = _require_auth(ctx)
    c = db()
    c.table("relationship_notifications").update({"read_at": _iso()})\
        .eq("tenant_id", ctx["tenant_id"])\
        .eq("recipient_user_id", pid)\
        .is_("read_at", "null").execute()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────
# STUDIO TEAM
# ─────────────────────────────────────────────────────────────────────
def _hydrate_member(c, m: Dict[str, Any]) -> Dict[str, Any]:
    """Attach user profile basics."""
    try:
        p = (c.table("users_profile")
             .select("id,first_name,last_name,email,avatar_url")
             .eq("id", m["user_id"]).limit(1).execute())
        if p.data:
            u = p.data[0]
            name = ((u.get("first_name") or "") + " " + (u.get("last_name") or "")).strip()
            m["profile"] = {
                "id": u["id"],
                "name": name or (u.get("email") or "").split("@")[0],
                "avatar_url": u.get("avatar_url"),
                "email": u.get("email"),
            }
    except Exception:  # noqa: BLE001
        m["profile"] = {}
    return m


@router.get("/team")
def list_team(ctx: dict = Depends(get_tenant_context)):
    _require_auth(ctx)
    c = db()
    r = (c.table("studio_team_members").select("*")
         .eq("tenant_id", ctx["tenant_id"]).eq("status", "active")
         .order("role").limit(100).execute())
    members = [_hydrate_member(c, m) for m in (r.data or [])]
    return {"data": members}


@router.get("/team/roles")
def list_roles():
    """Static catalogue used by the team management UI."""
    return {"data": [
        {"key": k, "label_it": v["it"], "label_en": v["en"]}
        for k, v in ROLE_LABELS.items()
    ]}


class _TeamMemberBody(BaseModel):
    user_id: str
    role: str
    specialties: Optional[List[str]] = None
    territories: Optional[List[str]] = None
    languages:   Optional[List[str]] = None
    bio:         Optional[str] = None
    visibility:  Optional[str] = "studio_and_clients"


@router.post("/team", status_code=201)
def add_member(body: _TeamMemberBody, ctx: dict = Depends(get_tenant_context)):
    _require_studio(ctx)
    if body.role not in ROLE_LABELS:
        raise HTTPException(400, f"Invalid role. Allowed: {list(ROLE_LABELS)}")
    labels = ROLE_LABELS[body.role]
    c = db()
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "user_id": body.user_id,
        "role": body.role,
        "role_label_it": labels["it"],
        "role_label_en": labels["en"],
        "specialties": body.specialties or [],
        "territories": body.territories or [],
        "languages":   body.languages   or [],
        "bio": body.bio,
        "visibility": body.visibility or "studio_and_clients",
        "status": "active",
    }
    row = {k: v for k, v in row.items() if v is not None}
    try:
        res = c.table("studio_team_members").upsert(
            row, on_conflict="tenant_id,user_id"
        ).execute()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Failed: {e}")
    return {"ok": True, "member": (res.data or [row])[0]}


class _PatchMemberBody(BaseModel):
    role:        Optional[str] = None
    specialties: Optional[List[str]] = None
    territories: Optional[List[str]] = None
    languages:   Optional[List[str]] = None
    bio:         Optional[str] = None
    visibility:  Optional[str] = None
    status:      Optional[str] = None


@router.patch("/team/{member_id}")
def patch_member(member_id: str = Path(...),
                 body: _PatchMemberBody = Body(default_factory=_PatchMemberBody),
                 ctx: dict = Depends(get_tenant_context)):
    _require_studio(ctx)
    patch = body.model_dump(exclude_none=True)
    if "role" in patch and patch["role"] not in ROLE_LABELS:
        raise HTTPException(400, "Invalid role.")
    if "role" in patch:
        labels = ROLE_LABELS[patch["role"]]
        patch["role_label_it"] = labels["it"]
        patch["role_label_en"] = labels["en"]
    patch["updated_at"] = _iso()
    c = db()
    c.table("studio_team_members").update(patch)\
        .eq("id", member_id).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True}


@router.delete("/team/{member_id}")
def delete_member(member_id: str = Path(...),
                  ctx: dict = Depends(get_tenant_context)):
    _require_studio(ctx)
    c = db()
    c.table("studio_team_members").update({"status": "inactive", "updated_at": _iso()})\
        .eq("id", member_id).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True}
