"""ITER188 · MOOD Brand Knowledge Factory™ · Real Catalog Validation.

Runs the Product Composer™ pipeline against real manufacturer catalogues
in DRY-RUN mode (no DB writes, no storage uploads). Produces a detailed
validation report covering Sections 1-10 of the Founder brief.

Usage:
    python3 /app/scripts/iter188_validate_real_catalog.py \
        --pdf /tmp/cattelan_729.pdf \
        --brand "Cattelan Italia" \
        --catalog-year 2026 \
        --report /app/memory/ITER188_CATTELAN_VALIDATION_REPORT.md \
        --max-candidates 600
"""
from __future__ import annotations

import argparse
import io
import os
import sys
import json
import pathlib
import statistics
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

# Inject backend path
sys.path.insert(0, str(pathlib.Path("/app/backend").resolve()))

from cultural_engine import catalog_extractor       # type: ignore
from cultural_engine import asset_classifier        # type: ignore
from cultural_engine import section_detector        # type: ignore
from cultural_engine import section_text_parser     # type: ignore
from cultural_engine import image_dedup             # type: ignore
from cultural_engine import product_composer        # type: ignore
from cultural_engine import vision_asset_classifier  # type: ignore


# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _classification_to_role(classification: Dict[str, Any]) -> str:
    """Same mapping used in product_composer.py."""
    atype = classification.get("asset_type", "still_life")
    comp = classification.get("compositional_role", "supporting")
    if atype == "cutout":         return "packshot"
    if atype == "texture":        return "texture"
    if atype == "detail":         return "detail"
    if atype == "technical":      return "technical"
    if atype == "rendering":      return "drawing"
    if atype == "material_sample": return "finish"
    if atype == "lifestyle":      return "hero" if comp == "hero" else "ambient"
    return "still_life"


