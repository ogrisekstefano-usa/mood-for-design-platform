"""Notification publisher · M4 Internal Notification Center
=====================================================================

Single entrypoint used by routers/services to emit notifications to
``relationship_notifications`` (canonical M4 source).

Highlights
----------
* Catalog-driven: ``category_key`` must exist in ``notification_categories``.
* Deep link is resolved from ``deep_link_template`` using ``payload`` keys;
  missing placeholders → ``fallback_link``.
* Per-user opt-out via ``notification_preferences``.
* Best-effort: never raises, always logs.
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, Optional

from database import db

logger = logging.getLogger(__name__)

_PLACEHOLDER_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@lru_cache(maxsize=256)
def _get_category(category_key: str) -> Optional[Dict[str, Any]]:
    """Fetch a category row from the catalog (cached for the process lifetime).

    Returns ``None`` if the key is unknown — callers should treat that as
    a programmer error but the publisher remains best-effort.
    """
    try:
        c = db()
        r = (c.table("notification_categories").select("*")
             .eq("key", category_key).limit(1).execute())
        rows = r.data or []
        return rows[0] if rows else None
    except Exception as e:  # pragma: no cover
        logger.warning("notif.catalog_lookup_failed key=%s err=%s", category_key, e)
        return None


def reset_catalog_cache() -> None:
    """Drop the in-process catalog cache (use after edits)."""
    _get_category.cache_clear()


def _resolve_link(category: Dict[str, Any], payload: Dict[str, Any]) -> Optional[str]:
    """Substitute ``{placeholder}`` in ``deep_link_template`` using ``payload``.

    If any placeholder is missing/empty, returns ``fallback_link`` (or None).
    """
    tpl = category.get("deep_link_template") or ""
    if not tpl:
        return category.get("fallback_link") or None

    missing = False

    def _sub(m: re.Match) -> str:
        nonlocal missing
        key = m.group(1)
        val = payload.get(key)
        if val in (None, ""):
            missing = True
            return ""
        return str(val)

    url = _PLACEHOLDER_RE.sub(_sub, tpl)
    if missing:
        return category.get("fallback_link") or None
    return url


def _is_disabled(tenant_id: str, user_id: str, category_key: str) -> bool:
    """Return True if the user explicitly disabled this category."""
    try:
        c = db()
        r = (c.table("notification_preferences")
             .select("in_app_enabled")
             .eq("tenant_id", tenant_id)
             .eq("user_id", user_id)
             .eq("category_key", category_key)
             .limit(1).execute())
        rows = r.data or []
        if not rows:
            return False  # default = enabled
        return not bool(rows[0].get("in_app_enabled", True))
    except Exception as e:  # pragma: no cover
        logger.warning("notif.pref_lookup_failed err=%s", e)
        return False


def publish(
    *,
    tenant_id: str,
    recipient_user_id: str,
    category_key: str,
    narrative: Optional[str] = None,
    title: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    priority: Optional[str] = None,
    sender_user_id: Optional[str] = None,
    sender_type: Optional[str] = None,
    recipient_type: str = "designer",
    lead_id: Optional[str] = None,
    deep_link_url: Optional[str] = None,
) -> Optional[str]:
    """Insert a single notification row.

    Returns the new row id, or ``None`` if skipped/failed.
    """
    payload = payload or {}

    if not tenant_id or not recipient_user_id or not category_key:
        logger.warning("notif.skip missing_required tenant=%s user=%s cat=%s",
                       tenant_id, recipient_user_id, category_key)
        return None

    category = _get_category(category_key)
    if not category:
        logger.warning("notif.skip unknown_category key=%s", category_key)
        return None

    if _is_disabled(tenant_id, recipient_user_id, category_key):
        logger.info("notif.skip user_opt_out user=%s cat=%s",
                    recipient_user_id, category_key)
        return None

    link = deep_link_url or _resolve_link(category, payload)
    prio = priority or category.get("default_priority") or "normal"

    nid = str(uuid.uuid4())
    row = {
        "id":                 nid,
        "tenant_id":          tenant_id,
        "lead_id":            lead_id,
        "recipient_user_id":  recipient_user_id,
        "recipient_type":     recipient_type,
        "sender_user_id":     sender_user_id,
        "sender_type":        sender_type,
        "notification_type":  category_key,
        "category_key":       category_key,
        "title":              title,
        "narrative":          narrative,
        "payload":            payload,
        "priority":           prio,
        "action_url":         link,
        "deep_link_url":      link,
        "created_at":         _iso(),
    }
    # Trim None values – Supabase rejects nulls on some columns
    row = {k: v for k, v in row.items() if v is not None}

    try:
        c = db()
        c.table("relationship_notifications").insert(row).execute()
        logger.info("notif.created cat=%s user=%s id=%s prio=%s",
                    category_key, recipient_user_id, nid, prio)
        return nid
    except Exception as e:
        logger.warning("notif.insert_failed cat=%s err=%s", category_key, e)
        return None


def publish_many(
    *,
    tenant_id: str,
    recipient_user_ids: list,
    category_key: str,
    **kwargs,
) -> int:
    """Convenience fan-out helper. Returns count of successful inserts."""
    ok = 0
    for uid in recipient_user_ids or []:
        rid = publish(tenant_id=tenant_id, recipient_user_id=uid,
                      category_key=category_key, **kwargs)
        if rid:
            ok += 1
    return ok
