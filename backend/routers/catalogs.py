"""Catalog endpoints — DB-driven taxonomy reads.

Public to any authenticated caller (admin/editor/advisor/owner).
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from services.catalogs import get_catalog
from routers._auth import require_admin_tenant

router = APIRouter(prefix="/api/catalogs", tags=["catalogs"])

_ALLOWED = {
    "contact-roles", "activity-types", "relationship-event-types",
    "contact-sources", "languages", "markets", "timeline-types",
}


@router.get("/{name}")
async def read_catalog(name: str, _: dict = Depends(require_admin_tenant)):
    if name not in _ALLOWED:
        raise HTTPException(status_code=404, detail="Catalog not found")
    if name == "timeline-types":
        # Composite catalog joining event types + activity types for UI dressing.
        from database import AsyncSessionLocal
        from sqlalchemy import text
        async with AsyncSessionLocal() as s:
            rows = (await s.execute(text("""
                SELECT 'event' AS source, code, label_it, label_en, icon, color,
                       category, show_in_timeline, visibility, notifiable
                  FROM platform_relationship_event_types WHERE enabled = TRUE
                UNION ALL
                SELECT 'activity' AS source, code, label_it, label_en, icon, NULL AS color,
                       'manual' AS category, show_in_timeline, visibility, notifiable
                  FROM platform_activity_types WHERE enabled = TRUE
                 ORDER BY source, code
            """))).mappings().all()
            return [dict(r) for r in rows]
    return await get_catalog(name)
