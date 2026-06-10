"""Leads CRUD — aligned with Supabase 'leads' table schema."""
import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query, Body, Request
from fastapi.responses import JSONResponse
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


# ─────────────────────────────────────────────────────────────────────────────
# ITER185 · Phase 1 · FAST LEAD CAPTURE™
#
# Goal: <30s save in showroom. 3-4 mandatory fields:
#   - name (required, free text)
#   - email OR phone (at least one required)
#   - source (mandatory, enum-validated)
#   - source_detail (mandatory if source='other')
#
# Side effects (atomic):
#   1. INSERT leads(status='new', source=<enum>)
#   2. INSERT discovery_interviews(status='pending', lead_id=L, source=<lead.source>)
#   3. INSERT funnel_events(stage='lead_captured', event='fast_capture.created')
#
# Idempotency: dedup-check on email/phone returns 409 with existing_lead_id.
# Frontend can show "open existing" warning.
# ─────────────────────────────────────────────────────────────────────────────
LOCKED_SOURCE_ENUM = (
    'showroom', 'phone', 'email', 'website',
    'referral', 'architect', 'event', 'import', 'other',
)


@router.post("/fast-capture", status_code=201)
def fast_capture(
    body: dict = Body(...),
    current_user: dict = Depends(require_permission(P_LEADS_WRITE)),
):
    """ITER185.P1 · Fast Lead Capture™ — 4-field minimal intake.

    Body:
      {
        "name": "Marco Rossi",          # required
        "phone": "+39333012345",         # required if email empty
        "email": "marco@email.it",       # required if phone empty
        "source": "showroom",            # required, LOCKED_SOURCE_ENUM
        "source_detail": "string|null"   # required if source='other'
      }
    """
    client = db()
    tid = current_user['tenant_id']
    now = _now()

    # ── Validation ────────────────────────────────────────────────
    # FASE-1: accept first_name/last_name directly (new payload from NewRelationshipModal)
    # OR fall back to single `name` field (backward compat with old callers).
    first_name_direct = (body.get('first_name') or '').strip()
    last_name_direct  = (body.get('last_name')  or '').strip() or None

    if first_name_direct:
        first_name = first_name_direct
        last_name  = last_name_direct
        name       = f"{first_name} {last_name or ''}".strip()
    else:
        name = (body.get('name') or '').strip()
        if len(name) < 2:
            raise HTTPException(
                status_code=400,
                detail={"code": "LEAD-NAME-REQUIRED", "message": "name must be at least 2 characters (or provide first_name)."},
            )
        parts      = name.split(None, 1)
        first_name = parts[0]
        last_name  = parts[1] if len(parts) > 1 else None

    if not first_name:
        raise HTTPException(
            status_code=400,
            detail={"code": "LEAD-NAME-REQUIRED", "message": "first_name (or name) is required."},
        )

    email = (body.get('email') or '').strip().lower() or None
    phone = (body.get('phone') or '').strip() or None
    if not email and not phone:
        raise HTTPException(
            status_code=400,
            detail={"code": "LEAD-CONTACT-REQUIRED", "message": "At least one of email or phone is required."},
        )

    source = (body.get('source') or '').strip().lower()
    if source not in LOCKED_SOURCE_ENUM:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "LEAD-INVALID-SOURCE",
                "message": f"source must be one of {LOCKED_SOURCE_ENUM}",
                "allowed": list(LOCKED_SOURCE_ENUM),
            },
        )

    source_detail = (body.get('source_detail') or '').strip() or None
    if source == 'other' and (not source_detail or len(source_detail) < 3):
        raise HTTPException(
            status_code=400,
            detail={"code": "LEAD-SOURCE-DETAIL-REQUIRED", "message": "source_detail is required when source='other'."},
        )

    # ── Dedup check (non-blocking unless explicit) ────────────────
    skip_dedup = bool(body.get('skip_dedup_check'))
    if not skip_dedup:
        matches = []
        if email:
            r = client.table('leads').select('id, first_name, last_name, email, phone').eq(
                'tenant_id', tid).eq('email', email).limit(3).execute()
            matches.extend(r.data or [])
        if phone:
            r = client.table('leads').select('id, first_name, last_name, email, phone').eq(
                'tenant_id', tid).eq('phone', phone).limit(3).execute()
            matches.extend(r.data or [])
        if matches:
            return JSONResponse(
                status_code=409,
                content={
                    "code": "LEAD-DEDUP-MATCH",
                    "message": "Possible duplicate lead found.",
                    "matches": matches,
                    "hint": "Re-submit with skip_dedup_check=true to create anyway.",
                },
            )

    # ── INSERT lead ───────────────────────────────────────────────
    lead_id = str(uuid.uuid4())
    lead_row = {
        'id': lead_id,
        'tenant_id': tid,
        'status': 'new',
        'first_name': first_name,
        'last_name': last_name,
        'email': email,
        'phone': phone,
        'source': source,
        'lead_type': 'private_client',
        'metadata_json': {
            'fast_capture': True,
            'source_detail': source_detail,
            'captured_by': current_user.get('user_id') or current_user.get('id'),
        },
        'created_at': now,
        'updated_at': now,
    }
    client.table('leads').insert(lead_row).execute()

    # ── INSERT discovery_interviews (pending) ─────────────────────
    discovery_id = str(uuid.uuid4())
    discovery_row = {
        'id': discovery_id,
        'tenant_id': tid,
        'lead_id': lead_id,
        'status': 'pending',
        'source': source if source in ('showroom', 'phone', 'email', 'referral') else 'manual',
        'conducted_by': current_user.get('user_id') or current_user.get('id'),
        'qualification_signals': {},
        'metadata_json': {'entry_path': 'fast_capture'},
        'created_at': now,
        'updated_at': now,
    }
    try:
        client.table('discovery_interviews').insert(discovery_row).execute()
    except Exception:
        logger.exception("fast_capture: discovery_interviews insert failed (non-blocking)")

    # ── INSERT funnel_event (audit) ───────────────────────────────
    try:
        client.table('funnel_events').insert({
            'id': str(uuid.uuid4()),
            'tenant_id': tid,
            'lead_id': lead_id,
            'stage': 'lead_captured',
            'event_name': 'fast_capture.created',
            'metadata_json': {'source': source, 'discovery_id': discovery_id},
            'created_at': now,
        }).execute()
    except Exception:
        logger.exception("fast_capture: funnel_events insert failed (non-blocking)")

    return {
        'lead': lead_row,
        'discovery': discovery_row,
    }


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


