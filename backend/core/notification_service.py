"""Notification service — Phase S.2.

Provider abstraction:
  * `db` (active): row inserted in `notifications` table.
  * `email_future`: stub for future SendGrid/Resend wiring.

The rest of the codebase should ONLY interact with `notify(...)` so
adding providers later is a one-file change.
"""
from typing import Optional
from datetime import datetime, timezone
import logging
import uuid
from database import db

log = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def notify(
    tenant_id: str,
    recipient_user_id: str,
    event_type: str,
    title: str,
    body: Optional[str] = None,
    href: Optional[str] = None,
    project_id: Optional[str] = None,
) -> Optional[str]:
    """Insert a notification row for `recipient_user_id` in `tenant_id`.

    Returns the new row id, or None on failure (failures are logged
    but never crash callers — notifications are best-effort).
    """
    try:
        c = db()
        nid = str(uuid.uuid4())
        c.table("notifications").insert({
            "id": nid,
            "tenant_id": tenant_id,
            "user_id": recipient_user_id,
            "project_id": project_id,
            "type": event_type,
            "title": title,
            "message": body or "",
            "created_at": _now(),
        }).execute()
        log.info("notification.created tenant=%s recipient=%s type=%s",
                 tenant_id, recipient_user_id, event_type)
        return nid
    except Exception as e:  # pragma: no cover — best-effort
        log.warning("notification.failed type=%s err=%s", event_type, e)
        return None


def list_for_user(tenant_id: str, user_id: str, unread_only: bool = False, limit: int = 30):
    c = db()
    q = (c.table("notifications").select("*")
         .eq("tenant_id", tenant_id).eq("user_id", user_id))
    if unread_only:
        q = q.is_("read_at", "null")
    return q.order("created_at", desc=True).limit(limit).execute().data or []


def mark_read(tenant_id: str, user_id: str, notification_id: str) -> bool:
    c = db()
    r = (c.table("notifications").update({"read_at": _now()})
         .eq("id", notification_id).eq("tenant_id", tenant_id)
         .eq("user_id", user_id).execute())
    return bool(r.data)
