"""Catalog read service with light TTL cache (M1).

Exposes DB-driven catalogs to both Admin and Founder UIs:
  - contact-roles
  - activity-types
  - relationship-event-types
  - contact-sources
  - languages
  - markets

Cache: 60s in-process. The catalogs are tiny (≤ 20 rows) so a single
small dict is more than enough.
"""
from __future__ import annotations
import time
from typing import Any, Optional

from sqlalchemy import text
from database import AsyncSessionLocal

_CACHE: dict[str, tuple[float, list[dict]]] = {}
_TTL = 60.0

# Mapping from slug → (table_name, sort_column, optional filters)
_DEF = {
    "contact-roles": (
        "platform_contact_roles",
        ["code", "category", "icon", "label_it", "label_en", "sort_order"],
        "enabled = TRUE",
        "sort_order, code",
    ),
    "activity-types": (
        "platform_activity_types",
        ["code", "icon", "default_duration_min", "show_in_timeline",
         "quick_action_m1", "label_it", "label_en", "sort_order"],
        "enabled = TRUE",
        "sort_order, code",
    ),
    "relationship-event-types": (
        "platform_relationship_event_types",
        ["code", "category", "source", "show_in_timeline", "icon", "color",
         "label_it", "label_en", "sort_order"],
        "enabled = TRUE",
        "sort_order, code",
    ),
    "contact-sources": (
        "platform_contact_sources",
        ["code", "icon", "label_it", "label_en", "sort_order"],
        "enabled = TRUE",
        "sort_order, code",
    ),
    "languages": (
        "platform_languages",
        ["code", "name_native", "name_en", "rtl"],
        "TRUE",
        "name_native, code",
    ),
    "markets": (
        "markets",
        ["code", "label_it", "label_en", "country_iso"],
        "TRUE",
        "label_it, code",
    ),
}


async def get_catalog(name: str) -> list[dict[str, Any]]:
    """Return rows of a catalog, cached for `_TTL` seconds."""
    if name not in _DEF:
        return []
    now = time.time()
    cached = _CACHE.get(name)
    if cached and now - cached[0] < _TTL:
        return cached[1]
    tbl, cols, where, order = _DEF[name]
    sql = f"SELECT {', '.join(cols)} FROM {tbl} WHERE {where} ORDER BY {order}"
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(text(sql))).mappings().all()
    out = [dict(r) for r in rows]
    _CACHE[name] = (now, out)
    return out


def invalidate(name: Optional[str] = None) -> None:
    if name:
        _CACHE.pop(name, None)
    else:
        _CACHE.clear()
