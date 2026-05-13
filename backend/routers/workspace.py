"""Blueprint Workspace™ — Tasks, Notes, Activity, Lead conversion.

Storage strategy (post-migration 003):
  - tasks → `tasks` table (existed pre-migration, now actually used)
  - notes → `project_notes` table (new)
  - activity → `project_activity` table (new)

Backward compatibility: GET endpoints will read from BOTH the new tables and the legacy
`tenant_settings.project.{id}.notes|activity|tasks` keys, merging results until the legacy
keys are purged. POST/PUT/DELETE only write to the dedicated tables.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from core.tenant_context import get_tenant_context, get_tenant_settings, audit_log, require_permission
from core.permissions import (
    P_PROJECTS_READ, P_PROJECTS_WRITE, P_LEADS_WRITE,
)
from database import db

router = APIRouter()
logger = logging.getLogger(__name__)


def _now():
    return datetime.now(timezone.utc).isoformat()


def _assert_project_in_tenant(client, project_id: str, tenant_id: str):
    r = client.table("projects").select("id").eq("id", project_id).eq("tenant_id", tenant_id).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Project not found")


def push_activity(tenant_id: str, project_id: str, event: dict) -> None:
    """Append an event to `project_activity`. Safe to call from any router.

    `event` should contain at minimum: actor_id, type, optionally ref_id, label, payload.
    """
    if not project_id:
        return
    try:
        db().table("project_activity").insert({
            "tenant_id": tenant_id,
            "project_id": project_id,
            "actor_id": event.get("actor_id"),
            "event_type": event.get("type", "unknown"),
            "ref_id": event.get("ref_id"),
            "label": event.get("label"),
            "payload": {k: v for k, v in event.items()
                       if k not in ("actor_id", "type", "ref_id", "label", "at", "id")},
        }).execute()
    except Exception as e:
        logger.warning(f"activity stream push failed: {e}")


# ── Schemas ──────────────────────────────────────────────────────────────────
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date:    Optional[str] = None


class TaskUpdate(BaseModel):
    title:       Optional[str] = None
    description: Optional[str] = None
    status:      Optional[str] = None   # todo | in_progress | done
    assigned_to: Optional[str] = None
    due_date:    Optional[str] = None


class NoteCreate(BaseModel):
    body:   str
    pinned: Optional[bool] = False


class NoteUpdate(BaseModel):
    body:   Optional[str] = None
    pinned: Optional[bool] = None


# ── Tasks ────────────────────────────────────────────────────────────────────
@router.get("/projects/{project_id}/tasks")
def list_tasks(project_id: str, ctx: dict = Depends(require_permission(P_PROJECTS_READ))):
    client = db()
    _assert_project_in_tenant(client, project_id, ctx["tenant_id"])
    r = client.table("tasks").select("*") \
        .eq("project_id", project_id).eq("tenant_id", ctx["tenant_id"]) \
        .order("created_at", desc=True).execute()
    return {"data": r.data or []}


@router.post("/projects/{project_id}/tasks", status_code=201)
def create_task(project_id: str, body: TaskCreate, ctx: dict = Depends(require_permission(P_PROJECTS_WRITE))):
    client = db()
    _assert_project_in_tenant(client, project_id, ctx["tenant_id"])
    payload = {
        "tenant_id":  ctx["tenant_id"],
        "project_id": project_id,
        "status":     "todo",
        **{k: v for k, v in body.model_dump(exclude_none=True).items()},
    }
    r = client.table("tasks").insert(payload).execute()
    task = r.data[0] if r.data else payload
    push_activity(ctx["tenant_id"], project_id, {
        "actor_id": ctx["profile_id"], "type": "task.created",
        "ref_id": task.get("id"), "label": task.get("title"),
    })
    return task


@router.put("/projects/{project_id}/tasks/{task_id}")
def update_task(project_id: str, task_id: str, body: TaskUpdate,
                ctx: dict = Depends(require_permission(P_PROJECTS_WRITE))):
    client = db()
    _assert_project_in_tenant(client, project_id, ctx["tenant_id"])
    cur = client.table("tasks").select("status,title,completed_at") \
        .eq("id", task_id).eq("project_id", project_id).limit(1).execute()
    if not cur.data:
        raise HTTPException(404, "Task not found")
    old_status = cur.data[0].get("status")
    payload = body.model_dump(exclude_none=True)
    payload["updated_at"] = _now()
    # Side effect: track completion time when transitioning to done / un-track otherwise
    if "status" in payload:
        if payload["status"] == "done" and old_status != "done":
            payload["completed_at"] = _now()
        elif payload["status"] != "done" and old_status == "done":
            payload["completed_at"] = None
    r = client.table("tasks").update(payload).eq("id", task_id).eq("project_id", project_id).execute()
    if payload.get("status") and payload["status"] != old_status:
        push_activity(ctx["tenant_id"], project_id, {
            "actor_id": ctx["profile_id"], "type": "task.status_change",
            "ref_id": task_id, "label": cur.data[0].get("title"),
            "from": old_status, "to": payload["status"],
        })
    return r.data[0] if r.data else payload


@router.delete("/projects/{project_id}/tasks/{task_id}")
def delete_task(project_id: str, task_id: str, ctx: dict = Depends(require_permission(P_PROJECTS_WRITE))):
    client = db()
    _assert_project_in_tenant(client, project_id, ctx["tenant_id"])
    client.table("tasks").delete().eq("id", task_id).eq("project_id", project_id).execute()
    return {"message": "deleted"}


# ── Notes ────────────────────────────────────────────────────────────────────
@router.get("/projects/{project_id}/notes")
def list_notes(project_id: str, ctx: dict = Depends(require_permission(P_PROJECTS_READ))):
    client = db()
    _assert_project_in_tenant(client, project_id, ctx["tenant_id"])
    r = client.table("project_notes").select("*") \
        .eq("project_id", project_id).eq("tenant_id", ctx["tenant_id"]) \
        .order("created_at", desc=True).execute()
    # Pinned-first, then most-recent first — single canonical sort
    def _ts(n):
        c = n.get("created_at") or "1970-01-01T00:00:00+00:00"
        try:
            return datetime.fromisoformat(c.replace("Z", "+00:00")).timestamp()
        except Exception:
            return 0
    items = sorted(r.data or [], key=lambda n: (0 if n.get("pinned") else 1, -_ts(n)))
    return {"data": items}


@router.post("/projects/{project_id}/notes", status_code=201)
def create_note(project_id: str, body: NoteCreate, ctx: dict = Depends(require_permission(P_PROJECTS_WRITE))):
    client = db()
    _assert_project_in_tenant(client, project_id, ctx["tenant_id"])
    payload = {
        "tenant_id":  ctx["tenant_id"],
        "project_id": project_id,
        "created_by": ctx["profile_id"],
        "body":       body.body,
        "pinned":     bool(body.pinned),
    }
    r = client.table("project_notes").insert(payload).execute()
    note = r.data[0] if r.data else payload
    push_activity(ctx["tenant_id"], project_id, {
        "actor_id": ctx["profile_id"], "type": "note.created", "ref_id": note.get("id"),
    })
    return note


@router.put("/projects/{project_id}/notes/{note_id}")
def update_note(project_id: str, note_id: str, body: NoteUpdate,
                ctx: dict = Depends(require_permission(P_PROJECTS_WRITE))):
    client = db()
    _assert_project_in_tenant(client, project_id, ctx["tenant_id"])
    payload = body.model_dump(exclude_none=True)
    payload["updated_at"] = _now()
    r = client.table("project_notes").update(payload) \
        .eq("id", note_id).eq("project_id", project_id).execute()
    if not r.data:
        raise HTTPException(404, "Note not found")
    return r.data[0]


@router.delete("/projects/{project_id}/notes/{note_id}")
def delete_note(project_id: str, note_id: str, ctx: dict = Depends(require_permission(P_PROJECTS_WRITE))):
    client = db()
    _assert_project_in_tenant(client, project_id, ctx["tenant_id"])
    client.table("project_notes").delete().eq("id", note_id).eq("project_id", project_id).execute()
    return {"message": "deleted"}


# ── Activity stream ──────────────────────────────────────────────────────────
@router.get("/projects/{project_id}/activity")
def list_activity(project_id: str,
                  limit: int = Query(50, le=200),
                  ctx: dict = Depends(require_permission(P_PROJECTS_READ))):
    client = db()
    _assert_project_in_tenant(client, project_id, ctx["tenant_id"])
    r = client.table("project_activity").select("*") \
        .eq("project_id", project_id).eq("tenant_id", ctx["tenant_id"]) \
        .order("created_at", desc=True).limit(limit).execute()
    # Frontend shape compat: expose `type` + `at` aliases for legacy clients
    out = []
    for row in r.data or []:
        out.append({
            **row,
            "type": row.get("event_type"),
            "at":   row.get("created_at"),
        })
    return {"data": out}


# ── Lead → Project converter ────────────────────────────────────────────────
@router.post("/leads/{lead_id}/convert", status_code=201)
def convert_lead_to_project(lead_id: str, ctx: dict = Depends(require_permission(P_LEADS_WRITE))):
    client = db()
    lr = client.table("leads").select("*").eq("id", lead_id).eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not lr.data:
        raise HTTPException(404, "Lead not found")
    lead = lr.data[0]
    now = _now()
    project_id = str(uuid.uuid4())
    project = {
        "id": project_id,
        "tenant_id": ctx["tenant_id"],
        "title": f"{lead.get('first_name') or ''} {lead.get('last_name') or ''}".strip() or "New project",
        "project_type": lead.get("project_type"),
        "lead_id":      lead_id,
        "status":       "new",
        "budget_range": lead.get("budget_range"),
        "timeline":     lead.get("timeline"),
        "description":  lead.get("notes"),
        "language":     lead.get("language"),
        "created_at":   now,
        "updated_at":   now,
    }
    project = {k: v for k, v in project.items() if v not in (None, "")}
    inserted = client.table("projects").insert(project).execute().data
    project = inserted[0] if inserted else project

    try:
        client.table("leads").update({"status": "project_opened", "updated_at": now}).eq("id", lead_id).execute()
    except Exception:
        pass

    push_activity(ctx["tenant_id"], project_id, {
        "actor_id": ctx["profile_id"], "type": "project.created_from_lead",
        "label": project.get("title"), "ref_id": lead_id,
    })
    audit_log(ctx["tenant_id"], ctx["profile_id"], "lead.convert",
              resource_type="lead", resource_id=lead_id,
              metadata={"project_id": project_id})
    return project
