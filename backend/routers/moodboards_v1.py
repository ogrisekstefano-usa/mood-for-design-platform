"""Blueprint Moodboards™ V1 — block-based editor backbone.

Storage strategy (post-migration 002):
  - position_json (JSONB): {x, y, width, height, z_index}
  - style_json    (JSONB): {opacity, rotation, crop_x, crop_y, zoom, fit_mode, focal_point, …}
  - content       (TEXT/JSON): semantic payload only (text body, palette colors,
                   product/material attributes, image caption — NOT layout, NOT visual props)
  - image_url, video_url, title: dedicated columns where applicable
  - locked, hidden, opacity, rotation: structured columns (queryable)

Approval transitions are aligned to Supabase `moodboard_status` enum:
  draft → sent → viewed/approved/revision_requested/rejected → …

Share tokens live in the dedicated `moodboard_shares` table (one row per share).
"""
import uuid
import json
import logging
import secrets
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel

from core.tenant_context import get_tenant_context, require_permission, audit_log
from core.permissions import (
    P_MOODBOARDS_READ, P_MOODBOARDS_WRITE,
)
from database import db, db_available

router = APIRouter()
logger = logging.getLogger(__name__)


SUPPORTED_BLOCK_TYPES = {
    "image", "text", "palette", "note", "product", "material",
    # Future-ready stubs (accepted server-side, no UI yet)
    "hotspot", "video", "vendor", "product_grid",
}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _parse_jsonish(v):
    """A column declared JSONB may come back as dict OR as a JSON string from PostgREST."""
    if v is None:
        return {}
    if isinstance(v, dict):
        return v
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return {}
    return {}


def _normalize_block(b: dict) -> dict:
    """Hydrate a row from `moodboard_elements` into the frontend-friendly shape.

    Frontend expects layout flat (x/y/width/height/z_index at top level) plus
    `content` as a dict and `style` for visual props.
    """
    if not b:
        return b
    out = dict(b)
    # Hydrate JSONB columns into dicts (PostgREST may return strings)
    pos = _parse_jsonish(out.get("position_json"))
    style = _parse_jsonish(out.get("style_json"))
    content = _parse_jsonish(out.get("content"))

    # Backward-compat: legacy rows had layout inside content (pre-migration 002)
    if not pos and isinstance(content, dict) and "layout" in content:
        legacy = content.pop("layout") or {}
        pos = {**legacy}

    out["x"]       = pos.get("x", 40)
    out["y"]       = pos.get("y", 40)
    out["width"]   = pos.get("width", 320)
    out["height"]  = pos.get("height", 240)
    out["z_index"] = pos.get("z_index", 0)

    out["style"]   = style or {}
    out["content"] = content or {}
    # Drop raw JSONB column dumps from the response (we re-expose them as `content`/`style`)
    out.pop("position_json", None)
    out.pop("style_json", None)
    out.pop("metadata_json", None)
    return out


def _assert_moodboard(client, moodboard_id: str, tenant_id: str) -> dict:
    r = client.table("moodboards").select(
        "id, project_id, status, current_version, title, tenant_id"
    ).eq("id", moodboard_id).eq("tenant_id", tenant_id).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Moodboard not found")
    return r.data[0]


def _push_activity(tenant_id: str, project_id: Optional[str], actor_id: str,
                   event_type: str, ref_id: Optional[str] = None,
                   label: Optional[str] = None, payload: Optional[dict] = None):
    """Append to the project_activity stream (dedicated table). Safe no-op when project_id is None."""
    if not project_id:
        return
    try:
        client = db()
        client.table("project_activity").insert({
            "tenant_id": tenant_id,
            "project_id": project_id,
            "actor_id": actor_id,
            "event_type": event_type,
            "ref_id": ref_id,
            "label": label,
            "payload": payload or {},
        }).execute()
    except Exception as e:
        logger.warning(f"activity push failed: {e}")


