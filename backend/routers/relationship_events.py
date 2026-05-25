"""Relationship Live Engine™ · ITER150 Sprint A
=====================================================================

Real-time event layer between client portal and designer workspace.
Every meaningful client action persists a `relationship_event` row
which is rendered as editorial narrative on the designer side via
polling (5s).

Endpoints (mounted on `/api/relationship-engine` in server.py):

  CLIENT actions (role=client):
    POST /actions/briefing-completed
    POST /actions/message-sent
    POST /actions/call-requested
    POST /actions/moodboard-viewed
    POST /actions/journey-resumed

  TIMELINE / STATUS read:
    GET  /timeline             → designer view (assigned to me)
    GET  /timeline/lead/{id}   → designer view (specific lead)
    GET  /status/lead/{id}     → status-bar (both sides)
    GET  /client/me            → client's own timeline + status
    GET  /briefing-summary/lead/{id} → designer-side recap of intake answers
    GET  /call-requests/pending → designer pending call requests

All endpoints respect tenant_id and (where applicable) the
designer_id ↔ lead.designer_assigned ↔ human_assignments links.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query
from pydantic import BaseModel

from core.tenant_context import get_tenant_context
from database import db
from services.relationship_narrator import (
    narrate, EVENT_TO_STATUS, STATUS_LABELS,
)

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _profile_label(c, profile_id: Optional[str]) -> Optional[str]:
    if not profile_id:
        return None
    try:
        r = c.table("users_profile").select("first_name,last_name,email")\
            .eq("id", profile_id).limit(1).execute()
        if not r.data:
            return None
        p = r.data[0]
        n = ((p.get("first_name") or "") + " " + (p.get("last_name") or "")).strip()
        return n or (p.get("email") or "").split("@")[0]
    except Exception:  # noqa: BLE001
        return None


def _client_lead(c, tenant_id: str, profile_id: str) -> Optional[Dict[str, Any]]:
    """Return the lead row that represents the client's relationship.

    Strategy: pick the most recently updated lead linked to the same
    contact email as the client profile, scoped to this tenant.
    If none found, fall back to the lead referenced by the most recent
    project of the client.
    """
    try:
        prof = c.table("users_profile").select("email").eq("id", profile_id)\
            .limit(1).execute()
        email = (prof.data[0].get("email") if prof.data else None)
        if email:
            ld = (c.table("leads")
                  .select("id,tenant_id,designer_assigned,contact_email,name")
                  .eq("tenant_id", tenant_id)
                  .eq("contact_email", email)
                  .order("updated_at", desc=True).limit(1).execute())
            if ld.data:
                return ld.data[0]
    except Exception:  # noqa: BLE001
        pass

    # Fallback: derive from project ownership
    try:
        pr = (c.table("projects").select("id,lead_id")
              .eq("tenant_id", tenant_id).eq("client_user_id", profile_id)
              .order("updated_at", desc=True).limit(1).execute())
        if pr.data and pr.data[0].get("lead_id"):
            ld = (c.table("leads").select("id,tenant_id,designer_assigned,contact_email,name")
                  .eq("id", pr.data[0]["lead_id"]).limit(1).execute())
            if ld.data:
                return ld.data[0]
    except Exception:  # noqa: BLE001
        pass
    return None


def _resolve_designer(c, tenant_id: str, lead: Optional[Dict[str, Any]],
                      client_profile_id: Optional[str]) -> Optional[str]:
    """Return the assigned designer profile_id for this lead/client."""
    if lead and lead.get("designer_assigned"):
        return lead["designer_assigned"]
    if client_profile_id:
        try:
            r = (c.table("human_assignments").select("assignee_user_id")
                 .eq("tenant_id", tenant_id)
                 .eq("subject_type", "client")
                 .eq("subject_id", client_profile_id)
                 .eq("active", True).limit(1).execute())
            if r.data:
                return r.data[0]["assignee_user_id"]
        except Exception:  # noqa: BLE001
            pass
    return None


def _last_event_at(c, lead_id: Optional[str], event_type: str) -> Optional[datetime]:
    if not lead_id:
        return None
    try:
        r = (c.table("relationship_events").select("occurred_at")
             .eq("lead_id", lead_id).eq("event_type", event_type)
             .order("occurred_at", desc=True).limit(1).execute())
        if r.data:
            ts = r.data[0]["occurred_at"]
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:  # noqa: BLE001
        pass
    return None


def _emit_event(
    c,
    *,
    tenant_id: str,
    event_type: str,
    actor_type: str,
    actor_id: Optional[str] = None,
    actor_label: Optional[str] = None,
    lead_id: Optional[str] = None,
    account_id: Optional[str] = None,
    client_profile_id: Optional[str] = None,
    designer_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    visibility: str = "both",
    locale: str = "it",
) -> Dict[str, Any]:
    """Persist a relationship event + return the resulting row.

    Side-effects: bumps `relationship_status` according to `EVENT_TO_STATUS`.
    """
    prev_at = _last_event_at(c, lead_id, event_type)
    narrative = narrate(
        event_type, actor_label,
        payload=payload, locale=locale, previous_event_at=prev_at,
    )
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "lead_id": lead_id,
        "account_id": account_id,
        "client_profile_id": client_profile_id,
        "designer_id": designer_id,
        "event_type": event_type,
        "actor_type": actor_type,
        "actor_id": actor_id,
        "actor_label": actor_label,
        "narrative": narrative,
        "payload": payload or {},
        "visibility": visibility,
        "occurred_at": _now_iso(),
    }
    row = {k: v for k, v in row.items() if v is not None}
    c.table("relationship_events").insert(row).execute()

    # Bump status if mapping says so
    new_status = EVENT_TO_STATUS.get(event_type)
    if new_status and lead_id:
        labels = STATUS_LABELS.get(new_status, {})
        status_row = {
            "tenant_id": tenant_id,
            "lead_id": lead_id,
            "status_key": new_status,
            "status_label_it": labels.get("it"),
            "status_label_en": labels.get("en"),
            "last_event_id": row["id"],
            "last_event_at": row["occurred_at"],
            "updated_by": actor_id,
            "updated_at": row["occurred_at"],
        }
        try:
            # upsert by lead_id
            c.table("relationship_status").upsert(
                status_row, on_conflict="lead_id").execute()
        except Exception:  # noqa: BLE001
            pass

    return row


# ─────────────────────────────────────────────────────────────────────
# CLIENT actions — fire events from client portal CTAs
# ─────────────────────────────────────────────────────────────────────
def _require_client(ctx: dict) -> str:
    role = (ctx.get("role") or "").lower()
    if role not in {"client", "tenant_admin", "super_admin"}:
        raise HTTPException(403, "Client surface only.")
    pid = ctx.get("profile_id")
    if not pid:
        raise HTTPException(401, "Missing profile context.")
    return pid


class _BriefingBody(BaseModel):
    summary: Optional[Dict[str, Any]] = None  # atmosphere, materials, budget…
    locale: Optional[str] = "it"


@router.post("/actions/briefing-completed", status_code=201)
def action_briefing_completed(
    body: _BriefingBody = Body(default_factory=_BriefingBody),
    ctx: dict = Depends(get_tenant_context),
):
    profile_id = _require_client(ctx)
    c = db()
    label = _profile_label(c, profile_id)
    lead = _client_lead(c, ctx["tenant_id"], profile_id)
    designer_id = _resolve_designer(c, ctx["tenant_id"], lead, profile_id)
    row = _emit_event(
        c,
        tenant_id=ctx["tenant_id"],
        event_type="briefing_completed",
        actor_type="client",
        actor_id=profile_id, actor_label=label,
        lead_id=(lead or {}).get("id"),
        client_profile_id=profile_id,
        designer_id=designer_id,
        payload={"summary": body.summary or {}},
        locale=body.locale or "it",
    )
    return {"event": row}


class _MessageBody(BaseModel):
    content: str
    thread_id: Optional[str] = None
    locale: Optional[str] = "it"


@router.post("/actions/message-sent", status_code=201)
def action_message_sent(
    body: _MessageBody,
    ctx: dict = Depends(get_tenant_context),
):
    profile_id = _require_client(ctx)
    if not (body.content or "").strip():
        raise HTTPException(400, "content required")
    c = db()
    label = _profile_label(c, profile_id)
    lead = _client_lead(c, ctx["tenant_id"], profile_id)
    designer_id = _resolve_designer(c, ctx["tenant_id"], lead, profile_id)
    row = _emit_event(
        c,
        tenant_id=ctx["tenant_id"],
        event_type="message_sent",
        actor_type="client",
        actor_id=profile_id, actor_label=label,
        lead_id=(lead or {}).get("id"),
        client_profile_id=profile_id,
        designer_id=designer_id,
        payload={
            "preview": body.content[:160],
            "length": len(body.content),
            "thread_id": body.thread_id,
        },
        locale=body.locale or "it",
    )
    return {"event": row}


class _CallBody(BaseModel):
    preferred_slots: Optional[List[Dict[str, Any]]] = None
    timezone: Optional[str] = None
    note: Optional[str] = None
    locale: Optional[str] = "it"


@router.post("/actions/call-requested", status_code=201)
def action_call_requested(
    body: _CallBody = Body(default_factory=_CallBody),
    ctx: dict = Depends(get_tenant_context),
):
    profile_id = _require_client(ctx)
    c = db()
    label = _profile_label(c, profile_id)
    lead = _client_lead(c, ctx["tenant_id"], profile_id)
    designer_id = _resolve_designer(c, ctx["tenant_id"], lead, profile_id)

    # Persist the call request itself
    req_id = str(uuid.uuid4())
    c.table("call_requests").insert({
        "id": req_id,
        "tenant_id": ctx["tenant_id"],
        "lead_id": (lead or {}).get("id"),
        "client_profile_id": profile_id,
        "designer_id": designer_id,
        "status": "pending",
        "preferred_slots": body.preferred_slots or [],
        "timezone": body.timezone,
        "client_note": body.note,
    }).execute()

    row = _emit_event(
        c,
        tenant_id=ctx["tenant_id"],
        event_type="call_requested",
        actor_type="client",
        actor_id=profile_id, actor_label=label,
        lead_id=(lead or {}).get("id"),
        client_profile_id=profile_id,
        designer_id=designer_id,
        payload={
            "call_request_id": req_id,
            "preferred_slots": body.preferred_slots or [],
            "timezone": body.timezone,
            "note": body.note,
        },
        locale=body.locale or "it",
    )
    return {"event": row, "call_request_id": req_id}


class _MoodboardBody(BaseModel):
    moodboard_id: Optional[str] = None
    locale: Optional[str] = "it"


@router.post("/actions/moodboard-viewed", status_code=201)
def action_moodboard_viewed(
    body: _MoodboardBody = Body(default_factory=_MoodboardBody),
    ctx: dict = Depends(get_tenant_context),
):
    profile_id = _require_client(ctx)
    c = db()
    label = _profile_label(c, profile_id)
    lead = _client_lead(c, ctx["tenant_id"], profile_id)
    designer_id = _resolve_designer(c, ctx["tenant_id"], lead, profile_id)
    row = _emit_event(
        c,
        tenant_id=ctx["tenant_id"],
        event_type="moodboard_viewed",
        actor_type="client",
        actor_id=profile_id, actor_label=label,
        lead_id=(lead or {}).get("id"),
        client_profile_id=profile_id,
        designer_id=designer_id,
        payload={"moodboard_id": body.moodboard_id},
        locale=body.locale or "it",
    )
    return {"event": row}


class _ResumeBody(BaseModel):
    locale: Optional[str] = "it"


@router.post("/actions/journey-resumed", status_code=201)
def action_journey_resumed(
    body: _ResumeBody = Body(default_factory=_ResumeBody),
    ctx: dict = Depends(get_tenant_context),
):
    profile_id = _require_client(ctx)
    c = db()
    label = _profile_label(c, profile_id)
    lead = _client_lead(c, ctx["tenant_id"], profile_id)
    designer_id = _resolve_designer(c, ctx["tenant_id"], lead, profile_id)
    row = _emit_event(
        c,
        tenant_id=ctx["tenant_id"],
        event_type="journey_resumed",
        actor_type="client",
        actor_id=profile_id, actor_label=label,
        lead_id=(lead or {}).get("id"),
        client_profile_id=profile_id,
        designer_id=designer_id,
        locale=body.locale or "it",
    )
    return {"event": row}


# ─────────────────────────────────────────────────────────────────────
# DESIGNER timeline · polling endpoint (5s loop)
# ─────────────────────────────────────────────────────────────────────
def _require_studio(ctx: dict):
    """Studio-side users only (designer, tenant_admin, super_admin)."""
    role = (ctx.get("role") or "").lower()
    if role not in {"designer", "creative_director", "interior_designer",
                    "studio_member", "tenant_admin", "super_admin"}:
        raise HTTPException(403, "Studio workspace only.")
    if not ctx.get("profile_id"):
        raise HTTPException(401, "Missing profile context.")


@router.get("/timeline")
def designer_timeline(
    since: Optional[str] = Query(None, description="ISO timestamp; returns events newer than this"),
    limit: int = Query(60, ge=1, le=200),
    ctx: dict = Depends(get_tenant_context),
):
    """Live timeline of all events visible to the current designer.

    For role=designer: events where designer_id == me.
    For role=tenant_admin/super_admin: all events in tenant.
    """
    _require_studio(ctx)
    c = db()
    role = (ctx.get("role") or "").lower()
    q = (c.table("relationship_events")
         .select("*")
         .eq("tenant_id", ctx["tenant_id"])
         .in_("visibility", ["designer", "both", "studio"])
         .order("occurred_at", desc=True)
         .limit(limit))
    if role in {"designer", "creative_director", "interior_designer", "studio_member"}:
        q = q.eq("designer_id", ctx["profile_id"])
    if since:
        q = q.gt("occurred_at", since)
    res = q.execute()
    return {"data": res.data or [], "polled_at": _now_iso()}


@router.get("/timeline/lead/{lead_id}")
def lead_timeline(
    lead_id: str = Path(...),
    limit: int = Query(80, ge=1, le=300),
    ctx: dict = Depends(get_tenant_context),
):
    _require_studio(ctx)
    c = db()
    res = (c.table("relationship_events").select("*")
           .eq("tenant_id", ctx["tenant_id"])
           .eq("lead_id", lead_id)
           .in_("visibility", ["designer", "both", "studio"])
           .order("occurred_at", desc=True).limit(limit).execute())
    return {"data": res.data or [], "polled_at": _now_iso()}


@router.get("/status/lead/{lead_id}")
def lead_status(
    lead_id: str = Path(...),
    ctx: dict = Depends(get_tenant_context),
):
    """Status-bar pointer for a lead. Returns null if never seeded."""
    c = db()
    r = (c.table("relationship_status").select("*")
         .eq("tenant_id", ctx["tenant_id"])
         .eq("lead_id", lead_id).limit(1).execute())
    if not r.data:
        # Default: awaiting_brief
        labels = STATUS_LABELS["awaiting_brief"]
        return {
            "status_key": "awaiting_brief",
            "status_label_it": labels["it"],
            "status_label_en": labels["en"],
            "last_event_at": None,
        }
    return r.data[0]


@router.get("/client/me")
def client_live_view(ctx: dict = Depends(get_tenant_context)):
    """Client's own timeline + status snapshot."""
    profile_id = _require_client(ctx)
    c = db()
    lead = _client_lead(c, ctx["tenant_id"], profile_id)
    lead_id = (lead or {}).get("id")

    # Prefer lead-scoped events; otherwise fall back to client_profile_id
    # so the client always sees their own gestures even before a lead is
    # formally linked to their account.
    q = (c.table("relationship_events").select("*")
         .eq("tenant_id", ctx["tenant_id"])
         .in_("visibility", ["client", "both"])
         .order("occurred_at", desc=True).limit(40))
    if lead_id:
        q = q.eq("lead_id", lead_id)
    else:
        q = q.eq("client_profile_id", profile_id)
    events = (q.execute().data or [])

    status = None
    if lead_id:
        s = (c.table("relationship_status").select("*")
             .eq("tenant_id", ctx["tenant_id"])
             .eq("lead_id", lead_id).limit(1).execute())
        if s.data:
            status = s.data[0]
    if not status:
        # Derive a soft default from the latest event type if any
        derived = "awaiting_brief"
        if events:
            from services.relationship_narrator import EVENT_TO_STATUS
            for ev in events:
                mapped = EVENT_TO_STATUS.get(ev["event_type"])
                if mapped:
                    derived = mapped
                    break
        labels = STATUS_LABELS.get(derived, STATUS_LABELS["awaiting_brief"])
        status = {
            "status_key": derived,
            "status_label_it": labels["it"], "status_label_en": labels["en"],
        }
    return {
        "lead_id": lead_id,
        "events": events,
        "status": status,
        "polled_at": _now_iso(),
    }


