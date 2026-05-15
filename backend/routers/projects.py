"""Projects CRUD — aligned with Supabase 'projects' table schema."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from models.schemas import ProjectCreate, ProjectUpdate
from middleware.auth import get_current_user
from core.tenant_context import get_tenant_context, require_permission
from core.permissions import (
    P_PROJECTS_READ, P_PROJECTS_WRITE, P_PROJECTS_DELETE,
)
from database import db

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _scrub(d: dict) -> dict:
    return {k: v for k, v in d.items() if v is not None}


@router.get("")
def list_projects(
    status: str = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: dict = Depends(require_permission(P_PROJECTS_READ)),
):
    client = db()
    q = client.table('projects').select('*').eq('tenant_id', current_user['tenant_id'])
    if status:
        q = q.eq('status', status)
    result = q.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
    return {"data": result.data or [], "total": len(result.data or [])}


@router.post("", status_code=201)
def create_project(body: ProjectCreate, current_user: dict = Depends(require_permission(P_PROJECTS_WRITE))):
    client = db()
    now = _now()
    payload = _scrub(body.model_dump())
    project = {
        'id': str(uuid.uuid4()),
        'tenant_id': current_user['tenant_id'],
        'status': 'new',
        'created_at': now,
        'updated_at': now,
        **payload,
    }
    result = client.table('projects').insert(project).execute()
    return result.data[0] if result.data else project


@router.get("/{project_id}")
def get_project(project_id: str, current_user: dict = Depends(require_permission(P_PROJECTS_READ))):
    client = db()
    result = client.table('projects').select('*').eq('id', project_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not result.data:
        raise HTTPException(404, "Project not found")
    project = result.data[0]

    # Enrich with related counts
    proposals = client.table('proposals').select('id, status, title, total_value, currency, created_at').eq('project_id', project_id).execute()
    moodboards = client.table('moodboards').select('id, title, status').eq('project_id', project_id).execute()
    files = client.table('project_files').select('id').eq('project_id', project_id).execute()

    project['proposals'] = proposals.data or []
    project['moodboards'] = moodboards.data or []
    project['files_count'] = len(files.data or [])

    # Enrich with the assigned designer (Human Relationship Layer).
    # If assigned_to is set, expose a compact profile bag so the workspace can
    # render "Your project is followed by ..." without an extra round-trip.
    if project.get('assigned_to'):
        prof = client.table('users_profile').select(
            'id, first_name, last_name, email, avatar_url, metadata_json'
        ).eq('id', project['assigned_to']).limit(1).execute()
        if prof.data:
            p = prof.data[0]
            meta = p.get('metadata_json') or {}
            project['assigned_designer'] = {
                'id': p['id'],
                'first_name': p.get('first_name'),
                'last_name': p.get('last_name'),
                'email': p.get('email'),
                'avatar_url': p.get('avatar_url'),
                'role_label': meta.get('role_label'),
                'bio_short': meta.get('bio_short'),
                'languages': meta.get('languages', []),
                'online_status': meta.get('online_status', 'available'),
            }
    return project


@router.put("/{project_id}")
def update_project(project_id: str, body: ProjectUpdate, current_user: dict = Depends(require_permission(P_PROJECTS_WRITE))):
    client = db()
    updates = _scrub(body.model_dump())
    if not updates:
        raise HTTPException(400, "No fields to update")
    new_status = updates.get('status')

    # Fetch current to log history
    current = client.table('projects').select('status').eq('id', project_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not current.data:
        raise HTTPException(404, "Project not found")
    old_status = current.data[0].get('status')

    updates['updated_at'] = _now()
    result = client.table('projects').update(updates).eq('id', project_id).eq('tenant_id', current_user['tenant_id']).execute()

    if new_status and new_status != old_status:
        try:
            client.table('project_status_history').insert({
                'id': str(uuid.uuid4()),
                'tenant_id': current_user['tenant_id'],
                'project_id': project_id,
                'old_status': old_status,
                'new_status': new_status,
                'changed_by': current_user['profile_id'],
                'created_at': _now(),
            }).execute()
        except Exception:
            pass

    return result.data[0]


@router.delete("/{project_id}")
def delete_project(project_id: str, current_user: dict = Depends(require_permission(P_PROJECTS_DELETE))):
    client = db()
    client.table('projects').delete().eq('id', project_id).eq('tenant_id', current_user['tenant_id']).execute()
    return {"message": "Project deleted"}
