"""Notification Center service (M4).

Central canonical notify() orchestrator + reader for the bell drawer.

Design principles
-----------------
* DB-driven: all labels/icons/colors come from `platform_notification_types`.
  NO hardcoded UI strings in this service.
* Structured: every notification row carries typed FK to tenant_id, contact_id,
  activity_id, advisor_user_id, lead_id (where available) so downstream M5
  KPIs and digest workers can consume notifications as data, not text.
* Idempotent: every caller supplies a deterministic `dedup_key`. The DB
  enforces uniqueness via `uq_notif_dedup` partial index.
* Future-ready: preferences carry in_app + email + push, but only in_app
  is honoured in M4. Email & push are stored disabled by default.

Public surface used by hooks and routers
----------------------------------------
* notify(...)              — create N rows, one per resolved recipient.
* list_for_user(...)       — paginated reader for the drawer.
* unread_count(...)        — fast badge counter with critical flag.
* mark_read(...)           — single / bulk / all.
* archive(...)             — hide from drawer (kept for audit).
* get_preferences / set_preferences — per-user opt-in/out matrix.
* list_categories()        — catalog reader.
"""
from __future__ import annotations
from typing import Optional, Literal, Iterable
from uuid import UUID
from datetime import datetime
import base64
import json
import re

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


# ─── cursor helpers (consistent with timeline.py / activities.py) ──────────

def _encode_cursor(at: datetime, ident: str) -> str:
    raw = json.dumps({"at": at.isoformat(), "id": str(ident)}, separators=(",", ":"))
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cursor: Optional[str]) -> Optional[dict]:
    if not cursor:
        return None
    try:
        return json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
    except Exception:
        return None


# ─── template rendering ────────────────────────────────────────────────────

_TPL_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


def _render(template: str, payload: dict) -> str:
    """Replace {{var}} tokens with payload values (str). Missing → empty."""
    def repl(m):
        key = m.group(1)
        v = payload.get(key)
        return str(v) if v is not None else ""
    return _TPL_RE.sub(repl, template or "")


# ─── deep-link generation ──────────────────────────────────────────────────
#
# Per recipient_type ∈ {admin, advisor, owner} and type_code, build the
# best in-app URL. For advisor we route to /workspace/* (M5) when known;
# until M5 ships, frontend will gracefully fall back to /command-center/*
# for users who don't yet have /workspace/ rendered.

def _build_action_url(
    *,
    type_code: str,
    recipient_role: Literal["admin", "advisor", "owner", "editor"],
    tenant_id: Optional[UUID],
    contact_id: Optional[UUID],
    activity_id: Optional[UUID],
    lead_id: Optional[UUID],
) -> Optional[str]:
    tid = str(tenant_id) if tenant_id else None
    cid = str(contact_id) if contact_id else None
    aid = str(activity_id) if activity_id else None
    lid = str(lead_id) if lead_id else None

    if type_code in ("studio_request_received", "lead_awaiting_review"):
        if recipient_role == "advisor":
            return f"/workspace/introductions?id={lid}" if lid else "/workspace/introductions"
        return f"/command-center/studio-requests?id={lid}" if lid else "/command-center/studio-requests"

    if type_code == "tenant_activated":
        if recipient_role == "advisor":
            return f"/workspace/studios/{tid}" if tid else "/workspace/studios"
        if recipient_role == "owner":
            return "/blueprint/overview"
        return f"/command-center/tenants/{tid}" if tid else "/command-center/tenants"

    if type_code == "workspace_first_access":
        if recipient_role == "advisor":
            return f"/workspace/studios/{tid}" if tid else "/workspace/studios"
        return f"/command-center/tenants/{tid}" if tid else "/command-center/tenants"

    if type_code == "advisor_assigned":
        return f"/workspace/studios/{tid}" if tid else "/workspace/dashboard"

    if type_code == "activity_assigned":
        if aid and tid:
            return f"/workspace/studios/{tid}?tab=activities&activity={aid}"
        return f"/workspace/studios/{tid}" if tid else "/workspace/activities"

    if type_code == "followup_overdue":
        if recipient_role == "advisor":
            return f"/workspace/follow-ups?activity={aid}" if aid else "/workspace/follow-ups"
        return (f"/command-center/tenants/{tid}?tab=activities&activity={aid}"
                if tid and aid else f"/command-center/tenants/{tid}" if tid else None)

    if type_code == "new_contact":
        if recipient_role == "owner":
            return f"/blueprint/overview?tab=contacts&contact={cid}" if cid else "/blueprint/overview?tab=contacts"
        if recipient_role == "advisor":
            return f"/workspace/studios/{tid}?tab=contacts&contact={cid}" if (tid and cid) else (
                   f"/workspace/studios/{tid}?tab=contacts" if tid else "/workspace/studios")
        return f"/command-center/tenants/{tid}?tab=contacts" if tid else None

    if type_code == "new_activity":
        if recipient_role == "advisor":
            return (f"/workspace/studios/{tid}?tab=activities&activity={aid}"
                    if tid and aid else f"/workspace/studios/{tid}" if tid else None)
        return (f"/command-center/tenants/{tid}?tab=activities&activity={aid}"
                if tid and aid else f"/command-center/tenants/{tid}" if tid else None)

    return None


