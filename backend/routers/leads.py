"""Leads CRUD — aligned with Supabase 'leads' table schema."""
import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from models.schemas import LeadCreate, LeadUpdate
from middleware.auth import get_current_user
from core.tenant_context import get_tenant_context, require_permission
from core.permissions import (
    P_LEADS_READ, P_LEADS_WRITE, P_LEADS_DELETE,
)
from database import db, db_available

router = APIRouter()
logger = logging.getLogger(__name__)


def _now():
    return datetime.now(timezone.utc).isoformat()


def _scrub(d: dict) -> dict:
    """Remove None values to let DB defaults kick in."""
    return {k: v for k, v in d.items() if v is not None}


@router.get("")
def list_leads(
    status: str = Query(None),
    lead_type: str = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: dict = Depends(require_permission(P_LEADS_READ)),
):
    client = db()
    q = client.table('leads').select('*').eq('tenant_id', current_user['tenant_id'])
    if status:
        q = q.eq('status', status)
    if lead_type:
        q = q.eq('lead_type', lead_type)
    result = q.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
    return {"data": result.data or [], "total": len(result.data or [])}


@router.post("", status_code=201)
def create_lead(body: LeadCreate, current_user: dict = Depends(require_permission(P_LEADS_WRITE))):
    client = db()
    now = _now()
    payload = _scrub(body.model_dump())
    if 'email' in payload and payload['email']:
        payload['email'] = payload['email'].lower()
    lead = {
        'id': str(uuid.uuid4()),
        'tenant_id': current_user['tenant_id'],
        'status': 'new',
        'created_at': now,
        'updated_at': now,
        **payload,
    }
    result = client.table('leads').insert(lead).execute()
    return result.data[0] if result.data else lead


@router.get("/{lead_id}")
def get_lead(lead_id: str, current_user: dict = Depends(require_permission(P_LEADS_READ))):
    client = db()
    result = client.table('leads').select('*').eq('id', lead_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not result.data:
        raise HTTPException(404, "Lead not found")
    return result.data[0]


@router.put("/{lead_id}")
def update_lead(lead_id: str, body: LeadUpdate, current_user: dict = Depends(require_permission(P_LEADS_WRITE))):
    client = db()
    updates = _scrub(body.model_dump())
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates['updated_at'] = _now()
    if 'email' in updates and updates['email']:
        updates['email'] = updates['email'].lower()
    result = client.table('leads').update(updates).eq('id', lead_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not result.data:
        raise HTTPException(404, "Lead not found")
    return result.data[0]


@router.delete("/{lead_id}")
def delete_lead(lead_id: str, current_user: dict = Depends(require_permission(P_LEADS_DELETE))):
    client = db()
    client.table('leads').delete().eq('id', lead_id).eq('tenant_id', current_user['tenant_id']).execute()
    return {"message": "Lead deleted"}


# ── PUBLIC ENDPOINT (no auth) ────────────────────────────────────────────────
@router.post("/public", status_code=201)
def submit_public_lead(
    body: LeadCreate = Body(...),
    tenant_slug: str = Query(..., description="Tenant slug from public URL"),
):
    """Anonymous lead-capture form endpoint. Tenant scoped by slug."""
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    tenant = client.table('tenants').select('id, status').eq('slug', tenant_slug).limit(1).execute()
    if not tenant.data or tenant.data[0].get('status') != 'active':
        raise HTTPException(404, "Tenant not found")
    tenant_id = tenant.data[0]['id']

    now = _now()
    payload = _scrub(body.model_dump())
    if 'email' in payload and payload['email']:
        payload['email'] = payload['email'].lower()
    lead = {
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'status': 'new',
        'source': payload.get('source') or 'public_form',
        'created_at': now,
        'updated_at': now,
        **payload,
    }
    client.table('leads').insert(lead).execute()

    # Funnel event
    try:
        client.table('funnel_events').insert({
            'id': str(uuid.uuid4()),
            'tenant_id': tenant_id,
            'lead_id': lead['id'],
            'stage': 'lead_captured',
            'event_name': 'public_form_submit',
            'metadata_json': {'source': payload.get('source', 'public_form')},
            'created_at': now,
        }).execute()
    except Exception:
        pass

    return {"id": lead['id'], "message": "ok"}
