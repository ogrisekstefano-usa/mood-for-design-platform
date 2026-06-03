"""Relationship Activities service (M3 · Activity Log Advanced™).

The Memory Layer of MOOD. Every activity remembers:
  - What happened   (activity_type_code, subject, notes)
  - With whom       (contact_id)
  - With what outcome (activity_outcome_code · outcome)
  - Who was responsible (owner_user_id · created_by)
  - What's next     (next_step · next_step_due_at · completed_at)

NB: `_M1_QUICK_TYPES` is no longer enforced — catalog (`enabled=TRUE`) is
the sole source of truth. The legacy `/activities/quick` endpoint still
works but now delegates to `create_activity()` like any other type.
"""
from __future__ import annotations
from typing import Any, Optional
import json
import logging

from fastapi import HTTPException
from sqlalchemy import text
from database import AsyncSessionLocal

logger = logging.getLogger(__name__)

# Whitelist of fields that may be mutated via PATCH (admin)
_UPDATABLE = {
    "activity_type_code", "contact_id", "owner_user_id", "subject",
    "notes", "outcome", "next_step", "next_step_due_at", "duration_min",
    "occurred_at", "importance", "sentiment",
    "source_code", "activity_outcome_code",
}


# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────

async def _validate_catalog(s, *, type_code: str | None,
                            outcome_code: str | None,
                            source_code: str | None) -> None:
    """Pre-validate FK catalog references → raise 422 instead of asyncpg 500."""
    if type_code:
        ok = (await s.execute(text(
            "SELECT 1 FROM platform_activity_types WHERE code = :c AND enabled = TRUE"
        ), {"c": type_code})).scalar()
        if not ok:
            raise HTTPException(422, {"code": "invalid_activity_type_code",
                                       "value": type_code})
    if outcome_code:
        ok = (await s.execute(text(
            "SELECT 1 FROM platform_activity_outcomes WHERE code = :c AND enabled = TRUE"
        ), {"c": outcome_code})).scalar()
        if not ok:
            raise HTTPException(422, {"code": "invalid_activity_outcome_code",
                                       "value": outcome_code})
    if source_code:
        ok = (await s.execute(text(
            "SELECT 1 FROM platform_activity_sources WHERE code = :c AND enabled = TRUE"
        ), {"c": source_code})).scalar()
        if not ok:
            raise HTTPException(422, {"code": "invalid_source_code",
                                       "value": source_code})


async def _emit_note_event(s, *, rel_id: str | None, tenant_id: str,
                            owner_id: str, activity_id: str,
                            subject: str | None) -> None:
    if not rel_id:
        return
    await s.execute(text("""
        INSERT INTO studio_relationship_events
            (relation_id, actor_id, kind, payload, occurred_at,
             tenant_id, event_type_code)
        VALUES
            (CAST(:rid AS uuid), CAST(:aid AS uuid),
             'note_added', CAST(:pl AS jsonb), NOW(),
             CAST(:tid AS uuid), 'note_added')
    """), {
        "rid": rel_id, "aid": owner_id,
        "pl": json.dumps({"activity_id": activity_id, "subject": subject}),
        "tid": tenant_id,
    })


async def _apply_health(s, *, tenant_id: str, contact_id: str | None,
                        type_code: str) -> None:
    try:
        from services import relationship_health as rh
        await rh.apply_signal(s, tenant_id=tenant_id, contact_id=contact_id,
                              source="activity", type_code=type_code)
    except Exception:  # noqa: BLE001
        logger.exception("apply_signal failed for activity=%s", type_code)


async def _revert_health(s, *, tenant_id: str, contact_id: str | None,
                          type_code: str) -> None:
    """Revert a previously-applied signal (used when type_code changes)."""
    row = (await s.execute(text(
        "SELECT score_delta, touch FROM platform_activity_types WHERE code = :c"
    ), {"c": type_code})).first()
    if not row:
        return
    delta = -int(row[0] or 0)
    if delta == 0:
        return
    if contact_id:
        await s.execute(text("""
            UPDATE tenant_contacts
               SET relationship_score = relationship_score + :d
             WHERE id = CAST(:cid AS uuid) AND tenant_id = CAST(:tid AS uuid)
        """), {"d": delta, "cid": contact_id, "tid": tenant_id})
    await s.execute(text("""
        UPDATE tenants
           SET relationship_score = GREATEST(0, relationship_score + :d)
         WHERE id = CAST(:tid AS uuid)
    """), {"d": delta, "tid": tenant_id})