# ─── recipient resolution ──────────────────────────────────────────────────

async def _all_admin_user_ids(s: AsyncSession) -> set[UUID]:
    rows = (await s.execute(text(
        "SELECT id FROM users WHERE role='admin' AND deleted_at IS NULL"
    ))).fetchall()
    return {r[0] for r in rows}


async def _advisors_for_tenant(s: AsyncSession, tenant_id: UUID) -> set[UUID]:
    """Owner of the tenant relationship + any explicitly-assigned advisor.

    Today the only stored advisor on a tenant is `tenant_relationship_owner_user_id`
    (from M1 migration 032). When M5 introduces advisor_studio_assignments we'll
    extend this query. Until then, this is the single source of truth.
    """
    rows = (await s.execute(text("""
        SELECT tenant_relationship_owner_user_id
          FROM tenants
         WHERE id = CAST(:tid AS uuid)
           AND tenant_relationship_owner_user_id IS NOT NULL
    """), {"tid": str(tenant_id)})).fetchall()
    return {r[0] for r in rows if r[0] is not None}


async def _owners_for_tenant(s: AsyncSession, tenant_id: UUID) -> set[UUID]:
    rows = (await s.execute(text("""
        SELECT u.id
          FROM users u
         WHERE u.tenant_id = CAST(:tid AS uuid)
           AND u.role = 'owner'
           AND u.deleted_at IS NULL
    """), {"tid": str(tenant_id)})).fetchall()
    return {r[0] for r in rows}


async def _filter_by_preferences(
    s: AsyncSession, *, user_ids: set[UUID], type_code: str,
) -> set[UUID]:
    """Drop users who explicitly opted-out of in_app for this type.
    Absence of a row = default enabled (in_app=TRUE)."""
    if not user_ids:
        return user_ids
    rows = (await s.execute(text("""
        SELECT user_id
          FROM relationship_notification_preferences
         WHERE notification_type = :t
           AND user_id = ANY(CAST(:ids AS uuid[]))
           AND in_app_enabled = FALSE
    """), {"t": type_code, "ids": [str(u) for u in user_ids]})).fetchall()
    opted_out = {r[0] for r in rows}
    return user_ids - opted_out


async def _resolve_role(s: AsyncSession, user_id: UUID) -> str:
    r = (await s.execute(text(
        "SELECT role FROM users WHERE id = CAST(:u AS uuid)"
    ), {"u": str(user_id)})).fetchone()
    return r[0] if r else "owner"


# ─── core notify() ─────────────────────────────────────────────────────────

