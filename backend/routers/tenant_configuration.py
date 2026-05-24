"""ITER144 · Tenant Configuration API + Blueprint Governance API.

Endpoints
─────────
Tenant-facing (authenticated, scoped to caller's tenant_context):
  GET   /api/tenant/configuration
        → full runtime bundle (configuration + theme + modules + navigation)
  PATCH /api/tenant/configuration
        → tenant_admin / root: patch branding, navigation_overrides,
          feature_flags, enabled_modules, enabled_locales, …
  GET   /api/tenant/configuration/modules
        → list of effective modules

Blueprint Governance™ (root_superadmin only):
  GET   /api/blueprint-admin/feature-modules
        → registry + platform defaults
  PATCH /api/blueprint-admin/feature-modules/{code}
        → set platform_feature_defaults[code]
  GET   /api/blueprint-admin/tenants/{tenant_id}/configuration
        → bundle for any tenant
  PATCH /api/blueprint-admin/tenants/{tenant_id}/configuration
        → override any tenant configuration field
  GET   /api/blueprint-admin/configuration-events
        → full audit log
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from database import db, db_available
from core.tenant_context import get_tenant_context
from middleware.auth import get_current_user, require_root_superadmin
from services.tenant_config_resolver import (
    invalidate_registry,
    invalidate_tenant_config,
    resolve_modules,
    resolve_runtime_bundle,
    resolve_tenant_config,
)

log = logging.getLogger(__name__)
router = APIRouter()
admin_router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Helpers ─────────────────────────────────────────────────────────
_PATCHABLE_TENANT_FIELDS = {
    "primary_color", "secondary_color", "typography_preset",
    "homepage_variant", "editorial_tone", "enabled_locales",
    "default_locale", "enabled_modules", "onboarding_mode",
    "design_journey_variant", "cta_style", "feature_flags",
    "runtime_metadata", "branding", "navigation_overrides",
    "custom_domain", "custom_email_identity",
}


def _audit(
    *, tenant_id: Optional[str], actor: Dict[str, Any],
    event_type: str, scope: str,
    diff_before: Dict[str, Any], diff_after: Dict[str, Any],
    source: str, module_code: Optional[str] = None, notes: Optional[str] = None,
) -> None:
    if not db_available():
        return
    try:
        db().table("configuration_change_events").insert({
            "tenant_id":     tenant_id,
            "actor_user_id": actor.get("profile_id"),
            "actor_email":   actor.get("email"),
            "event_type":    event_type,
            "scope":         scope,
            "source":        source,
            "module_code":   module_code,
            "diff_before":   diff_before,
            "diff_after":    diff_after,
            "notes":         notes,
            "created_at":    _now(),
        }).execute()
    except Exception as e:
        log.warning(f"configuration_change_events insert failed: {e}")


def _ensure_tenant_configuration_row(tenant_id: str) -> Dict[str, Any]:
    """Make sure tenant_configuration has a row for this tenant; return it."""
    c = db()
    rows = (c.table("tenant_configuration").select("*")
            .eq("tenant_id", tenant_id).limit(1).execute().data or [])
    if rows:
        return rows[0]
    inserted = c.table("tenant_configuration").insert({
        "tenant_id": tenant_id,
        "created_at": _now(),
        "updated_at": _now(),
    }).execute().data or []
    return inserted[0] if inserted else {"tenant_id": tenant_id}


def _diff(before: Dict[str, Any], patch: Dict[str, Any]) -> tuple[Dict, Dict]:
    """Return (before_subset, after_subset) restricted to keys in patch."""
    b = {k: before.get(k) for k in patch.keys()}
    a = dict(patch)
    return b, a


# ─── Tenant configuration models ─────────────────────────────────────
class TenantConfigurationPatch(BaseModel):
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    typography_preset: Optional[str] = None
    homepage_variant: Optional[str] = None
    editorial_tone: Optional[str] = None
    enabled_locales: Optional[List[str]] = None
    default_locale: Optional[str] = None
    enabled_modules: Optional[Dict[str, bool]] = None
    onboarding_mode: Optional[str] = None
    design_journey_variant: Optional[str] = None
    cta_style: Optional[str] = None
    feature_flags: Optional[Dict[str, Any]] = None
    runtime_metadata: Optional[Dict[str, Any]] = None
    branding: Optional[Dict[str, Any]] = None
    navigation_overrides: Optional[Dict[str, Any]] = None
    custom_domain: Optional[str] = None
    custom_email_identity: Optional[Dict[str, Any]] = None


# ─── GET /api/tenant/configuration ───────────────────────────────────
@router.get("/configuration")
def get_tenant_configuration(request: Request, ctx: dict = Depends(get_tenant_context)):
    """Return the runtime bundle for the caller's tenant.

    NB: this includes navigation filtered for the caller's role/visibility,
    so the frontend can render the sidebar without any further branching.
    Also exposes the resolved subdomain (when reachable via wildcard
    runtime) and the resolved email identity source.
    """
    bundle = resolve_runtime_bundle(
        tenant_id=ctx.get("tenant_id"),
        user_role=ctx.get("role"),
        is_super_admin=(ctx.get("role") == "super_admin"),
        is_root=bool(ctx.get("is_root_superadmin")),
    )
    # ITER144 · Wildcard Tenant Runtime™ — expose subdomain resolution
    resolved = getattr(request.state, "resolved_tenant", None) or {}
    bundle["runtime"] = {
        "resolved_subdomain": resolved.get("subdomain"),
        "resolved_host":      resolved.get("host"),
        "resolution_source":  resolved.get("source"),
        "tenant_slug":        resolved.get("tenant_slug"),
        "impersonating":      bool(ctx.get("impersonating")),
    }
    # ITER144 · Email Identity Runtime™ — expose identity source
    try:
        from services.email_service import resolve_email_identity
        identity = resolve_email_identity(ctx.get("tenant_id"))
        bundle["email_identity"] = {
            "source":        identity["source"],
            "from_address":  identity["from_address"],
            "reply_to":      identity["reply_to"],
            "sender_email":  identity.get("sender_email"),
            "logo_url":      identity.get("logo_url"),
        }
    except Exception:
        bundle["email_identity"] = {"source": "unknown"}

    # ITER145.A · Tenant Locale Orchestration™ — surface enabled_locales,
    # default_locale, fallback chain (frontend selectors consume from here).
    try:
        from services.email_editorial_resolver import resolve_enabled_locales
        bundle["locales"] = resolve_enabled_locales(ctx.get("tenant_id"))
    except Exception:
        bundle["locales"] = {"enabled_locales": [], "default_locale": "it-IT",
                             "fallback_locale": "it-IT", "locale_source": "unknown"}
    return bundle


@router.get("/configuration/modules")
def get_tenant_modules(ctx: dict = Depends(get_tenant_context)):
    return {"modules": resolve_modules(ctx.get("tenant_id"))}


# ─── PATCH /api/tenant/configuration ─────────────────────────────────
def _require_tenant_admin_or_root(ctx: dict):
    role = ctx.get("role")
    if not (role in ("tenant_admin", "super_admin") or ctx.get("is_root_superadmin")):
        raise HTTPException(403, "tenant_admin required")


@router.patch("/configuration")
def patch_tenant_configuration(
    patch: TenantConfigurationPatch,
    ctx: dict = Depends(get_tenant_context),
):
    _require_tenant_admin_or_root(ctx)
    tenant_id = ctx.get("tenant_id")
    if not tenant_id:
        raise HTTPException(400, "no tenant scope")
    if not db_available():
        raise HTTPException(503, "database unavailable")

    update = {k: v for k, v in patch.model_dump(exclude_none=True).items()
              if k in _PATCHABLE_TENANT_FIELDS}
    if not update:
        raise HTTPException(400, "no patchable fields supplied")

    before = _ensure_tenant_configuration_row(tenant_id)
    update["updated_at"] = _now()
    db().table("tenant_configuration").update(update) \
        .eq("tenant_id", tenant_id).execute()
    invalidate_tenant_config(tenant_id)

    diff_b, diff_a = _diff(before, update)
    _audit(
        tenant_id=tenant_id, actor=ctx,
        event_type="tenant.configuration.patch",
        scope="tenant",
        diff_before=diff_b, diff_after=diff_a,
        source="tenant_admin_ui",
    )
    return resolve_runtime_bundle(
        tenant_id=tenant_id,
        user_role=ctx.get("role"),
        is_super_admin=(ctx.get("role") == "super_admin"),
        is_root=bool(ctx.get("is_root_superadmin")),
    )


# ─── Blueprint Governance™ : Feature modules registry ────────────────
@admin_router.get("/feature-modules")
def list_feature_modules(user: dict = Depends(require_root_superadmin)):
    if not db_available():
        return {"modules": [], "platform_defaults": {}}
    c = db()
    modules = (c.table("feature_modules_registry")
               .select("*").order("position").execute().data or [])
    defaults = (c.table("platform_feature_defaults")
                .select("module_code, state, updated_at").execute().data or [])
    return {"modules": modules, "platform_defaults": defaults}


class PlatformDefaultPatch(BaseModel):
    state: str = Field(..., pattern="^(enabled|disabled|beta|hidden|locked)$")


@admin_router.patch("/feature-modules/{code}")
def patch_platform_default(
    code: str,
    payload: PlatformDefaultPatch,
    user: dict = Depends(require_root_superadmin),
):
    if not db_available():
        raise HTTPException(503, "database unavailable")
    c = db()
    existing = (c.table("feature_modules_registry")
                .select("code, is_core, default_state")
                .eq("code", code).limit(1).execute().data or [])
    if not existing:
        raise HTTPException(404, "module not found")
    if existing[0].get("is_core") and payload.state == "disabled":
        raise HTTPException(400, "core modules cannot be disabled")

    prev = (c.table("platform_feature_defaults").select("state")
            .eq("module_code", code).limit(1).execute().data or [])
    prev_state = prev[0]["state"] if prev else existing[0]["default_state"]

    c.table("platform_feature_defaults").upsert({
        "module_code": code,
        "state":       payload.state,
        "updated_by":  user.get("profile_id"),
        "updated_at":  _now(),
    }, on_conflict="module_code").execute()

    invalidate_registry()

    _audit(
        tenant_id=None, actor=user,
        event_type="platform.feature_default.patch",
        scope="platform",
        diff_before={"state": prev_state},
        diff_after={"state":  payload.state},
        source="blueprint_admin",
        module_code=code,
    )
    return {"ok": True, "module_code": code, "state": payload.state,
            "previous_state": prev_state}


# ─── Blueprint Governance™ : Per-tenant configuration ────────────────
@admin_router.get("/tenants/{tenant_id}/configuration")
def admin_get_tenant_configuration(
    tenant_id: str, user: dict = Depends(require_root_superadmin)
):
    return resolve_runtime_bundle(
        tenant_id=tenant_id,
        user_role="tenant_admin",  # pretend tenant_admin to show all tenant items
        is_super_admin=False, is_root=False,
    )


@admin_router.patch("/tenants/{tenant_id}/configuration")
def admin_patch_tenant_configuration(
    tenant_id: str,
    patch: TenantConfigurationPatch,
    user: dict = Depends(require_root_superadmin),
):
    if not db_available():
        raise HTTPException(503, "database unavailable")
    update = {k: v for k, v in patch.model_dump(exclude_none=True).items()
              if k in _PATCHABLE_TENANT_FIELDS}
    if not update:
        raise HTTPException(400, "no patchable fields supplied")

    before = _ensure_tenant_configuration_row(tenant_id)
    update["updated_at"] = _now()
    db().table("tenant_configuration").update(update) \
        .eq("tenant_id", tenant_id).execute()
    invalidate_tenant_config(tenant_id)

    diff_b, diff_a = _diff(before, update)
    _audit(
        tenant_id=tenant_id, actor=user,
        event_type="tenant.configuration.patch",
        scope="tenant",
        diff_before=diff_b, diff_after=diff_a,
        source="blueprint_admin",
    )
    return resolve_runtime_bundle(
        tenant_id=tenant_id, user_role="tenant_admin",
        is_super_admin=False, is_root=False,
    )


# ─── Blueprint Governance™ : Audit feed ──────────────────────────────
@admin_router.get("/configuration-events")
def list_configuration_events(
    user: dict = Depends(require_root_superadmin),
    tenant_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
):
    if not db_available():
        return {"events": []}
    builder = (db().table("configuration_change_events")
               .select("id, tenant_id, actor_user_id, actor_email, "
                       "event_type, scope, source, module_code, "
                       "diff_before, diff_after, notes, created_at")
               .order("created_at", desc=True).limit(limit))
    if tenant_id:
        builder = builder.eq("tenant_id", tenant_id)
    if event_type:
        builder = builder.eq("event_type", event_type)
    rows = builder.execute().data or []
    return {"events": rows, "count": len(rows)}


# ─── Runtime Context Inspector™ ──────────────────────────────────────
@admin_router.get("/runtime-inspector")
def runtime_inspector(
    request: Request,
    user: dict = Depends(require_root_superadmin),
    tenant_id: Optional[str] = Query(None),
):
    """ITER144 · runtime debugging endpoint.

    Returns the FULL resolution trace for the active tenant (or one
    specified by ?tenant_id=) — branding source, email identity source,
    locale source, navigation count, cache hit/miss, registry version.
    """
    from services.email_service import resolve_email_identity
    from services.tenant_config_resolver import (
        resolve_modules, resolve_navigation, resolve_theme,
    )
    from services.email_editorial_resolver import (
        resolve_enabled_locales, resolve_email_stats,
    )

    tid = tenant_id or user.get("tenant_id")
    cfg = resolve_tenant_config(tid)
    theme = resolve_theme(tid)
    modules = resolve_modules(tid)
    nav = resolve_navigation(tid, "tenant_admin",
                             is_super_admin=False, is_root=False)
    identity = resolve_email_identity(tid)
    locale_info = resolve_enabled_locales(tid)
    email_stats = resolve_email_stats()
    resolved = getattr(request.state, "resolved_tenant", None) or {}

    # Determine branding source
    branding = (cfg or {}).get("branding") or {}
    branding_source = ("tenant_runtime" if branding
                       else ("tenant_legacy" if (cfg or {}).get("primary_color")
                             else "platform_default"))

    # Locale source (legacy — superseded by `locale_info` block below)
    _ = "tenant_default" if cfg.get("default_locale") else "platform_default"

    # Count effective module states
    module_state_counts: Dict[str, int] = {}
    for m in modules:
        s = m["effective_state"]
        module_state_counts[s] = module_state_counts.get(s, 0) + 1

    return {
        "tenant_id": tid,
        "resolved_runtime_identity": {
            "subdomain":         resolved.get("subdomain"),
            "host":              resolved.get("host"),
            "resolution_source": resolved.get("source"),
            "tenant_slug":       resolved.get("tenant_slug"),
            "request_host":      request.headers.get("host"),
        },
        "branding": {
            "source": branding_source,
            "tokens": theme,
        },
        "email_identity": identity,
        "locale": {
            "source":  locale_info["locale_source"],
            "default": locale_info["default_locale"],
            "fallback": locale_info["fallback_locale"],
            "enabled": locale_info["enabled_locales"],
            "available_platform_locales": locale_info["available_platform_locales"],
            "ale_status": {
                "email_blocks":     email_stats.get("blocks", 0),
                "email_translations": email_stats.get("translations", 0),
                "stale_translations": email_stats.get("stale", 0),
                "locales_covered":  email_stats.get("locales_covered", []),
            },
        },
        "modules": {
            "total":         len(modules),
            "state_counts":  module_state_counts,
            "sources":       sorted({m["resolution_source"] for m in modules}),
        },
        "navigation": {
            "groups": len(nav),
            "items":  sum(len(g["items"]) for g in nav),
        },
        "feature_flags":   cfg.get("feature_flags") or {},
        "enabled_modules": cfg.get("enabled_modules") or {},
        "navigation_overrides": cfg.get("navigation_overrides") or {},
        "custom_domain":   cfg.get("custom_domain"),
        "configuration_updated_at": cfg.get("updated_at"),
    }


# ─── Public-ish anonymous bootstrap (for landing pages) ──────────────
# Some unauthenticated SPA routes still want to know which modules are
# public-visible (`nav_visibility='public'`) for a given tenant slug.
@router.get("/configuration/public/{tenant_slug}")
def public_configuration(tenant_slug: str):
    if not db_available():
        raise HTTPException(503, "database unavailable")
    t = (db().table("tenants").select("id, slug")
         .eq("slug", tenant_slug).limit(1).execute().data or [])
    if not t:
        raise HTTPException(404, "tenant not found")
    return resolve_runtime_bundle(
        tenant_id=t[0]["id"], user_role=None,
        is_super_admin=False, is_root=False,
    )
