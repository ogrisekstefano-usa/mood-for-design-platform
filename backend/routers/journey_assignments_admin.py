"""ITER178 · JOURNEY ASSIGNMENTS™ Phase 1 · Admin CRUD + workspace endpoints.

Mounted on /api/admin/journeys/{jid}/assignments (admin scope) and
/api/workspace/journeys/mine (any logged team member).

Phase 1 deliberately does NOT include:
  - UI drawer (Phase 2)
  - Client-side team endpoint (Phase 2)
  - Notification Bus fan-out (Phase 3)
"""
from __future__ import annotations

import logging
from typing import Optional, List, Literal

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context, require_permission
from core.permissions import P_PROJECTS_READ, P_PROJECTS_WRITE
from core import journey_assignments as svc
from database import db

logger = logging.getLogger(__name__)

router       = APIRouter()
admin_router = APIRouter()


# ── Models ────────────────────────────────────────────────────────────────
class AssignmentOut(BaseModel):
    id:               str
    tenant_id:        str
    journey_id:       str
    user_id:          str
    assignment_role:  Literal["owner", "contributor", "observer"]
    client_visible:   bool
    assigned_at:      Optional[str]
    assigned_by:      Optional[str]
    revoked_at:       Optional[str] = None
    revoked_by:       Optional[str] = None
    revoke_reason:    Optional[str] = None
    # Denormalized
    user_first_name:  Optional[str] = None
    user_last_name:   Optional[str] = None
    user_email:       Optional[str] = None
    user_role:        Optional[str] = None
    user_avatar_url:  Optional[str] = None


class AddAssignmentIn(BaseModel):
    user_id:          str
    assignment_role:  Literal["contributor", "observer"]
    client_visible:   Optional[bool] = None


class ChangeOwnerIn(BaseModel):
    user_id:          str
    reason:           Optional[str] = None


class RevokeIn(BaseModel):
    reason:           Optional[str] = None


class MyJourneyOut(BaseModel):
    assignment_id:    str
    assignment_role:  Literal["owner", "contributor", "observer"]
    client_visible:   bool
    assigned_at:      Optional[str]
    journey_id:       str
    lifecycle_state:  Optional[str]
    overall_status:   Optional[str]
    started_at:       Optional[str]
    closed_at:        Optional[str]
    account:          Optional[dict] = None


# ── Internal helpers ──────────────────────────────────────────────────────
def _verify_journey_belongs_to_tenant(tenant_id: str, journey_id: str) -> dict:
    rows = (db().table("design_journeys").select("id,tenant_id,lifecycle_state")
              .eq("id", journey_id).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "journey_not_found")
    if rows[0]["tenant_id"] != tenant_id:
        raise HTTPException(404, "journey_not_found")
    return rows[0]


def _hydrate_assignments(rows: List[dict]) -> List[AssignmentOut]:
    """Add denormalized user fields for UI rendering."""
    user_ids = list({r["user_id"] for r in rows})
    profiles = []
    if user_ids:
        profiles = (db().table("users_profile")
                      .select("id,first_name,last_name,email,role,avatar_url")
                      .in_("id", user_ids)
                      .execute()
                      .data or [])
    pmap = {p["id"]: p for p in profiles}
    out = []
    for r in rows:
        p = pmap.get(r["user_id"]) or {}
        out.append(AssignmentOut(
            id=r["id"],
            tenant_id=r["tenant_id"],
            journey_id=r["journey_id"],
            user_id=r["user_id"],
            assignment_role=r["assignment_role"],
            client_visible=r["client_visible"],
            assigned_at=r.get("assigned_at"),
            assigned_by=r.get("assigned_by"),
            revoked_at=r.get("revoked_at"),
            revoked_by=r.get("revoked_by"),
            revoke_reason=r.get("revoke_reason"),
            user_first_name=p.get("first_name"),
            user_last_name=p.get("last_name"),
            user_email=p.get("email"),
            user_role=p.get("role"),
            user_avatar_url=p.get("avatar_url"),
        ))
    return out


# ── Admin endpoints ───────────────────────────────────────────────────────
@admin_router.get("/{jid}/assignments", response_model=List[AssignmentOut])
def list_assignments(
    jid: str = Path(...),
    ctx: dict = Depends(require_permission(P_PROJECTS_READ)),
):
    """List active assignments for a journey (owner first)."""
    _verify_journey_belongs_to_tenant(ctx["tenant_id"], jid)
    rows = svc.get_active_assignments(ctx["tenant_id"], jid)
    return _hydrate_assignments(rows)


