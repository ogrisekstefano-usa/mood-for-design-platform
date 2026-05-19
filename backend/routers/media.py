"""Media Library — operational asset layer (Phase N).

Turns `media_library` into a first-class searchable archive with:
 • search / filters / tags / collections
 • asset → entity link map (project / moodboard / cms / material / ...)
 • soft versioning (replace_asset preserves old version + audit chain)
 • Material Registry (first-class entity, not a tag)

NOTE: Storage upload itself (signed URL + register) stays in
`routers/storage.py` — this router operates on top of `media_library`
rows that already exist.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from core.tenant_context import require_permission, audit_log
from core.permissions import P_STORAGE_READ, P_STORAGE_WRITE
from database import db

router = APIRouter()


# ── helpers ──────────────────────────────────────────────────────────
def _now():
    return datetime.now(timezone.utc).isoformat()


SIGNED_URL_TTL = 60 * 60 * 6  # 6 hours — long enough for a working session


def _batch_signed_urls(client, rows):
    """Mutate rows in place: add `display_url` = signed URL.

    Groups paths by bucket and asks supabase for a batch of signed URLs.
    Falls back to the stored file_url if the API call fails (public buckets).
    """
    if not rows:
        return rows
    # Group by bucket
    by_bucket = {}
    for r in rows:
        b = r.get("bucket")
        p = r.get("storage_path")
        if not b or not p:
            r["display_url"] = r.get("file_url")
            continue
        by_bucket.setdefault(b, []).append((r, p))

    for bucket, items in by_bucket.items():
        paths = [p for (_r, p) in items]
        try:
            signed_list = client.storage.from_(bucket).create_signed_urls(paths, SIGNED_URL_TTL)
            # supabase-py returns list aligned with input order
            for (row, _p), s in zip(items, signed_list or []):
                row["display_url"] = (s.get("signed_url") or s.get("signedUrl")
                                      or s.get("signedURL") or row.get("file_url"))
        except Exception:
            for row, _p in items:
                row["display_url"] = row.get("file_url")
    return rows



def _slugify(value: str) -> str:
    import re
    s = (value or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or f"item-{uuid.uuid4().hex[:6]}"


# ── Pydantic models ──────────────────────────────────────────────────
class MediaUpdate(BaseModel):
    alt_text: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    dominant_color: Optional[str] = None
    focal_point: Optional[dict] = None
    filters: Optional[dict] = None        # { brightness, contrast, saturation, rotate }
    width: Optional[int] = None
    height: Optional[int] = None


class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    kind: str = "curated"
    cover_asset_id: Optional[str] = None


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_asset_id: Optional[str] = None
    archived_at: Optional[str] = None


class CollectionAttach(BaseModel):
    asset_ids: List[str]
    note: Optional[str] = None


class LinkCreate(BaseModel):
    entity_type: str
    entity_id: Optional[str] = None
    role: Optional[str] = None
    sort_order: int = 0
    metadata: Optional[dict] = None


class ReplaceRequest(BaseModel):
    """Replace an asset with a NEW media_library row (soft versioning).

    The new row id must ALREADY exist (uploaded via storage.signed-upload
    + register_media). This endpoint just wires the version chain and
    migrates links/usage.
    """
    new_asset_id: str
    migrate_links: bool = True
    reason: Optional[str] = None


class MaterialCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    supplier: Optional[str] = None
    supplier_sku: Optional[str] = None
    finish: Optional[str] = None
    thickness: Optional[str] = None
    origin: Optional[str] = None
    description: Optional[str] = None
    technical_notes: Optional[str] = None
    tags: Optional[List[str]] = None
    primary_asset_id: Optional[str] = None
    dominant_color: Optional[str] = None


class MaterialUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    supplier: Optional[str] = None
    supplier_sku: Optional[str] = None
    finish: Optional[str] = None
    thickness: Optional[str] = None
    origin: Optional[str] = None
    description: Optional[str] = None
    technical_notes: Optional[str] = None
    tags: Optional[List[str]] = None
    primary_asset_id: Optional[str] = None
    dominant_color: Optional[str] = None
    status: Optional[str] = None


class MaterialAssetAttach(BaseModel):
    asset_id: str
    role: str = "detail"
    caption: Optional[str] = None
    sort_order: int = 0


# ═══════════════════════════════════════════════════════════════════════
# MEDIA — list, search, detail, update, archive
# ═══════════════════════════════════════════════════════════════════════
@router.get("")
def list_media(
    ctx: dict = Depends(require_permission(P_STORAGE_READ)),
    q: Optional[str] = Query(None, description="Free-text search on file_name + alt_text + description"),
    type: Optional[str] = Query(None, description="image|video|pdf|all"),
    category: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    collection_id: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None, description="Show only assets linked to this kind of entity"),
    entity_id: Optional[str] = Query(None),
    used: Optional[bool] = Query(None, description="true = at least 1 link, false = orphan"),
    include_archived: bool = Query(False),
    include_versions: bool = Query(False, description="Include non-head versions (replaced_by_id != NULL)"),
    sort: str = Query("recent", description="recent|name|size|usage"),
    limit: int = Query(60, le=200),
    offset: int = Query(0, ge=0),
):
    """Search & filter media library."""
    client = db()
    # Use the view so we always get usage_count cheaply.
    qb = client.table("media_with_usage").select("*").eq("tenant_id", ctx["tenant_id"])

    if not include_archived:
        qb = qb.is_("archived_at", "null")
    if not include_versions:
        qb = qb.is_("replaced_by_id", "null")
    if type and type != "all":
        # crude prefix match against mime_type or file_type
        if type == "image":
            qb = qb.like("file_type", "image/%")
        elif type == "video":
            qb = qb.like("file_type", "video/%")
        elif type == "pdf":
            qb = qb.eq("file_type", "application/pdf")
        else:
            qb = qb.like("file_type", f"{type}/%")
    if category:
        qb = qb.eq("category", category)
    if tag:
        # PostgREST cs (contains) on a JSON array
        qb = qb.contains("tags", [tag])

    # Sorting
    if sort == "name":
        qb = qb.order("file_name", desc=False)
    elif sort == "size":
        qb = qb.order("file_size", desc=True)
    elif sort == "usage":
        qb = qb.order("usage_count", desc=True)
    else:
        qb = qb.order("created_at", desc=True)

    r = qb.range(offset, offset + limit - 1).execute()
    rows = r.data or []

    # Filter collection_id / entity_type / used / q in Python (cheap, list is bounded)
    if collection_id:
        ids = {
            row["asset_id"] for row in (
                client.table("media_collection_items")
                .select("asset_id")
                .eq("tenant_id", ctx["tenant_id"])
                .eq("collection_id", collection_id)
                .execute()
                .data or []
            )
        }
        rows = [r for r in rows if r["id"] in ids]
    if entity_type:
        link_q = client.table("media_links").select("asset_id")\
            .eq("tenant_id", ctx["tenant_id"]).eq("entity_type", entity_type)
        if entity_id:
            link_q = link_q.eq("entity_id", entity_id)
        ids = {row["asset_id"] for row in (link_q.execute().data or [])}
        rows = [r for r in rows if r["id"] in ids]
    if used is True:
        rows = [r for r in rows if r.get("usage_count", 0) > 0]
    elif used is False:
        rows = [r for r in rows if r.get("usage_count", 0) == 0]
    if q:
        needle = q.lower()
        rows = [
            r for r in rows
            if needle in (r.get("file_name") or "").lower()
            or needle in (r.get("alt_text") or "").lower()
            or needle in (r.get("description") or "").lower()
        ]

    _batch_signed_urls(client, rows)
    return {"data": rows, "count": len(rows)}


@router.get("/stats")
def media_stats(ctx: dict = Depends(require_permission(P_STORAGE_READ))):
    """Aggregate counts for sidebar chips."""
    client = db()
    tid = ctx["tenant_id"]
    base = client.table("media_library").select(
        "id, file_type, file_size, category, tags, archived_at, replaced_by_id"
    ).eq("tenant_id", tid).execute().data or []

    active = [a for a in base if not a.get("archived_at") and not a.get("replaced_by_id")]
    by_kind = {"image": 0, "video": 0, "pdf": 0, "other": 0}
    categories: dict = {}
    tags: dict = {}
    total_bytes = 0
    for a in active:
        total_bytes += int(a.get("file_size") or 0)
        ft = (a.get("file_type") or "").lower()
        if ft.startswith("image/"):
            by_kind["image"] += 1
        elif ft.startswith("video/"):
            by_kind["video"] += 1
        elif ft == "application/pdf":
            by_kind["pdf"] += 1
        else:
            by_kind["other"] += 1
        cat = a.get("category")
        if cat:
            categories[cat] = categories.get(cat, 0) + 1
        for t in (a.get("tags") or []):
            if not t:
                continue
            tags[t] = tags.get(t, 0) + 1

    # Orphans
    used_ids = {row["asset_id"] for row in (
        client.table("media_links").select("asset_id").eq("tenant_id", tid).execute().data or []
    )}
    unused = sum(1 for a in active if a["id"] not in used_ids)

    return {
        "total": len(active),
        "by_kind": by_kind,
        "total_bytes": total_bytes,
        "unused": unused,
        "categories": categories,
        "tags": tags,
        "collections": (client.table("media_collections").select("id", count="exact")
                        .eq("tenant_id", tid).is_("archived_at", "null").execute().count or 0),
        "materials": (client.table("material_registry").select("id", count="exact")
                      .eq("tenant_id", tid).eq("status", "active").execute().count or 0),
    }


@router.get("/{asset_id}")
def get_media(asset_id: str, ctx: dict = Depends(require_permission(P_STORAGE_READ))):
    """Detail with links/usage map + version history."""
    client = db()
    r = client.table("media_library").select("*").eq("id", asset_id)\
        .eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Asset not found")
    asset = r.data[0]

    # Links / usage
    links = client.table("media_links").select("*").eq("asset_id", asset_id)\
        .eq("tenant_id", ctx["tenant_id"]).order("created_at").execute().data or []

    # Hydrate entity titles for the Usage tab (presentation-layer enrichment).
    # Group links by entity_type, fetch titles in one batch per type, attach.
    if links:
        by_type = {}
        for l in links:
            if l.get("entity_id"):
                by_type.setdefault(l["entity_type"], set()).add(l["entity_id"])
        # Map entity_type → (table, title_col)
        title_map = {
            "project":       ("projects",          "title"),
            "moodboard":     ("moodboards",        "title"),
            "proposal":      ("proposals",         "title"),
            "lead":          ("leads",             "first_name"),
            "magazine_article": ("magazine_articles", "title"),
            "cms_page":      ("cms_pages",         "title"),
            "material":      ("material_registry", "name"),
            "storefront_page": ("cms_pages",       "title"),
        }
        titles_by_type = {}
        for etype, ids in by_type.items():
            tbl, col = title_map.get(etype, (None, None))
            if not tbl or not ids:
                continue
            try:
                rows = (client.table(tbl).select(f"id, {col}")
                        .in_("id", list(ids)).eq("tenant_id", ctx["tenant_id"])
                        .execute().data or [])
                titles_by_type[etype] = {r["id"]: r.get(col) for r in rows}
            except Exception:
                titles_by_type[etype] = {}
        for l in links:
            t = titles_by_type.get(l["entity_type"], {}).get(l.get("entity_id"))
            l["entity_title"] = t

    # Collections membership
    cols = client.table("media_collection_items").select("collection_id, sort_order, note")\
        .eq("asset_id", asset_id).eq("tenant_id", ctx["tenant_id"]).execute().data or []

    # Version chain — walk back via replaces_id and forward via replaced_by_id
    versions = []
    cur = asset
    # Walk to the head
    while cur.get("replaced_by_id"):
        nxt = client.table("media_library").select("*").eq("id", cur["replaced_by_id"])\
            .eq("tenant_id", ctx["tenant_id"]).limit(1).execute().data
        if not nxt:
            break
        cur = nxt[0]
    head = cur
    # Walk back from head to the very first
    chain = [head]
    while chain[-1].get("replaces_id"):
        prev = client.table("media_library").select("*").eq("id", chain[-1]["replaces_id"])\
            .eq("tenant_id", ctx["tenant_id"]).limit(1).execute().data
        if not prev:
            break
        chain.append(prev[0])
    versions = chain  # head → oldest

    # Material attachments
    mat_links = client.table("material_assets").select("material_id, role, caption")\
        .eq("asset_id", asset_id).eq("tenant_id", ctx["tenant_id"]).execute().data or []

    # Inject display_url (signed) into asset + every version
    _batch_signed_urls(client, [asset, *versions])

    return {
        "asset": asset,
        "links": links,
        "collections": cols,
        "versions": versions,
        "material_attachments": mat_links,
        "is_head": not asset.get("replaced_by_id"),
    }


@router.patch("/{asset_id}")
def update_media(asset_id: str, body: MediaUpdate,
                 ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    existing = client.table("media_library").select("id").eq("id", asset_id)\
        .eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not existing.data:
        raise HTTPException(404, "Asset not found")
    patch = {k: v for k, v in body.dict(exclude_none=True).items()}
    if not patch:
        return {"ok": True, "no_op": True}
    r = client.table("media_library").update(patch).eq("id", asset_id)\
        .eq("tenant_id", ctx["tenant_id"]).execute()
    audit_log(ctx["tenant_id"], ctx.get("profile_id"), "media.update", "media", asset_id, patch)
    return r.data[0] if r.data else {"id": asset_id, **patch}


@router.delete("/{asset_id}")
def archive_media(asset_id: str, ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    """Soft archive — keeps the storage file + links + version chain."""
    client = db()
    existing = client.table("media_library").select("id").eq("id", asset_id)\
        .eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not existing.data:
        raise HTTPException(404, "Asset not found")
    client.table("media_library").update({"archived_at": _now()})\
        .eq("id", asset_id).eq("tenant_id", ctx["tenant_id"]).execute()
    audit_log(ctx["tenant_id"], ctx.get("profile_id"), "media.archive", "media", asset_id)
    return {"ok": True}


@router.post("/{asset_id}/restore")
def restore_media(asset_id: str, ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    existing = client.table("media_library").select("id, archived_at").eq("id", asset_id)\
        .eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not existing.data:
        raise HTTPException(404, "Asset not found")
    client.table("media_library").update({"archived_at": None})\
        .eq("id", asset_id).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════
# REPLACE — soft versioning
# ═══════════════════════════════════════════════════════════════════════
@router.post("/{asset_id}/replace")
def replace_asset(asset_id: str, body: ReplaceRequest,
                  ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    """Replace `asset_id` with `body.new_asset_id` keeping a version chain.

    Effect:
      old.replaced_by_id = new.id
      old.archived_at    = NOW()
      new.replaces_id    = old.id
      new.version_number = old.version_number + 1
      every media_links row pointing at old → moved to new (if migrate_links)
    """
    client = db()
    tid = ctx["tenant_id"]

    old_r = client.table("media_library").select("*").eq("id", asset_id)\
        .eq("tenant_id", tid).limit(1).execute()
    if not old_r.data:
        raise HTTPException(404, "Source asset not found")
    new_r = client.table("media_library").select("*").eq("id", body.new_asset_id)\
        .eq("tenant_id", tid).limit(1).execute()
    if not new_r.data:
        raise HTTPException(404, "Replacement asset not found")
    if asset_id == body.new_asset_id:
        raise HTTPException(400, "Replacement must be a different asset")
    old = old_r.data[0]
    new = new_r.data[0]
    if old.get("replaced_by_id"):
        raise HTTPException(409, "Source asset is already replaced — chain head is elsewhere")

    new_version = int(old.get("version_number") or 1) + 1
    now = _now()

    client.table("media_library").update({
        "replaced_by_id": new["id"],
        "archived_at": now,
    }).eq("id", asset_id).execute()

    client.table("media_library").update({
        "replaces_id": asset_id,
        "version_number": new_version,
        "archived_at": None,
    }).eq("id", new["id"]).execute()

    moved = 0
    if body.migrate_links:
        # Move every media_links row from old → new
        old_links = client.table("media_links").select("*").eq("asset_id", asset_id)\
            .eq("tenant_id", tid).execute().data or []
        for link in old_links:
            # Avoid UNIQUE violation: skip if (new_asset, entity_type, entity_id, role) exists
            dup = client.table("media_links").select("id")\
                .eq("asset_id", new["id"]).eq("entity_type", link["entity_type"])\
                .eq("tenant_id", tid)
            if link.get("entity_id"):
                dup = dup.eq("entity_id", link["entity_id"])
            else:
                dup = dup.is_("entity_id", "null")
            if link.get("role"):
                dup = dup.eq("role", link["role"])
            else:
                dup = dup.is_("role", "null")
            if dup.limit(1).execute().data:
                # duplicate already there → remove old reference
                client.table("media_links").delete().eq("id", link["id"]).execute()
            else:
                client.table("media_links").update({"asset_id": new["id"]})\
                    .eq("id", link["id"]).execute()
            moved += 1

    audit_log(tid, ctx.get("profile_id"), "media.replace", "media", asset_id, {
        "replaced_by": new["id"],
        "moved_links": moved,
        "reason": body.reason,
    })

    return {"ok": True, "old_asset_id": asset_id, "new_asset_id": new["id"],
            "new_version_number": new_version, "moved_links": moved}


# ═══════════════════════════════════════════════════════════════════════
# COLLECTIONS
# ═══════════════════════════════════════════════════════════════════════
@router.get("/collections/list")
def list_collections(ctx: dict = Depends(require_permission(P_STORAGE_READ)),
                     include_archived: bool = Query(False)):
    client = db()
    qb = client.table("media_collections").select("*").eq("tenant_id", ctx["tenant_id"])
    if not include_archived:
        qb = qb.is_("archived_at", "null")
    rows = qb.order("created_at", desc=True).execute().data or []
    # Attach item counts
    if rows:
        ids = [c["id"] for c in rows]
        counts = {}
        for cid in ids:
            counts[cid] = (
                client.table("media_collection_items").select("id", count="exact")
                .eq("collection_id", cid).eq("tenant_id", ctx["tenant_id"]).execute().count or 0
            )
        for c in rows:
            c["item_count"] = counts.get(c["id"], 0)
    return {"data": rows}


@router.post("/collections", status_code=201)
def create_collection(body: CollectionCreate,
                      ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    slug_base = _slugify(body.name)
    slug = slug_base
    n = 1
    while client.table("media_collections").select("id").eq("tenant_id", ctx["tenant_id"])\
            .eq("slug", slug).limit(1).execute().data:
        n += 1
        slug = f"{slug_base}-{n}"
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "slug": slug,
        "name": body.name,
        "description": body.description,
        "kind": body.kind,
        "cover_asset_id": body.cover_asset_id,
        "created_by": ctx.get("profile_id"),
        "created_at": _now(),
        "updated_at": _now(),
    }
    r = client.table("media_collections").insert(row).execute()
    return r.data[0] if r.data else row


@router.get("/collections/{cid}")
def get_collection(cid: str, ctx: dict = Depends(require_permission(P_STORAGE_READ))):
    client = db()
    r = client.table("media_collections").select("*").eq("id", cid)\
        .eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Collection not found")
    items = client.table("media_collection_items").select("*").eq("collection_id", cid)\
        .eq("tenant_id", ctx["tenant_id"]).order("sort_order").execute().data or []
    # Hydrate items
    asset_ids = [it["asset_id"] for it in items]
    assets_by_id = {}
    if asset_ids:
        rows = client.table("media_library").select("*")\
            .in_("id", asset_ids).eq("tenant_id", ctx["tenant_id"]).execute().data or []
        _batch_signed_urls(client, rows)
        assets_by_id = {a["id"]: a for a in rows}
    for it in items:
        it["asset"] = assets_by_id.get(it["asset_id"])
    return {"collection": r.data[0], "items": items}


@router.patch("/collections/{cid}")
def update_collection(cid: str, body: CollectionUpdate,
                      ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    existing = client.table("media_collections").select("id").eq("id", cid)\
        .eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not existing.data:
        raise HTTPException(404, "Collection not found")
    patch = {k: v for k, v in body.dict(exclude_none=True).items()}
    patch["updated_at"] = _now()
    r = client.table("media_collections").update(patch).eq("id", cid)\
        .eq("tenant_id", ctx["tenant_id"]).execute()
    return r.data[0] if r.data else {"id": cid, **patch}


@router.delete("/collections/{cid}")
def archive_collection(cid: str, ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    client.table("media_collections").update({"archived_at": _now()})\
        .eq("id", cid).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True}


@router.post("/collections/{cid}/attach")
def attach_to_collection(cid: str, body: CollectionAttach,
                         ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    existing = client.table("media_collections").select("id").eq("id", cid)\
        .eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not existing.data:
        raise HTTPException(404, "Collection not found")
    inserted = []
    for aid in body.asset_ids:
        # Skip dupes
        dup = client.table("media_collection_items").select("id")\
            .eq("collection_id", cid).eq("asset_id", aid).limit(1).execute()
        if dup.data:
            continue
        row = {
            "id": str(uuid.uuid4()),
            "tenant_id": ctx["tenant_id"],
            "collection_id": cid,
            "asset_id": aid,
            "sort_order": 0,
            "note": body.note,
            "added_by": ctx.get("profile_id"),
            "created_at": _now(),
        }
        client.table("media_collection_items").insert(row).execute()
        inserted.append(aid)
    return {"ok": True, "added": inserted, "skipped": len(body.asset_ids) - len(inserted)}


@router.delete("/collections/{cid}/items/{asset_id}")
def detach_from_collection(cid: str, asset_id: str,
                           ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    client.table("media_collection_items").delete()\
        .eq("collection_id", cid).eq("asset_id", asset_id)\
        .eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════
# LINKS — asset usage map
# ═══════════════════════════════════════════════════════════════════════
@router.post("/{asset_id}/links", status_code=201)
def create_link(asset_id: str, body: LinkCreate,
                ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    # Sanity: asset exists
    if not client.table("media_library").select("id").eq("id", asset_id)\
            .eq("tenant_id", ctx["tenant_id"]).limit(1).execute().data:
        raise HTTPException(404, "Asset not found")
    # Avoid UNIQUE conflict
    dup_q = client.table("media_links").select("id")\
        .eq("asset_id", asset_id).eq("tenant_id", ctx["tenant_id"])\
        .eq("entity_type", body.entity_type)
    if body.entity_id:
        dup_q = dup_q.eq("entity_id", body.entity_id)
    else:
        dup_q = dup_q.is_("entity_id", "null")
    if body.role:
        dup_q = dup_q.eq("role", body.role)
    else:
        dup_q = dup_q.is_("role", "null")
    if dup_q.limit(1).execute().data:
        raise HTTPException(409, "Link already exists")

    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "asset_id": asset_id,
        "entity_type": body.entity_type,
        "entity_id": body.entity_id,
        "role": body.role,
        "sort_order": body.sort_order,
        "metadata_json": body.metadata or {},
        "created_by": ctx.get("profile_id"),
        "created_at": _now(),
    }
    r = client.table("media_links").insert(row).execute()
    return r.data[0] if r.data else row


@router.delete("/links/{link_id}")
def delete_link(link_id: str, ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    client.table("media_links").delete().eq("id", link_id)\
        .eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════
# MATERIAL REGISTRY — first-class entity
# ═══════════════════════════════════════════════════════════════════════
@router.get("/materials/list")
def list_materials(ctx: dict = Depends(require_permission(P_STORAGE_READ)),
                   q: Optional[str] = None,
                   category: Optional[str] = None,
                   status: str = Query("active"),
                   limit: int = Query(60, le=200)):
    client = db()
    qb = client.table("material_registry").select("*").eq("tenant_id", ctx["tenant_id"])
    if status and status != "all":
        qb = qb.eq("status", status)
    if category:
        qb = qb.eq("category", category)
    rows = qb.order("name", desc=False).limit(limit).execute().data or []
    if q:
        n = q.lower()
        rows = [
            m for m in rows
            if n in (m.get("name") or "").lower()
            or n in (m.get("supplier") or "").lower()
            or n in (m.get("finish") or "").lower()
            or n in (m.get("subcategory") or "").lower()
        ]

    # Hydrate primary_asset
    aids = [m["primary_asset_id"] for m in rows if m.get("primary_asset_id")]
    by_id = {}
    if aids:
        ar = client.table("media_library").select("id, file_url, file_name, alt_text, width, height, bucket, storage_path")\
            .in_("id", aids).eq("tenant_id", ctx["tenant_id"]).execute().data or []
        _batch_signed_urls(client, ar)
        by_id = {a["id"]: a for a in ar}
    for m in rows:
        m["primary_asset"] = by_id.get(m.get("primary_asset_id"))
        # Attachment count
        m["asset_count"] = (
            client.table("material_assets").select("id", count="exact")
            .eq("material_id", m["id"]).eq("tenant_id", ctx["tenant_id"]).execute().count or 0
        )

    return {"data": rows}


@router.post("/materials", status_code=201)
def create_material(body: MaterialCreate,
                    ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    slug_base = _slugify(body.slug or body.name)
    slug = slug_base
    n = 1
    while client.table("material_registry").select("id").eq("tenant_id", ctx["tenant_id"])\
            .eq("slug", slug).limit(1).execute().data:
        n += 1
        slug = f"{slug_base}-{n}"
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "slug": slug,
        "name": body.name,
        "category": body.category,
        "subcategory": body.subcategory,
        "supplier": body.supplier,
        "supplier_sku": body.supplier_sku,
        "finish": body.finish,
        "thickness": body.thickness,
        "origin": body.origin,
        "description": body.description,
        "technical_notes": body.technical_notes,
        "tags": body.tags or [],
        "primary_asset_id": body.primary_asset_id,
        "dominant_color": body.dominant_color,
        "status": "active",
        "created_by": ctx.get("profile_id"),
        "created_at": _now(),
        "updated_at": _now(),
    }
    r = client.table("material_registry").insert(row).execute()
    return r.data[0] if r.data else row


@router.get("/materials/by-slug/{slug}")
def get_material_by_slug(slug: str, ctx: dict = Depends(require_permission(P_STORAGE_READ))):
    client = db()
    r = client.table("material_registry").select("*").eq("tenant_id", ctx["tenant_id"])\
        .eq("slug", slug).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Material not found")
    return _hydrate_material(client, r.data[0], ctx)


@router.get("/materials/{mid}")
def get_material(mid: str, ctx: dict = Depends(require_permission(P_STORAGE_READ))):
    client = db()
    r = client.table("material_registry").select("*").eq("id", mid)\
        .eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Material not found")
    return _hydrate_material(client, r.data[0], ctx)


def _hydrate_material(client, mat, ctx):
    tid = ctx["tenant_id"]
    mid = mat["id"]
    # Asset attachments by role
    atts = client.table("material_assets").select("*").eq("material_id", mid)\
        .eq("tenant_id", tid).order("sort_order").execute().data or []
    asset_ids = [a["asset_id"] for a in atts]
    if mat.get("primary_asset_id"):
        asset_ids.append(mat["primary_asset_id"])
    assets_by_id = {}
    if asset_ids:
        rows = client.table("media_library").select("*").in_("id", asset_ids)\
            .eq("tenant_id", tid).execute().data or []
        _batch_signed_urls(client, rows)
        assets_by_id = {a["id"]: a for a in rows}
    for a in atts:
        a["asset"] = assets_by_id.get(a["asset_id"])

    # Linked projects / moodboards / cms — count via media_links of attached assets
    linked = {}
    if asset_ids:
        link_rows = client.table("media_links").select("entity_type, entity_id")\
            .in_("asset_id", asset_ids).eq("tenant_id", tid).execute().data or []
        for lr in link_rows:
            et = lr["entity_type"]
            linked.setdefault(et, set()).add(lr.get("entity_id"))
        linked = {k: list(v) for k, v in linked.items()}

    return {
        "material": {**mat, "primary_asset": assets_by_id.get(mat.get("primary_asset_id"))},
        "attachments": atts,
        "linked_entities": linked,
    }


@router.patch("/materials/{mid}")
def update_material(mid: str, body: MaterialUpdate,
                    ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    if not client.table("material_registry").select("id").eq("id", mid)\
            .eq("tenant_id", ctx["tenant_id"]).limit(1).execute().data:
        raise HTTPException(404, "Material not found")
    patch = {k: v for k, v in body.dict(exclude_none=True).items()}
    patch["updated_at"] = _now()
    if body.status == "archived":
        patch["archived_at"] = _now()
    r = client.table("material_registry").update(patch).eq("id", mid)\
        .eq("tenant_id", ctx["tenant_id"]).execute()
    return r.data[0] if r.data else {"id": mid, **patch}


@router.delete("/materials/{mid}")
def archive_material(mid: str, ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    client.table("material_registry").update({"status": "archived", "archived_at": _now()})\
        .eq("id", mid).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True}


@router.post("/materials/{mid}/attach-asset", status_code=201)
def attach_material_asset(mid: str, body: MaterialAssetAttach,
                          ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    # Validate
    if not client.table("material_registry").select("id").eq("id", mid)\
            .eq("tenant_id", ctx["tenant_id"]).limit(1).execute().data:
        raise HTTPException(404, "Material not found")
    if not client.table("media_library").select("id").eq("id", body.asset_id)\
            .eq("tenant_id", ctx["tenant_id"]).limit(1).execute().data:
        raise HTTPException(404, "Asset not found")
    # Dedupe by (material, asset, role)
    dup = client.table("material_assets").select("id")\
        .eq("material_id", mid).eq("asset_id", body.asset_id)\
        .eq("role", body.role).eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if dup.data:
        return dup.data[0]
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "material_id": mid,
        "asset_id": body.asset_id,
        "role": body.role,
        "sort_order": body.sort_order,
        "caption": body.caption,
        "created_by": ctx.get("profile_id"),
        "created_at": _now(),
    }
    client.table("material_assets").insert(row).execute()
    # Also register a media_links row so the asset's usage map shows the material
    try:
        client.table("media_links").insert({
            "id": str(uuid.uuid4()),
            "tenant_id": ctx["tenant_id"],
            "asset_id": body.asset_id,
            "entity_type": "material",
            "entity_id": mid,
            "role": body.role,
            "sort_order": body.sort_order,
            "metadata_json": {},
            "created_by": ctx.get("profile_id"),
            "created_at": _now(),
        }).execute()
    except Exception:
        # Unique violation if it was already linked — fine.
        pass
    return row


@router.delete("/materials/{mid}/attachments/{att_id}")
def detach_material_asset(mid: str, att_id: str,
                          ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    # Find first
    r = client.table("material_assets").select("asset_id, role").eq("id", att_id)\
        .eq("material_id", mid).eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Attachment not found")
    aid = r.data[0]["asset_id"]
    role = r.data[0].get("role")
    client.table("material_assets").delete().eq("id", att_id)\
        .eq("tenant_id", ctx["tenant_id"]).execute()
    # Remove the mirror media_links row
    lq = client.table("media_links").delete().eq("tenant_id", ctx["tenant_id"])\
        .eq("asset_id", aid).eq("entity_type", "material").eq("entity_id", mid)
    if role:
        lq = lq.eq("role", role)
    lq.execute()
    return {"ok": True}
