"""Insights — dashboard KPI + activity feed."""
from fastapi import APIRouter, Depends, Query
from middleware.auth import get_current_user
from database import db

router = APIRouter()


def _count(table, tenant_id, filters=None):
    client = db()
    q = client.table(table).select('id', count='exact').eq('tenant_id', tenant_id)
    for k, v in (filters or {}).items():
        q = q.eq(k, v)
    r = q.execute()
    return r.count or 0


@router.get("/dashboard")
def dashboard(current_user: dict = Depends(get_current_user)):
    tid = current_user['tenant_id']
    return {
        "leads": {
            "total": _count('leads', tid),
            "new": _count('leads', tid, {'status': 'new'}),
            "qualified": _count('leads', tid, {'status': 'qualified'}),
        },
        "projects": {
            "total": _count('projects', tid),
            "in_progress": _count('projects', tid, {'status': 'proposal_in_progress'}),
            "won": _count('projects', tid, {'status': 'won'}),
        },
        "proposals": {
            "total": _count('proposals', tid),
            "sent": _count('proposals', tid, {'status': 'sent'}),
            "approved": _count('proposals', tid, {'status': 'approved'}),
        },
        "moodboards": {
            "total": _count('moodboards', tid),
        },
    }


@router.get("/activity")
def recent_activity(limit: int = Query(15, le=50), current_user: dict = Depends(get_current_user)):
    client = db()
    tid = current_user['tenant_id']
    # Pull latest events from multiple sources, merge in-memory.
    leads = client.table('leads').select('id, first_name, last_name, email, status, created_at').eq('tenant_id', tid).order('created_at', desc=True).limit(limit).execute().data or []
    projects = client.table('projects').select('id, title, status, created_at').eq('tenant_id', tid).order('created_at', desc=True).limit(limit).execute().data or []
    proposals = client.table('proposals').select('id, title, status, created_at').eq('tenant_id', tid).order('created_at', desc=True).limit(limit).execute().data or []
    moodboards = client.table('moodboards').select('id, title, status, created_at').eq('tenant_id', tid).order('created_at', desc=True).limit(limit).execute().data or []

    events = []
    for l in leads:
        name = (l.get('first_name') or '') + ' ' + (l.get('last_name') or '')
        events.append({"type": "lead", "id": l['id'], "title": name.strip() or l.get('email', ''),
                       "status": l.get('status'), "created_at": l['created_at'], "tone": "blue"})
    for p in projects:
        events.append({"type": "project", "id": p['id'], "title": p.get('title'),
                       "status": p.get('status'), "created_at": p['created_at'], "tone": "purple"})
    for p in proposals:
        events.append({"type": "proposal", "id": p['id'], "title": p.get('title'),
                       "status": p.get('status'), "created_at": p['created_at'], "tone": "gold"})
    for m in moodboards:
        events.append({"type": "moodboard", "id": m['id'], "title": m.get('title'),
                       "status": m.get('status'), "created_at": m['created_at'], "tone": "emerald"})

    events.sort(key=lambda e: e['created_at'] or '', reverse=True)
    return {"data": events[:limit]}
