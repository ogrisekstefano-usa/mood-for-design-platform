"""Auto-Tagger™ — Phase 1 Design Knowledge Graph (ITER193).

Triggers when a product transitions to review_status='approved'. Runs
deterministic keyword matching against the 4 canonical vocabularies
(spaces / features / styles / markets) and stores M:N edges with
confidence scores.

Algorithm (NO LLM in Phase 1):
  1. Concatenate name + description + raw_text (section text)
  2. For each canonical vocab entity, score keyword density
  3. If score > CONFIDENCE_THRESHOLD (0.40 default) → INSERT edge
  4. Apply material-derived heuristics (wood+marble → timeless, etc.)
  5. Compute Market Intelligence Layer (7 scores)
"""
from __future__ import annotations

import logging
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = 0.40

# ── Material → Style mapping (Phase 1 heuristic) ───────────────────────
MATERIAL_STYLE_RULES: Dict[str, List[str]] = {
    "marble":        ["luxury", "italian_modern", "timeless"],
    "wood":          ["organic", "scandinavian", "japandi"],
    "rattan":        ["mediterranean", "organic", "japandi"],
    "steel":         ["industrial", "contemporary", "minimal"],
    "concrete":      ["brutalist", "industrial"],
    "brass":         ["luxury", "art_deco", "italian_modern"],
    "leather":       ["luxury", "timeless", "italian_modern"],
    "ceramic":       ["minimal", "contemporary", "italian_modern"],
    "glass":         ["minimal", "contemporary"],
    "lacquer":       ["luxury", "italian_modern", "art_deco"],
    "stone":         ["architectural", "mediterranean", "brutalist"],
}

# ── Material → Space mapping ───────────────────────────────────────────
MATERIAL_SPACE_RULES: Dict[str, List[str]] = {
    "rattan":  ["outdoor", "lounge"],
    "teak":    ["outdoor", "spa"],
    "marble":  ["bathroom", "kitchen", "luxury_residential", "hospitality"],
    "ceramic": ["bathroom", "kitchen", "outdoor"],
    "leather": ["living_room", "workplace", "lounge"],
    "fabric":  ["living_room", "bedroom"],
    "wood":    ["living_room", "dining_room", "bedroom"],
    "stone":   ["hospitality", "luxury_residential", "outdoor"],
    "concrete": ["industrial", "workplace"],
    "brass":   ["luxury_residential", "hospitality"],
}


def _norm(text: str) -> str:
    return (text or "").lower()


def _score_keyword_match(text: str, keywords: List[str]) -> Tuple[float, List[Dict[str, Any]]]:
    """Return (score 0-1, evidence list).

    Scoring tuned so a single specific-keyword match passes the 0.40
    confidence threshold for features/markets (which tend to have only
    1-2 matches per product description).
    """
    if not text or not keywords:
        return 0.0, []
    text_low = _norm(text)
    evidence: List[Dict[str, Any]] = []
    total_score = 0.0
    for kw in keywords:
        kw_low = kw.lower().strip()
        if not kw_low:
            continue
        pattern = rf"\b{re.escape(kw_low)}\b"
        matches = list(re.finditer(pattern, text_low))
        if matches:
            # Single specific-word match → 0.42 (just above threshold).
            kw_score = 0.42 + 0.08 * (len(matches) - 1)
            if len(kw_low) >= 12:
                kw_score += 0.10            # long phrase bonus
            elif len(kw_low) >= 8:
                kw_score += 0.05
            total_score += kw_score
            for m in matches[:2]:
                snippet_start = max(0, m.start() - 40)
                snippet_end = min(len(text_low), m.end() + 60)
                evidence.append({
                    "keyword": kw,
                    "snippet": text_low[snippet_start:snippet_end].replace("\n", " ").strip(),
                    "score_contribution": round(kw_score, 3),
                })
    score = min(0.99, total_score)
    return round(score, 3), evidence


