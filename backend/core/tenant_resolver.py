"""Tenant resolver — ITER142 SaaS Foundation™

Resolve the active tenant from the request in three layers (descending
precedence):

  1. `X-Tenant-Override` header (SuperAdmin impersonation, audit-logged).
  2. Subdomain on the request Host (`{slug}.moodfordesign.com`).
  3. JWT bearer's profile.tenant_id (default user-scoped behaviour).

The middleware never raises — it just populates `request.state.resolved_tenant`
with a dict of `{tenant_id, source, host, subdomain}` so downstream
dependencies (`get_tenant_context`) can use it.

We intentionally keep this READ-ONLY against the DB (no inserts) so it
is safe to mount globally.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from database import db

logger = logging.getLogger(__name__)

# Domains we own. Add custom domains here once provisioned (P2).
ROOT_DOMAINS = (
    "moodfordesign.com",
)
RESERVED_SUBDOMAINS = {
    # Marketing / app shell — never tenant-scoped:
    "www", "app", "api", "admin", "staging", "preview", "dev",
    "docs", "status", "support", "blog", "help",
}


def _strip_port(host: str) -> str:
    return (host or "").split(":", 1)[0].strip().lower()


def _extract_subdomain(host: str) -> Optional[str]:
    """Return the `{slug}` from `{slug}.moodfordesign.com`. None for any
    other host (preview env, IP, root domain, www/api/admin reserved).
    """
    h = _strip_port(host)
    if not h:
        return None
    for root in ROOT_DOMAINS:
        if h == root or h == f"www.{root}":
            return None
        suffix = "." + root
        if h.endswith(suffix):
            sub = h[: -len(suffix)]
            if "." in sub:
                # e.g. design.format.moodfordesign.com → take leftmost
                sub = sub.split(".", 1)[0]
            if sub in RESERVED_SUBDOMAINS:
                return None
            return sub
    return None


def resolve_tenant_from_host(host: str) -> Optional[dict]:
    """Resolve tenant_id from a Host header. None if no match."""
    sub = _extract_subdomain(host)
    if not sub:
        return None
    try:
        c = db()
        # Try tenant_domains first (custom subdomain mapping → wins),
        # then fall back to tenants.slug (the conventional path).
        row = (c.table("tenant_subdomain_lookup")
               .select("tenant_id,subdomain,tenant_slug,hostname")
               .eq("subdomain", sub).limit(1).execute().data or [])
        if row:
            return {
                "tenant_id": row[0]["tenant_id"],
                "source": "tenant_domains",
                "host": host,
                "subdomain": sub,
                "tenant_slug": row[0].get("tenant_slug"),
            }
        row = (c.table("tenants").select("id,slug,status")
               .eq("slug", sub).limit(1).execute().data or [])
        if row and row[0].get("status") == "active":
            return {
                "tenant_id": row[0]["id"],
                "source": "tenants.slug",
                "host": host,
                "subdomain": sub,
                "tenant_slug": row[0]["slug"],
            }
    except Exception as e:
        logger.warning("tenant_resolver: lookup failed for sub=%s — %s", sub, e)
    return None


class TenantResolverMiddleware(BaseHTTPMiddleware):
    """Populates `request.state.resolved_tenant` for downstream consumers.

    The downstream dependency `get_tenant_context` may use this as a hint
    BEFORE falling back to the JWT user's profile.tenant_id. Reserved
    subdomains and missing Host headers result in `resolved_tenant=None`,
    which means "use the JWT default".
    """
    async def dispatch(self, request: Request, call_next):
        host = request.headers.get("host", "")
        resolved = resolve_tenant_from_host(host)
        request.state.resolved_tenant = resolved
        if resolved:
            request.state.resolved_subdomain = resolved.get("subdomain")
        return await call_next(request)
