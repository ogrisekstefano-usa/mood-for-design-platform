"""Tenant settings — branding, theme, domains.

Phase B: full Theme Engine + domain management + asset hooks.
"""
import uuid
import re
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from middleware.auth import get_current_user
from core.permissions import (
    P_TENANT_BRANDING, P_TENANT_LOCALES, P_TENANT_SETTINGS,
)
from core.tenant_context import (
    get_tenant_context, get_tenant_settings, upsert_tenant_setting,
    audit_log, require_permission,
)
from core.theme_engine import resolve_theme, DEFAULT_THEME, GOOGLE_FONTS_CATALOG
from core.licensing import assert_storage_capacity
from database import db

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


# ── Schemas ──────────────────────────────────────────────────────────────────
class BrandingUpdate(BaseModel):
    logo_url: Optional[str] = None
    name: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    font_heading: Optional[str] = None
    font_body: Optional[str] = None


class LocalesUpdate(BaseModel):
    default_language: Optional[str] = None
    active_languages: Optional[list] = None


class ThemeUpdate(BaseModel):
    """Partial theme update — deep-merged with existing overrides."""
    palette: Optional[Dict[str, Any]] = None
    typography: Optional[Dict[str, Any]] = None
    editorial: Optional[Dict[str, Any]] = None
    shape: Optional[Dict[str, Any]] = None
    spacing: Optional[Dict[str, Any]] = None
    elevation: Optional[Dict[str, Any]] = None
    motion: Optional[Dict[str, Any]] = None
    atmosphere: Optional[Dict[str, Any]] = None
    components: Optional[Dict[str, Any]] = None
    assets: Optional[Dict[str, Any]] = None
    mode: Optional[str] = None


class DomainCreate(BaseModel):
    domain: str = Field(min_length=3, max_length=200)
    is_primary: bool = False


