"""Editorial Memory™ — Market Learning.

Aggregates signals from `editorial_cta_clicks`, revisions, approval cadence
into `editorial_market_learnings` rows (one per pattern_key per market).

Run periodically (e.g. nightly cron) and on-demand from the Blueprint UI.
NEVER presented as "AI learning" — surfaces as "Market Learning" / "Cultural
Calibration".
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from database import db

logger = logging.getLogger(__name__)

# Sample-size thresholds (we don't bias the composer on small samples).
MIN_SAMPLE_FOR_CONFIDENCE = 10


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _upsert_learning(c, tenant_id: str, market_id: str, pattern_key: str,
                     signal_payload: Dict[str, Any], confidence: float, sample_size: int) -> None:
    existing = (c.table("editorial_market_learnings").select("id")
                .eq("tenant_id", tenant_id).eq("market_id", market_id)
                .eq("pattern_key", pattern_key).limit(1).execute().data or [])
    row = {
        "tenant_id":      tenant_id,
        "market_id":      market_id,
        "pattern_key":    pattern_key,
        "signal_payload": signal_payload,
        "confidence":     round(confidence, 3),
        "sample_size":    sample_size,
        "recomputed_at":  _iso(),
    }
    if existing:
        c.table("editorial_market_learnings").update(row).eq("id", existing[0]["id"]).execute()
    else:
        row["id"] = str(uuid.uuid4())
        row["observed_at"] = _iso()
        c.table("editorial_market_learnings").insert(row).execute()


def _confidence_from_sample(sample: int, dominance: float) -> float:
    """Confidence is jointly a function of sample size and signal dominance.
    dominance ∈ [0,1] is the top-class share among observations.
    """
    if sample < MIN_SAMPLE_FOR_CONFIDENCE:
        return min(0.3, dominance * (sample / MIN_SAMPLE_FOR_CONFIDENCE))
    # Logistic-ish smoother.
    size_factor = min(1.0, sample / 50)
    return round(0.35 + 0.65 * dominance * size_factor, 3)


def recompute_market_learnings(tenant_id: str, market_id: str) -> Dict[str, Any]:
    """Recompute every pattern_key for one (tenant, market). Returns a
    summary suitable for surfacing in the Blueprint Cultural Calibration
    panel."""
    c = db()
    clicks = (c.table("editorial_cta_clicks").select("*")
              .eq("tenant_id", tenant_id).eq("market_id", market_id)
              .order("created_at", desc=True).limit(2000).execute().data or [])

    summary: Dict[str, Any] = {}

    # ── 1. cta_tier_conversion: which tier earns the most clicks. ───────
    tier_counts: Dict[str, int] = {}
    for k in clicks:
        tier_counts[k["cta_tier"]] = tier_counts.get(k["cta_tier"], 0) + 1
    total = sum(tier_counts.values())
    if total:
        top_tier, top_n = max(tier_counts.items(), key=lambda kv: kv[1])
        conf = _confidence_from_sample(total, top_n / total)
        _upsert_learning(c, tenant_id, market_id, "cta_tier_conversion",
                         {"distribution": tier_counts, "top_tier": top_tier}, conf, total)
        summary["cta_tier_conversion"] = {"top_tier": top_tier, "support": round(top_n / total, 3), "sample": total}

    # ── 2. cta_intent_resonance ────────────────────────────────────────
    intent_counts: Dict[str, int] = {}
    for k in clicks:
        if k.get("cta_intent"):
            intent_counts[k["cta_intent"]] = intent_counts.get(k["cta_intent"], 0) + 1
    total = sum(intent_counts.values())
    if total:
        top_intent, top_n = max(intent_counts.items(), key=lambda kv: kv[1])
        conf = _confidence_from_sample(total, top_n / total)
        _upsert_learning(c, tenant_id, market_id, "cta_intent_resonance",
                         {"distribution": intent_counts, "top_intent": top_intent}, conf, total)
        summary["cta_intent_resonance"] = {"top_intent": top_intent, "support": round(top_n / total, 3), "sample": total}

    # ── 3. atmosphere_signal_density: which atmosphere tags correlate ─
    atm_counts: Dict[str, int] = {}
    for k in clicks:
        if k["cta_tier"] != "strong":
            continue
        tags = ((k.get("atmosphere_context") or {}).get("atmosphere_tags") or [])
        for tag in tags:
            atm_counts[tag] = atm_counts.get(tag, 0) + 1
    if atm_counts:
        total_atm = sum(atm_counts.values())
        top_tag, top_n = max(atm_counts.items(), key=lambda kv: kv[1])
        conf = _confidence_from_sample(total_atm, top_n / total_atm)
        _upsert_learning(c, tenant_id, market_id, "atmosphere_signal_density",
                         {"distribution": atm_counts, "top_tag": top_tag,
                          "scoped_to": "strong_cta_clicks"}, conf, total_atm)
        summary["atmosphere_signal_density"] = {"top_tag": top_tag, "sample": total_atm}

    # ── 4. material_curiosity (materials_viewed counts per tier) ───────
    mat_per_tier: Dict[str, Dict[str, int]] = {}
    for k in clicks:
        mats = k.get("materials_viewed") or []
        if not mats:
            continue
        tier = k["cta_tier"]
        mat_per_tier.setdefault(tier, {})
        for m in mats:
            key = m.get("material") or m.get("name") or str(m)
            mat_per_tier[tier][key] = mat_per_tier[tier].get(key, 0) + 1
    if mat_per_tier:
        strong_mats = mat_per_tier.get("strong") or {}
        top_strong = None
        if strong_mats:
            top_strong, _ = max(strong_mats.items(), key=lambda kv: kv[1])
        sample = sum(sum(v.values()) for v in mat_per_tier.values())
        conf = _confidence_from_sample(sample, 0.55 if top_strong else 0.3)
        _upsert_learning(c, tenant_id, market_id, "material_curiosity",
                         {"by_tier": mat_per_tier, "top_strong_material": top_strong}, conf, sample)
        summary["material_curiosity"] = {"top_strong_material": top_strong, "sample": sample}

    # ── 5. preferred_pacing — from variants' performance_signals ───────
    variants = (c.table("editorial_variants")
                .select("pacing_label,performance_signals")
                .eq("tenant_id", tenant_id).eq("market_id", market_id)
                .execute().data or [])
    pacing_signal: Dict[str, int] = {}
    for v in variants:
        ps = v.get("performance_signals") or {}
        strong = (ps.get("cta_click_count_by_tier") or {}).get("strong", 0)
        if v.get("pacing_label"):
            pacing_signal[v["pacing_label"]] = pacing_signal.get(v["pacing_label"], 0) + strong
    if any(pacing_signal.values()):
        total_p = sum(pacing_signal.values())
        top_pacing, top_n = max(pacing_signal.items(), key=lambda kv: kv[1])
        conf = _confidence_from_sample(total_p, top_n / total_p if total_p else 0)
        _upsert_learning(c, tenant_id, market_id, "preferred_pacing",
                         {"by_strong_click_weight": pacing_signal, "top_pacing": top_pacing},
                         conf, total_p)
        summary["preferred_pacing"] = {"top_pacing": top_pacing, "support": round(top_n / total_p, 3) if total_p else 0, "sample": total_p}

    # ── 6. preferred_tone (same logic on tone_label) ───────────────────
    tone_signal: Dict[str, int] = {}
    for v in variants:
        ps = v.get("performance_signals") or {}
        strong = (ps.get("cta_click_count_by_tier") or {}).get("strong", 0)
        if v.get("tone_label"):
            tone_signal[v["tone_label"]] = tone_signal.get(v["tone_label"], 0) + strong
    if any(tone_signal.values()):
        total_t = sum(tone_signal.values())
        top_tone, top_n = max(tone_signal.items(), key=lambda kv: kv[1])
        conf = _confidence_from_sample(total_t, top_n / total_t if total_t else 0)
        _upsert_learning(c, tenant_id, market_id, "preferred_tone",
                         {"by_strong_click_weight": tone_signal, "top_tone": top_tone},
                         conf, total_t)
        summary["preferred_tone"] = {"top_tone": top_tone, "sample": total_t}

    return {"market_id": market_id, "patterns": summary, "recomputed_at": _iso()}