# ──────────────────────────────────────────────────────────────────────
# Market Intelligence Layer
# ──────────────────────────────────────────────────────────────────────
def _compute_market_relevance(
    product: Dict[str, Any],
    detected_styles: List[str],
    detected_spaces: List[str],
    detected_features: List[str],
    materials: List[str],
) -> Dict[str, float]:
    """Compute the 7-axis market_relevance JSONB.

    All scores 0..1. Phase 1 heuristic, replaced by LLM in Phase 2.
    Axes: us, eu, apac, me, hospitality, residential, retail.
    """
    designer = (product.get("designer_name") or "").lower()

    is_italian_designer = any(t in designer for t in
        ("urquiola", "rossi", "verdi", "rashid", "magistretti", "ponti", "castiglioni",
         "cattelan", "rosso", "manzoni", "bianchi", "russo", "esposito", "ricci"))
    is_premium = any(s in detected_styles for s in ("luxury", "art_deco", "italian_modern"))
    is_minimal = any(s in detected_styles for s in ("minimal", "scandinavian", "japandi"))
    is_outdoor = "outdoor" in detected_spaces or "outdoor_rated" in detected_features
    is_hospitality_signal = any(s in detected_spaces for s in
        ("hospitality", "lobby", "lounge", "restaurant", "spa"))
    is_modular = any(f in detected_features for f in ("modular", "customizable", "compact"))
    is_sustainable = any(f in detected_features for f in
        ("sustainable", "reclaimed_material", "biophilic", "handcrafted", "artisanal"))
    has_marble = "marble" in materials
    has_wood = "wood" in materials

    # ── US relevance ──
    us = 0.50
    if is_premium:
        us += 0.20
    if is_italian_designer:
        us += 0.15
    if is_minimal:
        us += 0.10
    if has_marble:
        us += 0.05

    # ── EU relevance ──
    eu = 0.55
    if is_italian_designer:
        eu += 0.20
    if is_sustainable:
        eu += 0.10
    if "italian_modern" in detected_styles:
        eu += 0.10

    # ── APAC relevance ──
    apac = 0.45
    if is_minimal:
        apac += 0.20
    if "japandi" in detected_styles:
        apac += 0.20
    if is_premium:
        apac += 0.10

    # ── ME relevance ──
    me = 0.40
    if is_premium:
        me += 0.25
    if "luxury" in detected_styles:
        me += 0.20
    if has_marble or "brass" in materials:
        me += 0.10

    # ── Hospitality ──
    hospitality = 0.50
    if is_hospitality_signal:
        hospitality += 0.30
    if "acoustic" in detected_features:
        hospitality += 0.10
    if "modular" in detected_features:
        hospitality += 0.08

    # ── Residential ──
    residential = 0.65
    if "living_room" in detected_spaces or "bedroom" in detected_spaces:
        residential += 0.15
    if has_wood:
        residential += 0.05
    if is_outdoor:
        residential -= 0.05

    # ── Retail ──
    retail = 0.40
    if is_modular:
        retail += 0.15
    if "contemporary" in detected_styles:
        retail += 0.10
    if "minimal" in detected_styles:
        retail += 0.10
    if is_premium:
        retail += 0.10

    def _clip(x: float) -> float:
        return round(max(0.0, min(0.99, x)), 3)

    return {
        "us":           _clip(us),
        "eu":           _clip(eu),
        "apac":         _clip(apac),
        "me":           _clip(me),
        "hospitality":  _clip(hospitality),
        "residential":  _clip(residential),
        "retail":       _clip(retail),
    }


