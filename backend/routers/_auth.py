"""
Admin auth dependencies.

Tenant boundary policy (P0-A Tenant Isolation):

  • role=admin / editor → super admin. Can target any tenant via
    X-Tenant-Slug header or JWT claim. No path-slug validation.
  • role=owner          → Founder. Tenant is FORCED to the JWT claim;
    the X-Tenant-Slug header is IGNORED. Endpoints that accept a URL
    {slug} must call `enforce_tenant_match()` to confirm the URL slug
    equals the resolved tenant slug.
  • Any other role / unauthenticated → 401/403.

Legacy: X-Admin-Key matching ADMIN_API_KEY env var is still accepted
in development as a super-admin equivalent.
"""
import os
from fastapi import Header, HTTPException
from tenant_resolver import get_corporate_tenant

ADMIN_API_KEY = os.environ.get('ADMIN_API_KEY')

SUPER_ADMIN_ROLES = {"admin", "editor"}
TENANT_BOUND_ROLES = {"owner"}
ALLOWED_ROLES = SUPER_ADMIN_ROLES | TENANT_BOUND_ROLES


async def require_admin_tenant(
    x_tenant_slug: str | None = Header(default=None),
    x_admin_key:   str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    """
    Tenant-scoped admin guard. Returns the resolved tenant dict.

    The returned dict has an extra `_role` key carrying the JWT role
    so downstream endpoints can apply additional scoping (e.g. read-
    only manifest for owners).
    """
    role: str | None = None
    tenant_slug_from_jwt: str | None = None
    user_id_from_jwt: str | None = None

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
        user_id_from_jwt = claims.get("sub")
        if role not in ALLOWED_ROLES:
            raise HTTPException(status_code=403, detail="Insufficient role")

    # 2) Admin API key fallback (must be explicitly configured)
    elif ADMIN_API_KEY and x_admin_key == ADMIN_API_KEY:
        role = "admin"

    else:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Resolve tenant per role policy.
    if role in TENANT_BOUND_ROLES:
        # Owner: tenant is FORCED to JWT claim. X-Tenant-Slug is ignored.
        # No claim → 403 (founder must have a tenant_slug on its JWT).
        if not tenant_slug_from_jwt:
            raise HTTPException(status_code=403, detail="Tenant claim missing")
        slug = tenant_slug_from_jwt
    else:
        # Super admin: header > JWT > corporate fallback.
        slug = x_tenant_slug or tenant_slug_from_jwt

    if slug:
        from tenant_resolver import _load_by_slug
        t = await _load_by_slug(slug)
        if not t:
            raise HTTPException(status_code=404, detail=f"Tenant '{slug}' not found")
        tenant = dict(t)
    else:
        tenant = dict(await get_corporate_tenant())
    tenant['_role'] = role
    tenant['user_id'] = user_id_from_jwt
    return tenant


def enforce_tenant_match(url_slug: str, tenant: dict) -> None:
    """
    Compare a URL `{slug}` path-parameter against the tenant resolved by
    `require_admin_tenant`. Super-admins are bypassed; owners are
    strictly enforced.

    Raises 404 (NOT 403) on mismatch, to avoid leaking the existence of
    other tenants via timing/error differentiation.
    """
    role = (tenant or {}).get('_role')
    if role in SUPER_ADMIN_ROLES:
        return
    if (tenant or {}).get('slug') != url_slug:
        raise HTTPException(status_code=404, detail="Tenant not found")
