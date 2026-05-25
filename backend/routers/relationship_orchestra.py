"""Relationship Orchestra™ · ITER151 Sprint C
=====================================================================

Three layers wired together as ONE editorial concept:

  1. CURATORIAL BOOKING — not a Calendly clone. Client proposes
     2-3 conversation slots; designer confirms/reschedules/rejects.
     Adds a `confirmed_slot` to the call_request and emits both a
     `relationship_event` and a system-narrative message in the
     existing conversation thread (Sprint B link).

  2. DESIGNER PRESENCE — narrative states the designer reveals to
     clients ("In Studio", "Reviewing Materials", "In Presentation"…).
     NOT online/offline. Optional editorial note + optional auto-clear
     expiry.

  3. RELATIONSHIP OWNERSHIP — primary / secondary / collaborator /
     observer assignment per lead. Idempotent. Visible client-side
     (only the primary is exposed) and studio-side (everyone).

Endpoints mounted on `/api/orchestra`.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Path
from pydantic import BaseModel

from core.tenant_context import get_tenant_context
from database import db
from services.relationship_narrator import narrate, STATUS_LABELS

router = APIRouter()

_STUDIO_ROLES = {
    "designer", "creative_director", "interior_designer",
    "studio_member", "tenant_admin", "super_admin",
}

PRESENCE_LABELS = {
    "in_studio":             {"it": "In studio",            "en": "In studio"},
    "reviewing_materials":   {"it": "Selezione materiali",   "en": "Reviewing materials"},
    "curating_inspirations": {"it": "Curando ispirazioni",   "en": "Curating inspirations"},
    "preparing_concepts":    {"it": "Preparando concept",    "en": "Preparing concepts"},
    "in_presentation":       {"it": "In presentazione",      "en": "In presentation"},
    "with_clients":          {"it": "Con un cliente",        "en": "With clients"},
    "site_visit":            {"it": "Sopralluogo",           "en": "Site visit"},
    "away":                  {"it": "Fuori studio",          "en": "Away"},
}


# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────
def _now() -> datetime: return datetime.now(timezone.utc)
def _iso() -> str: return _now().isoformat()


def _require_studio(ctx: dict):
    if (ctx.get("role") or "").lower() not in _STUDIO_ROLES:
        raise HTTPException(403, "Studio surface only.")
    if not ctx.get("profile_id"):
        raise HTTPException(401, "Missing profile context.")


def _require_client(ctx: dict) -> str:
    role = (ctx.get("role") or "").lower()
    if role not in {"client", "tenant_admin", "super_admin"}:
        raise HTTPException(403, "Client surface only.")
    pid = ctx.get("profile_id")
    if not pid:
        raise HTTPException(401, "Missing profile context.")
    return pid


def _profile_label(c, pid: Optional[str]) -> Optional[str]:
    if not pid:
        return None
    try:
        r = (c.table("users_profile").select("first_name,last_name,email")
             .eq("id", pid).limit(1).execute())
        if not r.data:
            return None
        p = r.data[0]
        n = ((p.get("first_name") or "") + " " + (p.get("last_name") or "")).strip()
        return n or (p.get("email") or "").split("@")[0]
    except Exception:  # noqa: BLE001
        return None


def _emit_event(c, **kw):
    """Thin wrapper around relationship_events insertion."""
    try:
        payload = kw.get("payload") or {}
        actor_type = kw.get("actor_type", "system")
        actor_label = kw.get("actor_label")
        narrative = narrate(
            kw["event_type"], actor_label,
            payload=payload, locale=kw.get("locale", "it"),
        )
        row = {
            "id": str(uuid.uuid4()),
            "tenant_id": kw["tenant_id"],
            "lead_id": kw.get("lead_id"),
            "client_profile_id": kw.get("client_profile_id"),
            "designer_id": kw.get("designer_id"),
            "event_type": kw["event_type"],
            "actor_type": actor_type,
            "actor_id": kw.get("actor_id"),
            "actor_label": actor_label,
            "narrative": narrative,
            "payload": payload,
            "visibility": kw.get("visibility", "both"),
            "occurred_at": _iso(),
        }
        row = {k: v for k, v in row.items() if v is not None}
        c.table("relationship_events").insert(row).execute()
    except Exception:  # noqa: BLE001
        pass


def _system_message(c, *, tenant_id: str, thread_id: str, content: str,
                    metadata: Optional[Dict[str, Any]] = None):
    """Drop a system-narrative message into a thread (Sprint B link)."""
    try:
        c.table("relationship_messages").insert({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "thread_id": thread_id,
            "sender_type": "system",
            "sender_label": "Studio",
            "message_type": "system_narrative",
            "content": content,
            "metadata": metadata or {},
            "created_at": _iso(),
        }).execute()
        c.table("relationship_threads").update({
            "last_message_at": _iso(),
            "last_message_preview": content[:140],
            "updated_at": _iso(),
        }).eq("id", thread_id).execute()
    except Exception:  # noqa: BLE001
        pass


def _find_thread(c, tenant_id: str, lead_id: Optional[str],
                 client_profile_id: Optional[str]) -> Optional[str]:
    """Locate the thread that matches this relationship, if any."""
    try:
        q = c.table("relationship_threads").select("id").eq("tenant_id", tenant_id)
        if lead_id:
            r = q.eq("lead_id", lead_id).limit(1).execute()
        elif client_profile_id:
            r = q.eq("client_profile_id", client_profile_id).limit(1).execute()
        else:
            return None
        if r.data:
            return r.data[0]["id"]
    except Exception:  # noqa: BLE001
        return None
    return None


# ─────────────────────────────────────────────────────────────────────
# 1 · CURATORIAL CALL BOOKING
# ─────────────────────────────────────────────────────────────────────
class _NewBookingBody(BaseModel):
    preferred_slots:   List[Dict[str, Any]]  # [{ "start": ISO, "tz": "Europe/Rome" }, …]
    client_timezone:   Optional[str] = None
    note:              Optional[str] = None
    conversation_kind: Optional[str] = "discovery"
    locale:            Optional[str] = "it"


@router.post("/bookings", status_code=201)
def create_booking(body: _NewBookingBody, ctx: dict = Depends(get_tenant_context)):
    """Client proposes a curatorial conversation slot menu."""
    profile_id = _require_client(ctx)
    c = db()

    # Find lead / designer (re-uses Sprint A lead-resolution heuristic)
    label = _profile_label(c, profile_id)
    lead = None
    try:
        prof = (c.table("users_profile").select("email")
                .eq("id", profile_id).limit(1).execute())
        email = prof.data[0]["email"] if prof.data else None
        if email:
            ld = (c.table("leads").select("id,designer_assigned")
                  .eq("tenant_id", ctx["tenant_id"]).eq("contact_email", email)
                  .order("updated_at", desc=True).limit(1).execute())
            if ld.data:
                lead = ld.data[0]
    except Exception:  # noqa: BLE001
        pass

    designer_id = (lead or {}).get("designer_assigned")
    # Else fall back to primary owner if any
    if not designer_id and lead:
        try:
            own = (c.table("relationship_ownership").select("designer_id")
                   .eq("tenant_id", ctx["tenant_id"])
                   .eq("lead_id", lead["id"]).eq("role", "primary")
                   .limit(1).execute())
            if own.data:
                designer_id = own.data[0]["designer_id"]
        except Exception:  # noqa: BLE001
            pass

    req_id = str(uuid.uuid4())
    row = {
        "id": req_id,
        "tenant_id": ctx["tenant_id"],
        "lead_id": (lead or {}).get("id"),
        "client_profile_id": profile_id,
        "designer_id": designer_id,
        "status": "pending",
        "preferred_slots": body.preferred_slots or [],
        "timezone": body.client_timezone,
        "client_timezone": body.client_timezone,
        "client_note": body.note,
        "conversation_kind": body.conversation_kind or "discovery",
    }
    row = {k: v for k, v in row.items() if v is not None}
    c.table("call_requests").insert(row).execute()

    _emit_event(
        c, tenant_id=ctx["tenant_id"], event_type="call_requested",
        actor_type="client", actor_id=profile_id, actor_label=label,
        lead_id=(lead or {}).get("id"), client_profile_id=profile_id,
        designer_id=designer_id, locale=body.locale or "it",
        payload={
            "call_request_id": req_id,
            "preferred_slots": body.preferred_slots or [],
            "timezone": body.client_timezone,
            "note": body.note,
            "conversation_kind": body.conversation_kind,
        },
    )
    return {"booking_id": req_id, "status": "pending"}


@router.get("/bookings/me")
def my_bookings(ctx: dict = Depends(get_tenant_context)):
    profile_id = _require_client(ctx)
    c = db()
    r = (c.table("call_requests").select("*")
         .eq("tenant_id", ctx["tenant_id"])
         .eq("client_profile_id", profile_id)
         .order("created_at", desc=True).limit(20).execute())
    return {"data": r.data or []}


@router.get("/bookings/pending")
def pending_bookings(ctx: dict = Depends(get_tenant_context)):
    """Designer pending list (re-uses Sprint A endpoint shape)."""
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


class _ConfirmBody(BaseModel):
    slot:        Dict[str, Any]   # the chosen slot (start, end?, tz?)
    designer_note: Optional[str] = None
    locale:      Optional[str] = "it"


@router.patch("/bookings/{booking_id}/confirm")
def confirm_booking(booking_id: str = Path(...),
                    body: _ConfirmBody = Body(...),
                    ctx: dict = Depends(get_tenant_context)):
    _require_studio(ctx)
    c = db()
    r = (c.table("call_requests").select("*")
         .eq("id", booking_id).limit(1).execute())
    if not r.data:
        raise HTTPException(404, "Booking not found.")
    booking = r.data[0]
    if booking.get("tenant_id") != ctx["tenant_id"]:
        raise HTTPException(403, "Cross-tenant.")
    label = _profile_label(c, ctx["profile_id"])

    c.table("call_requests").update({
        "status": "confirmed",
        "confirmed_slot": body.slot,
        "confirmed_at": _iso(),
        "confirmed_by": ctx["profile_id"],
        "designer_note": body.designer_note,
        "updated_at": _iso(),
    }).eq("id", booking_id).execute()

    # System narrative inside the conversation thread
    thread_id = _find_thread(c, ctx["tenant_id"], booking.get("lead_id"),
                             booking.get("client_profile_id"))
    when = body.slot.get("start") or body.slot.get("when") or ""
    locale = body.locale or "it"
    line = (f"Incontro confermato per {when}." if locale == "it"
            else f"Meeting confirmed for {when}.")
    if body.designer_note:
        line += f" {body.designer_note}"
    if thread_id:
        _system_message(c, tenant_id=ctx["tenant_id"], thread_id=thread_id,
                        content=line, metadata={"booking_id": booking_id})

    _emit_event(
        c, tenant_id=ctx["tenant_id"], event_type="approval_confirmed",
        actor_type="designer", actor_id=ctx["profile_id"], actor_label=label,
        lead_id=booking.get("lead_id"),
        client_profile_id=booking.get("client_profile_id"),
        designer_id=booking.get("designer_id"),
        payload={"booking_id": booking_id, "slot": body.slot},
        locale=locale,
    )
    return {"ok": True, "booking_id": booking_id, "status": "confirmed"}


class _RescheduleBody(BaseModel):
    proposed_slots: List[Dict[str, Any]]
    note: Optional[str] = None
    locale: Optional[str] = "it"


@router.patch("/bookings/{booking_id}/reschedule")
def reschedule_booking(booking_id: str = Path(...),
                       body: _RescheduleBody = Body(...),
                       ctx: dict = Depends(get_tenant_context)):
    _require_studio(ctx)
    c = db()
    r = (c.table("call_requests").select("*").eq("id", booking_id).limit(1).execute())
    if not r.data:
        raise HTTPException(404, "Booking not found.")
    booking = r.data[0]
    if booking.get("tenant_id") != ctx["tenant_id"]:
        raise HTTPException(403, "Cross-tenant.")
    c.table("call_requests").update({
        "status": "rescheduled",
        "reschedule_slots": body.proposed_slots,
        "designer_note": body.note,
        "updated_at": _iso(),
    }).eq("id", booking_id).execute()

    thread_id = _find_thread(c, ctx["tenant_id"], booking.get("lead_id"),
                             booking.get("client_profile_id"))
    locale = body.locale or "it"
    line = (f"Lo studio propone {len(body.proposed_slots)} nuovi orari."
            if locale == "it"
            else f"The studio proposes {len(body.proposed_slots)} new slots.")
    if body.note:
        line += f" {body.note}"
    if thread_id:
        _system_message(c, tenant_id=ctx["tenant_id"], thread_id=thread_id,
                        content=line, metadata={"booking_id": booking_id})

    return {"ok": True, "booking_id": booking_id, "status": "rescheduled"}


@router.patch("/bookings/{booking_id}/reject")
def reject_booking(booking_id: str = Path(...),
                   reason: Optional[str] = Body(default=None, embed=True),
                   ctx: dict = Depends(get_tenant_context)):
    _require_studio(ctx)
    c = db()
    r = (c.table("call_requests").select("*").eq("id", booking_id).limit(1).execute())
    if not r.data:
        raise HTTPException(404, "Booking not found.")
    booking = r.data[0]
    if booking.get("tenant_id") != ctx["tenant_id"]:
        raise HTTPException(403, "Cross-tenant.")
    c.table("call_requests").update({
        "status": "rejected", "designer_note": reason, "updated_at": _iso(),
    }).eq("id", booking_id).execute()
    return {"ok": True, "booking_id": booking_id, "status": "rejected"}


# ─────────────────────────────────────────────────────────────────────
# 2 · DESIGNER PRESENCE
# ─────────────────────────────────────────────────────────────────────
class _PresenceBody(BaseModel):
    state_key: str
    note:      Optional[str] = None
    timezone:  Optional[str] = None
    expires_in_minutes: Optional[int] = None


@router.put("/presence/me")
def set_my_presence(body: _PresenceBody, ctx: dict = Depends(get_tenant_context)):
    _require_studio(ctx)
    if body.state_key not in PRESENCE_LABELS:
        raise HTTPException(400, f"Invalid state_key. Allowed: {list(PRESENCE_LABELS)}")
    labels = PRESENCE_LABELS[body.state_key]
    expires_at = None
    if body.expires_in_minutes:
        expires_at = (_now() + timedelta(minutes=int(body.expires_in_minutes))).isoformat()
    row = {
        "tenant_id": ctx["tenant_id"],
        "designer_id": ctx["profile_id"],
        "state_key": body.state_key,
        "state_label_it": labels["it"],
        "state_label_en": labels["en"],
        "note": body.note,
        "timezone": body.timezone,
        "expires_at": expires_at,
        "updated_at": _iso(),
    }
    row = {k: v for k, v in row.items() if v is not None}
    c = db()
    c.table("designer_presence").upsert(row, on_conflict="designer_id").execute()
    return {"presence": row}


@router.get("/presence/me")
def get_my_presence(ctx: dict = Depends(get_tenant_context)):
    _require_studio(ctx)
    c = db()
    r = (c.table("designer_presence").select("*")
         .eq("designer_id", ctx["profile_id"]).limit(1).execute())
    if not r.data:
        labels = PRESENCE_LABELS["in_studio"]
        return {"state_key": "in_studio", "state_label_it": labels["it"],
                "state_label_en": labels["en"]}
    p = r.data[0]
    # auto-expire
    if p.get("expires_at"):
        try:
            if datetime.fromisoformat(p["expires_at"].replace("Z", "+00:00")) < _now():
                labels = PRESENCE_LABELS["in_studio"]
                return {"state_key": "in_studio", "state_label_it": labels["it"],
                        "state_label_en": labels["en"], "expired": True}
        except Exception:  # noqa: BLE001
            pass
    return p


@router.get("/presence/designer/{designer_id}")
def get_presence(designer_id: str = Path(...),
                 ctx: dict = Depends(get_tenant_context)):
    """Public-to-the-relationship: client can read their designer's presence."""
    c = db()
    r = (c.table("designer_presence").select("*")
         .eq("tenant_id", ctx["tenant_id"])
         .eq("designer_id", designer_id).limit(1).execute())
    if not r.data:
        labels = PRESENCE_LABELS["in_studio"]
        return {"designer_id": designer_id, "state_key": "in_studio",
                "state_label_it": labels["it"], "state_label_en": labels["en"]}
    p = r.data[0]
    if p.get("expires_at"):
        try:
            if datetime.fromisoformat(p["expires_at"].replace("Z", "+00:00")) < _now():
                labels = PRESENCE_LABELS["in_studio"]
                return {"designer_id": designer_id, "state_key": "in_studio",
                        "state_label_it": labels["it"], "state_label_en": labels["en"]}
        except Exception:  # noqa: BLE001
            pass
    return p