async def notify(
    s: AsyncSession,
    *,
    type_code: str,
    tenant_id: Optional[UUID] = None,
    payload: Optional[dict] = None,
    sender_user_id: Optional[UUID] = None,
    contact_id: Optional[UUID] = None,
    activity_id: Optional[UUID] = None,
    advisor_user_id: Optional[UUID] = None,
    lead_id: Optional[UUID] = None,
    explicit_recipients: Optional[Iterable[UUID]] = None,
    dedup_key: Optional[str] = None,
    priority_override: Optional[str] = None,
    source_event_type: Optional[str] = None,
    source_event_id: Optional[UUID] = None,
    title_override: Optional[str] = None,
    action_url_override: Optional[str] = None,
    action_label_override: Optional[str] = None,
) -> list[UUID]:
    """Fan-out a notification of `type_code` to all resolved recipients.

    Returns the list of newly-created `relationship_notifications.id`.
    Duplicate inserts (same dedup_key for same recipient) are skipped silently.
    """
    payload = payload or {}

    # 1) Load catalog row
    type_row = (await s.execute(text("""
        SELECT code, label_it, label_en, narrative_template, icon, color,
               category, default_priority,
               notify_admin, notify_advisor, notify_owner, notify_actor,
               is_active
          FROM platform_notification_types
         WHERE code = :c
    """), {"c": type_code})).mappings().first()

    if type_row is None:
        raise ValueError(f"Unknown notification type_code: {type_code}")
    if not type_row["is_active"]:
        return []

    # 2) Resolve recipients
    if explicit_recipients is not None:
        recipients = {UUID(str(u)) for u in explicit_recipients}
    else:
        recipients = set()
        if type_row["notify_admin"]:
            recipients |= await _all_admin_user_ids(s)
        if type_row["notify_advisor"] and tenant_id is not None:
            recipients |= await _advisors_for_tenant(s, tenant_id)
        if type_row["notify_owner"] and tenant_id is not None:
            recipients |= await _owners_for_tenant(s, tenant_id)

    # 3) Drop the actor unless echo is explicitly requested
    if not type_row["notify_actor"] and sender_user_id:
        recipients.discard(UUID(str(sender_user_id)))

    if not recipients:
        return []

    # 4) Filter by user preferences (in_app opt-out)
    recipients = await _filter_by_preferences(
        s, user_ids=recipients, type_code=type_code,
    )
    if not recipients:
        return []

    # 5) Render narrative + resolve priority
    narrative = _render(type_row["narrative_template"], payload)
    title     = title_override or type_row["label_it"]
    priority  = priority_override or type_row["default_priority"]

    # 6) Insert one row per recipient with role-aware action_url
    created_ids: list[UUID] = []
    for rid in recipients:
        role = await _resolve_role(s, rid)
        if action_url_override is not None:
            url = action_url_override
        else:
            url = _build_action_url(
                type_code=type_code, recipient_role=role,  # type: ignore[arg-type]
                tenant_id=tenant_id, contact_id=contact_id,
                activity_id=activity_id, lead_id=lead_id,
            )

        try:
            res = await s.execute(text("""
                INSERT INTO relationship_notifications (
                    tenant_id, lead_id, recipient_user_id, recipient_type,
                    sender_user_id, sender_type,
                    notification_type, notification_type_code,
                    title, narrative, payload, priority,
                    contact_id, activity_id, advisor_user_id,
                    source_event_type, source_event_id, dedup_key,
                    action_url, action_label
                ) VALUES (
                    CAST(:tid AS uuid), CAST(:lid AS uuid),
                    CAST(:rid AS uuid), :rtype,
                    CAST(:sid AS uuid), :stype,
                    :ntype, :ntcode,
                    :title, :narr, CAST(:payload AS jsonb), :prio,
                    CAST(:cid AS uuid), CAST(:aid AS uuid), CAST(:advid AS uuid),
                    :setype, CAST(:seid AS uuid), :ddk,
                    :url, :alabel
                )
                ON CONFLICT (recipient_user_id, dedup_key) WHERE dedup_key IS NOT NULL
                DO NOTHING
                RETURNING id
            """), {
                "tid": str(tenant_id) if tenant_id else None,
                "lid": str(lead_id) if lead_id else None,
                "rid": str(rid),
                "rtype": role,
                "sid": str(sender_user_id) if sender_user_id else None,
                "stype": ("user" if sender_user_id else "system"),
                "ntype": type_code,
                "ntcode": type_code,
                "title": title,
                "narr": narrative,
                "payload": json.dumps(payload),
                "prio": priority,
                "cid": str(contact_id) if contact_id else None,
                "aid": str(activity_id) if activity_id else None,
                "advid": str(advisor_user_id) if advisor_user_id else None,
                "setype": source_event_type,
                "seid": str(source_event_id) if source_event_id else None,
                "ddk": dedup_key,
                "url": url,
                "alabel": action_label_override,
            })
            row = res.first()
            if row:
                created_ids.append(row[0])
        except Exception:
            # Continue with the other recipients; caller's transaction
            # won't roll back due to a single conflict.
            continue

    return created_ids


