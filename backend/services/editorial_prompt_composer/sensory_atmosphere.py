"""sensory_atmosphere — light, tactility, spatial feeling, emotional pacing.

This is the module that prevents a variant from feeling "translated". A
Miami article BREATHES luminosity and indoor-outdoor flow; an Aspen
article COILS into tactile warmth; a Dubai article ARRIVES ceremonially.

Without this layer the AI defaults to generic "warm light, natural
materials" everywhere — the death sentence for luxury credibility.
"""
from typing import Any, Dict

ATMOSPHERE_LIBRARY = {
    # ── Europe ──────────────────────────────────────────────────────────
    "italy": {
        "light":           "Mediterranean afternoon · golden raking light",
        "tactility":       "raw linen · honed travertine · oiled walnut",
        "spatial_feeling": "intimate enfilade · long sightlines · loggia",
        "lighting_vocab":  ["taglio di luce", "controluce", "ombra calda"],
        "emotional_pacing":"slow editorial · breath between sentences",
        "sensuality":      "materia parla da sé · gesto sobrio",
    },
    "dach": {
        "light":           "northern · crisp · architectural clarity",
        "tactility":       "smooth lacquer · honed stone · brushed metal",
        "spatial_feeling": "ordered · proportional · rigorous",
        "lighting_vocab":  ["Tageslicht", "präzise Beleuchtung", "klare Linien"],
        "emotional_pacing":"precise · measured · few but decisive sentences",
        "sensuality":      "Ehrlichkeit der Materialien · Substanz statt Effekt",
    },
    "france_fr_europe": {
        "light":           "Parisian grey-blue · soft northern · grand mirror reflections",
        "tactility":       "patiné · linen · stuc à la chaux · velours",
        "spatial_feeling": "appartement haussmannien · enfilade · moulures",
        "lighting_vocab":  ["lumière tamisée", "clair-obscur", "patine de lumière"],
        "emotional_pacing":"literary · long sentences · oblique punchlines",
        "sensuality":      "savoir-faire · matière · discrétion",
    },
    "uk_ireland": {
        "light":           "soft overcast · weathered · north-light interiors",
        "tactility":       "aged oak · wool · tweed · brass with patina",
        "spatial_feeling": "townhouse proportions · drawing room · garden room",
        "lighting_vocab":  ["dappled light", "evening glow", "lamplight"],
        "emotional_pacing":"broadsheet · dry · short paragraphs · oblique wit",
        "sensuality":      "patina · provenance · the long view",
    },
    "scandinavia": {
        "light":           "long-shadow Nordic · low winter sun · luminous summer",
        "tactility":       "pale oak · wool boucle · lime plaster · linen sheers",
        "spatial_feeling": "uncluttered · pared-back · light-first rooms",
        "lighting_vocab":  ["hygge glow", "candle dusk", "long-shadow morning"],
        "emotional_pacing":"plain-spoken · short · honest · zero adornment",
        "sensuality":      "honesty of material · light over decoration",
    },
    # ── North America ──────────────────────────────────────────────────
    "usa_national": {
        "light":           "natural daylight · architectural framing",
        "tactility":       "honed limestone · white oak · linen · brushed brass",
        "spatial_feeling": "open-plan · indoor-outdoor · gracious proportions",
        "lighting_vocab":  ["golden hour", "sunlit", "lantern glow"],
        "emotional_pacing":"aspirational · confident · cinematic openings",
        "sensuality":      "elevated everyday · curated living",
    },
    "usa_east_coast": {
        "light":           "prewar interiors · tall windows · sea-light Hamptons",
        "tactility":       "herringbone oak · marble · brass · velvet",
        "spatial_feeling": "prewar grandeur · enfilade · library proportions",
        "lighting_vocab":  ["library lamplight", "prewar dusk", "sea-glass light"],
        "emotional_pacing":"editorial-broadsheet · considered · cosmopolitan",
        "sensuality":      "patina · pedigree · the slow Sunday",
    },
    "usa_south_florida": {
        "light":           "tropical · luminous · water-reflected · indoor-outdoor",
        "tactility":       "travertine · rattan · linen sheers · coral stone",
        "spatial_feeling": "resort living · pool deck flow · airy verandas",
        "lighting_vocab":  ["sun-soaked", "waterfront glow", "lantern terrace"],
        "emotional_pacing":"warm aspirational · cinematic openings",
        "sensuality":      "tropical warmth · indoor-outdoor fluidity · waterfront ease",
    },
    "usa_west_coast": {
        "light":           "California golden · canyon afternoon · Pacific haze",
        "tactility":       "white oak · lime plaster · boucle · patinated brass",
        "spatial_feeling": "canyon modernism · indoor-outdoor · sun-warmed",
        "lighting_vocab":  ["golden hour", "canyon dusk", "sun-warmed terracotta"],
        "emotional_pacing":"editorial-warm · slow Sunday cadence · unhurried",
        "sensuality":      "indoor-outdoor ease · sun-warmed materials · tactile warmth",
    },
    "aspen_mountain_luxury": {  # used when sub_region matches
        "light":           "alpine winter · fire-lit interiors · snow-reflected",
        "tactility":       "shou-sugi-ban · sheepskin · cashmere throw · sculptural stone",
        "spatial_feeling": "intimate retreat · fireplace as gravity · layered textures",
        "lighting_vocab":  ["firelight", "snow-glow", "lantern dusk"],
        "emotional_pacing":"slow · intimate · close · firelit",
        "sensuality":      "tactile warmth · layered textures · intimate hospitality",
    },
    # ── MENA ───────────────────────────────────────────────────────────
    "gcc_luxury": {
        "light":           "polished marble reflection · golden hour glow · alabaster transparency",
        "tactility":       "sculptural travertine · onyx · rosewood · brushed gold",
        "spatial_feeling": "ceremonial arrival · majlis hospitality · grand scale",
        "lighting_vocab":  ["alabaster glow", "polished reflection", "lantern arrival"],
        "emotional_pacing":"ceremonial · reverent · grand openings · honorific cadence",
        "sensuality":      "ceremonial materiality · reflective luxury · sculptural presence",
    },
    # ── LatAm ──────────────────────────────────────────────────────────
    "central_america": {
        "light":           "tropical · filtered through bougainvillea · patio glow",
        "tactility":       "talavera · terracotta · tropical hardwoods · rattan",
        "spatial_feeling": "colonial patio · indoor-outdoor · breeze-cooled corridors",
        "lighting_vocab":  ["luz filtrada", "patio dorado", "amanecer tropical"],
        "emotional_pacing":"warm · welcoming · usted-cadence",
        "sensuality":      "artesanal warmth · tropical hospitality · colonial intimacy",
    },
    "spanish_latam": {
        "light":           "Argentine afternoon · Andean clarity · Caribbean glow",
        "tactility":       "Argentine oak · stoneware · linen · patinated bronze",
        "spatial_feeling": "modernist proportions · Niemeyer arcs · Barragán colour",
        "lighting_vocab":  ["luz tamizada", "tarde modernista", "patio botánico"],
        "emotional_pacing":"literary · refined · usted/vos register",
        "sensuality":      "modernist heritage · botanical luxury · literary depth",
    },
    "brazil": {
        "light":           "Rio afternoon · light through Atlantic foliage · São Paulo dusk",
        "tactility":       "jacarandá · stone · linen · fired clay",
        "spatial_feeling": "tropical modernism · pavilions · sliding glass walls",
        "lighting_vocab":  ["luz tropical", "claridade", "tarde modernista"],
        "emotional_pacing":"lyrical · sensual · open vowels",
        "sensuality":      "tropical sensuality · botanical luxury · open-air ease",
    },
}


