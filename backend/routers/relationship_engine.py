"""ITER148 Sprint A · Relationship Engine v2 Router.

Endpoints (mounted on `/api/relationships` in server.py):
  GET  /intake/groups?lead_type=…           public hierarchical catalog
  POST /intake/answer-event                  public · log a single choice (append-only)
  GET  /leads/{id}/answer-events             auth · per-lead event stream
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request

from core.permissions import P_LEADS_READ
from core.tenant_context import require_permission
from database import db, db_available
from services.relationship_catalog_service import (
    get_catalog,
    invalidate_catalog_cache,
    question_to_group_key,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── PUBLIC · hierarchical catalog ─────────────────────────────────────
@router.get("/intake/groups")
def get_intake_groups(
    lead_type: Optional[str] = Query(None, description="private_client | professional"),
):
    """Runtime hierarchical catalog for the cinematic intake wizard."""
    if not db_available():
        raise HTTPException(503, "Database not configured")
    return get_catalog(lead_type=lead_type)


# ── PUBLIC · ingest single answer event ──────────────────────────────
@router.post("/intake/answer-event", status_code=201)
def ingest_answer_event(
    request: Request,
    body: dict = Body(...),
    tenant_slug: str = Query(..., description="Tenant slug"),
):
    """Append a single answer choice to the event log.

    Body:
      {
        "question_key": "atmosphere_dominant_v2",
        "option_value": "warm_enveloping",     # null if raw_value supplied
        "raw_value":    null,                   # JSON for slider/ranking
        "lead_id":      "...optional",
        "session_id":   "...uuid (correlate session)",
        "source_surface": "intake_wizard" | "continuation_interview"
      }
    """
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    # Accept any tenant whose slug matches — relationship-engine answer
    # events are not status-restricted (trial/onboarding tenants must be
    # able to capture intake answers just like active ones).
    tenant = client.table('tenants').select('id, status')\
        .eq('slug', tenant_slug).limit(1).execute()
    if not tenant.data:
        raise HTTPException(404, "Tenant not found")

    q_key = body.get("question_key")
    if not q_key:
        raise HTTPException(400, "question_key required")

    group_key = question_to_group_key(q_key)
    if not group_key:
        raise HTTPException(400, f"Unknown question_key: {q_key}")

    option_value = body.get("option_value")
    raw_value = body.get("raw_value")
    if option_value is None and raw_value is None:
        raise HTTPException(400, "Either option_value or raw_value required")

    event = {
        "id":             str(uuid.uuid4()),
        "tenant_id":      tenant.data[0]["id"],
        "lead_id":        body.get("lead_id"),
        "account_id":     body.get("account_id"),
        "question_key":   q_key,
        "option_value":   option_value,
        "raw_value":      raw_value,
        "group_key":      group_key,
        "occurred_at":    _now(),
        "source_surface": body.get("source_surface") or "intake_wizard",
        "session_id":     body.get("session_id"),
        "metadata":       {
            "user_agent": request.headers.get("user-agent"),
            "tenant_slug": tenant_slug,
        },
    }
    # Strip None to allow DB defaults
    event = {k: v for k, v in event.items() if v is not None}
    client.table('relationship_answer_events').insert(event).execute()
    return {"id": event["id"], "occurred_at": event["occurred_at"]}


# ── AUTH · per-lead answer event stream ──────────────────────────────
@router.get("/leads/{lead_id}/answer-events")
def list_answer_events(
    lead_id: str,
    limit: int = Query(50, ge=1, le=500),
    current_user: dict = Depends(require_permission(P_LEADS_READ)),
):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    res = (client.table('relationship_answer_events')
           .select('*')
           .eq('tenant_id', current_user['tenant_id'])
           .eq('lead_id', lead_id)
           .order('occurred_at', desc=True)
           .limit(limit)
           .execute())
    return {"data": res.data or [], "total": len(res.data or [])}


# ── INTERNAL · cache flush ───────────────────────────────────────────
@router.post("/intake/groups/cache/invalidate")
def invalidate_groups_cache():
    invalidate_catalog_cache()
    return {"invalidated": True}
