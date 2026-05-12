import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from models.moodboard import MoodboardCreate, MoodboardUpdate
from middleware.auth import get_current_user
from database import get_db, db_available

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.get("")
def list_moodboards(
    project_id: str = Query(None),
    current_user: dict = Depends(get_current_user)
):
    if not db_available():
        return {"data": [], "total": 0}
    db = get_db()
    q = db.table('moodboards').select('*').eq('tenant_id', current_user['tenant_id'])
    if project_id:
        q = q.eq('project_id', project_id)
    result = q.order('created_at', desc=True).execute()
    return {"data": result.data, "total": len(result.data)}


@router.post("", status_code=201)
def create_moodboard(body: MoodboardCreate, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    db = get_db()
    now = _now()
    mb = {
        'id': str(uuid.uuid4()),
        'tenant_id': current_user['tenant_id'],
        'status': 'draft',
        'pages': [],
        'blocks': [],
        'created_by': current_user['sub'],
        **body.model_dump(exclude_none=True),
        'created_at': now,
        'updated_at': now,
    }
    result = db.table('moodboards').insert(mb).execute()
    return result.data[0] if result.data else mb


@router.get("/{mb_id}")
def get_moodboard(mb_id: str, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    db = get_db()
    result = db.table('moodboards').select('*').eq('id', mb_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not result.data:
        raise HTTPException(404, "Moodboard not found")
    return result.data[0]


@router.put("/{mb_id}")
def update_moodboard(mb_id: str, body: MoodboardUpdate, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates['updated_at'] = _now()
    result = db.table('moodboards').update(updates).eq('id', mb_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not result.data:
        raise HTTPException(404, "Moodboard not found")
    return result.data[0]


@router.delete("/{mb_id}")
def delete_moodboard(mb_id: str, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    db = get_db()
    db.table('moodboards').delete().eq('id', mb_id).eq('tenant_id', current_user['tenant_id']).execute()
    return {"message": "Moodboard deleted"}
