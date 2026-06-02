"""Relationship Activities service (M1 minimal scope).

M1 only writes via Quick Action mini-modal: type + subject + outcome.
Full form (outcome/next_step/due_at/duration_min) ships in M3.
"""
from __future__ import annotations
from typing import Any, Optional
import json

from fastapi import HTTPException
from sqlalchemy import text
from database import AsyncSessionLocal

_M1_QUICK_TYPES = {"call", "email", "whatsapp", "linkedin", "internal_note"}


async def list_activities(tenant_id: str, *,
                          contact_id: Optional[str] = None,
                          activity_type_code: Optional[str] = None,
                          limit: int = 10) -> list[dict[str, Any]]:
    where = ["a.tenant_id = CAST(:tid AS uuid)", "a.archived_at IS NULL"]
    params: dict[str, Any] = {"tid": tenant_id, "limit": limit}
    if contact_id:
        where.append("a.contact_id = CAST(:cid AS uuid)")
        params["cid"] = contact_id
    if activity_type_code:
        where.append("a.activity_type_code = :code")
        params["code"] = activity_type_code

    sql = f"""
        SELECT a.id, a.tenant_id, a.studio_relation_id, a.contact_id,
               a.owner_user_id, a.activity_type_code,
               a.occurred_at, a.subject, a.outcome, a.next_step,
               a.next_step_due_at, a.duration_min,
               -- Resolved labels
               t.label_it AS type_label_it,
               t.label_en AS type_label_en,
               t.icon     AS type_icon,
               coalesce(u.full_name, u.email) AS owner_display,
               coalesce(c.first_name||' '||c.last_name, c.email) AS contact_display
          FROM relationship_activities a
          LEFT JOIN platform_activity_types t ON t.code = a.activity_type_code
          LEFT JOIN users           u ON u.id = a.owner_user_id
          LEFT JOIN tenant_contacts c ON c.id = a.contact_id
         WHERE {' AND '.join(where)}
         ORDER BY a.occurred_at DESC
         LIMIT :limit
    """
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(text(sql), params)).mappings().all()
    return [dict(r) for r in rows]


async def create_quick_activity(tenant_id: str, payload: dict[str, Any], *,
                                owner_user_id: str) -> dict[str, Any]:
    """Insert a quick activity (M1 minimal scope: type+subject+outcome+contact)."""
    code = (payload.get("activity_type_code") or "").strip()
    if code not in _M1_QUICK_TYPES:
        raise HTTPException(status_code=422, detail=f"quick_action invalid: {code}")
    subject = (payload.get("subject") or "").strip() or None
    outcome = (payload.get("outcome") or "").strip() or None
    contact_id = payload.get("contact_id") or None

    async with AsyncSessionLocal() as s:
        # Derive studio_relation_id from tenant (best-effort)
        rel_id = (await s.execute(text("""
            SELECT id FROM studio_relations
             WHERE tenant_id = CAST(:tid AS uuid)
             ORDER BY created_at DESC LIMIT 1
        """), {"tid": tenant_id})).scalar()

        new_id = (await s.execute(text("""
            INSERT INTO relationship_activities (
                tenant_id, studio_relation_id, contact_id, owner_user_id,
                activity_type_code, occurred_at, subject, outcome, payload
            ) VALUES (
                CAST(:tid AS uuid),
                CAST(:rel AS uuid),
                CAST(:cid AS uuid),
                CAST(:owner AS uuid),
                :code, NOW(), :subject, :outcome, CAST(:pl AS jsonb)
            )
            RETURNING id
        """), {
            "tid": tenant_id,
            "rel": str(rel_id) if rel_id else None,
            "cid": contact_id,
            "owner": owner_user_id,
            "code": code,
            "subject": subject,
            "outcome": outcome,
            "pl": json.dumps({"source": "quick_action_m1"}),
        })).scalar()

        # Denorm: bump last_activity_at on relation and contact
        if rel_id:
            await s.execute(text("""
                UPDATE studio_relations SET last_activity_at = NOW()
                 WHERE id = CAST(:rid AS uuid)
            """), {"rid": str(rel_id)})
        if contact_id:
            await s.execute(text("""
                UPDATE tenant_contacts
                   SET last_activity_at = NOW(),
                       last_touch_at = NOW()
                 WHERE id = CAST(:cid AS uuid)
            """), {"cid": contact_id})

        # If the activity is an internal_note, also append a narrative event
        if code == "internal_note":
            await s.execute(text("""
                INSERT INTO studio_relationship_events
                    (relation_id, actor_id, kind, payload, occurred_at,
                     tenant_id, event_type_code)
                VALUES
                    (CAST(:rid AS uuid), CAST(:aid AS uuid),
                     'note_added', CAST(:pl AS jsonb), NOW(),
                     CAST(:tid AS uuid), 'note_added')
            """), {
                "rid": str(rel_id) if rel_id else None,
                "aid": owner_user_id,
                "pl": json.dumps({"activity_id": str(new_id), "subject": subject}),
                "tid": tenant_id,
            })

        # M2 health hook (data-only, catalog-driven)
        try:
            from services import relationship_health as rh
            await rh.apply_signal(
                s, tenant_id=tenant_id, contact_id=contact_id,
                source="activity", type_code=code,
            )
        except Exception:  # noqa: BLE001
            import logging
            logging.getLogger(__name__).exception(
                "relationship_health.apply_signal failed for activity=%s", code)

        await s.commit()

    rows = await list_activities(tenant_id, contact_id=None, limit=1)
    return rows[0] if rows else {"id": str(new_id)}