@router.get("/briefing-summary/lead/{lead_id}")
def briefing_summary(
    lead_id: str = Path(...),
    ctx: dict = Depends(get_tenant_context),
):
    """Reconstructs the briefing recap for the designer — answers grouped
    by question_group from `relationship_answer_events`.
    """
    _require_studio(ctx)
    c = db()
    r = (c.table("relationship_answer_events")
         .select("question_key, option_value, raw_value, group_key, occurred_at")
         .eq("tenant_id", ctx["tenant_id"])
         .eq("lead_id", lead_id)
         .order("occurred_at", desc=True).limit(300).execute())
    rows = r.data or []
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for row in rows:
        gk = row.get("group_key") or "other"
        grouped.setdefault(gk, []).append({
            "question_key": row.get("question_key"),
            "value": row.get("option_value") or row.get("raw_value"),
            "occurred_at": row.get("occurred_at"),
        })
    return {"lead_id": lead_id, "groups": grouped, "answers_count": len(rows)}


@router.get("/call-requests/pending")
def call_requests_pending(
    ctx: dict = Depends(get_tenant_context),
):
    """Designer dashboard · list of pending call requests assigned to me."""
    _require_studio(ctx)
    c = db()
    role = (ctx.get("role") or "").lower()
    q = (c.table("call_requests").select("*")
         .eq("tenant_id", ctx["tenant_id"]).eq("status", "pending")
         .order("created_at", desc=True).limit(50))
    if role in {"designer", "creative_director", "interior_designer", "studio_member"}:
        q = q.eq("designer_id", ctx["profile_id"])
    res = q.execute()
    return {"data": res.data or []}
