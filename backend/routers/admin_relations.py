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
from routers._advisor_scope import require_advisor_scope


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
    scope: dict = Depends(require_advisor_scope),
):
    # Scoped advisor (role=advisor) only sees relations they own.
    # Super admin can pass `advisor_id` filter explicitly or see all.
    if not scope["is_super_admin"]:
        advisor_id = scope["advisor_id"]
    return await studio_relations.list_relations(
        advisor_id=advisor_id, status=status, limit=limit,
    )


@router.post("/admin/relations")
async def create_relation(
    body: dict = Body(...),
    scope: dict = Depends(require_advisor_scope),
):
    # Advisor: forced ownership = self. Super admin: may pick.
    owner = body.get("owner_advisor_id")
    if not scope["is_super_admin"]:
        owner = scope["advisor_id"]
    return await studio_relations.create_relation_manually(
        studio_name=(body.get("studio_name") or "").strip(),
        archetype=body.get("archetype"),
        contact_email=body.get("contact_email"),
        contact_name=body.get("contact_name"),
        website=body.get("website"),
        city=body.get("city"),
        country=body.get("country"),
        owner_advisor_id=owner,
    )


@router.post("/admin/relations/from-request/{request_id}")
async def open_from_request(
    request_id: str,
    body: dict = Body(default={}),
    scope: dict = Depends(require_advisor_scope),
):
    # Advisor auto-claims ownership; super admin may override.
    owner = body.get("owner_advisor_id")
    if not scope["is_super_admin"]:
        owner = scope["advisor_id"]
    return await studio_relations.open_relation_from_request(
        studio_request_id=request_id,
        owner_advisor_id=owner,
    )


@router.get("/admin/relations/{relation_id}")
async def get_relation(
    relation_id: str,
    scope: dict = Depends(require_advisor_scope),
):
    r = await studio_relations.get_relation(relation_id)
    if not r:
        raise HTTPException(status_code=404, detail="Relation not found")
    # Advisor scope: only own relations.
    if not scope["is_super_admin"]:
        if (r.get("owner_advisor_id") or None) != scope["advisor_id"]:
            raise HTTPException(status_code=404, detail="Relation not found")
    return r


@router.patch("/admin/relations/{relation_id}")
async def patch_relation(
    relation_id: str,
    body: dict = Body(...),
    scope: dict = Depends(require_advisor_scope),
):
    # Advisor scope: must own the relation.
    if not scope["is_super_admin"]:
        current = await studio_relations.get_relation(relation_id)
        if not current or (current.get("owner_advisor_id") or None) != scope["advisor_id"]:
            raise HTTPException(status_code=404, detail="Relation not found")
        # Advisor cannot reassign ownership.
        body.pop("owner_advisor_id", None)
    res = await studio_relations.update_relation(
        relation_id=relation_id,
        actor_id=body.pop("actor_id", None) or scope.get("user_id"),
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
    scope: dict = Depends(require_advisor_scope),
):
    if not scope["is_super_admin"]:
        current = await studio_relations.get_relation(relation_id)
        if not current or (current.get("owner_advisor_id") or None) != scope["advisor_id"]:
            raise HTTPException(status_code=404, detail="Relation not found")
        advisor_id = scope["advisor_id"]
    else:
        advisor_id = body.pop("advisor_id", None)
    return await studio_relations.create_visit_report(
        relation_id=relation_id, advisor_id=advisor_id, data=body,
    )


# ── Follow-ups ───────────────────────────────────────────────────────
@router.post("/admin/relations/{relation_id}/followups")
async def create_followup(
    relation_id: str,
    body: dict = Body(...),
    scope: dict = Depends(require_advisor_scope),
):
    if not scope["is_super_admin"]:
        current = await studio_relations.get_relation(relation_id)
        if not current or (current.get("owner_advisor_id") or None) != scope["advisor_id"]:
            raise HTTPException(status_code=404, detail="Relation not found")
        advisor_id = scope["advisor_id"]
    else:
        advisor_id = body.get("advisor_id")
    due_raw = body.get("due_at")
    try:
        due_at = datetime.fromisoformat(due_raw.replace("Z", "+00:00")) if due_raw else None
    except Exception:
        due_at = None
    if not due_at:
        raise HTTPException(status_code=400, detail="invalid_due_at")
    return await studio_relations.create_followup(
        relation_id=relation_id,
        advisor_id=advisor_id,
        type_=body.get("type") or "call",
        due_at=due_at,
        notes=body.get("notes"),
    )


