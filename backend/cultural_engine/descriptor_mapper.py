"""Layer 2 — MOOD Cultural Engine™ (proprietary, NO AI).

Deterministic mapping:
    vision signals → cultural_descriptors → market_cultural_profiles

This is the cuore proprietario. NO embeddings, NO ML, NO LLM.
Only curated taxonomy + transparent math + anti-patterns.
"""
from __future__ import annotations

from typing import Any, Dict, List, Tuple

from database import db


def _activate_descriptors(signals: Dict[str, Any], all_descriptors: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Return descriptors with strength = avg(active signals) × weight.

    A descriptor activates if every signal_key listed reaches its threshold.
    """
    activated: List[Dict[str, Any]] = []
    for d in all_descriptors:
        signal_keys = d.get("signal_keys") or []
        thresholds  = d.get("signal_thresholds") or {}
        if not signal_keys:
            continue
        values = []
        for k in signal_keys:
            v = signals.get(k)
            if not isinstance(v, (int, float)):
                values = []
                break
            thr = float(thresholds.get(k, 0.5))
            if v < thr:
                values = []
                break
            values.append(float(v))
        if not values:
            continue
        avg = sum(values) / len(values)
        strength = avg * float(d.get("weight") or 1.0)
        activated.append({
            "code":      d["code"],
            "category":  d["category"],
            "label":     d["label"],
            "strength":  round(strength, 3),
            "avg_signal": round(avg, 3),
        })
    activated.sort(key=lambda x: x["strength"], reverse=True)
    return activated


def _score_markets(activated: List[Dict[str, Any]], signals: Dict[str, Any],
                   profiles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Combine activated descriptors with market profiles + anti-patterns.

    Score = Σ (descriptor_strength × market_descriptor_weight)
            − Σ (anti_pattern_penalty × signal_intensity_match)
    Final % is normalized against the market's theoretical max.
    """
    rows: List[Dict[str, Any]] = []
    for prof in profiles:
        weights = prof.get("descriptors") or {}
        anti    = prof.get("anti_patterns") or []
        # Theoretical max: sum of top-N descriptor weights × max strength 3.0
        max_possible = sum(sorted((float(v) for v in weights.values()), reverse=True)[:5]) * 3.0 or 1.0
        score = 0.0
        contributors: List[str] = []
        for d in activated:
            w = float(weights.get(d["code"]) or 0)
            if w > 0:
                contribution = d["strength"] * w
                score += contribution
                if contribution >= 0.4:
                    contributors.append(d["label"])
        # Anti-patterns: penalize when signals strongly contradict the market
        penalty = 0.0
        for ap in anti:
            v = signals.get(ap) or 0
            if isinstance(v, (int, float)) and v >= 0.6:
                penalty += v * 1.5  # strong penalty
        pct = max(0, min(100, round(((score - penalty) / max_possible) * 100)))
        rows.append({
            "market_code":  prof["market_code"],
            "market_label": prof["market_label"],
            "city":         prof.get("city"),
            "percentage":   pct,
            "score":        round(score, 3),
            "penalty":      round(penalty, 3),
            "narrative":    prof.get("narrative") or "",
            "contributors": contributors[:4],
        })
    rows.sort(key=lambda r: r["percentage"], reverse=True)
    return rows


def map_signals_to_culture(signals: Dict[str, Any]) -> Dict[str, Any]:
    """Run the full proprietary mapping. Returns mapped descriptors + market resonance."""
    c = db()
    descriptors = c.table("cultural_descriptors").select(
        "code,category,label,description,weight,signal_keys,signal_thresholds"
    ).execute().data or []
    profiles = c.table("market_cultural_profiles").select(
        "market_code,market_label,city,country,descriptors,anti_patterns,narrative,"
        "climate_behavior,luxury_profile,hospitality_behavior,spatial_psychology"
    ).execute().data or []

    activated = _activate_descriptors(signals, descriptors)
    market_resonance = _score_markets(activated, signals, profiles)

    # Group descriptors by category for nicer UI
    by_category: Dict[str, List[Dict[str, Any]]] = {}
    for d in activated:
        by_category.setdefault(d["category"], []).append({
            "code": d["code"], "label": d["label"], "strength": d["strength"],
        })

    return {
        "activated_descriptors": activated,
        "descriptors_by_category": by_category,
        "market_resonance": market_resonance,
    }
