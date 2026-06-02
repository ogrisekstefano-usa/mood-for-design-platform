"""Relationship Health service (M2).

Single entry point `apply_signal(...)` used by all writers that emit
relationship events or commercial activities. The signal is **data-only**:
no API exposes the resulting `relationship_score` / `last_touch_at`.

Logic (catalog-driven):
  1. Lookup (score_delta, touch) from platform_{event|activity}_types.
  2. If contact_id is provided: UPDATE tenant_contacts.relationship_score
     += delta, last_touch_at = NOW() if touch.
  3. UPDATE tenants.relationship_score += delta (floored at 0),
     last_touch_at = NOW() if touch.

Constraints honored:
  - No bands / decay / AI scoring / KPI / dashboard.
  - No backfill — forward-only accumulation.
  - Operates within the caller's transaction (`s`).
  - Errors are re-raised (no swallow) so the writer can rollback.
"""
from __future__ import annotations
from typing import Literal, Optional
import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def apply_signal(
    s: AsyncSession,
    *,
    tenant_id: str,
    contact_id: Optional[str] = None,
    source: Literal["event", "activity"],
    type_code: str,
) -> None:
    """Apply a single health signal. Caller owns the transaction."""
    if not tenant_id or not type_code:
        return

    if source == "event":
        catalog = "platform_relationship_event_types"
    elif source == "activity":
        catalog = "platform_activity_types"
    else:
        return

    row = (await s.execute(
        text(f"SELECT score_delta, touch FROM {catalog} WHERE code = :c"),
        {"c": type_code},
    )).first()
    if not row:
        # Unknown type_code — write nothing (don't fail the parent transaction).
        logger.debug("apply_signal: unknown %s code=%s", source, type_code)
        return

    delta, touch = int(row[0] or 0), bool(row[1])

    if contact_id:
        await s.execute(text(f"""
            UPDATE tenant_contacts
               SET relationship_score = relationship_score + :d
                   {", last_touch_at = NOW()" if touch else ""}
             WHERE id = CAST(:cid AS uuid)
               AND tenant_id = CAST(:tid AS uuid)
        """), {"d": delta, "cid": contact_id, "tid": tenant_id})

    # Tenant-level signal is always applied (floored at 0).
    await s.execute(text(f"""
        UPDATE tenants
           SET relationship_score = GREATEST(0, relationship_score + :d)
               {", last_touch_at = NOW()" if touch else ""}
         WHERE id = CAST(:tid AS uuid)
    """), {"d": delta, "tid": tenant_id})