@router.patch("/admin/followups/{followup_id}/complete")
async def complete_followup(
    followup_id: str,
    body: dict = Body(default={}),
    scope: dict = Depends(require_advisor_scope),
):
    advisor_id = scope["advisor_id"] if not scope["is_super_admin"] else body.get("advisor_id")
    res = await studio_relations.complete_followup(
        followup_id=followup_id,
        advisor_id=advisor_id,
        next_action=body.get("next_action"),
    )
    if not res.get("ok"):
        raise HTTPException(status_code=404, detail=res.get("reason"))
    return res


@router.get("/admin/advisor/followups")
async def advisor_followups(
    advisor_id: Optional[str] = Query(default=None),
    scope: dict = Depends(require_advisor_scope),
):
    # Advisor: scoped to own follow-ups regardless of query param.
    if not scope["is_super_admin"]:
        advisor_id = scope["advisor_id"]
    if not advisor_id:
        raise HTTPException(status_code=400, detail="advisor_id required")
    return await studio_relations.list_followups_for_advisor(advisor_id=advisor_id)


# ── Open Studio Ecosystem ────────────────────────────────────────────
@router.post("/admin/relations/{relation_id}/activate-ecosystem")
async def activate_ecosystem(
    relation_id: str,
    body: dict = Body(default={}),
    scope: dict = Depends(require_advisor_scope),
):
    # Advisor scope: must own the relation.
    if not scope["is_super_admin"]:
        current = await studio_relations.get_relation(relation_id)
        if not current or (current.get("owner_advisor_id") or None) != scope["advisor_id"]:
            raise HTTPException(status_code=404, detail="Relation not found")
    res = await studio_relations.activate_studio_ecosystem(
        relation_id=relation_id,
        actor_id=body.get("actor_id") or scope.get("user_id"),
    )
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("reason"))
    return res


