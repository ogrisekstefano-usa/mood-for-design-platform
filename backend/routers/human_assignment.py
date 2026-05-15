"""Human Assignment API — Phase S.1.

Surface-isolated, role-aware:
    GET  /api/human-assignment/me                 (any auth user)
    GET  /api/human-assignment/for-subject        (admin/super only)
    POST /api/human-assignment/assign             (admin/super only)
    POST /api/human-assignment/reassign           (admin/super only)
    GET  /api/human-assignment/candidates         (admin/super only)
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from core.tenant_context import get_tenant_context
from core import human_assignment as engine
from database import db

router = APIRouter()


def _is_admin(role: str) -> bool:
    return (role or "").lower() in {"tenant_admin", "super_admin"}


@router.get("/me")
def get_my_assignment(ctx: dict = Depends(get_tenant_context)):
    """Returns the current user's assigned human reference, if any.

    For role=client, looks up assignment for their own profile_id.
    For role=tenant_admin/etc, returns null (those users are the team).
    """
    role = (ctx.get("role") or "").lower()
    tenant_id = ctx["tenant_id"]
    profile_id = ctx.get("profile_id")
    if not profile_id:
        raise HTTPException(401, "Missing profile context.")

    if role == "client":
        # Idempotent ensure — if a client has no assignment yet (legacy
        # demo users created before S.1), assign one now.
        existing = engine.get_active_assignment(tenant_id, "client", profile_id)
        if not existing:
            existing = engine.ensure_assignment_for_client(tenant_id, profile_id)
        return {"assignment": engine.hydrate_assignee(existing)}

    # Studio members do not have a "referent"; return null with role
    return {"assignment": None, "viewer_role": role}


class AssignReq(BaseModel):
    subject_type: str
    subject_id: str
    assignee_user_id: Optional[str] = None  # null → engine picks


@router.post("/assign")
def manual_assign(body: AssignReq, ctx: dict = Depends(get_tenant_context)):
    """Admin manual override — creates a fresh active assignment."""
    if not _is_admin(ctx.get("role") or ""):
        raise HTTPException(403, "Admin only.")
    if body.subject_type not in {"client", "lead", "project", "studio_onboarding"}:
        raise HTTPException(400, "Invalid subject_type.")
    row = engine.assign(
        ctx["tenant_id"], body.subject_type, body.subject_id,
        created_by=ctx.get("profile_id"),
        force_assignee=body.assignee_user_id,
        manual_override=bool(body.assignee_user_id),
    )
    return {"assignment": engine.hydrate_assignee(row)}


class ReassignReq(BaseModel):
    assignment_id: str
    new_assignee_user_id: str


@router.post("/reassign")
def reassign(body: ReassignReq, ctx: dict = Depends(get_tenant_context)):
    """Reassign an existing assignment to a new user."""
    if not _is_admin(ctx.get("role") or ""):
        raise HTTPException(403, "Admin only.")
    c = db()
    r = (
        c.table("human_assignments").select("*")
        .eq("id", body.assignment_id).eq("tenant_id", ctx["tenant_id"])
        .limit(1).execute()
    )
    if not r.data:
        raise HTTPException(404, "Assignment not found.")
    old = r.data[0]
    # Mark old as reassigned and create a new active one
    new = engine.assign(
        ctx["tenant_id"], old["subject_type"], old["subject_id"],
        created_by=ctx.get("profile_id"),
        force_assignee=body.new_assignee_user_id,
        manual_override=True,
    )
    return {"assignment": engine.hydrate_assignee(new)}


@router.get("/for-subject")
def for_subject(
    subject_type: str = Query(...),
    subject_id: str = Query(...),
    ctx: dict = Depends(get_tenant_context),
):
    """Admin view — returns the current assignment for any subject."""
    if not _is_admin(ctx.get("role") or ""):
        raise HTTPException(403, "Admin only.")
    row = engine.get_active_assignment(ctx["tenant_id"], subject_type, subject_id)
    return {"assignment": engine.hydrate_assignee(row)}


@router.get("/candidates")
def list_candidates(
    subject_type: str = Query("client"),
    ctx: dict = Depends(get_tenant_context),
):
    """Admin view — returns the candidate pool for assignment."""
    if not _is_admin(ctx.get("role") or ""):
        raise HTTPException(403, "Admin only.")
    cands = engine._candidates_for(ctx["tenant_id"], subject_type)
    return {
        "candidates": [
            {
                "id": c["id"],
                "name": ((c.get("first_name") or "") + " " + (c.get("last_name") or "")).strip()
                        or (c.get("email") or "").split("@")[0],
                "role": c.get("role"),
                "role_label": c.get("role_label") or engine._default_role_label(c.get("role")),
                "avatar_url": c.get("avatar_url"),
            }
            for c in cands
        ]
    }
