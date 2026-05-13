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
from core.page_skeletons import PAGE_SKELETONS, get_skeleton
from core.presentation_transitions import PRESENTATION_TRANSITIONS, VALID_TRANSITION_IDS
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
    `content` as a dict, `style` for visual props, and `metadata` for upload
    provenance / focal-point / origin tracking.
    """
    if not b:
        return b
    out = dict(b)
    # Hydrate JSONB columns into dicts (PostgREST may return strings)
    pos = _parse_jsonish(out.get("position_json"))
    style = _parse_jsonish(out.get("style_json"))
    content = _parse_jsonish(out.get("content"))
    metadata = _parse_jsonish(out.get("metadata_json"))

    # Backward-compat: legacy rows had layout inside content (pre-migration 002)
    if not pos and isinstance(content, dict) and "layout" in content:
        legacy = content.pop("layout") or {}
        pos = {**legacy}

    out["x"]       = pos.get("x", 40)
    out["y"]       = pos.get("y", 40)
    out["width"]   = pos.get("width", 320)
    out["height"]  = pos.get("height", 240)
    out["z_index"] = pos.get("z_index", 0)

    out["style"]    = style or {}
    out["content"]  = content or {}
    out["metadata"] = metadata or {}
    # Drop raw JSONB column dumps from the response (we re-expose them above)
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


def _ensure_default_page(client, tenant_id: str, moodboard_id: str, title: Optional[str]) -> str:
    """Idempotent helper: returns the moodboard's first page id, creating one
    on demand. Used as a safety net for legacy code paths that didn't yet
    populate `current_page_id` (the F.0 backfill should normally cover this)."""
    existing = client.table("moodboard_pages").select("id").eq("moodboard_id", moodboard_id) \
        .order("sort_order").limit(1).execute()
    if existing.data:
        return existing.data[0]["id"]
    new_id = str(uuid.uuid4())
    client.table("moodboard_pages").insert({
        "id": new_id, "tenant_id": tenant_id, "moodboard_id": moodboard_id,
        "title": title or "Page 1", "page_type": "blank",
        "aspect_ratio": "portrait_a4", "width": 1400, "height": 2400,
        "sort_order": 0,
    }).execute()
    client.table("moodboards").update({"current_page_id": new_id}).eq("id", moodboard_id).execute()
    return new_id


# ── Page schemas + presets ──────────────────────────────────────────────────
# Aspect-ratio presets are Blueprint-driven: a fixed registry the frontend
# can read via `GET /api/moodboards/_meta/page_presets`. NOT hardcoded UI.
ASPECT_RATIO_PRESETS = {
    "portrait_a4":     {"width": 1400, "height": 2400, "label_key": "moodboards.page.ratio.portraitA4"},
    "landscape_16_9": {"width": 1920, "height": 1080, "label_key": "moodboards.page.ratio.landscape169"},
    "square_1_1":      {"width": 1400, "height": 1400, "label_key": "moodboards.page.ratio.square"},
    "editorial_3_4":   {"width": 1400, "height": 1866, "label_key": "moodboards.page.ratio.editorial"},
    "wide_2_1":        {"width": 1920, "height":  960, "label_key": "moodboards.page.ratio.wide"},
    "cover_landscape": {"width": 1920, "height": 1200, "label_key": "moodboards.page.ratio.coverLandscape"},
}

PAGE_TYPES = [
    "cover", "blank", "mood", "material_board", "product_grid",
    "palette", "gallery", "split_story", "quote", "technical_board",
    "floorplan", "proposal_summary", "approval",
]


class PageCreate(BaseModel):
    title: Optional[str] = None
    page_type: Optional[str] = "blank"
    aspect_ratio: Optional[str] = "portrait_a4"
    sort_order: Optional[int] = None  # if absent → appended at the end
    background: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None


class PageUpdate(BaseModel):
    title: Optional[str] = None
    page_type: Optional[str] = None
    aspect_ratio: Optional[str] = None
    background: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None
    hidden_in_presentation: Optional[bool] = None
    # F.2 Presentation Sequencing™ — fields stored under `settings` JSONB
    chapter_label: Optional[str] = None
    transition_in: Optional[str] = None
    transition_out: Optional[str] = None
    transition_duration: Optional[int] = None
    hidden_from_client: Optional[bool] = None


class PageReorder(BaseModel):
    page_ids: List[str]  # in the desired order


# ── Block schemas ────────────────────────────────────────────────────────────
class BlockCreate(BaseModel):
    type: str
    page_id: Optional[str] = None  # F.0: target page; if absent defaults to current_page_id
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
    metadata: Optional[Dict[str, Any]] = None
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


# ── Page meta (presets registry) ────────────────────────────────────────────
@router.get("/_meta/page_presets")
def get_page_presets(ctx: dict = Depends(require_permission(P_MOODBOARDS_READ))):
    """Blueprint-driven registry the editor reads at boot to know which
    aspect ratios + page types are available. NEVER hardcode in frontend."""
    return {
        "aspect_ratios": [
            {"id": k, **v} for k, v in ASPECT_RATIO_PRESETS.items()
        ],
        "page_types": [
            {"id": pt, "label_key": f"moodboards.page.type.{pt}"} for pt in PAGE_TYPES
        ],
    }


# ── Page Skeletons (Master Layouts™) ────────────────────────────────────────
# Code-defined structural single-page layouts. Frontend reads via this endpoint
# and renders them in the "Add page" picker. Coordinates are absolute against
# each skeleton's aspect ratio canvas (1400x1866 editorial, 1920x1200 cover…).
@router.get("/_meta/presentation_transitions")
def get_presentation_transitions(ctx: dict = Depends(require_permission(P_MOODBOARDS_READ))):
    """F.2 Presentation Engine — cinematic transition catalog. NEVER hardcoded
    in JSX. Frontend reads this once at presentation boot and emits inline
    style keyframes for each page enter/exit."""
    return {"data": PRESENTATION_TRANSITIONS}


@router.get("/_meta/page_skeletons")
def get_page_skeletons(ctx: dict = Depends(require_permission(P_MOODBOARDS_READ))):
    """Return the structural page skeleton catalog with computed
    width/height per skeleton so the frontend can render scale-correct previews
    without a second lookup."""
    out = []
    for sk in PAGE_SKELETONS:
        preset = ASPECT_RATIO_PRESETS.get(sk["aspect_ratio"], ASPECT_RATIO_PRESETS["portrait_a4"])
        out.append({
            "id": sk["id"],
            "label_key": sk["label_key"],
            "category_key": sk["category_key"],
            "page_type": sk["page_type"],
            "aspect_ratio": sk["aspect_ratio"],
            "width": preset["width"],
            "height": preset["height"],
            # Slim preview payload — only what's needed to draw the mini canvas
            "blocks_preview": [
                {"type": b["type"], "x": b["x"], "y": b["y"],
                 "width": b["width"], "height": b["height"], "z_index": b.get("z_index", 0)}
                for b in sk["blocks"]
            ],
            "block_count": len(sk["blocks"]),
        })
    return {"data": out}


class PageFromSkeleton(BaseModel):
    skeleton_id: str
    title: Optional[str] = None
    sort_order: Optional[int] = None  # if absent → appended at the end


@router.post("/{moodboard_id}/pages/from_skeleton", status_code=201)
def create_page_from_skeleton(moodboard_id: str, body: PageFromSkeleton,
                              ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    """Create a new page and seed it with placeholder blocks from a
    structural skeleton. Atomic-ish: page + blocks inserted in sequence.
    The page is appended at the end unless `sort_order` is provided."""
    client = db()
    mb = _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    try:
        sk = get_skeleton(body.skeleton_id)
    except KeyError:
        raise HTTPException(404, f"Unknown skeleton: {body.skeleton_id}")

    preset = ASPECT_RATIO_PRESETS.get(sk["aspect_ratio"], ASPECT_RATIO_PRESETS["portrait_a4"])

    # Auto-append if sort_order absent
    if body.sort_order is None:
        max_q = client.table("moodboard_pages").select("sort_order") \
            .eq("moodboard_id", moodboard_id).order("sort_order", desc=True).limit(1).execute()
        sort_order = ((max_q.data[0]["sort_order"] if max_q.data else -1) + 1)
    else:
        sort_order = body.sort_order

    page_id = str(uuid.uuid4())
    page_row = {
        "id": page_id,
        "tenant_id": ctx["tenant_id"],
        "moodboard_id": moodboard_id,
        "title": body.title or None,
        "page_type": sk["page_type"],
        "aspect_ratio": sk["aspect_ratio"],
        "width": preset["width"], "height": preset["height"],
        "background": {},
        "settings": {"skeleton_id": sk["id"]},
        "sort_order": sort_order,
        "created_by": ctx["profile_id"],
    }
    client.table("moodboard_pages").insert(page_row).execute()

    # Seed placeholder blocks for the new page
    for idx, b in enumerate(sk["blocks"]):
        if b["type"] not in SUPPORTED_BLOCK_TYPES:
            continue
        content = b.get("content") or {}
        client.table("moodboard_elements").insert({
            "id": str(uuid.uuid4()),
            "tenant_id": ctx["tenant_id"],
            "moodboard_id": moodboard_id,
            "page_id": page_id,
            "type": b["type"],
            "sort_order": idx,
            "content": json.dumps(content),
            "position_json": _build_position(b["x"], b["y"], b["width"], b["height"], b.get("z_index", 0)),
            "style_json": b.get("style") or {},
            "title": content.get("caption") if b["type"] == "image" else None,
        }).execute()

    client.table("moodboards").update({"updated_at": _now()}).eq("id", moodboard_id).execute()
    _push_activity(ctx["tenant_id"], mb.get("project_id"), ctx["profile_id"],
                   "moodboard.page_added", moodboard_id, mb.get("title"),
                   {"page_id": page_id, "skeleton_id": sk["id"]})
    return page_row


# ── Page CRUD ───────────────────────────────────────────────────────────────
@router.get("/{moodboard_id}/pages")
def list_pages(moodboard_id: str, ctx: dict = Depends(require_permission(P_MOODBOARDS_READ))):
    client = db()
    _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    r = client.table("moodboard_pages").select("*") \
        .eq("moodboard_id", moodboard_id).order("sort_order").execute()
    return {"data": r.data or []}


@router.post("/{moodboard_id}/pages", status_code=201)
def create_page(moodboard_id: str, body: PageCreate,
                ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    client = db()
    mb = _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    if body.page_type and body.page_type not in PAGE_TYPES:
        raise HTTPException(400, f"Invalid page_type: {body.page_type}")
    if body.aspect_ratio and body.aspect_ratio not in ASPECT_RATIO_PRESETS:
        raise HTTPException(400, f"Invalid aspect_ratio: {body.aspect_ratio}")

    # Auto-append if sort_order absent
    if body.sort_order is None:
        max_q = client.table("moodboard_pages").select("sort_order") \
            .eq("moodboard_id", moodboard_id).order("sort_order", desc=True).limit(1).execute()
        sort_order = ((max_q.data[0]["sort_order"] if max_q.data else -1) + 1)
    else:
        sort_order = body.sort_order

    preset = ASPECT_RATIO_PRESETS.get(body.aspect_ratio or "portrait_a4", ASPECT_RATIO_PRESETS["portrait_a4"])
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "moodboard_id": moodboard_id,
        "title": body.title,
        "page_type": body.page_type or "blank",
        "aspect_ratio": body.aspect_ratio or "portrait_a4",
        "width": preset["width"], "height": preset["height"],
        "background": body.background or {},
        "settings": body.settings or {},
        "sort_order": sort_order,
        "created_by": ctx["profile_id"],
    }
    r = client.table("moodboard_pages").insert(row).execute()
    client.table("moodboards").update({"updated_at": _now()}).eq("id", moodboard_id).execute()
    _push_activity(ctx["tenant_id"], mb.get("project_id"), ctx["profile_id"],
                   "moodboard.page_added", moodboard_id, mb.get("title"),
                   {"page_id": row["id"]})
    return r.data[0] if r.data else row


@router.put("/{moodboard_id}/pages/{page_id}")
def update_page(moodboard_id: str, page_id: str, body: PageUpdate,
                ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    client = db()
    _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    cur = client.table("moodboard_pages").select("*") \
        .eq("id", page_id).eq("moodboard_id", moodboard_id).limit(1).execute()
    if not cur.data:
        raise HTTPException(404, "Page not found")
    body_d = body.model_dump(exclude_none=True)
    if "page_type" in body_d and body_d["page_type"] not in PAGE_TYPES:
        raise HTTPException(400, f"Invalid page_type: {body_d['page_type']}")
    if "aspect_ratio" in body_d:
        if body_d["aspect_ratio"] not in ASPECT_RATIO_PRESETS:
            raise HTTPException(400, f"Invalid aspect_ratio: {body_d['aspect_ratio']}")
        preset = ASPECT_RATIO_PRESETS[body_d["aspect_ratio"]]
        body_d["width"] = preset["width"]
        body_d["height"] = preset["height"]

    # F.2: Presentation fields are stored inside `settings` JSONB (no schema
    # migration needed). Validate transition ids against the registry.
    presentation_keys = ("chapter_label", "transition_in", "transition_out",
                         "transition_duration", "hidden_from_client")
    presentation_patch = {k: body_d.pop(k) for k in presentation_keys if k in body_d}
    if presentation_patch:
        for k in ("transition_in", "transition_out"):
            v = presentation_patch.get(k)
            if v is not None and v not in VALID_TRANSITION_IDS:
                raise HTTPException(400, f"Invalid {k}: {v}")
        cur_settings = cur.data[0].get("settings") or {}
        if not isinstance(cur_settings, dict):
            cur_settings = {}
        # Merge atomically so unrelated keys (e.g. skeleton_id) survive
        merged = {**cur_settings, **presentation_patch}
        # Allow explicit clearing via empty string for chapter_label
        if presentation_patch.get("chapter_label") == "":
            merged.pop("chapter_label", None)
        # Settings explicitly provided in body merges on top
        if "settings" in body_d and isinstance(body_d["settings"], dict):
            merged = {**merged, **body_d["settings"]}
        body_d["settings"] = merged

    body_d["updated_at"] = _now()
    r = client.table("moodboard_pages").update(body_d) \
        .eq("id", page_id).eq("moodboard_id", moodboard_id).execute()
    client.table("moodboards").update({"updated_at": _now()}).eq("id", moodboard_id).execute()
    return r.data[0] if r.data else {**cur.data[0], **body_d}


@router.delete("/{moodboard_id}/pages/{page_id}")
def delete_page(moodboard_id: str, page_id: str,
                ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    client = db()
    mb = _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    # Block deletion of the last page (every moodboard must have at least one)
    all_pages = client.table("moodboard_pages").select("id") \
        .eq("moodboard_id", moodboard_id).execute().data or []
    if len(all_pages) <= 1:
        raise HTTPException(409, "Cannot delete the last page of a moodboard")
    client.table("moodboard_pages").delete() \
        .eq("id", page_id).eq("moodboard_id", moodboard_id).execute()
    # If the deleted page was the current_page_id, fallback to first remaining
    if mb.get("current_page_id") == page_id:
        remaining = client.table("moodboard_pages").select("id") \
            .eq("moodboard_id", moodboard_id).order("sort_order").limit(1).execute()
        new_current = remaining.data[0]["id"] if remaining.data else None
        client.table("moodboards").update({"current_page_id": new_current, "updated_at": _now()}) \
            .eq("id", moodboard_id).execute()
    return {"deleted": page_id}


@router.post("/{moodboard_id}/pages/{page_id}/duplicate", status_code=201)
def duplicate_page(moodboard_id: str, page_id: str,
                   ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    client = db()
    _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    src = client.table("moodboard_pages").select("*") \
        .eq("id", page_id).eq("moodboard_id", moodboard_id).limit(1).execute()
    if not src.data:
        raise HTTPException(404, "Page not found")
    p = src.data[0]
    new_id = str(uuid.uuid4())
    new_page = {**p,
                "id": new_id,
                "title": (p.get("title") or "Page") + " (copy)",
                "sort_order": (p.get("sort_order") or 0) + 1,
                "created_at": _now(), "updated_at": _now()}
    new_page.pop("created_by", None)
    new_page["created_by"] = ctx["profile_id"]
    # Push subsequent pages one slot down so the copy slots in right after src
    later = client.table("moodboard_pages").select("id, sort_order") \
        .eq("moodboard_id", moodboard_id).gt("sort_order", p["sort_order"]).execute()
    for row in (later.data or []):
        client.table("moodboard_pages").update({"sort_order": row["sort_order"] + 1}) \
            .eq("id", row["id"]).execute()
    client.table("moodboard_pages").insert(new_page).execute()

    # Clone all elements of the source page into the new page (preserving layout)
    src_els = client.table("moodboard_elements").select("*") \
        .eq("page_id", page_id).execute().data or []
    for el in src_els:
        new_el = {**el,
                  "id": str(uuid.uuid4()),
                  "page_id": new_id,
                  "created_at": _now(), "updated_at": _now()}
        client.table("moodboard_elements").insert(new_el).execute()
    client.table("moodboards").update({"updated_at": _now()}).eq("id", moodboard_id).execute()
    return new_page


@router.post("/{moodboard_id}/pages/reorder")
def reorder_pages(moodboard_id: str, body: PageReorder,
                  ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    client = db()
    _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    # Validate: every id must belong to this moodboard
    existing = client.table("moodboard_pages").select("id") \
        .eq("moodboard_id", moodboard_id).execute().data or []
    existing_ids = {p["id"] for p in existing}
    if set(body.page_ids) != existing_ids:
        raise HTTPException(400, "page_ids must match the full page set of this moodboard")
    for idx, pid in enumerate(body.page_ids):
        client.table("moodboard_pages").update({"sort_order": idx, "updated_at": _now()}) \
            .eq("id", pid).execute()
    client.table("moodboards").update({"updated_at": _now()}).eq("id", moodboard_id).execute()
    return {"updated": len(body.page_ids)}


# ── Block CRUD ───────────────────────────────────────────────────────────────
@router.post("/{moodboard_id}/blocks", status_code=201)
def create_block(moodboard_id: str, body: BlockCreate, ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    client = db()
    mb = _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    if body.type not in SUPPORTED_BLOCK_TYPES:
        raise HTTPException(400, f"Unsupported block type: {body.type}")
    content = body.content or {}
    # Determine target page: explicit body.page_id wins, else moodboard's current_page_id,
    # else the first page (sort_order ASC). Auto-creates a default page if none exists
    # (legacy safety net — F.0 backfill normally already created one).
    page_id = body.page_id or mb.get("current_page_id")
    if not page_id:
        page_id = _ensure_default_page(client, ctx["tenant_id"], moodboard_id, mb.get("title"))
    # For image blocks, mirror src into image_url so the column is actually used
    image_url = content.get("src") if body.type == "image" else None
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "moodboard_id": moodboard_id,
        "page_id": page_id,
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
    cur = client.table("moodboard_elements").select("content, position_json, style_json, metadata_json, type") \
        .eq("id", block_id).eq("moodboard_id", moodboard_id).limit(1).execute()
    if not cur.data:
        raise HTTPException(404, "Block not found")
    row = cur.data[0]
    pos = _parse_jsonish(row.get("position_json"))
    style = _parse_jsonish(row.get("style_json"))
    content = _parse_jsonish(row.get("content"))
    metadata = _parse_jsonish(row.get("metadata_json"))

    body_d = body.model_dump(exclude_none=True)
    for k in ("x", "y", "width", "height", "z_index"):
        if k in body_d:
            pos[k] = body_d.pop(k)
    if "content" in body_d:
        content = {**content, **(body_d.pop("content") or {})}
    if "style" in body_d:
        style = {**style, **(body_d.pop("style") or {})}
    if "metadata" in body_d:
        metadata = {**metadata, **(body_d.pop("metadata") or {})}

    payload = {
        "position_json": pos, "style_json": style,
        "metadata_json": metadata, "content": json.dumps(content),
    }
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
        cur = client.table("moodboard_elements").select("content, position_json, style_json, metadata_json, type") \
            .eq("id", bid).eq("moodboard_id", moodboard_id).limit(1).execute()
        if not cur.data:
            continue
        row = cur.data[0]
        pos = _parse_jsonish(row.get("position_json"))
        style = _parse_jsonish(row.get("style_json"))
        content = _parse_jsonish(row.get("content"))
        metadata = _parse_jsonish(row.get("metadata_json"))
        for k in ("x", "y", "width", "height", "z_index"):
            if k in b and b[k] is not None:
                pos[k] = b[k]
        if isinstance(b.get("content"), dict):
            content = {**content, **b["content"]}
        if isinstance(b.get("style"), dict):
            style = {**style, **b["style"]}
        if isinstance(b.get("metadata"), dict):
            metadata = {**metadata, **b["metadata"]}
        upd = {"position_json": pos, "style_json": style,
               "metadata_json": metadata, "content": json.dumps(content),
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
    # F.2: include pages so the public Presentation Mode can render
    # cinematic multi-page sequences. Filter out pages flagged as
    # `settings.hidden_from_client == True` (internal designer pages).
    pages_q = client.table("moodboard_pages").select("*") \
        .eq("moodboard_id", mb["id"]).order("sort_order").execute()
    all_pages = pages_q.data or []
    visible_pages = [
        p for p in all_pages
        if not (isinstance(p.get("settings"), dict)
                and p["settings"].get("hidden_from_client") is True)
    ]
    mb["pages"] = visible_pages
    visible_page_ids = {p["id"] for p in visible_pages}

    els = client.table("moodboard_elements").select("*") \
        .eq("moodboard_id", mb["id"]).order("sort_order").execute()
    raw_blocks = els.data or []
    mb["elements"] = [
        _normalize_block(b) for b in raw_blocks
        if not b.get("hidden")
        # Drop blocks belonging to client-hidden pages (or to no page on
        # a moodboard with the multi-page model). Legacy blocks without
        # page_id stay attached to the first visible page.
        and (
            b.get("page_id") in visible_page_ids
            or (not b.get("page_id") and visible_pages)
        )
    ]
    mb.pop("tenant_id", None)
    return mb
