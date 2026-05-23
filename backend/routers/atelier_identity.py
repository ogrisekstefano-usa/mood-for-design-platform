"""Atelier Identity™ — ITER142 SaaS Foundation™

Surface:
  GET  /api/atelier/identity/presets          public (any authed user)
  GET  /api/atelier/identity/me               tenant identity for current tenant
  PUT  /api/atelier/identity/me               tenant_owner|tenant_admin only

Preset registry is **frozen** — no create/update/delete from this router.
SuperAdmin must use a migration to rename or add a preset.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import db
from core.tenant_context import get_tenant_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/atelier/identity", tags=["atelier-identity"])

BRAND_IDENTITY_ROLES = {"super_admin", "tenant_owner", "tenant_admin", "owner"}


def _gate_brand_identity(ctx: dict) -> None:
    role = (ctx.get("role") or "").lower()
    if role not in BRAND_IDENTITY_ROLES:
        raise HTTPException(
            403,
            "Brand Identity is restricted to tenant_owner / tenant_admin. "
            "Designers, collaborators and clients have read-only access.",
        )


# ── Presets — frozen ──────────────────────────────────────────────────

@router.get("/presets")
def list_presets(_ctx: dict = Depends(get_tenant_context)):
    c = db()
    rows = (c.table("atelier_presets_registry")
            .select("code,display_name,position,summary,filter_json,"
                    "grain_level,vignette_level,warmth_offset,cyan_atmosphere,is_locked")
            .order("position").execute().data or [])
    return {"presets": rows}


# ── Tenant identity — read ────────────────────────────────────────────

@router.get("/me")
def get_tenant_identity(ctx: dict = Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    row = (c.table("tenant_atelier_identity")
           .select("*").eq("tenant_id", tid).limit(1).execute().data or [])
    identity = row[0] if row else None
    if not identity:
        # Lazy default — tenant has not customised yet.
        identity = {
            "tenant_id": tid,
            "active_preset_code": "mood_for_design",
            "logo_url": None,
            "palette_override": None,
            "accent_system": None,
            "editorial_tone": None,
            "default_locale": None,
            "fallback_locales": [],
        }
    # Resolve the active preset full details for convenience.
    preset_row = (c.table("atelier_presets_registry").select("*")
                  .eq("code", identity.get("active_preset_code") or "mood_for_design")
                  .limit(1).execute().data or [])
    return {
        "identity": identity,
        "active_preset": preset_row[0] if preset_row else None,
    }


# ── Tenant identity — write (RBAC gated) ──────────────────────────────

class TenantIdentityUpdate(BaseModel):
    active_preset_code: Optional[str] = None
    logo_url:           Optional[str] = None
    palette_override:   Optional[Dict[str, Any]] = None
    accent_system:      Optional[Dict[str, Any]] = None
    editorial_tone:     Optional[str] = None
    default_locale:     Optional[str] = None
    fallback_locales:   Optional[list] = None


@router.put("/me")
def update_tenant_identity(body: TenantIdentityUpdate,
                           ctx: dict = Depends(get_tenant_context)):
    _gate_brand_identity(ctx)
    c = db()
    tid = ctx["tenant_id"]

    # Verify preset_code exists in registry (frozen list).
    if body.active_preset_code:
        chk = (c.table("atelier_presets_registry")
               .select("code").eq("code", body.active_preset_code)
               .limit(1).execute().data or [])
        if not chk:
            raise HTTPException(
                400, f"Unknown preset: {body.active_preset_code}. "
                "Use GET /api/atelier/identity/presets for the canonical list.")

    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()

    existing = (c.table("tenant_atelier_identity").select("tenant_id")
                .eq("tenant_id", tid).limit(1).execute().data or [])
    if existing:
        res = (c.table("tenant_atelier_identity").update(payload)
               .eq("tenant_id", tid).execute())
    else:
        payload["tenant_id"] = tid
        res = (c.table("tenant_atelier_identity").insert(payload).execute())

    return {"ok": True, "identity": (res.data or [{}])[0]}
