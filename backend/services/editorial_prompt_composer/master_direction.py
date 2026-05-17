"""master_direction — the central editorial intent.

The Master is NOT an article. It is a cultural DIRECTION that all market
variants reinterpret. This module surfaces the strategic intent so the
composer can write FROM it, not paraphrase it.
"""
from typing import Any, Dict


def fragment(master: Dict[str, Any]) -> Dict[str, Any]:
    seed = master.get("canonical_article_seed") or {}
    return {
        "module": "master_direction",
        "label":  "Editorial Direction",
        "weight": "primary",
        "intent": {
            "title":                   master.get("title"),
            "conceptual_direction":    master.get("conceptual_direction"),
            "emotional_objective":     master.get("emotional_objective") or {},
            "target_psychology":       master.get("target_psychology") or {},
            "architectural_tone":      master.get("architectural_tone") or {},
            "hospitality_positioning": master.get("hospitality_positioning") or {},
            "material_language":       master.get("material_language") or {},
            "cta_intent":              master.get("cta_intent") or {},
            "seo_intent":              master.get("seo_intent") or {},
            "taxonomy":                master.get("taxonomy") or {},
        },
        "canonical_seed": {
            "title":  seed.get("title"),
            "excerpt": seed.get("excerpt"),
            "body_outline": seed.get("body_outline") or seed.get("body_blocks"),
            "canonical_locale": master.get("canonical_locale"),
        },
        "directive": (
            "Treat this Direction as the editorial source. The variant must "
            "REINTERPRET it for the target market — never translate. Preserve "
            "the conceptual_direction and emotional_objective; restage "
            "everything else through the market lens."
        ),
    }
