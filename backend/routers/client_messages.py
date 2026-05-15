"""Client Messages — Phase S.2.

Premium first-contact / message thread between a client and their
assigned human reference.

CRITICAL RULES enforced server-side:
    1. client_user_id is ALWAYS the client viewer (never trusted from body).
    2. visibility='internal_only' rows are NEVER returned to clients.
    3. AI suggestions (message_type='ai_suggestion') are NEVER returned to clients.
    4. Assignees / tenant_admin / super_admin can read internal rows.
    5. Cross-tenant access is impossible — every query is scoped on
       tenant_id from the auth context.

Endpoints:
    GET  /api/client-messages/thread             (client OR admin?client_id=)
    POST /api/client-messages/send               (any role — recipient inferred)
    POST /api/client-messages/{id}/read          (mark a single msg read)
    GET  /api/client-messages/assignee/queue     (assignee/admin only)
    POST /api/client-messages/{client_id}/suggest-opening
                                                 (assignee/admin only — AI)
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from core.tenant_context import get_tenant_context
from core import human_assignment as engine
from core import notification_service
from database import db

router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_admin(role: str) -> bool:
    return (role or "").lower() in {"tenant_admin", "super_admin"}


def _is_client(role: str) -> bool:
    return (role or "").lower() == "client"


def _project_id_for_client(tenant_id: str, client_user_id: str) -> Optional[str]:
    c = db()
    r = (c.table("projects").select("id").eq("tenant_id", tenant_id)
         .eq("client_user_id", client_user_id)
         .order("updated_at", desc=True).limit(1).execute())
    return r.data[0]["id"] if r.data else None


def _public_message(row: dict, viewer_is_client: bool) -> dict:
    """Shape returned to the consumer. We never echo back the raw DB row.
    For client viewers, internal_only messages are FILTERED OUT upstream
    — this function only shapes."""
    return {
        "id": row["id"],
        "project_id": row.get("project_id"),
        "message_body": row.get("message_body"),
        "message_type": row.get("message_type"),
        "visibility": row.get("visibility"),
        "status": row.get("status"),
        "created_at": row.get("created_at"),
        "read_at": row.get("read_at"),
        # Sender label — client sees "Te" or assignee first_name,
        # studio members see full sender info.
        "sender_user_id": row.get("sender_user_id") if not viewer_is_client else None,
        "assignee_user_id": row.get("assignee_user_id") if not viewer_is_client else None,
    }


@router.get("/thread")
def get_thread(
    client_id: Optional[str] = Query(None),
    ctx: dict = Depends(get_tenant_context),
):
    """Return the message thread.

    - Clients: returns own thread (client_id param ignored).
    - Admin / assignee: must pass `client_id` to inspect that client.
      Designers without an active assignment cannot view threads of
      clients they are not the assignee for.
    """
    role = ctx.get("role") or ""
    tenant_id = ctx["tenant_id"]
    profile_id = ctx["profile_id"]
    c = db()

    if _is_client(role):
        target_client_id = profile_id
    else:
        if not client_id:
            raise HTTPException(400, "client_id richiesto.")
        # Verify caller is allowed to see this client's thread
        if not _is_admin(role):
            a = engine.get_active_assignment(tenant_id, "client", client_id)
            if not a or a.get("assignee_user_id") != profile_id:
                raise HTTPException(403, "Non sei il referente di questo cliente.")
        target_client_id = client_id

    q = (c.table("client_messages").select("*")
         .eq("tenant_id", tenant_id)
         .eq("client_user_id", target_client_id)
         .order("created_at"))
    if _is_client(role):
        q = q.eq("visibility", "client_visible")
    rows = q.execute().data or []

    # Resolve assignee public profile for header
    assignment = engine.get_active_assignment(tenant_id, "client", target_client_id)
    assignee = engine.hydrate_assignee(assignment)
    return {
        "messages": [_public_message(r, _is_client(role)) for r in rows],
        "assignee": (assignee or {}).get("assignee") if assignee else None,
        "assignment": {
            "id": assignment["id"] if assignment else None,
            "first_contact_status": (assignment or {}).get("first_contact_status"),
            "first_contact_sent_at": (assignment or {}).get("first_contact_sent_at"),
            "first_contact_suggested_at": (assignment or {}).get("first_contact_suggested_at"),
        } if assignment else None,
    }


class SendReq(BaseModel):
    message_body: str = Field(..., min_length=1, max_length=4000)
    client_id: Optional[str] = None    # required for assignees, ignored for clients
    visibility: Optional[str] = None   # admins may post internal_only
    project_id: Optional[str] = None


@router.post("/send")
def send_message(body: SendReq, ctx: dict = Depends(get_tenant_context)):
    role = ctx.get("role") or ""
    tenant_id = ctx["tenant_id"]
    profile_id = ctx["profile_id"]
    c = db()

    if _is_client(role):
        target_client_id = profile_id
        message_type = "client_message"
        visibility = "client_visible"
        assignment = engine.get_active_assignment(tenant_id, "client", profile_id)
        assignee_id = (assignment or {}).get("assignee_user_id")
        recipient_id = assignee_id
    else:
        if not body.client_id:
            raise HTTPException(400, "client_id richiesto.")
        # Auth: assignees can only send to their assigned clients
        assignment = engine.get_active_assignment(tenant_id, "client", body.client_id)
        if not _is_admin(role) and (not assignment or assignment.get("assignee_user_id") != profile_id):
            raise HTTPException(403, "Non sei il referente di questo cliente.")
        target_client_id = body.client_id
        assignee_id = (assignment or {}).get("assignee_user_id") or profile_id
        message_type = "assignee_reply"
        visibility = body.visibility if body.visibility in {"client_visible", "internal_only"} else "client_visible"
        recipient_id = target_client_id

    project_id = body.project_id or _project_id_for_client(tenant_id, target_client_id)
    row_id = str(uuid.uuid4())
    row = {
        "id": row_id,
        "tenant_id": tenant_id,
        "project_id": project_id,
        "client_user_id": target_client_id,
        "assignee_user_id": assignee_id,
        "sender_user_id": profile_id,
        "recipient_user_id": recipient_id,
        "message_body": body.message_body.strip(),
        "message_type": message_type,
        "visibility": visibility,
        "status": "sent",
        "created_at": _now(),
    }
    c.table("client_messages").insert(row).execute()

    # First-contact status update
    if message_type == "assignee_reply" and visibility == "client_visible" and assignment:
        c.table("human_assignments").update({
            "first_contact_sent_at": _now(),
            "first_contact_status": "sent",
            "updated_at": _now(),
        }).eq("id", assignment["id"]).execute()

    # Notify the other side
    if recipient_id and visibility == "client_visible":
        notification_service.notify(
            tenant_id=tenant_id,
            recipient_user_id=recipient_id,
            event_type="client_message",
            title="Nuovo messaggio" if message_type == "client_message" else "Messaggio dal tuo referente",
            body=(body.message_body[:140] + "…") if len(body.message_body) > 141 else body.message_body,
            href=("/client/messages" if recipient_id == target_client_id else "/dashboard"),
            project_id=project_id,
        )

    return {"message": _public_message(row, _is_client(role))}


@router.post("/{message_id}/read")
def mark_read(message_id: str, ctx: dict = Depends(get_tenant_context)):
    c = db()
    role = ctx.get("role") or ""
    r = (c.table("client_messages").select("*")
         .eq("id", message_id).eq("tenant_id", ctx["tenant_id"])
         .limit(1).execute())
    if not r.data:
        raise HTTPException(404, "Messaggio non trovato.")
    msg = r.data[0]
    # Only the recipient can mark as read
    if _is_client(role) and msg.get("client_user_id") != ctx["profile_id"]:
        raise HTTPException(403, "Non autorizzato.")
    if not _is_client(role) and not _is_admin(role):
        if msg.get("assignee_user_id") != ctx["profile_id"]:
            raise HTTPException(403, "Non autorizzato.")
    c.table("client_messages").update({"read_at": _now(), "status": "read"}).eq("id", message_id).execute()
    return {"ok": True}


@router.get("/assignee/queue")
def assignee_queue(ctx: dict = Depends(get_tenant_context)):
    """Return all active clients assigned to the current studio member,
    plus first-contact status and latest message snippet.

    Computes `overdue` on the fly: if `first_contact_sent_at` is null
    and the assignment is older than 24 hours, status becomes 'overdue'.
    """
    role = ctx.get("role") or ""
    if _is_client(role):
        raise HTTPException(403, "Riservato al team studio.")
    tenant_id = ctx["tenant_id"]
    profile_id = ctx["profile_id"]
    c = db()

    q = (c.table("human_assignments").select("*")
         .eq("tenant_id", tenant_id).eq("subject_type", "client")
         .eq("status", "active"))
    if not _is_admin(role):
        q = q.eq("assignee_user_id", profile_id)
    assignments = q.order("created_at", desc=True).execute().data or []

    out = []
    now_dt = datetime.now(timezone.utc)
    for a in assignments:
        client_id = a["subject_id"]
        cp = (c.table("users_profile").select("id,first_name,last_name,email,avatar_url")
              .eq("id", client_id).limit(1).execute())
        cprof = cp.data[0] if cp.data else None
        # latest assignee_reply or ai_suggestion
        lm = (c.table("client_messages")
              .select("id,message_type,visibility,message_body,created_at,status")
              .eq("tenant_id", tenant_id).eq("client_user_id", client_id)
              .order("created_at", desc=True).limit(1).execute())
        latest = lm.data[0] if lm.data else None
        # Compute overdue
        status = a.get("first_contact_status") or "pending"
        if status in {"pending", "suggested"}:
            created_at = a.get("created_at")
            if created_at:
                try:
                    dt = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
                    if now_dt - dt > timedelta(hours=24):
                        status = "overdue"
                except Exception:
                    pass
        out.append({
            "assignment_id": a["id"],
            "client": {
                "id": cprof and cprof.get("id"),
                "name": ((cprof.get("first_name") or "") + " " + (cprof.get("last_name") or "")).strip() or (cprof.get("email") or "").split("@")[0] if cprof else None,
                "avatar_url": cprof and cprof.get("avatar_url"),
            },
            "assigned_at": a.get("created_at"),
            "first_contact_status": status,
            "first_contact_suggested_at": a.get("first_contact_suggested_at"),
            "first_contact_sent_at": a.get("first_contact_sent_at"),
            "latest_message": latest,
        })
    return {"queue": out}


class SuggestOpeningReq(BaseModel):
    persist: bool = True   # save to client_messages as ai_suggestion


@router.post("/{client_id}/suggest-opening")
async def suggest_opening(client_id: str, body: SuggestOpeningReq, ctx: dict = Depends(get_tenant_context)):
    """Generate an AI-drafted opening message tailored to this client +
    studio + assignee. Output is stored as a draft ai_suggestion that
    only the assignee / admin can see."""
    role = ctx.get("role") or ""
    if _is_client(role):
        raise HTTPException(403, "Solo lo studio può generare suggerimenti.")
    tenant_id = ctx["tenant_id"]
    c = db()

    assignment = engine.get_active_assignment(tenant_id, "client", client_id)
    if not assignment:
        raise HTTPException(404, "Nessuna assegnazione attiva per questo cliente.")
    if not _is_admin(role) and assignment.get("assignee_user_id") != ctx["profile_id"]:
        raise HTTPException(403, "Non sei il referente di questo cliente.")

    # Hydrate context
    cprof = (c.table("users_profile").select("first_name,last_name").eq("id", client_id).limit(1).execute())
    client_first = (cprof.data[0].get("first_name") if cprof.data else "") or ""
    assignee_id = assignment.get("assignee_user_id")
    aname = ""
    if assignee_id:
        ap = c.table("users_profile").select("first_name").eq("id", assignee_id).limit(1).execute()
        if ap.data:
            aname = ap.data[0].get("first_name") or ""
    tenant_name = ""
    tr = c.table("tenants").select("name").eq("id", tenant_id).limit(1).execute()
    if tr.data:
        tenant_name = tr.data[0].get("name") or ""
    project_id = _project_id_for_client(tenant_id, client_id)
    project_title = None
    if project_id:
        pr = c.table("projects").select("title,project_type").eq("id", project_id).limit(1).execute()
        if pr.data:
            project_title = pr.data[0].get("title")

    # Call the same LLM the editorial assistant uses — reuse SDK
    from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
    import os
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(500, "EMERGENT_LLM_KEY non configurata.")

    sys_prompt = (
        "Sei l'assistente editoriale di MOOD for DESIGN™. Stai aiutando "
        f"{aname or 'il referente dello studio'} a scrivere il PRIMO messaggio personale "
        f"al nuovo cliente {client_first or '(nome cliente)'}. "
        "Tono: caldo, sobrio, premium, professionale. MAI marketing, MAI 'sono entusiasta', "
        "MAI emoji, MAI domande generiche. Massimo 3-4 frasi in italiano. "
        "Il messaggio deve trasmettere: chi sei, che lo seguirai personalmente, "
        "qual è il prossimo passo concreto. Non firmare — il sistema aggiunge il nome."
    )
    user_msg = (
        f"Studio: {tenant_name or '(studio)'}\n"
        f"Referente: {aname or '(referente)'}\n"
        f"Cliente: {client_first or '(cliente)'}\n"
        f"Progetto: {project_title or 'non ancora definito'}\n"
        "Scrivi il primo messaggio."
    )
    try:
        chat = (
            LlmChat(api_key=key, session_id=f"first-contact-{client_id}", system_message=sys_prompt)
            .with_model("anthropic", "claude-sonnet-4-5-20250929")
            .with_params(max_tokens=400)
        )
        resp = await chat.send_message(UserMessage(text=user_msg))
        suggestion_text = (resp if isinstance(resp, str) else getattr(resp, "text", str(resp))).strip()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Suggerimento non disponibile: {e}")

    if not suggestion_text:
        raise HTTPException(502, "Suggerimento vuoto.")

    if body.persist:
        c.table("client_messages").insert({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "project_id": project_id,
            "client_user_id": client_id,
            "assignee_user_id": assignee_id,
            "sender_user_id": None,
            "recipient_user_id": assignee_id,
            "message_body": suggestion_text,
            "message_type": "ai_suggestion",
            "visibility": "internal_only",
            "status": "draft",
            "created_at": _now(),
        }).execute()
        c.table("human_assignments").update({
            "first_contact_suggested_at": _now(),
            "first_contact_status": (
                "suggested" if assignment.get("first_contact_status") in (None, "pending") else assignment.get("first_contact_status")
            ),
            "updated_at": _now(),
        }).eq("id", assignment["id"]).execute()

    return {"suggestion": suggestion_text}
