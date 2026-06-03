"""ITER204 · STUDIO LIBRARY BRIDGE™ — unified curatorial library API.

The Studio Library is the studio's permanent curatorial heritage. It sits
between Brand Atlas (discovery) and Moodboards (creation), allowing
designers to save brands, collections, products, materials, and designers
into a single curated collection that survives across all projects.

Endpoints (all under `/api/studio-library`):
  GET    /                       List items (filter by entity_type)
  GET    /stats                  Per-entity-type counts
  POST   /                       Save an entity to the library
  POST   /toggle                 Save/unsave (idempotent toggle)
  DELETE /{item_id}              Remove an item
  DELETE /by-entity              Remove by (entity_type, entity_id)
  GET    /resolved               Items hydrated with display data
                                  (used by Moodboard "From Library" picker)

Strict Lock™:
  - tenant scoping enforced via get_tenant_context
  - entity_type restricted to {brand, collection, product, material, designer}
  - source_type nullable, reserved for future extensions
  - NO ObjectId / no _id leakage (Postgres only — UUID primary keys)
"""
from __future__ import annotations
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from database import db
from core.tenant_context import get_tenant_context

logger = logging.getLogger("studio_library")
router = APIRouter()

ALLOWED_ENTITY_TYPES = {"brand", "collection", "product", "material", "designer"}
ALLOWED_SOURCE_TYPES = {
    "academy", "editorial", "case_study", "market_insight",
    "brand_atlas", "manual", "import",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate_entity_type(entity_type: str) -> None:
    if entity_type not in ALLOWED_ENTITY_TYPES:
        raise HTTPException(
            400,
            f"entity_type non valido: {entity_type}. "
            f"Ammessi: {sorted(ALLOWED_ENTITY_TYPES)}",
        )


def _validate_source_type(source_type: Optional[str]) -> None:
    if source_type is None:
        return
    if source_type not in ALLOWED_SOURCE_TYPES:
        raise HTTPException(
            400,
            f"source_type non valido: {source_type}. "
            f"Ammessi: {sorted(ALLOWED_SOURCE_TYPES)} (oppure null)",
        )


# ── Pydantic models ─────────────────────────────────────────────────
class SaveItemBody(BaseModel):
    entity_type: str
    entity_id:   str
    source_type: Optional[str] = None
    notes:       Optional[str] = None
    metadata:    Optional[Dict[str, Any]] = Field(default_factory=dict)


class ToggleItemBody(BaseModel):
    entity_type: str
    entity_id:   str
    source_type: Optional[str] = None
    notes:       Optional[str] = None


class DeleteByEntityBody(BaseModel):
    entity_type: str
    entity_id:   str


# ══════════════════════════════════════════════════════════════════════
#  1 · LIST
# ══════════════════════════════════════════════════════════════════════
@router.get("")
@router.get("/")
def list_items(
    entity_type: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    limit:       int = Query(200, ge=1, le=500),
    ctx=Depends(get_tenant_context),
):
    """List Studio Library items for the tenant.

    Optional filters: ?entity_type=brand&source_type=brand_atlas
    """
    c = db()
    tid = ctx["tenant_id"]
    q = (c.table("studio_library_items")
         .select("id,entity_type,entity_id,source_type,saved_by,saved_at,notes,metadata")
         .eq("tenant_id", tid)
         .order("saved_at", desc=True)
         .limit(limit))
    if entity_type:
        _validate_entity_type(entity_type)
        q = q.eq("entity_type", entity_type)
    if source_type:
        _validate_source_type(source_type)
        q = q.eq("source_type", source_type)
    rows = q.execute().data or []
    return {"items": rows, "total": len(rows)}


# ══════════════════════════════════════════════════════════════════════
#  2 · STATS
# ══════════════════════════════════════════════════════════════════════
@router.get("/stats")
def library_stats(ctx=Depends(get_tenant_context)):
    """Return per-entity-type counts. Used by sidebar badge + Library page."""
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("studio_library_items")
            .select("entity_type")
            .eq("tenant_id", tid)
            .limit(5000).execute().data or [])
    counts: Dict[str, int] = {}
    for r in rows:
        et = r.get("entity_type")
        if et:
            counts[et] = counts.get(et, 0) + 1
    total = sum(counts.values())
    return {
        "total":  total,
        "counts": counts,
        "by_type": [
            {"entity_type": et, "count": counts.get(et, 0)}
            for et in ("brand", "collection", "product", "material", "designer")
        ],
    }


