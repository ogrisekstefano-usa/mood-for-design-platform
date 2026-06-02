"""Brand Index Builder™ — ITER194 Multi-PDF Catalog Set Unified Index.

Reads all products and product_sections under a brand_catalog_set, aggregates
detected entities cross-document, applies threshold-based deduplication, and
populates the brand_detected_entities + brand_entity_relations tables.

Confidence policy (founder approved):
  • confidence ≥ 0.85  → status='auto_merged'  (no manual review)
  • 0.60 ≤ conf <0.85 → status='needs_review' (Entity Resolver UI shows)
  • confidence < 0.60  → status='separate'    (kept distinct)

Entity types (canonical):
  collection · composition · product · finish · material · designer ·
  accessory · mirror · washbasin · tap
"""
from __future__ import annotations

import logging
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

AUTO_MERGE_THRESHOLD = 0.85
REVIEW_THRESHOLD = 0.60

# Heuristic confidence boost: an entity mentioned across more documents is
# more likely to be a real brand-level entity, not a single-PDF artefact.
MENTION_BOOST_PER_DOC = 0.06     # +0.06 per additional doc, capped
MAX_MENTION_BOOST = 0.25


# ─── helpers ──────────────────────────────────────────────────────────
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(text: str) -> str:
    if not text:
        return ""
    norm = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    norm = re.sub(r"[^a-zA-Z0-9]+", "-", norm).strip("-").lower()
    return norm


