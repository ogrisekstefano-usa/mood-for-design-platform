"""Knowledge Package Scorer™ — Phase 1 Founding Brands (ITER192).

After entity resolution completes, compute the canonical 9-axis score
that ranks a brand session's readiness for downstream MOOD builders.

Score axes (0-100 each):
  • product_completeness        · % products with full metadata
  • material_completeness       · % materials with story/origin
  • story_completeness          · % themes with evidence
  • academy_readiness           · desc + designer + hero/ambient coverage
  • magazine_readiness          · description + designer + story themes
  • marketboard_readiness       · materials + finishes + designer + dims
  • moodboard_readiness         · role variety (hero+ambient+detail+finish)
  • specification_readiness     · designer + dimensions + materials
  • overall                     · weighted average (0-100)
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


def compute_package_score(
    db_client: Any,
    *,
    tenant_id: str,
    brand_id: str | None,
    brand_import_session_id: str,
) -> Dict[str, Any]:
    """Compute the 9-axis Knowledge Package Score for a session."""
    products = (db_client.table("products")
                .select("id,product_name,designer_name,description,materials,"
                        "finishes,dimensions_raw,spec_ready,academy_ready,content_ready,"
                        "metadata_json,canonical_designer_id,canonical_collection_id")
                .eq("tenant_id", tenant_id)
                .eq("brand_import_session_id", brand_import_session_id)
                .execute().data or [])
    n = max(1, len(products))

    pa_rows = (db_client.table("product_assets").select("product_id,role")
               .in_("product_id", [p["id"] for p in products] or ["__none__"])
               .execute().data or [])
    role_by_product: Dict[str, Dict[str, int]] = {}
    for r in pa_rows:
        d = role_by_product.setdefault(r["product_id"], {})
        d[r["role"]] = d.get(r["role"], 0) + 1

    materials_q = (db_client.table("materials_canonical")
                   .select("id,mention_count,sustainability_story,origin")
                   .eq("tenant_id", tenant_id))
    if brand_id:
        materials_q = materials_q.eq("brand_id", brand_id)
    else:
        materials_q = materials_q.is_("brand_id", "null")
    materials = materials_q.execute().data or []
    designers = (db_client.table("designers_canonical")
                 .select("id,product_count").eq("tenant_id", tenant_id).execute().data or [])
    stories_q = (db_client.table("stories_canonical")
                 .select("id,theme,evidence")
                 .eq("tenant_id", tenant_id))
    if brand_id:
        stories_q = stories_q.eq("brand_id", brand_id)
    else:
        stories_q = stories_q.is_("brand_id", "null")
    stories = stories_q.execute().data or []

    # ─── product_completeness ───
    pc_full = sum(1 for p in products
                  if p.get("description") and p.get("designer_name") and p.get("materials"))
    product_completeness = round(100.0 * pc_full / n, 1)

    # ─── material_completeness ───
    if materials:
        mc_full = sum(1 for m in materials
                      if (m.get("sustainability_story") or m.get("origin")))
        material_completeness = round(100.0 * mc_full / len(materials), 1)
    else:
        material_completeness = 0.0

    # ─── story_completeness ───
    THEMES_TOTAL = 10
    distinct_themes = len({s["theme"] for s in stories})
    story_completeness = round(100.0 * distinct_themes / THEMES_TOTAL, 1)

    # ─── academy_readiness ───
    a_ok = 0
    for p in products:
        roles = role_by_product.get(p["id"], {})
        if (p.get("description") and len(p.get("description") or "") > 80
                and p.get("designer_name")
                and (roles.get("hero", 0) + roles.get("ambient", 0)) >= 1):
            a_ok += 1
    academy_readiness = round(100.0 * a_ok / n, 1)

    # ─── magazine_readiness ───
    m_ok = sum(1 for p in products
               if p.get("description") and p.get("designer_name"))
    magazine_readiness = round(min(100.0,
        (100.0 * m_ok / n) * 0.7 + story_completeness * 0.3), 1)

    # ─── marketboard_readiness ───
    mb_ok = sum(1 for p in products
                if p.get("materials") and p.get("finishes") and
                p.get("designer_name") and p.get("dimensions_raw"))
    marketboard_readiness = round(100.0 * mb_ok / n, 1)

    # ─── moodboard_readiness ───
    mb_full = 0
    for p in products:
        roles = role_by_product.get(p["id"], {})
        variety = sum(1 for r in ("hero", "ambient", "detail", "finish", "packshot") if roles.get(r, 0) > 0)
        if variety >= 3:
            mb_full += 1
    moodboard_readiness = round(100.0 * mb_full / n, 1)

    # ─── specification_readiness ───
    spec_ok = sum(1 for p in products if p.get("spec_ready"))
    specification_readiness = round(100.0 * spec_ok / n, 1)

    # ─── overall ───
    overall = round(
        product_completeness        * 0.15 +
        material_completeness       * 0.10 +
        story_completeness          * 0.10 +
        academy_readiness           * 0.15 +
        magazine_readiness          * 0.10 +
        marketboard_readiness       * 0.15 +
        moodboard_readiness         * 0.15 +
        specification_readiness     * 0.10,
        1,
    )

    return {
        "product_completeness":      product_completeness,
        "material_completeness":     material_completeness,
        "story_completeness":        story_completeness,
        "academy_readiness":         academy_readiness,
        "magazine_readiness":        magazine_readiness,
        "marketboard_readiness":     marketboard_readiness,
        "moodboard_readiness":       moodboard_readiness,
        "specification_readiness":   specification_readiness,
        "overall":                   overall,
        "_counts": {
            "products":    len(products),
            "materials":   len(materials),
            "designers":   len(designers),
            "stories":     len(stories),
            "themes_distinct": distinct_themes,
            "themes_total":    THEMES_TOTAL,
        },
    }