# ── Advisor Console summary (business intelligence card) ─────────────
@router.get("/admin/advisor/console-summary")
async def console_summary(
    advisor_id: Optional[str] = Query(default=None),
    scope: dict = Depends(require_advisor_scope),
):
    """
    Quiet, editorial business-intelligence summary.
    No KPIs labelled as sales. Everything reads as Advisory Value.

    Advisor scope: aggregates are always restricted to own relations,
    even if a misleading advisor_id is passed in the query.
    """
    if not scope["is_super_admin"]:
        advisor_id = scope["advisor_id"]
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

        # Pending introductions visibility rule:
        #   • super admin → all received/reviewing requests
        #   • advisor      → own (assigned_advisor_id == me) + unassigned
        pending_where = "status IN ('received','reviewing')"
        pending_params: dict = {}
        if not scope["is_super_admin"]:
            pending_where += " AND (assigned_advisor_id IS NULL OR assigned_advisor_id = :aid_p)"
            pending_params["aid_p"] = scope["advisor_id"]
        pending = (await s.execute(
            text(f"""
                SELECT id, studio_name, archetype, city, country,
                       contact_email, created_at, status, assigned_advisor_id
                  FROM studio_requests
                 WHERE {pending_where}
                 ORDER BY created_at DESC
                 LIMIT 12
            """),
            pending_params,
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
    _scope: dict = Depends(require_advisor_scope),
):
    """
    Resolve every editorial_block under a namespace into a flat map.
    Used by every workspace shell (Blueprint, Command Center, Founder
    Welcome) to render editorial copy with the same locale fallback
    chain as the public site. Accessible by any authenticated viewer.
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



# ── Command Center Overview (super-admin governance) ─────────────────
@router.get("/admin/command/overview")
async def command_overview(
    scope: dict = Depends(require_advisor_scope),
):
    """
    Aggregated read-only governance view for MOOD Super Admin.

    Returns:
      • kpi: cross-advisor counts and pipeline totals
      • advisors: list of active advisors with per-advisor mini-KPI
      • relations: latest 50 across all advisors (denormalised owner name)
      • studio_requests: latest 50 (assignment column denormalised)
      • activated_tenants: tenants whose lifecycle reached 'activated'

    Access:
      • role admin/editor → full payload (no scoping)
      • role advisor      → 403 (this is super-admin only — advisors have
                            /advisor-console for their own scoped view)
    """
    if not scope["is_super_admin"]:
        raise HTTPException(status_code=403, detail="Super admin required")

    async with AsyncSessionLocal() as s:
        # ── Cross-advisor KPI ─────────────────────────────────────────
        kpi = (await s.execute(
            text("""
                SELECT
                    COUNT(*)                                       AS total_relations,
                    COUNT(*) FILTER (WHERE status IN
                        ('under_review','contacted','presentation_scheduled',
                         'presented','qualified','proposal'))      AS active_relations,
                    COUNT(*) FILTER (WHERE status = 'activated')   AS activated_relations,
                    COUNT(*) FILTER (WHERE temperature = 'ready')  AS ready,
                    COUNT(*) FILTER (WHERE temperature = 'strong') AS strong,
                    COUNT(*) FILTER (WHERE temperature = 'warm')   AS warm,
                    COALESCE(SUM(expected_monthly_value), 0)       AS pipeline_recurring,
                    COALESCE(SUM(expected_setup_value), 0)         AS pipeline_setup
                  FROM studio_relations
            """),
        )).mappings().first()

        requests_total = (await s.execute(
            text("""
                SELECT
                    COUNT(*)                                       AS total,
                    COUNT(*) FILTER (WHERE status IN ('received','reviewing'))     AS open,
                    COUNT(*) FILTER (WHERE assigned_advisor_id IS NULL)            AS unassigned
                  FROM studio_requests
            """),
        )).mappings().first()

        tenants_total = (await s.execute(
            text("""
                SELECT COUNT(*) AS n FROM tenants
                 WHERE status = 'active' AND slug <> 'studio'
            """),
        )).scalar() or 0

        # ── Advisors (active) with per-advisor counts ────────────────
        advisors = (await s.execute(
            text("""
                SELECT
                    ap.id                AS profile_id,
                    ap.user_id           AS user_id,
                    ap.advisor_code,
                    ap.name,
                    ap.email,
                    ap.status,
                    ap.commission_percentage,
                    (SELECT COUNT(*) FROM studio_relations sr
                       WHERE sr.owner_advisor_id = ap.user_id
                         AND sr.status IN
                             ('under_review','contacted','presentation_scheduled',
                              'presented','qualified','proposal')
                    ) AS active_count,
                    (SELECT COUNT(*) FROM studio_relations sr
                       WHERE sr.owner_advisor_id = ap.user_id
                         AND sr.status = 'activated'
                    ) AS activated_count,
                    (SELECT COUNT(*) FROM studio_requests rq
                       WHERE rq.assigned_advisor_id = ap.user_id
                    ) AS requests_count
                  FROM advisor_profiles ap
                 ORDER BY ap.created_at NULLS LAST, ap.name
            """),
        )).mappings().all()

        # ── Relations (cross-advisor, latest first) ──────────────────
        relations = (await s.execute(
            text("""
                SELECT sr.id, sr.studio_name, sr.archetype, sr.city, sr.country,
                       sr.status, sr.temperature,
                       sr.owner_advisor_id, sr.expected_monthly_value,
                       sr.expected_setup_value, sr.last_activity_at, sr.created_at,
                       u.full_name AS owner_full_name,
                       u.email     AS owner_email
                  FROM studio_relations sr
                  LEFT JOIN users u ON u.id = sr.owner_advisor_id
                 ORDER BY sr.last_activity_at DESC NULLS LAST, sr.created_at DESC
                 LIMIT 50
            """),
        )).mappings().all()

        # ── Studio Requests (latest first, with assigned advisor) ────
        requests_rows = (await s.execute(
            text("""
                SELECT sq.id, sq.studio_name, sq.archetype, sq.city, sq.country,
                       sq.contact_email, sq.status, sq.assigned_advisor_id,
                       sq.created_at,
                       u.full_name AS assigned_name,
                       u.email     AS assigned_email
                  FROM studio_requests sq
                  LEFT JOIN users u ON u.id = sq.assigned_advisor_id
                 ORDER BY sq.created_at DESC
                 LIMIT 50
            """),
        )).mappings().all()

        # ── Activated Tenants ────────────────────────────────────────
        tenants_rows = (await s.execute(
            text("""
                SELECT t.id, t.slug, t.name, t.status, t.created_at
                  FROM tenants t
                 WHERE t.status = 'active' AND t.slug <> 'studio'
                 ORDER BY t.created_at DESC
                 LIMIT 50
            """),
        )).mappings().all()

    return {
        "kpi": {
            "total_relations":     int(kpi["total_relations"] or 0),
            "active_relations":    int(kpi["active_relations"] or 0),
            "activated_relations": int(kpi["activated_relations"] or 0),
            "ready":               int(kpi["ready"] or 0),
            "strong":              int(kpi["strong"] or 0),
            "warm":                int(kpi["warm"] or 0),
            "pipeline_recurring":  float(kpi["pipeline_recurring"] or 0),
            "pipeline_setup":      float(kpi["pipeline_setup"] or 0),
            "requests_total":      int(requests_total["total"] or 0),
            "requests_open":       int(requests_total["open"] or 0),
            "requests_unassigned": int(requests_total["unassigned"] or 0),
            "activated_tenants":   int(tenants_total),
            "advisors_active":     sum(1 for a in advisors if a["status"] == 'active'),
        },
        "advisors": [
            {
                "profile_id":            str(a["profile_id"]),
                "user_id":               str(a["user_id"]) if a["user_id"] else None,
                "advisor_code":          a["advisor_code"],
                "name":                  a["name"],
                "email":                 a["email"],
                "status":                a["status"],
                "commission_percentage": float(a["commission_percentage"] or 0),
                "active_count":          int(a["active_count"] or 0),
                "activated_count":       int(a["activated_count"] or 0),
                "requests_count":        int(a["requests_count"] or 0),
            } for a in advisors
        ],
        "relations": [
            {
                "id":                str(r["id"]),
                "studio_name":       r["studio_name"],
                "archetype":         r["archetype"],
                "city":              r["city"],
                "country":           r["country"],
                "status":            r["status"],
                "temperature":       r["temperature"],
                "owner_advisor_id":  str(r["owner_advisor_id"]) if r["owner_advisor_id"] else None,
                "owner_name":        r["owner_full_name"],
                "owner_email":       r["owner_email"],
                "expected_monthly":  float(r["expected_monthly_value"] or 0),
                "expected_setup":    float(r["expected_setup_value"] or 0),
                "last_activity_at":  r["last_activity_at"].isoformat() if r["last_activity_at"] else None,
                "created_at":        r["created_at"].isoformat() if r["created_at"] else None,
            } for r in relations
        ],
        "studio_requests": [
            {
                "id":                  str(q["id"]),
                "studio_name":         q["studio_name"],
                "archetype":           q["archetype"],
                "city":                q["city"],
                "country":             q["country"],
                "contact_email":       q["contact_email"],
                "status":              q["status"],
                "assigned_advisor_id": str(q["assigned_advisor_id"]) if q["assigned_advisor_id"] else None,
                "assigned_name":       q["assigned_name"],
                "assigned_email":      q["assigned_email"],
                "created_at":          q["created_at"].isoformat() if q["created_at"] else None,
            } for q in requests_rows
        ],
        "activated_tenants": [
            {
                "id":          str(t["id"]),
                "slug":        t["slug"],
                "name":        t["name"],
                "status":      t["status"],
                "created_at":  t["created_at"].isoformat() if t["created_at"] else None,
            } for t in tenants_rows
        ],
    }