@router.get("/presence/options")
def list_presence_options():
    """Static catalogue, used by the designer presence picker UI."""
    return {"data": [
        {"key": k, "label_it": v["it"], "label_en": v["en"]}
        for k, v in PRESENCE_LABELS.items()
    ]}


# ─────────────────────────────────────────────────────────────────────
# 3 · RELATIONSHIP OWNERSHIP
# ─────────────────────────────────────────────────────────────────────
class _OwnershipAssignBody(BaseModel):
    designer_id: str
    role:        str = "collaborator"
    specialty:   Optional[str] = None


@router.get("/ownership/lead/{lead_id}")
def get_ownership(lead_id: str = Path(...),
                  ctx: dict = Depends(get_tenant_context)):
    c = db()
    r = (c.table("relationship_ownership").select("*")
         .eq("tenant_id", ctx["tenant_id"])
         .eq("lead_id", lead_id)
         .order("role").execute())
    rows = r.data or []
    # Hydrate designer summaries
    ids = list({row["designer_id"] for row in rows if row.get("designer_id")})
    profiles = {}
    if ids:
        try:
            res = (c.table("users_profile")
                   .select("id,first_name,last_name,email,avatar_url,role_label,short_bio")
                   .in_("id", ids).execute())
            for p in res.data or []:
                name = ((p.get("first_name") or "") + " " + (p.get("last_name") or "")).strip()
                profiles[p["id"]] = {
                    "id": p["id"],
                    "name": name or (p.get("email") or "").split("@")[0],
                    "avatar_url": p.get("avatar_url"),
                    "role_label": p.get("role_label"),
                    "short_bio": p.get("short_bio"),
                }
        except Exception:  # noqa: BLE001
            pass
    return {"data": [{**row, "designer": profiles.get(row["designer_id"], {})}
                     for row in rows]}