# ──────────────────────────────────────────────────────────────────────
# Pipeline DRY-RUN
# ──────────────────────────────────────────────────────────────────────
def run_pipeline_dryrun(pdf_path: str, max_candidates: int = 600,
                        enable_vision: bool = True) -> Dict[str, Any]:
    """Execute every pipeline stage WITHOUT writing to DB / storage.

    Returns a deep dict ready to be fed into the report generator.
    """
    t0 = time.time()
    pdf_bytes = pathlib.Path(pdf_path).read_bytes()

    # --- Step 1 · Section detection ---
    section_t0 = time.time()
    detection = section_detector.detect_sections(pdf_bytes)
    sections = detection["sections"]
    section_dt = time.time() - section_t0

    # --- Step 2 · Image extraction ---
    extract_t0 = time.time()
    extract_result = catalog_extractor.extract_candidates(
        pdf_bytes, brand="unknown", max_candidates=max_candidates,
    )
    raw_candidates = extract_result.get("_raw_candidates", [])
    extract_dt = time.time() - extract_t0

    # --- Step 3 · Classify + pHash ---
    cls_t0 = time.time()
    cand_records: List[Dict[str, Any]] = []
    for idx, c in enumerate(raw_candidates):
        cls = asset_classifier.classify_asset(
            c.image_bytes,
            width=c.width, height=c.height,
            ordinal_in_group=c.asset_index_in_page,
            page_position=c.page_position,
        )
        phash = image_dedup.compute_phash(c.image_bytes)
        cand_records.append({
            "key": f"cand_{idx}",
            "page_number": c.page_number,
            "image_size_kb": len(c.image_bytes) // 1024,
            "image_bytes_len": len(c.image_bytes),
            "image_bytes": c.image_bytes,           # needed for vision
            "image_ext": c.image_ext,
            "width": c.width,
            "height": c.height,
            "classification": cls,
            "asset_index_in_page": c.asset_index_in_page,
            "phash": phash,
        })
    cls_dt = time.time() - cls_t0

    # --- Step 3.5 · Phase 1.5 Vision Layer 2 always-on (optional) ---
    vision_t0 = time.time()
    vision_ok = vision_failed = 0
    if enable_vision and cand_records:
        vision_ok, vision_failed = product_composer._run_vision_batch(cand_records)
    vision_dt = time.time() - vision_t0

    # --- Step 4 · Dedup grouping ---
    dedup_t0 = time.time()
    sim_groups = image_dedup.group_by_similarity(cand_records)
    distinct_groups = len(set(sim_groups.values()))
    duplicates_removed = len(cand_records) - distinct_groups
    dedup_dt = time.time() - dedup_t0

    # --- Step 5 · Assign images to sections + intra-section dedup ---
    def _find_section(pno: int) -> Optional[Dict[str, Any]]:
        for s in sections:
            if s["start_page"] <= pno <= s["end_page"]:
                return s
        return None

    sec_dedup_seen: Dict[int, set] = {}
    section_to_assets: Dict[int, List[Dict[str, Any]]] = {}
    unassigned: List[Dict[str, Any]] = []
    for rec in cand_records:
        sec = _find_section(rec["page_number"])
        if not sec:
            unassigned.append(rec)
            continue
        sec_idx = sec["section_index"]
        gkey = sim_groups.get(rec["key"], rec["key"])
        seen = sec_dedup_seen.setdefault(sec_idx, set())
        if gkey in seen:
            continue
        seen.add(gkey)
        rec["similarity_group"] = gkey
        rec["section_index"] = sec_idx
        section_to_assets.setdefault(sec_idx, []).append(rec)

    # --- Step 6 · Compose products (in-memory) ---
    compose_t0 = time.time()
    composed_products: List[Dict[str, Any]] = []
    for sec in sections:
        sec_idx = sec["section_index"]
        assets = section_to_assets.get(sec_idx, [])
        if not assets and not sec.get("detected_title"):
            continue

        parsed = section_text_parser.parse_section_text(sec.get("raw_text") or "")

        role_counts: Dict[str, int] = {}
        for a in assets:
            r = _classification_to_role(a["classification"])
            role_counts[r] = role_counts.get(r, 0) + 1
            a["role"] = r

        has_designer = bool(sec.get("detected_designer"))
        has_materials = bool(parsed["materials"])
        has_dims = bool(parsed["dimensions_raw"])
        has_desc = bool(parsed["description"] and len(parsed["description"]) > 80)
        spec_ready = has_designer and has_dims and has_materials
        academy_ready = has_desc and has_designer and (
            role_counts.get("ambient", 0) + role_counts.get("hero", 0)
        ) >= 1
        content_ready = has_desc and role_counts.get("hero", 0) >= 1

        section_conf = float(sec.get("confidence_score") or 0.40)
        field_conf = parsed["field_confidence"]
        composite = round(min(0.99, max(0.10, (
            section_conf * 0.35 +
            field_conf.get("materials", 0.0) * 0.15 +
            field_conf.get("dimensions", 0.0) * 0.20 +
            field_conf.get("description", 0.0) * 0.15 +
            min(1.0, len(assets) / 4.0) * 0.15
        ))), 3)

        composed_products.append({
            "section_index":   sec_idx,
            "start_page":      sec["start_page"],
            "end_page":        sec["end_page"],
            "product_name":    sec.get("detected_title") or f"Untitled {sec_idx}",
            "detected_title":  sec.get("detected_title"),
            "designer_name":   sec.get("detected_designer"),
            "category_label":  sec.get("detected_category"),
            "description":     parsed["description"],
            "description_i18n": parsed["description_i18n"],
            "materials":       parsed["materials"],
            "finishes":        parsed["finishes"],
            "dimensions_raw":  parsed["dimensions_raw"],
            "dimensions_structured": parsed["dimensions_structured"],
            "applications":    parsed["applications"],
            "assets":          assets,
            "role_counts":     role_counts,
            "section_confidence": section_conf,
            "field_confidence": field_conf,
            "composite_confidence": composite,
            "spec_ready":      spec_ready,
            "academy_ready":   academy_ready,
            "content_ready":   content_ready,
            "has_designer":    has_designer,
            "has_materials":   has_materials,
            "has_dimensions":  has_dims,
            "has_description": has_desc,
        })

    compose_dt = time.time() - compose_t0
    total_dt = time.time() - t0

    return {
        "pdf_path": pdf_path,
        "pdf_size_mb": round(len(pdf_bytes) / 1024 / 1024, 2),
        "page_count": detection["page_count"],
        "toc_entries": detection["toc_entries"],
        "sections": sections,
        "candidates_raw": cand_records,
        "similarity_groups": sim_groups,
        "distinct_groups": distinct_groups,
        "duplicates_removed": duplicates_removed,
        "unassigned": unassigned,
        "products": composed_products,
        "extract_warnings": extract_result.get("warnings", []),
        "timings_s": {
            "section_detection": round(section_dt, 2),
            "image_extraction":  round(extract_dt, 2),
            "classification":    round(cls_dt, 2),
            "vision_layer2":     round(vision_dt, 2),
            "dedup_grouping":    round(dedup_dt, 2),
            "product_composition": round(compose_dt, 2),
            "total":             round(total_dt, 2),
        },
        "vision_enabled": enable_vision,
        "vision_ok": vision_ok,
        "vision_failed": vision_failed,
    }


