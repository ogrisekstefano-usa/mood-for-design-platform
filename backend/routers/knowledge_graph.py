"""Design Knowledge Graph™ Router — Phase 1 (ITER193).

Endpoints (mounted under /api/knowledge-graph):

  GET    /explore                                    · single mega-discovery endpoint
  GET    /canonical/{type}                           · list seeded vocab
  POST   /canonical/{type}                           · admin add custom entity
  POST   /products/{product_id}/retag                · re-run auto-tagger
  GET    /products/{product_id}/edges                · all edges for a product
  POST   /sessions/{id}/retag                        · re-run auto-tagger on session

Design:
  • Tenant-scoped (global vocab + tenant extensions)
  • Single JSON response — no UI
  • Read-heavy + admin write
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.tenant_context import get_tenant_context
from cultural_engine import auto_tagger
from database import db

logger = logging.getLogger(__name__)
router = APIRouter()


VALID_CANONICAL_TYPES = {"spaces", "features", "styles", "markets"}
TYPE_TO_TABLE = {
    "spaces":   "spaces_canonical",
    "features": "features_canonical",
    "styles":   "styles_canonical",
    "markets":  "markets_canonical",
}
TYPE_TO_KEY_COL = {
    "spaces":   "space_key",
    "features": "feature_key",
    "styles":   "style_key",
    "markets":  "market_key",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slim(row: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not row:
        return {}
    return {k: v for k, v in row.items() if k != "_id"}


class CanonicalEntityBody(BaseModel):
    key:           str
    display_name:  str
    category:      Optional[str] = None
    keywords:      Optional[List[str]] = None
    era:           Optional[str] = None
    region:        Optional[str] = None
    segment:       Optional[str] = None
    geo_level:     Optional[str] = None
    parent_market_key: Optional[str] = None
    description:   Optional[str] = None
    metadata:      Optional[Dict[str, Any]] = None


# ─── /canonical · list ────────────────────────────────────────────────
@router.get("/canonical/{type}")
def list_canonical(type: str, ctx=Depends(get_tenant_context),
                    is_global: Optional[bool] = None, limit: int = 200):
    if type not in VALID_CANONICAL_TYPES:
        raise HTTPException(400, f"Tipo non valido: {type}")
    c = db()
    table = TYPE_TO_TABLE[type]
    q = c.table(table).select("*").order("display_name").limit(min(500, limit))
    if is_global is not None:
        q = q.eq("is_global", is_global)
    rows = q.execute().data or []
    return {"type": type, "total": len(rows), "items": [_slim(r) for r in rows]}


# ─── /canonical · admin add custom ────────────────────────────────────
@router.post("/canonical/{type}", status_code=201)
def add_canonical(type: str, body: CanonicalEntityBody, ctx=Depends(get_tenant_context)):
    if type not in VALID_CANONICAL_TYPES:
        raise HTTPException(400, f"Tipo non valido: {type}")
    c = db()
    table = TYPE_TO_TABLE[type]
    key_col = TYPE_TO_KEY_COL[type]
    row: Dict[str, Any] = {
        "id":               str(uuid.uuid4()),
        "tenant_id":        ctx["tenant_id"],
        key_col:            body.key.strip().lower(),
        "display_name":     body.display_name.strip(),
        "keywords":         body.keywords or [],
        "is_global":        False,    # tenant extension by default
        "metadata_json":    body.metadata or {},
    }
    if type == "spaces":
        row["category"] = body.category
    elif type == "features":
        row["category"] = body.category
    elif type == "styles":
        row["era"] = body.era
        row["mood_tags"] = body.metadata.get("mood_tags") if body.metadata else []
    elif type == "markets":
        row["region"] = body.region
        row["segment"] = body.segment
        row["geo_level"] = body.geo_level or "country"
        if body.parent_market_key:
            parent = (c.table("markets_canonical").select("id")
                      .eq("market_key", body.parent_market_key)
                      .limit(1).execute().data or [])
            if parent:
                row["parent_market_id"] = parent[0]["id"]
    if body.description:
        row["description_i18n"] = {"it": body.description}
    try:
        c.table(table).insert(row).execute()
    except Exception as e:
        raise HTTPException(409, f"Insert fallito: {e}")
    return _slim(row)


# ─── /explore · single mega-discovery endpoint ────────────────────────
@router.get("/explore")
def explore(
    type: Optional[str] = Query(None, description="Filter by node type (products/materials/brands/spaces/styles/features/markets)"),
    brand_id: Optional[str] = None,
    space: Optional[str] = None,
    style: Optional[str] = None,
    market: Optional[str] = None,
    feature: Optional[str] = None,
    limit: int = 50,
    include_edges: bool = False,
    ctx=Depends(get_tenant_context),
):
    """Single discovery endpoint.

    Examples:
      GET /explore?style=contemporary&space=hospitality&market=usa
      GET /explore?type=materials&brand_id=<uuid>
    """
    c = db()
    tid = ctx["tenant_id"]
    limit = min(200, max(1, limit))
    nodes: Dict[str, List[Dict[str, Any]]] = {}
    edges: List[Dict[str, Any]] = []

    # Resolve filter values → canonical IDs
    def _resolve_id(table: str, key_col: str, key_val: Optional[str]) -> Optional[str]:
        if not key_val:
            return None
        rows = (c.table(table).select("id")
                .eq(key_col, key_val.strip().lower())
                .limit(1).execute().data or [])
        return rows[0]["id"] if rows else None

    space_id   = _resolve_id("spaces_canonical",   "space_key",   space)
    style_id   = _resolve_id("styles_canonical",   "style_key",   style)
    market_id  = _resolve_id("markets_canonical",  "market_key",  market)
    feature_id = _resolve_id("features_canonical", "feature_key", feature)

    # ─── Find products matching all filters ───
    # Get candidate product_ids by intersecting filter results
    candidate_ids: Optional[set] = None

    def _intersect(pid_set: set):
        nonlocal candidate_ids
        candidate_ids = pid_set if candidate_ids is None else candidate_ids & pid_set

    if space_id:
        rows = (c.table("product_spaces").select("product_id")
                .eq("space_id", space_id).execute().data or [])
        _intersect({r["product_id"] for r in rows})
    if style_id:
        rows = (c.table("product_styles").select("product_id")
                .eq("style_id", style_id).execute().data or [])
        _intersect({r["product_id"] for r in rows})
    if market_id:
        rows = (c.table("product_markets").select("product_id")
                .eq("market_id", market_id).execute().data or [])
        _intersect({r["product_id"] for r in rows})
    if feature_id:
        rows = (c.table("product_features").select("product_id")
                .eq("feature_id", feature_id).execute().data or [])
        _intersect({r["product_id"] for r in rows})

    # Fetch product rows
    prods_q = (c.table("products").select(
        "id,product_name,brand_id,designer_name,category_label,description,"
        "materials,finishes,confidence_score,review_status,market_relevance"
    ).eq("tenant_id", tid).limit(limit))
    if brand_id:
        prods_q = prods_q.eq("brand_id", brand_id)
    if candidate_ids is not None:
        if not candidate_ids:
            products = []
        else:
            products = prods_q.in_("id", list(candidate_ids)).execute().data or []
    else:
        products = prods_q.execute().data or []

    nodes["products"] = [_slim(p) for p in products]

    # ─── Canonical nodes ───
    if not type or type in ("spaces", "all"):
        nodes["spaces"] = [_slim(r) for r in
            (c.table("spaces_canonical").select("id,space_key,display_name,category")
              .order("display_name").execute().data or [])]
    if not type or type in ("features", "all"):
        nodes["features"] = [_slim(r) for r in
            (c.table("features_canonical").select("id,feature_key,display_name,category")
              .order("display_name").execute().data or [])]
    if not type or type in ("styles", "all"):
        nodes["styles"] = [_slim(r) for r in
            (c.table("styles_canonical").select("id,style_key,display_name,era")
              .order("display_name").execute().data or [])]
    if not type or type in ("markets", "all"):
        nodes["markets"] = [_slim(r) for r in
            (c.table("markets_canonical").select("id,market_key,display_name,region,geo_level,segment")
              .order("display_name").execute().data or [])]

    # ─── Materials / Designers / Brands (cross-reference) ───
    if not type or type in ("materials", "all"):
        if products:
            # materials canonicals related to these products via products.canonical_material_ids
            # Phase 1: just dump canonical materials for the tenant
            mat_q = c.table("materials_canonical").select(
                "id,material_key,display_name,mention_count").eq("tenant_id", tid)
            nodes["materials"] = [_slim(r) for r in (mat_q.execute().data or [])]
        else:
            nodes["materials"] = []

    if not type or type in ("designers", "all"):
        nodes["designers"] = [_slim(r) for r in
            (c.table("designers_canonical").select(
                "id,designer_key,display_name,product_count,mention_count")
             .eq("tenant_id", tid).order("product_count", desc=True)
             .execute().data or [])]

    if not type or type in ("brands", "all"):
        try:
            nodes["brands"] = [_slim(r) for r in
                (c.table("brands").select("id,name,slug").execute().data or [])]
        except Exception:
            nodes["brands"] = []

    # ─── Edges (optional, expensive) ───
    if include_edges and products:
        pids = [p["id"] for p in products]
        for table, target_type, target_id_col, score_col in [
            ("product_spaces",   "space",   "space_id",   "confidence_score"),
            ("product_styles",   "style",   "style_id",   "confidence_score"),
            ("product_features", "feature", "feature_id", "confidence_score"),
            ("product_markets",  "market",  "market_id",  "relevance_score"),
        ]:
            rows = (c.table(table).select("*").in_("product_id", pids).execute().data or [])
            for r in rows:
                edges.append({
                    "from": f"product:{r['product_id']}",
                    "to":   f"{target_type}:{r[target_id_col]}",
                    "weight": float(r.get(score_col) or 0),
                    "source": r.get("source"),
                    "evidence": r.get("evidence") or [],
                })

    counts = {k: len(v) for k, v in nodes.items()}
    counts["edges"] = len(edges)

    return {
        "filters_applied": {
            "type": type, "brand_id": brand_id,
            "space": space, "style": style, "market": market, "feature": feature,
        },
        "nodes":  nodes,
        "edges":  edges,
        "counts": counts,
    }


# ─── /products/{id}/retag ─────────────────────────────────────────────
@router.post("/products/{product_id}/retag")
def retag_product(product_id: str,
                   threshold: float = Query(0.40, ge=0.0, le=0.99),
                   ctx=Depends(get_tenant_context)):
    c = db()
    result = auto_tagger.tag_product(
        c, tenant_id=ctx["tenant_id"], product_id=product_id,
        confidence_threshold=threshold,
    )
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


# ─── /products/{id}/edges ─────────────────────────────────────────────
@router.get("/products/{product_id}/edges")
def product_edges(product_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    out: Dict[str, List[Dict[str, Any]]] = {}
    for table, key in [("product_spaces", "spaces"), ("product_styles", "styles"),
                       ("product_features", "features"), ("product_markets", "markets")]:
        rows = (c.table(table).select("*")
                .eq("product_id", product_id).execute().data or [])
        out[key] = [_slim(r) for r in rows]
    # Resolve canonical names for readability
    return {"product_id": product_id, "edges": out,
            "edge_count": sum(len(v) for v in out.values())}


# ─── /sessions/{id}/retag ─────────────────────────────────────────────
@router.post("/sessions/{session_id}/retag")
def retag_session_endpoint(session_id: str,
                            threshold: float = Query(0.40, ge=0.0, le=0.99),
                            ctx=Depends(get_tenant_context)):
    c = db()
    return auto_tagger.retag_session(
        c, tenant_id=ctx["tenant_id"],
        brand_import_session_id=session_id,
        confidence_threshold=threshold,
    )
