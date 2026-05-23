"""Atelier Media Direction™ · native upload, transform, archive.

ITER138 · MEDIA ORCHESTRATION REFINEMENT™ — eradicates dependence on
external image URLs by giving each tenant a governed cinematic media
bank stored in Supabase Storage (`tenant-assets/atelier-media/{tenant}/`).

Endpoints
─────────
POST   /api/atelier/media/upload             — multipart file → processed asset
PATCH  /api/atelier/media/{id}/transform     — update crop / focal / grading
DELETE /api/atelier/media/{id}               — soft archive
GET    /api/atelier/media/presets            — grading presets vocabulary

The upload pipeline:
  raw bytes → validate → Pillow normalize → produce 3 variants
  (original-stripped, optimized 1920w, thumbnail 480w) → BlurHash →
  Supabase Storage put → atelier_dashboard_media row insert.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from pydantic import BaseModel, Field

from database import db, get_admin_client
from core.tenant_context import get_tenant_context
from services import atelier_media_processor as processor

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/atelier/media", tags=["atelier-media"])

BUCKET = "tenant-assets"
PATH_PREFIX = "atelier-media"
MAX_ASSETS_PER_TENANT = 20  # MVP soft cap (configurable via plan flags later)


# ── Grading presets vocabulary ─ ITER142 frozen registry ───────────
# Source of truth = `atelier_presets_registry` table (migration 071).
# This dict mirrors the seeded rows so the legacy GET /api/atelier/media/presets
# endpoint keeps working without an extra DB lookup. SuperAdmin updates
# the names via a migration — never at runtime.
GRADING_PRESETS: Dict[str, Dict[str, Any]] = {
    "nordic_emotions": {
        "label": "NORDIC EMOTIONS™",
        "summary": "Restraint. Cool desaturation. Architectural calm.",
        "filter": {"brightness": 0.62, "saturate": 0.55, "contrast": 1.18,
                   "hue_rotate_deg": -8, "sepia": 0.0},
        "grain_level": 0.08, "vignette_level": 0.30,
        "warmth_offset": -0.05, "cyan_atmosphere": 0.18,
    },
    "milano_editoriale": {
        "label": "MILANO EDITORIALE™",
        "summary": "Editorial precision. Deep blacks. Cinematic register.",
        "filter": {"brightness": 0.48, "saturate": 0.42, "contrast": 1.32,
                   "hue_rotate_deg": -14, "sepia": 0.0},
        "grain_level": 0.18, "vignette_level": 0.55,
        "warmth_offset": -0.10, "cyan_atmosphere": 0.28,
    },
    "desert_atelier": {
        "label": "DESERT ATELIER™",
        "summary": "Warm hospitality. Soft sepia bias. Fireplace register.",
        "filter": {"brightness": 0.78, "saturate": 0.88, "contrast": 1.06,
                   "hue_rotate_deg": 8, "sepia": 0.14},
        "grain_level": 0.10, "vignette_level": 0.25,
        "warmth_offset": 0.18, "cyan_atmosphere": 0.0,
    },
    "japanese_gallery": {
        "label": "JAPANESE GALLERY™",
        "summary": "Wabi-sabi. Soft light. Editorial neutrality.",
        "filter": {"brightness": 0.86, "saturate": 0.62, "contrast": 1.04,
                   "hue_rotate_deg": -3, "sepia": 0.04},
        "grain_level": 0.04, "vignette_level": 0.18,
        "warmth_offset": 0.02, "cyan_atmosphere": 0.06,
    },
    "mood_for_design": {
        "label": "MOOD for DESIGN™",
        "summary": "House voice. Architectural dawn. Editorial precision.",
        "filter": {"brightness": 0.88, "saturate": 0.72, "contrast": 1.10,
                   "hue_rotate_deg": -3, "sepia": 0.06},
        "grain_level": 0.05, "vignette_level": 0.18,
        "warmth_offset": 0.05, "cyan_atmosphere": 0.08,
    },
    "bloom_atelier": {
        "label": "BLOOM ATELIER™",
        "summary": "Soft botanic warmth. Floral grading. Hospitality.",
        "filter": {"brightness": 0.92, "saturate": 0.95, "contrast": 1.02,
                   "hue_rotate_deg": 4, "sepia": 0.10},
        "grain_level": 0.06, "vignette_level": 0.22,
        "warmth_offset": 0.12, "cyan_atmosphere": 0.04,
    },
}


def _require_admin(ctx: dict) -> None:
    role = (ctx.get("role") or "").lower()
    if role not in ("super_admin", "tenant_admin", "owner", "designer"):
        raise HTTPException(status_code=403, detail="admin role required")


def _public_url(client, bucket: str, path: str) -> str:
    raw = client.storage.from_(bucket).get_public_url(path)
    if isinstance(raw, dict):
        url = raw.get("publicURL") or raw.get("publicUrl") or ""
    else:
        url = str(raw or "")
    return url.rstrip("?")


def _media_to_dict(rec: dict) -> dict:
    """Shape returned to the frontend (no _id, just declared fields)."""
    if not rec:
        return {}
    keys = [
        "id", "tenant_id", "media_kind", "file_url",
        "original_asset_url", "optimized_asset_url", "thumbnail_asset_url",
        "blurhash", "storage_bucket", "storage_path",
        "mime_type", "file_bytes", "width_px", "height_px",
        "alt_text", "focal_point_x", "focal_point_y",
        "grading_profile", "overlay_intensity", "brightness_offset",
        "grain_level", "vignette_level", "warmth_offset", "cyan_atmosphere",
        "crop_profile", "locale", "is_active", "sort_order",
        "created_at", "updated_at",
    ]
    return {k: rec.get(k) for k in keys if k in rec}


# ── PRESETS ──────────────────────────────────────────────────────────

@router.get("/presets")
def list_presets():
    """Return the editorial grading presets vocabulary.

    Public-ish (still tenant context required for consistency) — used by
    the Atelier Media Direction™ UI to render the preset chips.
    """
    return {"presets": GRADING_PRESETS}


# ── UPLOAD ───────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    media_kind: str = Form("hero"),
    alt_text: str = Form(""),
    locale: str = Form("*"),
    grading_profile: str = Form("mood_for_design"),
    focal_point_x: float = Form(0.5),
    focal_point_y: float = Form(0.5),
    overlay_intensity: float = Form(0.45),
    grain_level: float = Form(0.08),
    vignette_level: float = Form(0.30),
    warmth_offset: float = Form(0.0),
    cyan_atmosphere: float = Form(0.18),
    sort_order: int = Form(0),
    ctx: dict = Depends(get_tenant_context),
):
    """Accept a multipart upload, process it cinematically, store in
    Supabase, and insert an `atelier_dashboard_media` row."""
    _require_admin(ctx)

    if media_kind not in ("hero", "project_card_fallback", "inspiration"):
        raise HTTPException(400, "Invalid media_kind.")

    content = await file.read()
    mime = file.content_type or ""
    ok, msg = processor.validate(content, mime)
    if not ok:
        raise HTTPException(400, msg)

    admin = get_admin_client()
    if admin is None:
        raise HTTPException(500, "Storage unavailable.")

    # Soft per-tenant cap
    tid = ctx["tenant_id"]
    count = (admin.table("atelier_dashboard_media")
             .select("id", count="exact")
             .eq("tenant_id", tid)
             .eq("is_active", True)
             .execute())
    cur_count = count.count or 0
    if cur_count >= MAX_ASSETS_PER_TENANT:
        raise HTTPException(
            413,
            f"Asset cap reached ({cur_count}/{MAX_ASSETS_PER_TENANT}). "
            "Archive an existing asset to upload a new one."
        )

    # Process with Pillow
    try:
        proc = processor.process(content)
    except Exception as e:
        logger.exception("Media processor failed: %s", e)
        raise HTTPException(400, f"Image could not be processed: {e}")

    media_id = uuid.uuid4().hex[:8]
    base_path = f"{PATH_PREFIX}/{tid}/{media_id}"
    paths = {
        "original":  f"{base_path}.{proc.extension}",
        "optimized": f"{base_path}-1920.{proc.extension}",
        "thumb":     f"{base_path}-480.{proc.extension}",
    }

    try:
        admin.storage.from_(BUCKET).upload(
            paths["original"], proc.original_bytes,
            {"content-type": proc.mime, "x-upsert": "true"},
        )
        admin.storage.from_(BUCKET).upload(
            paths["optimized"], proc.optimized_bytes,
            {"content-type": proc.mime, "x-upsert": "true"},
        )
        admin.storage.from_(BUCKET).upload(
            paths["thumb"], proc.thumbnail_bytes,
            {"content-type": proc.mime, "x-upsert": "true"},
        )
    except Exception as e:
        logger.exception("Storage upload failed: %s", e)
        raise HTTPException(500, f"Storage upload failed: {e}")

    original_url  = _public_url(admin, BUCKET, paths["original"])
    optimized_url = _public_url(admin, BUCKET, paths["optimized"])
    thumb_url     = _public_url(admin, BUCKET, paths["thumb"])

    # Persist the row — file_url mirrors optimized_asset_url so legacy
    # readers (dashboard etc.) keep working without code changes.
    row = {
        "tenant_id": tid,
        "media_kind": media_kind,
        "file_url": optimized_url,
        "original_asset_url": original_url,
        "optimized_asset_url": optimized_url,
        "thumbnail_asset_url": thumb_url,
        "blurhash": proc.blurhash,
        "storage_bucket": BUCKET,
        "storage_path": paths["optimized"],
        "mime_type": proc.mime,
        "file_bytes": len(proc.optimized_bytes),
        "width_px": proc.width,
        "height_px": proc.height,
        "alt_text": (alt_text or "").strip() or None,
        "focal_point_x": max(0.0, min(1.0, focal_point_x)),
        "focal_point_y": max(0.0, min(1.0, focal_point_y)),
        "grading_profile": grading_profile,
        "overlay_intensity": max(0.0, min(1.0, overlay_intensity)),
        "grain_level": max(0.0, min(1.0, grain_level)),
        "vignette_level": max(0.0, min(1.0, vignette_level)),
        "warmth_offset": max(-0.5, min(0.5, warmth_offset)),
        "cyan_atmosphere": max(0.0, min(1.0, cyan_atmosphere)),
        "locale": locale or "*",
        "sort_order": int(sort_order or 0),
        "is_active": True,
        "uploaded_by": ctx.get("profile_id"),
    }
    res = admin.table("atelier_dashboard_media").insert(row).execute()
    rec = (res.data or [{}])[0]
    return {"ok": True, "media": _media_to_dict(rec)}


# ── TRANSFORM (crop + focal + grading metadata) ──────────────────────

class MediaTransform(BaseModel):
    alt_text:          Optional[str]   = None
    focal_point_x:     Optional[float] = Field(None, ge=0, le=1)
    focal_point_y:     Optional[float] = Field(None, ge=0, le=1)
    grading_profile:   Optional[str]   = None
    overlay_intensity: Optional[float] = Field(None, ge=0, le=1)
    grain_level:       Optional[float] = Field(None, ge=0, le=1)
    vignette_level:    Optional[float] = Field(None, ge=0, le=1)
    warmth_offset:     Optional[float] = Field(None, ge=-0.5, le=0.5)
    cyan_atmosphere:   Optional[float] = Field(None, ge=0, le=1)
    crop_profile:      Optional[Dict[str, float]] = None  # {x, y, w, h} 0..1
    locale:            Optional[str]   = None
    sort_order:        Optional[int]   = None
    media_kind:        Optional[str]   = None


@router.patch("/{media_id}/transform")
def transform_media(media_id: str, body: MediaTransform,
                    ctx: dict = Depends(get_tenant_context)):
    """Update the cinematic art-direction metadata for an asset.

    Crop/focal/grading are stored as metadata so the same source asset
    can serve multiple compositions. Pixel-level re-rendering happens
    client-side via CSS filters + object-position.
    """
    _require_admin(ctx)
    c = db()
    tid = ctx["tenant_id"]

    payload: Dict[str, Any] = {}
    for k, v in body.model_dump().items():
        if v is None:
            continue
        if k == "media_kind" and v not in ("hero", "project_card_fallback", "inspiration"):
            raise HTTPException(400, "Invalid media_kind.")
        payload[k] = v

    if not payload:
        raise HTTPException(400, "Nothing to update.")

    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = (c.table("atelier_dashboard_media")
           .update(payload)
           .eq("id", media_id)
           .eq("tenant_id", tid)
           .execute())
    if not res.data:
        raise HTTPException(404, "Media not found in this tenant.")
    return {"ok": True, "media": _media_to_dict(res.data[0])}


# ── ARCHIVE (soft delete + best-effort storage cleanup) ──────────────

@router.delete("/{media_id}")
def archive_media(media_id: str, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    c = db()
    tid = ctx["tenant_id"]

    rec_q = (c.table("atelier_dashboard_media")
             .select("id,storage_bucket,storage_path,tenant_id")
             .eq("id", media_id)
             .eq("tenant_id", tid)
             .limit(1).execute())
    if not rec_q.data:
        raise HTTPException(404, "Media not found in this tenant.")
    rec = rec_q.data[0]

    (c.table("atelier_dashboard_media")
     .update({
         "is_active": False,
         "updated_at": datetime.now(timezone.utc).isoformat(),
     })
     .eq("id", media_id)
     .eq("tenant_id", tid)
     .execute())

    # Best-effort storage cleanup — remove the 3 variants if path stored
    bucket = rec.get("storage_bucket")
    base = rec.get("storage_path")
    if bucket and base and base.endswith(".jpg"):
        stem = base[:-len(".jpg")]
        if stem.endswith("-1920"):
            stem = stem[:-len("-1920")]
        candidates = [f"{stem}.jpg", f"{stem}-1920.jpg", f"{stem}-480.jpg"]
        try:
            c.storage.from_(bucket).remove(candidates)
        except Exception as e:
            logger.info("Storage cleanup partial (non-fatal): %s", e)

    return {"ok": True}