def fragment(market: Dict[str, Any], sub_region: Dict[str, Any] = None) -> Dict[str, Any]:
    """Resolve the atmosphere palette.

    Resolution order:
      1. sub_region.code (if provided & known) — e.g. 'aspen_mountain_luxury'
      2. market.code
      3. Generic luxury-editorial fallback (rare).
    """
    chosen = None
    if sub_region:
        chosen = ATMOSPHERE_LIBRARY.get(sub_region.get("code"))
    if not chosen:
        chosen = ATMOSPHERE_LIBRARY.get(market.get("code"))
    if not chosen:
        chosen = {
            "light":           "considered natural light",
            "tactility":       "honed stone · oak · linen",
            "spatial_feeling": "considered proportions",
            "lighting_vocab":  ["natural light", "golden hour"],
            "emotional_pacing":"measured · editorial",
            "sensuality":      "material truth · craft",
        }
    return {
        "module": "sensory_atmosphere",
        "label":  "Sensory Atmosphere",
        "weight": "primary",
        "atmosphere": chosen,
        "directive": (
            "Let the variant BREATHE this atmosphere. Reach for the lighting_vocab "
            "(but never list it). Pace sentences to match emotional_pacing. The "
            "sensuality phrase is the article's spinal cord — every paragraph "
            "should resonate with it. NEVER describe the atmosphere directly "
            "('the warm light…') — let it inhabit the prose."
        ),
    }
