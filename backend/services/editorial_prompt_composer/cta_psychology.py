"""cta_psychology — how invitations should be staged.

CTAs are not buttons. They are editorial transitions. The composer
specifies which tiers/intents are appropriate for the market and how
each tier should be FRAMED (the surrounding paragraph), not just
LABELLED.
"""
from typing import Any, Dict, List

CTA_PATTERNS = {
    "italy": {
        "preferred_tiers":  ["soft", "medium", "strong"],
        "preferred_intents":["book_showroom_visit", "request_design_advice", "book_discovery_session"],
        "framing":          "An invitation to the showroom, on appointment. Slow, unhurried.",
    },
    "dach": {
        "preferred_tiers":  ["medium", "strong"],
        "preferred_intents":["send_your_floor_plan", "request_design_advice", "book_discovery_session"],
        "framing":          "A precise offer of evidence (site visit, technical sheet, planning meeting).",
    },
    "france_fr_europe": {
        "preferred_tiers":  ["soft", "strong"],
        "preferred_intents":["request_more_information", "book_discovery_session"],
        "framing":          "A consultation sur rendez-vous, confidentially extended.",
    },
    "uk_ireland": {
        "preferred_tiers":  ["soft", "medium"],
        "preferred_intents":["request_more_information", "book_showroom_visit", "request_design_advice"],
        "framing":          "An enquiry-led invitation. 'Enquire' more than 'Book'.",
    },
    "usa_national": {
        "preferred_tiers":  ["soft", "medium", "strong"],
        "preferred_intents":["discover_collections", "share_your_inspiration", "start_your_project"],
        "framing":          "A confident consultation invitation, lifestyle-led.",
    },
    "usa_east_coast": {
        "preferred_tiers":  ["medium", "strong"],
        "preferred_intents":["request_design_advice", "book_discovery_session"],
        "framing":          "A considered consultation invitation, pedigree-aware.",
    },
    "usa_south_florida": {
        "preferred_tiers":  ["soft", "strong"],
        "preferred_intents":["book_showroom_visit", "book_discovery_session"],
        "framing":          "A waterfront-private consultation invitation.",
    },
    "usa_west_coast": {
        "preferred_tiers":  ["soft", "medium"],
        "preferred_intents":["discover_collections", "share_your_inspiration"],
        "framing":          "An unhurried, slow-Sunday consultation invitation.",
    },
    "gcc_luxury": {
        "preferred_tiers":  ["soft", "strong"],
        "preferred_intents":["speak_with_our_team", "book_discovery_session"],
        "framing":          "A ceremonial, discreet invitation to private consultation.",
    },
    "central_america": {
        "preferred_tiers":  ["soft", "medium"],
        "preferred_intents":["contact_studio", "request_design_advice"],
        "framing":          "A warm, personal invitation (usted register).",
    },
    "spanish_latam": {
        "preferred_tiers":  ["soft", "medium", "strong"],
        "preferred_intents":["contact_studio", "request_design_advice", "book_discovery_session"],
        "framing":          "A literary-considered consultation invitation.",
    },
    "brazil": {
        "preferred_tiers":  ["soft", "medium"],
        "preferred_intents":["discover_collections", "share_your_inspiration"],
        "framing":          "An open, lyrical invitation to a Studio visit.",
    },
    "scandinavia": {
        "preferred_tiers":  ["soft", "medium"],
        "preferred_intents":["request_more_information", "book_showroom_visit"],
        "framing":          "A calm enquiry-led invitation. Honest, plain-spoken.",
    },
}


def fragment(market: Dict[str, Any], requested_cta_set: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    code = market.get("code")
    pattern = CTA_PATTERNS.get(code) or {
        "preferred_tiers":   ["soft", "medium", "strong"],
        "preferred_intents": ["contact_studio", "request_design_advice", "book_discovery_session"],
        "framing":           "A considered, editorial consultation invitation.",
    }
    return {
        "module": "cta_psychology",
        "label":  "Invitation Psychology",
        "weight": "primary",
        "preferred_tiers":   pattern["preferred_tiers"],
        "preferred_intents": pattern["preferred_intents"],
        "framing":           pattern["framing"],
        "requested_cta_set": requested_cta_set or [],
        "directive": (
            "Compose THREE CTA blocks for the variant — one per preferred_tier "
            "in the order preferred_tiers. Each CTA carries: id (slug), tier, "
            "label (market-native), action, cta_intent (must be one of the "
            "preferred_intents), framing_paragraph (1-2 sentences that "
            "EDITORIALLY transition into the CTA, never marketing-y). The "
            "framing is luxury-consultative, not conversion-aggressive."
        ),
    }
