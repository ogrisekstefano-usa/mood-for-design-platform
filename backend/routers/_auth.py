"""
Admin auth dependencies.

Strict mode (default): require a Bearer JWT with role ∈ {admin, owner}.
Legacy fallback: X-Admin-Key matching ADMIN_API_KEY env var.
Either path resolves the tenant from the header or from the JWT claim.
"""
import os
from fastapi import Header, HTTPException
from tenant_resolver import resolve_tenant_by_host, get_corporate_tenant

ADMIN_API_KEY = os.environ.get('ADMIN_API_KEY')


async def require_admin_tenant(
    x_tenant_slug: str | None = Header(default=None),
    x_admin_key:   str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    """
    Tenant-scoped admin guard. Accepts either:
      • `Authorization: Bearer <jwt>`  with role admin/owner/editor, OR
      • `X-Admin-Key: <key>`           matching ADMIN_API_KEY env.
    Anonymous requests are rejected with 401 — no implicit access.
    """
    role: str | None = None
    tenant_slug_from_jwt: str | None = None

    # 1) Bearer JWT path
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(None, 1)[1].strip()
        try:
            from routers.auth import decode_token
            claims = decode_token(token)
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid session")
        role = (claims.get("role") or "").lower()
        tenant_slug_from_jwt = claims.get("tenant_slug")
        if role not in {"admin", "owner", "editor"}:
            raise HTTPException(status_code=403, detail="Insufficient role")

    # 2) Admin API key fallback (must be explicitly configured)
    elif ADMIN_API_KEY and x_admin_key == ADMIN_API_KEY:
        role = "admin"

    else:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Resolve tenant. Priority: explicit header > JWT claim > corporate fallback.
    slug = x_tenant_slug or tenant_slug_from_jwt
    if slug:
        from tenant_resolver import _load_by_slug
        t = await _load_by_slug(slug)
        if not t:
            raise HTTPException(status_code=404, detail=f"Tenant '{slug}' not found")
        return t
    return await get_corporate_tenant()
