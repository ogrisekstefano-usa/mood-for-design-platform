"""Client Portal API — surface dedicated to role=`client` users.

Phase R.1 + R.2: ownership-scoped read endpoints. Every query is
double-scoped:
    1. tenant_id == current_tenant
    2. ownership == current client (projects.client_user_id, or
       derived from project ownership for moodboards/proposals/etc.)

NEVER returns "first project of tenant", "demo preload", or any
shared/global data. If the client has no data → returns empty arrays
and a `zero_data: true` flag so the UI can show the cinematic
welcome experience.
"""
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from core.tenant_context import get_tenant_context
from database import db

router = APIRouter()


def _require_client(ctx: dict) -> str:
    """Only role=client (and tenant_admin/super_admin for QA) can call.
    Returns the profile_id that owns the client view."""
    role = (ctx.get("role") or "").lower()
    if role not in {"client", "tenant_admin", "super_admin"}:
        # Designers / editors / pms should NOT call the client portal —
        # they have the Blueprint OS workspace instead.
        raise HTTPException(403, "Client portal is for client users.")
    pid = ctx.get("profile_id")
    if not pid:
        raise HTTPException(401, "Missing profile context.")
    return pid


# Pipeline stages — mirrored on the frontend ProjectProgressTracker.
# Order matters; the project.status string is mapped to one of these.
PIPELINE_STAGES = [
    {"key": "brief",        "label_it": "Brief iniziale",  "label_en": "Initial brief"},
    {"key": "moodboard",    "label_it": "Moodboard",       "label_en": "Moodboard"},
    {"key": "materials",    "label_it": "Materiali",       "label_en": "Materials"},
    {"key": "design",       "label_it": "Progettazione",   "label_en": "Design"},
    {"key": "review",       "label_it": "Revisione finale","label_en": "Final review"},
    {"key": "delivery",     "label_it": "Consegna",        "label_en": "Delivery"},
]

# Tolerant mapping from existing project.status strings to a pipeline stage.
# Unknown statuses default to "brief" so the welcome experience is never
# blocked by data we don't recognise.
_STATUS_TO_STAGE = {
    "new": "brief", "draft": "brief", "lead": "brief", "brief": "brief",
    "discovery": "brief", "intake": "brief", "scoping": "brief",
    "moodboard": "moodboard", "concept": "moodboard", "concepting": "moodboard",
    "materials": "materials", "selection": "materials", "specifying": "materials",
    "design": "design", "in_progress": "design", "active": "design",
    "designing": "design", "drafting": "design",
    "review": "review", "approval": "review", "client_review": "review",
    "delivered": "delivery", "completed": "delivery", "done": "delivery",
    "handed_over": "delivery", "closed": "delivery",
}


def _stage_index_for(status: Optional[str]) -> int:
    """Return the 0-based index of the current pipeline stage."""
    if not status:
        return 0
    s = str(status).strip().lower()
    stage_key = _STATUS_TO_STAGE.get(s, "brief")
    for i, st in enumerate(PIPELINE_STAGES):
        if st["key"] == stage_key:
            return i
    return 0


def _build_pipeline(current_index: int) -> List[dict]:
    """Decorate stages with status (done/current/upcoming)."""
    out = []
    for i, st in enumerate(PIPELINE_STAGES):
        status = "done" if i < current_index else ("current" if i == current_index else "upcoming")
        out.append({**st, "status": status, "index": i})
    return out


