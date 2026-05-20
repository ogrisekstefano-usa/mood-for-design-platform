"""Brand Registry™ + Collections Registry™ + Tag Registry™ + Product Usage™.

Endpoint set — all under /api/inspirations/registry/* (kept inside the
Inspirations namespace because the registries are consumed primarily by
Supplier Catalog Import™ and Inspirations™ tagging flows).

  GET    /api/inspirations/registry/brands?q=&limit=     autocomplete brands
  POST   /api/inspirations/registry/brands               create new brand (studio_private)
  GET    /api/inspirations/registry/brands/{id}          read brand
  GET    /api/inspirations/registry/brands/{id}/collections   list collections
  POST   /api/inspirations/registry/brands/{id}/collections   create new collection
  GET    /api/inspirations/registry/tags?type=&q=        tag autocomplete
  POST   /api/inspirations/registry/usage-events         emit a product_usage_event

Visibility rules:
  • curated_public (tenant_id IS NULL) — visible to everyone
  • studio_private (tenant_id = X)     — visible only to that tenant
"""
from __future__ import annotations

import logging
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from database import db

logger = logging.getLogger(__name__)
router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode("ascii")
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s or "brand"


# ─── Models ────────────────────────────────────────────────────────────
class BrandCreate(BaseModel):
    name:            str = Field(..., min_length=1, max_length=120)
    website:         Optional[str] = None
    category:        Optional[str] = None
    country:         Optional[str] = None
    primary_markets: Optional[List[str]] = None
    positioning:     Optional[str] = None
    luxury_tier:     Optional[str] = None
    note:            Optional[str] = None
    agreement_status: Optional[str] = "unverified"


class BrandUpdate(BaseModel):
    """Patch payload for studio_private brands. All fields optional."""
    name:            Optional[str] = Field(None, min_length=1, max_length=120)
    website:         Optional[str] = None
    category:        Optional[str] = None
    country:         Optional[str] = None
    primary_markets: Optional[List[str]] = None
    positioning:     Optional[str] = None
    luxury_tier:     Optional[str] = None
    agreement_status: Optional[str] = None
    logo_url:        Optional[str] = None


class CollectionCreate(BaseModel):
    name:        str = Field(..., min_length=1, max_length=160)
    year:        Optional[int] = None
    season:      Optional[str] = None
    category:    Optional[str] = None
    description: Optional[str] = None


class UsageEvent(BaseModel):
    product_id:   str
    usage_type:   str  # 'added_to_moodboard' | 'added_to_project' | 'used_in_cultural_edition' | 'used_in_presentation' | 'used_in_magazine'
    project_id:   Optional[str] = None
    moodboard_id: Optional[str] = None
    edition_id:   Optional[str] = None
    market_code:  Optional[str] = None


# ─── Brand endpoints ───────────────────────────────────────────────────
@router.get("/registry/brands")
def brand_autocomplete(
    q:     Optional[str] = Query(None, max_length=80),
    limit: int = Query(20, le=50),
    ctx=Depends(get_tenant_context),
):
    """Autocomplete: curated_public brands ∪ studio_private brands of this tenant."""
    c = db()
    tid = ctx["tenant_id"]
    # PostgREST: fetch all visible brands then filter client-side (small dataset)
    visible = (c.table("brands").select(
        "id,tenant_id,name,slug,category,country,logo_url,positioning,luxury_tier,"
        "hospitality_score,residential_score,contract_score,retail_score,"
        "primary_markets,agreement_status,visibility_level"
    ).or_(f"tenant_id.is.null,tenant_id.eq.{tid}")
     .order("name").limit(150).execute().data or [])
    if q:
        ql = q.lower()
        visible = [b for b in visible
                   if ql in (b.get("name") or "").lower()
                   or ql in (b.get("slug") or "").lower()]
    return {"items": visible[:limit]}


@router.post("/registry/brands", status_code=201)
def create_brand(body: BrandCreate, ctx=Depends(get_tenant_context)):
    """Create a new studio_private brand. Idempotent on (tenant_id, slug)."""
    c = db()
    tid = ctx["tenant_id"]
    slug = _slugify(body.name)
    # Look for existing brand with same slug (curated_public OR same tenant)
    existing = (c.table("brands").select("*")
                .or_(f"tenant_id.is.null,tenant_id.eq.{tid}")
                .eq("slug", slug).limit(1).execute().data or [])
    if existing:
        return {"item": existing[0], "created": False}
    row = {
        "id":               str(uuid.uuid4()),
        "tenant_id":        tid,
        "name":             body.name.strip(),
        "slug":             slug,
        "category":         body.category,
        "country":          body.country,
        "website":          body.website,
        "positioning":      body.positioning,
        "luxury_tier":      body.luxury_tier,
        "primary_markets":  body.primary_markets or [],
        "agreement_status": body.agreement_status or "unverified",
        "visibility_level": "studio_private",
        "created_by":       ctx.get("profile_id"),
        "created_at":       _now(),
        "updated_at":       _now(),
    }
    c.table("brands").insert(row).execute()
    return {"item": row, "created": True}