# ── Block schemas ────────────────────────────────────────────────────────────
class BlockCreate(BaseModel):
    type: str
    x: Optional[float] = 40
    y: Optional[float] = 40
    width: Optional[float] = 320
    height: Optional[float] = 240
    z_index: Optional[int] = 0
    sort_order: Optional[int] = 0
    content: Optional[Dict[str, Any]] = None
    style:   Optional[Dict[str, Any]] = None


class BlockUpdate(BaseModel):
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    z_index: Optional[int] = None
    sort_order: Optional[int] = None
    content: Optional[Dict[str, Any]] = None
    style:   Optional[Dict[str, Any]] = None
    locked:  Optional[bool] = None
    hidden:  Optional[bool] = None
    opacity: Optional[float] = None
    rotation: Optional[float] = None


class BlocksBatchUpdate(BaseModel):
    blocks: List[Dict[str, Any]]  # each item must include 'id'


class ApprovalChange(BaseModel):
    status: str  # draft | sent | viewed | approved | revision_requested | rejected
    note:   Optional[str] = None


def _build_position(x, y, w, h, z):
    return {
        "x": x if x is not None else 40,
        "y": y if y is not None else 40,
        "width":  w if w is not None else 320,
        "height": h if h is not None else 240,
        "z_index": z if z is not None else 0,
    }


# ── Block CRUD ───────────────────────────────────────────────────────────────
@router.post("/{moodboard_id}/blocks", status_code=201)
def create_block(moodboard_id: str, body: BlockCreate, ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    client = db()
    mb = _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    if body.type not in SUPPORTED_BLOCK_TYPES:
        raise HTTPException(400, f"Unsupported block type: {body.type}")
    content = body.content or {}
    # For image blocks, mirror src into image_url so the column is actually used
    image_url = content.get("src") if body.type == "image" else None
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "moodboard_id": moodboard_id,
        "type": body.type,
        "sort_order": body.sort_order or 0,
        "content": json.dumps(content),
        "position_json": _build_position(body.x, body.y, body.width, body.height, body.z_index),
        "style_json": body.style or {},
        "title": content.get("caption") if body.type == "image" else None,
    }
    if image_url:
        row["image_url"] = image_url
    r = client.table("moodboard_elements").insert(row).execute()
    client.table("moodboards").update({"updated_at": _now()}).eq("id", moodboard_id).execute()
    _push_activity(ctx["tenant_id"], mb.get("project_id"), ctx["profile_id"],
                   "moodboard.block_added", moodboard_id, mb.get("title"),
                   {"block_type": body.type})
    return _normalize_block(r.data[0] if r.data else row)


