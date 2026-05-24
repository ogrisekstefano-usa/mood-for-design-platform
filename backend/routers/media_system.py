"""ITER148 · Phase 2 · Media System Unificato™ · routers.

This module is the SINGLE source of truth for non-destructive media
operations (variants + Used-In + filter presets). It sits on top of
the existing `/api/media/*` archive endpoints (in routers/media.py)
WITHOUT duplicating storage/upload logic.

Endpoints mounted under `/api/media-system`:

  GET    /filter-presets                          → DB-driven filter registry
  GET    /assets/{asset_id}/variants              → list variants
  POST   /assets/{asset_id}/variants              → create variant (metadata)
  PATCH  /variants/{variant_id}                   → update variant metadata
  DELETE /variants/{variant_id}                   → remove variant
  GET    /assets/{asset_id}/usage                 → Used-In™ map
  POST   /assets/{asset_id}/usage                 → register a usage row
  DELETE /usage/{usage_id}                        → release a usage row
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Path

from core.permissions import P_STORAGE_READ, P_STORAGE_WRITE
from core.tenant_context import require_permission
from database import db, db_available

router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


VALID_ENTITY_TYPES = {
    "homepage", "magazine", "journey", "moodboard", "memory",
    "inspiration", "onboarding", "proposal", "card", "relationship",
}


# ── Filter presets ───────────────────────────────────────────────────
@router.get("/filter-presets")
def list_filter_presets(current_user: dict = Depends(require_permission(P_STORAGE_READ))):
    """Editorial filter registry · GLOBAL presets + tenant overrides.

    Returns the active set ordered for UI consumption. Each row contains
    the raw CSS filter string so the client can preview without going to
    the server (the actual rendering is purely CSS).
    """
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    tid = current_user["tenant_id"]
    # Global presets (tenant_id NULL) + this tenant's overrides.
    rows = (client.table("media_filter_presets")
            .select("id, tenant_id, preset_key, label, description, css_filter, overlay_color, overlay_alpha, is_active, display_order")
            .or_(f"tenant_id.is.null,tenant_id.eq.{tid}")
            .eq("is_active", True)
            .order("display_order")
            .execute())
    # Deduplicate by preset_key — tenant rows win.
    by_key: dict[str, dict] = {}
    for r in (rows.data or []):
        k = r["preset_key"]
        if k in by_key and r.get("tenant_id") is None:
            continue  # already have a tenant override
        by_key[k] = r
    return {"presets": list(by_key.values())}


# ── Variants ─────────────────────────────────────────────────────────
def _validate_norm(v: float, name: str) -> float:
    try:
        x = float(v)
    except (TypeError, ValueError):
        raise HTTPException(400, f"{name} must be a number")
    if not (0.0 <= x <= 1.0):
        raise HTTPException(400, f"{name} must be in [0, 1]")
    return x


@router.get("/assets/{asset_id}/variants")
def list_variants(
    asset_id: str = Path(...),
    current_user: dict = Depends(require_permission(P_STORAGE_READ)),
):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    rows = (db().table("media_asset_variants")
            .select("id, variant_key, label, crop_x, crop_y, crop_width, crop_height, "
                    "focal_x, focal_y, zoom, filter_preset, overlay_strength, aspect_ratio, "
                    "usage_hint, created_at, updated_at")
            .eq("tenant_id", current_user["tenant_id"])
            .eq("asset_id", asset_id)
            .order("created_at")
            .execute())
    return {"variants": rows.data or []}


@router.post("/assets/{asset_id}/variants", status_code=201)
def create_variant(
    asset_id: str,
    body: dict = Body(...),
    current_user: dict = Depends(require_permission(P_STORAGE_WRITE)),
):
    """Create a non-destructive variant.

    Body: { variant_key (required) · crop · focal · zoom · filter_preset ·
            overlay_strength · aspect_ratio · usage_hint · label }
    """
    if not db_available():
        raise HTTPException(503, "Database not configured")
    variant_key = (body.get("variant_key") or "").strip()
    if not variant_key:
        raise HTTPException(400, "variant_key required")

    row = {
        "id":               str(uuid.uuid4()),
        "tenant_id":        current_user["tenant_id"],
        "asset_id":         asset_id,
        "variant_key":      variant_key,
        "label":            body.get("label"),
        "crop_x":           _validate_norm(body.get("crop_x", 0),       "crop_x"),
        "crop_y":           _validate_norm(body.get("crop_y", 0),       "crop_y"),
        "crop_width":       _validate_norm(body.get("crop_width", 1),   "crop_width"),
        "crop_height":      _validate_norm(body.get("crop_height", 1),  "crop_height"),
        "focal_x":          _validate_norm(body.get("focal_x", 0.5),    "focal_x"),
        "focal_y":          _validate_norm(body.get("focal_y", 0.5),    "focal_y"),
        "zoom":             float(body.get("zoom") or 1.0),
        "filter_preset":    body.get("filter_preset") or "none",
        "overlay_strength": _validate_norm(body.get("overlay_strength", 0), "overlay_strength"),
        "aspect_ratio":     body.get("aspect_ratio"),
        "usage_hint":       body.get("usage_hint"),
        "created_by":       current_user.get("id"),
        "created_at":       _now(),
        "updated_at":       _now(),
    }
    try:
        db().table("media_asset_variants").insert(row).execute()
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(409, "A variant with this key already exists for this asset")
        raise
    row.pop("created_by", None)
    return row


@router.patch("/variants/{variant_id}")
def update_variant(
    variant_id: str,
    body: dict = Body(...),
    current_user: dict = Depends(require_permission(P_STORAGE_WRITE)),
):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    allowed = {
        "label", "crop_x", "crop_y", "crop_width", "crop_height",
        "focal_x", "focal_y", "zoom", "filter_preset",
        "overlay_strength", "aspect_ratio", "usage_hint",
    }
    updates = {k: v for k, v in (body or {}).items() if k in allowed}
    if not updates:
        raise HTTPException(400, "No editable fields supplied")
    for n in ("crop_x", "crop_y", "crop_width", "crop_height", "focal_x", "focal_y", "overlay_strength"):
        if n in updates:
            updates[n] = _validate_norm(updates[n], n)
    updates["updated_at"] = _now()
    res = (db().table("media_asset_variants").update(updates)
           .eq("id", variant_id).eq("tenant_id", current_user["tenant_id"]).execute())
    if not res.data:
        raise HTTPException(404, "Variant not found")
    return res.data[0]


@router.delete("/variants/{variant_id}", status_code=204)
def delete_variant(
    variant_id: str,
    current_user: dict = Depends(require_permission(P_STORAGE_WRITE)),
):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    db().table("media_asset_variants").delete()\
        .eq("id", variant_id).eq("tenant_id", current_user["tenant_id"]).execute()
    return None


# ── Used-In™ map ─────────────────────────────────────────────────────
@router.get("/assets/{asset_id}/usage")
def asset_usage(
    asset_id: str,
    current_user: dict = Depends(require_permission(P_STORAGE_READ)),
):
    """Return all places this asset is currently used, grouped by entity type.

    Shape: { 'total': N, 'by_type': { 'magazine': [...], 'journey': [...], ... } }
    """
    if not db_available():
        raise HTTPException(503, "Database not configured")
    rows = (db().table("media_asset_usage")
            .select("id, asset_id, variant_id, entity_type, entity_id, usage_role, created_at")
            .eq("tenant_id", current_user["tenant_id"])
            .eq("asset_id", asset_id)
            .order("created_at")
            .execute())
    by_type: dict[str, list] = {}
    for u in (rows.data or []):
        by_type.setdefault(u["entity_type"], []).append(u)
    return {
        "asset_id": asset_id,
        "total":    len(rows.data or []),
        "by_type":  by_type,
    }


@router.post("/assets/{asset_id}/usage", status_code=201)
def register_usage(
    asset_id: str,
    body: dict = Body(...),
    current_user: dict = Depends(require_permission(P_STORAGE_WRITE)),
):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    entity_type = (body.get("entity_type") or "").strip()
    if entity_type not in VALID_ENTITY_TYPES:
        raise HTTPException(400, f"entity_type must be one of {sorted(VALID_ENTITY_TYPES)}")
    row = {
        "id":          str(uuid.uuid4()),
        "tenant_id":   current_user["tenant_id"],
        "asset_id":    asset_id,
        "variant_id":  body.get("variant_id"),
        "entity_type": entity_type,
        "entity_id":   body.get("entity_id"),
        "usage_role":  body.get("usage_role"),
        "created_at":  _now(),
    }
    try:
        db().table("media_asset_usage").insert(row).execute()
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(409, "This usage is already registered")
        raise
    return row


@router.delete("/usage/{usage_id}", status_code=204)
def release_usage(
    usage_id: str,
    current_user: dict = Depends(require_permission(P_STORAGE_WRITE)),
):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    db().table("media_asset_usage").delete()\
        .eq("id", usage_id).eq("tenant_id", current_user["tenant_id"]).execute()
    return None
