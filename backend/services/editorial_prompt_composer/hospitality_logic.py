"""hospitality_logic — how the market expects to be welcomed.

Different markets have different "welcome codes" — the implicit pact a
luxury publication makes with the reader on the first paragraph.

This is not optional copy: it changes how the article opens, paces, and
closes. Italian readers expect understated craft. GCC readers expect
ceremonial arrival. Aspen readers expect intimate, fire-lit warmth.
"""
from typing import Any, Dict

# Curated hospitality codes per market.code. Editorial knowledge, not AI.
HOSPITALITY_CODES = {
    "italy": {
        "welcome_register": "understated · maestro greeting the studio guest",
        "opening_gesture":  "a remark on light, materia, or a craft anecdote",
        "closing_gesture":  "an invitation to walk the showroom slowly",
        "what_to_avoid":    "hard sell, exclamation marks, exuberance",
    },
    "dach": {
        "welcome_register": "precise · professional · zero ostentation",
        "opening_gesture":  "a clear statement of competence and intent",
        "closing_gesture":  "an offer of evidence (technical sheet, site visit)",
        "what_to_avoid":    "florid prose, vague claims, theatrical staging",
    },
    "france_fr_europe": {
        "welcome_register": "sophisticated · confidential · maître greeting an initiate",
        "opening_gesture":  "a literary or art-historical reference",
        "closing_gesture":  "an invitation 'sur rendez-vous'",
        "what_to_avoid":    "American casualness, all-caps marketing terms",
    },
    "uk_ireland": {
        "welcome_register": "dry-wit broadsheet · understated authority",
        "opening_gesture":  "an editorial framing, slightly oblique",
        "closing_gesture":  "an enquiry-style invitation (Enquire / Book a viewing)",
        "what_to_avoid":    "American superlatives, 'amazing', 'awesome'",
    },
    "usa_national": {
        "welcome_register": "aspirational · confident · magazine voice",
        "opening_gesture":  "a vivid lifestyle image or experience promise",
        "closing_gesture":  "a clear consultation invitation",
        "what_to_avoid":    "self-effacement, technical jargon up front",
    },
    "usa_east_coast": {
        "welcome_register": "editorial-broadsheet · cosmopolitan",
        "opening_gesture":  "an architectural or prewar reference",
        "closing_gesture":  "an in-person consultation invitation",
        "what_to_avoid":    "California breeziness, surf metaphors",
    },
    "usa_south_florida": {
        "welcome_register": "warm aspirational · resort-living promise",
        "opening_gesture":  "light, water, indoor-outdoor flow imagery",
        "closing_gesture":  "an invitation to a private waterfront viewing",
        "what_to_avoid":    "alpine references, heavy textiles, austerity",
    },
    "usa_west_coast": {
        "welcome_register": "editorial-warm · canyon modernism · slow Sunday",
        "opening_gesture":  "an image of indoor-outdoor living, golden light",
        "closing_gesture":  "an unhurried consultation invitation",
        "what_to_avoid":    "East-Coast formality, prewar references",
    },
    "gcc_luxury": {
        "welcome_register": "ceremonial · majlis-grade hospitality · reverent",
        "opening_gesture":  "an honorific framing, evocation of arrival",
        "closing_gesture":  "a private appointment offered with discretion",
        "what_to_avoid":    "casual familiarity, populist language, irreverence",
    },
    "central_america": {
        "welcome_register": "warm-aspirational · tropical colonial codes",
        "opening_gesture":  "patio, indoor-outdoor, talavera or terracotta cue",
        "closing_gesture":  "a personal consultation invitation (usted)",
        "what_to_avoid":    "Nordic restraint, monochrome austerity",
    },
    "spanish_latam": {
        "welcome_register": "literary-warm · botanical luxury heritage",
        "opening_gesture":  "a modernist heritage cue (Niemeyer, Barragán)",
        "closing_gesture":  "a cita on the Studio's terms (usted)",
        "what_to_avoid":    "GCC ceremoniality, US lifestyle aspiration tropes",
    },
    "brazil": {
        "welcome_register": "lyrical-warm · botanical sensuality",
        "opening_gesture":  "tropical modernism cue · light through foliage",
        "closing_gesture":  "an open invitation to schedule a visit",
        "what_to_avoid":    "alpine references, GCC ceremoniality",
    },
    "scandinavia": {
        "welcome_register": "plain-spoken · light-first · honest materials",
        "opening_gesture":  "a quiet observation on light, hygge, or craft",
        "closing_gesture":  "a calm invitation (Enquire)",
        "what_to_avoid":    "Latin exuberance, gold ornament, ceremonial cadence",
    },
}


def fragment(market: Dict[str, Any], sub_region: Dict[str, Any] = None) -> Dict[str, Any]:
    code = market.get("code")
    codes = HOSPITALITY_CODES.get(code) or {
        "welcome_register": "editorial · confident · understated",
        "opening_gesture":  "an image-led editorial opening",
        "closing_gesture":  "a clear, polite invitation",
        "what_to_avoid":    "hard sell, exclamation marks",
    }
    return {
        "module": "hospitality_logic",
        "label":  "Hospitality Tone",
        "weight": "primary",
        "codes":  codes,
        "directive": (
            "The opening paragraph IS the welcome. Honour the welcome_register; "
            "use the opening_gesture as a guidance, never as a script. Close with "
            "the closing_gesture. Avoid the what_to_avoid items entirely — they "
            "break trust with this market's reader."
        ),
    }