@router.post("/ownership/lead/{lead_id}", status_code=201)
def assign_ownership(lead_id: str = Path(...),
                     body: _OwnershipAssignBody = Body(...),
                     ctx: dict = Depends(get_tenant_context)):
    _require_studio(ctx)
    if body.role not in {"primary", "secondary", "collaborator", "observer"}:
        raise HTTPException(400, "Invalid role.")
    c = db()

    # If role=primary, demote any existing primary first
    if body.role == "primary":
        try:
            c.table("relationship_ownership").update({"role": "secondary"})\
                .eq("tenant_id", ctx["tenant_id"]).eq("lead_id", lead_id)\
                .eq("role", "primary").execute()
        except Exception:  # noqa: BLE001
            pass

    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "lead_id": lead_id,
        "designer_id": body.designer_id,
        "role": body.role,
        "specialty": body.specialty,
        "added_by": ctx["profile_id"],
        "added_at": _iso(),
    }
    row = {k: v for k, v in row.items() if v is not None}
    try:
        c.table("relationship_ownership").upsert(
            row, on_conflict="tenant_id,lead_id,designer_id"
        ).execute()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Assignment failed: {e}")

    # If primary, also write back to leads.designer_assigned for legacy reads
    if body.role == "primary":
        try:
            c.table("leads").update({"designer_assigned": body.designer_id})\
                .eq("id", lead_id).execute()
        except Exception:  # noqa: BLE001
            pass

    label = _profile_label(c, body.designer_id) or "Designer"
    _emit_event(
        c, tenant_id=ctx["tenant_id"],
        event_type="designer_assigned" if body.role == "primary" else "designer_changed",
        actor_type="studio", actor_id=ctx["profile_id"],
        actor_label=_profile_label(c, ctx["profile_id"]),
        lead_id=lead_id, designer_id=body.designer_id,
        payload={"designer_label": label, "role": body.role,
                 "specialty": body.specialty},
    )
    return {"ok": True, "ownership": row}


