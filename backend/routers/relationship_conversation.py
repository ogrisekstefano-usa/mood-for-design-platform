"""Real Conversation Engine™ · ITER151 Sprint B
=====================================================================

Editorial conversation layer between client and designer. NOT a generic
chat — every message becomes a relationship_event AND optionally a
memory fragment.

Endpoints (mounted on `/api/conversation` in server.py):

  THREADS
    GET  /threads                       (current user's threads · client | designer)
    GET  /threads/{thread_id}           thread + messages + status
    POST /threads/ensure                ensure a thread exists for the current relationship

  MESSAGES
    GET  /threads/{thread_id}/messages?since=ISO
    POST /threads/{thread_id}/messages
    PATCH /messages/{message_id}/read   mark read

All endpoints respect tenant scoping and (where applicable) the link
between users_profile (client) ↔ leads ↔ assigned designer.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query
from pydantic import BaseModel

from core.tenant_context import get_tenant_context
from database import db
from services.relationship_narrator import narrate, STATUS_LABELS

router = APIRouter()

_STUDIO_ROLES = {
    "designer", "creative_director", "interior_designer",
    "studio_member", "tenant_admin", "super_admin",
}


# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _profile_summary(c, pid: Optional[str]) -> Dict[str, Any]:
    if not pid:
        return {}
    try:
        r = (c.table("users_profile")
             .select("id,first_name,last_name,email,avatar_url,role,role_label,short_bio")
             .eq("id", pid).limit(1).execute())
        if not r.data:
            return {}
        p = r.data[0]
        name = ((p.get("first_name") or "") + " " + (p.get("last_name") or "")).strip()
        return {
            "id": p["id"],
            "name": name or (p.get("email") or "").split("@")[0],
            "avatar_url": p.get("avatar_url"),
            "role": p.get("role"),
            "role_label": p.get("role_label"),
            "short_bio": p.get("short_bio"),
        }
    except Exception:  # noqa: BLE001
        return {}


def _client_lead(c, tenant_id: str, profile_id: str) -> Optional[Dict[str, Any]]:
    try:
        prof = (c.table("users_profile").select("email")
                .eq("id", profile_id).limit(1).execute())
        email = (prof.data[0].get("email") if prof.data else None)
        if email:
            ld = (c.table("leads")
                  .select("id,designer_assigned,contact_email,name")
                  .eq("tenant_id", tenant_id).eq("contact_email", email)
                  .order("updated_at", desc=True).limit(1).execute())
            if ld.data:
                return ld.data[0]
    except Exception:  # noqa: BLE001
        pass
    try:
        pr = (c.table("projects").select("id,lead_id")
              .eq("tenant_id", tenant_id).eq("client_user_id", profile_id)
              .order("updated_at", desc=True).limit(1).execute())
        if pr.data and pr.data[0].get("lead_id"):
            ld = (c.table("leads").select("id,designer_assigned,contact_email,name")
                  .eq("id", pr.data[0]["lead_id"]).limit(1).execute())
            if ld.data:
                return ld.data[0]
    except Exception:  # noqa: BLE001
        pass
    return None


def _resolve_designer(c, tenant_id: str, lead: Optional[Dict[str, Any]],
                      client_profile_id: Optional[str]) -> Optional[str]:
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


def _ensure_thread(
    c, *, tenant_id: str, client_profile_id: Optional[str],
    lead_id: Optional[str], primary_designer_id: Optional[str],
) -> Dict[str, Any]:
    """Idempotent: return the thread for this relationship, creating if needed."""
    # First try lead-scoped uniqueness
    if lead_id:
        r = (c.table("relationship_threads").select("*")
             .eq("tenant_id", tenant_id).eq("lead_id", lead_id)
             .limit(1).execute())
        if r.data:
            return r.data[0]
    # Else fall back to client_profile_id matching (no lead yet)
    if client_profile_id:
        r = (c.table("relationship_threads").select("*")
             .eq("tenant_id", tenant_id)
             .eq("client_profile_id", client_profile_id)
             .is_("lead_id", "null").limit(1).execute())
        if r.data:
            return r.data[0]

    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "lead_id": lead_id,
        "client_profile_id": client_profile_id,
        "primary_designer_id": primary_designer_id,
        "status": "active",
        "metadata": {},
    }
    row = {k: v for k, v in row.items() if v is not None}
    res = c.table("relationship_threads").insert(row).execute()
    return (res.data or [row])[0]


def _emit_relationship_event(
    c, *, tenant_id: str, event_type: str, actor_type: str,
    actor_id: Optional[str], actor_label: Optional[str],
    lead_id: Optional[str], client_profile_id: Optional[str],
    designer_id: Optional[str], payload: Dict[str, Any], locale: str = "it",
):
    """Side-channel write to relationship_events so timeline reflects msgs."""
    try:
        c.table("relationship_events").insert({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "lead_id": lead_id,
            "client_profile_id": client_profile_id,
            "designer_id": designer_id,
            "event_type": event_type,
            "actor_type": actor_type,
            "actor_id": actor_id,
            "actor_label": actor_label,
            "narrative": narrate(event_type, actor_label, payload=payload, locale=locale),
            "payload": payload or {},
            "visibility": "both",
            "occurred_at": _now_iso(),
        }).execute()
    except Exception:  # noqa: BLE001
        pass


# ─────────────────────────────────────────────────────────────────────
# THREAD endpoints
# ─────────────────────────────────────────────────────────────────────
@router.get("/threads")
def list_threads(ctx: dict = Depends(get_tenant_context)):
    """Return the current user's threads with light hydration.

    role=client → only own threads.
    role=designer → threads where I am primary_designer.
    role=tenant_admin/super_admin → all tenant threads.
    """
    role = (ctx.get("role") or "").lower()
    pid = ctx.get("profile_id")
    if not pid:
        raise HTTPException(401, "Missing profile context.")
    c = db()
    q = (c.table("relationship_threads").select("*")
         .eq("tenant_id", ctx["tenant_id"])
         .order("updated_at", desc=True).limit(80))
    if role == "client":
        q = q.eq("client_profile_id", pid)
    elif role in {"designer", "creative_director", "interior_designer", "studio_member"}:
        q = q.eq("primary_designer_id", pid)
    elif role not in _STUDIO_ROLES:
        raise HTTPException(403, "Not allowed.")
    res = q.execute()
    threads = res.data or []

    # Hydrate counterpart label for each thread
    out = []
    for t in threads:
        counterpart_id = (t.get("primary_designer_id")
                          if role == "client" else t.get("client_profile_id"))
        cp = _profile_summary(c, counterpart_id)
        out.append({
            **t,
            "counterpart": cp,
            "unread": (t.get("unread_for_client") if role == "client"
                       else t.get("unread_for_designer")) or 0,
        })
    return {"data": out, "polled_at": _now_iso()}


class _EnsureThreadBody(BaseModel):
    # Allow designer/admin to specify which client to open a thread with.
    client_profile_id: Optional[str] = None
    lead_id: Optional[str] = None


@router.post("/threads/ensure")
def ensure_thread(
    body: _EnsureThreadBody = Body(default_factory=_EnsureThreadBody),
    ctx: dict = Depends(get_tenant_context),
):
    role = (ctx.get("role") or "").lower()
    pid = ctx.get("profile_id")
    if not pid:
        raise HTTPException(401, "Missing profile context.")
    c = db()
    tenant_id = ctx["tenant_id"]

    if role == "client":
        lead = _client_lead(c, tenant_id, pid)
        designer_id = _resolve_designer(c, tenant_id, lead, pid)
        t = _ensure_thread(
            c, tenant_id=tenant_id,
            client_profile_id=pid,
            lead_id=(lead or {}).get("id"),
            primary_designer_id=designer_id,
        )
        return {"thread": t}

    if role in _STUDIO_ROLES:
        client_id = body.client_profile_id
        lead_id = body.lead_id
        if not client_id and lead_id:
            ld = (c.table("leads").select("contact_email,designer_assigned")
                  .eq("id", lead_id).limit(1).execute())
            if ld.data and ld.data[0].get("contact_email"):
                up = (c.table("users_profile").select("id")
                      .eq("tenant_id", tenant_id)
                      .eq("email", ld.data[0]["contact_email"]).limit(1).execute())
                if up.data:
                    client_id = up.data[0]["id"]
        designer_id = pid  # default: caller becomes primary designer
        t = _ensure_thread(
            c, tenant_id=tenant_id,
            client_profile_id=client_id, lead_id=lead_id,
            primary_designer_id=designer_id,
        )
        return {"thread": t}

    raise HTTPException(403, "Not allowed.")


def _can_access_thread(c, ctx: dict, thread: Dict[str, Any]) -> bool:
    role = (ctx.get("role") or "").lower()
    pid = ctx.get("profile_id")
    if thread.get("tenant_id") != ctx.get("tenant_id"):
        return False
    if role in {"tenant_admin", "super_admin"}:
        return True
    if role == "client":
        return thread.get("client_profile_id") == pid
    if role in _STUDIO_ROLES:
        return thread.get("primary_designer_id") == pid
    return False


@router.get("/threads/{thread_id}")
def get_thread(
    thread_id: str = Path(...),
    ctx: dict = Depends(get_tenant_context),
):
    c = db()
    r = (c.table("relationship_threads").select("*")
         .eq("id", thread_id).limit(1).execute())
    if not r.data:
        raise HTTPException(404, "Thread not found.")
    t = r.data[0]
    if not _can_access_thread(c, ctx, t):
        raise HTTPException(403, "Not allowed.")
    msgs = (c.table("relationship_messages").select("*")
            .eq("thread_id", thread_id).order("created_at", desc=False)
            .limit(200).execute()).data or []
    # Hydrate counterpart
    role = (ctx.get("role") or "").lower()
    counterpart_id = (t.get("primary_designer_id") if role == "client"
                      else t.get("client_profile_id"))
    return {
        "thread": t,
        "messages": msgs,
        "counterpart": _profile_summary(c, counterpart_id),
        "polled_at": _now_iso(),
    }


# ─────────────────────────────────────────────────────────────────────
# MESSAGE endpoints
# ─────────────────────────────────────────────────────────────────────
@router.get("/threads/{thread_id}/messages")
def list_messages(
    thread_id: str = Path(...),
    since: Optional[str] = Query(None),
    limit: int = Query(80, ge=1, le=300),
    ctx: dict = Depends(get_tenant_context),
):
    c = db()
    r = (c.table("relationship_threads").select("*")
         .eq("id", thread_id).limit(1).execute())
    if not r.data:
        raise HTTPException(404, "Thread not found.")
    if not _can_access_thread(c, ctx, r.data[0]):
        raise HTTPException(403, "Not allowed.")
    q = (c.table("relationship_messages").select("*")
         .eq("thread_id", thread_id)
         .order("created_at", desc=False).limit(limit))
    if since:
        q = q.gt("created_at", since)
    res = q.execute()
    return {"data": res.data or [], "polled_at": _now_iso()}


class _SendBody(BaseModel):
    content: Optional[str] = None
    message_type: Optional[str] = "text"
    attachments: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None
    locale: Optional[str] = "it"


@router.post("/threads/{thread_id}/messages", status_code=201)
def send_message(
    thread_id: str = Path(...),
    body: _SendBody = Body(...),
    ctx: dict = Depends(get_tenant_context),
):
    role = (ctx.get("role") or "").lower()
    pid = ctx.get("profile_id")
    if not pid:
        raise HTTPException(401, "Missing profile context.")

    c = db()
    r = (c.table("relationship_threads").select("*")
         .eq("id", thread_id).limit(1).execute())
    if not r.data:
        raise HTTPException(404, "Thread not found.")
    t = r.data[0]
    if not _can_access_thread(c, ctx, t):
        raise HTTPException(403, "Not allowed.")

    if (body.message_type or "text") == "text" and not (body.content or "").strip():
        raise HTTPException(400, "content required for text message.")

    sender_type = "client" if role == "client" else "designer"
    sender = _profile_summary(c, pid)
    sender_label = sender.get("name") or "Studio"

    msg_id = str(uuid.uuid4())
    now = _now_iso()
    msg_row = {
        "id": msg_id,
        "tenant_id": ctx["tenant_id"],
        "thread_id": thread_id,
        "sender_type": sender_type,
        "sender_user_id": pid,
        "sender_label": sender_label,
        "message_type": body.message_type or "text",
        "content": body.content,
        "attachments": body.attachments or [],
        "metadata": body.metadata or {},
        "created_at": now,
    }
    msg_row = {k: v for k, v in msg_row.items() if v is not None}
    c.table("relationship_messages").insert(msg_row).execute()

    # Update thread pointers
    preview = (body.content or "").strip()[:140]
    if not preview and (body.message_type or "text") != "text":
        preview = f"[{body.message_type}]"
    unread_inc = {
        "unread_for_client": (t.get("unread_for_client") or 0)
            + (1 if sender_type == "designer" else 0),
        "unread_for_designer": (t.get("unread_for_designer") or 0)
            + (1 if sender_type == "client" else 0),
    }
    c.table("relationship_threads").update({
        "last_message_at": now,
        "last_message_preview": preview,
        "updated_at": now,
        "status": "awaiting_reply",
        **unread_inc,
    }).eq("id", thread_id).execute()

    # Emit relationship_event (timeline / Sprint A integration)
    _emit_relationship_event(
        c,
        tenant_id=ctx["tenant_id"],
        event_type="message_sent",
        actor_type=sender_type,
        actor_id=pid,
        actor_label=sender_label,
        lead_id=t.get("lead_id"),
        client_profile_id=t.get("client_profile_id"),
        designer_id=t.get("primary_designer_id"),
        payload={
            "preview": preview,
            "thread_id": thread_id,
            "message_id": msg_id,
            "message_type": body.message_type or "text",
        },
        locale=body.locale or "it",
    )

    # Light memory: long client messages or attachments → memory fragment
    try:
        if sender_type == "client":
            text = (body.content or "").strip()
            if len(text) > 200 or (body.attachments and len(body.attachments) > 0):
                fragment_type = "direction_note"
                if any(k in text.lower() for k in
                       ("mi piace", "love", "adoro", "perfetto", "wow")):
                    fragment_type = "excitement"
                elif any(k in text.lower() for k in
                         ("non sono sicur", "forse", "not sure", "maybe", "non so")):
                    fragment_type = "hesitation"
                c.table("relationship_memory_fragments").insert({
                    "id": str(uuid.uuid4()),
                    "tenant_id": ctx["tenant_id"],
                    "lead_id": t.get("lead_id"),
                    "thread_id": thread_id,
                    "source_message_id": msg_id,
                    "fragment_type": fragment_type,
                    "body": text[:240] or preview,
                    "signal_strength": 0.6,
                    "metadata": {"source": "conversation_message"},
                }).execute()
    except Exception:  # noqa: BLE001
        pass

    return {"message": msg_row}


@router.patch("/messages/{message_id}/read")
def mark_read(
    message_id: str = Path(...),
    ctx: dict = Depends(get_tenant_context),
):
    c = db()
    r = (c.table("relationship_messages").select("*")
         .eq("id", message_id).limit(1).execute())
    if not r.data:
        raise HTTPException(404, "Message not found.")
    m = r.data[0]
    t_res = (c.table("relationship_threads").select("*")
             .eq("id", m["thread_id"]).limit(1).execute())
    if not t_res.data or not _can_access_thread(c, ctx, t_res.data[0]):
        raise HTTPException(403, "Not allowed.")
    if m.get("read_at"):
        return {"message": m, "already_read": True}
    now = _now_iso()
    c.table("relationship_messages").update({"read_at": now}).eq("id", message_id).execute()
    return {"message": {**m, "read_at": now}, "already_read": False}


@router.post("/threads/{thread_id}/mark-all-read")
def mark_all_read(
    thread_id: str = Path(...),
    ctx: dict = Depends(get_tenant_context),
):
    c = db()
    r = (c.table("relationship_threads").select("*")
         .eq("id", thread_id).limit(1).execute())
    if not r.data:
        raise HTTPException(404, "Thread not found.")
    t = r.data[0]
    if not _can_access_thread(c, ctx, t):
        raise HTTPException(403, "Not allowed.")
    role = (ctx.get("role") or "").lower()
    now = _now_iso()
    other_sender = "designer" if role == "client" else "client"
    c.table("relationship_messages").update({"read_at": now})\
        .eq("thread_id", thread_id).is_("read_at", "null")\
        .eq("sender_type", other_sender).execute()
    upd = ({"unread_for_client": 0} if role == "client"
           else {"unread_for_designer": 0})
    c.table("relationship_threads").update(upd).eq("id", thread_id).execute()
    return {"ok": True, "thread_id": thread_id}


# ─────────────────────────────────────────────────────────────────────
# MEMORY · expose distilled fragments (designer view)
# ─────────────────────────────────────────────────────────────────────
@router.get("/memory/lead/{lead_id}")
def memory_for_lead(
    lead_id: str = Path(...),
    ctx: dict = Depends(get_tenant_context),
):
    role = (ctx.get("role") or "").lower()
    if role not in _STUDIO_ROLES:
        raise HTTPException(403, "Studio surface only.")
    c = db()
    r = (c.table("relationship_memory_fragments").select("*")
         .eq("tenant_id", ctx["tenant_id"])
         .eq("lead_id", lead_id)
         .order("created_at", desc=True).limit(40).execute())
    return {"data": r.data or []}


# ─────────────────────────────────────────────────────────────────────
# STATUS helper (shared with Sprint A) — Status Bar™
# ─────────────────────────────────────────────────────────────────────
@router.get("/status/me")
def my_status(ctx: dict = Depends(get_tenant_context)):
    """Status-bar helper for the current client (or current designer's
    selected client). Returns the same shape as relationship_engine status
    so the UI can share components.
    """
    role = (ctx.get("role") or "").lower()
    pid = ctx.get("profile_id")
    if not pid:
        raise HTTPException(401, "Missing profile context.")
    c = db()
    lead_id = None
    if role == "client":
        lead = _client_lead(c, ctx["tenant_id"], pid)
        lead_id = (lead or {}).get("id")
    if not lead_id:
        labels = STATUS_LABELS["awaiting_brief"]
        return {"status_key": "awaiting_brief",
                "status_label_it": labels["it"], "status_label_en": labels["en"]}
    r = (c.table("relationship_status").select("*")
         .eq("tenant_id", ctx["tenant_id"])
         .eq("lead_id", lead_id).limit(1).execute())
    if not r.data:
        labels = STATUS_LABELS["awaiting_brief"]
        return {"status_key": "awaiting_brief",
                "status_label_it": labels["it"], "status_label_en": labels["en"]}
    return r.data[0]
