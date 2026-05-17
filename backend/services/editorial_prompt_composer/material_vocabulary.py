"""material_vocabulary — the materials the market actually recognises.

A travertino reference reads as luxury in Italy; a Texan reader needs the
material reframed (e.g. limestone, ranchero, "honey-toned stone"). The
composer pulls a market-specific palette so the article speaks the
market's own material language.
"""
from typing import Any, Dict, List

MATERIAL_PALETTES = {
    "italy":            ["travertino romano", "noce massello", "marmo Calacatta", "lino grezzo", "ottone brunito", "cemento spatolato"],
    "dach":             ["solid oak", "smoked walnut", "Jura limestone", "tactile linen", "blackened steel", "polished concrete"],
    "france_fr_europe": ["pierre de Bourgogne", "chêne fumé", "lin lavé", "laiton patiné", "marbre Carrare", "stuc à la chaux"],
    "uk_ireland":       ["aged oak", "Portland stone", "wool boucle", "antique brass", "Welsh slate", "shou-sugi-ban timber"],
    "usa_national":     ["walnut", "honed limestone", "linen", "antique bronze", "white oak", "natural plaster"],
    "usa_east_coast":   ["walnut paneling", "Calacatta marble", "antique brass", "shagreen", "herringbone oak", "boucle"],
    "usa_south_florida":["travertine", "coral stone", "natural rattan", "white oak", "linen sheers", "polished concrete"],
    "usa_west_coast":   ["white oak", "limestone", "lime plaster", "natural travertine", "boucle", "patinated brass"],
    "gcc_luxury":       ["onyx", "polished marble", "antique gold", "rosewood", "sculptural travertine", "alabaster"],
    "central_america":  ["talavera", "terracotta", "tropical hardwood", "natural lime plaster", "rattan", "stoneware"],
    "spanish_latam":    ["walnut", "stoneware", "natural travertine", "Argentine oak", "linen", "patinated bronze"],
    "brazil":           ["jacarandá", "natural stone", "linen", "carnauba-finished hardwood", "fired clay", "polished concrete"],
    "scandinavia":      ["pale oak", "ash", "wool boucle", "lime plaster", "blackened iron", "linen sheers"],
}

ANCHOR_VOCAB = {
    "italy":            {"prefer": "materia · maestria · gesto",          "avoid": "premium · exclusive (overused EN)"},
    "dach":             {"prefer": "Qualität · Material · Substanz",      "avoid": "luxurious (overpromise)"},
    "france_fr_europe": {"prefer": "matière · patine · savoir-faire",     "avoid": "haut de gamme (cliché)"},
    "uk_ireland":       {"prefer": "patina · provenance · heritage",      "avoid": "luxury (overused) — prefer 'considered'"},
    "usa_national":     {"prefer": "honed · curated · elevated",          "avoid": "fancy · upscale (read as marketing)"},
    "usa_east_coast":   {"prefer": "considered · refined · enduring",     "avoid": "trendy · hot"},
    "usa_south_florida":{"prefer": "luminous · airy · resort-grade",      "avoid": "cozy · alpine"},
    "usa_west_coast":   {"prefer": "tactile · sun-warmed · understated",  "avoid": "formal · traditional"},
    "gcc_luxury":       {"prefer": "ceremonial · sculptural · bespoke",   "avoid": "modest · plain"},
    "central_america":  {"prefer": "artesanal · cálido · luminoso",       "avoid": "industrial · frío"},
    "spanish_latam":    {"prefer": "modernista · culto · refinado",       "avoid": "comercial · llamativo"},
    "brazil":           {"prefer": "tropical · sensual · matérico",       "avoid": "rígido · austero"},
    "scandinavia":      {"prefer": "honest · light · pared-back",         "avoid": "ornate · ceremonial"},
}


def fragment(market: Dict[str, Any]) -> Dict[str, Any]:
    code = market.get("code")
    palette: List[str] = MATERIAL_PALETTES.get(code, [])
    anchors = ANCHOR_VOCAB.get(code, {"prefer": "considered · refined", "avoid": "hard sell, generic luxury"})
    return {
        "module": "material_vocabulary",
        "label":  "Material Language",
        "weight": "secondary",
        "palette":     palette,
        "lexicon":     anchors,
        "directive": (
            "Reach for the PALETTE materials when naming surfaces, textures, or "
            "architectural elements. Avoid materials outside this palette unless "
            "the Master Direction explicitly invokes them. Use lexicon.PREFER "
            "words; treat lexicon.AVOID as forbidden."
        ),
    }
