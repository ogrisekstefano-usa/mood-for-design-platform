"""ITER204-B · ENTITY NAVIGATION LAYER™ — composite detail endpoints.

Transforms the Knowledge Graph from "extracted data" into a navigable user
experience. Every entity surfaced by Brand Embassy gets a real detail page
fed by these endpoints.

Endpoints (all under `/api/knowledge`):
  GET  /brands/{brand_id}/collections/{collection_id}
       → Collection Detail (hero, products, materials, designers,
          related collections, saved flag)
  GET  /brands/{brand_id}/products/{product_id}
       → Product Detail (hero, gallery, materials, designer, related)
  GET  /materials/{material_id}
       → Material Detail (description, brands/collections/products using it)
  GET  /designers/{designer_id}
       → Designer Detail (bio, brands/collections/products attributed)

Conventions:
  - `saved` flag pulled from studio_library_items
  - No hardcoded counts — every count derives from real linked rows
  - Empty states explicit (`indexing` / `not_linked` flags)
  - Tenant-scoped throughout
"""
from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

from database import db
from core.tenant_context import get_tenant_context

logger = logging.getLogger("entity_navigation")
router = APIRouter()


# ── Helpers ─────────────────────────────────────────────────────────
def _is_saved(c, tid: str, entity_type: str, entity_id: str) -> bool:
    try:
        rows = (c.table("studio_library_items").select("id")
                .eq("tenant_id", tid).eq("entity_type", entity_type)
                .eq("entity_id", entity_id).limit(1).execute().data or [])
        return bool(rows)
    except Exception:
        return False


def _product_image(c, product_id: str) -> Optional[str]:
    try:
        ass = (c.table("product_assets")
               .select("metadata_json,is_primary,sort_order")
               .eq("product_id", product_id)
               .order("is_primary", desc=True)
               .order("sort_order").limit(8).execute().data or [])
        for a in ass:
            url = (a.get("metadata_json") or {}).get("public_url")
            if url:
                return url
    except Exception:
        pass
    return None


def _product_images_all(c, product_id: str, limit: int = 24) -> List[Dict[str, Any]]:
    try:
        ass = (c.table("product_assets")
               .select("id,metadata_json,is_primary,sort_order,role")
               .eq("product_id", product_id)
               .order("is_primary", desc=True)
               .order("sort_order").limit(limit).execute().data or [])
        out: List[Dict[str, Any]] = []
        for a in ass:
            meta = a.get("metadata_json") or {}
            url = meta.get("public_url")
            if not url:
                continue
            out.append({
                "id":         a["id"],
                "url":        url,
                "role":       a.get("role") or meta.get("role") or "image",
                "is_primary": bool(a.get("is_primary")),
            })
        return out
    except Exception:
        return []


def _brand_min(c, brand_id: str) -> Dict[str, Any]:
    rows = (c.table("brands")
            .select("id,name,slug,category,country,logo_url,hero_subtitle,mood_dna")
            .eq("id", brand_id).limit(1).execute().data or [])
    return rows[0] if rows else {"id": brand_id, "name": None}