# ── Branding (back-compat with Phase 1) ──────────────────────────────────────
@router.put("/branding")
def update_branding(body: BrandingUpdate,
                    ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    tenant_id = ctx["tenant_id"]
    client = db()
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(400, "No fields")
    payload["updated_at"] = _now()
    r = client.table("tenants").update(payload).eq("id", tenant_id).execute()
    audit_log(tenant_id, ctx["profile_id"], "branding.update",
              resource_type="tenant", resource_id=tenant_id, metadata=payload)
    return r.data[0] if r.data else {}


@router.put("/locales")
def update_locales(body: LocalesUpdate,
                   ctx: dict = Depends(require_permission(P_TENANT_LOCALES))):
    tenant_id = ctx["tenant_id"]
    client = db()
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(400, "No fields")
    payload["updated_at"] = _now()
    r = client.table("tenants").update(payload).eq("id", tenant_id).execute()
    audit_log(tenant_id, ctx["profile_id"], "locales.update",
              resource_type="tenant", resource_id=tenant_id, metadata=payload)
    return r.data[0] if r.data else {}


# ── Theme Engine ─────────────────────────────────────────────────────────────
@router.get("/theme")
def get_theme(ctx: dict = Depends(get_tenant_context)):
    """Returns: { default, overrides, effective } — frontend renders from `effective`."""
    overrides = get_tenant_settings(ctx["tenant_id"], "theme", {}) or {}
    return {
        "default": DEFAULT_THEME,
        "overrides": overrides,
        "effective": resolve_theme(overrides),
    }


@router.put("/theme")
def update_theme(body: ThemeUpdate,
                 ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    tenant_id = ctx["tenant_id"]
    current = get_tenant_settings(tenant_id, "theme", {}) or {}
    payload = {k: v for k, v in body.model_dump().items() if v is not None}

    # Deep merge into existing overrides
    def _merge(base, over):
        if not isinstance(over, dict):
            return over
        out = {**base}
        for k, v in over.items():
            if isinstance(v, dict) and isinstance(out.get(k), dict):
                out[k] = _merge(out[k], v)
            else:
                out[k] = v
        return out

    merged = _merge(current, payload)
    upsert_tenant_setting(tenant_id, "theme", merged)

    # Mirror critical brand fields on tenants table (back-compat with magazine/public pages)
    palette = merged.get("palette") or {}
    typo = merged.get("typography") or {}
    assets = merged.get("assets") or {}
    mirror = {}
    if palette.get("primary"):  mirror["primary_color"]   = palette["primary"]
    if palette.get("accent"):   mirror["secondary_color"] = palette["accent"]
    if typo.get("font_heading"): mirror["font_heading"] = typo["font_heading"]
    if typo.get("font_body"):    mirror["font_body"]    = typo["font_body"]
    if assets.get("logo_dark"):  mirror["logo_url"]     = assets["logo_dark"]
    if mirror:
        mirror["updated_at"] = _now()
        db().table("tenants").update(mirror).eq("id", tenant_id).execute()

    audit_log(tenant_id, ctx["profile_id"], "theme.update",
              resource_type="tenant", resource_id=tenant_id,
              metadata={"keys": list(payload.keys())})
    return {"overrides": merged, "effective": resolve_theme(merged)}


@router.post("/theme/reset")
def reset_theme(ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    upsert_tenant_setting(ctx["tenant_id"], "theme", {})
    audit_log(ctx["tenant_id"], ctx["profile_id"], "theme.reset",
              resource_type="tenant", resource_id=ctx["tenant_id"])
    return {"overrides": {}, "effective": DEFAULT_THEME}


# ── Font catalog ─────────────────────────────────────────────────────────────
@router.get("/fonts/catalog")
def fonts_catalog(ctx: dict = Depends(get_tenant_context)):
    return {"fonts": GOOGLE_FONTS_CATALOG}


# ── Domain management ───────────────────────────────────────────────────────
_DOMAIN_RE = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$", re.I)


@router.get("/domains")
def list_domains(ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    client = db()
    r = client.table("tenant_domains").select("*").eq("tenant_id", ctx["tenant_id"]).order("created_at", desc=False).execute()
    return {"data": r.data or []}


@router.post("/domains", status_code=201)
def add_domain(body: DomainCreate,
               ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    raw = body.domain.lower().strip()
    for prefix in ("https://", "http://"):
        if raw.startswith(prefix):
            raw = raw[len(prefix):]
    domain = raw.rstrip("/")
    if not _DOMAIN_RE.match(domain):
        raise HTTPException(400, "Invalid domain format")
    client = db()
    # Unicity check
    existing = client.table("tenant_domains").select("id").eq("domain", domain).limit(1).execute()
    if existing.data:
        raise HTTPException(409, "Domain already in use")
    now = _now()
    record = {
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "domain": domain,
        "type": "custom_domain" if "." in domain else "platform_subdomain",
        "is_primary": body.is_primary,
        "verification_status": "pending",
        "created_at": now,
    }
    client.table("tenant_domains").insert(record).execute()

    if body.is_primary:
        # Unset other primaries for this tenant
        client.table("tenant_domains").update({"is_primary": False}) \
            .eq("tenant_id", ctx["tenant_id"]).neq("id", record["id"]).execute()

    audit_log(ctx["tenant_id"], ctx["profile_id"], "domain.add",
              resource_type="tenant_domain", resource_id=record["id"], metadata={"domain": domain})
    return record


@router.delete("/domains/{domain_id}")
def delete_domain(domain_id: str,
                  ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    client = db()
    client.table("tenant_domains").delete().eq("id", domain_id).eq("tenant_id", ctx["tenant_id"]).execute()
    audit_log(ctx["tenant_id"], ctx["profile_id"], "domain.delete",
              resource_type="tenant_domain", resource_id=domain_id)
    return {"message": "deleted"}


# ── Asset upload completion hook ────────────────────────────────────────────
@router.post("/assets/register")
def register_brand_asset(
    body: dict = Body(...),
    ctx: dict = Depends(require_permission(P_TENANT_BRANDING)),
):
    """Called after the client uploads a brand asset via signed URL.

    Records in media_library AND updates theme.assets in one step.
    Expected body: { kind: 'logo_dark'|'logo_light'|'logo_mobile'|'favicon'|'og_image',
                     bucket: 'tenant-assets', storage_path, file_name, file_type, file_size }
    """
    kind = body.get("kind")
    if kind not in ("logo_dark", "logo_light", "logo_mobile", "favicon", "og_image"):
        raise HTTPException(400, "Invalid asset kind")
    bucket = body.get("bucket") or "tenant-assets"
    path = body.get("storage_path")
    if not path:
        raise HTTPException(400, "storage_path required")

    # Storage quota gate — refuse if upload would push tenant over budget.
    file_size = body.get("file_size")
    if file_size:
        assert_storage_capacity(ctx["tenant_id"], int(file_size))

    client = db()
    safe_path = path if path.startswith(ctx["tenant_id"] + "/") else f"{ctx['tenant_id']}/{path}"
    public_url = client.storage.from_(bucket).get_public_url(safe_path)
    now = _now()

    # Media library
    client.table("media_library").insert({
        "id": str(uuid.uuid4()), "tenant_id": ctx["tenant_id"], "uploaded_by": ctx["profile_id"],
        "bucket": bucket, "storage_path": safe_path, "file_url": public_url,
        "file_name": body.get("file_name") or kind, "file_type": body.get("file_type"),
        "file_size": body.get("file_size"), "category": "brand",
        "alt_text": kind, "tags": ["brand", kind], "metadata_json": {"kind": kind},
        "created_at": now,
    }).execute()

    # Update theme.assets
    current = get_tenant_settings(ctx["tenant_id"], "theme", {}) or {}
    assets = dict(current.get("assets") or {})
    assets[kind] = public_url
    current["assets"] = assets
    upsert_tenant_setting(ctx["tenant_id"], "theme", current)

    # Mirror logo_dark to tenants.logo_url
    if kind == "logo_dark":
        db().table("tenants").update({"logo_url": public_url, "updated_at": now}).eq("id", ctx["tenant_id"]).execute()

    audit_log(ctx["tenant_id"], ctx["profile_id"], f"asset.{kind}.upload",
              resource_type="tenant", resource_id=ctx["tenant_id"])
    return {"kind": kind, "url": public_url, "assets": assets}