# ─── reader: drawer list ───────────────────────────────────────────────────

async def list_for_user(
    s: AsyncSession,
    *,
    user_id: UUID,
    limit: int = 30,
    cursor: Optional[str] = None,
    category: Optional[str] = None,
    only_unread: bool = False,
    priority_in: Optional[list[str]] = None,
    type_codes: Optional[list[str]] = None,
) -> dict:
    cur = _decode_cursor(cursor)
    params = {"uid": str(user_id), "limit": limit + 1}
    where = [
        "n.recipient_user_id = CAST(:uid AS uuid)",
        "n.archived_at IS NULL",
    ]
    if only_unread:
        where.append("n.read_at IS NULL")
    if category:
        where.append("t.category = :cat")
        params["cat"] = category
    if priority_in:
        where.append("n.priority = ANY(:prios)")
        params["prios"] = priority_in
    if type_codes:
        where.append("n.notification_type_code = ANY(:tcs)")
        params["tcs"] = type_codes
    if cur:
        where.append("(n.created_at, n.id) < (CAST(:cur_at AS timestamptz), CAST(:cur_id AS uuid))")
        params["cur_at"] = cur["at"]
        params["cur_id"] = cur["id"]

    sql = f"""
        SELECT n.id, n.notification_type_code, n.title, n.narrative, n.priority,
               n.read_at, n.archived_at, n.created_at,
               n.tenant_id, n.contact_id, n.activity_id, n.advisor_user_id, n.lead_id,
               n.sender_user_id, n.action_url, n.action_label,
               t.label_it, t.label_en, t.icon, t.color, t.category,
               tn.name AS tenant_name,
               u.full_name AS sender_display
          FROM relationship_notifications n
          LEFT JOIN platform_notification_types t ON t.code = n.notification_type_code
          LEFT JOIN tenants tn ON tn.id = n.tenant_id
          LEFT JOIN users   u  ON u.id = n.sender_user_id
         WHERE {' AND '.join(where)}
         ORDER BY n.created_at DESC, n.id DESC
         LIMIT :limit
    """
    rows = (await s.execute(text(sql), params)).mappings().all()
    items = [dict(r) for r in rows[:limit]]
    next_cursor = None
    if len(rows) > limit:
        last = rows[limit - 1]
        next_cursor = _encode_cursor(last["created_at"], last["id"])
    return {"items": items, "next_cursor": next_cursor, "count": len(items)}


# ─── reader: bell badge (with critical flag) ───────────────────────────────

async def unread_count(s: AsyncSession, *, user_id: UUID) -> dict:
    """Cheap counter for the bell. Returns total + breakdown + critical flag.

    `has_critical` = True if at least one unread notification has
    priority ∈ {high, urgent}. The frontend renders the bell with a red
    "!" indicator in that case.
    """
    rows = (await s.execute(text("""
        SELECT n.priority, COALESCE(t.category, 'unknown') AS category, COUNT(*) AS n
          FROM relationship_notifications n
          LEFT JOIN platform_notification_types t ON t.code = n.notification_type_code
         WHERE n.recipient_user_id = CAST(:uid AS uuid)
           AND n.read_at IS NULL
           AND n.archived_at IS NULL
         GROUP BY n.priority, t.category
    """), {"uid": str(user_id)})).mappings().all()

    total = 0
    by_priority: dict[str, int] = {}
    by_category: dict[str, int] = {}
    for r in rows:
        n = int(r["n"])
        total += n
        by_priority[r["priority"]] = by_priority.get(r["priority"], 0) + n
        by_category[r["category"]] = by_category.get(r["category"], 0) + n

    has_critical = (by_priority.get("high", 0) + by_priority.get("urgent", 0)) > 0
    return {
        "total": total,
        "by_priority": by_priority,
        "by_category": by_category,
        "has_critical": has_critical,
    }


