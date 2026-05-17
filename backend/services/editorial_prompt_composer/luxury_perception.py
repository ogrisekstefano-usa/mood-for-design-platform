"""luxury_perception — what counts as luxury HERE.

"Luxury" is not universal. In DACH, luxury reads as authenticity and
material truth. In GCC, as ceremonial scale and statement materials. In
Scandinavia, as hygge restraint and craft. The composer needs this lens
to avoid the cliché of "international luxury" voice that everyone hates.
"""
from typing import Any, Dict

LUXURY_LENSES = {
    "italy":            {"signal": "craft + materia + sprezzatura",  "anti_signal": "ostentation, branding-first"},
    "dach":             {"signal": "authenticity + precision + provenance", "anti_signal": "theatrical decor, glitter"},
    "france_fr_europe": {"signal": "codes + savoir-faire + discretion",     "anti_signal": "American grandeur, billboards"},
    "uk_ireland":       {"signal": "heritage + understated authority",     "anti_signal": "show-off, new money signals"},
    "usa_national":     {"signal": "elevated lifestyle + curated experience","anti_signal": "industrial coldness, austerity"},
    "usa_east_coast":   {"signal": "prewar pedigree + sophistication",      "anti_signal": "tech bro modernism, surf"},
    "usa_south_florida":{"signal": "waterfront resort luxury + indoor-outdoor flow","anti_signal": "alpine, heavy textiles"},
    "usa_west_coast":   {"signal": "canyon modernism + understated affluence","anti_signal": "East-Coast formality, gold trim"},
    "gcc_luxury":       {"signal": "scale + reflective materials + ceremonial signature","anti_signal": "minimalism that reads as poverty"},
    "central_america":  {"signal": "colonial heritage + warm hospitality + bespoke","anti_signal": "Nordic restraint, monochrome"},
    "spanish_latam":    {"signal": "modernist heritage + literary refinement","anti_signal": "GCC opulence, US aspirational tropes"},
    "brazil":           {"signal": "tropical modernism + sensual materiality","anti_signal": "minimalism without softness"},
    "scandinavia":      {"signal": "craft + hygge + light-honesty + restraint","anti_signal": "gold ornament, ceremonial cadence"},
}


def fragment(market: Dict[str, Any]) -> Dict[str, Any]:
    code = market.get("code")
    lens = LUXURY_LENSES.get(code) or {
        "signal": "editorial restraint + craft",
        "anti_signal": "ostentation, hard sell",
    }
    return {
        "module": "luxury_perception",
        "label":  "Luxury Perception",
        "weight": "primary",
        "lens":   lens,
        "directive": (
            "Project luxury through the SIGNAL only. Treat the ANTI_SIGNAL as a "
            "lexical and tonal allergy: avoid those frames, metaphors, and "
            "adjectives. Luxury in this market is what is implied, not what is "
            "claimed."
        ),
    }
