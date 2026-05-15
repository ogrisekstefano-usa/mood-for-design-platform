"""
Placeholder admin auth dependency.
TODO (P1): wire to Supabase Auth JWT + tenant_memberships RBAC.
For now: accepts X-Tenant-Slug header (defaults to mood-corporate) and X-Admin-Key
matching ADMIN_API_KEY env (or no-op in dev if not set).
"""
import os
from fastapi import Header, HTTPException
from tenant_resolver import resolve_tenant_by_host, get_corporate_tenant

ADMIN_API_KEY = os.environ.get('ADMIN_API_KEY')


async def require_admin_tenant(
    x_tenant_slug: str | None = Header(default=None),
    x_admin_key: str | None = Header(default=None),
) -> dict:
    if ADMIN_API_KEY and x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin key")
    # resolve by slug if header provided
    if x_tenant_slug:
        from tenant_resolver import _load_by_slug
        t = await _load_by_slug(x_tenant_slug)
        if not t:
            raise HTTPException(status_code=404, detail=f"Tenant '{x_tenant_slug}' not found")
        return t
    return await get_corporate_tenant()
