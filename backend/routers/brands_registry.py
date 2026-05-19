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
