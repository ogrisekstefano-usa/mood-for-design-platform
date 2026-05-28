"""
ITER161 — Admin endpoints for Studio Relations & Advisor Governance™.

This is NOT a CRM. It is the curatorial relational infrastructure of MOOD.
Mounted under /api/admin/relations + /api/admin/advisor.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import text

from database import AsyncSessionLocal
from services import studio_relations
from services.site_resolver import _fetch_block_values, LOCALE_FALLBACK, DEFAULT_LOCALE
from tenant_resolver import get_corporate_tenant
from routers._auth import require_admin_tenant


router = APIRouter(tags=["admin-relations"])


# ── Identity Verification ────────────────────────────────────────────
@router.post("/admin/relations/verify-identity")
async def verify_identity(
    body: dict = Body(...),
    _tenant: dict = Depends(require_admin_tenant),
):
    """Curatorial duplicate / network match check. Always 200."""
    return await studio_relations.verify_studio_identity(
        studio_name=body.get("studio_name"),
        legal_name=body.get("legal_name"),
        website=body.get("website"),
        contact_email=body.get("contact_email"),
        phone=body.get("phone"),
        city=body.get("city"),
        country=body.get("country"),
    )


# ── Relations CRUD ───────────────────────────────────────────────────
@router.get("/admin/relations")
async def list_relations(
    advisor_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    _tenant: dict = Depends(require_admin_tenant),
):
    return await studio_relations.list_relations(
        advisor_id=advisor_id, status=status, limit=limit,
    )


@router.post("/admin/relations")
async def create_relation(
    body: dict = Body(...),
    _tenant: dict = Depends(require_admin_tenant),
):
    return await studio_relations.create_relation_manually(
        studio_name=(body.get("studio_name") or "").strip(),
        archetype=body.get("archetype"),
        contact_email=body.get("contact_email"),
        contact_name=body.get("contact_name"),
        website=body.get("website"),
        city=body.get("city"),
        country=body.get("country"),
        owner_advisor_id=body.get("owner_advisor_id"),
    )


@router.post("/admin/relations/from-request/{request_id}")
async def open_from_request(
    request_id: str,
    body: dict = Body(default={}),
    _tenant: dict = Depends(require_admin_tenant),
):
    return await studio_relations.open_relation_from_request(
        studio_request_id=request_id,
        owner_advisor_id=body.get("owner_advisor_id"),
    )


@router.get("/admin/relations/{relation_id}")
async def get_relation(
    relation_id: str,
    _tenant: dict = Depends(require_admin_tenant),
):
    r = await studio_relations.get_relation(relation_id)
    if not r:
        raise HTTPException(status_code=404, detail="Relation not found")
    return r


@router.patch("/admin/relations/{relation_id}")
async def patch_relation(
    relation_id: str,
    body: dict = Body(...),
    _tenant: dict = Depends(require_admin_tenant),
):
    res = await studio_relations.update_relation(
        relation_id=relation_id,
        actor_id=body.pop("actor_id", None),
        patch=body,
    )
    if not res.get("ok"):
        raise HTTPException(status_code=404, detail=res.get("reason"))
    return res


# ── Visit Reports ────────────────────────────────────────────────────
@router.post("/admin/relations/{relation_id}/visits")
async def create_visit(
    relation_id: str,
    body: dict = Body(...),
    _tenant: dict = Depends(require_admin_tenant),
):
    advisor_id = body.pop("advisor_id", None)
    return await studio_relations.create_visit_report(
        relation_id=relation_id, advisor_id=advisor_id, data=body,
    )


# ── Follow-ups ───────────────────────────────────────────────────────
@router.post("/admin/relations/{relation_id}/followups")
async def create_followup(
    relation_id: str,
    body: dict = Body(...),
    _tenant: dict = Depends(require_admin_tenant),
):
    due_raw = body.get("due_at")
    try:
        due_at = datetime.fromisoformat(due_raw.replace("Z", "+00:00")) if due_raw else None
    except Exception:
        due_at = None
    if not due_at:
        raise HTTPException(status_code=400, detail="invalid_due_at")
    return await studio_relations.create_followup(
        relation_id=relation_id,
        advisor_id=body.get("advisor_id"),
        type_=body.get("type") or "call",
        due_at=due_at,
        notes=body.get("notes"),
    )


@router.patch("/admin/followups/{followup_id}/complete")
async def complete_followup(
    followup_id: str,
    body: dict = Body(default={}),
    _tenant: dict = Depends(require_admin_tenant),
):
    res = await studio_relations.complete_followup(
        followup_id=followup_id,
        advisor_id=body.get("advisor_id"),
        next_action=body.get("next_action"),
    )
    if not res.get("ok"):
        raise HTTPException(status_code=404, detail=res.get("reason"))
    return res


@router.get("/admin/advisor/followups")
async def advisor_followups(
    advisor_id: str = Query(...),
    _tenant: dict = Depends(require_admin_tenant),
):
    return await studio_relations.list_followups_for_advisor(advisor_id=advisor_id)


# ── Open Studio Ecosystem ────────────────────────────────────────────
@router.post("/admin/relations/{relation_id}/activate-ecosystem")
async def activate_ecosystem(
    relation_id: str,
    body: dict = Body(default={}),
    _tenant: dict = Depends(require_admin_tenant),
):
    res = await studio_relations.activate_studio_ecosystem(
        relation_id=relation_id,
        actor_id=body.get("actor_id"),
    )
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("reason"))
    return res


# ── Advisor Console summary (business intelligence card) ─────────────
@router.get("/admin/advisor/console-summary")
async def console_summary(
    advisor_id: Optional[str] = Query(default=None),
    _tenant: dict = Depends(require_admin_tenant),
):
    """
    Quiet, editorial business-intelligence summary.
    No KPIs labelled as sales. Everything reads as Advisory Value.
    """
    where = ""
    params: dict = {}
    if advisor_id:
        where = "WHERE owner_advisor_id = :aid"
        params["aid"] = advisor_id
    async with AsyncSessionLocal() as s:
        agg = (await s.execute(
            text(f"""
                SELECT
                    COUNT(*)                                       AS total,
                    COUNT(*) FILTER (WHERE status IN
                        ('under_review','contacted','presentation_scheduled',
                         'presented','qualified','proposal'))      AS active,
                    COUNT(*) FILTER (WHERE status = 'activated')   AS activated,
                    COUNT(*) FILTER (WHERE temperature = 'ready')  AS ready,
                    COUNT(*) FILTER (WHERE temperature = 'strong') AS strong,
                    COUNT(*) FILTER (WHERE temperature = 'warm')   AS warm,
                    COALESCE(SUM(expected_monthly_value), 0)       AS pipeline_recurring,
                    COALESCE(SUM(expected_setup_value), 0)         AS pipeline_setup
                FROM studio_relations {where}
            """),
            params,
        )).mappings().first()

        pending = (await s.execute(
            text("""
                SELECT id, studio_name, archetype, city, country,
                       contact_email, created_at, status
                  FROM studio_requests
                 WHERE status IN ('received','reviewing')
                 ORDER BY created_at DESC
                 LIMIT 12
            """),
        )).mappings().all()

    return {
        "summary": {
            "total":     int(agg["total"] or 0),
            "active":    int(agg["active"] or 0),
            "activated": int(agg["activated"] or 0),
            "ready":     int(agg["ready"] or 0),
            "strong":    int(agg["strong"] or 0),
            "warm":      int(agg["warm"] or 0),
            "pipeline_recurring": float(agg["pipeline_recurring"] or 0),
            "pipeline_setup":     float(agg["pipeline_setup"] or 0),
        },
        "pending_introductions": [
            {
                "id":            str(p["id"]),
                "studio_name":   p["studio_name"],
                "archetype":     p["archetype"],
                "city":          p["city"],
                "country":       p["country"],
                "contact_email": p["contact_email"],
                "status":        p["status"],
                "created_at":    p["created_at"].isoformat() if p["created_at"] else None,
            } for p in pending
        ],
    }


# ── Editorial copy manifest for ITER161 console ──────────────────────
@router.get("/admin/copy/manifest")
async def copy_manifest(
    namespace: str = Query(...),
    locale: str = Query(default=DEFAULT_LOCALE),
    _tenant: dict = Depends(require_admin_tenant),
):
    """
    Resolve every editorial_block under a namespace into a flat map.
    Used by the Advisor Console to render editorial copy with the same
    locale fallback chain as the public site.
    """
    tenant = await get_corporate_tenant()
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(
            text("""
                SELECT block_key FROM editorial_blocks
                 WHERE tenant_id = :tid AND namespace = :ns AND is_active = true
            """),
            {"tid": tenant["id"], "ns": namespace},
        )).mappings().all()
        full_keys = [f"{namespace}.{r['block_key']}" for r in rows]
        values = await _fetch_block_values(s, tenant["id"], full_keys, locale)
    # Strip namespace prefix so the frontend keys are short.
    prefix = namespace + "."
    out = {k[len(prefix):]: v for k, v in values.items()}
    return {"namespace": namespace, "locale": locale, "values": out}
