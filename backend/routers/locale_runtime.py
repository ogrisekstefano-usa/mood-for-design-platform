"""Phase P0.2.A — LocalizationRuntime™ endpoints.

Single source of truth used by:
  • UI shell (LocaleRuntimeProvider)
  • AI engines (Compose, Strategic, Perspective, …)
  • Editorial / Magazine / Storefront surfaces

Endpoints:
  GET    /api/locale-runtime/resolve         active profile for this request
  GET    /api/locale-runtime/resolve/public  anonymous-friendly resolver
  PUT    /api/locale-runtime/preference      persist user preferred locale
  PUT    /api/locale-runtime/tenant-default  persist tenant default (admin only)
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from database import db
from core.tenant_context import get_tenant_context
from core.locale_runtime import (
    SUPPORTED_LOCALES,
    SYSTEM_FALLBACK,
    resolve_profile,
    resolve_from_request,
    _parse_accept_language,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["locale-runtime"])


# ─── Models ──────────────────────────────────────────────────────────────

class PreferenceIn(BaseModel):
    locale_code: str = Field(..., min_length=4, max_length=8)


class TenantDefaultIn(BaseModel):
    locale_code: str = Field(..., min_length=4, max_length=8)


# ─── Endpoints ───────────────────────────────────────────────────────────

@router.get("/locale-runtime/resolve")
def resolve_runtime(
    request: Request,
    project_id: Optional[str] = None,
    lead_id: Optional[str] = None,
    locale_code: Optional[str] = None,  # explicit override (e.g. preview mode)
    ctx=Depends(get_tenant_context),
):
    """Resolve the active locale_profile for the current request following
    the priority chain. Optional `project_id` / `lead_id` query params bias
    the resolution toward that entity's locale."""
    c = db()
    res = resolve_from_request(
        c,
        request=request,
        tenant_id=ctx["tenant_id"],
        profile_id=ctx.get("profile_id"),
        project_id=project_id,
        lead_id=lead_id,
        requested_locale=locale_code,
    )
    return {
        "locale_code": res["locale_code"],
        "requested":   res["requested"],
        "source":      res["source"],
        "candidates":  res["candidates"],
        "profile":     res["profile"],
        "supported":   SUPPORTED_LOCALES,
    }


@router.put("/locale-runtime/preference")
def set_user_preference(body: PreferenceIn,
                        ctx=Depends(get_tenant_context)):
    """Persist the user's preferred locale_code. Wins over project, lead,
    tenant and browser signals on every subsequent resolve call."""
    if not ctx.get("profile_id"):
        raise HTTPException(401, "authenticated profile required")
    code = body.locale_code.upper().strip()
    if code not in SUPPORTED_LOCALES:
        raise HTTPException(400, f"unsupported locale: {code}")
    c = db()
    c.table("users_profile").update(
        {"preferred_locale_code": code}
    ).eq("id", ctx["profile_id"]).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True, "locale_code": code, "source": "user"}


@router.put("/locale-runtime/tenant-default")
def set_tenant_default(body: TenantDefaultIn,
                       ctx=Depends(get_tenant_context)):
    """Persist the tenant default locale_code. Only studio owners /
    super-admins should call this."""
    role = (ctx.get("role") or "").lower()
    if role not in ("super_admin", "studio_owner", "owner"):
        raise HTTPException(403, "only studio owners can set the tenant default locale")
    code = body.locale_code.upper().strip()
    if code not in SUPPORTED_LOCALES:
        raise HTTPException(400, f"unsupported locale: {code}")
    c = db()
    c.table("tenants").update(
        {"default_locale_code": code}
    ).eq("id", ctx["tenant_id"]).execute()
    return {"ok": True, "locale_code": code, "source": "tenant"}


# ─── Public (anonymous) resolver — Phase P0.2.C ─────────────────────────
#
# Onboarding wizards, storefront pages, and magazine articles all need the
# cultural runtime BEFORE the visitor authenticates. This endpoint
# enforces NO auth and uses a relaxed priority chain:
#
#   explicit > saved onboarding > browser (weak) > tenant default > IT_IT
#
# `tenant_slug` is optional — provided, we look up tenant default; without
# it, we skip the tenant step. Browser locale remains a WEAK signal:
# never overrides an explicit query param.

@router.get("/locale-runtime/resolve/public")
def resolve_runtime_public(
    request: Request,
    tenant_slug: Optional[str] = None,
    locale_code: Optional[str] = None,
    saved_locale: Optional[str] = None,  # client-stored onboarding pref
):
    """Anonymous-friendly locale resolution for public surfaces."""
    c = db()
    requested = (locale_code or "").upper().strip() or None
    saved = (saved_locale or "").upper().strip() or None
    if requested and requested not in SUPPORTED_LOCALES:
        requested = None  # ignore invalid explicit
    if saved and saved not in SUPPORTED_LOCALES:
        saved = None

    candidates = {
        "explicit": requested,
        "saved":    saved,
        "browser":  _parse_accept_language(request.headers.get("accept-language")),
        "tenant":   None,
        "system":   SYSTEM_FALLBACK,
    }

    # Resolve tenant default (if a tenant slug is provided).
    if tenant_slug:
        try:
            tt = (c.table("tenants").select("default_locale_code")
                  .eq("slug", tenant_slug).limit(1).execute().data or [])
            if tt and tt[0].get("default_locale_code"):
                candidates["tenant"] = tt[0]["default_locale_code"].upper()
        except Exception as e:
            logger.warning(f"public resolve: tenant lookup failed: {e}")

    # Priority chain: explicit > saved onboarding > browser > tenant > system
    # Note: order differs from authenticated resolve — user/project/lead
    # signals are not available in public flows.
    source = "system"
    code = SYSTEM_FALLBACK
    for key in ("explicit", "saved", "browser", "tenant", "system"):
        v = candidates.get(key)
        if v:
            code = v
            source = key
            break

    profile = resolve_profile(c, code)
    if profile and profile["locale_code"] != code:
        source = f"{source}:fallback"
    if profile is None:
        profile = {
            "locale_code": SYSTEM_FALLBACK, "language": "it", "market": "IT",
            "display_name": "Italia",
        }

    return {
        "locale_code": profile["locale_code"],
        "requested":   code,
        "source":      source,
        "candidates":  candidates,
        "profile":     profile,
        "supported":   SUPPORTED_LOCALES,
    }
