"""Brand Studio — tenant branding + theme overrides + curated presets.

Endpoints:
  GET    /api/branding                  current tenant branding + theme
  PUT    /api/branding                  upsert branding_settings + theme_settings
  GET    /api/branding/presets          curated theme presets
  POST   /api/branding/apply-preset     apply a preset key to the tenant
"""
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.tenant_context import require_permission, audit_log
from core.permissions import P_TENANT_BRANDING
from database import db

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Schemas ──────────────────────────────────────────────────────────
class Branding(BaseModel):
    public_brand_name: Optional[str] = None
    tagline: Optional[str] = None
    short_description: Optional[str] = None
    long_manifesto: Optional[str] = None
    website_url: Optional[str] = None
    support_email: Optional[str] = None
    phone: Optional[str] = None
    social_links: Optional[List[Dict[str, str]]] = None
    primary_logo_url: Optional[str] = None
    monochrome_logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    social_og_logo_url: Optional[str] = None


class ThemePalette(BaseModel):
    primary: Optional[str] = None
    secondary: Optional[str] = None
    accent: Optional[str] = None
    background: Optional[str] = None
    surface: Optional[str] = None
    text_primary: Optional[str] = None
    text_secondary: Optional[str] = None
    border: Optional[str] = None
    success: Optional[str] = None
    warning: Optional[str] = None
    danger: Optional[str] = None


class ThemeTypography(BaseModel):
    display: Optional[str] = None
    body: Optional[str] = None


class Theme(BaseModel):
    preset_key: Optional[str] = None
    palette: Optional[ThemePalette] = None
    typography: Optional[ThemeTypography] = None
    radius: Optional[str] = None           # "0px" | "2px" | "4px" | "8px" | "12px"
    density: Optional[str] = None          # "compact" | "comfortable" | "spacious"
    shadow: Optional[str] = None           # "none" | "soft" | "medium" | "strong"


class BrandingUpsert(BaseModel):
    branding: Optional[Branding] = None
    theme: Optional[Theme] = None


class ApplyPresetBody(BaseModel):
    preset_key: str = Field(min_length=1)


# ── Helpers ──────────────────────────────────────────────────────────
def _get_tenant(client, tenant_id: str) -> dict:
    r = client.table("tenants").select(
        "id, slug, name, branding_settings, theme_settings"
    ).eq("id", tenant_id).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Tenant not found")
    return r.data[0]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Endpoints ────────────────────────────────────────────────────────
@router.get("")
def get_branding(ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    client = db()
    t = _get_tenant(client, ctx["tenant_id"])
    return {
        "tenant_id": t["id"],
        "tenant_name": t.get("name"),
        "branding": t.get("branding_settings") or {},
        "theme":    t.get("theme_settings") or {},
    }


@router.put("")
def update_branding(
    body: BrandingUpsert,
    ctx: dict = Depends(require_permission(P_TENANT_BRANDING)),
):
    client = db()
    t = _get_tenant(client, ctx["tenant_id"])
    update: Dict[str, Any] = {}

    if body.branding is not None:
        existing = t.get("branding_settings") or {}
        # Merge — only update keys explicitly provided (drop None)
        patch = {k: v for k, v in body.branding.model_dump().items() if v is not None}
        update["branding_settings"] = {**existing, **patch}

    if body.theme is not None:
        existing = t.get("theme_settings") or {}
        # Deep-ish merge: palette & typography are dicts inside the theme.
        theme_in = body.theme.model_dump(exclude_none=True)
        merged = {**existing, **{k: v for k, v in theme_in.items()
                                 if k not in ("palette", "typography")}}
        if "palette" in theme_in:
            merged["palette"] = {**(existing.get("palette") or {}), **theme_in["palette"]}
        if "typography" in theme_in:
            merged["typography"] = {**(existing.get("typography") or {}), **theme_in["typography"]}
        update["theme_settings"] = merged

    if not update:
        return {"branding": t.get("branding_settings") or {}, "theme": t.get("theme_settings") or {}}

    client.table("tenants").update(update).eq("id", t["id"]).execute()
    audit_log(ctx["tenant_id"], ctx["profile_id"], "branding.updated",
              resource_type="tenant", resource_id=t["id"],
              metadata={"keys_changed": list(update.keys())})
    fresh = _get_tenant(client, t["id"])
    return {
        "tenant_id": fresh["id"],
        "branding": fresh.get("branding_settings") or {},
        "theme":    fresh.get("theme_settings") or {},
    }


@router.get("/presets")
def list_presets(_ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    client = db()
    r = client.table("theme_presets").select(
        "key, label, description, vibe_tags, preview_url, theme, is_default, sort_order"
    ).order("sort_order").execute()
    return {"presets": r.data or []}


@router.post("/apply-preset")
def apply_preset(
    body: ApplyPresetBody,
    ctx: dict = Depends(require_permission(P_TENANT_BRANDING)),
):
    client = db()
    r = client.table("theme_presets").select("key, theme") \
        .eq("key", body.preset_key).limit(1).execute()
    if not r.data:
        raise HTTPException(404, f"Preset '{body.preset_key}' not found")
    preset = r.data[0]
    theme = preset["theme"] or {}
    theme["preset_key"] = preset["key"]
    client.table("tenants").update({"theme_settings": theme}).eq("id", ctx["tenant_id"]).execute()
    audit_log(ctx["tenant_id"], ctx["profile_id"], "branding.preset_applied",
              resource_type="tenant", resource_id=ctx["tenant_id"],
              metadata={"preset_key": preset["key"]})
    t = _get_tenant(client, ctx["tenant_id"])
    return {
        "tenant_id": t["id"],
        "branding": t.get("branding_settings") or {},
        "theme":    t.get("theme_settings") or {},
    }