def _ratio(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def _is_alias(a: str, b: str, threshold: float = 0.86) -> bool:
    """Cheap fuzzy alias check (Code / Code Wave / Code-Wave)."""
    if not a or not b:
        return False
    if a == b:
        return True
    if a in b or b in a:
        return True
    return _ratio(a, b) >= threshold


# ─── core ─────────────────────────────────────────────────────────────
def build_unified_index(
    db_client: Any,
    *,
    tenant_id: str,
    catalog_set_id: str,
    brand_id: str,
) -> Dict[str, Any]:
    """Aggregate, dedupe and persist the Unified Brand Index for a set.

    Returns summary dict with counts per entity_type and status.
    """
    # ── 1. Load all catalog documents in the set ──────────────────────
    docs = (db_client.table("brand_catalog_documents")
            .select("id,source_document_id,display_name,original_filename,page_count")
            .eq("catalog_set_id", catalog_set_id)
            .eq("tenant_id", tenant_id).execute().data or [])
    if not docs:
        return {"counts": {}, "total_entities": 0, "documents": 0}

    src_doc_ids = [d["source_document_id"] for d in docs]
    doc_id_by_src = {d["source_document_id"]: d["id"] for d in docs}

    # ── 2. Load all products + sections under those source_documents ──
    products = (db_client.table("products")
                .select("id,product_name,designer_name,category_label,materials,"
                        "finishes,source_document_id,source_section_id,source_pages,"
                        "confidence_score,review_status")
                .eq("tenant_id", tenant_id)
                .in_("source_document_id", src_doc_ids)
                .execute().data or [])
    sections = (db_client.table("product_sections")
                .select("id,source_document_id,start_page,end_page,detected_title,"
                        "detected_designer,detected_category,raw_text,product_id,"
                        "confidence_score")
                .in_("source_document_id", src_doc_ids).execute().data or [])

    # ── 3. Wipe previous index for this set (idempotent rebuild) ──────
    db_client.table("brand_entity_relations").delete() \
        .eq("catalog_set_id", catalog_set_id).execute()
    db_client.table("brand_detected_entities").delete() \
        .eq("catalog_set_id", catalog_set_id).execute()

    # ── 4. Accumulator: entity_type → key → record ────────────────────
    acc: Dict[str, Dict[str, Dict[str, Any]]] = {}

    def _bump(entity_type: str, key: str, display_name: str,
              src_doc_id: Optional[str] = None,
              section_id: Optional[str] = None,
              page_number: Optional[int] = None,
              confidence: float = 0.5,
              attributes: Optional[Dict[str, Any]] = None,
              aliases: Optional[List[str]] = None) -> Dict[str, Any]:
        bucket = acc.setdefault(entity_type, {})
        # Fuzzy match against an existing key first (Code / Code Wave demo)
        match_key = key
        for existing_key in bucket.keys():
            if _is_alias(existing_key, key):
                match_key = existing_key
                break
        rec = bucket.get(match_key)
        if rec is None:
            rec = {
                "entity_type": entity_type,
                "entity_key": match_key,
                "display_name": display_name,
                "aliases": set(),
                "source_document_ids": set(),
                "source_section_ids": set(),
                "source_pages": set(),
                "mentions": 0,
                "raw_conf_sum": 0.0,
                "attributes": {},
                "evidence": [],
            }
            bucket[match_key] = rec
        rec["mentions"] += 1
        rec["raw_conf_sum"] += float(confidence or 0.5)
        if display_name and display_name != rec["display_name"] and len(display_name) < 80:
            rec["aliases"].add(display_name)
        if aliases:
            for a in aliases:
                if a and a != rec["display_name"]:
                    rec["aliases"].add(a)
        if src_doc_id:
            rec["source_document_ids"].add(src_doc_id)
        if section_id:
            rec["source_section_ids"].add(section_id)
        if page_number is not None:
            rec["source_pages"].add(int(page_number))
        if attributes:
            for k, v in attributes.items():
                if v in (None, "", [], {}):
                    continue
                if k not in rec["attributes"]:
                    rec["attributes"][k] = v
        if section_id or page_number:
            rec["evidence"].append({
                "source_document_id": src_doc_id,
                "section_id": section_id,
                "page": page_number,
            })
        return rec

    # 4.a · Products + designers + materials + finishes -----------------
    for p in products:
        src_doc = p.get("source_document_id")
        sec_id = p.get("source_section_id")
        pages = p.get("source_pages") or []
        first_page = pages[0] if pages else None
        name = (p.get("product_name") or "").strip()
        if name and name.lower() not in ("untitled", "collection"):
            _bump(
                "product", _slugify(name) or name.lower(), name,
                src_doc_id=src_doc, section_id=sec_id, page_number=first_page,
                confidence=float(p.get("confidence_score") or 0.5),
                attributes={
                    "category": p.get("category_label"),
                    "designer": p.get("designer_name"),
                    "materials": p.get("materials") or [],
                    "finishes": p.get("finishes") or [],
                },
            )
        designer = (p.get("designer_name") or "").strip()
        if designer:
            _bump(
                "designer", _slugify(designer) or designer.lower(), designer,
                src_doc_id=src_doc, section_id=sec_id, page_number=first_page,
                confidence=0.78,  # designer match is fairly high signal
            )
        for mat in (p.get("materials") or []):
            mat_clean = (mat or "").strip()
            if not mat_clean:
                continue
            _bump(
                "material", _slugify(mat_clean) or mat_clean.lower(), mat_clean,
                src_doc_id=src_doc, section_id=sec_id, page_number=first_page,
                confidence=0.72,
            )
        for fin in (p.get("finishes") or []):
            fin_clean = (fin or "").strip()
            if not fin_clean:
                continue
            _bump(
                "finish", _slugify(fin_clean) or fin_clean.lower(), fin_clean,
                src_doc_id=src_doc, section_id=sec_id, page_number=first_page,
                confidence=0.68,
            )

    # 4.b · Collections inferred from section titles --------------------
    # A "collection" is heuristically a section title that recurs across
    # multiple sections OR matches a known marker (Code, Home Plus, Essentials…)
    collection_markers = re.compile(
        r"\b(code\s*wave|code|home\s*plus|essentials?|raw\s*edition|collection|"
        r"linea|serie|preview|edition)\b", re.IGNORECASE
    )
    title_freq: Dict[str, int] = {}
    for s in sections:
        title = (s.get("detected_title") or "").strip()
        if not title:
            continue
        slug = _slugify(title)
        title_freq[slug] = title_freq.get(slug, 0) + 1
    for s in sections:
        title = (s.get("detected_title") or "").strip()
        if not title:
            continue
        slug = _slugify(title)
        if title_freq[slug] >= 2 or collection_markers.search(title):
            _bump(
                "collection", slug or title.lower(), title,
                src_doc_id=s.get("source_document_id"),
                section_id=s.get("id"),
                page_number=s.get("start_page"),
                confidence=0.70 if collection_markers.search(title) else 0.55,
            )

    # ── 5. Persist entities with confidence-thresholded status ────────
    inserted_ids: Dict[Tuple[str, str], str] = {}
    counts_by_status = {"auto_merged": 0, "needs_review": 0, "separate": 0}
    counts_by_type: Dict[str, int] = {}

    for entity_type, bucket in acc.items():
        for key, rec in bucket.items():
            n_docs = len(rec["source_document_ids"])
            base = rec["raw_conf_sum"] / max(1, rec["mentions"])
            boost = min(MAX_MENTION_BOOST, max(0, n_docs - 1) * MENTION_BOOST_PER_DOC)
            confidence = round(min(0.99, base + boost), 3)

            if confidence >= AUTO_MERGE_THRESHOLD:
                status = "auto_merged"
            elif confidence >= REVIEW_THRESHOLD:
                status = "needs_review"
            else:
                status = "separate"

            entity_id = str(uuid.uuid4())
            row = {
                "id": entity_id,
                "tenant_id": tenant_id,
                "catalog_set_id": catalog_set_id,
                "brand_id": brand_id,
                "entity_type": entity_type,
                "entity_key": key[:160],
                "display_name": rec["display_name"][:200],
                "aliases": sorted(rec["aliases"]),
                "source_document_ids": [
                    doc_id_by_src.get(sd, sd) for sd in rec["source_document_ids"]
                ],
                "source_page_ids": [],
                "mention_count": rec["mentions"],
                "confidence_score": confidence,
                "status": status,
                "attributes": rec["attributes"],
                "evidence": rec["evidence"][:20],
                "metadata_json": {
                    "documents_seen": n_docs,
                    "pages_seen": sorted(rec["source_pages"])[:50],
                    "raw_confidence_mean": round(base, 3),
                },
                "created_at": _now(),
                "updated_at": _now(),
            }
            try:
                db_client.table("brand_detected_entities").insert(row).execute()
                inserted_ids[(entity_type, key)] = entity_id
                counts_by_status[status] += 1
                counts_by_type[entity_type] = counts_by_type.get(entity_type, 0) + 1
            except Exception as e:
                logger.warning(f"insert entity failed {entity_type}/{key}: {e}")

    # ── 6. Build relations product → designer / material / finish ─────
    relation_rows: List[Dict[str, Any]] = []
    for p in products:
        prod_name = (p.get("product_name") or "").strip()
        prod_key = _slugify(prod_name) or prod_name.lower()
        prod_eid = inserted_ids.get(("product", prod_key))
        if not prod_eid:
            continue
        # designer
        designer = (p.get("designer_name") or "").strip()
        if designer:
            d_eid = inserted_ids.get(("designer", _slugify(designer) or designer.lower()))
            if d_eid:
                relation_rows.append({
                    "id": str(uuid.uuid4()),
                    "tenant_id": tenant_id,
                    "catalog_set_id": catalog_set_id,
                    "brand_id": brand_id,
                    "source_entity_id": prod_eid,
                    "target_entity_id": d_eid,
                    "relation_type": "designed_by",
                    "evidence": [{"source_document_id": p.get("source_document_id")}],
                    "confidence_score": 0.80,
                    "created_at": _now(), "updated_at": _now(),
                })
        # materials
        for mat in (p.get("materials") or []):
            mkey = _slugify((mat or "").strip()) or (mat or "").lower()
            m_eid = inserted_ids.get(("material", mkey))
            if m_eid:
                relation_rows.append({
                    "id": str(uuid.uuid4()),
                    "tenant_id": tenant_id,
                    "catalog_set_id": catalog_set_id,
                    "brand_id": brand_id,
                    "source_entity_id": prod_eid,
                    "target_entity_id": m_eid,
                    "relation_type": "has_material",
                    "evidence": [{"source_document_id": p.get("source_document_id")}],
                    "confidence_score": 0.70,
                    "created_at": _now(), "updated_at": _now(),
                })
        # finishes
        for fin in (p.get("finishes") or []):
            fkey = _slugify((fin or "").strip()) or (fin or "").lower()
            f_eid = inserted_ids.get(("finish", fkey))
            if f_eid:
                relation_rows.append({
                    "id": str(uuid.uuid4()),
                    "tenant_id": tenant_id,
                    "catalog_set_id": catalog_set_id,
                    "brand_id": brand_id,
                    "source_entity_id": prod_eid,
                    "target_entity_id": f_eid,
                    "relation_type": "has_finish",
                    "evidence": [{"source_document_id": p.get("source_document_id")}],
                    "confidence_score": 0.65,
                    "created_at": _now(), "updated_at": _now(),
                })

    # Dedupe relation rows by (source,target,type) before inserting
    seen_rel = set()
    unique_rels = []
    for r in relation_rows:
        k = (r["source_entity_id"], r["target_entity_id"], r["relation_type"])
        if k in seen_rel:
            continue
        seen_rel.add(k)
        unique_rels.append(r)
    rel_inserted = 0
    for r in unique_rels:
        try:
            db_client.table("brand_entity_relations").insert(r).execute()
            rel_inserted += 1
        except Exception as e:
            logger.debug(f"relation insert skip: {e}")

    # ── 7. Update catalog_set.index_summary ───────────────────────────
    summary = {
        "by_type": counts_by_type,
        "by_status": counts_by_status,
        "relations": rel_inserted,
        "documents": len(docs),
        "products": len([p for p in products if (p.get("product_name") or "").strip()]),
    }
    try:
        db_client.table("brand_catalog_sets").update({
            "index_summary": summary,
            "updated_at": _now(),
        }).eq("id", catalog_set_id).execute()
    except Exception as e:
        logger.warning(f"summary update failed: {e}")

    return {
        "counts": counts_by_type,
        "by_status": counts_by_status,
        "total_entities": sum(counts_by_type.values()),
        "relations": rel_inserted,
        "documents": len(docs),
        "products": len(products),
    }


# ─── Page-level snapshot ─────────────────────────────────────────────
VISUAL_ROLE_MAP = {
    "cover": "cover",
    "index": "index",
    "section_opener": "section_opener",
    "product_spread": "product_spread",
    "lifestyle": "lifestyle",
    "technical_drawing": "technical_drawing",
    "finishes_table": "finishes_table",
    "composition": "composition",
    "brand_story": "brand_story",
}


def write_page_snapshots(
    db_client: Any,
    *,
    tenant_id: str,
    catalog_set_id: str,
    brand_id: str,
    catalog_document_id: str,
    source_document_id: str,
    page_count: int,
    sections: List[Dict[str, Any]],
) -> int:
    """Materialise brand_catalog_pages rows for every page.

    Visual role is inferred from section overlap and section heuristics:
      • page == 1 and TOC marker → cover
      • page in section but no detected_title → product_spread
      • page in section with technical keywords → technical_drawing
      • page outside any section → unknown
    """
    # Wipe previous pages for this catalog_document_id (idempotent)
    db_client.table("brand_catalog_pages").delete() \
        .eq("catalog_document_id", catalog_document_id).execute()

    if not page_count or page_count <= 0:
        return 0

    def _role_for_section(sec: Dict[str, Any], page_no: int) -> Tuple[str, str]:
        title = (sec.get("detected_title") or "").strip()
        raw = (sec.get("raw_text") or "").lower()
        if page_no == sec["start_page"] and title:
            if any(k in raw for k in ("technical", "scheda tecnica", "dimensions table")):
                return "technical_drawing", title
            if any(k in raw for k in ("finiture", "finishes", "finitions")):
                return "finishes_table", title
            if any(k in raw for k in ("composition", "composizione", "system")):
                return "composition", title
            return "section_opener", title
        return "product_spread", title or None

    rows_inserted = 0
    for page_no in range(1, page_count + 1):
        section = None
        for s in sections:
            if s["start_page"] <= page_no <= s["end_page"]:
                section = s
                break
        if page_no == 1:
            visual_role, page_title = "cover", section.get("detected_title") if section else None
        elif section is None:
            visual_role, page_title = "unknown", None
        else:
            visual_role, page_title = _role_for_section(section, page_no)

        try:
            db_client.table("brand_catalog_pages").insert({
                "id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "catalog_set_id": catalog_set_id,
                "catalog_document_id": catalog_document_id,
                "source_document_id": source_document_id,
                "brand_id": brand_id,
                "page_number": page_no,
                "visual_role": visual_role,
                "page_title": page_title,
                "detected_collection": (section or {}).get("detected_category"),
                "detected_section": (section or {}).get("detected_title"),
                "raw_text": ((section or {}).get("raw_text") or "")[:6000] if section else None,
                "review_status": "pending",
                "confidence_score": float((section or {}).get("confidence_score") or 0.40)
                                    if section else 0.40,
                "created_at": _now(), "updated_at": _now(),
            }).execute()
            rows_inserted += 1
        except Exception as e:
            logger.warning(f"page snapshot failed p{page_no}: {e}")
    return rows_inserted