# ──────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────
def tag_product(
    db_client: Any,
    *,
    tenant_id: str,
    product_id: str,
    confidence_threshold: float = CONFIDENCE_THRESHOLD,
    clear_previous: bool = True,
) -> Dict[str, Any]:
    """Run the full auto-tagger on a single approved product.

    Returns a summary dict with counts per edge type.
    """
    prods = (db_client.table("products").select("*")
             .eq("id", product_id).eq("tenant_id", tenant_id).limit(1).execute().data or [])
    if not prods:
        return {"error": "product_not_found"}
    product = prods[0]

    # Optionally clear previous auto-generated edges
    if clear_previous:
        for table in ("product_spaces", "product_features", "product_styles", "product_markets"):
            try:
                db_client.table(table).delete().eq("product_id", product_id).eq("source", "auto").execute()
            except Exception:
                pass

    # Gather section raw_text for richer context
    section_id = product.get("source_section_id")
    raw_text = ""
    if section_id:
        sec = (db_client.table("product_sections").select("raw_text")
               .eq("id", section_id).limit(1).execute().data or [])
        raw_text = (sec[0].get("raw_text") if sec else "") or ""

    # Combined text source
    text_parts = [
        product.get("product_name") or "",
        product.get("description") or "",
        " ".join(product.get("materials") or []),
        " ".join(product.get("finishes") or []),
        " ".join(product.get("applications") or []),
        " ".join(product.get("usage_contexts") or []),
        product.get("category_label") or "",
        raw_text[:4000],  # cap raw_text for perf
    ]
    text = " · ".join(p for p in text_parts if p)

    materials = [str(m).lower() for m in (product.get("materials") or [])]

    out = {"spaces": [], "features": [], "styles": [], "markets": []}

    # ─── Spaces ───
    spaces = (db_client.table("spaces_canonical")
              .select("id,space_key,display_name,keywords").execute().data or [])
    for s in spaces:
        score, evidence = _score_keyword_match(text, s.get("keywords") or [])
        if score >= confidence_threshold:
            out["spaces"].append({"space_id": s["id"], "key": s["space_key"],
                                   "score": score, "evidence": evidence})

    # ─── Features ───
    features = (db_client.table("features_canonical")
                .select("id,feature_key,display_name,keywords").execute().data or [])
    for f in features:
        score, evidence = _score_keyword_match(text, f.get("keywords") or [])
        if score >= confidence_threshold:
            out["features"].append({"feature_id": f["id"], "key": f["feature_key"],
                                     "score": score, "evidence": evidence})

    # ─── Styles ───
    styles = (db_client.table("styles_canonical")
              .select("id,style_key,display_name,keywords").execute().data or [])
    for st in styles:
        score, evidence = _score_keyword_match(text, st.get("keywords") or [])
        if score >= confidence_threshold:
            out["styles"].append({"style_id": st["id"], "key": st["style_key"],
                                   "score": score, "evidence": evidence})

    # Material-derived style boost
    style_index = {st["style_key"]: st["id"] for st in styles}
    detected_style_keys = {s["key"] for s in out["styles"]}
    for mat in materials:
        for suggested_style in MATERIAL_STYLE_RULES.get(mat, []):
            sid = style_index.get(suggested_style)
            if not sid or suggested_style in detected_style_keys:
                continue
            out["styles"].append({
                "style_id": sid, "key": suggested_style,
                "score": 0.55, "evidence": [{"derived_from": f"material:{mat}"}],
            })
            detected_style_keys.add(suggested_style)

    # ─── Markets (text-based) ───
    markets = (db_client.table("markets_canonical")
               .select("id,market_key,display_name,keywords").execute().data or [])
    for m in markets:
        score, evidence = _score_keyword_match(text, m.get("keywords") or [])
        if score >= confidence_threshold:
            out["markets"].append({"market_id": m["id"], "key": m["market_key"],
                                    "score": score, "evidence": evidence})

    # ─── Insert edges ───
    detected_style_list = list(detected_style_keys)
    detected_space_list = [s["key"] for s in out["spaces"]]
    detected_feature_list = [f["key"] for f in out["features"]]

    # Material-derived space boost
    space_index = {sp["space_key"]: sp["id"] for sp in spaces}
    for mat in materials:
        for suggested_space in MATERIAL_SPACE_RULES.get(mat, []):
            sid = space_index.get(suggested_space)
            if not sid or suggested_space in detected_space_list:
                continue
            out["spaces"].append({
                "space_id": sid, "key": suggested_space,
                "score": 0.55, "evidence": [{"derived_from": f"material:{mat}"}],
            })
            detected_space_list.append(suggested_space)

    def _insert(table: str, fk_name: str, score_field: str,
                items: List[Dict[str, Any]]) -> int:
        inserted = 0
        for it in items:
            try:
                db_client.table(table).insert({
                    "id": str(uuid.uuid4()),
                    "product_id": product_id,
                    fk_name: it[fk_name],
                    "source": "auto",
                    score_field: it["score"],
                    "evidence": it["evidence"],
                }).execute()
                inserted += 1
            except Exception as e:
                logger.debug(f"insert {table} failed (dup?): {e}")
        return inserted

    inserted_spaces  = _insert("product_spaces",  "space_id",   "confidence_score", out["spaces"])
    inserted_feat    = _insert("product_features", "feature_id", "confidence_score", out["features"])
    inserted_styles  = _insert("product_styles",  "style_id",   "confidence_score", out["styles"])
    inserted_markets = _insert("product_markets", "market_id",  "relevance_score",  out["markets"])

    # ─── Market relevance (7-axis) ───
    market_rel = _compute_market_relevance(
        product, detected_style_list, detected_space_list, detected_feature_list, materials,
    )
    db_client.table("products").update({
        "market_relevance": market_rel,
        "updated_at": product.get("updated_at"),
    }).eq("id", product_id).execute()

    return {
        "product_id": product_id,
        "edges_created": {
            "spaces":   inserted_spaces,
            "features": inserted_feat,
            "styles":   inserted_styles,
            "markets":  inserted_markets,
        },
        "market_relevance": market_rel,
        "detected": {
            "spaces":   detected_space_list,
            "features": detected_feature_list,
            "styles":   detected_style_list,
            "markets":  [m["key"] for m in out["markets"]],
        },
    }


