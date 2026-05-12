import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from models.proposal import ProposalCreate, ProposalUpdate, ProposalRespond
from middleware.auth import get_current_user
from database import get_db, db_available

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.get("")
def list_proposals(
    status: str = Query(None),
    project_id: str = Query(None),
    current_user: dict = Depends(get_current_user)
):
    if not db_available():
        return {"data": [], "total": 0}
    db = get_db()
    q = db.table('proposals').select('*').eq('tenant_id', current_user['tenant_id'])
    if status:
        q = q.eq('status', status)
    if project_id:
        q = q.eq('project_id', project_id)
    result = q.order('created_at', desc=True).execute()
    return {"data": result.data, "total": len(result.data)}


@router.post("", status_code=201)
def create_proposal(body: ProposalCreate, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    db = get_db()
    now = _now()
    proposal = {
        'id': str(uuid.uuid4()),
        'tenant_id': current_user['tenant_id'],
        'status': 'draft',
        'version': 1,
        'created_by': current_user['sub'],
        **body.model_dump(exclude_none=True),
        'created_at': now,
        'updated_at': now,
    }
    result = db.table('proposals').insert(proposal).execute()
    return result.data[0] if result.data else proposal


@router.get("/{proposal_id}")
def get_proposal(proposal_id: str, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    db = get_db()
    result = db.table('proposals').select('*').eq('id', proposal_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not result.data:
        raise HTTPException(404, "Proposal not found")
    return result.data[0]


@router.put("/{proposal_id}")
def update_proposal(proposal_id: str, body: ProposalUpdate, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates['updated_at'] = _now()
    result = db.table('proposals').update(updates).eq('id', proposal_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not result.data:
        raise HTTPException(404, "Proposal not found")
    return result.data[0]


@router.post("/{proposal_id}/send")
def send_proposal(proposal_id: str, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    db = get_db()
    db.table('proposals').update({'status': 'sent', 'sent_at': _now(), 'updated_at': _now()}).eq('id', proposal_id).eq('tenant_id', current_user['tenant_id']).execute()
    return {"message": "Proposal sent"}


@router.post("/{proposal_id}/respond")
def respond_to_proposal(proposal_id: str, body: ProposalRespond):
    """Public endpoint for client response — no auth required."""
    if not db_available():
        raise HTTPException(503, "Database not configured")
    action_map = {'approve': 'approved', 'request_revision': 'revision_requested', 'reject': 'rejected'}
    new_status = action_map.get(body.action)
    if not new_status:
        raise HTTPException(400, "Invalid action")
    db = get_db()
    db.table('proposals').update({
        'status': new_status,
        'responded_at': _now(),
        'response_note': body.note,
        'updated_at': _now()
    }).eq('id', proposal_id).execute()
    return {"message": f"Proposal {new_status}"}