@router.put("/{moodboard_id}/blocks/{block_id}")
def update_block(moodboard_id: str, block_id: str, body: BlockUpdate,
                 ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    client = db()
    _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    cur = client.table("moodboard_elements").select("content, position_json, style_json, type") \
        .eq("id", block_id).eq("moodboard_id", moodboard_id).limit(1).execute()
    if not cur.data:
        raise HTTPException(404, "Block not found")
    row = cur.data[0]
    pos = _parse_jsonish(row.get("position_json"))
    style = _parse_jsonish(row.get("style_json"))
    content = _parse_jsonish(row.get("content"))

    body_d = body.model_dump(exclude_none=True)
    for k in ("x", "y", "width", "height", "z_index"):
        if k in body_d:
            pos[k] = body_d.pop(k)
    if "content" in body_d:
        content = {**content, **(body_d.pop("content") or {})}
    if "style" in body_d:
        style = {**style, **(body_d.pop("style") or {})}

    payload = {"position_json": pos, "style_json": style, "content": json.dumps(content)}
    for k in ("sort_order", "locked", "hidden", "opacity", "rotation"):
        if k in body_d:
            payload[k] = body_d[k]
    # Mirror image url on update
    if row.get("type") == "image" and "src" in content:
        payload["image_url"] = content["src"]
        payload["title"] = content.get("caption")
    payload["updated_at"] = _now()

    r = client.table("moodboard_elements").update(payload) \
        .eq("id", block_id).eq("moodboard_id", moodboard_id).execute()
    client.table("moodboards").update({"updated_at": _now()}).eq("id", moodboard_id).execute()
    return _normalize_block(r.data[0] if r.data else {**row, **payload})


@router.delete("/{moodboard_id}/blocks/{block_id}")
def delete_block(moodboard_id: str, block_id: str, ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    client = db()
    _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    client.table("moodboard_elements").delete() \
        .eq("id", block_id).eq("moodboard_id", moodboard_id).execute()
    client.table("moodboards").update({"updated_at": _now()}).eq("id", moodboard_id).execute()
    return {"message": "deleted"}


@router.post("/{moodboard_id}/blocks/{block_id}/duplicate", status_code=201)
def duplicate_block(moodboard_id: str, block_id: str, ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    """Clone a block — same content/style/position offset by a small delta."""
    client = db()
    _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    cur = client.table("moodboard_elements").select("*") \
        .eq("id", block_id).eq("moodboard_id", moodboard_id).limit(1).execute()
    if not cur.data:
        raise HTTPException(404, "Block not found")
    src = cur.data[0]
    pos = _parse_jsonish(src.get("position_json"))
    pos["x"] = (pos.get("x") or 0) + 24
    pos["y"] = (pos.get("y") or 0) + 24
    pos["z_index"] = (pos.get("z_index") or 0) + 1
    new_row = {
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "moodboard_id": moodboard_id,
        "type": src.get("type"),
        "title": src.get("title"),
        "image_url": src.get("image_url"),
        "video_url": src.get("video_url"),
        "content": src.get("content"),
        "position_json": pos,
        "style_json": _parse_jsonish(src.get("style_json")),
        "metadata_json": _parse_jsonish(src.get("metadata_json")),
        "locked": False,
        "hidden": False,  # always start visible on duplicate
        "opacity": src.get("opacity") or 1.0,
        "rotation": src.get("rotation") or 0,
        "sort_order": (src.get("sort_order") or 0) + 1,
    }
    r = client.table("moodboard_elements").insert(new_row).execute()
    client.table("moodboards").update({"updated_at": _now()}).eq("id", moodboard_id).execute()
    return _normalize_block(r.data[0] if r.data else new_row)


@router.patch("/{moodboard_id}/blocks/batch")
def batch_update_blocks(moodboard_id: str, body: BlocksBatchUpdate,
                        ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    """Bulk patch used by autosave (positions/sizes/style after drag/resize/inspector)."""
    client = db()
    _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    updated = 0
    for b in body.blocks:
        bid = b.get("id")
        if not bid:
            continue
        cur = client.table("moodboard_elements").select("content, position_json, style_json, type") \
            .eq("id", bid).eq("moodboard_id", moodboard_id).limit(1).execute()
        if not cur.data:
            continue
        row = cur.data[0]
        pos = _parse_jsonish(row.get("position_json"))
        style = _parse_jsonish(row.get("style_json"))
        content = _parse_jsonish(row.get("content"))
        for k in ("x", "y", "width", "height", "z_index"):
            if k in b and b[k] is not None:
                pos[k] = b[k]
        if isinstance(b.get("content"), dict):
            content = {**content, **b["content"]}
        if isinstance(b.get("style"), dict):
            style = {**style, **b["style"]}
        upd = {"position_json": pos, "style_json": style, "content": json.dumps(content),
               "updated_at": _now()}
        for k in ("sort_order", "locked", "hidden", "opacity", "rotation"):
            if k in b and b[k] is not None:
                upd[k] = b[k]
        if row.get("type") == "image" and "src" in content:
            upd["image_url"] = content["src"]
        client.table("moodboard_elements").update(upd) \
            .eq("id", bid).eq("moodboard_id", moodboard_id).execute()
        updated += 1
    client.table("moodboards").update({"updated_at": _now()}).eq("id", moodboard_id).execute()
    return {"updated": updated}


# ── Approval workflow ───────────────────────────────────────────────────────
# Aligned with Supabase `moodboard_status` enum:
#   draft · sent · viewed · approved · revision_requested · rejected
APPROVAL_TRANSITIONS = {
    "draft":              {"sent"},
    "sent":               {"viewed", "approved", "revision_requested", "rejected", "draft"},
    "viewed":             {"approved", "revision_requested", "rejected", "sent"},
    "approved":           {"draft"},
    "revision_requested": {"sent", "draft"},
    "rejected":           {"sent", "draft"},
}


@router.post("/{moodboard_id}/approval")
def change_approval(moodboard_id: str, body: ApprovalChange,
                    ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    client = db()
    mb = _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    current = mb.get("status") or "draft"
    if body.status not in APPROVAL_TRANSITIONS.get(current, set()) and body.status != current:
        raise HTTPException(400, f"Invalid transition {current} → {body.status}")
    now = _now()
    upd = {"status": body.status, "updated_at": now}
    r = client.table("moodboards").update(upd).eq("id", moodboard_id).execute()
    audit_log(ctx["tenant_id"], ctx["profile_id"], f"moodboard.{body.status}",
              resource_type="moodboard", resource_id=moodboard_id,
              metadata={"from": current, "to": body.status, "note": body.note})
    _push_activity(ctx["tenant_id"], mb.get("project_id"), ctx["profile_id"],
                   f"moodboard.{body.status}", moodboard_id, mb.get("title"),
                   {"from": current, "to": body.status, "note": body.note})
    return r.data[0] if r.data else upd


# ── Share token (read-only client review) — dedicated table ─────────────────
@router.post("/{moodboard_id}/share")
def create_share_token(moodboard_id: str, ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    client = db()
    _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    token = secrets.token_urlsafe(24)
    client.table("moodboard_shares").insert({
        "tenant_id": ctx["tenant_id"],
        "moodboard_id": moodboard_id,
        "token": token,
        "created_by": ctx["profile_id"],
    }).execute()
    audit_log(ctx["tenant_id"], ctx["profile_id"], "moodboard.share_created",
              resource_type="moodboard", resource_id=moodboard_id)
    return {
        "share_token": token,
        "share_path": f"/moodboard/share/{token}",
    }


@router.delete("/{moodboard_id}/share")
def revoke_share_token(moodboard_id: str, ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    client = db()
    _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    client.table("moodboard_shares") \
        .update({"revoked_at": _now()}) \
        .eq("moodboard_id", moodboard_id) \
        .is_("revoked_at", "null") \
        .execute()
    return {"message": "revoked"}


# ── PUBLIC: client review by share token (no auth) ──────────────────────────
@router.get("/public/share/{share_token}")
def public_get_by_share(share_token: str):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    s = client.table("moodboard_shares").select("*") \
        .eq("token", share_token).is_("revoked_at", "null").limit(1).execute()
    if not s.data:
        raise HTTPException(404, "Not found")
    share = s.data[0]
    # Track view (best-effort, never fails the response)
    try:
        upd = {
            "view_count": (share.get("view_count") or 0) + 1,
            "last_viewed_at": _now(),
        }
        if not share.get("first_viewed_at"):
            upd["first_viewed_at"] = _now()
        client.table("moodboard_shares").update(upd).eq("id", share["id"]).execute()
    except Exception:
        pass

    mb_q = client.table("moodboards").select("*").eq("id", share["moodboard_id"]).limit(1).execute()
    if not mb_q.data:
        raise HTTPException(404, "Not found")
    mb = mb_q.data[0]
    if mb.get("status") in (None, "draft"):
        raise HTTPException(403, "Not ready for review")
    els = client.table("moodboard_elements").select("*") \
        .eq("moodboard_id", mb["id"]).order("sort_order").execute()
    mb["elements"] = [_normalize_block(b) for b in (els.data or []) if not b.get("hidden")]
    mb.pop("tenant_id", None)
    return mb
