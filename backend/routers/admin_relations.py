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


# ── Tenant Manifest (read-only) ──────────────────────────────────────
@router.get("/admin/tenants/{slug}/manifest")
async def tenant_manifest(
    slug: str,
    _tenant: dict = Depends(require_admin_tenant),
):
    """
    Returns the complete Tenant Manifest™ — the canonical, B2B-only
    record of a studio inside MOOD's ecosystem. Used by the Founder
    First Access screen and the Advisor Console's tenant detail.
    """
    async with AsyncSessionLocal() as s:
        t = (await s.execute(
            text("""
                SELECT id, slug, name, status, active_plan, subscription_status,
                       default_language, default_locale_code, active_languages,
                       enabled_modules, branding_settings, theme_settings,
                       plan_assigned_at, plan_assigned_by, created_at
                  FROM tenants
                 WHERE slug = :slug
                 LIMIT 1
            """),
            {"slug": slug},
        )).mappings().first()
        if not t:
            raise HTTPException(status_code=404, detail="tenant_not_found")

        modules = [dict(r) for r in (await s.execute(
            text("""
                SELECT module_key, state, activated_at
                  FROM tenant_modules
                 WHERE tenant_id = :tid
                 ORDER BY activated_at
            """),
            {"tid": str(t['id'])},
        )).mappings().all()]

        founder = (await s.execute(
            text("""
                SELECT id, email, full_name, last_login_at, created_at
                  FROM users
                 WHERE tenant_id = :tid AND role = 'owner' AND is_active = TRUE
                 ORDER BY created_at
                 LIMIT 1
            """),
            {"tid": str(t['id'])},
        )).mappings().first()

        advisor = None
        if t['plan_assigned_by']:
            adv = (await s.execute(
                text("""
                    SELECT id, email, full_name
                      FROM users
                     WHERE id = :id
                     LIMIT 1
                """),
                {"id": str(t['plan_assigned_by'])},
            )).mappings().first()
            if adv:
                advisor = {"id": str(adv['id']), "email": adv['email'],
                           "full_name": adv['full_name']}

        relation = (await s.execute(
            text("""
                SELECT id, studio_name, archetype, city, country,
                       contact_email, contact_name, website
                  FROM studio_relations
                 WHERE tenant_id = :tid
                 ORDER BY created_at DESC
                 LIMIT 1
            """),
            {"tid": str(t['id'])},
        )).mappings().first()

    branding = t['branding_settings'] or {}
    return {
        "tenant": {
            "id":       str(t['id']),
            "slug":     t['slug'],
            "name":     t['name'],
            "status":   t['status'],
            "plan":     t['active_plan'],
            "subscription_status": t['subscription_status'],
            "created_at": t['created_at'].isoformat() if t['created_at'] else None,
        },
        "identity": {
            "monogram":  branding.get('monogram'),
            "archetype": branding.get('archetype') or (relation['archetype'] if relation else None),
            "country":   branding.get('country')   or (relation['country']   if relation else None),
            "city":      branding.get('city')      or (relation['city']      if relation else None),
            "website":   branding.get('website')   or (relation['website']   if relation else None),
        },
        "language": {
            "default":  t['default_language'],
            "locale":   t['default_locale_code'],
            "active":   list(t['active_languages'] or []),
            "timezone": "Europe/Rome" if (t['default_language'] or 'it') == 'it' else "Europe/London",
        },
        "modules": modules,
        "founder": ({
            "id":           str(founder['id']),
            "email":        founder['email'],
            "full_name":    founder['full_name'],
            "last_login_at": founder['last_login_at'].isoformat() if founder['last_login_at'] else None,
            "first_access_completed": founder['last_login_at'] is not None,
        } if founder else None),
        "advisor": advisor,
    }


# ── Founder First Access — has it been completed? ────────────────────
@router.get("/founder/first-access-state")
async def founder_first_access_state(
    _tenant: dict = Depends(require_admin_tenant),
):
    """
    The Founder Welcome page asks this on mount to decide whether to
    play the cinematic 'Il tuo ecosistema è pronto' moment or skip
    directly to the workspace. Idempotent.
    """
    tenant = _tenant
    async with AsyncSessionLocal() as s:
        f = (await s.execute(
            text("""
                SELECT u.id, u.last_login_at, u.created_at,
                       (SELECT COUNT(*) FROM access_magic_links
                          WHERE user_id = u.id AND consumed_at IS NOT NULL
                       ) AS consumed_count
                  FROM users u
                 WHERE u.tenant_id = :tid AND u.role = 'owner' AND u.is_active = TRUE
                 ORDER BY u.created_at
                 LIMIT 1
            """),
            {"tid": tenant['id']},
        )).mappings().first()
    if not f:
        return {"is_founder": False, "first_access": False}
    # First-access = the founder has consumed at most ONE magic link
    # (the activation one). After the second login, the welcome moment
    # is permanently behind them.
    return {
        "is_founder": True,
        "first_access": (f['consumed_count'] or 0) <= 1,
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
