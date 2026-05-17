"""memory_injector — accumulated Market Learning patterns.

Reads `editorial_market_learnings` for the current (tenant, market) and
filters by confidence ≥ MIN_CONFIDENCE. Lower-confidence patterns are
omitted from the composition (we do not want to bias on small samples).

This is the foundation of the future "MOOD learns the market" loop. Do
NOT surface this as "AI learning" to users — it is "Market Learning".
"""
from typing import Any, Dict, List
from database import db

MIN_CONFIDENCE = 0.55


def fragment(tenant_id: str, market_id: str) -> Dict[str, Any]:
    c = db()
    rows = (c.table("editorial_market_learnings").select("*")
            .eq("tenant_id", tenant_id).eq("market_id", market_id)
            .gte("confidence", MIN_CONFIDENCE)
            .order("confidence", desc=True).execute().data or [])

    patterns: Dict[str, Any] = {}
    for r in rows:
        patterns[r["pattern_key"]] = {
            "signal":      r["signal_payload"],
            "confidence":  float(r["confidence"]),
            "sample_size": r["sample_size"],
        }

    out = {
        "module": "memory_injector",
        "label":  "Market Learning",
        "weight": "advisory",
        "patterns": patterns,
        "directive": (
            "Consider these observed patterns as ADVISORY signals, never as "
            "directives. If a pattern says 'preferred_pacing=ceremonial' with "
            "confidence 0.62, lean towards ceremonial pacing — but the Master "
            "Direction and Sensory Atmosphere still take precedence. Do not "
            "name these patterns in the output prose."
        ),
    }
    if not patterns:
        out["directive"] += " (No patterns yet — this market is in cold-start.)"
    return out
