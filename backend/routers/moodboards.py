"""Moodboards CRUD — block-based editor backbone."""
import re
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from models.schemas import MoodboardCreate, MoodboardUpdate
from middleware.auth import get_current_user
from core.tenant_context import get_tenant_context, require_permission
from core.permissions import (
    P_MOODBOARDS_READ, P_MOODBOARDS_WRITE, P_MOODBOARDS_DELETE,
)
from core.licensing import assert_capacity
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
    current_user: dict = Depends(require_permission(P_MOODBOARDS_READ)),
):
    client = db()
    q = client.table('moodboards').select('*').eq('tenant_id', current_user['tenant_id'])
    # Always exclude soft-deleted from the list view (archived stays visible
    # so the user can restore from the UI).
    q = q.is_('deleted_at', None)
    if project_id:
        q = q.eq('project_id', project_id)
    if status:
        q = q.eq('status', status)
    r = q.order('updated_at', desc=True).execute()
    return {"data": r.data or [], "total": len(r.data or [])}


@router.post("", status_code=201)
def create_moodboard(body: MoodboardCreate, current_user: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    # License capacity gate — blocks before any DB writes
    assert_capacity(current_user['tenant_id'], "moodboards")
    client = db()
    now = _now()
    payload = _scrub(body.model_dump())
    moodboard = {
        'id': str(uuid.uuid4()), 'tenant_id': current_user['tenant_id'],
        'created_by': current_user['profile_id'], 'status': 'draft', 'current_version': 1,
        'created_at': now, 'updated_at': now, **payload,
    }
    r = client.table('moodboards').insert(moodboard).execute()
    # F.0: every new moodboard ships with a default "Page 1" page (title mirrors
    # the moodboard's title per user spec) so the multi-page editor has a
    # valid landing surface from the very first render.
    default_page_id = str(uuid.uuid4())
    client.table('moodboard_pages').insert({
        'id': default_page_id,
        'tenant_id': current_user['tenant_id'],
        'moodboard_id': moodboard['id'],
        'title': moodboard.get('title') or 'Page 1',
        'page_type': 'blank',
        'aspect_ratio': 'portrait_a4',
        'width': 1400, 'height': 2400,
        'sort_order': 0,
        'created_by': current_user['profile_id'],
    }).execute()
    client.table('moodboards').update({'current_page_id': default_page_id}) \
        .eq('id', moodboard['id']).execute()
    # Always overlay current_page_id onto the response (the original insert
    # response predates the update and would otherwise expose current_page_id=None).
    out = dict(r.data[0]) if r.data else moodboard
    out['current_page_id'] = default_page_id
    return out


@router.get("/{moodboard_id}")
def get_moodboard(moodboard_id: str, current_user: dict = Depends(require_permission(P_MOODBOARDS_READ))):
    _require_uuid(moodboard_id)
    client = db()
    r = client.table('moodboards').select('*').eq('id', moodboard_id) \
        .eq('tenant_id', current_user['tenant_id']).is_('deleted_at', None).execute()
    if not r.data:
        raise HTTPException(404, "Not found")
    mb = r.data[0]
    # F.0: include the moodboard's ordered pages alongside the legacy flat
    # `elements` list (kept for backward compat with the current editor).
    pages_q = client.table('moodboard_pages').select('*') \
        .eq('moodboard_id', moodboard_id).order('sort_order').execute()
    mb['pages'] = pages_q.data or []
    els = client.table('moodboard_elements').select('*').eq('moodboard_id', moodboard_id).order('sort_order').execute()
    from routers.moodboards_v1 import _normalize_block
    mb['elements'] = [_normalize_block(b) for b in (els.data or [])]
    return mb


@router.put("/{moodboard_id}")
def update_moodboard(moodboard_id: str, body: MoodboardUpdate, current_user: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
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
def delete_moodboard(moodboard_id: str, current_user: dict = Depends(require_permission(P_MOODBOARDS_DELETE))):
    _require_uuid(moodboard_id)
    client = db()
    # Soft delete — preserves history + frees a quota slot
    r = client.table('moodboards').update({'deleted_at': _now(), 'updated_at': _now()}) \
        .eq('id', moodboard_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not r.data:
        raise HTTPException(404, "Not found")
    return {"message": "deleted"}


@router.post("/{moodboard_id}/archive")
def archive_moodboard(moodboard_id: str, current_user: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    _require_uuid(moodboard_id)
    client = db()
    r = client.table('moodboards').update({'archived_at': _now(), 'updated_at': _now()}) \
        .eq('id', moodboard_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not r.data:
        raise HTTPException(404, "Not found")
    return {"message": "archived"}


@router.post("/{moodboard_id}/restore")
def restore_moodboard(moodboard_id: str, current_user: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    _require_uuid(moodboard_id)
    # Restoring takes a quota slot back — gate before flipping the flag
    assert_capacity(current_user['tenant_id'], "moodboards")
    client = db()
    r = client.table('moodboards').update({
        'archived_at': None, 'deleted_at': None, 'updated_at': _now()
    }).eq('id', moodboard_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not r.data:
        raise HTTPException(404, "Not found")
    return r.data[0]