# ── DEDUP CHECK (ITER177.B · CRM Phase 1) ─────────────────────────────────────
@router.post("/dedup-check")
def dedup_check(
    body: dict = Body(...),
    current_user: dict = Depends(require_permission(P_LEADS_READ)),
):
    """Find potential duplicates across leads/accounts/contacts.

    Body: {email?, phone?, first_name?, last_name?}
    Returns: {matches: [{type, id, score, reasons, display}]}
    """
    client = db()
    tid = current_user['tenant_id']
    email = (body.get('email') or '').strip().lower() or None
    phone = (body.get('phone') or '').strip() or None
    first_name = (body.get('first_name') or '').strip().lower() or None

    matches = []

    if email:
        # Leads by email exact
        rl = client.table('leads').select('id, first_name, last_name, email, phone, status') \
            .eq('tenant_id', tid).eq('email', email).limit(5).execute()
        for r in (rl.data or []):
            matches.append({
                "type": "lead",
                "id": r["id"],
                "score": 1.0,
                "reasons": ["email_exact"],
                "display": f"{r.get('first_name') or ''} {r.get('last_name') or ''}".strip() or r.get('email'),
                "status": r.get("status"),
            })
        # Accounts by email exact
        ra = client.table('accounts').select('id, account_name, email, phone, lifecycle_stage') \
            .eq('tenant_id', tid).eq('email', email).limit(5).execute()
        for r in (ra.data or []):
            matches.append({
                "type": "account",
                "id": r["id"],
                "score": 1.0,
                "reasons": ["email_exact"],
                "display": r.get("account_name") or r.get("email"),
                "lifecycle_stage": r.get("lifecycle_stage"),
            })

    if phone and len(phone) >= 6:
        # Normalize: keep digits only for fuzzy match
        digits = ''.join(c for c in phone if c.isdigit())
        if digits:
            rl = client.table('leads').select('id, first_name, last_name, email, phone, status') \
                .eq('tenant_id', tid).ilike('phone', f'%{digits[-8:]}%').limit(5).execute()
            for r in (rl.data or []):
                if any(m["id"] == r["id"] and m["type"] == "lead" for m in matches):
                    continue
                matches.append({
                    "type": "lead",
                    "id": r["id"],
                    "score": 0.85,
                    "reasons": ["phone_fuzzy"],
                    "display": f"{r.get('first_name') or ''} {r.get('last_name') or ''}".strip() or r.get('phone'),
                    "status": r.get("status"),
                })

    if first_name and len(first_name) >= 3 and not matches:
        # Fallback: fuzzy first_name match on leads (low score)
        rl = client.table('leads').select('id, first_name, last_name, email, status') \
            .eq('tenant_id', tid).ilike('first_name', f'{first_name}%').limit(3).execute()
        for r in (rl.data or []):
            matches.append({
                "type": "lead",
                "id": r["id"],
                "score": 0.5,
                "reasons": ["name_prefix"],
                "display": f"{r.get('first_name') or ''} {r.get('last_name') or ''}".strip(),
                "status": r.get("status"),
            })

    matches.sort(key=lambda m: m["score"], reverse=True)
    return {"matches": matches, "count": len(matches)}


