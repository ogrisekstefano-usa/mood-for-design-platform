"""ITER162 rev3 · Client Profile Config router.

Endpoints
=========
  GET  /api/admin/client-profile-config        (auth admin · current tenant)
  PUT  /api/admin/client-profile-config        (auth admin)
  GET  /api/client/profile-config              (auth client · own tenant)
  GET  /api/locale/available-languages         (public · supported locale list)

Storage: `client_profile_configs` (one row per tenant).
`placeholders` JSONB shape:
  {
    "hero":       {"url": "...", "asset_id": "..."},
    "atmosphere": {...},
    "lifestyle":  {...},
    "materials":  {...},
    "priority":   {...},
    "nextStep":   {...}
  }
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from database import db

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_PRESETS = {"atelier", "axis", "gallery", "residence"}
PLACEHOLDER_SLOTS = (
    "hero", "atmosphere", "lifestyle", "materials", "priority", "nextStep",
)

# Editorial fallback library — used when the tenant has not customised yet.
DEFAULT_PLACEHOLDERS = {
    "hero":       {"url": "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=85&w=2400&auto=format&fit=crop"},
    "atmosphere": {"url": "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?q=85&w=800&auto=format&fit=crop"},
    "lifestyle":  {"url": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=85&w=800&auto=format&fit=crop"},
    "materials":  {"url": "https://images.unsplash.com/photo-1604014237800-1c9102c219da?q=85&w=800&auto=format&fit=crop"},
    "priority":   {"url": "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?q=85&w=800&auto=format&fit=crop"},
    "nextStep":   {"url": "https://images.unsplash.com/photo-1565538810643-b5bdb714032a?q=85&w=800&auto=format&fit=crop"},
}

# Languages exposed to clients — keep in sync with /api/language/_LOCALES.
# {code, native_label, english_label, default_for}
LANGUAGE_REGISTRY = [
    {"code": "it-IT", "short": "it", "native": "Italiano", "label": "Italian"},
    {"code": "en-US", "short": "en", "native": "English",  "label": "English (US)"},
    {"code": "en-GB", "short": "en-gb", "native": "English (UK)", "label": "English (UK)"},
    {"code": "fr-FR", "short": "fr", "native": "Français", "label": "French"},
    {"code": "de-DE", "short": "de", "native": "Deutsch",  "label": "German"},
    {"code": "es-ES", "short": "es", "native": "Español",  "label": "Spanish"},
    {"code": "ar",    "short": "ar", "native": "العربية",   "label": "Arabic"},
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_admin(ctx: dict) -> None:
    role = (ctx.get("role") or "").lower()
    if role not in ("super_admin", "tenant_admin", "studio_owner", "owner",
                    "designer", "blueprint_admin"):
        raise HTTPException(403, "Solo lo studio può modificare la configurazione")


def _merge_placeholders(stored: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(DEFAULT_PLACEHOLDERS)
    for k, v in (stored or {}).items():
        if k in PLACEHOLDER_SLOTS and isinstance(v, dict) and v.get("url"):
            out[k] = v
    return out


def _load(tenant_id: str) -> Dict[str, Any]:
    c = db()
    rows = (c.table("client_profile_configs")
            .select("preset_key,placeholders,metadata,updated_at")
            .eq("tenant_id", tenant_id).limit(1).execute().data or [])
    if rows:
        row = rows[0]
        return {
            "preset_key":    row.get("preset_key") or "atelier",
            "placeholders":  _merge_placeholders(row.get("placeholders") or {}),
            "metadata":      row.get("metadata") or {},
            "updated_at":    row.get("updated_at"),
            "_raw_placeholders": row.get("placeholders") or {},
        }
    return {
        "preset_key":   "atelier",
        "placeholders": dict(DEFAULT_PLACEHOLDERS),
        "metadata":     {},
        "updated_at":   None,
        "_raw_placeholders": {},
    }


# ── Public · language list ──────────────────────────────────────────
@router.get("/locale/available-languages")
def available_languages():
    """Lista delle lingue selezionabili dal Client Profile dropdown.
    Sorgente unica: stesso registry usato da `/api/language/_LOCALES`.
    """
    return {"languages": LANGUAGE_REGISTRY}


# ── Client · read-only config ───────────────────────────────────────
@router.get("/client/profile-config")
def client_get_config(ctx: dict = Depends(get_tenant_context)):
    if (ctx.get("role") or "").lower() != "client":
        raise HTTPException(403, "Solo dal Client Profile")
    cfg = _load(ctx["tenant_id"])
    return {
        "preset_key":   cfg["preset_key"],
        "placeholders": cfg["placeholders"],
    }


# ── Admin · CRUD ────────────────────────────────────────────────────
class ConfigUpdate(BaseModel):
    preset_key:   Optional[str] = None
    placeholders: Optional[Dict[str, Any]] = Field(default=None)
    metadata:     Optional[Dict[str, Any]] = None


@router.get("/admin/client-profile-config")
def admin_get_config(ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    cfg = _load(ctx["tenant_id"])
    # admin sees both effective (with fallback) and raw (what's stored)
    return {
        "preset_key":           cfg["preset_key"],
        "placeholders":         cfg["placeholders"],
        "placeholders_custom":  cfg["_raw_placeholders"],
        "placeholder_slots":    list(PLACEHOLDER_SLOTS),
        "available_presets":    sorted(VALID_PRESETS),
        "default_placeholders": DEFAULT_PLACEHOLDERS,
        "metadata":             cfg["metadata"],
        "updated_at":           cfg["updated_at"],
    }


@router.put("/admin/client-profile-config")
def admin_put_config(body: ConfigUpdate, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    tid = ctx["tenant_id"]
    c = db()

    current = _load(tid)
    payload = {
        "tenant_id":    tid,
        "preset_key":   current["preset_key"],
        "placeholders": current["_raw_placeholders"],
        "metadata":     current["metadata"],
        "updated_by":   ctx.get("profile_id"),
        "updated_at":   _now(),
    }

    if body.preset_key is not None:
        if body.preset_key not in VALID_PRESETS:
            raise HTTPException(400, f"preset_key non valido: {body.preset_key}")
        payload["preset_key"] = body.preset_key

    if body.placeholders is not None:
        # sanitize: only known slots, only with `url`
        cleaned = dict(current["_raw_placeholders"])
        for k, v in body.placeholders.items():
            if k not in PLACEHOLDER_SLOTS:
                continue
            if v is None or (isinstance(v, dict) and not v.get("url")):
                cleaned.pop(k, None)  # reset to default
            elif isinstance(v, dict) and v.get("url"):
                cleaned[k] = {
                    "url":       v["url"],
                    "asset_id":  v.get("asset_id"),
                    "alt":       v.get("alt"),
                    "credit":    v.get("credit"),
                }
        payload["placeholders"] = cleaned

    if body.metadata is not None:
        payload["metadata"] = body.metadata

    # Upsert via select-then-update/insert (Supabase python client doesn't expose conflict targets reliably)
    existing = (c.table("client_profile_configs").select("tenant_id")
                .eq("tenant_id", tid).limit(1).execute().data or [])
    try:
        if existing:
            c.table("client_profile_configs").update({
                "preset_key":   payload["preset_key"],
                "placeholders": payload["placeholders"],
                "metadata":     payload["metadata"],
                "updated_by":   payload["updated_by"],
                "updated_at":   payload["updated_at"],
            }).eq("tenant_id", tid).execute()
        else:
            c.table("client_profile_configs").insert({
                **payload,
                "created_at": payload["updated_at"],
            }).execute()
    except Exception as e:
        logger.exception("client-profile-config update failed")
        raise HTTPException(500, f"update failed: {e}")

    return admin_get_config(ctx)  # echo updated state
