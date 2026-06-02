"""Relationship Timeline service (M2).

Read-only reader of `v_relationship_timeline` joined with catalogs
for localized labels / icons / colors. Cursor-paginated and filterable.
"""
from __future__ import annotations
from typing import Optional, Literal
from datetime import datetime, timezone
import base64
import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _encode_cursor(at: datetime, ident: str) -> str:
    raw = json.dumps({"at": at.isoformat(), "id": str(ident)}, separators=(",", ":"))
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cursor: str | None) -> Optional[dict]:
    if not cursor:
        return None
    try:
        data = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
        # Validate fields
        if "at" not in data or "id" not in data:
            return None
        return data
    except Exception:
        return None


async def list_timeline(
    s: AsyncSession,
    *,
    tenant_id: str,
    scope: Literal["admin", "founder"] = "admin",
    sources: list[str] | None = None,
    type_codes: list[str] | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
    owner_user_id: str | None = None,
    contact_id: str | None = None,
    manual_only: bool = False,
    cursor: str | None = None,
    limit: int = 30,
) -> dict:
    """Paginated, filtered, cataloged timeline. `at DESC, id DESC` ordering."""
    where = ["v.tenant_id = CAST(:tid AS uuid)"]
    params: dict = {"tid": tenant_id, "limit": limit}

    if sources:
        where.append("v.source = ANY(:sources)")
        params["sources"] = sources
    if type_codes:
        where.append("v.type_code = ANY(:type_codes)")
        params["type_codes"] = type_codes
    if since:
        where.append("v.at >= :since")
        params["since"] = since
    if until:
        where.append("v.at <= :until")
        params["until"] = until
    if owner_user_id:
        where.append("v.owner_user_id = CAST(:owner AS uuid)")
        params["owner"] = owner_user_id
    if contact_id:
        # activity rows have native contact_id; event rows carry contact_id in payload
        where.append("(v.source='activity' AND EXISTS ("
                     "  SELECT 1 FROM relationship_activities a "
                     "  WHERE a.id = v.id AND a.contact_id = CAST(:contact_id AS uuid)) "
                     "OR (v.source='event' AND (v.payload->>'contact_id') = :contact_id))")
        params["contact_id"] = contact_id
    if manual_only:
        where.append("(v.source='activity' OR "
                     " EXISTS (SELECT 1 FROM platform_relationship_event_types et "
                     "         WHERE et.code = v.type_code AND et.category = 'manual'))")
    if scope == "founder":
        # Strip admin-only via catalog visibility lookups (union of both catalogs)
        where.append("""
            NOT EXISTS (
                SELECT 1 FROM platform_relationship_event_types et
                 WHERE et.code = v.type_code AND et.visibility = 'admin_only'
            )
            AND NOT EXISTS (
                SELECT 1 FROM platform_activity_types at_
                 WHERE at_.code = v.type_code AND at_.visibility = 'admin_only'
            )
        """)

    # Cursor: (at, id) tuple — strictly less-than for DESC
    cur = _decode_cursor(cursor)
    if cur:
        where.append("(v.at, v.id) < (CAST(:cur_at AS timestamptz), CAST(:cur_id AS uuid))")
        # Parse ISO timestamp into datetime so asyncpg accepts it
        try:
            params["cur_at"] = datetime.fromisoformat(cur["at"])
        except Exception:
            params["cur_at"] = datetime.now(timezone.utc)
        params["cur_id"] = cur["id"]

    sql = f"""
        SELECT
            v.source, v.id, v.type_code, v.at, v.subject, v.payload,
            v.owner_user_id, v.relation_id,
            COALESCE(et.label_it, at_.label_it) AS label_it,
            COALESCE(et.label_en, at_.label_en) AS label_en,
            COALESCE(et.icon,     at_.icon)     AS icon,
            COALESCE(et.color,    NULL)         AS color,
            COALESCE(et.category, 'activity')   AS category,
            COALESCE(ou.full_name, ou.email)    AS owner_display
          FROM v_relationship_timeline v
          LEFT JOIN platform_relationship_event_types et ON et.code = v.type_code
          LEFT JOIN platform_activity_types          at_ ON at_.code = v.type_code
          LEFT JOIN users ou ON ou.id = v.owner_user_id
         WHERE {' AND '.join(where)}
         ORDER BY v.at DESC, v.id DESC
         LIMIT :limit
    """
    rows = (await s.execute(text(sql), params)).mappings().all()
    items = []
    for r in rows:
        items.append({
            "source":         r["source"],
            "id":             str(r["id"]),
            "type_code":      r["type_code"],
            "at":             r["at"].isoformat() if r["at"] else None,
            "label_it":       r["label_it"],
            "label_en":       r["label_en"],
            "icon":           r["icon"],
            "color":          r["color"],
            "category":       r["category"],
            "subject":        r["subject"],
            "payload":        r["payload"],
            "owner_user_id":  str(r["owner_user_id"]) if r["owner_user_id"] else None,
            "owner_display":  r["owner_display"],
        })

    next_cursor = None
    if len(items) == limit and items:
        last = rows[-1]
        next_cursor = _encode_cursor(last["at"], last["id"])

    return {"items": items, "next_cursor": next_cursor, "count": len(items)}


async def list_filter_options(
    s: AsyncSession, *, tenant_id: str, scope: Literal["admin", "founder"] = "admin",
) -> dict:
    """Return distinct type_codes present for this tenant, with metadata.
    Useful to render filter chips that don't include empty buckets.
    """
    scope_clause = ""
    if scope == "founder":
        scope_clause = """
            AND NOT EXISTS (
                SELECT 1 FROM platform_relationship_event_types et2
                 WHERE et2.code = v.type_code AND et2.visibility = 'admin_only'
            )
            AND NOT EXISTS (
                SELECT 1 FROM platform_activity_types at2
                 WHERE at2.code = v.type_code AND at2.visibility = 'admin_only'
            )
        """
    rows = (await s.execute(text(f"""
        SELECT v.source, v.type_code,
               COALESCE(et.label_it, at_.label_it) AS label_it,
               COALESCE(et.label_en, at_.label_en) AS label_en,
               COALESCE(et.icon,     at_.icon)     AS icon,
               COALESCE(et.color,    NULL)         AS color,
               COALESCE(et.category, 'activity')   AS category,
               COUNT(*) AS occurrences
          FROM v_relationship_timeline v
          LEFT JOIN platform_relationship_event_types et ON et.code = v.type_code
          LEFT JOIN platform_activity_types          at_ ON at_.code = v.type_code
         WHERE v.tenant_id = CAST(:tid AS uuid)
         {scope_clause}
         GROUP BY v.source, v.type_code, et.label_it, at_.label_it,
                  et.label_en, at_.label_en, et.icon, at_.icon, et.color, et.category
         ORDER BY occurrences DESC, v.type_code
    """), {"tid": tenant_id})).mappings().all()
    sources = sorted({r["source"] for r in rows})
    return {
        "sources": sources,
        "type_codes": [dict(r) for r in rows],
    }
