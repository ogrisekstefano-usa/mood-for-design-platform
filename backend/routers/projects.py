import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from models.project import ProjectCreate, ProjectUpdate
from middleware.auth import get_current_user
from database import get_db, db_available

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.get("")
def list_projects(
    status: str = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    current_user: dict = Depends(get_current_user)
):
    if not db_available():
        return {"data": [], "total": 0}

    db = get_db()
    q = db.table('projects').select('*').eq('tenant_id', current_user['tenant_id'])
    if status:
        q = q.eq('status', status)
    result = q.order('created_at', desc=True).limit(limit).offset(offset).execute()
    return {"data": result.data, "total": len(result.data)}


@router.post("", status_code=201)
def create_project(body: ProjectCreate, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")

    db = get_db()
    now = _now()
    project = {
        'id': str(uuid.uuid4()),
        'tenant_id': current_user['tenant_id'],
        **body.model_dump(exclude_none=True),
        'metadata': {},
        'created_at': now,
        'updated_at': now,
    }
    result = db.table('projects').insert(project).execute()
    return result.data[0] if result.data else project


@router.get("/{project_id}")
def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")

    db = get_db()
    result = db.table('projects').select('*').eq('id', project_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not result.data:
        raise HTTPException(404, "Project not found")

    project = result.data[0]
    # Enrich with related counts
    if db_available():
        proposals = db.table('proposals').select('id,status').eq('project_id', project_id).execute()
        moodboards = db.table('moodboards').select('id').eq('project_id', project_id).execute()
        project['_proposals'] = proposals.data if proposals.data else []
        project['_moodboards_count'] = len(moodboards.data) if moodboards.data else 0

    return project


@router.put("/{project_id}")
def update_project(project_id: str, body: ProjectUpdate, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")

    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates['updated_at'] = _now()
    result = db.table('projects').update(updates).eq('id', project_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not result.data:
        raise HTTPException(404, "Project not found")
    return result.data[0]


@router.delete("/{project_id}")
def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")

    db = get_db()
    db.table('projects').delete().eq('id', project_id).eq('tenant_id', current_user['tenant_id']).execute()
    return {"message": "Project deleted"}
