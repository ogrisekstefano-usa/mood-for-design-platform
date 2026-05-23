"""Email service · ITER143D · Tenant-Aware Email Orchestration™.

Single entry point for transactional + system emails. Responsibilities:

  • Resolve tenant branding (`tenant_email_settings`) and merge with
    platform defaults.
  • Resolve auth-redirect context from the request origin (so emails
    always link back to the right subdomain — never `www`, never a
    generic platform URL).
  • Render via `email_templates.render(template_key, ctx)`.
  • Deliver via the configured provider:
      - `resend`  → real send via Resend API (async-friendly).
      - `console` → log payload + persist email_events row.
  • Always persist to `email_events` with full audit trail
    (source_domain, template_key, provider_message_id, status, etc.).

Caller never imports the provider directly — always `send_email(...)`.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from database import db
from services.email_templates import render as render_template
from services.auth_redirect import resolve_email_context
from services.tenant_config_resolver import resolve_tenant_config

logger = logging.getLogger(__name__)

EMAIL_PROVIDER = (os.environ.get("EMAIL_PROVIDER") or "console").lower()
DEFAULT_FROM   = os.environ.get("EMAIL_FROM",
                                "MOOD for DESIGN™ <no-reply@mail.moodfordesign.com>")
DEFAULT_REPLY  = os.environ.get("EMAIL_REPLY_TO", "support@moodfordesign.com")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")

# Reserved sender addresses (informational — actual sending uses EMAIL_FROM
# unless `tenant_email_settings.sender_email` is set).
SYSTEM_SENDERS = {
    "admin":     "admin@moodfordesign.com",
    "support":   "support@moodfordesign.com",
    "no_reply":  "no-reply@mail.moodfordesign.com",
}


# ─── Runtime identity resolver (ITER144 · Email Identity Runtime™) ────
# Fallback chain (highest → lowest):
#   1. tenant_configuration.custom_email_identity   (ITER144)
#   2. tenant_email_settings (active row)           (ITER143E)
#   3. platform DEFAULT_FROM / DEFAULT_REPLY        (env)
def resolve_email_identity(tenant_id: Optional[str]) -> Dict[str, Any]:
    """Return the merged identity used to send + brand an email.

    Output shape:
      {
        'source': 'tenant_runtime' | 'tenant_legacy' | 'platform',
        'sender_name','sender_email','reply_to','support_email',
        'logo_url','footer','legal','website',
        'from_address',
      }
    """
    runtime: Dict[str, Any] = {}
    legacy_settings = get_tenant_settings(tenant_id)
    cfg = resolve_tenant_config(tenant_id) if tenant_id else {}
    custom = (cfg or {}).get("custom_email_identity") or {}

    def pick(field: str, *keys: str) -> Optional[str]:
        # 1. tenant_configuration.custom_email_identity
        for k in keys:
            if custom.get(k):
                return custom[k]
        # 2. tenant_email_settings (legacy)
        if legacy_settings:
            for k in keys:
                if legacy_settings.get(k):
                    return legacy_settings[k]
        return None

    runtime["sender_name"]   = pick("sender_name",   "sender_name")
    runtime["sender_email"]  = pick("sender_email",  "sender_email")
    runtime["reply_to"]      = pick("reply_to",      "reply_to", "support_email")
    runtime["support_email"] = pick("support_email", "support_email")
    runtime["logo_url"]      = pick("logo_url",      "logo_url")
    runtime["footer"]        = pick("footer",        "footer_signature", "footer", "email_signature")
    runtime["legal"]         = pick("legal",         "legal_footer", "legal")
    runtime["website"]       = pick("website",       "website")

    # Compose from_address
    if runtime["sender_name"] and runtime["sender_email"]:
        runtime["from_address"] = f'{runtime["sender_name"]} <{runtime["sender_email"]}>'
    elif runtime["sender_email"]:
        runtime["from_address"] = runtime["sender_email"]
    else:
        runtime["from_address"] = DEFAULT_FROM
    if not runtime["reply_to"]:
        runtime["reply_to"] = DEFAULT_REPLY

    # Source attribution (for diagnostics + audit)
    if any(custom.get(k) for k in ("sender_email", "sender_name", "logo_url", "footer")):
        runtime["source"] = "tenant_runtime"
    elif legacy_settings:
        runtime["source"] = "tenant_legacy"
    else:
        runtime["source"] = "platform"
    return runtime


# ─── Tenant settings helper ───────────────────────────────────────────
def get_tenant_settings(tenant_id: Optional[str]) -> Optional[dict]:
    if not tenant_id:
        return None
    try:
        rows = (db().table("tenant_email_settings")
                .select("*").eq("tenant_id", tenant_id)
                .eq("active", True).limit(1).execute().data or [])
        return rows[0] if rows else None
    except Exception as e:
        logger.warning("tenant_email_settings lookup failed: %s", e)
        return None


def _from_address(tenant_settings: Optional[dict]) -> str:
    if tenant_settings:
        s_name  = tenant_settings.get("sender_name")
        s_email = tenant_settings.get("sender_email")
        if s_name and s_email:
            return f"{s_name} <{s_email}>"
        if s_email:
            return s_email
    return DEFAULT_FROM


def _reply_to(tenant_settings: Optional[dict]) -> str:
    if tenant_settings:
        rt = tenant_settings.get("reply_to") or tenant_settings.get("support_email")
        if rt:
            return rt
    return DEFAULT_REPLY


# ─── Event logging ────────────────────────────────────────────────────
def _log_event(*, tenant_id: Optional[str], user_id: Optional[str],
               event_type: str, template_key: str, recipient: str,
               subject: str, status: str, provider: str,
               provider_message_id: Optional[str], source_domain: Optional[str],
               locale: Optional[str], error: Optional[str],
               metadata: Optional[Dict[str, Any]]) -> Optional[str]:
    """Insert a row into email_events. Returns the event id (or None on failure)."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "id":             str(uuid.uuid4()),
            "tenant_id":      tenant_id,
            "user_id":        user_id,
            "event_type":     event_type,
            "template":       template_key,        # legacy column
            "template_key":   template_key,
            "recipient":      recipient,           # legacy column
            "recipient_email": recipient,
            "subject":        subject,
            "status":         status,
            "provider":       provider,
            "provider_id":    provider_message_id, # legacy column
            "provider_message_id": provider_message_id,
            "source_domain":  source_domain,
            "locale":         locale,
            "error":          error,
            "metadata":       metadata or {},
            "created_at":     now,
            "sent_at":        now if status == "sent"   else None,
            "failed_at":      now if status == "failed" else None,
        }
        db().table("email_events").insert(row).execute()
        return row["id"]
    except Exception as e:
        logger.warning("email_events insert failed: %s", e)
        return None


