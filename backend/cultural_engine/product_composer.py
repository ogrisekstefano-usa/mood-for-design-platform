"""Product Composer™ — Phase 1 Orchestrator.

Reads a PDF byte stream and produces canonical Product Knowledge Objects™
in the database. Pipeline steps:

  Step 1 · register the document (or look it up if pre-registered)
  Step 2 · detect product sections (section_detector)
  Step 3 · extract images with the existing catalog_extractor
  Step 4 · classify images (asset_classifier rule-based) + compute pHash
  Step 5 · assign images to sections by page_number, dedup via pHash
  Step 6 · parse section text → materials/finishes/dimensions/description
  Step 7 · compose products + product_assets rows (review_status='draft')

Inputs:
    pdf_bytes, source_document_id, tenant_id, brand_id (optional),
    asset_uploader (callable bytes,filename → public_url + media_library_id)

Outputs:
    {
      "products_created": [..uuids..],
      "assets_assigned":  count,
      "dedup_groups":     count,
      "sections":         [..ids..],
      "metrics":          {avg_confidence, dimensions_hit_pct, ...},
      "processing_logs":  [..steps..]
    }
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import uuid
import unicodedata
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple

from cultural_engine import catalog_extractor
from cultural_engine import asset_classifier
from cultural_engine import section_detector
from cultural_engine import section_text_parser
from cultural_engine import image_dedup
from cultural_engine import vision_asset_classifier  # Phase 1.5 · always-on

logger = logging.getLogger(__name__)


# ─── helpers ──────────────────────────────────────────────────────────
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(text: str) -> str:
    if not text:
        return "untitled"
    norm = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    norm = re.sub(r"[^a-zA-Z0-9]+", "-", norm).strip("-").lower()
    return norm or "untitled"


def _classification_to_role(classification: Dict[str, Any]) -> str:
    """Map asset_classifier output → product_assets.role enum.

    Phase 1.5 (ITER189): when Vision Layer 2 enrichment is present
    (vision_asset_type / vision_compositional_role), it overrides the
    rule-based mapping. Vision is calibrated for edge-to-edge editorial
    lifestyle layouts where Layer 1 fails.
    """
    # Vision override (Phase 1.5 always-on)
    vision_atype = classification.get("vision_asset_type")
    vision_role = classification.get("vision_compositional_role")
    if vision_atype:
        atype = vision_atype
        comp = vision_role or classification.get("compositional_role", "supporting")
    else:
        atype = classification.get("asset_type", "still_life")
        comp = classification.get("compositional_role", "supporting")

    if atype == "cutout":
        return "packshot"
    if atype == "texture":
        return "texture"
    if atype == "detail":
        return "detail"
    if atype == "technical":
        return "technical"
    if atype == "rendering":
        return "drawing"
    if atype == "material_sample":
        return "finish"
    if atype == "lifestyle":
        return "hero" if comp == "hero" else "ambient"
    return "still_life"


def _knowledge_object_flags(
    has_designer: bool,
    has_materials: bool,
    has_dimensions: bool,
    has_description: bool,
    role_counts: Dict[str, int],
) -> Tuple[bool, bool, bool]:
    """Compute (spec_ready, academy_ready, content_ready).

    Phase 1 defaults — conservative thresholds.
    """
    spec_ready = bool(has_designer and has_dimensions and has_materials)
    academy_ready = bool(has_description and has_designer
                         and (role_counts.get("ambient", 0) + role_counts.get("hero", 0)) >= 1)
    content_ready = bool(has_description and role_counts.get("hero", 0) >= 1)
    return spec_ready, academy_ready, content_ready


# ─── Phase 1.5 · Vision Layer 2 batch helper ──────────────────────────
VISION_CONCURRENCY = 5


def _run_vision_batch(candidate_records: List[Dict[str, Any]]) -> Tuple[int, int]:
    """Synchronously dispatch Vision Layer 2 calls on every candidate in
    parallel batches. Mutates each record's `classification` dict in-place
    with vision_* keys.

    Returns (ok_count, failed_count).
    """
    sem = asyncio.Semaphore(VISION_CONCURRENCY)

    async def _one(rec: Dict[str, Any]) -> bool:
        async with sem:
            try:
                ext = rec.get("image_ext") or "jpg"
                mime = "image/png" if ext == "png" else "image/jpeg"
                r = await vision_asset_classifier.enrich_asset_bytes(
                    rec["image_bytes"], media_id=rec["key"], mime=mime,
                )
            except Exception as e:
                logger.warning(f"vision batch error on {rec['key']}: {e}")
                return False
            if not r or not r.get("ok") or not r.get("enrichment"):
                return False
            base = rec["classification"] or {}
            merged = vision_asset_classifier.merge_enrichment_into_meta(
                base, r["enrichment"],
                rule_confidence=float(base.get("classification_confidence") or 0.5),
            )
            # ALWAYS adopt Vision verdict for asset_type/comp_role/view_angle
            # when Vision was conclusive (Phase 1.5 always-on policy).
            if r["enrichment"].get("vision_asset_type"):
                merged["asset_type"] = r["enrichment"]["vision_asset_type"]
                merged["compositional_role"] = (
                    r["enrichment"].get("vision_compositional_role")
                    or merged.get("compositional_role")
                )
                merged["view_angle"] = (
                    r["enrichment"].get("vision_view_angle")
                    or merged.get("view_angle")
                )
                merged["classified_by"] = "vision"
                merged["classification_confidence"] = round(
                    max(float(base.get("classification_confidence") or 0.5), 0.70), 3
                )
            rec["classification"] = merged
            return True

    async def _all():
        results = await asyncio.gather(*[_one(r) for r in candidate_records],
                                       return_exceptions=False)
        return sum(1 for r in results if r), sum(1 for r in results if not r)

    try:
        # Prefer running in a fresh event loop; this function is called from
        # a sync context (FastAPI BackgroundTask or validation script).
        try:
            loop = asyncio.new_event_loop()
            try:
                asyncio.set_event_loop(loop)
                return loop.run_until_complete(_all())
            finally:
                loop.close()
        except RuntimeError:
            # Already inside an event loop (rare here) — best-effort fallback
            return asyncio.run(_all())
    except Exception as e:
        logger.warning(f"vision batch fatal: {e}")
        return 0, len(candidate_records)


def _knowledge_object_flags_unused(
    has_designer: bool,
    has_materials: bool,
    has_dimensions: bool,
    has_description: bool,
    role_counts: Dict[str, int],
) -> Tuple[bool, bool, bool]:
    """Deprecated stub kept for backwards-import safety."""
    return _knowledge_object_flags(has_designer, has_materials,
                                    has_dimensions, has_description, role_counts)


# ─── Public API ───────────────────────────────────────────────────────
def compose_products_from_pdf(
    *,
    pdf_bytes: bytes,
    source_document_id: str,
    tenant_id: str,
    brand_id: Optional[str],
    db_client: Any,
    asset_uploader: Callable[[bytes, str], Tuple[Optional[str], Optional[str]]],
    max_candidates: int = 240,
    log_step: Optional[Callable[[str, Dict[str, Any]], None]] = None,
) -> Dict[str, Any]:
    """Run the full Product Composer pipeline.

    `asset_uploader(image_bytes, suggested_filename)` MUST return
    (public_url, media_library_id) or (None, None) on failure.

    `log_step(step_name, payload)` is the audit-log streaming hook.
    """
    def _log(step: str, payload: Optional[Dict[str, Any]] = None):
        entry = {"step": step, "at": _now(), **(payload or {})}
        if log_step:
            try:
                log_step(step, payload or {})
            except Exception:
                pass
        logger.info(f"[product_composer] {step}: {payload or {}}")
        return entry

    products_created: List[str] = []
    section_rows_created: List[str] = []
    assets_assigned = 0
    metrics_running: Dict[str, Any] = {}

    # ── Step 2 · section detection ──────────────────────────────────
    _log("section_detection_start")
    detection = section_detector.detect_sections(pdf_bytes)
    sections = detection["sections"]
    _log("section_detection_done", {"section_count": len(sections),
                                     "toc_entries": detection["toc_entries"]})

    # Persist sections (idempotency: clear previous sections for this doc)
    db_client.table("product_sections").delete().eq("source_document_id", source_document_id).execute()
    for sec in sections:
        sec_id = str(uuid.uuid4())
        sec["_db_id"] = sec_id
        db_client.table("product_sections").insert({
            "id": sec_id,
            "tenant_id": tenant_id,
            "source_document_id": source_document_id,
            "section_index": sec["section_index"],
            "start_page": sec["start_page"],
            "end_page": sec["end_page"],
            "detected_title": sec.get("detected_title"),
            "detected_designer": sec.get("detected_designer"),
            "detected_category": sec.get("detected_category"),
            "raw_text": (sec.get("raw_text") or "")[:50000],
            "confidence_score": sec.get("confidence_score") or 0.40,
        }).execute()
        section_rows_created.append(sec_id)

    # ── Step 3 · image extraction (existing module) ─────────────────
    _log("image_extraction_start")
    extract_result = catalog_extractor.extract_candidates(
        pdf_bytes, brand="unknown", max_candidates=max_candidates,
    )
    raw_candidates = extract_result.get("_raw_candidates", [])
    _log("image_extraction_done", {"candidates": len(raw_candidates),
                                    "warnings": extract_result.get("warnings", [])})

    # ── Step 4 · classify + phash ──────────────────────────────────
    _log("image_classification_start")
    candidate_records: List[Dict[str, Any]] = []
    for idx, cand in enumerate(raw_candidates):
        # Layer 1 rule classification (deterministic)
        classification = asset_classifier.classify_asset(
            cand.image_bytes,
            width=cand.width,
            height=cand.height,
            ordinal_in_group=cand.asset_index_in_page,
            page_position=cand.page_position,
        )
        phash = image_dedup.compute_phash(cand.image_bytes)
        candidate_records.append({
            "key": f"cand_{idx}",
            "page_number": cand.page_number,
            "image_bytes": cand.image_bytes,
            "image_ext": cand.image_ext,
            "width": cand.width,
            "height": cand.height,
            "classification": classification,
            "asset_index_in_page": cand.asset_index_in_page,
            "phash": phash,
        })
    _log("image_classification_done", {"classified": len(candidate_records)})

    # ── Step 4.5 · Phase 1.5 · Vision Layer 2 always-on ──
    # Run vision classification on every asset in parallel batches.
    # Each call costs ~2-3s; we cap concurrency at 5 to avoid LLM rate
    # limits. Disabled when EMERGENT_LLM_KEY is missing or
    # vision_enabled flag is False (set by `compose_products_from_pdf`
    # caller via env var ITER189_DISABLE_VISION=1 for offline tests).
    vision_disabled = (os.environ.get("ITER189_DISABLE_VISION") or "0").strip() not in ("0", "", "false", "False")
    has_key = bool(os.environ.get("EMERGENT_LLM_KEY"))
    if candidate_records and has_key and not vision_disabled:
        _log("vision_layer2_start", {"assets": len(candidate_records)})
        vision_ok, vision_failed = _run_vision_batch(candidate_records)
        _log("vision_layer2_done", {"enriched": vision_ok, "failed": vision_failed})
    else:
        _log("vision_layer2_skipped",
             {"has_key": has_key, "disabled": vision_disabled})

    # ── Step 5 · dedup grouping ─────────────────────────────────────
    sim_groups = image_dedup.group_by_similarity(candidate_records)
    distinct_groups = len(set(sim_groups.values()))
    _log("dedup_done", {"distinct_groups": distinct_groups,
                         "total_candidates": len(candidate_records)})

    # ── Step 5.b · assign images to sections by page_number ─────────
    # Pre-compute: section index by start..end
    def _find_section(pno: int) -> Optional[Dict[str, Any]]:
        for s in sections:
            if s["start_page"] <= pno <= s["end_page"]:
                return s
        return None

    # Track de-duplication intra-section: only keep one asset per
    # (section, similarity_group) — the first one (largest, since
    # candidates are pre-sorted).
    sec_dedup_seen: Dict[str, set] = {}

    section_to_assets: Dict[str, List[Dict[str, Any]]] = {}
    for rec in candidate_records:
        sec = _find_section(rec["page_number"])
        if not sec:
            continue
        sec_id = sec["_db_id"]
        gkey = sim_groups.get(rec["key"], rec["key"])
        seen = sec_dedup_seen.setdefault(sec_id, set())
        if gkey in seen:
            # Skip duplicate inside same section — but we'll keep the
            # original group key on the survivor.
            continue
        seen.add(gkey)
        rec["similarity_group"] = gkey
        section_to_assets.setdefault(sec_id, []).append(rec)

    _log("section_assignment_done", {
        "sections_with_assets": len(section_to_assets),
        "assets_kept_after_dedup": sum(len(v) for v in section_to_assets.values()),
    })

    # ── Step 6+7 · parse text + compose products ────────────────────
    _log("product_composition_start")
    total_dim_hit = 0
    total_mat_hit = 0
    total_desc_hit = 0
    total_conf = 0.0

    for sec in sections:
        sec_id = sec["_db_id"]
        assets = section_to_assets.get(sec_id, [])
        # Don't create products without any image
        if not assets and not sec.get("detected_title"):
            continue

        parsed = section_text_parser.parse_section_text(sec.get("raw_text") or "")

        # Compose product name
        name = sec.get("detected_title") or f"Untitled {sec['section_index']}"
        slug = f"{_slugify(name)}-{sec_id[:8]}"

        # Upload assets that pass dedup → media_library
        product_id = str(uuid.uuid4())
        uploaded_assets: List[Dict[str, Any]] = []
        role_counts: Dict[str, int] = {}
        primary_marked = False
        for sort_order, rec in enumerate(assets):
            classification = rec["classification"]
            role = _classification_to_role(classification)
            filename = f"{slug}-p{rec['page_number']}-i{rec['asset_index_in_page']}.{rec['image_ext']}"
            try:
                public_url, media_id = asset_uploader(rec["image_bytes"], filename)
            except Exception as e:
                _log("asset_upload_failed", {"error": str(e), "filename": filename})
                public_url, media_id = None, None
            if not media_id:
                continue
            is_primary = (role == "hero" and not primary_marked) or \
                         (sort_order == 0 and not primary_marked and role in ("hero", "ambient", "still_life"))
            if is_primary:
                primary_marked = True
            uploaded_assets.append({
                "media_id": media_id,
                "role": role,
                "page_number": rec["page_number"],
                "phash": rec.get("phash"),
                "similarity_group": rec.get("similarity_group"),
                "classification": classification,
                "is_primary": is_primary,
                "sort_order": sort_order,
                "public_url": public_url,
            })
            role_counts[role] = role_counts.get(role, 0) + 1

        if not uploaded_assets:
            # Section produced no usable asset — skip product creation
            continue

        # Pages span
        source_pages = sorted({a["page_number"] for a in uploaded_assets})

        # Knowledge Object readiness flags
        has_designer = bool(sec.get("detected_designer"))
        has_materials = bool(parsed["materials"])
        has_dims = bool(parsed["dimensions_raw"])
        has_desc = bool(parsed["description"] and len(parsed["description"]) > 80)
        spec_ready, academy_ready, content_ready = _knowledge_object_flags(
            has_designer, has_materials, has_dims, has_desc, role_counts
        )

        # Composite confidence
        section_conf = float(sec.get("confidence_score") or 0.40)
        field_conf = parsed["field_confidence"]
        composite = (
            section_conf * 0.35 +
            field_conf.get("materials", 0.0) * 0.15 +
            field_conf.get("dimensions", 0.0) * 0.20 +
            field_conf.get("description", 0.0) * 0.15 +
            min(1.0, len(uploaded_assets) / 4.0) * 0.15
        )
        composite = round(min(0.99, max(0.10, composite)), 3)

        product_row = {
            "id": product_id,
            "tenant_id": tenant_id,
            "brand_id": brand_id,
            "source_document_id": source_document_id,
            "source_section_id": sec_id,
            "product_name": name,
            "slug": slug,
            "category_label": sec.get("detected_category"),
            "designer_name": sec.get("detected_designer"),
            "description": parsed["description"],
            "description_i18n": parsed["description_i18n"],
            "materials": parsed["materials"],
            "finishes": parsed["finishes"],
            "dimensions_raw": parsed["dimensions_raw"],
            "dimensions_structured": parsed["dimensions_structured"],
            "applications": parsed["applications"],
            "source_pages": source_pages,
            # Knowledge Object seeds (Phase 1: defaults empty)
            "usage_contexts": parsed["applications"],
            "suggested_applications": [],
            "mood_tags": [],
            "market_tags": [],
            "spec_ready": spec_ready,
            "academy_ready": academy_ready,
            "content_ready": content_ready,
            "confidence_score": composite,
            "review_status": "draft",
            "metadata_json": {
                "section_index": sec["section_index"],
                "asset_role_counts": role_counts,
                "field_confidence": field_conf,
                "section_confidence": section_conf,
            },
            "created_at": _now(),
            "updated_at": _now(),
        }
        try:
            db_client.table("products").insert(product_row).execute()
        except Exception as e:
            _log("product_insert_failed", {"error": str(e), "section_index": sec["section_index"]})
            continue
        products_created.append(product_id)

        # Insert product_assets rows
        for asset_meta in uploaded_assets:
            pa_row = {
                "id": str(uuid.uuid4()),
                "product_id": product_id,
                "asset_id": asset_meta["media_id"],
                "role": asset_meta["role"],
                "page_number": asset_meta["page_number"],
                "source_document_id": source_document_id,
                "confidence_score": asset_meta["classification"].get("classification_confidence"),
                "is_primary": asset_meta["is_primary"],
                "sort_order": asset_meta["sort_order"],
                "similarity_group": asset_meta.get("similarity_group"),
                "phash": asset_meta.get("phash"),
                "metadata_json": {
                    "asset_type": asset_meta["classification"].get("asset_type"),
                    "compositional_role": asset_meta["classification"].get("compositional_role"),
                    "view_angle": asset_meta["classification"].get("view_angle"),
                    "editorial_score": asset_meta["classification"].get("editorial_score"),
                    "public_url": asset_meta.get("public_url"),
                },
            }
            try:
                db_client.table("product_assets").insert(pa_row).execute()
                assets_assigned += 1
            except Exception as e:
                _log("product_asset_insert_failed", {"error": str(e), "product_id": product_id})

        # Update section ↔ product cross-link
        try:
            db_client.table("product_sections").update({"product_id": product_id}).eq("id", sec_id).execute()
        except Exception:
            pass

        # Running metrics
        if has_dims:
            total_dim_hit += 1
        if has_materials:
            total_mat_hit += 1
        if has_desc:
            total_desc_hit += 1
        total_conf += composite

    n = max(1, len(products_created))
    metrics_running = {
        "products_created": len(products_created),
        "sections_detected": len(sections),
        "assets_assigned": assets_assigned,
        "dedup_groups": distinct_groups,
        "dimensions_hit_pct": round(100.0 * total_dim_hit / n, 1) if products_created else 0.0,
        "materials_hit_pct":  round(100.0 * total_mat_hit / n, 1) if products_created else 0.0,
        "descriptions_hit_pct": round(100.0 * total_desc_hit / n, 1) if products_created else 0.0,
        "avg_confidence": round(total_conf / n, 3) if products_created else 0.0,
    }
    _log("product_composition_done", metrics_running)

    return {
        "products_created": products_created,
        "section_rows": section_rows_created,
        "assets_assigned": assets_assigned,
        "dedup_groups": distinct_groups,
        "metrics": metrics_running,
        "warnings": extract_result.get("warnings", []),
    }
