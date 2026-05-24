"""ITER148 · Phase 1 · Lead Intake Router.

Endpoints:
  GET  /api/relationships/intake/questions             public catalog
  POST /api/relationships/intake/closed-answers        public ingest (anon)
  GET  /api/relationships/leads/{id}/profile           auth (CRM read)
  PATCH /api/relationships/leads/{id}/closed-answers   auth (CRM write)

Nessun frontend logic — la UI consuma il catalog runtime e POST-a le
risposte. Il backend calcola behavioral tags + progression state.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request

from core.permissions import P_LEADS_READ, P_LEADS_WRITE
from core.tenant_context import require_permission
from database import db, db_available
from services.lead_intake_engine import (
    compute_signals,
    invalidate_question_cache,
    list_questions,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── PUBLIC · catalog ──────────────────────────────────────────────────
@router.get("/intake/questions")
def get_intake_questions(
    lead_type: str | None = Query(None, description="private_client | professional"),
):
    """Return the active closed-question catalog for the intake wizard.

    Public · no auth. Tenant-agnostic (the catalog is platform-wide).
    """
    if not db_available():
        raise HTTPException(503, "Database not configured")
    items = list_questions(lead_type=lead_type)
    # Strip internal fields, keep what's needed for the UI
    out = []
    for q in items:
        out.append({
            "question_key": q.get("question_key"),
            "section_key": q.get("section_key"),
            "question_type": q.get("question_type"),
            "max_selections": q.get("max_selections"),
            "is_required": bool(q.get("is_required")),
            "display_order": q.get("display_order"),
            "applies_to_lead_type": q.get("applies_to_lead_type"),
            "options": [
                {
                    "value": o.get("value"),
                    # tag_cluster, atmosphere, material, cultural_register,
                    # luxury_tier, intent_weight are computation-only —
                    # exposed for transparency but not required by UI.
                    "tag_cluster": o.get("tag_cluster") or [],
                }
                for o in (q.get("options") or [])
            ],
        })
    return {"data": out, "total": len(out)}


# ── PUBLIC · ingest closed answers ────────────────────────────────────
@router.post("/intake/closed-answers", status_code=201)
def submit_closed_answers(
    request: Request,
    body: dict = Body(...),
    tenant_slug: str = Query(..., description="Tenant slug from public URL"),
):
    """Public closed-answer ingest.

    Body shape:
      {
        "lead_type": "private_client" | "professional",
        "email": "...",                 # optional but recommended
        "first_name": "...",
        "last_name": "...",
        "locale_code": "it-IT",
        "closed_answers": { "space_typology": "residence",
                            "atmosphere_dominant": ["nordic_silence"], ... },
        "narrative_seed": "optional 1-300 chars",
        "lead_id": "...optional, for re-ingest"
      }

    Server computes:
      - behavioral_tags, atmosphere_signals, material_signals
      - cultural_register, luxury_perception_tier
      - progression_state ('lead' | 'prospect'), progression_score
    """
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()

    tenant = client.table('tenants').select('id, status')\
        .eq('slug', tenant_slug).limit(1).execute()
    if not tenant.data or tenant.data[0].get('status') != 'active':
        raise HTTPException(404, "Tenant not found")
    tenant_id = tenant.data[0]['id']

    closed_answers = body.get('closed_answers') or {}
    if not isinstance(closed_answers, dict):
        raise HTTPException(400, "closed_answers must be an object")

    lead_type = body.get('lead_type') or 'private_client'
    if lead_type not in ('private_client', 'professional'):
        raise HTTPException(400, "lead_type must be 'private_client' or 'professional'")

    narrative_seed = (body.get('narrative_seed') or '').strip() or None
    if narrative_seed and len(narrative_seed) > 300:
        narrative_seed = narrative_seed[:300]

    signals = compute_signals(closed_answers, lead_type=lead_type)
    signals_meta = signals.pop("_meta", {})

    now = _now()
    lead_id = body.get('lead_id')

    if lead_id:
        # Re-ingest path · update existing lead
        existing = (client.table('leads').select('id, tenant_id')
                    .eq('id', lead_id).limit(1).execute().data) or []
        if not existing or existing[0].get('tenant_id') != tenant_id:
            raise HTTPException(404, "Lead not found")
        updates = {
            **signals,
            "closed_answers": closed_answers,
            "narrative_seed": narrative_seed,
            "intake_completed_at": now,
            "intake_version": "v2_iter148",
            "updated_at": now,
        }
        client.table('leads').update(updates).eq('id', lead_id).execute()
        return {
            "id": lead_id,
            "updated": True,
            "progression_state": signals["progression_state"],
            "progression_score": signals["progression_score"],
            "behavioral_tags": signals["behavioral_tags"],
            "atmosphere_signals": signals["atmosphere_signals"],
            "material_signals": signals["material_signals"],
            "meta": signals_meta,
        }

    # New lead path
    email = (body.get('email') or '').strip().lower() or None
    lead_row = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "status": "new",
        "source": body.get('source') or 'intake_v2',
        "lead_type": lead_type,
        "onboarding_path": body.get('onboarding_path') or 'closed_answers_intake',
        "pipeline_stage": "lead_captured",
        "email": email,
        "first_name": body.get('first_name'),
        "last_name": body.get('last_name'),
        "locale_code": body.get('locale_code') or 'it-IT',
        "language": body.get('language') or (body.get('locale_code') or 'it-IT').split('-')[0],
        "closed_answers": closed_answers,
        "narrative_seed": narrative_seed,
        "intake_completed_at": now,
        "intake_version": "v2_iter148",
        "runtime_identity": {
            "request_host": request.headers.get('host'),
            "user_agent":   request.headers.get('user-agent'),
            "referer":      request.headers.get('referer'),
            "source":       "intake_v2",
            "tenant_slug":  tenant_slug,
        },
        "created_at": now,
        "updated_at": now,
        **signals,
    }
    # Strip None to allow DB defaults
    lead_row = {k: v for k, v in lead_row.items() if v is not None}
    client.table('leads').insert(lead_row).execute()

    return {
        "id": lead_row["id"],
        "created": True,
        "progression_state": signals["progression_state"],
        "progression_score": signals["progression_score"],
        "behavioral_tags": signals["behavioral_tags"],
        "atmosphere_signals": signals["atmosphere_signals"],
        "material_signals": signals["material_signals"],
        "cultural_register": signals.get("cultural_register"),
        "luxury_perception_tier": signals.get("luxury_perception_tier"),
        "meta": signals_meta,
    }


# ── AUTH · lead profile read ──────────────────────────────────────────
@router.get("/leads/{lead_id}/profile")
def get_lead_profile(
    lead_id: str,
    current_user: dict = Depends(require_permission(P_LEADS_READ)),
):
    """Return the full lead profile with computed signals + tags.

    This is what the AccountDetailPage™ Relationship Profile consumes.
    """
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    res = (client.table('leads').select('*')
           .eq('id', lead_id)
           .eq('tenant_id', current_user['tenant_id']).limit(1).execute())
    if not res.data:
        raise HTTPException(404, "Lead not found")
    lead = res.data[0]
    return {
        "id": lead["id"],
        "lead_type": lead.get("lead_type"),
        "pipeline_stage": lead.get("pipeline_stage"),
        "progression_state": lead.get("progression_state") or "lead",
        "progression_score": float(lead.get("progression_score") or 0.0),
        "first_name": lead.get("first_name"),
        "last_name": lead.get("last_name"),
        "email": lead.get("email"),
        "locale_code": lead.get("locale_code"),
        "closed_answers": lead.get("closed_answers") or {},
        "behavioral_tags": lead.get("behavioral_tags") or [],
        "ai_tags": lead.get("ai_tags") or [],
        "atmosphere_signals": lead.get("atmosphere_signals") or [],
        "material_signals": lead.get("material_signals") or [],
        "cultural_register": lead.get("cultural_register"),
        "luxury_perception_tier": lead.get("luxury_perception_tier"),
        "narrative_seed": lead.get("narrative_seed"),
        "intake_completed_at": lead.get("intake_completed_at"),
        "intake_version": lead.get("intake_version"),
        "created_at": lead.get("created_at"),
        "updated_at": lead.get("updated_at"),
    }


# ── AUTH · lead re-ingest closed-answers ──────────────────────────────
@router.patch("/leads/{lead_id}/closed-answers")
def patch_lead_closed_answers(
    lead_id: str,
    body: dict = Body(...),
    current_user: dict = Depends(require_permission(P_LEADS_WRITE)),
):
    """Re-ingest closed-answers from inside the CRM (designer-driven)."""
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    existing = (client.table('leads').select('id, lead_type, closed_answers')
                .eq('id', lead_id).eq('tenant_id', current_user['tenant_id'])
                .limit(1).execute().data) or []
    if not existing:
        raise HTTPException(404, "Lead not found")
    closed_answers = body.get('closed_answers')
    if not isinstance(closed_answers, dict):
        raise HTTPException(400, "closed_answers must be an object")
    lead_type = existing[0].get('lead_type') or 'private_client'
    signals = compute_signals(closed_answers, lead_type=lead_type)
    signals.pop("_meta", None)
    now = _now()
    narrative_seed = body.get('narrative_seed')
    if narrative_seed is not None:
        narrative_seed = (str(narrative_seed) or '').strip()[:300] or None
    updates = {
        **signals,
        "closed_answers": closed_answers,
        "intake_completed_at": now,
        "intake_version": "v2_iter148",
        "updated_at": now,
    }
    if narrative_seed is not None:
        updates["narrative_seed"] = narrative_seed
    client.table('leads').update(updates).eq('id', lead_id).execute()
    return {
        "id": lead_id,
        "progression_state": signals["progression_state"],
        "progression_score": signals["progression_score"],
        "behavioral_tags": signals["behavioral_tags"],
        "atmosphere_signals": signals["atmosphere_signals"],
        "material_signals": signals["material_signals"],
        "cultural_register": signals.get("cultural_register"),
        "luxury_perception_tier": signals.get("luxury_perception_tier"),
    }


# ── INTERNAL · cache invalidation hook (root admin) ───────────────────
@router.post("/intake/cache/invalidate")
def invalidate_cache():
    invalidate_question_cache()
    return {"invalidated": True}
