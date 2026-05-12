import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from models.analytics import AnalyticsEvent
from middleware.auth import get_current_user
from database import get_db, db_available

router = APIRouter()


@router.post("/events", status_code=201)
def track_event(body: AnalyticsEvent, current_user: dict = Depends(get_current_user)):
    if not db_available():
        return {"message": "Event tracked (no DB)"}
    db = get_db()
    db.table('analytics_events').insert({
        'id': str(uuid.uuid4()),
        'tenant_id': current_user['tenant_id'],
        'user_id': current_user['sub'],
        'event_type': body.event_type,
        'session_id': body.session_id,
        'properties': body.properties or {},
        'url': body.url,
        'referrer': body.referrer,
        'created_at': datetime.now(timezone.utc).isoformat(),
    }).execute()
    return {"message": "Event tracked"}


@router.post("/events/public", status_code=201)
def track_public_event(body: AnalyticsEvent, tenant_id: str = Query(None)):
    """Track events from public pages (no auth)."""
    if not db_available():
        return {"message": "Event tracked (no DB)"}
    db = get_db()
    db.table('analytics_events').insert({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'event_type': body.event_type,
        'session_id': body.session_id,
        'properties': body.properties or {},
        'url': body.url,
        'referrer': body.referrer,
        'created_at': datetime.now(timezone.utc).isoformat(),
    }).execute()
    return {"message": "Event tracked"}


@router.get("/dashboard")
def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    if not db_available():
        return {
            "leads": {"total": 0, "new": 0, "converted": 0},
            "projects": {"total": 0, "active": 0, "completed": 0},
            "proposals": {"total": 0, "pending": 0, "approved": 0},
        }
    db = get_db()
    tid = current_user['tenant_id']

    leads = db.table('leads').select('status').eq('tenant_id', tid).execute()
    projects = db.table('projects').select('status').eq('tenant_id', tid).execute()
    proposals = db.table('proposals').select('status').eq('tenant_id', tid).execute()

    def count_by_status(items, statuses):
        return {s: sum(1 for i in items if i.get('status') == s) for s in statuses}

    return {
        "leads": {
            "total": len(leads.data),
            **count_by_status(leads.data, ['new', 'contacted', 'qualified', 'converted', 'lost'])
        },
        "projects": {
            "total": len(projects.data),
            **count_by_status(projects.data, ['discovery', 'design', 'execution', 'completed', 'on_hold'])
        },
        "proposals": {
            "total": len(proposals.data),
            **count_by_status(proposals.data, ['draft', 'sent', 'viewed', 'approved', 'revision_requested', 'rejected'])
        },
    }
