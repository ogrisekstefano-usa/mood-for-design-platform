"""Blueprint Presentation Engine™ — Transition Registry.

Code-defined cinematic transitions for the multi-page moodboard presentation
mode. Each entry exposes:

  - id:           stable key persisted on `moodboard_pages.settings.transition_in/out`
  - label_key:    i18n key for the editor selector
  - duration_ms:  default base duration; overridable per-page
  - easing:       CSS cubic-bezier — premium, slow, never gaming-fast
  - css:          objects with `from` / `to` keyframe states the frontend
                  applies directly via inline style. Uses GPU-only props
                  (opacity / transform / filter) — never layout-thrashing.

The frontend reads this catalog once at presentation boot via
`GET /api/moodboards/_meta/presentation_transitions` and animates pages by
interpolating between `from` and `to`. NEVER hardcode transitions in JSX.
"""
from typing import Dict, List, Any

# Editorial easing — slow ease-out, architectural, never bouncy.
_PREMIUM_EASE = "cubic-bezier(0.22, 1, 0.36, 1)"

PRESENTATION_TRANSITIONS: List[Dict[str, Any]] = [
    {
        "id": "fade",
        "label_key": "moodboards.presentation.transition.fade",
        "duration_ms": 700,
        "easing": _PREMIUM_EASE,
        "css": {
            "from": {"opacity": 0},
            "to":   {"opacity": 1},
        },
    },
    {
        "id": "dissolve",
        "label_key": "moodboards.presentation.transition.dissolve",
        "duration_ms": 900,
        "easing": _PREMIUM_EASE,
        # Same as fade in shape but longer + softer — UX-distinct from fade.
        "css": {
            "from": {"opacity": 0, "filter": "blur(2px)"},
            "to":   {"opacity": 1, "filter": "blur(0px)"},
        },
    },
    {
        "id": "slow_slide_left",
        "label_key": "moodboards.presentation.transition.slow_slide_left",
        "duration_ms": 800,
        "easing": _PREMIUM_EASE,
        "css": {
            "from": {"opacity": 0, "transform": "translate3d(-6%, 0, 0)"},
            "to":   {"opacity": 1, "transform": "translate3d(0, 0, 0)"},
        },
    },
    {
        "id": "slow_slide_up",
        "label_key": "moodboards.presentation.transition.slow_slide_up",
        "duration_ms": 800,
        "easing": _PREMIUM_EASE,
        "css": {
            "from": {"opacity": 0, "transform": "translate3d(0, 4%, 0)"},
            "to":   {"opacity": 1, "transform": "translate3d(0, 0, 0)"},
        },
    },
    {
        "id": "cinematic_zoom",
        "label_key": "moodboards.presentation.transition.cinematic_zoom",
        "duration_ms": 1000,
        "easing": _PREMIUM_EASE,
        "css": {
            "from": {"opacity": 0, "transform": "scale(1.04)"},
            "to":   {"opacity": 1, "transform": "scale(1)"},
        },
    },
    {
        "id": "soft_blur_crossfade",
        "label_key": "moodboards.presentation.transition.soft_blur_crossfade",
        "duration_ms": 900,
        "easing": _PREMIUM_EASE,
        "css": {
            "from": {"opacity": 0, "filter": "blur(8px)"},
            "to":   {"opacity": 1, "filter": "blur(0px)"},
        },
    },
]


def get_transition(transition_id: str) -> Dict[str, Any]:
    """Lookup by id with safe fallback to 'fade' (never raise — presentation
    must never break because of a stale transition key)."""
    for t in PRESENTATION_TRANSITIONS:
        if t["id"] == transition_id:
            return t
    return PRESENTATION_TRANSITIONS[0]  # fade — always available


VALID_TRANSITION_IDS = {t["id"] for t in PRESENTATION_TRANSITIONS}