@router.get("/overview")
def client_overview(ctx: dict = Depends(get_tenant_context)):
    """Returns the client's primary project + light counts. Strictly
    ownership-scoped. If no project exists → `zero_data: true`."""
    profile_id = _require_client(ctx)
    tenant_id = ctx["tenant_id"]
    c = db()

    # Primary project = most recently updated project owned by this client.
    # No tenant-wide fallback — if the client owns nothing they see the
    # welcome experience.
    pr = (
        c.table("projects")
        .select("id,title,description,project_type,status,priority,timeline,budget_range,language,metadata_json,created_at,updated_at,assigned_to")
        .eq("tenant_id", tenant_id)
        .eq("client_user_id", profile_id)
        .order("updated_at", desc=True)
        .limit(1)
        .execute()
    )
    project = pr.data[0] if pr.data else None

    if not project:
        return {
            "zero_data": True,
            "project": None,
            "pipeline": _build_pipeline(0),
            "counts": {"moodboards": 0, "approvals_pending": 0, "files": 0, "messages_unread": 0},
            "next_appointment": None,
        }

    proj_id = project["id"]

    # Moodboards belonging to the project — restricted via project ownership.
    mb = (
        c.table("moodboards")
        .select("id,title,status,cover_metadata,updated_at")
        .eq("tenant_id", tenant_id)
        .eq("project_id", proj_id)
        .is_("deleted_at", "null")
        .order("updated_at", desc=True)
        .limit(8)
        .execute()
    )
    moodboards = mb.data or []

    # Pending proposals (status != approved/rejected) awaiting client decision.
    pp = (
        c.table("proposals")
        .select("id,title,status,version,total_value,currency,updated_at")
        .eq("tenant_id", tenant_id)
        .eq("project_id", proj_id)
        .in_("status", ["draft", "sent", "in_review", "revision_requested"])
        .order("updated_at", desc=True)
        .limit(5)
        .execute()
    )
    approvals = pp.data or []

    current_index = _stage_index_for(project.get("status"))

    return {
        "zero_data": False,
        "project": {
            **{k: project.get(k) for k in ["id","title","description","project_type","status","timeline","budget_range","language","updated_at","created_at"]},
            "location": (project.get("metadata_json") or {}).get("location"),
            "cover_url": (project.get("metadata_json") or {}).get("cover_url"),
        },
        "pipeline": _build_pipeline(current_index),
        "moodboards": [
            {
                "id": m["id"],
                "title": m.get("title") or "Moodboard",
                "status": m.get("status"),
                "cover_url": (m.get("cover_metadata") or {}).get("signed_url")
                            or (m.get("cover_metadata") or {}).get("url"),
                "updated_at": m.get("updated_at"),
            }
            for m in moodboards
        ],
        "approvals_pending": approvals,
        "counts": {
            "moodboards": len(moodboards),
            "approvals_pending": len(approvals),
            "files": 0,            # Stub — wired in R.3 with project_files table
            "messages_unread": 0,  # Stub — wired in R.3 with messages table
        },
        "next_appointment": None,  # Stub — wired in R.3 with appointments table
    }


@router.get("/projects")
def client_projects(ctx: dict = Depends(get_tenant_context)):
    """All projects owned by this client (typically 1, but supports more)."""
    profile_id = _require_client(ctx)
    tenant_id = ctx["tenant_id"]
    c = db()
    pr = (
        c.table("projects")
        .select("id,title,description,status,project_type,timeline,updated_at,metadata_json")
        .eq("tenant_id", tenant_id)
        .eq("client_user_id", profile_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return {
        "projects": [
            {
                **{k: p.get(k) for k in ["id","title","description","status","project_type","timeline","updated_at"]},
                "stage_index": _stage_index_for(p.get("status")),
                "stage_label_it": PIPELINE_STAGES[_stage_index_for(p.get("status"))]["label_it"],
                "location": (p.get("metadata_json") or {}).get("location"),
                "cover_url": (p.get("metadata_json") or {}).get("cover_url"),
            }
            for p in (pr.data or [])
        ]
    }


@router.get("/moodboards")
def client_moodboards(ctx: dict = Depends(get_tenant_context)):
    """Moodboards across all projects owned by this client."""
    profile_id = _require_client(ctx)
    tenant_id = ctx["tenant_id"]
    c = db()
    # Step 1: project ids owned by client
    pr = (
        c.table("projects").select("id,title")
        .eq("tenant_id", tenant_id).eq("client_user_id", profile_id)
        .execute()
    )
    proj_map = {p["id"]: p.get("title") for p in (pr.data or [])}
    if not proj_map:
        return {"moodboards": []}
    mb = (
        c.table("moodboards")
        .select("id,title,status,cover_metadata,updated_at,project_id")
        .eq("tenant_id", tenant_id)
        .in_("project_id", list(proj_map.keys()))
        .is_("deleted_at", "null")
        .order("updated_at", desc=True)
        .execute()
    )
    return {
        "moodboards": [
            {
                "id": m["id"],
                "title": m.get("title") or "Moodboard",
                "status": m.get("status"),
                "project_id": m.get("project_id"),
                "project_title": proj_map.get(m.get("project_id")),
                "cover_url": (m.get("cover_metadata") or {}).get("signed_url")
                            or (m.get("cover_metadata") or {}).get("url"),
                "updated_at": m.get("updated_at"),
            }
            for m in (mb.data or [])
        ]
    }


@router.get("/approvals")
def client_approvals(ctx: dict = Depends(get_tenant_context)):
    """Pending approvals across all projects owned by this client."""
    profile_id = _require_client(ctx)
    tenant_id = ctx["tenant_id"]
    c = db()
    pr = (
        c.table("projects").select("id,title")
        .eq("tenant_id", tenant_id).eq("client_user_id", profile_id)
        .execute()
    )
    proj_map = {p["id"]: p.get("title") for p in (pr.data or [])}
    if not proj_map:
        return {"approvals": []}
    pp = (
        c.table("proposals")
        .select("id,title,status,version,total_value,currency,updated_at,project_id")
        .eq("tenant_id", tenant_id)
        .in_("project_id", list(proj_map.keys()))
        .in_("status", ["draft", "sent", "in_review", "revision_requested"])
        .order("updated_at", desc=True)
        .execute()
    )
    return {
        "approvals": [
            {**p, "project_title": proj_map.get(p.get("project_id"))}
            for p in (pp.data or [])
        ]
    }
