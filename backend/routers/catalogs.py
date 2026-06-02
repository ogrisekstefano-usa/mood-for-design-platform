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
    "contact-sources", "languages", "markets",
}


@router.get("/{name}")
async def read_catalog(name: str, _: dict = Depends(require_admin_tenant)):
    if name not in _ALLOWED:
        raise HTTPException(status_code=404, detail="Catalog not found")
    return await get_catalog(name)