# ──────────────────────────────────────────────────────────────────────
# Read
# ──────────────────────────────────────────────────────────────────────

def _activity_select() -> str:
    """Common SELECT projection joined with catalog/contact/owner labels."""
    return """
        SELECT a.id, a.tenant_id, a.studio_relation_id, a.contact_id,
               a.owner_user_id, a.created_by,
               a.activity_type_code, a.activity_outcome_code, a.source_code,
               a.occurred_at, a.completed_at,
               a.subject, a.notes, a.outcome, a.next_step,
               a.next_step_due_at, a.duration_min, a.importance, a.sentiment,
               a.archived_at, a.created_at, a.updated_at,
               t.label_it AS type_label_it, t.label_en AS type_label_en,
               t.icon     AS type_icon,
               o.label_it AS outcome_label_it, o.label_en AS outcome_label_en,
               o.color    AS outcome_color,
               src.label_it AS source_label_it, src.label_en AS source_label_en,
               coalesce(u.full_name, u.email) AS owner_display,
               coalesce(cb.full_name, cb.email) AS created_by_display,
               coalesce(c.first_name||' '||c.last_name, c.email) AS contact_display
          FROM relationship_activities a
          LEFT JOIN platform_activity_types    t   ON t.code   = a.activity_type_code
          LEFT JOIN platform_activity_outcomes o   ON o.code   = a.activity_outcome_code
          LEFT JOIN platform_activity_sources  src ON src.code = a.source_code
          LEFT JOIN users           u  ON u.id  = a.owner_user_id
          LEFT JOIN users           cb ON cb.id = a.created_by
          LEFT JOIN tenant_contacts c  ON c.id  = a.contact_id
    """


async def list_activities(
    tenant_id: str,
    *,
    contact_id: Optional[str] = None,
    activity_type_code: Optional[str] = None,
    activity_outcome_code: Optional[str] = None,
    source_code: Optional[str] = None,
    owner_user_id: Optional[str] = None,
    created_by: Optional[str] = None,
    status: str = "all",    # all | open | completed | archived
    since: Optional[str] = None,
    until: Optional[str] = None,
    due_since: Optional[str] = None,
    due_until: Optional[str] = None,
    q: Optional[str] = None,
    cursor_at: Optional[str] = None,
    cursor_id: Optional[str] = None,
    limit: int = 30,
) -> dict[str, Any]:
    where: list[str] = ["a.tenant_id = CAST(:tid AS uuid)"]
    params: dict[str, Any] = {"tid": tenant_id, "limit": min(max(limit, 1), 100)}

    if status == "archived":
        where.append("a.archived_at IS NOT NULL")
    elif status == "open":
        where.append("a.archived_at IS NULL "
                     "AND a.next_step_due_at IS NOT NULL "
                     "AND a.completed_at IS NULL")
    elif status == "completed":
        where.append("a.archived_at IS NULL AND a.completed_at IS NOT NULL")
    elif status == "all":
        where.append("a.archived_at IS NULL")

    if contact_id:
        where.append("a.contact_id = CAST(:cid AS uuid)"); params["cid"] = contact_id
    if activity_type_code:
        codes = [c.strip() for c in activity_type_code.split(",") if c.strip()]
        where.append("a.activity_type_code = ANY(:codes)"); params["codes"] = codes
    if activity_outcome_code:
        ocs = [c.strip() for c in activity_outcome_code.split(",") if c.strip()]
        where.append("a.activity_outcome_code = ANY(:ocs)"); params["ocs"] = ocs
    if source_code:
        srcs = [c.strip() for c in source_code.split(",") if c.strip()]
        where.append("a.source_code = ANY(:srcs)"); params["srcs"] = srcs
    if owner_user_id:
        where.append("a.owner_user_id = CAST(:owner AS uuid)"); params["owner"] = owner_user_id
    if created_by:
        where.append("a.created_by = CAST(:cby AS uuid)"); params["cby"] = created_by
    if since:
        where.append("a.occurred_at >= :since"); params["since"] = since
    if until:
        where.append("a.occurred_at <= :until"); params["until"] = until
    if due_since:
        where.append("a.next_step_due_at >= :due_since"); params["due_since"] = due_since
    if due_until:
        where.append("a.next_step_due_at <= :due_until"); params["due_until"] = due_until
    if q:
        where.append("""to_tsvector('simple',
                          coalesce(a.subject,'')||' '||coalesce(a.outcome,'')||' '||
                          coalesce(a.next_step,'')||' '||coalesce(a.notes,''))
                       @@ plainto_tsquery('simple', :q)""")
        params["q"] = q
    if cursor_at and cursor_id:
        where.append("(a.occurred_at, a.id) < "
                     "(CAST(:cur_at AS timestamptz), CAST(:cur_id AS uuid))")
        # Coerce ISO string to datetime for asyncpg
        from datetime import datetime as _dt, timezone as _tz
        try:
            params["cur_at"] = (_dt.fromisoformat(str(cursor_at).replace("Z", "+00:00"))
                                if not isinstance(cursor_at, _dt) else cursor_at)
        except Exception:
            params["cur_at"] = _dt.now(_tz.utc)
        params["cur_id"] = cursor_id

    sql = (_activity_select()
           + " WHERE " + " AND ".join(where)
           + " ORDER BY a.occurred_at DESC, a.id DESC LIMIT :limit")
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(text(sql), params)).mappings().all()

    items = [dict(r) for r in rows]
    next_cursor = None
    if len(items) == params["limit"] and items:
        last = items[-1]
        next_cursor = {"at": last["occurred_at"].isoformat() if last["occurred_at"] else None,
                        "id": str(last["id"])}
    return {"items": items, "next_cursor": next_cursor, "count": len(items)}