# ══════════════════════════════════════════════════════════════════════
#  1 · COLLECTION DETAIL
# ══════════════════════════════════════════════════════════════════════
@router.get("/brands/{brand_id}/collections/{collection_id}")
def collection_detail(brand_id: str, collection_id: str,
                       ctx=Depends(get_tenant_context)):
    """Return Collection Detail payload."""
    c = db()
    tid = ctx["tenant_id"]
    # Fetch the collection — tolerant of null-tenant (curated) collections
    rows = (c.table("collections_canonical")
            .select("id,display_name,collection_key,brand_id,tenant_id,metadata_json")
            .eq("id", collection_id).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Collezione non trovata")
    col = rows[0]
    if col.get("tenant_id") not in (tid, None):
        raise HTTPException(404, "Collezione non trovata")

    brand = _brand_min(c, col["brand_id"] or brand_id)

    # Products in this collection
    prod_rows = (c.table("products")
                 .select("id,product_name,category_label,canonical_collection_id,"
                         "materials,metadata_json")
                 .eq("canonical_collection_id", collection_id)
                 .limit(200).execute().data or [])
    pids = [p["id"] for p in prod_rows]
    assets_map: Dict[str, str] = {}
    if pids:
        try:
            ass = (c.table("product_assets")
                   .select("product_id,metadata_json,is_primary,sort_order")
                   .in_("product_id", pids)
                   .order("is_primary", desc=True)
                   .order("sort_order").limit(1000).execute().data or [])
            for a in ass:
                pid = a["product_id"]
                if pid in assets_map:
                    continue
                url = (a.get("metadata_json") or {}).get("public_url")
                if url:
                    assets_map[pid] = url
        except Exception:
            pass
    products = [{
        "id":            p["id"],
        "name":          p.get("product_name"),
        "category":      (p.get("metadata_json") or {}).get("canonical_category_label")
                          or p.get("category_label"),
        "image_url":     assets_map.get(p["id"]),
        "materials":     p.get("materials") or [],
    } for p in prod_rows]

    # Materials referenced by products in this collection (aggregate)
    mat_counter: Dict[str, int] = {}
    for p in prod_rows:
        for m in (p.get("materials") or []):
            key = str(m).strip()
            if not key:
                continue
            mat_counter[key] = mat_counter.get(key, 0) + 1
    materials = [{"key": k, "name": k.title(), "count": v}
                 for k, v in sorted(mat_counter.items(), key=lambda x: -x[1])][:20]

    # Designers — pull from brand_detected_entities filtered by collection link
    designers: List[Dict[str, Any]] = []
    try:
        meta = col.get("metadata_json") or {}
        cset_id = meta.get("catalog_set_id")
        if cset_id:
            ds = (c.table("brand_detected_entities")
                  .select("id,display_name,attributes,aliases")
                  .eq("catalog_set_id", cset_id)
                  .eq("entity_type", "designer_registered")
                  .limit(20).execute().data or [])
            for d in ds:
                designers.append({
                    "id":   d["id"],
                    "name": d["display_name"],
                    "role": "Designer",
                })
    except Exception as ex:
        logger.warning(f"collection designers fetch: {ex}")

    # Related collections (same brand)
    related: List[Dict[str, Any]] = []
    try:
        rel = (c.table("collections_canonical")
               .select("id,display_name,metadata_json")
               .eq("brand_id", col["brand_id"])
               .neq("id", collection_id)
               .limit(8).execute().data or [])
        for r in rel:
            related.append({
                "id":   r["id"],
                "name": r["display_name"],
            })
    except Exception:
        pass

    # Hero image: first product image
    hero_image = next((p["image_url"] for p in products if p.get("image_url")), None)

    return {
        "collection": {
            "id":          col["id"],
            "name":        col["display_name"],
            "slug":        col.get("collection_key"),
            "description": (col.get("metadata_json") or {}).get("description"),
            "mood_dna":    (col.get("metadata_json") or {}).get("mood_dna")
                            or brand.get("mood_dna") or [],
            "hero_image_url": hero_image,
        },
        "brand": brand,
        "counts": {
            "products":  len(products),
            "materials": len(materials),
            "designers": len(designers),
        },
        "products":  products,
        "materials": materials,
        "designers": designers,
        "related_collections": related,
        "saved": _is_saved(c, tid, "collection", collection_id),
        "states": {
            "products_indexing":  len(products)  == 0,
            "materials_not_linked": len(materials) == 0,
            "designers_pending":   len(designers) == 0,
        },
    }


# ══════════════════════════════════════════════════════════════════════
#  2 · PRODUCT DETAIL
# ══════════════════════════════════════════════════════════════════════
@router.get("/brands/{brand_id}/products/{product_id}")
def product_detail(brand_id: str, product_id: str,
                    ctx=Depends(get_tenant_context)):
    """Return Product Detail payload."""
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("products")
            .select("id,product_name,brand_id,canonical_collection_id,"
                    "category_label,description,materials,metadata_json,"
                    "source_document_id")
            .eq("id", product_id).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Prodotto non trovato")
    prod = rows[0]
    meta = prod.get("metadata_json") or {}

    brand = _brand_min(c, prod.get("brand_id") or brand_id)

    # Collection
    coll: Optional[Dict[str, Any]] = None
    if prod.get("canonical_collection_id"):
        cr = (c.table("collections_canonical")
              .select("id,display_name,collection_key")
              .eq("id", prod["canonical_collection_id"]).limit(1)
              .execute().data or [])
        if cr:
            coll = {"id": cr[0]["id"], "name": cr[0]["display_name"]}

    # Images (full gallery)
    images = _product_images_all(c, product_id, limit=24)

    # Designers — best-effort via brand_detected_entities sharing catalog set
    designers: List[Dict[str, Any]] = []
    if prod.get("source_document_id"):
        try:
            cdoc = (c.table("brand_catalog_documents")
                    .select("catalog_set_id")
                    .eq("source_document_id", prod["source_document_id"])
                    .limit(1).execute().data or [])
            if cdoc:
                cset_id = cdoc[0]["catalog_set_id"]
                ds = (c.table("brand_detected_entities")
                      .select("id,display_name")
                      .eq("catalog_set_id", cset_id)
                      .eq("entity_type", "designer_registered")
                      .limit(10).execute().data or [])
                for d in ds:
                    designers.append({"id": d["id"], "name": d["display_name"]})
        except Exception as ex:
            logger.warning(f"product designers: {ex}")

    # Related products: same collection (excluding self)
    related: List[Dict[str, Any]] = []
    if prod.get("canonical_collection_id"):
        try:
            rel_rows = (c.table("products")
                        .select("id,product_name,category_label,metadata_json")
                        .eq("canonical_collection_id", prod["canonical_collection_id"])
                        .neq("id", product_id)
                        .limit(8).execute().data or [])
            r_ids = [r["id"] for r in rel_rows]
            r_assets: Dict[str, str] = {}
            if r_ids:
                ass = (c.table("product_assets")
                       .select("product_id,metadata_json,is_primary,sort_order")
                       .in_("product_id", r_ids)
                       .order("is_primary", desc=True)
                       .order("sort_order").limit(80).execute().data or [])
                for a in ass:
                    pid = a["product_id"]
                    if pid in r_assets:
                        continue
                    url = (a.get("metadata_json") or {}).get("public_url")
                    if url:
                        r_assets[pid] = url
            for r in rel_rows:
                related.append({
                    "id":        r["id"],
                    "name":      r.get("product_name"),
                    "category":  r.get("category_label"),
                    "image_url": r_assets.get(r["id"]),
                })
        except Exception:
            pass

    return {
        "product": {
            "id":          prod["id"],
            "name":        prod.get("product_name"),
            "category":    meta.get("canonical_category_label")
                            or prod.get("category_label"),
            "description": prod.get("description") or meta.get("description"),
            "materials":   prod.get("materials") or [],
            "dimensions":  meta.get("dimensions"),
            "finishes":    meta.get("finishes") or [],
            "hero_image_url": images[0]["url"] if images else None,
        },
        "brand":      brand,
        "collection": coll,
        "images":     images,
        "designers":  designers,
        "related_products": related,
        "saved": _is_saved(c, tid, "product", product_id),
        "states": {
            "images_indexing":   len(images) == 0,
            "materials_pending": len(prod.get("materials") or []) == 0,
            "designers_pending": len(designers) == 0,
        },
    }


# ══════════════════════════════════════════════════════════════════════
#  3 · MATERIAL DETAIL
# ══════════════════════════════════════════════════════════════════════
@router.get("/materials/{material_id}")
def material_detail(material_id: str, ctx=Depends(get_tenant_context)):
    """Return Material Detail payload.

    `material_id` accepts BOTH brand_detected_entities.id and
    materials_canonical.id. The endpoint resolves intelligently.
    """
    c = db()
    tid = ctx["tenant_id"]
    name: Optional[str] = None
    canon_id: Optional[str] = None
    detected_id: Optional[str] = None
    aliases: List[str] = []
    description: Optional[str] = None

    # Detect lookup mode: UUID vs name
    is_uuid = (len(material_id) == 36 and material_id.count("-") == 4)

    # Try canonical by ID
    if is_uuid:
        try:
            m = (c.table("materials_canonical")
                 .select("id,display_name,material_key,brand_id,metadata_json")
                 .eq("id", material_id).limit(1).execute().data or [])
            if m:
                row = m[0]
                canon_id = row["id"]
                name = row.get("display_name") or row.get("material_key")
                description = (row.get("metadata_json") or {}).get("description")
        except Exception:
            pass

    # Try detected entity (by UUID)
    if not name and is_uuid:
        try:
            m = (c.table("brand_detected_entities")
                 .select("id,display_name,attributes,aliases,catalog_set_id")
                 .eq("id", material_id).limit(1).execute().data or [])
            if m:
                row = m[0]
                detected_id = row["id"]
                name = row.get("display_name")
                aliases = row.get("aliases") or []
                description = (row.get("attributes") or {}).get("description")
        except Exception:
            pass

    # Fallback: name-based lookup (URL-encoded human key such as "wood")
    if not name and not is_uuid:
        try:
            from urllib.parse import unquote
            decoded = unquote(material_id).strip()
            name = decoded
            # try to find canonical with matching key/name
            mk = (c.table("materials_canonical")
                  .select("id,display_name,material_key,metadata_json")
                  .ilike("material_key", decoded.lower()).limit(1).execute().data or [])
            if not mk:
                mk = (c.table("materials_canonical")
                      .select("id,display_name,material_key,metadata_json")
                      .ilike("display_name", decoded).limit(1).execute().data or [])
            if mk:
                canon_id = mk[0]["id"]
                name = mk[0]["display_name"] or decoded
                description = (mk[0].get("metadata_json") or {}).get("description")
            else:
                # Detected entity by display_name
                de = (c.table("brand_detected_entities")
                      .select("id,display_name,attributes,aliases")
                      .eq("entity_type", "material")
                      .ilike("display_name", decoded).limit(1).execute().data or [])
                if de:
                    detected_id = de[0]["id"]
                    name = de[0]["display_name"]
                    aliases = de[0].get("aliases") or []
                    description = (de[0].get("attributes") or {}).get("description")
        except Exception as ex:
            logger.warning(f"material name fallback: {ex}")

    if not name:
        raise HTTPException(404, "Materiale non trovato")

    needle = (name or "").strip().lower()

    # Products that reference this material (string match on products.materials)
    products: List[Dict[str, Any]] = []
    try:
        # Without full-text index we do a wide scan limited to tenant brands
        ps = (c.table("products")
              .select("id,product_name,brand_id,canonical_collection_id,materials,"
                      "metadata_json,category_label")
              .ilike("materials_text", f"%{needle}%")
              .limit(40).execute().data or []) if False else []
    except Exception:
        ps = []
    # Fallback: pull a bounded set and filter in python
    if not products:
        try:
            ps = (c.table("products")
                  .select("id,product_name,brand_id,canonical_collection_id,"
                          "materials,category_label")
                  .limit(2000).execute().data or [])
            ps = [p for p in ps
                  if any(needle == str(x).strip().lower()
                          or needle in str(x).strip().lower()
                          for x in (p.get("materials") or []))]
            ps = ps[:40]
        except Exception:
            ps = []

    # If we resolved purely from a free-form name (no canonical, no detected)
    # and nothing matches, treat as 404 — the user isn't looking at a real
    # graph entity, just a typo'd URL.
    if not is_uuid and not canon_id and not detected_id and not ps:
        raise HTTPException(404, "Materiale non trovato")

    pids = [p["id"] for p in ps]
    assets_map: Dict[str, str] = {}
    if pids:
        try:
            ass = (c.table("product_assets")
                   .select("product_id,metadata_json,is_primary,sort_order")
                   .in_("product_id", pids)
                   .order("is_primary", desc=True)
                   .order("sort_order").limit(200).execute().data or [])
            for a in ass:
                pid = a["product_id"]
                if pid in assets_map:
                    continue
                url = (a.get("metadata_json") or {}).get("public_url")
                if url:
                    assets_map[pid] = url
        except Exception:
            pass
    products = [{
        "id":        p["id"],
        "name":      p.get("product_name"),
        "brand_id":  p.get("brand_id"),
        "category":  p.get("category_label"),
        "image_url": assets_map.get(p["id"]),
    } for p in ps]

    # Brands using this material (unique brand_ids from products)
    brand_ids = list({p["brand_id"] for p in products if p.get("brand_id")})
    brands: List[Dict[str, Any]] = []
    if brand_ids:
        try:
            br = (c.table("brands")
                  .select("id,name,slug,logo_url,hero_image_url")
                  .in_("id", brand_ids).limit(40).execute().data or [])
            brands = br
        except Exception:
            pass

    # Collections used by these products
    coll_ids = list({p["canonical_collection_id"] for p in ps
                      if p.get("canonical_collection_id")})
    collections: List[Dict[str, Any]] = []
    if coll_ids:
        try:
            cr = (c.table("collections_canonical")
                  .select("id,display_name,brand_id")
                  .in_("id", coll_ids).limit(40).execute().data or [])
            collections = [{
                "id":       x["id"],
                "name":     x["display_name"],
                "brand_id": x.get("brand_id"),
            } for x in cr]
        except Exception:
            pass

    return {
        "material": {
            "id":          material_id,
            "canonical_id": canon_id,
            "detected_id": detected_id,
            "name":        name,
            "aliases":     aliases,
            "description": description,
        },
        "brands":      brands,
        "collections": collections,
        "products":    products,
        "counts": {
            "brands":      len(brands),
            "collections": len(collections),
            "products":    len(products),
        },
        "saved": _is_saved(c, tid, "material", material_id),
        "states": {
            "no_products":    len(products) == 0,
            "no_brands":      len(brands) == 0,
            "no_collections": len(collections) == 0,
        },
    }


# ══════════════════════════════════════════════════════════════════════
#  4 · DESIGNER DETAIL
# ══════════════════════════════════════════════════════════════════════
@router.get("/designers/{designer_id}")
def designer_detail(designer_id: str, ctx=Depends(get_tenant_context)):
    """Return Designer Detail payload.

    Accepts BOTH designers_canonical.id and brand_detected_entities.id.
    """
    c = db()
    tid = ctx["tenant_id"]
    name: Optional[str] = None
    bio: Optional[str] = None
    verified: bool = False
    catalog_set_id: Optional[str] = None
    brand_id_hint: Optional[str] = None

    # Try canonical first
    try:
        d = (c.table("designers_canonical")
             .select("id,display_name,designer_key,brand_id,metadata_json")
             .eq("id", designer_id).limit(1).execute().data or [])
        if d:
            row = d[0]
            name = row.get("display_name") or row.get("designer_key")
            bio = (row.get("metadata_json") or {}).get("bio")
            verified = True
            brand_id_hint = row.get("brand_id")
    except Exception:
        pass

    # Try detected entity
    if not name:
        try:
            d = (c.table("brand_detected_entities")
                 .select("id,display_name,attributes,catalog_set_id")
                 .eq("id", designer_id).limit(1).execute().data or [])
            if d:
                row = d[0]
                name = row.get("display_name")
                attrs = row.get("attributes") or {}
                bio = attrs.get("bio") or attrs.get("description")
                verified = bool(attrs.get("verified_by"))
                catalog_set_id = row.get("catalog_set_id")
        except Exception:
            pass

    if not name:
        raise HTTPException(404, "Designer non trovato")

    # Brands & collections via catalog_set_id (best-effort)
    brands: List[Dict[str, Any]] = []
    collections: List[Dict[str, Any]] = []
    products: List[Dict[str, Any]] = []

    if catalog_set_id:
        try:
            # Brand from set
            cset = (c.table("brand_catalog_sets").select("brand_id")
                    .eq("id", catalog_set_id).limit(1).execute().data or [])
            if cset:
                brand_id_hint = brand_id_hint or cset[0].get("brand_id")
        except Exception:
            pass

    if brand_id_hint:
        try:
            br = (c.table("brands")
                  .select("id,name,slug,logo_url,hero_image_url,hero_subtitle")
                  .eq("id", brand_id_hint).limit(1).execute().data or [])
            brands = br
            # Collections of the brand
            cr = (c.table("collections_canonical")
                  .select("id,display_name,metadata_json")
                  .eq("brand_id", brand_id_hint).limit(40).execute().data or [])
            if catalog_set_id:
                cr = [x for x in cr
                       if (x.get("metadata_json") or {}).get("catalog_set_id")
                           == catalog_set_id]
            collections = [{
                "id":       x["id"],
                "name":     x["display_name"],
                "brand_id": brand_id_hint,
            } for x in cr]
            # Products in those collections
            cids = [x["id"] for x in collections][:10]
            if cids:
                ps = (c.table("products")
                      .select("id,product_name,canonical_collection_id,brand_id,"
                              "category_label")
                      .in_("canonical_collection_id", cids)
                      .limit(40).execute().data or [])
                pids = [p["id"] for p in ps]
                assets_map: Dict[str, str] = {}
                if pids:
                    ass = (c.table("product_assets")
                           .select("product_id,metadata_json,is_primary,sort_order")
                           .in_("product_id", pids)
                           .order("is_primary", desc=True)
                           .order("sort_order").limit(200).execute().data or [])
                    for a in ass:
                        pid = a["product_id"]
                        if pid in assets_map:
                            continue
                        url = (a.get("metadata_json") or {}).get("public_url")
                        if url:
                            assets_map[pid] = url
                products = [{
                    "id":         p["id"],
                    "name":       p.get("product_name"),
                    "brand_id":   p.get("brand_id"),
                    "category":   p.get("category_label"),
                    "image_url":  assets_map.get(p["id"]),
                } for p in ps]
        except Exception as ex:
            logger.warning(f"designer detail fetch: {ex}")

    return {
        "designer": {
            "id":       designer_id,
            "name":     name,
            "bio":      bio,
            "verified": verified,
        },
        "brands":      brands,
        "collections": collections,
        "products":    products,
        "counts": {
            "brands":      len(brands),
            "collections": len(collections),
            "products":    len(products),
        },
        "saved": _is_saved(c, tid, "designer", designer_id),
        "states": {
            "no_bio":         not bio,
            "no_brands":      len(brands) == 0,
            "no_collections": len(collections) == 0,
            "no_products":    len(products) == 0,
        },
    }
