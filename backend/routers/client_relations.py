"""ITER148 · P0 · Client Relations™ Router.

Editorial-grade relationship layer endpoints:
  GET  /api/relations/leads           atmospheric lead cards
  GET  /api/relations/prospects       active relationship layer
  GET  /api/relations/accounts        active project execution
  GET  /api/relations/stats           sidebar counts (leads/prospects/accounts)
  POST /api/relations/{id}/promote    Lead→Prospect or Prospect→Account

Filters supported on list endpoints:
  q                free text on first_name/last_name/email
  atmosphere       comma-separated atmosphere signal values
  material         comma-separated material signal values
  budget_tier      atelier|couture|pret_a_porter|exploratory
  cultural_register editorial|concierge|consultative|discovery
  limit, offset

Cinematic editorial design — NO CRM table aesthetics.
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query

from core.permissions import P_LEADS_READ, P_LEADS_WRITE
from core.tenant_context import require_permission
from database import db, db_available

router = APIRouter()
logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _filter_signals(query, key: str, csv_values: str | None):
    """Filter JSONB array column for any of the comma-separated values."""
    if not csv_values:
        return query
    vals = [v.strip() for v in csv_values.split(',') if v.strip()]
    if not vals:
        return query
    # PostgREST array overlap via `cs` is exact; use `ov` if available, fallback
    # to per-value `cs.{value}` OR chain.
    or_parts = [f'{key}.cs.["{v}"]' for v in vals]
    return query.or_(','.join(or_parts))


def _list_leads_by_state(
    state: str,
    tenant_id: str,
    q: str | None,
    atmosphere: str | None,
    material: str | None,
    budget_tier: str | None,
    cultural_register: str | None,
    limit: int,
    offset: int,
):
    client = db()
    query = (client.table('leads').select(
        'id, first_name, last_name, email, locale_code, lead_type, '
        'progression_state, progression_score, relationship_temperature, '
        'cultural_register, luxury_perception_tier, behavioral_tags, '
        'atmosphere_signals, material_signals, designer_assigned, '
        'first_journey_id, intake_completed_at, created_at, updated_at',
        count='exact'
    ).eq('tenant_id', tenant_id).eq('progression_state', state))

    if q:
        like = f"%{q.lower()}%"
        query = query.or_(
            f"first_name.ilike.{like},last_name.ilike.{like},email.ilike.{like}"
        )
    query = _filter_signals(query, "atmosphere_signals", atmosphere)
    query = _filter_signals(query, "material_signals", material)
    if budget_tier:
        query = query.eq('luxury_perception_tier', budget_tier)
    if cultural_register:
        query = query.eq('cultural_register', cultural_register)

    res = (query.order('updated_at', desc=True)
           .range(offset, offset + limit - 1).execute())
    return {"data": res.data or [], "total": res.count or 0,
            "limit": limit, "offset": offset}


# ── Stats · sidebar counts ────────────────────────────────────────────
@router.get("/stats")
def relationship_stats(
    current_user: dict = Depends(require_permission(P_LEADS_READ)),
):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    tenant_id = current_user['tenant_id']
    out = {}
    for state in ('lead', 'prospect', 'account', 'dormant'):
        r = (client.table('leads').select('id', count='exact')
             .eq('tenant_id', tenant_id)
             .eq('progression_state', state).limit(1).execute())
        out[state] = r.count or 0
    # accounts table count
    try:
        ar = (client.table('accounts').select('id', count='exact')
              .eq('tenant_id', tenant_id).limit(1).execute())
        out['account'] += ar.count or 0
    except Exception:
        logger.exception("accounts count failed")
    return out


# ── Leads · discovery layer ───────────────────────────────────────────
@router.get("/leads")
def list_leads(
    q: str | None = Query(None),
    atmosphere: str | None = Query(None),
    material: str | None = Query(None),
    budget_tier: str | None = Query(None),
    cultural_register: str | None = Query(None),
    limit: int = Query(40, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_permission(P_LEADS_READ)),
):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    return _list_leads_by_state(
        'lead', current_user['tenant_id'],
        q, atmosphere, material, budget_tier, cultural_register, limit, offset)


# ── Prospects · active relationship layer ─────────────────────────────
@router.get("/prospects")
def list_prospects(
    q: str | None = Query(None),
    atmosphere: str | None = Query(None),
    material: str | None = Query(None),
    budget_tier: str | None = Query(None),
    cultural_register: str | None = Query(None),
    limit: int = Query(40, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_permission(P_LEADS_READ)),
):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    return _list_leads_by_state(
        'prospect', current_user['tenant_id'],
        q, atmosphere, material, budget_tier, cultural_register, limit, offset)


# ── Accounts · active project execution ──────────────────────────────
@router.get("/accounts")
def list_accounts(
    q: str | None = Query(None),
    limit: int = Query(40, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_permission(P_LEADS_READ)),
):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    tenant_id = current_user['tenant_id']
    query = client.table('accounts').select(
        'id, account_name, account_type, email, language, locale_code, '
        'lifecycle_stage, relationship_journey_stage, relationship_health, '
        'relationship_score, cultural_profile, mood_dominant, '
        'luxury_perception_axis, market_id, primary_owner_id, '
        'last_activity_at, next_followup_at, created_at, updated_at',
        count='exact'
    ).eq('tenant_id', tenant_id)
    if q:
        like = f"%{q.lower()}%"
        query = query.or_(f"account_name.ilike.{like},email.ilike.{like}")
    res = (query.order('last_activity_at', desc=True)
           .range(offset, offset + limit - 1).execute())
    return {"data": res.data or [], "total": res.count or 0,
            "limit": limit, "offset": offset}


# ── Promotion · Lead → Prospect → Account ─────────────────────────────
@router.post("/leads/{lead_id}/promote")
def promote(
    lead_id: str,
    body: dict = None,
    current_user: dict = Depends(require_permission(P_LEADS_WRITE)),
):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    body = body or {}
    target = (body.get("target") or "").strip()
    if target not in ('prospect', 'account', 'dormant'):
        raise HTTPException(400, "target must be 'prospect' | 'account' | 'dormant'")
    client = db()
    res = (client.table('leads').select('id, progression_state, tenant_id')
           .eq('id', lead_id).limit(1).execute())
    if not res.data:
        raise HTTPException(404, "Lead not found")
    lead = res.data[0]
    if lead['tenant_id'] != current_user['tenant_id']:
        raise HTTPException(404, "Lead not found")
    current = lead['progression_state'] or 'lead'

    transitions = {
        ('lead', 'prospect'): True,
        ('prospect', 'account'): True,
        ('lead', 'account'): True,    # skip-step allowed but discouraged
        ('account', 'dormant'): True,
        ('prospect', 'dormant'): True,
    }
    if (current, target) not in transitions:
        raise HTTPException(400, f"Cannot transition {current} → {target}")

    now = _now()
    updates = {
        "progression_state": target,
        "updated_at": now,
    }
    if target == 'prospect':
        updates['relationship_temperature'] = max(0.5, lead.get('relationship_temperature') or 0.0)
    elif target == 'account':
        updates['relationship_temperature'] = max(0.8, lead.get('relationship_temperature') or 0.0)
    client.table('leads').update(updates).eq('id', lead_id).execute()
    return {"id": lead_id, "from": current, "to": target, "promoted_at": now}


# ── ITER148 · Sprint C · Designer Presence™ + Welcome Experience™ ────
@router.get("/designers")
def designer_roster(
    current_user: dict = Depends(require_permission(P_LEADS_READ)),
):
    """Return the studio's designer roster with presence data.

    Designers are users_profile rows with role in {designer, senior_designer,
    lead_designer, tenant_admin} for the active tenant. Presence label
    derived from metadata_json.online_status (available | away | offline).
    """
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    tenant_id = current_user['tenant_id']
    res = (client.table('users_profile').select(
        'id, first_name, last_name, role, role_label, avatar_url, '
        'short_bio, metadata_json, contact_cta_label, response_time_label'
    ).eq('tenant_id', tenant_id)
     .in_('role', ['designer', 'tenant_admin', 'super_admin'])
     .order('created_at')
     .execute())
    roster = []
    for p in (res.data or []):
        meta = p.get('metadata_json') or {}
        full = f"{p.get('first_name') or ''} {p.get('last_name') or ''}".strip() or 'Studio'
        roster.append({
            "id": p['id'],
            "name": full,
            "role_label": p.get('role_label') or (p.get('role') or 'studio').replace('_', ' ').title(),
            "avatar_url": p.get('avatar_url'),
            "short_bio": p.get('short_bio'),
            "presence": meta.get('online_status') or 'available',
            "roundrobin_slot": meta.get('roundrobin_slot'),
        })
    return {"designers": roster, "total": len(roster)}


def _select_designer_for(subject_id: str, roster: list) -> dict | None:
    """Deterministic round-robin assignment based on subject id hash.
    Until the real lead_assignments row is wired (Sprint D), we keep the
    Relations cards visually populated with a stable designer.
    """
    if not roster:
        return None
    h = sum(ord(c) for c in (subject_id or '')) % len(roster)
    return roster[h]


@router.get("/leads/{lead_id}/welcome")
def lead_welcome_experience(
    lead_id: str,
    current_user: dict = Depends(require_permission(P_LEADS_READ)),
):
    """Welcome Experience™ ceremonial payload for a Lead or Prospect.

    Returns: assigned designer (round-robin until Sprint D), atmosphere &
    register signals captured so far, suggested next moments.
    """
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    tenant_id = current_user['tenant_id']
    res = (client.table('leads').select(
        'id, first_name, last_name, email, locale_code, lead_type, '
        'progression_state, progression_score, relationship_temperature, '
        'cultural_register, luxury_perception_tier, atmosphere_signals, '
        'material_signals, behavioral_tags, designer_assigned, '
        'intake_completed_at, created_at, updated_at'
    ).eq('tenant_id', tenant_id).eq('id', lead_id).limit(1).execute())
    if not res.data:
        raise HTTPException(404, "Lead not found")
    lead = res.data[0]
    roster_resp = designer_roster(current_user=current_user)
    designer = _select_designer_for(lead['id'], roster_resp.get('designers') or [])
    # Build next-moments
    score = float(lead.get('progression_score') or 0)
    next_moments = []
    if not lead.get('intake_completed_at'):
        next_moments.append({
            "kind": "continuation_interview",
            "label": "Continue the interview",
            "sub":   "Capture register, atmosphere and tier",
        })
    if (lead.get('atmosphere_signals') or []) and score >= 0.4:
        next_moments.append({
            "kind": "moodboard_invitation",
            "label": "Share a first moodboard",
            "sub":   "Translate the atmosphere into matter",
        })
    if score >= 0.75:
        next_moments.append({
            "kind": "promote_account",
            "label": "Promote to Account",
            "sub":   "Open the Design Journey™",
        })
    if not next_moments:
        next_moments.append({
            "kind": "listen",
            "label": "Listen first",
            "sub":   "Wait for the next signal",
        })
    return {
        "lead": {
            "id": lead['id'],
            "name": f"{lead.get('first_name') or ''} {lead.get('last_name') or ''}".strip() or lead.get('email'),
            "email": lead.get('email'),
            "locale_code": lead.get('locale_code'),
            "lead_type": lead.get('lead_type'),
            "progression_state": lead.get('progression_state'),
            "progression_score": score,
            "relationship_temperature": float(lead.get('relationship_temperature') or 0),
            "cultural_register": lead.get('cultural_register'),
            "luxury_perception_tier": lead.get('luxury_perception_tier'),
            "atmosphere_signals": lead.get('atmosphere_signals') or [],
            "material_signals": lead.get('material_signals') or [],
            "behavioral_tags": lead.get('behavioral_tags') or [],
            "intake_completed_at": lead.get('intake_completed_at'),
            "created_at": lead.get('created_at'),
        },
        "designer": designer,
        "next_moments": next_moments,
    }
