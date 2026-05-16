"""Phase P0.2.A — LocalizationRuntime™ endpoints.

Single source of truth used by:
  • UI shell (LocaleRuntimeProvider)
  • AI engines (Compose, Strategic, Perspective, …)
  • Editorial / Magazine / Storefront surfaces

Endpoints:
  GET    /api/locale-runtime/resolve         active profile for this request
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
    resolve_from_request,
    SUPPORTED_LOCALES,
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