# ── SEARCH (ITER177.B · for Cmd+K Global Search) ─────────────────────────────
@router.get("/search")
def search_leads(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, le=50),
    current_user: dict = Depends(require_permission(P_LEADS_READ)),
):
    """Lightweight search for global search palette."""
    client = db()
    tid = current_user['tenant_id']
    q_lower = q.lower().strip()
    # OR query across first_name, last_name, email
    res = client.table('leads').select('id, first_name, last_name, email, status, created_at') \
        .eq('tenant_id', tid) \
        .or_(f'first_name.ilike.%{q_lower}%,last_name.ilike.%{q_lower}%,email.ilike.%{q_lower}%') \
        .order('created_at', desc=True).limit(limit).execute()
    return {"data": res.data or [], "query": q}



# ── PUBLIC ENDPOINT (no auth) ────────────────────────────────────────────────
@router.post("/public", status_code=201)
def submit_public_lead(
    request: Request,
    body: dict = Body(...),
    tenant_slug: str = Query(..., description="Tenant slug from public URL"),
):
    """Public lead-capture endpoint (anonymous, tenant-scoped).

    ITER146.A · Lead Pipeline Orchestration™ — every submission produces:
      1. A real `leads` row with full runtime identity + onboarding metadata
      2. A `funnel_events` row at `lead_captured` stage
      3. A confirmation email to the lead (`lead_captured` template,
         ALE-localized via Editorial Runtime™)
      4. An internal `studio_lead_notification` email to the studio owner
      5. A `configuration_change_events`-style audit if pipeline_stage shifts

    Both PRIVATE (`begin_journey`) and PROFESSIONAL (`begin_partnership`)
    onboarding paths funnel here. They are distinguished by `lead_type`
    and `onboarding_path` and produce structurally different CRM entities.
    """
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    tenant = client.table('tenants').select('id, status, name')\
        .eq('slug', tenant_slug).limit(1).execute()
    if not tenant.data or tenant.data[0].get('status') != 'active':
        raise HTTPException(404, "Tenant not found")
    tenant_id = tenant.data[0]['id']
    tenant_name = tenant.data[0].get('name') or tenant_slug

    # Allowed columns whitelist (defensive — block unknown fields)
    ALLOWED = {
        'email', 'first_name', 'last_name', 'phone',
        'city', 'country', 'language', 'locale_code',
        'lead_type', 'project_type', 'budget_range',
        'style_preference', 'timeline', 'notes', 'source', 'score',
        # ITER146.A extensions
        'onboarding_path', 'professional_category', 'collaboration_intent',
        'market_sector', 'company_name', 'company_website',
        'portfolio_url', 'metadata_json',
    }
    payload = {k: v for k, v in body.items() if k in ALLOWED and v not in (None, '')}
    if payload.get('email'):
        payload['email'] = payload['email'].lower()

    # ITER146.A · capture runtime identity (subdomain, host, UA, UTM)
    resolved = getattr(request.state, 'resolved_tenant', None) or {}
    qs = dict(request.query_params)
    request_host = request.headers.get('host') or ''
    # ITER146.A fix · when the public form resolved tenant via PLATFORM_HOSTS
    # preview-fallback (e.g. content-hub-pro-22.preview.emergentagent.com →
    # 'studio'), the TenantResolverMiddleware doesn't populate resolved.{host,
    # subdomain}. We derive them from the request host so the audit trail
    # always reflects which entry surface produced the lead.
    resolved_host = resolved.get('host') or request_host or None
    resolved_subdomain = resolved.get('subdomain')
    if not resolved_subdomain and request_host:
        # First label of the host (before the first dot) — best-effort capture.
        resolved_subdomain = request_host.split(':')[0].split('.')[0] or None
    runtime_identity = {
        'resolved_subdomain': resolved_subdomain,
        'resolved_host':      resolved_host,
        'tenant_slug':        tenant_slug,
        'request_host':       request_host or None,
        'user_agent':         request.headers.get('user-agent'),
        'referer':            request.headers.get('referer'),
        'source_locale':      payload.get('locale_code'),
        'utm': {
            'source':   qs.get('utm_source'),
            'medium':   qs.get('utm_medium'),
            'campaign': qs.get('utm_campaign'),
            'term':     qs.get('utm_term'),
            'content':  qs.get('utm_content'),
        },
    }

    now = _now()
    lead = {
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'status': 'new',
        'source': payload.get('source') or 'public_form',
        'lead_type': payload.get('lead_type') or 'private_client',
        'onboarding_path': payload.get('onboarding_path') or 'contact_form',
        'pipeline_stage': 'lead_captured',
        'runtime_identity': runtime_identity,
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
            'event_name': f"{lead['onboarding_path']}.submit",
            'metadata_json': {
                'source':         lead['source'],
                'lead_type':      lead['lead_type'],
                'onboarding_path': lead['onboarding_path'],
            },
            'created_at': now,
        }).execute()
    except Exception:
        logger.exception("funnel_events insert failed")

    # ITER146.A · Email orchestration
    _dispatch_lead_emails(
        tenant_id=tenant_id,
        tenant_name=tenant_name,
        lead=lead,
    )

    # ITER179 · CRM Canon — emit explicit Discovery row for traceability.
    # Source = 'public_lead_form' to distinguish from begin-journey flow.
    try:
        client.table('discovery_interviews').insert({
            'id':                    str(uuid.uuid4()),
            'tenant_id':             tenant_id,
            'lead_id':                lead['id'],
            'status':                'pending',
            'source':                'public_lead_form',
            'qualification_signals': {
                'auto_capture': True,
                'lead_type':    lead.get('lead_type'),
                'source_path':  lead.get('onboarding_path'),
            },
            'metadata_json':         {'auto': True},
            'created_at':            now,
            'updated_at':            now,
        }).execute()
    except Exception:
        logger.exception("discovery_interviews insert (public_lead_form) failed")

    return {
        "id": lead['id'],
        "lead_type": lead['lead_type'],
        "onboarding_path": lead['onboarding_path'],
        "pipeline_stage": lead['pipeline_stage'],
        "message": "ok",
    }