# ─── mutators ──────────────────────────────────────────────────────────────

async def mark_read(
    s: AsyncSession,
    *,
    user_id: UUID,
    ids: Optional[list[UUID]] = None,
    all_for_user: bool = False,
) -> int:
    if not ids and not all_for_user:
        return 0
    if all_for_user:
        res = await s.execute(text("""
            UPDATE relationship_notifications
               SET read_at = NOW()
             WHERE recipient_user_id = CAST(:uid AS uuid)
               AND read_at IS NULL
               AND archived_at IS NULL
        """), {"uid": str(user_id)})
    else:
        res = await s.execute(text("""
            UPDATE relationship_notifications
               SET read_at = NOW()
             WHERE recipient_user_id = CAST(:uid AS uuid)
               AND id = ANY(CAST(:ids AS uuid[]))
               AND read_at IS NULL
        """), {"uid": str(user_id), "ids": [str(i) for i in ids]})
    return res.rowcount or 0


async def archive(s: AsyncSession, *, user_id: UUID, notif_id: UUID) -> bool:
    res = await s.execute(text("""
        UPDATE relationship_notifications
           SET archived_at = NOW()
         WHERE recipient_user_id = CAST(:uid AS uuid)
           AND id = CAST(:nid AS uuid)
           AND archived_at IS NULL
    """), {"uid": str(user_id), "nid": str(notif_id)})
    return (res.rowcount or 0) > 0


# ─── catalog + preferences ─────────────────────────────────────────────────

async def list_categories(s: AsyncSession) -> list[dict]:
    rows = (await s.execute(text("""
        SELECT code, label_it, label_en, icon, color, category,
               default_priority, notify_admin, notify_advisor, notify_owner,
               sort_order
          FROM platform_notification_types
         WHERE is_active = TRUE
         ORDER BY sort_order, code
    """))).mappings().all()
    return [dict(r) for r in rows]


async def get_preferences(s: AsyncSession, *, user_id: UUID) -> list[dict]:
    """Return the full matrix (one row per active type, with effective values).

    If a (user, type) row doesn't exist, the user is considered enabled for
    in_app and disabled for email/push (defaults).
    """
    rows = (await s.execute(text("""
        SELECT t.code, t.label_it, t.label_en, t.category, t.default_priority,
               COALESCE(p.in_app_enabled, TRUE)  AS in_app_enabled,
               COALESCE(p.email_enabled,  FALSE) AS email_enabled,
               COALESCE(p.push_enabled,   FALSE) AS push_enabled
          FROM platform_notification_types t
          LEFT JOIN relationship_notification_preferences p
                 ON p.notification_type = t.code
                AND p.user_id = CAST(:uid AS uuid)
         WHERE t.is_active = TRUE
         ORDER BY t.sort_order, t.code
    """), {"uid": str(user_id)})).mappings().all()
    return [dict(r) for r in rows]


async def set_preferences(
    s: AsyncSession,
    *,
    user_id: UUID,
    items: list[dict],
) -> int:
    """Bulk upsert. Each item: {notification_type, in_app_enabled?, email_enabled?, push_enabled?}.
    Only in_app is honoured in M4. email/push stored for future."""
    n = 0
    for it in items:
        await s.execute(text("""
            INSERT INTO relationship_notification_preferences
              (user_id, notification_type, in_app_enabled, email_enabled, push_enabled, updated_at)
            VALUES
              (CAST(:uid AS uuid), :t, :ia, :em, :pu, NOW())
            ON CONFLICT (user_id, notification_type) DO UPDATE
               SET in_app_enabled = EXCLUDED.in_app_enabled,
                   email_enabled  = EXCLUDED.email_enabled,
                   push_enabled   = EXCLUDED.push_enabled,
                   updated_at     = NOW()
        """), {
            "uid": str(user_id),
            "t":   it["notification_type"],
            "ia":  bool(it.get("in_app_enabled", True)),
            "em":  bool(it.get("email_enabled", False)),
            "pu":  bool(it.get("push_enabled", False)),
        })
        n += 1
    return n