@router.delete("/ownership/lead/{lead_id}/designer/{designer_id}")
def remove_ownership(lead_id: str = Path(...),
                     designer_id: str = Path(...),
                     ctx: dict = Depends(get_tenant_context)):
    _require_studio(ctx)
    c = db()
    c.table("relationship_ownership").delete()\
        .eq("tenant_id", ctx["tenant_id"]).eq("lead_id", lead_id)\
        .eq("designer_id", designer_id).execute()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────
# 4 · TIMEZONE OVERLAP HELPER
# ─────────────────────────────────────────────────────────────────────
@router.get("/timezones/overlap")
def overlap(client_tz: str, designer_tz: str,
            hour_from: int = 9, hour_to: int = 19):
    """Return naive overlap hours suggestion (designer-local) given a
    client-local working window.

    Pure utility; UI calls this to suggest "best slots" when the client
    composes a booking. No DB I/O.
    """
    from zoneinfo import ZoneInfo  # py3.9+
    try:
        c_tz, d_tz = ZoneInfo(client_tz), ZoneInfo(designer_tz)
    except Exception:  # noqa: BLE001
        raise HTTPException(400, "Invalid timezone identifier.")

    # Use today as the reference day.
    today = _now().astimezone(c_tz).replace(hour=0, minute=0, second=0, microsecond=0)
    overlaps = []
    for h in range(hour_from, hour_to):
        client_local = today.replace(hour=h)
        designer_local = client_local.astimezone(d_tz)
        if hour_from <= designer_local.hour < hour_to:
            overlaps.append({
                "client_local":   client_local.isoformat(),
                "designer_local": designer_local.isoformat(),
                "client_tz":      client_tz,
                "designer_tz":    designer_tz,
                "hour_client":    h,
                "hour_designer":  designer_local.hour,
            })
    return {"data": overlaps, "count": len(overlaps)}
