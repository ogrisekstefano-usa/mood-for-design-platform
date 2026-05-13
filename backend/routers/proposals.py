"""Proposals CRUD + signoff workflow."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from models.schemas import ProposalCreate, ProposalUpdate, ProposalSignoff
from middleware.auth import get_current_user
from core.tenant_context import get_tenant_context, require_permission
from core.permissions import (
    P_PROPOSALS_READ, P_PROPOSALS_WRITE, P_PROPOSALS_APPROVE, P_PROPOSALS_DELETE,
)
from database import db

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _scrub(d: dict) -> dict:
    return {k: v for k, v in d.items() if v is not None}


@router.get("")
def list_proposals(
    project_id: str = Query(None),
    status: str = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: dict = Depends(require_permission(P_PROPOSALS_READ)),
):
    client = db()
    q = client.table('proposals').select('*').eq('tenant_id', current_user['tenant_id'])
    if project_id:
        q = q.eq('project_id', project_id)
    if status:
        q = q.eq('status', status)
    r = q.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
    return {"data": r.data or [], "total": len(r.data or [])}


@router.post("", status_code=201)
def create_proposal(body: ProposalCreate, current_user: dict = Depends(require_permission(P_PROPOSALS_WRITE))):
    client = db()
    # verify project belongs to tenant
    proj = client.table('projects').select('id').eq('id', body.project_id).eq('tenant_id', current_user['tenant_id']).limit(1).execute()
    if not proj.data:
        raise HTTPException(404, "Project not found")

    now = _now()
    proposal = {
        'id': str(uuid.uuid4()),
        'tenant_id': current_user['tenant_id'],
        'project_id': body.project_id,
        'created_by': current_user['profile_id'],
        'title': body.title,
        'description': body.description,
        'status': 'draft',
        'version': 1,
        'total_value': body.total_value,
        'currency': body.currency,
        'expires_at': body.expires_at,
        'created_at': now, 'updated_at': now,
    }
    r = client.table('proposals').insert(_scrub(proposal)).execute()
    return r.data[0] if r.data else proposal


@router.get("/{proposal_id}")
def get_proposal(proposal_id: str, current_user: dict = Depends(require_permission(P_PROPOSALS_READ))):
    client = db()
    r = client.table('proposals').select('*').eq('id', proposal_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not r.data:
        raise HTTPException(404, "Not found")
    proposal = r.data[0]
    items = client.table('proposal_items').select('*').eq('proposal_id', proposal_id).order('sort_order').execute()
    signoffs = client.table('proposal_signoffs').select('*').eq('proposal_id', proposal_id).order('created_at', desc=True).execute()
    proposal['items'] = items.data or []
    proposal['signoffs'] = signoffs.data or []
    return proposal


@router.put("/{proposal_id}")
def update_proposal(proposal_id: str, body: ProposalUpdate, current_user: dict = Depends(require_permission(P_PROPOSALS_WRITE))):
    client = db()
    updates = _scrub(body.model_dump())
    if not updates:
        raise HTTPException(400, "No fields")
    updates['updated_at'] = _now()
    r = client.table('proposals').update(updates).eq('id', proposal_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not r.data:
        raise HTTPException(404, "Not found")
    return r.data[0]


@router.delete("/{proposal_id}")
def delete_proposal(proposal_id: str, current_user: dict = Depends(require_permission(P_PROPOSALS_DELETE))):
    client = db()
    client.table('proposals').delete().eq('id', proposal_id).eq('tenant_id', current_user['tenant_id']).execute()
    return {"message": "deleted"}


@router.post("/{proposal_id}/signoff", status_code=201)
def signoff(proposal_id: str, body: ProposalSignoff, current_user: dict = Depends(require_permission(P_PROPOSALS_APPROVE))):
    client = db()
    r = client.table('proposals').select('id, project_id').eq('id', proposal_id).eq('tenant_id', current_user['tenant_id']).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Not found")
    proposal = r.data[0]

    decision = body.decision
    if decision not in ('approved', 'revision_requested', 'rejected'):
        raise HTTPException(400, "Invalid decision")

    now = _now()
    client.table('proposal_signoffs').insert({
        'id': str(uuid.uuid4()), 'tenant_id': current_user['tenant_id'],
        'proposal_id': proposal_id, 'project_id': proposal['project_id'],
        'client_user_id': current_user['profile_id'],
        'decision': decision, 'comment': body.comment, 'created_at': now,
    }).execute()
    client.table('proposals').update({'status': decision, 'updated_at': now}).eq('id', proposal_id).execute()
    return {"message": "Signoff recorded", "decision": decision}
