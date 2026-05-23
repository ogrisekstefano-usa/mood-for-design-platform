"""ITER143D · Auth Redirect Governance™.

Tenant-aware redirect resolver for every auth flow (password reset,
magic link, invite, onboarding callback).

Architecture
────────────
Every public auth flow is initiated from one of these origins:

  • www.moodfordesign.com         → marketing / signup
  • blueprint.moodfordesign.com   → platform / Blueprint Command Center
  • studio.moodfordesign.com      → Golden Demo Tenant™
  • {slug}.moodfordesign.com      → real tenant runtime
  • localhost / preview env       → dev only

For ANY auth email we send, the `redirect_to` URL MUST land back on the
ORIGIN the user came from. Never `www`. Never the bare root. Never
Supabase's default Site URL. Never a hardcoded subdomain.

This service is the single authority for that resolution.
"""
from __future__ import annotations

import logging
import os
from typing import Optional, Tuple
from urllib.parse import urlencode, urlparse

logger = logging.getLogger(__name__)

PLATFORM_ROOT = os.environ.get("PLATFORM_ROOT_DOMAIN", "moodfordesign.com").lower()

# Canonical app surfaces (used only when origin is unknown / non-tenant).
PLATFORM_DOMAIN  = f"blueprint.{PLATFORM_ROOT}"
CORPORATE_DOMAIN = f"www.{PLATFORM_ROOT}"
GOLDEN_DEMO      = f"studio.{PLATFORM_ROOT}"

# Reserved subdomains that must NEVER be treated as tenants.
RESERVED = {"www", "blueprint", "app", "api", "admin", "support",
            "help", "blog", "docs", "status", "staging", "preview", "dev"}


def _strip_port(host: str) -> str:
    return (host or "").split(":", 1)[0].strip().lower()


def _is_dev_host(host: str) -> bool:
    h = _strip_port(host)
    return (h in ("localhost", "127.0.0.1")
            or h.endswith(".localhost")
            or h.endswith(".preview.emergentagent.com")
            or h.endswith(".emergent.sh"))


def normalize_origin(host: Optional[str], scheme: str = "https") -> str:
    """Return a clean scheme://host base URL with no path/query."""
    h = _strip_port(host or "")
    if not h:
        return f"{scheme}://{PLATFORM_DOMAIN}"
    # In dev we honour the literal host (no TLS rewriting beyond scheme).
    return f"{scheme}://{h}"


def parse_subdomain(host: str) -> Tuple[Optional[str], bool]:
    """Return (subdomain, is_reserved) for the given host.

    • Returns (None, False) for the bare root, www, or non-platform hosts.
    • Returns (sub, True) for reserved subdomains (blueprint, api, …).
    • Returns (sub, False) for an unreserved subdomain that COULD be a
      tenant slug (e.g. 'studio', 'format').
    """
    h = _strip_port(host or "")
    if not h:
        return (None, False)
    if h == PLATFORM_ROOT or h == f"www.{PLATFORM_ROOT}":
        return (None, False)
    suffix = "." + PLATFORM_ROOT
    if h.endswith(suffix):
        sub = h[: -len(suffix)]
        if "." in sub:
            sub = sub.split(".", 1)[0]
        return (sub, sub in RESERVED)
    return (None, False)


def classify_origin(host: str) -> str:
    """Return one of: 'platform' | 'corporate' | 'tenant' | 'demo' | 'dev' | 'unknown'."""
    h = _strip_port(host or "")
    if not h:
        return "unknown"
    if _is_dev_host(h):
        return "dev"
    if h == PLATFORM_DOMAIN:
        return "platform"
    if h == CORPORATE_DOMAIN or h == PLATFORM_ROOT:
        return "corporate"
    if h == GOLDEN_DEMO:
        return "demo"
    sub, reserved = parse_subdomain(h)
    if sub and not reserved:
        return "tenant"
    if sub and reserved:
        return "platform"  # blueprint/api/admin → platform layer
    return "unknown"


def build_callback_url(
    request_host: str,
    flow: str,
    *,
    next_path: Optional[str] = None,
    scheme: str = "https",
) -> str:
    """Compute the absolute URL that Supabase (or any provider) must
    redirect the user back to after a recovery / magic-link / invite.

    The CALLBACK is always the platform entry point (Blueprint), which
    then performs tenant resolution and bounces the user to the correct
    tenant subdomain. This keeps callback URLs FINITE (we only need to
    whitelist a single redirect URL on Supabase: `blueprint.../auth/callback`).

    flow ∈ {'recovery', 'invite', 'magic_link', 'onboarding', 'verify'}
    """
    origin = _strip_port(request_host or "")
    # The callback ALWAYS goes to Blueprint — it is the orchestration
    # entry point. Blueprint then dispatches the user to the right
    # tenant (via `next_path` and the resolved tenant context).
    if _is_dev_host(origin):
        base = normalize_origin(origin, scheme="https")
    else:
        base = f"{scheme}://{PLATFORM_DOMAIN}"
    params = {"flow": flow}
    if origin and not _is_dev_host(origin):
        params["origin"] = origin
    if next_path:
        params["next"] = next_path
    return f"{base}/auth/callback?{urlencode(params)}"


def build_tenant_url(host: str, path: str = "/", scheme: str = "https") -> str:
    """Compose an absolute URL for the tenant the request originated from.

    Used inside email bodies (CTAs, login links) to land the recipient
    back on THEIR subdomain (not on blueprint, not on www, not on the
    bare root)."""
    base = normalize_origin(host, scheme=scheme)
    if not path.startswith("/"):
        path = "/" + path
    return f"{base}{path}"


def resolve_email_context(host: str) -> dict:
    """Return everything an email template needs to know about origin.

    Shape:
      {
        host,               # 'studio.moodfordesign.com'
        origin_url,         # 'https://studio.moodfordesign.com'
        kind,               # 'platform'|'tenant'|'demo'|'corporate'|'dev'|'unknown'
        subdomain,          # 'studio' or None
        login_url,          # tenant-aware /auth/login
        support_url,        # tenant-aware /support
      }
    """
    h = _strip_port(host or "") or PLATFORM_DOMAIN
    kind = classify_origin(h)
    sub, _ = parse_subdomain(h)
    base = normalize_origin(h)
    return {
        "host":        h,
        "origin_url":  base,
        "kind":        kind,
        "subdomain":   sub,
        "login_url":   f"{base}/auth/login",
        "support_url": f"{base}/support",
    }