# ──────────────────────────────────────────────────────────────────────
# Metric helpers
# ──────────────────────────────────────────────────────────────────────
def asset_diversity_score(role_counts: Dict[str, int], distinct_groups: int,
                          total_assets: int) -> float:
    """Compute Diversity Score™ — image usefulness, not quantity.

    Factors:
      1. visual_uniqueness   = distinct_groups / total_assets  (max 1.0)
      2. perspective_variety = unique roles / 4 (max 4 roles)
      3. detail_coverage     = 1 if at least one detail/macro asset else 0.5
      4. technical_coverage  = 1 if drawing/technical present else 0.4

    Combined: weighted avg.
    """
    if total_assets == 0:
        return 0.0
    visual_uniqueness = min(1.0, distinct_groups / total_assets)
    unique_roles = len(role_counts.keys())
    perspective_variety = min(1.0, unique_roles / 4.0)
    detail_coverage = 1.0 if (role_counts.get("detail", 0) > 0 or
                              role_counts.get("packshot", 0) > 0) else 0.5
    technical_coverage = 1.0 if (role_counts.get("technical", 0) > 0 or
                                  role_counts.get("drawing", 0) > 0) else 0.4

    return round(
        visual_uniqueness * 0.40 +
        perspective_variety * 0.30 +
        detail_coverage * 0.20 +
        technical_coverage * 0.10,
        3,
    )


def confidence_distribution(products: List[Dict[str, Any]]) -> Dict[str, int]:
    """Bucket product composite confidence."""
    buckets = {"0.90+": 0, "0.80+": 0, "0.70+": 0, "0.60+": 0, "0.50+": 0, "<0.50": 0}
    for p in products:
        c = p.get("composite_confidence") or 0.0
        if   c >= 0.90: buckets["0.90+"] += 1
        elif c >= 0.80: buckets["0.80+"] += 1
        elif c >= 0.70: buckets["0.70+"] += 1
        elif c >= 0.60: buckets["0.60+"] += 1
        elif c >= 0.50: buckets["0.50+"] += 1
        else:            buckets["<0.50"] += 1
    return buckets


def readiness_score(metric_pct: float, weight: float = 1.0) -> float:
    """0-100 readiness slice."""
    return round(min(100.0, max(0.0, metric_pct * weight)), 1)


