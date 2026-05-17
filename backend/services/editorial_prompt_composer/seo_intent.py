"""seo_intent — editorial-grade intent, NEVER keyword spam.

The composer prepares structured seo metadata: seo_title (editorial,
NOT keyword-stuffed), meta_description (≤155 chars, narrative), hreflang
(target_locale), and focus_intent (the cultural-search intent we believe
this market expresses on this topic).

This is intentionally light. SEO must serve the editorial, not the other
way around.
"""
from typing import Any, Dict


def fragment(master: Dict[str, Any], market: Dict[str, Any], target_locale: str) -> Dict[str, Any]:
    market_seo = market.get("seo_intent") or {}
    master_seo = master.get("seo_intent") or {}
    return {
        "module": "seo_intent",
        "label":  "Editorial SEO",
        "weight": "secondary",
        "hreflang":        target_locale,
        "market_keywords": market_seo.get("keywords_primary") or [],
        "master_intent":   master_seo,
        "directive": (
            "Compose seo.seo_title as a HEADLINE that an editor would publish, "
            "never a keyword stack. Compose seo.meta_description as a "
            "single-sentence narrative ≤ 155 chars that reads naturally. Set "
            "seo.focus_intent to a single noun phrase describing the cultural "
            "search intent for this market. hreflang is fixed to the "
            "target_locale (BCP-47). Do NOT keyword-stuff."
        ),
    }
