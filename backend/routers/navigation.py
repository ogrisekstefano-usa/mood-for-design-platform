"""Public Navigation & Footer settings — tenant CRUD.

Stored in `tenant_settings`:
    key='public_navigation'  → top nav schema
    key='public_footer'      → footer schema

Multilingual via i18n label maps: {_default, en-US, it, fr, de, es}.
"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.permissions import P_TENANT_BRANDING
from core.tenant_context import (
    get_tenant_context, get_tenant_settings, upsert_tenant_setting,
    audit_log, require_permission,
)
from routers.public import _default_navigation, _default_footer
from database import db

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


class NavigationUpsert(BaseModel):
    items: Optional[List[Dict[str, Any]]] = None
    cta: Optional[Dict[str, Any]] = None
    logo: Optional[Dict[str, Any]] = None
    sticky: Optional[bool] = None
    transparent_on_hero: Optional[bool] = None
    show_locale_switcher: Optional[bool] = None


class FooterUpsert(BaseModel):
    columns: Optional[List[Dict[str, Any]]] = None
    bottom: Optional[Dict[str, Any]] = None


def _resolve_tenant_row(tenant_id: str) -> dict:
    r = db().table("tenants").select("name").eq("id", tenant_id).limit(1).execute()
    return r.data[0] if r.data else {"name": "Studio"}


# ── Navigation ───────────────────────────────────────────────────────────────
@router.get("/navigation")
def get_navigation(ctx: dict = Depends(get_tenant_context)):
    current = get_tenant_settings(ctx["tenant_id"], "public_navigation", None)
    if not current:
        current = _default_navigation(_resolve_tenant_row(ctx["tenant_id"]))
        return {"navigation": current, "_seed": True}
    return {"navigation": current, "_seed": False}


@router.put("/navigation")
def put_navigation(body: NavigationUpsert,
                   ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    current = get_tenant_settings(ctx["tenant_id"], "public_navigation", None) \
              or _default_navigation(_resolve_tenant_row(ctx["tenant_id"]))
    payload = body.model_dump(exclude_none=True)
    merged = {**current, **payload, "updated_at": _now()}
    upsert_tenant_setting(ctx["tenant_id"], "public_navigation", merged)
    audit_log(ctx["tenant_id"], ctx["profile_id"], "navigation.update",
              resource_type="tenant_settings", resource_id="public_navigation",
              metadata={"keys": list(payload.keys())})
    return {"navigation": merged}


@router.post("/navigation/reset")
def reset_navigation(ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    fresh = _default_navigation(_resolve_tenant_row(ctx["tenant_id"]))
    upsert_tenant_setting(ctx["tenant_id"], "public_navigation", fresh)
    audit_log(ctx["tenant_id"], ctx["profile_id"], "navigation.reset")
    return {"navigation": fresh}


# ── Footer ───────────────────────────────────────────────────────────────────
@router.get("/footer")
def get_footer(ctx: dict = Depends(get_tenant_context)):
    current = get_tenant_settings(ctx["tenant_id"], "public_footer", None)
    if not current:
        current = _default_footer(_resolve_tenant_row(ctx["tenant_id"]))
        return {"footer": current, "_seed": True}
    return {"footer": current, "_seed": False}


@router.put("/footer")
def put_footer(body: FooterUpsert,
               ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    current = get_tenant_settings(ctx["tenant_id"], "public_footer", None) \
              or _default_footer(_resolve_tenant_row(ctx["tenant_id"]))
    payload = body.model_dump(exclude_none=True)
    merged = {**current, **payload, "updated_at": _now()}
    upsert_tenant_setting(ctx["tenant_id"], "public_footer", merged)
    audit_log(ctx["tenant_id"], ctx["profile_id"], "footer.update",
              resource_type="tenant_settings", resource_id="public_footer",
              metadata={"keys": list(payload.keys())})
    return {"footer": merged}


@router.post("/footer/reset")
def reset_footer(ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    fresh = _default_footer(_resolve_tenant_row(ctx["tenant_id"]))
    upsert_tenant_setting(ctx["tenant_id"], "public_footer", fresh)
    audit_log(ctx["tenant_id"], ctx["profile_id"], "footer.reset")
    return {"footer": fresh}