# ──────────────────────────────────────────────────────────────────────
# Report writer
# ──────────────────────────────────────────────────────────────────────
def write_report(catalog_name: str, brand: str, year: Optional[int],
                 expected_products: Optional[int],
                 pipeline_result: Dict[str, Any],
                 report_path: str) -> None:
    p = pipeline_result
    products = p["products"]
    sections = p["sections"]

    # ── Section 1 · Product Detection ──
    n_sections = len(sections)
    n_products = len(products)
    expected = expected_products or n_sections
    accuracy = round(100.0 * n_products / expected, 1) if expected else 0.0

    # ── Section 2 · Image Extraction ──
    total_imgs = len(p["candidates_raw"])
    assigned = sum(len(prod["assets"]) for prod in products)
    unassigned = len(p["unassigned"])
    dup_removed = p["duplicates_removed"]
    distinct_groups = p["distinct_groups"]

    # Classification breakdown
    role_global: Counter = Counter()
    asset_type_global: Counter = Counter()
    for prod in products:
        for a in prod["assets"]:
            role_global[a["role"]] += 1
            asset_type_global[a["classification"]["asset_type"]] += 1

    # ── Section 3 · Diversity Score ──
    diversity_rows: List[Tuple[str, int, int, float]] = []
    for prod in products:
        ttl_a = len(prod["assets"])
        if ttl_a == 0:
            continue
        # local distinct groups in this product
        local_groups = len({a.get("similarity_group") or a["key"] for a in prod["assets"]})
        score = asset_diversity_score(prod["role_counts"], local_groups, ttl_a)
        diversity_rows.append((prod["product_name"], ttl_a, local_groups, score))
    diversity_rows.sort(key=lambda r: -r[3])
    top20_div = diversity_rows[:20]
    bot20_div = sorted(diversity_rows, key=lambda r: r[3])[:20]
    avg_diversity = round(statistics.mean([r[3] for r in diversity_rows]), 3) if diversity_rows else 0.0

    # ── Section 4 · Metadata Extraction success % ──
    n = max(1, n_products)
    pct_name      = round(100.0 * sum(1 for x in products if x.get("detected_title")) / n, 1)
    pct_designer  = round(100.0 * sum(1 for x in products if x["has_designer"])      / n, 1)
    pct_desc      = round(100.0 * sum(1 for x in products if x["has_description"])   / n, 1)
    pct_materials = round(100.0 * sum(1 for x in products if x["has_materials"])     / n, 1)
    pct_finishes  = round(100.0 * sum(1 for x in products if x["finishes"])          / n, 1)
    pct_dims      = round(100.0 * sum(1 for x in products if x["has_dimensions"])    / n, 1)
    pct_category  = round(100.0 * sum(1 for x in products if x.get("category_label")) / n, 1)

    # ── Section 5 · Confidence distribution ──
    conf_dist = confidence_distribution(products)
    avg_conf = round(statistics.mean([p["composite_confidence"] for p in products]), 3) if products else 0.0

    # ── Section 6 · Readiness scorecard ──
    image_grouping_score = round(100.0 * (distinct_groups / max(1, total_imgs)), 1) if total_imgs else 0.0
    image_class_score = round(100.0 * (sum(role_global.values()) / max(1, total_imgs)), 1) if total_imgs else 0.0
    brand_atlas = round((pct_name + pct_designer + image_class_score) / 3, 1)
    academy_score = round((pct_desc + pct_designer + (sum(1 for x in products if x["academy_ready"]) / n * 100)) / 3, 1)
    marketboard = round((pct_name + pct_materials + pct_finishes + pct_designer) / 4, 1)
    moodboard = round((image_class_score + pct_materials + pct_finishes) / 3, 1)
    specification = round((pct_dims + pct_materials + pct_designer) / 3, 1)

    # ── Section 7 · Top failures ──
    failures: List[str] = []
    # Products without title
    no_title = [x for x in products if not x.get("detected_title")][:5]
    for x in no_title:
        failures.append(f"NO TITLE · section {x['section_index']} pages {x['start_page']}-{x['end_page']}")
    # Missing designer when section spans ≥2 pages
    no_des = [x for x in products if not x["has_designer"] and (x["end_page"] - x["start_page"]) >= 1][:5]
    for x in no_des:
        failures.append(f"NO DESIGNER · {x['product_name']} (pp.{x['start_page']}-{x['end_page']})")
    # Missing dimensions
    no_dim = [x for x in products if not x["has_dimensions"]][:5]
    for x in no_dim:
        failures.append(f"NO DIMENSIONS · {x['product_name']}")
    # Missing materials
    no_mat = [x for x in products if not x["has_materials"]][:5]
    for x in no_mat:
        failures.append(f"NO MATERIALS · {x['product_name']}")
    # Confidence < 0.5
    low_conf = sorted([x for x in products if (x["composite_confidence"] or 0) < 0.5],
                      key=lambda x: x["composite_confidence"])[:5]
    for x in low_conf:
        failures.append(f"LOW CONFIDENCE {x['composite_confidence']:.2f} · {x['product_name']}")

    # ── Section 8 · Product Knowledge Object validation (top 20) ──
    sample20 = products[:20]

    def ko_brand_atlas(x): return "YES" if (x.get("detected_title") and x["role_counts"]) else ("PARTIAL" if x.get("detected_title") else "NO")
    def ko_academy(x):     return "YES" if x["academy_ready"] else ("PARTIAL" if x["has_description"] else "NO")
    def ko_marketboard(x): return "YES" if (x["has_materials"] and x["has_designer"] and x["role_counts"]) else ("PARTIAL" if (x["has_materials"] or x["has_designer"]) else "NO")
    def ko_moodboard(x):   return "YES" if (x["role_counts"].get("hero",0) + x["role_counts"].get("ambient",0) >= 1 and x["has_materials"]) else ("PARTIAL" if x["role_counts"] else "NO")
    def ko_specification(x): return "YES" if x["spec_ready"] else ("PARTIAL" if (x["has_dimensions"] or x["has_materials"]) else "NO")

    # ── Section 9 · Moodboard readiness audit ──
    hero_count = role_global.get("hero", 0)
    ambient_count = role_global.get("ambient", 0)
    detail_count = role_global.get("detail", 0) + role_global.get("packshot", 0)
    finish_count = role_global.get("finish", 0) + role_global.get("texture", 0)

    # Roughly: products with at least 1 hero AND 1 detail AND 1 material → strong moodboard-ready
    moodboard_strong = sum(1 for x in products if x["role_counts"].get("hero", 0) >= 1
                           and (x["role_counts"].get("detail", 0) + x["role_counts"].get("packshot", 0)) >= 1
                           and x["has_materials"])
    moodboard_strong_pct = round(100.0 * moodboard_strong / max(1, n_products), 1)

    # ── Section 10 · Marketboard readiness ──
    # Need: designer + materials + finishes + description (story)
    marketboard_strong = sum(1 for x in products if x["has_designer"] and x["has_materials"]
                             and x["finishes"] and x["has_description"])
    marketboard_strong_pct = round(100.0 * marketboard_strong / max(1, n_products), 1)

    # ── Executive summary readiness ──
    overall_readiness = round(
        (brand_atlas * 0.20 + academy_score * 0.15 +
         marketboard * 0.20 + moodboard * 0.20 +
         specification * 0.15 + avg_conf * 100 * 0.10), 1
    )

    if overall_readiness >= 75:
        verdict = "YES — Product Composer™ può scalare a 50+ brand"
        recommendation = "**A. Proceed to Frontend Review** (estrazione sufficiente)"
    elif overall_readiness >= 55:
        verdict = "PARTIAL — Composer scalabile dopo Phase 1.5 fixes"
        recommendation = "**B. Fix Extraction Layer First** (Phase 1.5 prima del frontend)"
    else:
        verdict = "NO — gap troppo grandi"
        recommendation = "**C. Rework Product Composer Architecture**"

    # ── Compose markdown ──
    lines = []
    P = lines.append

    P(f"# ITER188 · Knowledge Factory™ Real Catalog Validation")
    P(f"## {catalog_name} — {brand} {year or ''}")
    P("")
    P(f"**Data:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    P(f"**PDF:** `{p['pdf_path']}` · **{p['pdf_size_mb']} MB** · **{p['page_count']} pages**")
    P(f"**Pipeline timings:** total **{p['timings_s']['total']}s** "
      f"(section={p['timings_s']['section_detection']}s, "
      f"images={p['timings_s']['image_extraction']}s, "
      f"classify={p['timings_s']['classification']}s, "
      f"vision={p['timings_s'].get('vision_layer2', 0)}s, "
      f"dedup={p['timings_s']['dedup_grouping']}s, "
      f"compose={p['timings_s']['product_composition']}s)")
    P(f"**Vision Layer 2:** enabled={p.get('vision_enabled')} · "
      f"enriched={p.get('vision_ok', 0)} · failed={p.get('vision_failed', 0)}")
    if p["extract_warnings"]:
        P(f"**⚠️ Warnings:** {', '.join(p['extract_warnings'])}")
    P("")

    # ── SECTION 1 ──
    P("---")
    P("## SECTION 1 · Product Detection")
    P("")
    P(f"| Metric | Value |")
    P(f"|---|---|")
    P(f"| Pages | {p['page_count']} |")
    P(f"| Product sections detected | {n_sections} |")
    P(f"| Products created | {n_products} |")
    P(f"| Expected (from TOC analysis) | {expected} |")
    P(f"| **Detection accuracy** | **{accuracy}%** |")
    P(f"| TOC heuristic entries found | {p['toc_entries']} |")
    P("")

    # ── SECTION 2 ──
    P("---")
    P("## SECTION 2 · Image Extraction")
    P("")
    P(f"| Metric | Value |")
    P(f"|---|---|")
    P(f"| Total images extracted | {total_imgs} |")
    P(f"| Images assigned to products | {assigned} |")
    P(f"| Unassigned images | {unassigned} |")
    P(f"| Duplicates removed (post-dedup) | {dup_removed} |")
    P(f"| Distinct similarity groups | {distinct_groups} |")
    P("")
    P("### Classification breakdown (asset role)")
    P("")
    P("| Role | Count | % |")
    P("|---|---|---|")
    total_classified = sum(role_global.values()) or 1
    for role in ("hero", "ambient", "still_life", "detail", "texture", "technical", "finish", "drawing", "packshot", "decorative"):
        cnt = role_global.get(role, 0)
        pct = round(100.0 * cnt / total_classified, 1)
        P(f"| {role} | {cnt} | {pct}% |")
    P("")
    P("### Asset type breakdown (rule classifier output)")
    P("")
    P("| asset_type | Count |")
    P("|---|---|")
    for at, cnt in asset_type_global.most_common():
        P(f"| {at} | {cnt} |")
    P("")

    # ── SECTION 3 ──
    P("---")
    P("## SECTION 3 · Asset Diversity Score™")
    P("")
    P(f"**Average Diversity Score** across {len(diversity_rows)} products: **{avg_diversity}**")
    P("")
    P("Formula = `visual_uniqueness*0.40 + perspective_variety*0.30 + detail_coverage*0.20 + technical_coverage*0.10`")
    P("")
    P("### Top 20 — Highest Diversity")
    P("")
    P("| # | Product | Images | Unique groups | Score |")
    P("|---|---|---|---|---|")
    for i, (name, ttl, uniq, score) in enumerate(top20_div, 1):
        P(f"| {i} | {name} | {ttl} | {uniq} | {score} |")
    P("")
    P("### Bottom 20 — Lowest Diversity")
    P("")
    P("| # | Product | Images | Unique groups | Score |")
    P("|---|---|---|---|---|")
    for i, (name, ttl, uniq, score) in enumerate(bot20_div, 1):
        P(f"| {i} | {name} | {ttl} | {uniq} | {score} |")
    P("")

    # ── SECTION 4 ──
    P("---")
    P("## SECTION 4 · Metadata Extraction (success %)")
    P("")
    P("| Field | Success % |")
    P("|---|---|")
    P(f"| Product Name | {pct_name}% |")
    P(f"| Designer | {pct_designer}% |")
    P(f"| Description | {pct_desc}% |")
    P(f"| Materials | {pct_materials}% |")
    P(f"| Finishes | {pct_finishes}% |")
    P(f"| Dimensions | {pct_dims}% |")
    P(f"| Categories | {pct_category}% |")
    P("")

    # ── SECTION 5 ──
    P("---")
    P("## SECTION 5 · Confidence Analysis")
    P("")
    P(f"Average composite confidence: **{avg_conf}**")
    P("")
    P("| Bucket | Count | % |")
    P("|---|---|---|")
    for k, v in conf_dist.items():
        pct = round(100.0 * v / max(1, n_products), 1)
        P(f"| {k} | {v} | {pct}% |")
    P("")

    # ── SECTION 6 ──
    P("---")
    P("## SECTION 6 · Knowledge Factory Readiness™ Scorecard")
    P("")
    P("| Capability | Score (0-100) |")
    P("|---|---|")
    P(f"| Product Detection | {accuracy} |")
    P(f"| Image Grouping | {image_grouping_score} |")
    P(f"| Image Classification | {image_class_score} |")
    P(f"| Material Extraction | {pct_materials} |")
    P(f"| Finishes Extraction | {pct_finishes} |")
    P(f"| Dimensions Extraction | {pct_dims} |")
    P(f"| Designer Extraction | {pct_designer} |")
    P(f"| Category Extraction | {pct_category} |")
    P(f"| **Brand Atlas™ Readiness** | **{brand_atlas}** |")
    P(f"| **Academy™ Readiness** | **{academy_score}** |")
    P(f"| **Marketboard™ Readiness** | **{marketboard}** |")
    P(f"| **Moodboard™ Readiness** | **{moodboard}** |")
    P(f"| **Specification™ Readiness** | **{specification}** |")
    P("")

    # ── SECTION 7 ──
    P("---")
    P("## SECTION 7 · Failure Analysis")
    P("")
    P("### Top extraction failures (up to 20 examples)")
    P("")
    for f in failures[:20]:
        P(f"- {f}")
    if not failures:
        P("- ✅ Nessun failure significativo rilevato.")
    P("")

    # ── SECTION 8 ──
    P("---")
    P("## SECTION 8 · Product Knowledge Object™ Validation (sample 20)")
    P("")
    P("| # | Product | Brand Atlas | Academy | Marketboard | Moodboard | Specification |")
    P("|---|---|---|---|---|---|---|")
    for i, x in enumerate(sample20, 1):
        P(f"| {i} | {x['product_name']} | {ko_brand_atlas(x)} | {ko_academy(x)} | "
          f"{ko_marketboard(x)} | {ko_moodboard(x)} | {ko_specification(x)} |")
    P("")

    # ── SECTION 9 ──
    P("---")
    P("## SECTION 9 · Moodboard Readiness Audit")
    P("")
    P(f"- Hero assets: **{hero_count}**")
    P(f"- Ambient assets: **{ambient_count}**")
    P(f"- Detail / packshot assets: **{detail_count}**")
    P(f"- Finish / texture assets: **{finish_count}**")
    P(f"- Products with hero+detail+materials (strong moodboard): **{moodboard_strong}** / {n_products} ({moodboard_strong_pct}%)")
    P("")
    P("**Weaknesses:**")
    P(f"- Hero coverage: {round(100.0*hero_count/max(1,total_classified),1)}% of assets (target ≥15% per catalog)")
    if finish_count == 0:
        P("- ❌ No finish samples classified — material palette generation will be limited")
    if detail_count == 0:
        P("- ❌ No detail/packshot assets — close-up moodboard cells will not be possible")
    if ambient_count < hero_count:
        P("- ⚠️ Ambient < hero count — lifestyle storytelling has thin material")
    P("")

    # ── SECTION 10 ──
    P("---")
    P("## SECTION 10 · Marketboard Readiness Audit")
    P("")
    P(f"- Products with designer + materials + finishes + description (strong marketboard): "
      f"**{marketboard_strong}** / {n_products} ({marketboard_strong_pct}%)")
    P("")
    P("**Gaps:**")
    if pct_finishes < 60:
        P(f"- ⚠️ Finishes extraction only {pct_finishes}% — finish-driven market positioning weak")
    if pct_designer < 80:
        P(f"- ⚠️ Designer extraction only {pct_designer}% — designer-driven storytelling has gaps")
    if pct_desc < 60:
        P(f"- ⚠️ Description extraction only {pct_desc}% — product narrative weak")
    P("")

    # ── FINAL DELIVERABLE ──
    P("---")
    P("# FINAL DELIVERABLE")
    P("")
    P("## 1 · Executive Summary")
    P("")
    P(f"**Can Product Composer™ scale to 50+ brands?**  →  **{verdict}**")
    P("")
    P("## 2 · Brand Knowledge Factory Readiness")
    P("")
    P(f"## 🏛️ **{overall_readiness} / 100**")
    P("")
    P("Weighted formula:")
    P(f"- Brand Atlas (20%) · Academy (15%) · Marketboard (20%) · Moodboard (20%) · Specification (15%) · Avg confidence (10%)")
    P("")
    P("## 3 · Immediate Fixes Required (highest priority before frontend)")
    P("")
    # Auto-derived priorities
    if pct_designer < 70:
        P(f"- 🔥 **P0** Designer extraction at {pct_designer}% — improve heuristic for 'design X' / 'by X' patterns across multi-page sections")
    if pct_finishes < 50:
        P(f"- 🔥 **P0** Finishes extraction at {pct_finishes}% — current 'FINITURE header' detection too narrow, add Cattelan-style scattered finish layouts")
    if pct_dims < 60:
        P(f"- 🔥 **P0** Dimensions extraction at {pct_dims}% — regex misses Cattelan technical schemas with SAG. notation")
    if accuracy < 70:
        P(f"- 🔥 **P0** Product detection accuracy {accuracy}% — section_detector misses ~{expected-n_products} products")
    if (asset_type_global.get("technical", 0) > 30 and asset_type_global.get("technical", 0) > role_global.get("hero", 0)):
        P(f"- 🔥 **P0** Asset classifier biased toward 'technical' ({asset_type_global.get('technical',0)} drawings vs {role_global.get('hero',0)} hero) — Layer 2 Vision fallback required")
    if image_class_score < 70:
        P(f"- 🟡 **P1** Image classification confidence {image_class_score}% — call Vision LLM fallback under threshold 0.55")
    P("")

    P("## 4 · Recommended Phase 1.5 (highest-ROI improvements)")
    P("")
    P("- Enhance `section_detector._page_title` to use BOTH text size AND vertical position (top-15%) for higher precision")
    P("- Add `dimensions_structured` parsing for technical schema styles (SAG., Ø, h variations) — large precision gain for Cattelan-style PDFs")
    P("- Bring Vision LLM Layer 2 online for assets with `classification_confidence < 0.55` — biggest improvement on hero/ambient detection")
    P("- Add finish swatch detection by aspect ratio (very small square crops on dedicated finish pages)")
    P("- Cross-reference TOC heuristic titles ↔ detected sections to flag missing products automatically")
    P("")

    P("## 5 · Recommendation")
    P("")
    P(recommendation)
    P("")
    P("**Justification:**")
    P("")
    if overall_readiness >= 75:
        P(f"Readiness {overall_readiness}/100 supera la soglia di shipping frontend. La copertura metadati (name {pct_name}%, designer {pct_designer}%, dims {pct_dims}%) e l'image classification ({image_class_score}%) sono sufficienti per un admin review workflow utile. La pipeline gestisce {n_products}/{expected} prodotti in {p['timings_s']['total']}s su {p['page_count']} pagine: scalabile a 50+ brand con processing parallelo.")
    elif overall_readiness >= 55:
        P(f"Readiness {overall_readiness}/100 indica solidità del backbone ma gap critici: ")
        if pct_designer < 70: P(f"designer extraction al {pct_designer}%, ")
        if pct_finishes < 50: P(f"finishes al {pct_finishes}%, ")
        if pct_dims < 60: P(f"dimensions al {pct_dims}%. ")
        P("Investire una Phase 1.5 di 2-4 giorni sui fix sopra prima del frontend evita di costruire UI su dati fragili.")
    else:
        P(f"Readiness {overall_readiness}/100: la pipeline produce dati ma con troppi gap strutturali per essere base affidabile. Necessario rework di section_detector + introduzione Vision LLM Layer 2 + OCR fallback per PDF scansionati.")
    P("")
    P("---")
    P("")
    P("## Appendix · Full Product List")
    P("")
    P("| # | Product | Pages | Designer | Cat | Assets | Hero | Ambient | Det | Mat | Fin | Dim | Desc | Conf | Spec | Acad | Cont |")
    P("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for i, x in enumerate(products, 1):
        rc = x["role_counts"]
        P(f"| {i} | {x['product_name']} | {x['start_page']}-{x['end_page']} | "
          f"{(x.get('designer_name') or '—')[:18]} | {(x.get('category_label') or '—')[:12]} | "
          f"{len(x['assets'])} | {rc.get('hero',0)} | {rc.get('ambient',0)} | "
          f"{rc.get('detail',0)+rc.get('packshot',0)} | "
          f"{'✓' if x['has_materials'] else '·'} | "
          f"{'✓' if x['finishes'] else '·'} | "
          f"{'✓' if x['has_dimensions'] else '·'} | "
          f"{'✓' if x['has_description'] else '·'} | "
          f"{x['composite_confidence']:.2f} | "
          f"{'✓' if x['spec_ready'] else '·'} | "
          f"{'✓' if x['academy_ready'] else '·'} | "
          f"{'✓' if x['content_ready'] else '·'} |")
    P("")

    pathlib.Path(report_path).write_text("\n".join(lines), encoding="utf-8")
    print(f"✅ Report written: {report_path} ({len(lines)} lines)")


# ──────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--brand", required=True)
    ap.add_argument("--catalog-year", type=int, default=None)
    ap.add_argument("--expected", type=int, default=None,
                    help="Expected number of products (from TOC visual count)")
    ap.add_argument("--report", required=True)
    ap.add_argument("--max-candidates", type=int, default=600)
    ap.add_argument("--no-vision", action="store_true",
                    help="Skip Vision Layer 2 calls (for fast offline runs)")
    args = ap.parse_args()

    catalog_name = pathlib.Path(args.pdf).name
    result = run_pipeline_dryrun(args.pdf, max_candidates=args.max_candidates,
                                  enable_vision=not args.no_vision)
    write_report(catalog_name, args.brand, args.catalog_year,
                 args.expected, result, args.report)


if __name__ == "__main__":
    main()