def retag_session(
    db_client: Any,
    *,
    tenant_id: str,
    brand_import_session_id: str,
    confidence_threshold: float = CONFIDENCE_THRESHOLD,
) -> Dict[str, Any]:
    """Re-run the auto-tagger on every product in a session.

    Also recomputes brand_styles / brand_markets aggregates.
    """
    products = (db_client.table("products")
                .select("id,brand_id")
                .eq("tenant_id", tenant_id)
                .eq("brand_import_session_id", brand_import_session_id)
                .execute().data or [])
    summary = {"total": len(products), "tagged": 0,
               "edge_counts": {"spaces": 0, "features": 0, "styles": 0, "markets": 0}}
    brand_id = None
    for p in products:
        brand_id = brand_id or p.get("brand_id")
        r = tag_product(db_client, tenant_id=tenant_id, product_id=p["id"],
                        confidence_threshold=confidence_threshold)
        if "edges_created" in r:
            summary["tagged"] += 1
            for k, v in r["edges_created"].items():
                summary["edge_counts"][k] += v

    # ── Brand aggregates ──
    if brand_id:
        _recompute_brand_aggregates(db_client, tenant_id, brand_id)

    return summary


def _recompute_brand_aggregates(db_client: Any, tenant_id: str, brand_id: str) -> None:
    """Recompute brand_styles + brand_markets affinity scores."""
    # All products of this brand (across sessions)
    prods = (db_client.table("products").select("id,market_relevance")
             .eq("tenant_id", tenant_id).eq("brand_id", brand_id).execute().data or [])
    if not prods:
        return
    pids = [p["id"] for p in prods]

    # styles
    ps = (db_client.table("product_styles").select("style_id,confidence_score")
          .in_("product_id", pids).execute().data or [])
    from collections import defaultdict
    style_scores: Dict[str, List[float]] = defaultdict(list)
    for row in ps:
        style_scores[row["style_id"]].append(float(row.get("confidence_score") or 0))
    for sid, scores in style_scores.items():
        affinity = round(sum(scores) / max(1, len(prods)), 3)
        existing = (db_client.table("brand_styles").select("id")
                    .eq("brand_id", brand_id).eq("style_id", sid).limit(1)
                    .execute().data or [])
        payload = {"product_count": len(scores), "affinity_score": affinity, "source": "auto"}
        if existing:
            db_client.table("brand_styles").update(payload).eq("id", existing[0]["id"]).execute()
        else:
            db_client.table("brand_styles").insert({
                "id": str(uuid.uuid4()), "brand_id": brand_id, "style_id": sid, **payload,
            }).execute()

    # markets (use product_markets rows; relevance score)
    pm = (db_client.table("product_markets").select("market_id,relevance_score")
          .in_("product_id", pids).execute().data or [])
    mkt_scores: Dict[str, List[float]] = defaultdict(list)
    for row in pm:
        mkt_scores[row["market_id"]].append(float(row.get("relevance_score") or 0))
    for mid, scores in mkt_scores.items():
        relevance = round(sum(scores) / max(1, len(prods)), 3)
        existing = (db_client.table("brand_markets").select("id")
                    .eq("brand_id", brand_id).eq("market_id", mid).limit(1)
                    .execute().data or [])
        payload = {"product_count": len(scores), "relevance_score": relevance, "source": "auto"}
        if existing:
            db_client.table("brand_markets").update(payload).eq("id", existing[0]["id"]).execute()
        else:
            db_client.table("brand_markets").insert({
                "id": str(uuid.uuid4()), "brand_id": brand_id, "market_id": mid, **payload,
            }).execute()