# ────────────────────────────────────────────────────────────────────
# Email orchestration helpers (ITER146.A)
# ────────────────────────────────────────────────────────────────────
def _dispatch_lead_emails(*, tenant_id: str, tenant_name: str, lead: dict):
    """Fire-and-log emails — failure NEVER blocks the lead creation."""
    from services.email_service import send_template_email
    locale = lead.get('locale_code') or 'it-IT'
    first_name = lead.get('first_name') or ''
    email = lead.get('email')
    if not email:
        return

    # 1. Lead-facing confirmation
    template = ('partnership_request'
                if lead.get('lead_type') == 'professional'
                else 'lead_captured')
    try:
        send_template_email(
            to=email,
            template_key=template,
            context={
                'first_name':  first_name,
                'studio_name': tenant_name,
                'lead_type':   lead.get('lead_type'),
                'project_type': lead.get('project_type'),
                'professional_category': lead.get('professional_category'),
                'collaboration_intent':  lead.get('collaboration_intent'),
            },
            tenant_id=tenant_id,
            locale=locale,
            event_type=f"lead.{lead.get('lead_type','private_client')}.confirmation",
            metadata={'lead_id': lead['id'],
                      'onboarding_path': lead.get('onboarding_path')},
        )
    except Exception:
        logger.exception("lead confirmation email dispatch failed")

    # 2. Internal notification to the studio owner / tenant admin
    try:
        client = db()
        owners = (client.table('users_profile')
                  .select('email, first_name')
                  .eq('tenant_id', tenant_id)
                  .in_('role', ['tenant_admin', 'super_admin'])
                  .limit(3).execute().data or [])
        for o in owners:
            if not o.get('email'):
                continue
            send_template_email(
                to=o['email'],
                template_key='generic',
                context={
                    'title': f"Nuovo lead · {lead.get('lead_type','private_client')}",
                    'body':  (f"{first_name} {lead.get('last_name','')} ({email}) "
                              f"ha appena richiesto contatto attraverso "
                              f"{lead.get('onboarding_path','contact_form')}. "
                              f"Project: {lead.get('project_type','—')} · "
                              f"Locale: {locale}."),
                    'cta_url':   f"/crm/accounts?lead_id={lead['id']}",
                    'cta_label': 'Apri il lead nel CRM',
                    'studio_name': tenant_name,
                },
                tenant_id=tenant_id,
                locale=(o.get('language') or locale),
                event_type='lead.internal_notification',
                metadata={'lead_id': lead['id']},
            )
    except Exception:
        logger.exception("internal lead notification failed")