@router.get("/registry/brands/{brand_id}")
def get_brand(brand_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("brands").select("*")
            .or_(f"tenant_id.is.null,tenant_id.eq.{tid}")
            .eq("id", brand_id).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Produttore non trovato")
    return rows[0]


def _is_studio_private(brand: Dict[str, Any], tenant_id: str) -> bool:
    """Editable/deletable only when the brand BELONGS to the current tenant
    (curated_public brands have tenant_id IS NULL and are read-only).
    """
    return brand.get("tenant_id") is not None and brand.get("tenant_id") == tenant_id


@router.patch("/registry/brands/{brand_id}")
def update_brand(brand_id: str, body: BrandUpdate, ctx=Depends(get_tenant_context)):
    """Update a studio_private brand. Curated_public brands (curated by MOOD)
    are read-only — the registry consistency depends on it.

    Linguaggio italiano editoriale negli errori — niente "permission denied"
    enterprise.
    """
    c = db()
    tid = ctx["tenant_id"]
    brand = get_brand(brand_id, ctx)
    if not _is_studio_private(brand, tid):
        raise HTTPException(403,
            "Questo produttore è curato da MOOD — non è modificabile dallo studio.")

    patch: Dict[str, Any] = {k: v for k, v in body.model_dump(exclude_unset=True).items()
                             if v is not None}
    if "name" in patch:
        patch["slug"] = _slugify(patch["name"])
    patch["updated_at"] = _now()

    if not patch:
        return brand

    c.table("brands").update(patch).eq("id", brand_id).execute()
    # Read-back so the response has the merged row
    return get_brand(brand_id, ctx)


@router.delete("/registry/brands/{brand_id}", status_code=204)
def delete_brand(brand_id: str, ctx=Depends(get_tenant_context)):
    """Remove a studio_private brand. The brand visibility check is the
    same as PATCH — curated brands stay protected.

    Side effects (deliberate · best-effort, non-blocking):
      • brand_collections of this brand stay in the DB but become orphaned
        (we don't cascade — collections may carry curatorial value worth
        archiving). The frontend filters them out in Studio Collections™.
      • product_usage_events stay (historic data).
    """
    c = db()
    tid = ctx["tenant_id"]
    brand = get_brand(brand_id, ctx)
    if not _is_studio_private(brand, tid):
        raise HTTPException(403,
            "Questo produttore è curato da MOOD — non è eliminabile dallo studio.")
    c.table("brands").delete().eq("id", brand_id).execute()
    return None


# ─── Brand Mode™ — atlante curatoriale dei produttori ───────────────────
# Phase D · Sprint D3. Brand Mode™ list endpoint enriches each brand with
# the counts the editorial card needs (collections, product inspirations,
# atmosphere prevalence) without forcing the frontend to issue N+1 calls.
#
# Linguaggio: "atlante curatoriale", non "vendor list / supplier catalog".
@router.get("/registry/brands-atlas")
def brands_atlas(
    q:     Optional[str] = Query(None, max_length=80),
    limit: int = Query(60, le=120),
    ctx=Depends(get_tenant_context),
):
    """Atlante curatoriale — brand cards enriched with collections/inspirations
    counts and dominant atmosphere/material prevalence (for the editorial Brand Mode™ list view)."""
    c = db()
    tid = ctx["tenant_id"]

    # 1. Visible brands (curated_public ∪ studio_private)
    raw_brands = (c.table("brands").select("*")
                  .or_(f"tenant_id.is.null,tenant_id.eq.{tid}")
                  .order("name").limit(limit).execute().data or [])
    if q:
        ql = q.strip().lower()
        raw_brands = [b for b in raw_brands
                      if ql in (b.get("name") or "").lower()
                      or ql in (b.get("positioning") or "").lower()]

    if not raw_brands:
        return {"items": []}

    brand_ids = [b["id"] for b in raw_brands]
    brand_name_index = {b["name"]: b for b in raw_brands}

    # 2. Collections counts per brand_id (single query)
    coll_rows = (c.table("brand_collections").select("brand_id,id")
                 .in_("brand_id", brand_ids).execute().data or [])
    coll_count: Dict[str, int] = {}
    for r in coll_rows:
        coll_count[r["brand_id"]] = coll_count.get(r["brand_id"], 0) + 1

    # 3. Inspirations / Products counts per brand (media_library.inspiration_meta.brand)
    # NB: inspiration_meta.brand is the brand NAME (matches the supplier-import path)
    insp_rows = (c.table("media_library")
                 .select("inspiration_meta,is_inspiration")
                 .eq("tenant_id", tid)
                 .eq("is_inspiration", True)
                 .is_("archived_at", None)
                 .execute().data or [])
    insp_count:    Dict[str, int] = {}
    product_count: Dict[str, int] = {}
    atmo_bag:      Dict[str, Dict[str, int]] = {}  # brand_name → tag → count
    mat_bag:       Dict[str, Dict[str, int]] = {}
    markets_bag:   Dict[str, Dict[str, int]] = {}

    for r in insp_rows:
        meta = r.get("inspiration_meta") or {}
        brand_name = meta.get("brand")
        if not brand_name or brand_name not in brand_name_index:
            continue
        bn = brand_name
        if (meta.get("inspiration_type") or "").lower() == "product":
            product_count[bn] = product_count.get(bn, 0) + 1
        else:
            insp_count[bn] = insp_count.get(bn, 0) + 1
        for tag in (meta.get("atmosphere_tags") or []):
            atmo_bag.setdefault(bn, {})[tag] = atmo_bag.get(bn, {}).get(tag, 0) + 1
        for tag in (meta.get("material_tags") or []):
            mat_bag.setdefault(bn, {})[tag] = mat_bag.get(bn, {}).get(tag, 0) + 1
        for mkt in (meta.get("market_codes") or []):
            markets_bag.setdefault(bn, {})[mkt] = markets_bag.get(bn, {}).get(mkt, 0) + 1

    # 4. Compose enriched cards
    def _top3(bag: Optional[Dict[str, int]]):
        if not bag:
            return []
        return [k for k, _ in sorted(bag.items(), key=lambda kv: -kv[1])[:3]]

    items = []
    for b in raw_brands:
        bn = b["name"]
        items.append({
            **b,
            "is_studio_private":  b.get("tenant_id") is not None and b.get("tenant_id") == tid,
            "collections_count":   coll_count.get(b["id"], 0),
            "inspirations_count":  insp_count.get(bn, 0),
            "products_count":      product_count.get(bn, 0),
            "dominant_atmospheres": _top3(atmo_bag.get(bn)),
            "dominant_materials":   _top3(mat_bag.get(bn)),
            "dominant_markets":     _top3(markets_bag.get(bn)) or (b.get("primary_markets") or [])[:3],
        })

    return {"items": items}


@router.get("/registry/brands/{brand_id}/curatorial-profile")
def brand_curatorial_profile(brand_id: str, ctx=Depends(get_tenant_context)):
    """Brand Detail View™ — composes the curatorial reading of a brand from
    aggregated inspirations + collections + product usage events. Returns
    `curatorial_insights[]` (textual phrases, NEVER raw analytics).

    Linguaggio: "letture curatoriali", "geografie narrative", "atmosfere prevalenti".
    """
    brand = get_brand(brand_id, ctx)  # visibility check
    c = db()
    tid = ctx["tenant_id"]
    bn = brand["name"]
    # Expose studio-private flag so the UI can gate edit/delete buttons
    brand = {**brand, "is_studio_private": _is_studio_private(brand, tid)}

    # Collections (full list, year desc)
    collections = (c.table("brand_collections").select("*")
                   .eq("brand_id", brand_id)
                   .or_(f"tenant_id.is.null,tenant_id.eq.{tid}")
                   .order("year", desc=True).execute().data or [])

    # Inspirations + Products of this brand
    insp_rows = (c.table("media_library")
                 .select("id,file_url,alt_text,description,inspiration_meta")
                 .eq("tenant_id", tid)
                 .eq("is_inspiration", True)
                 .is_("archived_at", None)
                 .execute().data or [])
    inspirations: List[Dict[str, Any]] = []
    products:     List[Dict[str, Any]] = []
    atmo_bag, mat_bag, markets_bag, hp_bag, luxury_bag = {}, {}, {}, {}, {}
    for r in insp_rows:
        meta = r.get("inspiration_meta") or {}
        if (meta.get("brand") or "") != bn:
            continue
        card = {
            "id":        r["id"],
            "image_url": r.get("file_url"),
            "title":     r.get("alt_text") or "",
            "atmosphere_tags": meta.get("atmosphere_tags") or [],
            "material_tags":   meta.get("material_tags") or [],
            "market_codes":    meta.get("market_codes") or [],
            "product_name":    meta.get("product_name"),
            "collection":      meta.get("collection"),
        }
        if (meta.get("inspiration_type") or "").lower() == "product":
            products.append(card)
        else:
            inspirations.append(card)
        for t in (meta.get("atmosphere_tags") or []):
            atmo_bag[t] = atmo_bag.get(t, 0) + 1
        for t in (meta.get("material_tags") or []):
            mat_bag[t] = mat_bag.get(t, 0) + 1
        for m in (meta.get("market_codes") or []):
            markets_bag[m] = markets_bag.get(m, 0) + 1
        if meta.get("hospitality_profile"):
            hp_bag[meta["hospitality_profile"]] = hp_bag.get(meta["hospitality_profile"], 0) + 1
        if meta.get("luxury_level"):
            luxury_bag[meta["luxury_level"]] = luxury_bag.get(meta["luxury_level"], 0) + 1

    # Moodboards connected via product_usage_events (best-effort, table may not exist)
    moodboard_ids: List[str] = []
    try:
        product_ids = [p["id"] for p in products]
        if product_ids:
            ev_rows = (c.table("product_usage_events").select("moodboard_id")
                       .in_("product_id", product_ids)
                       .eq("usage_type", "added_to_moodboard")
                       .execute().data or [])
            moodboard_ids = list({r["moodboard_id"] for r in ev_rows if r.get("moodboard_id")})
    except Exception as e:
        logger.info(f"product_usage_events lookup skipped: {e}")
    moodboards: List[Dict[str, Any]] = []
    if moodboard_ids:
        try:
            mb_rows = (c.table("moodboards").select("id,title,cover_image_url,updated_at")
                       .in_("id", moodboard_ids[:24]).execute().data or [])
            moodboards = mb_rows
        except Exception as e:
            logger.info(f"moodboards lookup skipped: {e}")

    # Top-K helper
    def top_k(bag, k=5):
        if not bag:
            return []
        return [{"label": kk, "count": vv}
                for kk, vv in sorted(bag.items(), key=lambda kv: -kv[1])[:k]]

    dom_atmo    = top_k(atmo_bag)
    dom_mat     = top_k(mat_bag)
    dom_markets = top_k(markets_bag)
    dom_hp      = top_k(hp_bag, k=2)

    # ── Curatorial Insights™ — testual, NOT analytics ──
    # Heuristics that read like a curator commenting, not a dashboard.
    # Strict italian editorial language.
    market_label_map = {
        "us-miami":     "Miami",
        "us-nyc":       "New York",
        "us-socal":     "Southern California",
        "it-milano":    "Milano",
        "uk-london":    "Londra",
        "fr-paris":     "Parigi",
        "ae-dubai":     "Dubai",
        # Legacy / supplier-import naming convention (snake_case region_city)
        "usa_miami":    "Miami",
        "usa_nyc":      "New York",
        "usa_socal":    "Southern California",
        "italy_milano": "Milano",
        "uk_london":    "Londra",
        "france_paris": "Parigi",
        "uae_dubai":    "Dubai",
    }
    hp_label_map = {
        "hospitality_focused": "hospitality",
        "residential_focused": "residenziale",
        "boutique_intimate":   "boutique",
    }

    insights: List[str] = []
    if dom_atmo:
        atm = ", ".join([a["label"] for a in dom_atmo[:2]])
        insights.append(
            f"Il brand viene letto prevalentemente con atmosfere {atm} — il linguaggio progettuale ricorrente è "
            f"caratterizzato da {dom_mat[0]['label'] if dom_mat else 'materialità stratificata'} "
            f"come materia narrativa centrale."
        )
    if dom_markets:
        mkt_labels = [market_label_map.get(m["label"], m["label"]) for m in dom_markets[:2]]
        insights.append(
            f"Le geografie narrative dove il brand compare più spesso sono "
            f"{' e '.join(mkt_labels)} — coerenti con i mercati primari dichiarati nel posizionamento."
        )
    if dom_hp:
        hp_labels = [hp_label_map.get(h["label"], h["label"]) for h in dom_hp]
        if "hospitality" in hp_labels:
            insights.append(
                "Il brand compare frequentemente in composizioni hospitality-oriented "
                "caratterizzate da continuità indoor/outdoor e layering materico."
            )
        elif "residenziale" in hp_labels:
            insights.append(
                "Il brand viene reinterpretato soprattutto in chiave residenziale, "
                "con composizioni a bassa orizzontalità e tattilità centrale."
            )
    if moodboards:
        insights.append(
            f"Le moodboard dello studio mostrano {len(moodboards)} composizioni "
            f"che integrano questo brand — segnale di una continuità progettuale ricorrente."
        )
    if collections:
        years = sorted({c.get("year") for c in collections if c.get("year")}, reverse=True)
        if years:
            insights.append(
                f"L'archivio collezioni copre {len(collections)} riferimenti tra il "
                f"{years[-1]} e il {years[0]}, con una densità editoriale costante."
            )
    if not insights:
        insights.append(
            "Il brand è in fase di lettura curatoriale — aggiungi riferimenti o "
            "importa un catalogo per leggere atmosfere, materialità e geografie narrative."
        )

    return {
        "brand":           brand,
        "collections":     collections,
        "inspirations":    inspirations[:48],
        "products":        products[:48],
        "moodboards":      moodboards,
        "dominant_atmospheres": dom_atmo,
        "dominant_materials":   dom_mat,
        "dominant_markets":     dom_markets,
        "dominant_profiles":    dom_hp,
        "curatorial_insights":  insights,
        "counts": {
            "collections":  len(collections),
            "inspirations": len(inspirations),
            "products":     len(products),
            "moodboards":   len(moodboards),
        },
    }


# ─── Collections endpoints ─────────────────────────────────────────────
@router.get("/registry/brands/{brand_id}/collections")
def list_collections(brand_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    # First verify brand visibility
    _ = get_brand(brand_id, ctx)
    rows = (c.table("brand_collections").select("*")
            .eq("brand_id", brand_id)
            .or_(f"tenant_id.is.null,tenant_id.eq.{tid}")
            .order("year", desc=True).execute().data or [])
    return {"items": rows}


@router.post("/registry/brands/{brand_id}/collections", status_code=201)
def create_collection(brand_id: str, body: CollectionCreate, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _ = get_brand(brand_id, ctx)  # ensure access
    slug = _slugify(body.name)
    existing = (c.table("brand_collections").select("*")
                .eq("brand_id", brand_id).eq("slug", slug).limit(1).execute().data or [])
    if existing:
        return {"item": existing[0], "created": False}
    row = {
        "id":          str(uuid.uuid4()),
        "brand_id":    brand_id,
        "tenant_id":   tid,
        "name":        body.name.strip(),
        "slug":        slug,
        "year":        body.year,
        "season":      body.season,
        "category":    body.category,
        "description": body.description,
        "is_active":   True,
        "created_at":  _now(),
        "updated_at":  _now(),
    }
    c.table("brand_collections").insert(row).execute()
    return {"item": row, "created": True}


# ─── Collection edit / delete — Sprint E2 · Studio Collections™ CRUD ───
class CollectionUpdate(BaseModel):
    """Patch payload for studio-owned brand collections. All fields optional."""
    name:        Optional[str] = Field(None, min_length=1, max_length=160)
    year:        Optional[int] = None
    season:      Optional[str] = None
    category:    Optional[str] = None
    description: Optional[str] = None


def _get_collection(collection_id: str, tid: str) -> Dict[str, Any]:
    c = db()
    rows = (c.table("brand_collections").select("*")
            .or_(f"tenant_id.is.null,tenant_id.eq.{tid}")
            .eq("id", collection_id).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Collezione non trovata")
    return rows[0]


def _is_studio_collection(coll: Dict[str, Any], tid: str) -> bool:
    """Editable/deletable only for tenant-owned (studio_private) collections."""
    return coll.get("tenant_id") is not None and coll.get("tenant_id") == tid


@router.patch("/registry/collections/{collection_id}")
def update_collection(collection_id: str, body: CollectionUpdate, ctx=Depends(get_tenant_context)):
    """Update a studio-owned collection. Curated_public collections (those
    seeded by MOOD with tenant_id IS NULL) stay read-only."""
    tid = ctx["tenant_id"]
    coll = _get_collection(collection_id, tid)
    if not _is_studio_collection(coll, tid):
        raise HTTPException(403,
            "Questa collezione è curata da MOOD — non è modificabile dallo studio.")
    patch: Dict[str, Any] = {k: v for k, v in body.model_dump(exclude_unset=True).items()
                             if v is not None}
    if "name" in patch:
        patch["slug"] = _slugify(patch["name"])
    patch["updated_at"] = _now()
    if not patch:
        return coll
    db().table("brand_collections").update(patch).eq("id", collection_id).execute()
    return _get_collection(collection_id, tid)


@router.delete("/registry/collections/{collection_id}", status_code=204)
def delete_collection(collection_id: str, ctx=Depends(get_tenant_context)):
    """Remove a studio-owned collection. Linked Product Inspirations stay
    in the archive (inspiration_meta.collection field is just a string ref —
    we don't cascade)."""
    tid = ctx["tenant_id"]
    coll = _get_collection(collection_id, tid)
    if not _is_studio_collection(coll, tid):
        raise HTTPException(403,
            "Questa collezione è curata da MOOD — non è eliminabile dallo studio.")
    db().table("brand_collections").delete().eq("id", collection_id).execute()
    return None


# ─── Tag Registry™ ─────────────────────────────────────────────────────
@router.get("/registry/tags")
def tag_autocomplete(
    type:  str = Query(..., regex="^(brand|atmosphere|material|style|room_type|cultural)$"),
    q:     Optional[str] = Query(None, max_length=80),
    limit: int = Query(30, le=60),
    ctx=Depends(get_tenant_context),
):
    """Autocomplete normalized tags. Approved tags first, by usage_count desc."""
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("tag_registry").select("*")
            .eq("type", type)
            .or_(f"tenant_id.is.null,tenant_id.eq.{tid}")
            .order("approved", desc=True)
            .order("usage_count", desc=True)
            .limit(200).execute().data or [])
    if q:
        ql = q.lower()
        rows = [t for t in rows
                if ql in (t.get("label") or "").lower()
                or ql in (t.get("slug")  or "").lower()
                or any(ql in (s or "").lower() for s in (t.get("synonyms") or []))]
    return {"items": rows[:limit]}


# ─── Product Usage Events™ ─────────────────────────────────────────────
@router.post("/registry/usage-events", status_code=201)
def record_usage_event(body: UsageEvent, ctx=Depends(get_tenant_context)):
    """Record a product usage event. Cheap, async-friendly emission point."""
    c = db()
    tid = ctx["tenant_id"]
    # Resolve brand_id from product inspiration_meta (denormalize)
    brand_id: Optional[str] = None
    mrow = (c.table("media_library").select("id,inspiration_meta")
            .eq("id", body.product_id).eq("tenant_id", tid).limit(1).execute().data or [])
    if mrow:
        meta = mrow[0].get("inspiration_meta") or {}
        brand_id = meta.get("brand_id")
    row = {
        "id":           str(uuid.uuid4()),
        "tenant_id":    tid,
        "product_id":   body.product_id,
        "brand_id":     brand_id,
        "project_id":   body.project_id,
        "moodboard_id": body.moodboard_id,
        "edition_id":   body.edition_id,
        "market_code":  body.market_code,
        "usage_type":   body.usage_type,
        "created_at":   _now(),
    }
    try:
        c.table("product_usage_events").insert(row).execute()
    except Exception as e:
        logger.warning(f"product_usage_events insert failed (non-fatal): {e}")
        return {"ok": False, "warning": "evento non registrato"}
    return {"ok": True, "event_id": row["id"]}


# ─── Taxonomy (categories + rights) — extended structured values ───────
CATEGORIES = [
    {"key": "arredi",            "label": "Arredi"},
    {"key": "cucine",            "label": "Cucine"},
    {"key": "bagni",             "label": "Bagni"},
    {"key": "illuminazione",     "label": "Illuminazione"},
    {"key": "outdoor",           "label": "Outdoor"},
    {"key": "rivestimenti",      "label": "Rivestimenti"},
    {"key": "pietra_naturale",   "label": "Pietra naturale"},
    {"key": "decor",             "label": "Decor"},
    {"key": "contract",          "label": "Contract"},
    {"key": "hospitality",       "label": "Hospitality"},
    {"key": "workspace",         "label": "Workspace"},
    {"key": "lifestyle",         "label": "Lifestyle"},
    {"key": "technical",         "label": "Technical"},
    {"key": "materials",         "label": "Materials"},
]

RIGHTS_PERMISSIONS = [
    {"key": "official_brand_asset",    "label": "Asset ufficiale brand partner",
     "publishable": True,  "exportable": True,  "commercial_use": True,  "modifiable": False},
    {"key": "authorized_distributor",  "label": "Asset distributore autorizzato",
     "publishable": True,  "exportable": True,  "commercial_use": True,  "modifiable": True},
    {"key": "showroom_asset",          "label": "Asset showroom",
     "publishable": True,  "exportable": True,  "commercial_use": True,  "modifiable": True},
    {"key": "studio_uploaded",         "label": "Asset caricato dallo studio",
     "publishable": True,  "exportable": True,  "commercial_use": True,  "modifiable": True},
    {"key": "editorial_reference",     "label": "Editorial reference",
     "publishable": False, "exportable": False, "commercial_use": False, "modifiable": True},
    {"key": "restricted_usage",        "label": "Restricted usage",
     "publishable": False, "exportable": False, "commercial_use": False, "modifiable": False},
]


@router.get("/registry/taxonomy")
def get_taxonomy():
    """Strutturato per il wizard catalogo — categorie + rights & permissions."""
    return {
        "categories":         CATEGORIES,
        "rights_permissions": RIGHTS_PERMISSIONS,
    }


# ─── Phase F1 · Product Visual Atlas™ ──────────────────────────────────
# Bucket layout returned by the Visual Atlas API.
ATLAS_BUCKETS = [
    "lifestyle", "still_life", "cutouts", "textures",
    "details", "technicals", "renderings", "campaigns",
    "material_samples", "variants",
]

_ASSET_TYPE_TO_BUCKET = {
    "lifestyle":        "lifestyle",
    "still_life":       "still_life",
    "cutout":           "cutouts",
    "texture":          "textures",
    "detail":           "details",
    "technical":        "technicals",
    "rendering":        "renderings",
    "campaign":         "campaigns",
    "material_sample":  "material_samples",
    "variant":          "variants",
}


def _atlas_card(row: Dict[str, Any]) -> Dict[str, Any]:
    """Slim shape for the Visual Atlas API. NO _id, NO raw blobs."""
    meta = row.get("inspiration_meta") or {}
    return {
        "id":                       row.get("id"),
        "file_url":                 row.get("file_url"),
        "width":                    row.get("width"),
        "height":                   row.get("height"),
        "alt_text":                 row.get("alt_text"),
        "product_name":             meta.get("product_name"),
        "brand":                    meta.get("brand"),
        "collection":               meta.get("collection"),
        "page_number":              meta.get("page_number"),
        "asset_type":               meta.get("asset_type"),
        "compositional_role":       meta.get("compositional_role"),
        "view_angle":               meta.get("view_angle"),
        "visual_group_key":         meta.get("visual_group_key"),
        "editorial_score":          meta.get("editorial_score"),
        "moodboard_priority":       meta.get("moodboard_priority"),
        "visual_weight":            meta.get("visual_weight"),
        "composition_friendly":     meta.get("composition_friendly"),
        "classification_confidence": meta.get("classification_confidence"),
        "classified_by":            meta.get("classified_by"),
        "color_family":             meta.get("color_family"),
        "dominant_color_palette":   meta.get("dominant_color_palette") or [],
        "mood_tags":                meta.get("mood_tags") or [],
        "room_type":                meta.get("room_type"),
        "recommended_usage":        meta.get("recommended_usage") or [],
        "is_primary_asset":         bool(meta.get("is_primary_asset")),
    }


@router.get("/registry/products/{product_id}/visual-assets")
def product_visual_atlas(product_id: str, ctx=Depends(get_tenant_context)):
    """Product Visual Atlas™ — restituisce TUTTI gli asset visuali
    associati a un prodotto (raggruppati per asset_type).

    `product_id` è l'id di una riga `media_library` di tipo Product
    Inspiration. Il grouping avviene via `inspiration_meta.visual_group_key`
    (Phase F1). Per i prodotti pre-F1 (senza visual_group_key) si esegue
    fallback su (supplier_catalog_id + normalized product_name) o
    (brand_id + normalized product_name).
    """
    c = db()
    tid = ctx["tenant_id"]

    seed_rows = (c.table("media_library").select(
        "id,file_url,width,height,alt_text,inspiration_meta,created_at"
    ).eq("id", product_id).eq("tenant_id", tid).eq("is_inspiration", True)
     .limit(1).execute().data or [])
    if not seed_rows:
        raise HTTPException(404, "Product Inspiration non trovato")
    seed = seed_rows[0]
    seed_meta = seed.get("inspiration_meta") or {}

    vg_key = seed_meta.get("visual_group_key")
    sibling_rows: List[Dict[str, Any]] = []

    if vg_key:
        sibling_rows = (c.table("media_library").select(
            "id,file_url,width,height,alt_text,inspiration_meta,created_at"
        ).eq("tenant_id", tid).eq("is_inspiration", True)
         .eq("inspiration_meta->>visual_group_key", vg_key)
         .order("created_at", desc=False)
         .limit(200).execute().data or [])

    # Fallback: legacy rows (Phase F0) have no visual_group_key. Group by
    # (supplier_catalog_id + product_name) when available.
    if not sibling_rows or len(sibling_rows) <= 1:
        scid = seed_meta.get("supplier_catalog_id")
        pname = seed_meta.get("product_name")
        if scid and pname:
            try:
                bulk = (c.table("media_library").select(
                    "id,file_url,width,height,alt_text,inspiration_meta,created_at"
                ).eq("tenant_id", tid).eq("is_inspiration", True)
                 .eq("inspiration_meta->>supplier_catalog_id", scid)
                 .eq("inspiration_meta->>product_name", pname)
                 .order("created_at", desc=False)
                 .limit(200).execute().data or [])
                if bulk:
                    sibling_rows = bulk
            except Exception as e:
                logger.warning(f"atlas: legacy grouping fallback failed: {e}")

    if not sibling_rows:
        sibling_rows = [seed]

    # Build buckets
    buckets: Dict[str, List[Dict[str, Any]]] = {b: [] for b in ATLAS_BUCKETS}
    gallery: List[Dict[str, Any]] = []
    hero: Optional[Dict[str, Any]] = None
    for row in sibling_rows:
        card = _atlas_card(row)
        gallery.append(card)
        at = (card.get("asset_type") or "").lower()
        bucket = _ASSET_TYPE_TO_BUCKET.get(at)
        if bucket:
            buckets[bucket].append(card)
        # Hero selection: prefer compositional_role='hero', else best moodboard_priority
        if card.get("compositional_role") == "hero" and hero is None:
            hero = card

    if hero is None:
        # Pick the highest moodboard_priority / lifestyle as hero fallback
        ranked = sorted(
            gallery,
            key=lambda c: (
                -(int(c.get("moodboard_priority") or 0)),
                -(float(c.get("editorial_score") or 0.0)),
            ),
        )
        hero = ranked[0] if ranked else _atlas_card(seed)

    # Sort each bucket by moodboard_priority desc, then editorial_score desc
    for k in buckets:
        buckets[k].sort(
            key=lambda c: (
                -(int(c.get("moodboard_priority") or 0)),
                -(float(c.get("editorial_score") or 0.0)),
            )
        )

    # Aggregated mood / palette / family across the group
    all_mood = []
    all_palette = []
    fams: Dict[str, int] = {}
    for card in gallery:
        for t in (card.get("mood_tags") or []):
            if t and t not in all_mood: all_mood.append(t)
        for p in (card.get("dominant_color_palette") or []):
            all_palette.append(p)
        fam = card.get("color_family")
        if fam: fams[fam] = fams.get(fam, 0) + 1
    dominant_family = max(fams.items(), key=lambda kv: kv[1])[0] if fams else None

    return {
        "product_id":     seed.get("id"),
        "visual_group_key": vg_key,
        "product": {
            "name":         seed_meta.get("product_name"),
            "brand":        seed_meta.get("brand"),
            "brand_id":     seed_meta.get("brand_id"),
            "collection":   seed_meta.get("collection"),
            "category":     seed_meta.get("product_category"),
            "designer":     seed_meta.get("designer"),
            "rights_status": seed_meta.get("rights_status"),
        },
        "hero":              hero,
        "lifestyle":         buckets["lifestyle"],
        "still_life":        buckets["still_life"],
        "cutouts":           buckets["cutouts"],
        "textures":          buckets["textures"],
        "details":           buckets["details"],
        "technicals":        buckets["technicals"],
        "renderings":        buckets["renderings"],
        "campaigns":         buckets["campaigns"],
        "material_samples":  buckets["material_samples"],
        "variants":          buckets["variants"],
        "gallery":           gallery,
        "counts": {
            "total":            len(gallery),
            **{k: len(v) for k, v in buckets.items()},
        },
        "metadata": {
            "mood_tags":             all_mood[:12],
            "color_family_dominant": dominant_family,
            "palette_aggregate":     all_palette[:8],
        },
    }