async def get_activity(tenant_id: str, aid: str) -> dict[str, Any]:
    sql = _activity_select() + " WHERE a.id = CAST(:aid AS uuid) AND a.tenant_id = CAST(:tid AS uuid)"
    async with AsyncSessionLocal() as s:
        row = (await s.execute(text(sql), {"aid": aid, "tid": tenant_id})).mappings().first()
    if not row:
        raise HTTPException(404, "activity not found")
    return dict(row)


# ──────────────────────────────────────────────────────────────────────
# Write
# ──────────────────────────────────────────────────────────────────────

async def create_activity(tenant_id: str, payload: dict[str, Any], *,
                          owner_user_id: str, created_by: str | None = None,
                          default_source: str | None = "manual",
                          ) -> dict[str, Any]:
    """Full-form activity creation (M3). Replaces M1 quick whitelist."""
    code = (payload.get("activity_type_code") or "").strip()
    if not code:
        raise HTTPException(422, "activity_type_code is required")
    outcome_code = (payload.get("activity_outcome_code") or "").strip() or None
    source_code = (payload.get("source_code") or "").strip() or default_source

    subject = (payload.get("subject") or "").strip() or None
    notes = (payload.get("notes") or "").strip() or None
    outcome = (payload.get("outcome") or "").strip() or None
    next_step = (payload.get("next_step") or "").strip() or None
    next_due = payload.get("next_step_due_at") or None
    duration = payload.get("duration_min")
    occurred = payload.get("occurred_at") or None
    importance = payload.get("importance")
    sentiment = payload.get("sentiment")
    contact_id = payload.get("contact_id") or None
    actor_owner = payload.get("owner_user_id") or owner_user_id

    # Coerce ISO strings to datetime for asyncpg
    from datetime import datetime as _dt
    def _iso(v):
        if v is None or isinstance(v, _dt):
            return v
        try:
            return _dt.fromisoformat(str(v).replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(422, f"invalid datetime: {v}")
    next_due = _iso(next_due)
    occurred = _iso(occurred)

    async with AsyncSessionLocal() as s:
        await _validate_catalog(s, type_code=code, outcome_code=outcome_code,
                                source_code=source_code if source_code else None)

        rel_id = (await s.execute(text("""
            SELECT id FROM studio_relations
             WHERE tenant_id = CAST(:tid AS uuid)
             ORDER BY created_at DESC LIMIT 1
        """), {"tid": tenant_id})).scalar()

        new_id = (await s.execute(text("""
            INSERT INTO relationship_activities (
                tenant_id, studio_relation_id, contact_id, owner_user_id, created_by,
                activity_type_code, activity_outcome_code, source_code,
                occurred_at, subject, notes, outcome, next_step, next_step_due_at,
                duration_min, importance, sentiment, payload
            ) VALUES (
                CAST(:tid AS uuid), CAST(:rel AS uuid), CAST(:cid AS uuid),
                CAST(:owner AS uuid), CAST(:cby AS uuid),
                :code, :ocode, :scode,
                COALESCE(CAST(:occ AS timestamptz), NOW()),
                :subject, :notes, :outcome, :next_step,
                CAST(:next_due AS timestamptz),
                :duration, :importance, :sentiment, '{}'::jsonb
            )
            RETURNING id
        """), {
            "tid": tenant_id, "rel": str(rel_id) if rel_id else None,
            "cid": contact_id, "owner": actor_owner,
            "cby": created_by or owner_user_id,
            "code": code, "ocode": outcome_code, "scode": source_code,
            "occ": occurred,
            "subject": subject, "notes": notes, "outcome": outcome,
            "next_step": next_step, "next_due": next_due,
            "duration": duration, "importance": importance, "sentiment": sentiment,
        })).scalar()

        # Denormalize last activity stamps
        if rel_id:
            await s.execute(text(
                "UPDATE studio_relations SET last_activity_at = NOW() WHERE id = CAST(:rid AS uuid)"
            ), {"rid": str(rel_id)})
        if contact_id:
            await s.execute(text("""
                UPDATE tenant_contacts
                   SET last_activity_at = NOW(), last_touch_at = NOW()
                 WHERE id = CAST(:cid AS uuid)
            """), {"cid": contact_id})

        # internal_note → narrative event for richer timeline
        if code == "internal_note":
            await _emit_note_event(
                s, rel_id=str(rel_id) if rel_id else None,
                tenant_id=tenant_id, owner_id=actor_owner,
                activity_id=str(new_id), subject=subject)

        # M2 health hook
        await _apply_health(s, tenant_id=tenant_id, contact_id=contact_id, type_code=code)

        await s.commit()

    return await get_activity(tenant_id, str(new_id))


# Backward-compat alias for /activities/quick (M1)
async def create_quick_activity(tenant_id: str, payload: dict[str, Any], *,
                                owner_user_id: str) -> dict[str, Any]:
    return await create_activity(tenant_id, payload,
                                  owner_user_id=owner_user_id,
                                  created_by=owner_user_id,
                                  default_source="manual")


async def update_activity(tenant_id: str, aid: str,
                          payload: dict[str, Any], *,
                          actor_user_id: str) -> dict[str, Any]:
    """Partial update of an activity. Strips unknown fields."""
    fields, params = [], {"aid": aid, "tid": tenant_id}
    new_payload = {k: v for k, v in payload.items() if k in _UPDATABLE}
    if not new_payload:
        raise HTTPException(422, "no updatable fields in payload")

    async with AsyncSessionLocal() as s:
        # Pre-validate catalog FKs if changing
        await _validate_catalog(
            s,
            type_code=new_payload.get("activity_type_code"),
            outcome_code=new_payload.get("activity_outcome_code"),
            source_code=new_payload.get("source_code"),
        )

        # Fetch current state for type-change health signal swap
        cur = (await s.execute(text("""
            SELECT activity_type_code, contact_id FROM relationship_activities
             WHERE id = CAST(:aid AS uuid) AND tenant_id = CAST(:tid AS uuid)
        """), params)).first()
        if not cur:
            raise HTTPException(404, "activity not found")
        old_code, old_contact = cur[0], cur[1]

        for k, v in new_payload.items():
            if k in ("contact_id", "owner_user_id"):
                fields.append(f"{k} = CAST(:{k} AS uuid)")
                params[k] = v
            elif k in ("next_step_due_at", "occurred_at"):
                # Coerce ISO string to datetime for asyncpg
                from datetime import datetime as _dt
                if v is None or isinstance(v, _dt):
                    params[k] = v
                else:
                    try:
                        params[k] = _dt.fromisoformat(str(v).replace("Z", "+00:00"))
                    except Exception:
                        raise HTTPException(422, f"invalid datetime: {v}")
                fields.append(f"{k} = :{k}")
            else:
                fields.append(f"{k} = :{k}")
                params[k] = v

        fields.append("updated_at = NOW()")

        await s.execute(text(f"""
            UPDATE relationship_activities SET {', '.join(fields)}
             WHERE id = CAST(:aid AS uuid) AND tenant_id = CAST(:tid AS uuid)
        """), params)

        # If activity_type_code changed → revert old signal then apply new
        new_code = new_payload.get("activity_type_code")
        if new_code and new_code != old_code:
            await _revert_health(s, tenant_id=tenant_id,
                                  contact_id=str(old_contact) if old_contact else None,
                                  type_code=old_code)
            await _apply_health(s, tenant_id=tenant_id,
                                 contact_id=str(old_contact) if old_contact else None,
                                 type_code=new_code)

        await s.commit()
    return await get_activity(tenant_id, aid)


async def archive_activity(tenant_id: str, aid: str, *,
                           actor_user_id: str) -> dict[str, Any]:
    """Soft archive — sets archived_at = NOW(). Never hard-deletes."""
    async with AsyncSessionLocal() as s:
        r = await s.execute(text("""
            UPDATE relationship_activities
               SET archived_at = NOW(), updated_at = NOW()
             WHERE id = CAST(:aid AS uuid) AND tenant_id = CAST(:tid AS uuid)
               AND archived_at IS NULL
            RETURNING id, created_by
        """), {"aid": aid, "tid": tenant_id})
        row = r.first()
        if not row:
            # Either not found or already archived
            existing = (await s.execute(text(
                "SELECT id FROM relationship_activities WHERE id = CAST(:aid AS uuid) AND tenant_id = CAST(:tid AS uuid)"
            ), {"aid": aid, "tid": tenant_id})).scalar()
            if not existing:
                raise HTTPException(404, "activity not found")
        await s.commit()
    return {"ok": True, "id": aid, "archived_at": "now"}


async def complete_activity(tenant_id: str, aid: str, *,
                            outcome_code: str | None = None,
                            actor_user_id: str) -> dict[str, Any]:
    async with AsyncSessionLocal() as s:
        if outcome_code:
            await _validate_catalog(s, type_code=None,
                                     outcome_code=outcome_code, source_code=None)
        sets = ["completed_at = NOW()", "updated_at = NOW()"]
        params = {"aid": aid, "tid": tenant_id}
        if outcome_code:
            sets.append("activity_outcome_code = :ocode")
            params["ocode"] = outcome_code
        r = await s.execute(text(f"""
            UPDATE relationship_activities SET {', '.join(sets)}
             WHERE id = CAST(:aid AS uuid) AND tenant_id = CAST(:tid AS uuid)
             RETURNING id
        """), params)
        if not r.first():
            raise HTTPException(404, "activity not found")
        await s.commit()
    return await get_activity(tenant_id, aid)


async def reopen_activity(tenant_id: str, aid: str, *,
                          actor_user_id: str) -> dict[str, Any]:
    async with AsyncSessionLocal() as s:
        r = await s.execute(text("""
            UPDATE relationship_activities
               SET completed_at = NULL, updated_at = NOW()
             WHERE id = CAST(:aid AS uuid) AND tenant_id = CAST(:tid AS uuid)
             RETURNING id
        """), {"aid": aid, "tid": tenant_id})
        if not r.first():
            raise HTTPException(404, "activity not found")
        await s.commit()
    return await get_activity(tenant_id, aid)


async def list_open_followups(tenant_id: str, *,
                              owner_user_id: str | None = None,
                              limit: int = 30) -> dict[str, Any]:
    return await list_activities(tenant_id, status="open",
                                  owner_user_id=owner_user_id, limit=limit)
