"""KE-002.1 · Knowledge KPI + Semantic Event helpers.

Two responsibilities:

1) `compute_kpi(set_id)` → flat counts for the Control Room KPI strip:
       products · designers · materials · finishes · images · relations ·
       aliases · collections.
   Pulls from the REAL data sources (`products`, `brand_catalog_pages`,
   `brand_entity_relations`, `brand_detected_entities`) so we never show
   zero on a catalog set that actually has 1.000+ pages and 300+ products.

2) `emit_semantic_events_for_document(...)` → for a single completed
   `brand_catalog_documents` row, query the products / pages derived from
   that source document and emit one summary event per kind
   (`PRODUCT_FOUND`, `DESIGNER_FOUND`, `MATERIAL_FOUND`, `IMAGE_FOUND`,
   `RELATION_FOUND` if applicable). One event per kind per document keeps
   the Live Activity Stream meaningful and non-spammy.

3) `backfill_semantic_events(set_id)` → one-shot backfill for catalog
   sets whose extraction already completed BEFORE KE-002.1 (we don't lose
   the narrative for RIVA1920 etc.).

All functions are best-effort: DB hiccups are logged but never raised.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, Iterable, List, Optional

from database import db
from services import extraction_event_publisher as events

logger = logging.getLogger("ke002.kpi")


# ─── Helpers ────────────────────────────────────────────────────────
def _parse_jsonish(value: Any) -> Any:
    """Postgrest may return JSONB columns as already-decoded objects or
    as JSON strings depending on the driver. Coerce safely."""
    if value is None or isinstance(value, (list, dict)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return None
    return value


def _doc_ids_for_set(c, set_id: str) -> List[Dict[str, str]]:
    return (c.table("brand_catalog_documents")
            .select("id,source_document_id,display_name,original_filename")
            .eq("catalog_set_id", set_id).execute().data or [])


# ═══════════════════════════════════════════════════════════════════
# 1 · KPI STRIP COUNTS
# ═══════════════════════════════════════════════════════════════════
def compute_kpi(set_id: str) -> Dict[str, int]:
    """Return flat counts for the 6 KPI cells + 2 extras.

    Keys (all int, never None):
        products     · count(products) for this set
        designers    · unique `designer_name` across products
                       + canonical designers in brand_detected_entities
        materials    · unique `materials` lemmas across products
                       + brand_detected_entities of type material
        finishes     · unique `finishes` lemmas across products
        images       · sum(asset_refs length) across brand_catalog_pages
        relations    · count(brand_entity_relations)
        aliases      · count(brand_detected_entities entity_type='brand_alias')
        collections  · unique `category_label` across products
                       + canonical collections in brand_detected_entities
    """
    out = {
        "products": 0, "designers": 0, "materials": 0, "finishes": 0,
        "images": 0, "relations": 0, "aliases": 0, "collections": 0,
    }
    try:
        c = db()
        docs = _doc_ids_for_set(c, set_id)
        src_ids = [d["source_document_id"] for d in docs if d.get("source_document_id")]

        # 1.1 · Products + derived: designers/materials/finishes/collections
        prods: List[Dict[str, Any]] = []
        if src_ids:
            prods = (c.table("products")
                     .select("id,designer_name,materials,finishes,"
                              "category_label,canonical_collection_id,"
                              "canonical_designer_id,confidence_score")
                     .in_("source_document_id", src_ids).limit(5000)
                     .execute().data or [])
        out["products"] = len(prods)

        mats: set = set()
        fins: set = set()
        dsgs: set = set()
        cols: set = set()
        for p in prods:
            for m in (p.get("materials") or []):
                if isinstance(m, str) and m.strip():
                    mats.add(m.strip().lower())
            for f in (p.get("finishes") or []):
                if isinstance(f, str) and f.strip():
                    fins.add(f.strip().lower())
            dn = p.get("designer_name")
            if dn and isinstance(dn, str) and dn.strip():
                dsgs.add(dn.strip().lower())
            cl = p.get("category_label")
            if cl and isinstance(cl, str) and cl.strip():
                cols.add(cl.strip().lower())
        out["materials"]   = len(mats)
        out["finishes"]    = len(fins)
        out["designers"]   = len(dsgs)
        out["collections"] = len(cols)

        # 1.2 · Brand_detected_entities (when populated)
        ents = (c.table("brand_detected_entities")
                .select("id,entity_type,status")
                .eq("catalog_set_id", set_id).limit(5000)
                .execute().data or [])
        bde_designers = sum(1 for e in ents
                            if e["entity_type"] in ("designer", "designer_registered"))
        bde_materials = sum(1 for e in ents if e["entity_type"] == "material")
        bde_aliases   = sum(1 for e in ents if e["entity_type"] == "brand_alias")
        bde_cols      = sum(1 for e in ents if e["entity_type"] == "collection")
        # Prefer the larger of the two (entities OR derived) so that brands
        # whose resolution ran show canonical counts, and brands without it
        # still get the product-derived counts.
        out["designers"]   = max(out["designers"],   bde_designers)
        out["materials"]   = max(out["materials"],   bde_materials)
        out["aliases"]     = bde_aliases
        out["collections"] = max(out["collections"], bde_cols)

        # 1.3 · Images — sum of asset_refs across pages
        try:
            pages = (c.table("brand_catalog_pages")
                     .select("asset_refs")
                     .eq("catalog_set_id", set_id).limit(10000)
                     .execute().data or [])
            total = 0
            for p in pages:
                ar = _parse_jsonish(p.get("asset_refs"))
                if isinstance(ar, list):
                    total += len(ar)
            out["images"] = total
        except Exception as ex:
            logger.warning(f"compute_kpi[images]: {ex}")

        # 1.4 · Relations
        try:
            rel = (c.table("brand_entity_relations")
                   .select("id", count="exact").limit(0)
                   .eq("catalog_set_id", set_id).execute())
            out["relations"] = int(getattr(rel, "count", 0) or 0)
        except Exception as ex:
            logger.warning(f"compute_kpi[relations]: {ex}")

    except Exception as ex:
        logger.warning(f"compute_kpi failed: {ex}")
    return out


# ═══════════════════════════════════════════════════════════════════
# 2 · SEMANTIC EVENT EMISSION
# ═══════════════════════════════════════════════════════════════════
def _format_list(items: Iterable[str], limit: int = 3) -> str:
    items = [i for i in items if i]
    head = items[:limit]
    extra = max(0, len(items) - len(head))
    out = ", ".join(head)
    if extra:
        out += f" · +{extra}"
    return out


def emit_semantic_events_for_document(
    *,
    tenant_id: str,
    catalog_set_id: str,
    catalog_document_id: str,
    source_document_id: str,
    job_id: Optional[str] = None,
    document_name: Optional[str] = None,
) -> Dict[str, int]:
    """After a doc completes, summarise what was found and emit one
    semantic event per kind. Returns the counts emitted (for telemetry)."""
    counts = {"products": 0, "designers": 0, "materials": 0, "images": 0}
    try:
        c = db()
        prods = (c.table("products")
                 .select("id,product_name,designer_name,materials,finishes,confidence_score")
                 .eq("source_document_id", source_document_id).limit(2000)
                 .execute().data or [])
        counts["products"] = len(prods)

        product_names = [p.get("product_name") for p in prods if p.get("product_name")]
        designers: set = set()
        materials: set = set()
        for p in prods:
            dn = p.get("designer_name")
            if dn and isinstance(dn, str) and dn.strip():
                designers.add(dn.strip())
            for m in (p.get("materials") or []):
                if isinstance(m, str) and m.strip():
                    materials.add(m.strip())
        counts["designers"] = len(designers)
        counts["materials"] = len(materials)

        # Images: sum asset_refs lengths for this document
        try:
            pages = (c.table("brand_catalog_pages")
                     .select("asset_refs")
                     .eq("catalog_document_id", catalog_document_id).limit(5000)
                     .execute().data or [])
            img_total = 0
            for pg in pages:
                ar = _parse_jsonish(pg.get("asset_refs"))
                if isinstance(ar, list):
                    img_total += len(ar)
            counts["images"] = img_total
        except Exception as ex:
            logger.warning(f"semantic[images]: {ex}")

        common = dict(
            tenant_id=tenant_id, catalog_set_id=catalog_set_id,
            catalog_document_id=catalog_document_id, job_id=job_id,
        )
        doc_label = document_name or "documento"

        if counts["products"]:
            events.emit(
                **common, kind=events.PRODUCT_FOUND,
                message=f"{counts['products']} prodotti identificati in {doc_label} · {_format_list(product_names)}",
                payload={"count": counts["products"],
                          "examples": product_names[:5]},
            )
        if counts["designers"]:
            events.emit(
                **common, kind=events.DESIGNER_FOUND,
                message=f"{counts['designers']} designer identificati · {_format_list(designers)}",
                payload={"count": counts["designers"],
                          "examples": list(designers)[:5]},
            )
        if counts["materials"]:
            events.emit(
                **common, kind=events.MATERIAL_FOUND,
                message=f"{counts['materials']} materiali identificati · {_format_list(materials)}",
                payload={"count": counts["materials"],
                          "examples": list(materials)[:5]},
            )
        if counts["images"]:
            events.emit(
                **common, kind=events.IMAGE_FOUND,
                message=f"{counts['images']} immagini estratte da {doc_label}",
                payload={"count": counts["images"]},
            )
    except Exception as ex:
        logger.warning(f"emit_semantic_events_for_document failed: {ex}")
    return counts


def backfill_semantic_events(set_id: str) -> Dict[str, Any]:
    """One-shot backfill for catalog sets that completed BEFORE KE-002.1.

    For every document with `extraction_status` in (review, validated),
    if there is NO existing semantic event for it, emit one batch.
    Idempotent: re-running won't duplicate events.
    """
    c = db()
    docs = (c.table("brand_catalog_documents")
            .select("id,source_document_id,tenant_id,catalog_set_id,"
                     "display_name,original_filename,extraction_status")
            .eq("catalog_set_id", set_id)
            .in_("extraction_status", ["review", "validated"]).execute().data or [])
    emitted = 0
    skipped = 0
    totals = {"products": 0, "designers": 0, "materials": 0, "images": 0}
    for d in docs:
        # Check idempotency: already have a PRODUCT_FOUND for this doc?
        try:
            existing = (c.table("extraction_event_log")
                        .select("id", count="exact").limit(0)
                        .eq("catalog_document_id", d["id"])
                        .eq("kind", events.PRODUCT_FOUND).execute())
            if int(getattr(existing, "count", 0) or 0) > 0:
                skipped += 1
                continue
        except Exception:
            pass
        counts = emit_semantic_events_for_document(
            tenant_id=d["tenant_id"],
            catalog_set_id=d["catalog_set_id"],
            catalog_document_id=d["id"],
            source_document_id=d["source_document_id"],
            document_name=d.get("display_name") or d.get("original_filename"),
        )
        for k in totals:
            totals[k] += counts.get(k, 0)
        emitted += 1
    return {
        "ok": True, "set_id": set_id,
        "documents_processed": emitted,
        "documents_skipped":   skipped,
        "totals":              totals,
    }
