"""
Tenant Activation pipeline — Command Center endpoints.

Aggregates studio_requests + studio_relations into a single funnel view
for super-admins and authorized advisors. CMS-driven labels via existing
admin copy manifest.

NO hardcoded copy.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text

from database import AsyncSessionLocal
from tenant_resolver import get_corporate_tenant
from services.studio_activation import _format_reference
from routers.admin_relations import require_advisor_scope

router = APIRouter(prefix="/api/admin/tenant-activation",
                   tags=["tenant-activation"])


@router.get("/pipeline")
async def pipeline(
    user=Depends(require_advisor_scope),
    status: str | None = Query(default=None),
    limit: int = Query(default=200, le=500),
):
    """
    Returns studio_requests grouped by their lifecycle stage.

    Stages:
      • new           → status='received', no assigned advisor
      • under_review  → status IN ('reviewing','contacted')
      • qualified     → status='qualified'
      • rejected      → status='not_aligned'
      • awaiting_founder → status='activated' (tenant created, magic link issued)
    """
    where = ""
    params = {"limit": limit}
    if status:
        where = "WHERE status = :st"
        params["st"] = status
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(text(f"""
            SELECT id, studio_name, contact_name, contact_email,
                   city, country, markets, archetype, locale, status,
                   assigned_advisor_id, advisor_notes,
                   created_at, reviewed_at, updated_at,
                   attribution_advisor_id
              FROM studio_requests
              {where}
             ORDER BY created_at DESC LIMIT :limit
        """), params)).mappings().all()

    buckets = {
        "new":               [],
        "under_review":      [],
        "qualified":         [],
        "rejected":          [],
        "awaiting_founder":  [],
    }
    for r in rows:
        item = {
            "id":             str(r['id']),
            "reference":      _format_reference(str(r['id'])),
            "studio_name":    r['studio_name'],
            "contact_name":   r['contact_name'],
            "contact_email":  r['contact_email'],
            "city":           r['city'],
            "country":        r['country'],
            "markets":        list(r['markets'] or []),
            "archetype":      r['archetype'],
            "locale":         r['locale'],
            "status":         r['status'],
            "assigned_advisor_id": str(r['assigned_advisor_id']) if r['assigned_advisor_id'] else None,
            "attribution_advisor_id": str(r['attribution_advisor_id']) if r['attribution_advisor_id'] else None,
            "advisor_notes":  r['advisor_notes'],
            "created_at":     r['created_at'].isoformat() if r['created_at'] else None,
            "reviewed_at":    r['reviewed_at'].isoformat() if r['reviewed_at'] else None,
        }
        st = r['status']
        if st == 'received':
            buckets['new'].append(item)
        elif st in ('reviewing', 'contacted'):
            buckets['under_review'].append(item)
        elif st == 'qualified':
            buckets['qualified'].append(item)
        elif st == 'not_aligned':
            buckets['rejected'].append(item)
        elif st == 'activated':
            buckets['awaiting_founder'].append(item)

    return {
        "buckets": buckets,
        "counts": {k: len(v) for k, v in buckets.items()},
        "total": sum(len(v) for v in buckets.values()),
    }


@router.get("/emails")
async def email_log(
    user=Depends(require_advisor_scope),
    request_id: str | None = Query(default=None),
    template: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
):
    """Audit log of transactional emails."""
    where_parts = []
    params = {"limit": limit}
    if request_id:
        where_parts.append("variables->>'request_id' = :rid")
        params["rid"] = request_id
    if template:
        where_parts.append("template_key = :tk")
        params["tk"] = template
    where = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(text(f"""
            SELECT id, template_key, to_email, locale, subject, status,
                   error, retry_count, external_id, created_at,
                   variables->>'reference' AS reference,
                   variables->>'request_id' AS request_id
              FROM studio_email_dispatch_log
              {where}
             ORDER BY created_at DESC LIMIT :limit
        """), params)).mappings().all()
    return {
        "items": [
            {
                "id":           str(r['id']),
                "template_key": r['template_key'],
                "to_email":     r['to_email'],
                "locale":       r['locale'],
                "subject":      r['subject'],
                "status":       r['status'],
                "error":        r['error'],
                "retry_count":  r['retry_count'],
                "external_id":  r['external_id'],
                "reference":    r['reference'],
                "request_id":   r['request_id'],
                "created_at":   r['created_at'].isoformat() if r['created_at'] else None,
            } for r in rows
        ],
        "total": len(rows),
    }


@router.post("/retry-failed")
async def retry_failed(user=Depends(require_advisor_scope), limit: int = 25):
    """Retry the oldest failed emails. Idempotent."""
    from services import email_dispatcher
    n = await email_dispatcher.retry_failed(limit=limit)
    return {"retried": n}