# ══════════════════════════════════════════════════════════════════════
#  3 · SAVE
# ══════════════════════════════════════════════════════════════════════
@router.post("")
@router.post("/")
def save_item(body: SaveItemBody, ctx=Depends(get_tenant_context)):
    """Save an entity to the Studio Library. Idempotent on (tenant, type, id).

    Returns the existing item if already saved (no-op duplicate protection).
    """
    _validate_entity_type(body.entity_type)
    _validate_source_type(body.source_type)
    c = db()
    tid = ctx["tenant_id"]

    existing = (c.table("studio_library_items")
                .select("id,entity_type,entity_id,source_type,saved_by,saved_at,notes,metadata")
                .eq("tenant_id", tid)
                .eq("entity_type", body.entity_type)
                .eq("entity_id", body.entity_id)
                .limit(1).execute().data or [])
    if existing:
        return {"ok": True, "item": existing[0], "already_saved": True}

    item = {
        "id":          str(uuid.uuid4()),
        "tenant_id":   tid,
        "entity_type": body.entity_type,
        "entity_id":   body.entity_id,
        "source_type": body.source_type,
        "saved_by":    ctx.get("profile_id"),
        "saved_at":    _now(),
        "notes":       body.notes,
        "metadata":    body.metadata or {},
    }
    c.table("studio_library_items").insert(item).execute()

    # Backwards-compat: keep studio_brand_links in sync for brand saves so
    # the legacy Brand Embassy "saved" flag stays accurate.
    if body.entity_type == "brand":
        try:
            link_exists = (c.table("studio_brand_links").select("id")
                           .eq("tenant_id", tid).eq("brand_id", body.entity_id)
                           .limit(1).execute().data or [])
            if not link_exists:
                c.table("studio_brand_links").insert({
                    "id":        str(uuid.uuid4()),
                    "tenant_id": tid,
                    "brand_id":  body.entity_id,
                    "linked_by": ctx.get("profile_id"),
                    "linked_at": _now(),
                    "note":      body.notes,
                }).execute()
        except Exception as ex:
            logger.warning(f"studio_brand_links sync failed: {ex}")

    # Strip tenant_id from response (internal only)
    item.pop("tenant_id", None)
    return {"ok": True, "item": item, "already_saved": False}


# ══════════════════════════════════════════════════════════════════════
#  4 · TOGGLE
# ══════════════════════════════════════════════════════════════════════
@router.post("/toggle")
def toggle_item(body: ToggleItemBody, ctx=Depends(get_tenant_context)):
    """Save if missing, unsave if present. Returns the new saved state."""
    _validate_entity_type(body.entity_type)
    _validate_source_type(body.source_type)
    c = db()
    tid = ctx["tenant_id"]

    existing = (c.table("studio_library_items")
                .select("id")
                .eq("tenant_id", tid)
                .eq("entity_type", body.entity_type)
                .eq("entity_id", body.entity_id)
                .limit(1).execute().data or [])
    if existing:
        c.table("studio_library_items").delete() \
            .eq("id", existing[0]["id"]).execute()
        if body.entity_type == "brand":
            try:
                c.table("studio_brand_links").delete() \
                    .eq("tenant_id", tid).eq("brand_id", body.entity_id).execute()
            except Exception:
                pass
        return {"ok": True, "saved": False}

    return save_item(  # type: ignore[arg-type]
        SaveItemBody(
            entity_type=body.entity_type,
            entity_id=body.entity_id,
            source_type=body.source_type or "manual",
            notes=body.notes,
        ),
        ctx,
    ) | {"saved": True}


# ══════════════════════════════════════════════════════════════════════
#  5 · DELETE
# ══════════════════════════════════════════════════════════════════════
@router.delete("/by-entity")
def delete_by_entity(body: DeleteByEntityBody, ctx=Depends(get_tenant_context)):
    _validate_entity_type(body.entity_type)
    c = db()
    tid = ctx["tenant_id"]
    c.table("studio_library_items").delete() \
        .eq("tenant_id", tid) \
        .eq("entity_type", body.entity_type) \
        .eq("entity_id", body.entity_id).execute()
    if body.entity_type == "brand":
        try:
            c.table("studio_brand_links").delete() \
                .eq("tenant_id", tid).eq("brand_id", body.entity_id).execute()
        except Exception:
            pass
    return {"ok": True, "deleted": True}


