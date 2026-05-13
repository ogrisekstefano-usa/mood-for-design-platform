"""Blueprint Inspirations™ — Creative Memory System™ foundation.

Boards · Items · Activity · Comments — backend architecture for the
creative archive that lives alongside (and feeds into) the Moodboard Builder
PRO. Designed to also power the future Mood Discovery™ workflow:

    lead → cliente upload references → designer salva ispirazioni →
    organizza in board → Moodboard Builder PRO

Storage notes (migration 011):
  - inspirations_boards    (tenant-scoped, optionally linked to lead/project/moodboard)
  - inspirations_items     (image/link/product/note/pdf/video/material)
  - inspirations_activity  (first-class timeline events)
  - inspirations_comments  (designer ↔ client threading)

JSONB fields kept open-ended for future AI enrichment (ai_tags, palette,
style classification). NEVER hardcode tag / category vocabularies in the
frontend — they come from tenant config or future registries.
"""
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.permissions import P_INSPIRATIONS_READ, P_INSPIRATIONS_WRITE
from core.tenant_context import require_permission, audit_log
from database import db

router = APIRouter()


# ── Vocabularies (deliberately permissive; no enums in DB) ──────────────────
VALID_VISIBILITY = {"private", "team", "project", "shared"}
VALID_ITEM_TYPES = {"image", "link", "product", "note", "pdf", "video", "material"}
VALID_ACTIVITY_TYPES = {
    "board_created", "board_updated",
    "item_added", "item_removed", "item_updated",
    "note_added", "client_uploaded", "moved", "tagged",
    "linked_to_project", "linked_to_lead", "linked_to_moodboard",
    "comment_added",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_jsonish(v):
    """JSONB columns can surface as dict or as a JSON string via PostgREST."""
    if v is None:
        return None
    if isinstance(v, (dict, list)):
        return v
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return None
    return None


def _hydrate_board(row: dict) -> dict:
    if not row:
        return row
    out = dict(row)
    out["tags"] = _parse_jsonish(out.pop("tags_json", None)) or []
    out.pop("tenant_id", None)
    return out


def _hydrate_item(row: dict) -> dict:
    if not row:
        return row
    out = dict(row)
    out["metadata"] = _parse_jsonish(out.pop("metadata_json", None)) or {}
    out["style_tags"] = _parse_jsonish(out.pop("style_tags_json", None)) or []
    out["ai_tags"] = _parse_jsonish(out.pop("ai_tags_json", None)) or []
    out["extracted_palette"] = _parse_jsonish(out.pop("extracted_palette_json", None)) or []
    out["position"] = _parse_jsonish(out.pop("position_json", None)) or {}
    out.pop("tenant_id", None)
    return out


def _push_activity(client, *, tenant_id: str, board_id: str, actor_id: Optional[str],
                   activity_type: str, payload: Optional[dict] = None,
                   item_id: Optional[str] = None) -> None:
    """Fire-and-forget. Failures must NEVER bubble up — activity is best-effort."""
    if activity_type not in VALID_ACTIVITY_TYPES:
        return
    try:
        client.table("inspirations_activity").insert({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "board_id": board_id,
            "item_id": item_id,
            "actor_id": actor_id,
            "activity_type": activity_type,
            "payload_json": payload or {},
        }).execute()
    except Exception:  # noqa: BLE001 — activity must never break the user flow
        pass


def _assert_board(client, board_id: str, tenant_id: str) -> dict:
    r = client.table("inspirations_boards").select("*").eq("id", board_id) \
        .eq("tenant_id", tenant_id).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Board not found")
    return r.data[0]


# ── Schemas ─────────────────────────────────────────────────────────────────
class BoardCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    description: Optional[str] = None
    cover_image: Optional[str] = None
    visibility: str = "private"
    tags: Optional[List[str]] = None
    project_id: Optional[str] = None
    lead_id: Optional[str] = None
    moodboard_id: Optional[str] = None


class BoardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    cover_image: Optional[str] = None
    visibility: Optional[str] = None
    tags: Optional[List[str]] = None
    project_id: Optional[str] = None
    lead_id: Optional[str] = None
    moodboard_id: Optional[str] = None


class ItemCreate(BaseModel):
    type: str
    title: Optional[str] = None
    description: Optional[str] = None
    source_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    asset_url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    style_tags: Optional[List[str]] = None
    position: Optional[Dict[str, Any]] = None


class ItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    source_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    asset_url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    style_tags: Optional[List[str]] = None
    ai_tags: Optional[List[str]] = None
    extracted_palette: Optional[List[Dict[str, Any]]] = None
    position: Optional[Dict[str, Any]] = None


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    item_id: Optional[str] = None


# ── Boards CRUD ─────────────────────────────────────────────────────────────
@router.get("/boards")
def list_boards(
    project_id: Optional[str] = Query(None),
    lead_id: Optional[str] = Query(None),
    moodboard_id: Optional[str] = Query(None),
    visibility: Optional[str] = Query(None),
    ctx: dict = Depends(require_permission(P_INSPIRATIONS_READ)),
):
    """List boards visible to the current tenant. Filterable by project / lead /
    moodboard linkage so the UI can render context-scoped sections (e.g.
    "Inspirations for THIS project" inside the project workspace)."""
    client = db()
    q = client.table("inspirations_boards").select("*").eq("tenant_id", ctx["tenant_id"])
    if project_id:
        q = q.eq("project_id", project_id)
    if lead_id:
        q = q.eq("lead_id", lead_id)
    if moodboard_id:
        q = q.eq("moodboard_id", moodboard_id)
    if visibility:
        q = q.eq("visibility", visibility)
    r = q.order("updated_at", desc=True).execute()
    return {"data": [_hydrate_board(b) for b in (r.data or [])]}


@router.post("/boards", status_code=201)
def create_board(body: BoardCreate,
                 ctx: dict = Depends(require_permission(P_INSPIRATIONS_WRITE))):
    if body.visibility not in VALID_VISIBILITY:
        raise HTTPException(400, f"Invalid visibility: {body.visibility}")
    client = db()
    board_id = str(uuid.uuid4())
    row = {
        "id": board_id,
        "tenant_id": ctx["tenant_id"],
        "created_by": ctx["profile_id"],
        "project_id": body.project_id,
        "lead_id": body.lead_id,
        "moodboard_id": body.moodboard_id,
        "title": body.title,
        "description": body.description,
        "cover_image": body.cover_image,
        "visibility": body.visibility,
        "tags_json": body.tags or [],
    }
    r = client.table("inspirations_boards").insert(row).execute()
    _push_activity(client, tenant_id=ctx["tenant_id"], board_id=board_id,
                   actor_id=ctx["profile_id"], activity_type="board_created",
                   payload={"title": body.title})
    audit_log(ctx["tenant_id"], ctx["profile_id"], "inspirations.board.create",
              resource_type="inspirations_board", resource_id=board_id,
              metadata={"title": body.title})
    return _hydrate_board(r.data[0] if r.data else row)


@router.get("/boards/{board_id}")
def get_board(board_id: str,
              ctx: dict = Depends(require_permission(P_INSPIRATIONS_READ))):
    client = db()
    board = _assert_board(client, board_id, ctx["tenant_id"])
    # Inline item count and recent items header — avoids an N+1 from the UI.
    items = client.table("inspirations_items").select("*") \
        .eq("board_id", board_id).order("created_at", desc=True).execute()
    items_data = [_hydrate_item(i) for i in (items.data or [])]
    out = _hydrate_board(board)
    out["items"] = items_data
    out["item_count"] = len(items_data)
    return out


@router.patch("/boards/{board_id}")
def update_board(board_id: str, body: BoardUpdate,
                 ctx: dict = Depends(require_permission(P_INSPIRATIONS_WRITE))):
    client = db()
    _assert_board(client, board_id, ctx["tenant_id"])
    patch = body.model_dump(exclude_none=True)
    if "visibility" in patch and patch["visibility"] not in VALID_VISIBILITY:
        raise HTTPException(400, f"Invalid visibility: {patch['visibility']}")
    if "tags" in patch:
        patch["tags_json"] = patch.pop("tags")
    patch["updated_at"] = _now()
    r = client.table("inspirations_boards").update(patch) \
        .eq("id", board_id).eq("tenant_id", ctx["tenant_id"]).execute()
    # Track meaningful link changes as activity (designer wants this in timeline)
    linkage_changes = {k: patch[k] for k in ("project_id", "lead_id", "moodboard_id") if k in patch}
    for k, v in linkage_changes.items():
        if v:
            _push_activity(client, tenant_id=ctx["tenant_id"], board_id=board_id,
                           actor_id=ctx["profile_id"],
                           activity_type=f"linked_to_{k.replace('_id', '')}",
                           payload={k: v})
    _push_activity(client, tenant_id=ctx["tenant_id"], board_id=board_id,
                   actor_id=ctx["profile_id"], activity_type="board_updated",
                   payload={"fields": list(patch.keys())})
    return _hydrate_board(r.data[0] if r.data else None)


@router.delete("/boards/{board_id}")
def delete_board(board_id: str,
                 ctx: dict = Depends(require_permission(P_INSPIRATIONS_WRITE))):
    client = db()
    _assert_board(client, board_id, ctx["tenant_id"])
    # CASCADE on FK handles items / activity / comments
    client.table("inspirations_boards").delete().eq("id", board_id) \
        .eq("tenant_id", ctx["tenant_id"]).execute()
    audit_log(ctx["tenant_id"], ctx["profile_id"], "inspirations.board.delete",
              resource_type="inspirations_board", resource_id=board_id)
    return {"deleted": board_id}


# ── Items CRUD ──────────────────────────────────────────────────────────────
@router.get("/boards/{board_id}/items")
def list_items(board_id: str, type: Optional[str] = Query(None),
               ctx: dict = Depends(require_permission(P_INSPIRATIONS_READ))):
    client = db()
    _assert_board(client, board_id, ctx["tenant_id"])
    q = client.table("inspirations_items").select("*").eq("board_id", board_id)
    if type:
        if type not in VALID_ITEM_TYPES:
            raise HTTPException(400, f"Invalid type: {type}")
        q = q.eq("type", type)
    r = q.order("created_at", desc=True).execute()
    return {"data": [_hydrate_item(i) for i in (r.data or [])]}


@router.post("/boards/{board_id}/items", status_code=201)
def create_item(board_id: str, body: ItemCreate,
                ctx: dict = Depends(require_permission(P_INSPIRATIONS_WRITE))):
    if body.type not in VALID_ITEM_TYPES:
        raise HTTPException(400, f"Invalid type: {body.type}. "
                                 f"Allowed: {sorted(VALID_ITEM_TYPES)}")
    client = db()
    _assert_board(client, board_id, ctx["tenant_id"])
    item_id = str(uuid.uuid4())
    row = {
        "id": item_id,
        "tenant_id": ctx["tenant_id"],
        "board_id": board_id,
        "type": body.type,
        "title": body.title,
        "description": body.description,
        "source_url": body.source_url,
        "thumbnail_url": body.thumbnail_url,
        "asset_url": body.asset_url,
        "metadata_json": body.metadata or {},
        "style_tags_json": body.style_tags or [],
        "ai_tags_json": [],
        "extracted_palette_json": [],
        "position_json": body.position or {},
        "created_by": ctx["profile_id"],
    }
    r = client.table("inspirations_items").insert(row).execute()
    _push_activity(client, tenant_id=ctx["tenant_id"], board_id=board_id,
                   actor_id=ctx["profile_id"], activity_type="item_added",
                   item_id=item_id,
                   payload={"type": body.type, "title": body.title})
    # Bump board.updated_at so the boards list re-sorts naturally
    client.table("inspirations_boards").update({"updated_at": _now()}) \
        .eq("id", board_id).execute()
    return _hydrate_item(r.data[0] if r.data else row)


@router.patch("/items/{item_id}")
def update_item(item_id: str, body: ItemUpdate,
                ctx: dict = Depends(require_permission(P_INSPIRATIONS_WRITE))):
    client = db()
    cur = client.table("inspirations_items").select("*").eq("id", item_id) \
        .eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not cur.data:
        raise HTTPException(404, "Item not found")
    item = cur.data[0]
    patch = body.model_dump(exclude_none=True)
    # Map domain field names → JSONB columns
    for src, dst in (("metadata", "metadata_json"),
                     ("style_tags", "style_tags_json"),
                     ("ai_tags", "ai_tags_json"),
                     ("extracted_palette", "extracted_palette_json"),
                     ("position", "position_json")):
        if src in patch:
            patch[dst] = patch.pop(src)
    patch["updated_at"] = _now()
    r = client.table("inspirations_items").update(patch).eq("id", item_id) \
        .eq("tenant_id", ctx["tenant_id"]).execute()
    activity_type = "moved" if patch.keys() == {"position_json", "updated_at"} \
        else ("tagged" if "style_tags_json" in patch else "item_updated")
    _push_activity(client, tenant_id=ctx["tenant_id"], board_id=item["board_id"],
                   actor_id=ctx["profile_id"], activity_type=activity_type,
                   item_id=item_id, payload={"fields": list(patch.keys())})
    return _hydrate_item(r.data[0] if r.data else None)


@router.delete("/items/{item_id}")
def delete_item(item_id: str,
                ctx: dict = Depends(require_permission(P_INSPIRATIONS_WRITE))):
    client = db()
    cur = client.table("inspirations_items").select("id, board_id, title, type") \
        .eq("id", item_id).eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not cur.data:
        raise HTTPException(404, "Item not found")
    item = cur.data[0]
    client.table("inspirations_items").delete().eq("id", item_id) \
        .eq("tenant_id", ctx["tenant_id"]).execute()
    _push_activity(client, tenant_id=ctx["tenant_id"], board_id=item["board_id"],
                   actor_id=ctx["profile_id"], activity_type="item_removed",
                   item_id=None,
                   payload={"title": item.get("title"), "type": item.get("type")})
    return {"deleted": item_id}


# ── Activity timeline ───────────────────────────────────────────────────────
@router.get("/boards/{board_id}/activity")
def list_activity(board_id: str, limit: int = Query(50, ge=1, le=500),
                  ctx: dict = Depends(require_permission(P_INSPIRATIONS_READ))):
    client = db()
    _assert_board(client, board_id, ctx["tenant_id"])
    r = client.table("inspirations_activity").select("*").eq("board_id", board_id) \
        .order("created_at", desc=True).limit(limit).execute()
    # Strip tenant_id from response; payload is already JSONB
    data = []
    for a in (r.data or []):
        a.pop("tenant_id", None)
        a["payload"] = _parse_jsonish(a.pop("payload_json", None)) or {}
        data.append(a)
    return {"data": data}


# ── Comments ────────────────────────────────────────────────────────────────
@router.get("/boards/{board_id}/comments")
def list_comments(board_id: str,
                  item_id: Optional[str] = Query(None),
                  ctx: dict = Depends(require_permission(P_INSPIRATIONS_READ))):
    client = db()
    _assert_board(client, board_id, ctx["tenant_id"])
    q = client.table("inspirations_comments").select("*").eq("board_id", board_id)
    if item_id:
        q = q.eq("item_id", item_id)
    r = q.order("created_at", desc=True).execute()
    out = []
    for c in (r.data or []):
        c.pop("tenant_id", None)
        out.append(c)
    return {"data": out}


@router.post("/boards/{board_id}/comments", status_code=201)
def create_comment(board_id: str, body: CommentCreate,
                   ctx: dict = Depends(require_permission(P_INSPIRATIONS_WRITE))):
    client = db()
    _assert_board(client, board_id, ctx["tenant_id"])
    if body.item_id:
        # Ensure item belongs to the same board (defensive)
        itm = client.table("inspirations_items").select("id, board_id") \
            .eq("id", body.item_id).eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
        if not itm.data or itm.data[0]["board_id"] != board_id:
            raise HTTPException(400, "item_id does not belong to this board")
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "board_id": board_id,
        "item_id": body.item_id,
        "author_id": ctx["profile_id"],
        "body": body.body,
    }
    r = client.table("inspirations_comments").insert(row).execute()
    _push_activity(client, tenant_id=ctx["tenant_id"], board_id=board_id,
                   actor_id=ctx["profile_id"], activity_type="comment_added",
                   item_id=body.item_id, payload={"preview": body.body[:140]})
    out = r.data[0] if r.data else row
    out.pop("tenant_id", None)
    return out


# ── Meta (registry endpoints — future-friendly) ─────────────────────────────
@router.get("/_meta/registry")
def get_registry(ctx: dict = Depends(require_permission(P_INSPIRATIONS_READ))):
    """Public registry the UI reads at boot to know which item types,
    visibilities and activity types exist. Avoids any hardcoded vocabulary
    in the frontend — every dropdown / filter is derived from here."""
    return {
        "visibility": sorted(VALID_VISIBILITY),
        "item_types": sorted(VALID_ITEM_TYPES),
        "activity_types": sorted(VALID_ACTIVITY_TYPES),
    }