@admin_router.post("/{jid}/assignments", response_model=AssignmentOut, status_code=201)
def add_assignment(
    body: AddAssignmentIn,
    jid: str = Path(...),
    ctx: dict = Depends(require_permission(P_PROJECTS_WRITE)),
):
    """Add a contributor or observer to the journey.

    Use POST /change-owner for owner handoff (different semantics).
    """
    _verify_journey_belongs_to_tenant(ctx["tenant_id"], jid)
    # Validate target user
    target = (db().table("users_profile").select("id,tenant_id,status,role")
                .eq("id", body.user_id).limit(1).execute().data or [])
    if not target:
        raise HTTPException(404, "user_not_found")
    t = target[0]
    if t["tenant_id"] != ctx["tenant_id"]:
        raise HTTPException(404, "user_not_found")
    if t["status"] == "suspended":
        raise HTTPException(409, "user_suspended")
    if t["role"] == "client":
        raise HTTPException(409, "cannot_assign_client")
    try:
        row = svc.add_assignment(
            ctx["tenant_id"], jid, body.user_id, body.assignment_role,
            actor_user_id=ctx["profile_id"],
            client_visible=body.client_visible,
        )
    except ValueError as e:
        raise HTTPException(409, str(e))
    return _hydrate_assignments([row])[0]


@admin_router.post("/{jid}/assignments/change-owner",
                   response_model=AssignmentOut, status_code=201)
def change_owner(
    body: ChangeOwnerIn,
    jid: str = Path(...),
    ctx: dict = Depends(require_permission(P_PROJECTS_WRITE)),
):
    """Handoff owner role to a different user (revoke old + insert new)."""
    _verify_journey_belongs_to_tenant(ctx["tenant_id"], jid)
    try:
        row = svc.change_owner(
            ctx["tenant_id"], jid, body.user_id,
            actor_user_id=ctx["profile_id"],
            reason=body.reason,
        )
    except ValueError as e:
        msg = str(e)
        status = 404 if "not_found" in msg else 409
        raise HTTPException(status, msg)
    return _hydrate_assignments([row])[0]


@admin_router.delete("/{jid}/assignments/{aid}", status_code=200)
def revoke_assignment(
    jid:  str = Path(...),
    aid:  str = Path(...),
    body: Optional[RevokeIn] = None,
    ctx:  dict = Depends(require_permission(P_PROJECTS_WRITE)),
):
    """Soft-revoke a contributor or observer.

    Rejects revocation of owner — use change-owner instead.
    """
    _verify_journey_belongs_to_tenant(ctx["tenant_id"], jid)
    try:
        row = svc.revoke_assignment(
            ctx["tenant_id"], jid, aid,
            actor_user_id=ctx["profile_id"],
            reason=(body.reason if body else None),
        )
    except ValueError as e:
        msg = str(e)
        if msg == "assignment_not_found":
            raise HTTPException(404, msg)
        raise HTTPException(409, msg)
    return {"ok": True, "assignment_id": row["id"], "revoked_at": row["revoked_at"]}


@admin_router.get("/{jid}/assignments/events")
def list_assignment_events(
    jid:  str = Path(...),
    limit: int = 50,
    ctx:  dict = Depends(require_permission(P_PROJECTS_READ)),
):
    _verify_journey_belongs_to_tenant(ctx["tenant_id"], jid)
    return {"events": svc.list_events(ctx["tenant_id"], jid, limit=min(limit, 200))}


# ── Workspace endpoint (any team member) ──────────────────────────────────
@router.get("/journeys/mine", response_model=List[MyJourneyOut])
def my_journeys(ctx: dict = Depends(get_tenant_context)):
    """Return journeys where the current user has an active assignment.

    Available to any logged team member (not gated by P_PROJECTS_READ
    because a designer must always see their own work even without
    tenant-wide project read permission).
    """
    role = ctx.get("role") or ""
    if role == "client":
        raise HTTPException(403, "client_forbidden")
    rows = svc.list_user_journeys(ctx["tenant_id"], ctx["profile_id"])
    return rows
