"""ITER161 · Recall Requests — il cliente chiede al referente di sentirsi.

NON è un calendar SaaS. È una richiesta relazionale: il cliente segnala
preferenze (giorni, fascia, canale, note) e lo studio "proporrà un momento".

Endpoints (mounted at /api):
  POST /api/client/recall-requests            (auth role=client)
  GET  /api/client/recall-requests/mine       (auth role=client)
  GET  /api/recall-requests                   (auth role=studio team — list per tenant)
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from database import db

logger = logging.getLogger(__name__)
router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class RecallRequestIn(BaseModel):
    preferred_days:    List[str] = Field(default_factory=list)
    preferred_time:    Optional[str] = None
    preferred_channel: Optional[str] = None
    note:              Optional[str] = None
    journey_id:        Optional[str] = None


@router.post("/client/recall-requests", status_code=201)
def create_recall_request(body: RecallRequestIn, ctx: dict = Depends(get_tenant_context)):
    """Cliente: 'Possiamo sentirci quando preferisci'."""
    if (ctx.get("role") or "").lower() != "client":
        raise HTTPException(403, "Solo dal Client Profile")
    tid = ctx["tenant_id"]
    profile_id = ctx["profile_id"]
    c = db()

    # Resolve assignee (referente principale) — best effort.
    assignee_id = None
    try:
        rows = (c.table("human_assignments")
                .select("assignee_user_id")
                .eq("tenant_id", tid)
                .eq("subject_type", "client")
                .eq("subject_id", profile_id)
                .eq("status", "active")
                .limit(1).execute().data or [])
        if rows:
            assignee_id = rows[0].get("assignee_user_id")
    except Exception:
        logger.exception("recall: assignee lookup failed")

    # Resolve account_id via accounts.email == profile email (best effort).
    account_id = None
    try:
        prof = (c.table("users_profile").select("email")
                .eq("id", profile_id).limit(1).execute().data or [])
        if prof and prof[0].get("email"):
            acc = (c.table("accounts").select("id")
                   .eq("tenant_id", tid).ilike("email", prof[0]["email"])
                   .limit(1).execute().data or [])
            if acc:
                account_id = acc[0]["id"]
    except Exception:
        logger.exception("recall: account lookup failed")

    # Resolve thread_id (one per lead/client)
    thread_id = None
    try:
        thr = (c.table("relationship_threads").select("id")
               .eq("tenant_id", tid)
               .eq("client_profile_id", profile_id)
               .limit(1).execute().data or [])
        if thr:
            thread_id = thr[0]["id"]
    except Exception:
        logger.exception("recall: thread lookup failed")

    rid = str(uuid.uuid4())
    now = _now()
    try:
        c.table("recall_requests").insert({
            "id":                 rid,
            "tenant_id":          tid,
            "client_profile_id":  profile_id,
            "account_id":         account_id,
            "journey_id":         body.journey_id,
            "thread_id":          thread_id,
            "assignee_user_id":   assignee_id,
            "status":             "received",
            "preferred_days":     body.preferred_days,
            "preferred_time":     body.preferred_time,
            "preferred_channel":  body.preferred_channel,
            "note":               body.note,
            "created_at":         now,
            "updated_at":         now,
        }).execute()
    except Exception as e:
        logger.exception("recall insert failed")
        raise HTTPException(500, f"recall_requests insert failed: {e}")

    # Post a system message in the thread so the referente vede la richiesta.
    if thread_id:
        try:
            mid = str(uuid.uuid4())
            days = ", ".join(body.preferred_days) if body.preferred_days else "qualsiasi giorno"
            preview = (
                f"Il cliente vorrebbe sentirvi · {days}"
                + (f" · {body.preferred_time}" if body.preferred_time else "")
                + (f" · via {body.preferred_channel}" if body.preferred_channel else "")
            )
            content = preview + (f"\n\n«{body.note}»" if (body.note or "").strip() else "")
            c.table("relationship_messages").insert({
                "id":           mid,
                "tenant_id":    tid,
                "thread_id":    thread_id,
                "sender_type":  "system",
                "sender_label": "Sistema",
                "message_type": "system_narrative",
                "content":      content,
                "metadata":     {"kind": "recall_request", "recall_request_id": rid},
                "created_at":   now,
            }).execute()
            c.table("relationship_threads").update({
                "last_message_at":       now,
                "last_message_preview":  preview[:140],
                "unread_for_designer":   1,
                "updated_at":            now,
            }).eq("id", thread_id).execute()
        except Exception:
            logger.exception("recall: system message insert failed")

    # Internal email to referente (tone relazionale, NO SaaS).
    if assignee_id:
        try:
            from services.email_service import send_template_email
            ref = (c.table("users_profile").select("email,preferred_locale_code,first_name")
                   .eq("id", assignee_id).limit(1).execute().data or [])
            if ref and ref[0].get("email"):
                client_name = "Il cliente"
                try:
                    cn = (c.table("users_profile").select("first_name")
                          .eq("id", profile_id).limit(1).execute().data or [])
                    if cn:
                        client_name = cn[0].get("first_name") or client_name
                except Exception:
                    pass
                send_template_email(
                    to=ref[0]["email"],
                    template_key="generic",
                    context={
                        "eyebrow": "Richiesta di una call",
                        "title":   f"{client_name} vorrebbe sentirvi.",
                        "body":    (
                            f"{client_name} ha lasciato una preferenza nel "
                            "Client Profile. Quando ti è comodo, proponigli "
                            "un momento."
                        ),
                        "cta_label": "Apri la conversazione",
                        "cta_url":   "/relations/accounts",
                        "subject":   f"{client_name} · Richiesta di una call",
                        "preheader": "Lascia che lo studio proponga il momento giusto.",
                    },
                    tenant_id=tid,
                    locale=(ref[0].get("preferred_locale_code") or "it"),
                    user_id=assignee_id,
                    event_type="referente.recall_requested",
                    metadata={"recall_request_id": rid, "thread_id": thread_id},
                )
        except Exception:
            logger.exception("recall: referente email failed")

    return {
        "id":      rid,
        "status":  "received",
        "message": "Richiesta ricevuta. Lo studio ti proporrà un momento.",
    }


@router.get("/client/recall-requests/mine")
def list_my_recall_requests(ctx: dict = Depends(get_tenant_context)):
    if (ctx.get("role") or "").lower() != "client":
        raise HTTPException(403, "Solo dal Client Profile")
    tid = ctx["tenant_id"]
    profile_id = ctx["profile_id"]
    c = db()
    rows = (c.table("recall_requests")
            .select("id,status,preferred_days,preferred_time,preferred_channel,note,created_at")
            .eq("tenant_id", tid).eq("client_profile_id", profile_id)
            .order("created_at", desc=True).limit(10).execute().data or [])
    return {"items": rows}
