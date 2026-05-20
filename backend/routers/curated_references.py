"""Curated References™ router — Phase F2.1.

Endpoint set under /api/inspirations/references/*:

  GET    /api/inspirations/references/collections           — list collections
  POST   /api/inspirations/references/collections           — create collection
  GET    /api/inspirations/references/collections/{id}      — read + items
  PATCH  /api/inspirations/references/collections/{id}      — update
  DELETE /api/inspirations/references/collections/{id}      — archive
  POST   /api/inspirations/references/save                  — save asset
                                                              (with or without collection)
  DELETE /api/inspirations/references/{id}                  — remove saved asset
  PATCH  /api/inspirations/references/{id}                  — update note/tags
  GET    /api/inspirations/references/by-asset/{asset_id}   — saved status for one asset

Visibility scoping:
  • 'private'         — visible only to creator (user_id == ctx.profile_id)
  • 'team'            — visible to whole tenant (default)
  • 'client_visible'  — visible AND surfaceable on client surfaces (P3)

All routes scope by tenant_id first. user_id filter only applies to
'private' rows; team & client_visible are tenant-wide.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from database import db

logger = logging.getLogger(__name__)
router = APIRouter()

VISIBILITY_VALUES = {"private", "team", "client_visible"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slim(row: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in (row or {}).items() if k != "_id"}


# ─── Models ────────────────────────────────────────────────────────────
class CollectionCreate(BaseModel):
    title:          str = Field(..., min_length=1, max_length=140)
    description:    Optional[str] = None
    tags:           Optional[List[str]] = None
    cover_asset_id: Optional[str] = None
    visibility:     Optional[str] = "team"


class CollectionUpdate(BaseModel):
    title:          Optional[str] = Field(None, min_length=1, max_length=140)
    description:    Optional[str] = None
    tags:           Optional[List[str]] = None
    cover_asset_id: Optional[str] = None
    visibility:     Optional[str] = None


class SaveBody(BaseModel):
    visual_asset_id:       str
    curated_collection_id: Optional[str] = None
    note:                  Optional[str] = None
    tags:                  Optional[List[str]] = None


class ReferencePatch(BaseModel):
    note:                  Optional[str] = None
    tags:                  Optional[List[str]] = None
    curated_collection_id: Optional[str] = None


# ─── Helpers ───────────────────────────────────────────────────────────
def _visibility_filter(query, tid: str, uid: Optional[str]):
    """Apply visibility filter on a select query.

    `team` and `client_visible` are tenant-wide.
    `private` only when user_id matches the requesting profile.
    """
    if not uid:
        return query.eq("tenant_id", tid).in_("visibility", ["team", "client_visible"])
    return (query.eq("tenant_id", tid)
            .or_(f"visibility.eq.team,visibility.eq.client_visible,and(visibility.eq.private,user_id.eq.{uid})"))


def _require_collection(c, tid: str, cid: str, uid: Optional[str]) -> Dict[str, Any]:
    rows = (c.table("curated_collections").select("*")
            .eq("id", cid).eq("tenant_id", tid).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Collezione non trovata")
    coll = rows[0]
    vis = coll.get("visibility") or "team"
    if vis == "private" and coll.get("user_id") and coll.get("user_id") != uid:
        raise HTTPException(403, "Collezione privata — non visibile")
    return coll


def _asset_card(media_row: Dict[str, Any]) -> Dict[str, Any]:
    """Slim media_library row → asset card for references."""
    meta = media_row.get("inspiration_meta") or {}
    return {
        "id":                 media_row.get("id"),
        "file_url":           media_row.get("file_url"),
        "alt_text":           media_row.get("alt_text"),
        "width":              media_row.get("width"),
        "height":             media_row.get("height"),
        "brand":              meta.get("brand"),
        "product_name":       meta.get("product_name"),
        "collection":         meta.get("collection"),
        "asset_type":         meta.get("asset_type"),
        "compositional_role": meta.get("compositional_role"),
        "color_family":       meta.get("color_family"),
        "mood_tags":          meta.get("mood_tags") or [],
        "moodboard_priority": meta.get("moodboard_priority"),
        "editorial_score":    meta.get("editorial_score"),
    }


def _enrich_collection_with_counts(c, tid: str, coll: Dict[str, Any]) -> Dict[str, Any]:
    rows = (c.table("saved_references").select("id,visual_asset_id")
            .eq("tenant_id", tid).eq("curated_collection_id", coll["id"])
            .limit(500).execute().data or [])
    out = _slim(coll)
    out["items_count"] = len(rows)
    # Cover asset URL — if cover_asset_id present hydrate, else last saved
    cover_asset_id = coll.get("cover_asset_id")
    if not cover_asset_id and rows:
        cover_asset_id = rows[-1]["visual_asset_id"]
    if cover_asset_id:
        m = (c.table("media_library").select("id,file_url,alt_text")
             .eq("id", cover_asset_id).eq("tenant_id", tid).limit(1)
             .execute().data or [])
        out["cover_asset"] = _slim(m[0]) if m else None
    else:
        out["cover_asset"] = None
    return out


# ─── COLLECTIONS · CRUD ────────────────────────────────────────────────
@router.get("/references/collections")
def list_collections(ctx=Depends(get_tenant_context),
                     limit: int = Query(60, le=200)):
    """List the studio's curated collections (team-visible + own private)."""
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")

    q = c.table("curated_collections").select("*")
    q = _visibility_filter(q, tid, uid)
    rows = q.order("updated_at", desc=True).limit(limit).execute().data or []

    items = [_enrich_collection_with_counts(c, tid, r) for r in rows]
    return {"items": items}


