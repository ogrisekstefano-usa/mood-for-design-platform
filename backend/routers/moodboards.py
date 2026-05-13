"""Moodboards CRUD — block-based editor backbone."""
import re
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from models.schemas import MoodboardCreate, MoodboardUpdate
from middleware.auth import get_current_user
from core.tenant_context import get_tenant_context
from database import db

router = APIRouter()

_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def _require_uuid(s: str, name: str = "id") -> str:
    if not _UUID_RE.match(s or ""):
        raise HTTPException(404, "Not found")
    return s


def _now():
    return datetime.now(timezone.utc).isoformat()


def _scrub(d: dict) -> dict:
    return {k: v for k, v in d.items() if v is not None}


@router.get("")
def list_moodboards(
    project_id: str = Query(None),
    status: str = Query(None),
    current_user: dict = Depends(get_tenant_context),
):
    client = db()
    q = client.table('moodboards').select('*').eq('tenant_id', current_user['tenant_id'])
    if project_id:
        q = q.eq('project_id', project_id)
    if status:
        q = q.eq('status', status)
    r = q.order('updated_at', desc=True).execute()
    return {"data": r.data or [], "total": len(r.data or [])}


@router.post("", status_code=201)
def create_moodboard(body: MoodboardCreate, current_user: dict = Depends(get_tenant_context)):
    client = db()
    now = _now()
    payload = _scrub(body.model_dump())
    moodboard = {
        'id': str(uuid.uuid4()), 'tenant_id': current_user['tenant_id'],
        'created_by': current_user['profile_id'], 'status': 'draft', 'current_version': 1,
        'created_at': now, 'updated_at': now, **payload,
    }
    r = client.table('moodboards').insert(moodboard).execute()
    return r.data[0] if r.data else moodboard


@router.get("/{moodboard_id}")
def get_moodboard(moodboard_id: str, current_user: dict = Depends(get_tenant_context)):
    _require_uuid(moodboard_id)
    client = db()
    r = client.table('moodboards').select('*').eq('id', moodboard_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not r.data:
        raise HTTPException(404, "Not found")
    mb = r.data[0]
    els = client.table('moodboard_elements').select('*').eq('moodboard_id', moodboard_id).order('sort_order').execute()
    from routers.moodboards_v1 import _normalize_block
    mb['elements'] = [_normalize_block(b) for b in (els.data or [])]
    return mb


@router.put("/{moodboard_id}")
def update_moodboard(moodboard_id: str, body: MoodboardUpdate, current_user: dict = Depends(get_tenant_context)):
    _require_uuid(moodboard_id)
    client = db()
    updates = _scrub(body.model_dump())
    if not updates:
        raise HTTPException(400, "No fields")
    updates['updated_at'] = _now()
    r = client.table('moodboards').update(updates).eq('id', moodboard_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not r.data:
        raise HTTPException(404, "Not found")
    return r.data[0]


@router.delete("/{moodboard_id}")
def delete_moodboard(moodboard_id: str, current_user: dict = Depends(get_tenant_context)):
    _require_uuid(moodboard_id)
    client = db()
    client.table('moodboards').delete().eq('id', moodboard_id).eq('tenant_id', current_user['tenant_id']).execute()
    return {"message": "deleted"}