@router.delete("/{item_id}")
def delete_item(item_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("studio_library_items").select("id,entity_type,entity_id")
            .eq("id", item_id).eq("tenant_id", tid)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Voce Studio Library non trovata")
    item = rows[0]
    c.table("studio_library_items").delete() \
        .eq("id", item_id).eq("tenant_id", tid).execute()
    if item["entity_type"] == "brand":
        try:
            c.table("studio_brand_links").delete() \
                .eq("tenant_id", tid).eq("brand_id", item["entity_id"]).execute()
        except Exception:
            pass
    return {"ok": True, "deleted": True}


# ══════════════════════════════════════════════════════════════════════
#  6 · RESOLVED — hydrate with display data
# ══════════════════════════════════════════════════════════════════════
@router.get("/resolved")
def list_items_resolved(
    entity_type: Optional[str] = Query(None),
    ctx=Depends(get_tenant_context),
):
    """Return items joined with their display fields (name, image, slug).

    This is the canonical payload for the Studio Library page and the
    "From Studio Library" Moodboard picker. We avoid SQL joins (Supabase
    Python client doesn't expose them well) and instead do a per-type
    bulk fetch.
    """
    c = db()
    tid = ctx["tenant_id"]
    q = (c.table("studio_library_items")
         .select("id,entity_type,entity_id,source_type,saved_at,notes,metadata")
         .eq("tenant_id", tid)
         .order("saved_at", desc=True)
         .limit(500))
    if entity_type:
        _validate_entity_type(entity_type)
        q = q.eq("entity_type", entity_type)
    rows = q.execute().data or []

    # Group ids by type to bulk-fetch
    by_type: Dict[str, List[str]] = {}
    for r in rows:
        by_type.setdefault(r["entity_type"], []).append(r["entity_id"])

    resolved: Dict[str, Dict[str, Dict[str, Any]]] = {}

    # ── Brands
    if by_type.get("brand"):
        b_rows = (c.table("brands")
                  .select("id,name,slug,category,country,logo_url,"
                          "positioning,luxury_tier,hero_image_url,hero_subtitle,mood_dna")
                  .in_("id", by_type["brand"][:200])
                  .execute().data or [])
        resolved["brand"] = {b["id"]: b for b in b_rows}

    # ── Collections
    if by_type.get("collection"):
        col_rows = (c.table("collections_canonical")
                    .select("id,display_name,collection_key,brand_id,metadata_json")
                    .in_("id", by_type["collection"][:200])
                    .execute().data or [])
        resolved["collection"] = {x["id"]: x for x in col_rows}

    # ── Products
    if by_type.get("product"):
        try:
            p_rows = (c.table("products")
                      .select("id,product_name,brand_id,source_document_id")
                      .in_("id", by_type["product"][:200])
                      .execute().data or [])
            resolved["product"] = {x["id"]: x for x in p_rows}
        except Exception as ex:
            logger.warning(f"products hydrate: {ex}")
            resolved["product"] = {}

    # ── Materials
    if by_type.get("material"):
        m_rows = (c.table("materials_canonical")
                  .select("id,display_name,material_key,brand_id,metadata_json")
                  .in_("id", by_type["material"][:200])
                  .execute().data or [])
        resolved["material"] = {x["id"]: x for x in m_rows}

    # ── Designers
    if by_type.get("designer"):
        d_rows = (c.table("designers_canonical")
                  .select("id,display_name,designer_key,brand_id,metadata_json")
                  .in_("id", by_type["designer"][:200])
                  .execute().data or [])
        resolved["designer"] = {x["id"]: x for x in d_rows}

    # Assemble final payload
    items: List[Dict[str, Any]] = []
    for r in rows:
        entity = (resolved.get(r["entity_type"]) or {}).get(r["entity_id"])
        items.append({
            "id":          r["id"],
            "entity_type": r["entity_type"],
            "entity_id":   r["entity_id"],
            "source_type": r.get("source_type"),
            "saved_at":    r.get("saved_at"),
            "notes":       r.get("notes"),
            "metadata":    r.get("metadata") or {},
            "entity":      entity,           # may be None if entity was deleted
            "missing":     entity is None,
        })
    return {"items": items, "total": len(items)}