@router.post("/references/collections", status_code=201)
def create_collection(body: CollectionCreate, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")
    vis = (body.visibility or "team").lower()
    if vis not in VISIBILITY_VALUES:
        raise HTTPException(400, "visibility non valida (private|team|client_visible)")
    row = {
        "id":             str(uuid.uuid4()),
        "tenant_id":      tid,
        "user_id":        uid,
        "title":          body.title.strip(),
        "description":    (body.description or "").strip() or None,
        "tags":           [t.strip() for t in (body.tags or []) if t and t.strip()][:24],
        "cover_asset_id": body.cover_asset_id,
        "visibility":     vis,
        "created_at":     _now(),
        "updated_at":     _now(),
    }
    c.table("curated_collections").insert(row).execute()
    return {"item": _enrich_collection_with_counts(c, tid, row)}


@router.get("/references/collections/{cid}")
def get_collection(cid: str, ctx=Depends(get_tenant_context)):
    """Detail of one collection + saved items hydrated."""
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")
    coll = _require_collection(c, tid, cid, uid)
    saved = (c.table("saved_references")
             .select("id,visual_asset_id,note,tags,created_at")
             .eq("tenant_id", tid).eq("curated_collection_id", cid)
             .order("created_at", desc=True).limit(300).execute().data or [])
    items: List[Dict[str, Any]] = []
    if saved:
        ids = [s["visual_asset_id"] for s in saved]
        media = (c.table("media_library").select(
            "id,file_url,alt_text,width,height,inspiration_meta"
        ).in_("id", ids).eq("tenant_id", tid).limit(500).execute().data or [])
        by_id = {m["id"]: m for m in media}
        for s in saved:
            asset = by_id.get(s["visual_asset_id"])
            if not asset:
                continue
            card = _asset_card(asset)
            card["saved_reference_id"] = s["id"]
            card["note"] = s.get("note")
            card["reference_tags"] = s.get("tags") or []
            card["saved_at"] = s.get("created_at")
            items.append(card)
    out = _enrich_collection_with_counts(c, tid, coll)
    out["items"] = items
    return out


@router.patch("/references/collections/{cid}")
def update_collection(cid: str, body: CollectionUpdate, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")
    coll = _require_collection(c, tid, cid, uid)
    # Only creator can edit private; team-visible: any tenant_admin can edit
    if coll.get("visibility") == "private" and coll.get("user_id") != uid:
        raise HTTPException(403, "Collezione privata — non modificabile")

    patch: Dict[str, Any] = {}
    if body.title is not None:       patch["title"]          = body.title.strip()
    if body.description is not None: patch["description"]    = body.description.strip() or None
    if body.tags is not None:        patch["tags"]           = [t.strip() for t in body.tags if t and t.strip()][:24]
    if body.cover_asset_id is not None: patch["cover_asset_id"] = body.cover_asset_id
    if body.visibility is not None:
        vis = body.visibility.lower()
        if vis not in VISIBILITY_VALUES:
            raise HTTPException(400, "visibility non valida")
        patch["visibility"] = vis
    if not patch:
        return {"item": _enrich_collection_with_counts(c, tid, coll)}
    patch["updated_at"] = _now()
    c.table("curated_collections").update(patch).eq("id", cid).eq("tenant_id", tid).execute()
    coll = (c.table("curated_collections").select("*")
            .eq("id", cid).limit(1).execute().data or [])[0]
    return {"item": _enrich_collection_with_counts(c, tid, coll)}


@router.delete("/references/collections/{cid}", status_code=204)
def delete_collection(cid: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")
    coll = _require_collection(c, tid, cid, uid)
    if coll.get("visibility") == "private" and coll.get("user_id") != uid:
        raise HTTPException(403, "Collezione privata — non eliminabile")
    # Soft: detach saved_references (FK ON DELETE SET NULL), hard-delete collection
    c.table("curated_collections").delete().eq("id", cid).eq("tenant_id", tid).execute()
    return None


# ─── SAVED REFERENCES · CRUD ──────────────────────────────────────────
@router.post("/references/save", status_code=201)
def save_reference(body: SaveBody, ctx=Depends(get_tenant_context)):
    """Save a visual asset (with or without collection).

    Idempotent: if already saved into the same collection → return existing.
    """
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")

    # Validate asset exists in tenant
    asset_rows = (c.table("media_library").select("id,inspiration_meta,file_url,alt_text,width,height")
                  .eq("id", body.visual_asset_id).eq("tenant_id", tid)
                  .eq("is_inspiration", True).limit(1).execute().data or [])
    if not asset_rows:
        raise HTTPException(404, "Asset visuale non trovato")

    if body.curated_collection_id:
        _require_collection(c, tid, body.curated_collection_id, uid)

    # Idempotency check
    q = (c.table("saved_references").select("*")
         .eq("tenant_id", tid).eq("visual_asset_id", body.visual_asset_id))
    if body.curated_collection_id:
        q = q.eq("curated_collection_id", body.curated_collection_id)
    else:
        q = q.is_("curated_collection_id", "null")
    existing = q.limit(1).execute().data or []
    if existing:
        sr = existing[0]
        return {"item": _slim(sr), "asset": _asset_card(asset_rows[0]), "created": False}

    row = {
        "id":                    str(uuid.uuid4()),
        "tenant_id":             tid,
        "user_id":               uid,
        "visual_asset_id":       body.visual_asset_id,
        "curated_collection_id": body.curated_collection_id,
        "note":                  (body.note or "").strip() or None,
        "tags":                  [t.strip() for t in (body.tags or []) if t and t.strip()][:24],
        "created_at":            _now(),
    }
    c.table("saved_references").insert(row).execute()

    # Touch collection updated_at
    if body.curated_collection_id:
        c.table("curated_collections").update({"updated_at": _now()}).eq(
            "id", body.curated_collection_id).eq("tenant_id", tid).execute()

    return {"item": _slim(row), "asset": _asset_card(asset_rows[0]), "created": True}


@router.delete("/references/{rid}", status_code=204)
def remove_reference(rid: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("saved_references").select("*").eq("id", rid)
            .eq("tenant_id", tid).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Riferimento non trovato")
    c.table("saved_references").delete().eq("id", rid).eq("tenant_id", tid).execute()
    return None


@router.patch("/references/{rid}")
def patch_reference(rid: str, body: ReferencePatch, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("saved_references").select("*").eq("id", rid)
            .eq("tenant_id", tid).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Riferimento non trovato")
    patch: Dict[str, Any] = {}
    if body.note is not None: patch["note"] = body.note.strip() or None
    if body.tags is not None: patch["tags"] = [t.strip() for t in body.tags if t and t.strip()][:24]
    if body.curated_collection_id is not None:
        if body.curated_collection_id:
            _require_collection(c, tid, body.curated_collection_id, ctx.get("profile_id"))
        patch["curated_collection_id"] = body.curated_collection_id or None
    if not patch:
        return {"item": _slim(rows[0])}
    c.table("saved_references").update(patch).eq("id", rid).execute()
    sr = (c.table("saved_references").select("*").eq("id", rid).limit(1)
          .execute().data or [])[0]
    return {"item": _slim(sr)}


@router.get("/references/by-asset/{asset_id}")
def saved_status_for_asset(asset_id: str, ctx=Depends(get_tenant_context)):
    """Where is this asset saved? Returns list of collection_id (or null
    for scratchpad)."""
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("saved_references")
            .select("id,curated_collection_id,note,tags,created_at")
            .eq("tenant_id", tid).eq("visual_asset_id", asset_id)
            .limit(50).execute().data or [])
    return {
        "asset_id":  asset_id,
        "saved":     len(rows) > 0,
        "instances": [_slim(r) for r in rows],
    }
