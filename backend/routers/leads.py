import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from models.lead import LeadCreate, LeadUpdate
from middleware.auth import get_current_user
from database import get_db, db_available

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.get("")
def list_leads(
    status: str = Query(None),
    type: str = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    current_user: dict = Depends(get_current_user)
):
    if not db_available():
        return {"data": [], "total": 0, "message": "Supabase not configured"}

    db = get_db()
    q = db.table('leads').select('*').eq('tenant_id', current_user['tenant_id'])
    if status:
        q = q.eq('status', status)
    if type:
        q = q.eq('type', type)
    result = q.order('created_at', desc=True).limit(limit).offset(offset).execute()
    return {"data": result.data, "total": len(result.data)}


@router.post("", status_code=201)
def create_lead(body: LeadCreate, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")

    db = get_db()
    now = _now()
    lead = {
        'id': str(uuid.uuid4()),
        'tenant_id': current_user['tenant_id'],
        'status': 'new',
        **body.model_dump(),
        'email': body.email.lower(),
        'created_at': now,
        'updated_at': now,
    }
    result = db.table('leads').insert(lead).execute()
    return result.data[0] if result.data else lead


@router.get("/{lead_id}")
def get_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")

    db = get_db()
    result = db.table('leads').select('*').eq('id', lead_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not result.data:
        raise HTTPException(404, "Lead not found")
    return result.data[0]


@router.put("/{lead_id}")
def update_lead(lead_id: str, body: LeadUpdate, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")

    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates['updated_at'] = _now()
    result = db.table('leads').update(updates).eq('id', lead_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not result.data:
        raise HTTPException(404, "Lead not found")
    return result.data[0]


@router.delete("/{lead_id}")
def delete_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")

    db = get_db()
    db.table('leads').delete().eq('id', lead_id).eq('tenant_id', current_user['tenant_id']).execute()
    return {"message": "Lead deleted"}


@router.post("/public", status_code=201)
def submit_public_lead(body: LeadCreate, tenant_slug: str = Query(...)):
    """Public endpoint — no auth required. Used by lead capture forms."""
    if not db_available():
        raise HTTPException(503, "Database not configured")

    db = get_db()
    tenant = db.table('tenants').select('id').eq('slug', tenant_slug).execute()
    if not tenant.data:
        raise HTTPException(404, "Tenant not found")

    tenant_id = tenant.data[0]['id']
    now = _now()
    lead = {
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'status': 'new',
        **body.model_dump(),
        'email': body.email.lower(),
        'source': 'website_form',
        'created_at': now,
        'updated_at': now,
    }
    result = db.table('leads').insert(lead).execute()
    return {"message": "Richiesta inviata con successo", "id": lead['id']}
