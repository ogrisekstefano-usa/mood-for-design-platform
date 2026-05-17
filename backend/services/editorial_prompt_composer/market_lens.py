"""market_lens — the market's cultural register.

Reads the market's own `cultural_profile` + `tone_of_voice` + `cta_style`
+ `seo_intent` from the markets table. These were curated, not generated
— they encode MOOD's editorial knowledge of each region.
"""
from typing import Any, Dict


def fragment(market: Dict[str, Any], sub_region: Dict[str, Any] = None) -> Dict[str, Any]:
    out = {
        "module": "market_lens",
        "label":  "Market Perspective",
        "weight": "primary",
        "market_code":      market.get("code"),
        "primary_locale":   market.get("primary_locale"),
        "fallback_locale":  market.get("fallback_locale"),
        "macro_region":     market.get("macro_region"),
        "countries":        market.get("countries"),
        "currency":         market.get("currency"),
        "measurement_system": market.get("measurement_system"),
        "cultural_profile": market.get("cultural_profile") or {},
        "tone_of_voice":    market.get("tone_of_voice") or {},
        "cta_style":        market.get("cta_style") or {},
        "seo_intent":       market.get("seo_intent") or {},
        "directive": (
            "Adopt this market's editorial register entirely: vocabulary, "
            "pronoun, cadence, sentence length, cultural references. Do NOT "
            "default to a generic 'international English' tone. If the market "
            "uses 'you (formal)' or 'usted', honour it. If pacing is "
            "'measured' or 'ceremonial', match it."
        ),
    }
    if sub_region:
        out["sub_region"] = {
            "code":               sub_region.get("code"),
            "display_name":       sub_region.get("display_name"),
            "cities_anchor":      sub_region.get("cities_anchor"),
            "cultural_profile":   sub_region.get("cultural_profile"),
            "aesthetic_pillars":  sub_region.get("aesthetic_pillars"),
        }
        out["directive"] += (
            f" Anchor visual and aspirational references to {sub_region.get('code')} "
            "specifically — its hospitality codes differ from the national level."
        )
    return out
