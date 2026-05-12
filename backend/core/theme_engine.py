"""Theme Engine — full design-system tokens for a tenant.

Tokens are stored in `tenant_settings.key='theme'` as JSON. The shape is
versioned so future migrations are non-destructive. Frontend reads this
config via `/api/blueprint/tenant/me` and applies it as CSS custom properties.
"""
from typing import Dict, Any


# ── Default Blueprint OS theme (luxury dark / editorial) ─────────────────────
DEFAULT_THEME: Dict[str, Any] = {
    "version": 1,
    "mode": "dark",  # dark | light (future)

    # Palette ────────────────────────────────────────────────────────────────
    "palette": {
        "primary": "#26F5C9",       # MOOD teal — brand
        "accent":  "#B8977A",       # warm beige editorial
        "background": "#0A0A0B",    # near-black canvas
        "surface_1": "#141416",     # cards
        "surface_2": "#1C1C1F",     # elevated
        "surface_3": "#222226",     # hover/focus
        "border":   "rgba(255,255,255,0.06)",
        "border_strong": "rgba(255,255,255,0.12)",
        "text_primary":   "#EFEBE4",
        "text_secondary": "#A19D98",
        "text_muted":     "#6B6863",
        "text_subtle":    "#4A4845",
        "success": "#22C55E",
        "warning": "#F59E0B",
        "danger":  "#EF4444",
    },

    # Typography ─────────────────────────────────────────────────────────────
    "typography": {
        "font_heading": "'Cormorant Garamond', Georgia, serif",
        "font_body":    "'Manrope', system-ui, sans-serif",
        "font_mono":    "'JetBrains Mono', ui-monospace, monospace",
        "font_size_base": 14,          # px
        "line_height_base": 1.55,
        "letter_spacing_heading": "-0.01em",
        "letter_spacing_body": "0em",
        "letter_spacing_caps": "0.12em",
    },

    # Shape ──────────────────────────────────────────────────────────────────
    "shape": {
        "radius_xs": "2px",
        "radius_sm": "3px",
        "radius_md": "6px",
        "radius_lg": "10px",
        "radius_xl": "16px",
        "radius_pill": "9999px",
    },

    # Spacing ────────────────────────────────────────────────────────────────
    "spacing": {
        "scale": "comfortable",  # compact | comfortable | spacious
        "unit": 4,               # px
    },

    # Elevation ──────────────────────────────────────────────────────────────
    "elevation": {
        "sm": "0 1px 2px rgba(0,0,0,0.4)",
        "md": "0 4px 14px rgba(0,0,0,0.5)",
        "lg": "0 12px 40px rgba(0,0,0,0.65)",
    },

    # Motion ─────────────────────────────────────────────────────────────────
    "motion": {
        "preset": "standard",  # subtle | standard | expressive
        "duration_fast":   "120ms",
        "duration_normal": "180ms",
        "duration_slow":   "280ms",
        "ease": "cubic-bezier(0.16, 1, 0.3, 1)",
    },

    # Component variants ─────────────────────────────────────────────────────
    "components": {
        "button_style": "sharp",   # sharp | pill | ghost
        "card_style":   "subtle",  # subtle | bordered | elevated
        "ui_density":   "comfortable",  # compact | comfortable | spacious
    },

    # Brand assets ───────────────────────────────────────────────────────────
    "assets": {
        "logo_dark":   None,   # url shown on dark backgrounds
        "logo_light":  None,   # url shown on light backgrounds
        "logo_mobile": None,
        "favicon":     None,
        "og_image":    None,
    },
}


def deep_merge(base: dict, override: dict) -> dict:
    """Recursive merge keeping base shape and overriding leaves."""
    if not isinstance(override, dict):
        return base
    out = {**base}
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def resolve_theme(tenant_overrides: dict) -> dict:
    """Returns the effective theme = defaults deep-merged with tenant overrides."""
    return deep_merge(DEFAULT_THEME, tenant_overrides or {})


# ── Curated Google Fonts catalog (luxury / editorial / modern) ───────────────
GOOGLE_FONTS_CATALOG = [
    {"family": "Cormorant Garamond", "category": "serif", "weights": [300, 400, 500, 700]},
    {"family": "Playfair Display",   "category": "serif", "weights": [400, 500, 600, 700]},
    {"family": "EB Garamond",        "category": "serif", "weights": [400, 500, 600]},
    {"family": "Cormorant",          "category": "serif", "weights": [300, 400, 500, 700]},
    {"family": "Libre Caslon Text",  "category": "serif", "weights": [400, 700]},
    {"family": "Tenor Sans",         "category": "sans-serif", "weights": [400]},
    {"family": "Manrope",            "category": "sans-serif", "weights": [300, 400, 500, 600, 700]},
    {"family": "Inter",              "category": "sans-serif", "weights": [400, 500, 600, 700]},
    {"family": "Sora",               "category": "sans-serif", "weights": [300, 400, 500, 600]},
    {"family": "Space Grotesk",      "category": "sans-serif", "weights": [400, 500, 600, 700]},
    {"family": "Outfit",             "category": "sans-serif", "weights": [300, 400, 500, 600, 700]},
    {"family": "Archivo",            "category": "sans-serif", "weights": [400, 500, 600, 700]},
    {"family": "Syne",               "category": "sans-serif", "weights": [400, 500, 700, 800]},
    {"family": "Italiana",           "category": "serif", "weights": [400]},
    {"family": "Bodoni Moda",        "category": "serif", "weights": [400, 500, 600, 700]},
    {"family": "JetBrains Mono",     "category": "monospace", "weights": [400, 500, 600]},
]
