"""Email service abstraction — ITER142 SaaS Foundation™

Single entry point for all transactional + invitation emails.

Providers (chosen at runtime via env `EMAIL_PROVIDER`):
  • `supabase`  — uses Supabase Auth invite (already wired in members.py).
                  Free, works out of the box, but limited to invite flows.
  • `resend`    — production-grade transactional email (TODO P1).
  • `sendgrid`  — alternative provider (TODO P1).
  • `console`   — DEV default: logs the payload, marks event as sent.

Every send is logged to `email_events` so we can audit deliverability.

Caller never imports the provider directly — always use `send_email()`.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from database import db

logger = logging.getLogger(__name__)

DEFAULT_FROM = os.environ.get("EMAIL_FROM", "MOOD for DESIGN™ <no-reply@moodfordesign.com>")
EMAIL_PROVIDER = (os.environ.get("EMAIL_PROVIDER") or "console").lower()

# Reserved sender addresses (informational — actual sending uses EMAIL_FROM)
SYSTEM_SENDERS = {
    "admin":     "admin@moodfordesign.com",
    "support":   "support@moodfordesign.com",
    "no_reply":  "no-reply@moodfordesign.com",
}


def _log_event(tenant_id: Optional[str], event_type: str, recipient: str,
               subject: Optional[str], template: Optional[str],
               status: str, provider: str,
               provider_id: Optional[str] = None,
               error: Optional[str] = None,
               metadata: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """Persist to email_events. Returns the event id."""
    try:
        c = db()
        row = {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "event_type": event_type,
            "recipient": recipient,
            "subject": subject,
            "template": template,
            "status": status,
            "provider": provider,
            "provider_id": provider_id,
            "error": error,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "sent_at": datetime.now(timezone.utc).isoformat() if status == "sent" else None,
        }
        c.table("email_events").insert(row).execute()
        return row["id"]
    except Exception as e:
        logger.warning("email_events insert failed: %s", e)
        return None


def send_email(
    *,
    to: str,
    subject: str,
    body_html: Optional[str] = None,
    body_text: Optional[str] = None,
    template: Optional[str] = None,
    event_type: str = "transactional",
    tenant_id: Optional[str] = None,
    sender: str = "no_reply",
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Send an email via the configured provider. Always logs to email_events.

    Returns:
      `{ok: bool, event_id: str, provider: str, error: str|None}`

    DEV NOTE: When EMAIL_PROVIDER='console' (default), this only logs to
    stdout — useful for previews. Production deploys MUST set
    EMAIL_PROVIDER=resend|supabase + the corresponding API creds.
    """
    from_email = SYSTEM_SENDERS.get(sender, DEFAULT_FROM)
    provider = EMAIL_PROVIDER

    if provider == "console":
        logger.info("[console-email] type=%s from=%s to=%s subject=%s",
                    event_type, from_email, to, subject)
        if body_text:
            logger.info("[console-email] body:\n%s", body_text[:500])
        eid = _log_event(tenant_id, event_type, to, subject, template,
                         "sent", provider="console",
                         metadata={"sender": sender, **(metadata or {})})
        return {"ok": True, "event_id": eid, "provider": "console", "error": None}

    if provider == "supabase":
        # Supabase Auth invite is the only built-in email channel here. For
        # anything other than 'invitation' events we degrade to console and
        # surface a warning so the deployer wires Resend/SendGrid.
        if event_type != "invitation":
            logger.warning("EMAIL_PROVIDER=supabase but event_type=%s — "
                           "only invitations are supported. Falling back to console.",
                           event_type)
            eid = _log_event(tenant_id, event_type, to, subject, template,
                             "queued", provider="supabase",
                             error="provider does not support non-invitation events",
                             metadata=metadata or {})
            return {"ok": False, "event_id": eid, "provider": "supabase",
                    "error": "provider does not support non-invitation events"}
        # The actual invite send is handled by members.py via Supabase Auth.
        eid = _log_event(tenant_id, event_type, to, subject, template,
                         "sent", provider="supabase",
                         metadata=metadata or {})
        return {"ok": True, "event_id": eid, "provider": "supabase", "error": None}

    # P1 — wire real provider here (Resend / SendGrid). Until then, log
    # and fail soft so the rest of the app keeps running.
    logger.warning("EMAIL_PROVIDER=%s not yet wired. Event queued only.", provider)
    eid = _log_event(tenant_id, event_type, to, subject, template,
                     "queued", provider=provider,
                     error="provider not implemented",
                     metadata=metadata or {})
    return {"ok": False, "event_id": eid, "provider": provider,
            "error": f"{provider} provider not implemented"}
