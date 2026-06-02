"""ITER143E+ · Email webhook ingestion (Resend) + retry queue + search.

Endpoints
─────────
  POST /api/email/webhook/resend     PUBLIC (HMAC-signed)
       Ingests Resend webhook events: email.sent, email.delivered,
       email.opened, email.clicked, email.bounced, email.delivery_delayed,
       email.complained.

  POST /api/blueprint-admin/email-events/{id}/retry    ROOT
       Re-queues a failed event (re-renders the original template + delivers).

  GET  /api/blueprint-admin/email-events/search?q=…    ROOT
       Free-text + structured search over email_events.

Signature verification
──────────────────────
Resend webhooks use SVix-style HMAC-SHA256. The secret lives in env as
`RESEND_WEBHOOK_SECRET`. In dev (no secret set) the endpoint accepts the
payload without verification but logs a clear warning.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from database import db, db_available
from middleware.auth import require_root_superadmin

log = logging.getLogger(__name__)
router = APIRouter()


RESEND_WEBHOOK_SECRET = os.environ.get("RESEND_WEBHOOK_SECRET", "")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Resend webhook ──────────────────────────────────────────────────
def _verify_svix(headers: Dict[str, str], body: bytes) -> bool:
    """Verify Svix/Standard-Webhooks signature.

    Required headers (Resend uses standard-webhooks):
      svix-id, svix-timestamp, svix-signature  (or webhook-* prefix)
    """
    if not RESEND_WEBHOOK_SECRET:
        log.warning("RESEND_WEBHOOK_SECRET not set — accepting unsigned payload")
        return True
    msg_id  = headers.get("svix-id") or headers.get("webhook-id") or ""
    ts      = headers.get("svix-timestamp") or headers.get("webhook-timestamp") or ""
    sig_hdr = headers.get("svix-signature") or headers.get("webhook-signature") or ""
    if not (msg_id and ts and sig_hdr):
        return False
    # Standard-Webhooks format: "v1,base64sig v1,base64sig2 …"
    signed = f"{msg_id}.{ts}.".encode() + body
    secret = RESEND_WEBHOOK_SECRET
    if secret.startswith("whsec_"):
        secret = secret[len("whsec_"):]
    try:
        key = base64.b64decode(secret)
    except Exception:
        key = secret.encode()
    expected = base64.b64encode(
        hmac.new(key, signed, hashlib.sha256).digest()
    ).decode()
    for part in sig_hdr.split():
        # parts look like "v1,XXXX"
        if "," in part:
            _, val = part.split(",", 1)
            if hmac.compare_digest(val, expected):
                return True
    return False


_EVENT_TO_TS = {
    "email.sent":              ("sent",      "sent_at"),
    "email.delivered":         ("sent",      "sent_at"),       # final delivered
    "email.opened":            ("sent",      "opened_at"),
    "email.clicked":           ("sent",      "clicked_at"),
    "email.bounced":           ("bounced",   "bounced_at"),
    "email.complained":        ("bounced",   "bounced_at"),
    "email.delivery_delayed":  ("queued",    None),
    "email.failed":            ("failed",    "failed_at"),
}


@router.post("/webhook/resend")
async def resend_webhook(request: Request):
    body = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}
    if not _verify_svix(headers, body):
        raise HTTPException(401, "invalid webhook signature")
    try:
        import json
        payload = json.loads(body or b"{}")
    except Exception:
        raise HTTPException(400, "invalid json")

    event_type = (payload.get("type") or "").lower()
    data = payload.get("data") or {}
    message_id = data.get("email_id") or data.get("id")
    if not message_id:
        return {"ok": True, "ignored": "no_message_id"}

    if not db_available():
        return {"ok": True, "ignored": "db_unavailable"}
    c = db()
    rows = (c.table("email_events").select("id, metadata")
            .eq("provider_message_id", message_id).limit(1).execute().data or [])
    if not rows:
        # Some accounts send 'delivered' before our app finishes its insert
        # — record an orphan row so the UI sees it.
        c.table("email_events").insert({
            "provider_message_id": message_id,
            "provider":            "resend",
            "event_type":          event_type,
            "status":              "sent",
            "recipient":           data.get("to") or "(unknown)",
            "recipient_email":     data.get("to") or "(unknown)",
            "metadata":            {"orphan_webhook": True, "payload": data},
            "created_at":          _now(),
            "updated_at":          _now(),
        }).execute()
        return {"ok": True, "orphan": True, "message_id": message_id}

    eid = rows[0]["id"]
    meta = rows[0].get("metadata") or {}
    new_status, ts_field = _EVENT_TO_TS.get(event_type, (None, None))
    upd: Dict[str, Any] = {
        "updated_at": _now(),
        "metadata":  {**meta, "last_webhook": event_type,
                      "last_webhook_at": _now()},
    }
    if new_status:
        upd["status"] = new_status
    if ts_field:
        upd[ts_field] = _now()
    if event_type == "email.bounced":
        upd["bounce_reason"] = (data.get("bounce") or {}).get("subType") \
                               or (data.get("reason") or "")[:240]
    if event_type == "email.failed":
        upd["error"] = (data.get("reason") or "")[:240]
    c.table("email_events").update(upd).eq("id", eid).execute()
    return {"ok": True, "event_id": eid, "applied": event_type}


# ─── Retry / Requeue ──────────────────────────────────────────────────
@router.post("/admin/email-events/{event_id}/retry")
def retry_event(event_id: str, user: dict = Depends(require_root_superadmin)):
    from services.email_service import send_template_email
    if not db_available():
        raise HTTPException(503, "database unavailable")
    rows = (db().table("email_events").select("*").eq("id", event_id)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "event not found")
    e = rows[0]
    meta = e.get("metadata") or {}
    ctx = (meta.get("preview") or {}).get("context") or {}
    # Reconstruct the minimum needed context so the template doesn't crash.
    ctx.setdefault("title", e.get("subject") or "MOOD for DESIGN™")
    ctx.setdefault("body", "Retry of a previous email.")
    ctx.setdefault("subject", e.get("subject") or "MOOD for DESIGN™")
    ctx.setdefault("reset_url", meta.get("reset_url", ""))
    ctx.setdefault("accept_url", meta.get("accept_url", ""))
    r = send_template_email(
        to=e.get("recipient_email") or e.get("recipient"),
        template_key=e.get("template_key") or e.get("template") or "generic",
        context=ctx,
        event_type=f"retry.{e.get('event_type') or 'unknown'}",
        tenant_id=e.get("tenant_id"),
        user_id=user.get("profile_id"),
        source_host=e.get("source_domain"),
        locale=e.get("locale"),
        metadata={"retry_of": event_id, "initiated_by": user.get("email")},
    )
    return {"retried": True, "original_event_id": event_id, **r}


# ─── Search ───────────────────────────────────────────────────────────
@router.get("/admin/email-events/search")
def search_events(
    user: dict = Depends(require_root_superadmin),
    q: Optional[str] = Query(None),
    tenant_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    provider: Optional[str] = Query(None),
    provider_message_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
):
    if not db_available():
        return {"events": [], "count": 0}
    c = db()
    builder = (c.table("email_events")
               .select("id, tenant_id, user_id, event_type, template_key, "
                       "recipient_email, recipient, subject, status, provider, "
                       "provider_message_id, source_domain, locale, error, "
                       "opened_at, clicked_at, bounced_at, failed_at, created_at")
               .order("created_at", desc=True).limit(limit))
    if tenant_id:
        builder = builder.eq("tenant_id", tenant_id)
    if user_id:
        builder = builder.eq("user_id", user_id)
    if event_type:
        builder = builder.eq("event_type", event_type)
    if status:
        builder = builder.eq("status", status)
    if provider:
        builder = builder.eq("provider", provider)
    if provider_message_id:
        builder = builder.eq("provider_message_id", provider_message_id)
    if q:
        # PostgREST OR — search recipient + subject + provider_message_id
        like = f"%{q}%"
        builder = builder.or_(
            f"recipient_email.ilike.{like},"
            f"recipient.ilike.{like},"
            f"subject.ilike.{like},"
            f"provider_message_id.ilike.{like}"
        )
    rows = builder.execute().data or []
    return {"events": rows, "count": len(rows), "query": {
        "q": q, "tenant_id": tenant_id, "event_type": event_type,
        "status": status, "provider": provider,
    }}


# ─── Provider health ─────────────────────────────────────────────────
@router.get("/admin/email-provider-health")
def provider_health(user: dict = Depends(require_root_superadmin)):
    """Return delivery score per tenant + per provider over the last 200 events."""
    if not db_available():
        return {"providers": {}, "tenants": {}}
    c = db()
    rows = (c.table("email_events")
            .select("provider, status, tenant_id")
            .order("created_at", desc=True).limit(200).execute().data or [])
    providers: Dict[str, Dict[str, int]] = {}
    tenants:   Dict[str, Dict[str, int]] = {}
    for r in rows:
        p = r.get("provider") or "unknown"
        t = r.get("tenant_id") or "platform"
        st = r.get("status") or "unknown"
        providers.setdefault(p, {"sent": 0, "failed": 0, "bounced": 0,
                                  "queued": 0, "total": 0})
        providers[p]["total"] += 1
        if st in providers[p]:
            providers[p][st] += 1
        tenants.setdefault(t, {"sent": 0, "failed": 0, "bounced": 0,
                                "queued": 0, "total": 0})
        tenants[t]["total"] += 1
        if st in tenants[t]:
            tenants[t][st] += 1
    # Delivery score: sent / total
    for p, s in providers.items():
        s["delivery_score"] = round(100 * s["sent"] / s["total"]) if s["total"] else 100
    for t, s in tenants.items():
        s["delivery_score"] = round(100 * s["sent"] / s["total"]) if s["total"] else 100
    return {"providers": providers, "tenants": tenants, "sample_size": len(rows)}


# ─── ITER186.A · P0.1 — Email Smoke Test ─────────────────────────────
# Real end-to-end deliverability validation. Founder/admin can ping
# this endpoint with a target recipient to verify:
#   - RESEND_API_KEY is valid
#   - Sender domain is configured (DKIM/SPF expected to be set on
#     mail.moodfordesign.com)
#   - Resend accepts the message and returns a provider_message_id
#   - Audit trail is persisted in email_events
#
# This is a synchronous send. The caller is then expected to verify
# the inbox / spam folder / link click manually (no automated click
# verification from the container).
@router.post("/admin/email-smoke-test")
def email_smoke_test(
    payload: Dict[str, Any] = None,
    user: dict = Depends(require_root_superadmin),
):
    """POST /api/email/admin/email-smoke-test
    Body: { "to": "tester@gmail.com" }

    Returns:
      {
        ok: bool,
        provider: "resend",
        provider_message_id: "…",
        event_id: "…",
        identity_source: "platform_default" | "tenant_settings" | …,
        env: {
          provider: "resend",
          api_key_present: true,
          from_address: "MOOD for DESIGN™ <no-reply@mail.moodfordesign.com>",
          reply_to: "support@moodfordesign.com"
        },
        next_steps: [...checklist for manual verification...]
      }
    """
    from services.email_service import (
        send_template_email,
        EMAIL_PROVIDER, RESEND_API_KEY, DEFAULT_FROM, DEFAULT_REPLY,
    )
    payload = payload or {}
    to = (payload.get("to") or "").strip()
    if not to or "@" not in to:
        raise HTTPException(400, "Recipient email required (field: to).")

    env_audit = {
        "provider": EMAIL_PROVIDER,
        "api_key_present": bool(RESEND_API_KEY),
        "from_address": DEFAULT_FROM,
        "reply_to": DEFAULT_REPLY,
    }
    if EMAIL_PROVIDER == "resend" and not RESEND_API_KEY:
        return {
            "ok": False,
            "env": env_audit,
            "error": "RESEND_API_KEY missing — set it in backend/.env and restart.",
            "next_steps": [
                "Aggiungi RESEND_API_KEY a /app/backend/.env",
                "sudo supervisorctl restart backend",
                "Riprova questo endpoint",
            ],
        }

    ctx = {
        "title": "MOOD for DESIGN™ · Smoke Test Email",
        "body": (
            "Questo è un test di consegna inviato dall'admin endpoint "
            "/api/email/admin/email-smoke-test. Se ricevi questa email, "
            "Resend è configurato correttamente e i parametri DKIM/SPF "
            "del dominio mittente stanno funzionando. Verifica anche "
            "che NON sia finita nella cartella spam."
        ),
        "subject": "MOOD for DESIGN™ · Smoke Test Email",
        "preview": "Test di consegna · ITER186.A · P0.1",
    }
    r = send_template_email(
        to=to,
        template_key="generic",
        context=ctx,
        event_type="smoke_test",
        tenant_id=None,
        user_id=user.get("profile_id"),
        source_host=None,
        locale="it",
        metadata={
            "iter": "ITER186.A",
            "category": "smoke_test",
            "initiated_by": user.get("email"),
        },
    )
    next_steps = [
        f"Apri la mailbox di {to} e verifica che l'email sia arrivata.",
        "Controlla anche la cartella Spam/Junk.",
        "Apri Resend Dashboard → Logs e verifica lo stato della consegna.",
        "Verifica DKIM/SPF su MXToolbox per mail.moodfordesign.com.",
        "Verifica che il sender appaia come MOOD for DESIGN™.",
    ]
    return {**r, "env": env_audit, "next_steps": next_steps, "to": to}