# ─── Provider drivers ─────────────────────────────────────────────────
def _send_resend(*, from_email: str, to: str, reply_to: Optional[str],
                 subject: str, html: str, text: Optional[str]) -> Dict[str, Any]:
    """Synchronous Resend send. Returns {ok, message_id, error}."""
    if not RESEND_API_KEY:
        return {"ok": False, "message_id": None,
                "error": "RESEND_API_KEY missing"}
    try:
        import resend as resend_sdk
        resend_sdk.api_key = RESEND_API_KEY
        params = {
            "from":    from_email,
            "to":      [to],
            "subject": subject,
            "html":    html,
        }
        if text:
            params["text"] = text
        if reply_to:
            params["reply_to"] = reply_to
        r = resend_sdk.Emails.send(params)
        mid = r.get("id") if isinstance(r, dict) else getattr(r, "id", None)
        return {"ok": True, "message_id": mid, "error": None}
    except Exception as e:
        logger.exception("resend send failed: %s", e)
        return {"ok": False, "message_id": None, "error": str(e)[:300]}


# ─── Public API ───────────────────────────────────────────────────────
def send_template_email(
    *,
    to: str,
    template_key: str,
    context: Dict[str, Any],
    event_type: Optional[str] = None,
    tenant_id: Optional[str] = None,
    user_id: Optional[str] = None,
    source_host: Optional[str] = None,
    locale: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Render a template + deliver via the configured provider + audit.

    `context` is augmented automatically with:
      - tenant_settings (looked up from tenant_email_settings)
      - origin (resolve_email_context from source_host)
      - login_url, support_url, origin_url

    Returns {ok, event_id, provider, provider_message_id, error}.
    """
    tenant_settings = get_tenant_settings(tenant_id)
    identity = resolve_email_identity(tenant_id)
    origin = resolve_email_context(source_host or "")
    enriched_ctx = {
        **context,
        "tenant_settings": tenant_settings,
        "tenant_identity": identity,          # ITER144 · Email Identity Runtime™
        "origin":          origin,
        "login_url":       origin["login_url"],
        "support_url":     origin["support_url"],
        "origin_url":      origin["origin_url"],
    }

    try:
        subject, html, text = render_template(template_key, enriched_ctx)
    except Exception as e:
        logger.exception("email template %s render failed", template_key)
        eid = _log_event(tenant_id=tenant_id, user_id=user_id,
                         event_type=event_type or template_key,
                         template_key=template_key, recipient=to,
                         subject="(render failed)", status="failed",
                         provider=EMAIL_PROVIDER, provider_message_id=None,
                         source_domain=origin.get("host"),
                         locale=locale, error=str(e)[:300],
                         metadata=metadata)
        return {"ok": False, "event_id": eid, "provider": EMAIL_PROVIDER,
                "provider_message_id": None, "error": f"render: {e}"}

    from_email = identity["from_address"]
    reply_to   = identity["reply_to"]
    # Identity source becomes part of audit metadata
    audit_meta = {**(metadata or {}), "identity_source": identity["source"]}

    provider = EMAIL_PROVIDER
    if provider == "resend":
        r = _send_resend(from_email=from_email, to=to, reply_to=reply_to,
                         subject=subject, html=html, text=text)
        status = "sent" if r["ok"] else "failed"
        eid = _log_event(tenant_id=tenant_id, user_id=user_id,
                         event_type=event_type or template_key,
                         template_key=template_key, recipient=to,
                         subject=subject, status=status, provider="resend",
                         provider_message_id=r["message_id"],
                         source_domain=origin.get("host"), locale=locale,
                         error=r["error"], metadata=audit_meta)
        return {"ok": r["ok"], "event_id": eid, "provider": "resend",
                "provider_message_id": r["message_id"], "error": r["error"],
                "identity_source": identity["source"]}

    # console fallback — log to stdout, persist as 'sent' so the
    # governance UI shows the audit trail in dev.
    logger.info("[console-email] template=%s from=%s to=%s subject=%s",
                template_key, from_email, to, subject)
    eid = _log_event(tenant_id=tenant_id, user_id=user_id,
                     event_type=event_type or template_key,
                     template_key=template_key, recipient=to,
                     subject=subject, status="sent", provider="console",
                     provider_message_id=None, source_domain=origin.get("host"),
                     locale=locale, error=None, metadata={
                         **audit_meta,
                         "preview": {"subject": subject, "from": from_email,
                                     "to": to, "html_length": len(html)},
                     })
    return {"ok": True, "event_id": eid, "provider": "console",
            "provider_message_id": None, "error": None,
            "identity_source": identity["source"]}


# Back-compat thin wrapper for the few callers still on the old API.
def send_email(*, to: str, subject: str, body_html: Optional[str] = None,
               body_text: Optional[str] = None, template: Optional[str] = None,
               event_type: str = "transactional", tenant_id: Optional[str] = None,
               sender: str = "no_reply",
               metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Legacy entry point. Prefer `send_template_email`."""
    # We map it onto the generic template so even legacy callers get the
    # full audit trail + tenant branding wrap.
    ctx = {"title": subject, "body": body_text or "", "subject": subject}
    return send_template_email(
        to=to, template_key=template or "generic", context=ctx,
        event_type=event_type, tenant_id=tenant_id,
        source_host=None, locale=None, metadata=metadata,
    )
