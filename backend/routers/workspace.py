"""Blueprint Workspace™ extension — Tasks, Notes, Activity for a project.

Stored per tenant in `tenant_settings` with key patterns:
    project.{project_id}.tasks      → list[Task]
    project.{project_id}.notes      → list[Note]
    project.{project_id}.activity   → list[ActivityEvent]

Tasks / notes are user-edited; activity is the auto-generated stream of
project events (status change, file upload, moodboard approved, …).
Future migration to dedicated tables is transparent (same API contract).
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from core.tenant_context import (
    get_tenant_context, get_tenant_settings, upsert_tenant_setting, audit_log,
)
from database import db

router = APIRouter()
logger = logging.getLogger(__name__)


def _now():
    return datetime.now(timezone.utc).isoformat()


def _k_tasks(pid):    return f"project.{pid}.tasks"
def _k_notes(pid):    return f"project.{pid}.notes"
def _k_activity(pid): return f"project.{pid}.activity"


def _assert_project_in_tenant(client, project_id: str, tenant_id: str):
    r = client.table('projects').select('id').eq('id', project_id).eq('tenant_id', tenant_id).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Project not found")


def push_activity(tenant_id: str, project_id: str, event: dict) -> None:
    """Append an event to the activity stream. Safe to call from any router."""
    try:
        stream = get_tenant_settings(tenant_id, _k_activity(project_id), {"items": []}) or {"items": []}
        items = stream.get("items") or []
        items.append({
            "id":       str(uuid.uuid4()),
            "at":       _now(),
            **event,
        })
        # Keep last 200 to prevent unbounded growth
        if len(items) > 200:
            items = items[-200:]
        upsert_tenant_setting(tenant_id, _k_activity(project_id), {"items": items})
    except Exception as e:
        logger.warning(f"activity stream push failed: {e}")


# ── Schemas ──────────────────────────────────────────────────────────────────
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = "normal"  # low | normal | high


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None  # todo | in_progress | done
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    completed_at: Optional[str] = None


class NoteCreate(BaseModel):
    body: str
    pinned: Optional[bool] = False


class NoteUpdate(BaseModel):
    body: Optional[str] = None
    pinned: Optional[bool] = None


# ── Tasks ────────────────────────────────────────────────────────────────────
@router.get("/projects/{project_id}/tasks")
def list_tasks(project_id: str, ctx: dict = Depends(get_tenant_context)):
    _assert_project_in_tenant(db(), project_id, ctx["tenant_id"])
    data = get_tenant_settings(ctx["tenant_id"], _k_tasks(project_id), {"items": []}) or {"items": []}
    return {"data": data.get("items") or []}


@router.post("/projects/{project_id}/tasks", status_code=201)
def create_task(project_id: str, body: TaskCreate, ctx: dict = Depends(get_tenant_context)):
    _assert_project_in_tenant(db(), project_id, ctx["tenant_id"])
    data = get_tenant_settings(ctx["tenant_id"], _k_tasks(project_id), {"items": []}) or {"items": []}
    items = data.get("items") or []
    task = {
        "id": str(uuid.uuid4()),
        "status": "todo",
        "created_by": ctx["profile_id"],
        "created_at": _now(),
        "updated_at": _now(),
        **body.model_dump(exclude_none=True),
    }
    items.append(task)
    upsert_tenant_setting(ctx["tenant_id"], _k_tasks(project_id), {"items": items})
    push_activity(ctx["tenant_id"], project_id,
                  {"actor_id": ctx["profile_id"], "type": "task.created",
                   "ref_id": task["id"], "label": task["title"]})
    return task


@router.put("/projects/{project_id}/tasks/{task_id}")
def update_task(project_id: str, task_id: str, body: TaskUpdate,
                ctx: dict = Depends(get_tenant_context)):
    _assert_project_in_tenant(db(), project_id, ctx["tenant_id"])
    data = get_tenant_settings(ctx["tenant_id"], _k_tasks(project_id), {"items": []}) or {"items": []}
    items = data.get("items") or []
    payload = body.model_dump(exclude_none=True)
    updated = None
    old_status = None
    for t in items:
        if t["id"] == task_id:
            old_status = t.get("status")
            t.update(payload)
            t["updated_at"] = _now()
            if payload.get("status") == "done" and not t.get("completed_at"):
                t["completed_at"] = _now()
            updated = t
            break
    if not updated:
        raise HTTPException(404, "Task not found")
    upsert_tenant_setting(ctx["tenant_id"], _k_tasks(project_id), {"items": items})
    if payload.get("status") and payload["status"] != old_status:
        push_activity(ctx["tenant_id"], project_id,
                      {"actor_id": ctx["profile_id"], "type": "task.status_change",
                       "ref_id": task_id, "label": updated.get("title"),
                       "from": old_status, "to": payload["status"]})
    return updated


@router.delete("/projects/{project_id}/tasks/{task_id}")
def delete_task(project_id: str, task_id: str, ctx: dict = Depends(get_tenant_context)):
    _assert_project_in_tenant(db(), project_id, ctx["tenant_id"])
    data = get_tenant_settings(ctx["tenant_id"], _k_tasks(project_id), {"items": []}) or {"items": []}
    items = [t for t in (data.get("items") or []) if t["id"] != task_id]
    upsert_tenant_setting(ctx["tenant_id"], _k_tasks(project_id), {"items": items})
    return {"message": "deleted"}


# ── Notes ────────────────────────────────────────────────────────────────────
@router.get("/projects/{project_id}/notes")
def list_notes(project_id: str, ctx: dict = Depends(get_tenant_context)):
    _assert_project_in_tenant(db(), project_id, ctx["tenant_id"])
    data = get_tenant_settings(ctx["tenant_id"], _k_notes(project_id), {"items": []}) or {"items": []}
    items = sorted(data.get("items") or [], key=lambda n: (not n.get("pinned"), n.get("created_at") or ""), reverse=False)
    # Pinned first, then most recent
    items = sorted(items, key=lambda n: (not n.get("pinned"), -1 * (n.get("created_at") or "") if False else n.get("created_at")), reverse=False)
    # simpler: pinned first then newest
    items = sorted(data.get("items") or [], key=lambda n: ((not n.get("pinned"), ), n.get("created_at") or ""), reverse=False)
    return {"data": items}


@router.post("/projects/{project_id}/notes", status_code=201)
def create_note(project_id: str, body: NoteCreate, ctx: dict = Depends(get_tenant_context)):
    _assert_project_in_tenant(db(), project_id, ctx["tenant_id"])
    data = get_tenant_settings(ctx["tenant_id"], _k_notes(project_id), {"items": []}) or {"items": []}
    items = data.get("items") or []
    note = {
        "id": str(uuid.uuid4()),
        "created_by": ctx["profile_id"],
        "created_at": _now(),
        "updated_at": _now(),
        **body.model_dump(exclude_none=True),
    }
    items.append(note)
    upsert_tenant_setting(ctx["tenant_id"], _k_notes(project_id), {"items": items})
    push_activity(ctx["tenant_id"], project_id,
                  {"actor_id": ctx["profile_id"], "type": "note.created", "ref_id": note["id"]})
    return note


@router.put("/projects/{project_id}/notes/{note_id}")
def update_note(project_id: str, note_id: str, body: NoteUpdate,
                ctx: dict = Depends(get_tenant_context)):
    _assert_project_in_tenant(db(), project_id, ctx["tenant_id"])
    data = get_tenant_settings(ctx["tenant_id"], _k_notes(project_id), {"items": []}) or {"items": []}
    items = data.get("items") or []
    payload = body.model_dump(exclude_none=True)
    updated = None
    for n in items:
        if n["id"] == note_id:
            n.update(payload)
            n["updated_at"] = _now()
            updated = n
            break
    if not updated:
        raise HTTPException(404, "Note not found")
    upsert_tenant_setting(ctx["tenant_id"], _k_notes(project_id), {"items": items})
    return updated


@router.delete("/projects/{project_id}/notes/{note_id}")
def delete_note(project_id: str, note_id: str, ctx: dict = Depends(get_tenant_context)):
    _assert_project_in_tenant(db(), project_id, ctx["tenant_id"])
    data = get_tenant_settings(ctx["tenant_id"], _k_notes(project_id), {"items": []}) or {"items": []}
    items = [n for n in (data.get("items") or []) if n["id"] != note_id]
    upsert_tenant_setting(ctx["tenant_id"], _k_notes(project_id), {"items": items})
    return {"message": "deleted"}


# ── Activity stream ──────────────────────────────────────────────────────────
@router.get("/projects/{project_id}/activity")
def list_activity(project_id: str,
                  limit: int = Query(50, le=200),
                  ctx: dict = Depends(get_tenant_context)):
    _assert_project_in_tenant(db(), project_id, ctx["tenant_id"])
    data = get_tenant_settings(ctx["tenant_id"], _k_activity(project_id), {"items": []}) or {"items": []}
    items = data.get("items") or []
    items = sorted(items, key=lambda x: x.get("at") or "", reverse=True)[:limit]
    return {"data": items}


# ── Lead → Project converter ────────────────────────────────────────────────
@router.post("/leads/{lead_id}/convert", status_code=201)
def convert_lead_to_project(lead_id: str, ctx: dict = Depends(get_tenant_context)):
    client = db()
    lr = client.table('leads').select('*').eq('id', lead_id).eq('tenant_id', ctx['tenant_id']).limit(1).execute()
    if not lr.data:
        raise HTTPException(404, "Lead not found")
    lead = lr.data[0]
    now = _now()
    project_id = str(uuid.uuid4())
    project = {
        "id": project_id,
        "tenant_id": ctx['tenant_id'],
        "title": f"{lead.get('first_name') or ''} {lead.get('last_name') or ''}".strip() or "New project",
        "project_type": lead.get('project_type'),
        "client_email": lead.get('email'),
        "client_phone": lead.get('phone'),
        "lead_id":    lead_id,
        "status":     "new",
        "budget_range": lead.get('budget_range'),
        "timeline":   lead.get('timeline'),
        "notes":      lead.get('notes'),
        "created_at": now,
        "updated_at": now,
    }
    project = {k: v for k, v in project.items() if v is not None}
    inserted = client.table('projects').insert(project).execute().data
    project = inserted[0] if inserted else project

    # Update lead status to qualified
    try:
        client.table('leads').update({'status': 'converted', 'updated_at': now}).eq('id', lead_id).execute()
    except Exception:
        pass

    push_activity(ctx['tenant_id'], project_id,
                  {"actor_id": ctx['profile_id'], "type": "project.created_from_lead",
                   "label": project.get("title"), "ref_id": lead_id})
    audit_log(ctx['tenant_id'], ctx['profile_id'], "lead.convert",
              resource_type="lead", resource_id=lead_id,
              metadata={"project_id": project_id})
    return project
