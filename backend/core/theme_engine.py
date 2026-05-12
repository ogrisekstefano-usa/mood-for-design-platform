"""Theme Engine — full design-system tokens for a tenant.

Tokens are stored in `tenant_settings.key='theme'` as JSON. The shape is
versioned so future migrations are non-destructive. Frontend reads this
config via `/api/blueprint/tenant/me` and applies it as CSS custom properties.

Extended in v2 with editorial / atmosphere / motion-personality tokens
distilled from the luxury mockup analysis (May 2026).
"""
from typing import Dict, Any


# ── Default Blueprint OS theme (luxury dark / editorial / cinematic) ─────────
DEFAULT_THEME: Dict[str, Any] = {
    "version": 2,
    "mode": "dark",  # dark | light (future)

    # Palette ────────────────────────────────────────────────────────────────
    "palette": {
        "primary": "#26F5C9",       # MOOD teal — brand
        "accent":  "#B8977A",       # warm beige editorial
        "background": "#0A0A0B",    # near-black canvas
        "surface_1": "#141416",     # cards
        "surface_2": "#1C1C1F",     # elevated
        "surface_3": "#222226",     # hover/focus
        "overlay":   "rgba(8,8,10,0.72)",  # modal scrim / overlay
        "border":   "rgba(255,255,255,0.06)",
        "border_strong": "rgba(255,255,255,0.12)",
        "text_primary":   "#EFEBE4",
        "text_secondary": "#A19D98",
        "text_muted":     "#6B6863",
        "text_subtle":    "#4A4845",
        "success": "#22C55E",
        "warning": "#F59E0B",
        "danger":  "#EF4444",
        "selection_bg":   "rgba(38,245,201,0.18)",
        "selection_fg":   "#EFEBE4",
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
        "letter_spacing_caps": "0.18em",
    },

    # Editorial scale — used by Section Engine for hero/title/eyebrow rendering
    # Numbers in clamp() format so they scale fluid between viewport extremes.
    "editorial": {
        "display":  "clamp(3.5rem, 7vw, 6.5rem)",      # hero display
        "h1":       "clamp(2.5rem, 5vw, 4.25rem)",     # section title
        "h2":       "clamp(1.75rem, 3.2vw, 2.5rem)",   # subsection
        "h3":       "clamp(1.25rem, 2vw, 1.625rem)",   # card title
        "lead":     "clamp(1.05rem, 1.4vw, 1.25rem)",  # intro paragraph
        "body":     "1rem",
        "caption":  "0.8125rem",
        "eyebrow":  "0.6875rem",  # all-caps overline
        "display_line":  "0.95",   # super tight display leading
        "heading_line":  "1.08",
        "body_line":     "1.6",
        "tracking_eyebrow":  "0.22em",
        "tracking_display":  "-0.025em",
    },

    # Shape ──────────────────────────────────────────────────────────────────
    "shape": {
        "radius_xs": "2px",
        "radius_sm": "3px",
        "radius_md": "6px",
        "radius_lg": "10px",
        "radius_xl": "16px",
        "radius_pill": "9999px",
        "border_softness": 1,   # px — global border weight modifier
    },

    # Spacing rhythm ─────────────────────────────────────────────────────────
    "spacing": {
        "scale": "comfortable",  # compact | comfortable | spacious
        "unit": 4,               # px base
        "section_y":   "clamp(4rem, 9vw, 9rem)",   # vertical breathing room
        "section_x":   "clamp(1.25rem, 4vw, 5rem)",
        "gutter":      "clamp(1rem, 2.4vw, 2rem)",
        "max_width":   "1400px",
        "stack_tight":     "0.5rem",
        "stack_default":   "1rem",
        "stack_loose":     "2rem",
        "stack_editorial": "4rem",
    },

    # Elevation ──────────────────────────────────────────────────────────────
    "elevation": {
        "sm":   "0 1px 2px rgba(0,0,0,0.4)",
        "md":   "0 4px 14px rgba(0,0,0,0.5)",
        "lg":   "0 12px 40px rgba(0,0,0,0.65)",
        "xl":   "0 24px 80px rgba(0,0,0,0.75)",
        "glow": "0 0 0 1px rgba(38,245,201,0.18), 0 0 32px rgba(38,245,201,0.15)",
        "inset_soft": "inset 0 1px 0 rgba(255,255,255,0.04)",
    },

    # Motion ─────────────────────────────────────────────────────────────────
    "motion": {
        "preset": "standard",  # subtle | standard | expressive
        "duration_fast":   "120ms",
        "duration_normal": "240ms",
        "duration_slow":   "420ms",
        "duration_cinematic": "720ms",
        "ease":          "cubic-bezier(0.16, 1, 0.3, 1)",
        "ease_emphasis": "cubic-bezier(0.22, 1, 0.36, 1)",
        "ease_entrance": "cubic-bezier(0.32, 0.72, 0, 1)",
        "stagger":       "60ms",
        "scroll_feel":   "calm",  # calm | responsive | parallax
        "hover_lift":    "-2px",
    },

    # Atmosphere — luxury / cinematic surface treatments ─────────────────────
    "atmosphere": {
        "grain_intensity":   0.04,     # 0..1 (noise overlay opacity)
        "glow_intensity":    0.35,     # 0..1 (accent glow on focus / brand glyph)
        "vignette_intensity": 0.25,    # 0..1 (radial dark fade on hero)
        "glass_blur":        "20px",
        "glass_opacity":     0.62,     # 0..1 (frosted panel translucency)
        "gradient_direction": "180deg",
        "hero_gradient":     "linear-gradient(180deg, rgba(10,10,11,0) 0%, rgba(10,10,11,0.6) 60%, rgba(10,10,11,0.95) 100%)",
        "section_divider":   "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)",
    },

    # Component variants ─────────────────────────────────────────────────────
    "components": {
        "button_style": "sharp",   # sharp | pill | ghost
        "card_style":   "subtle",  # subtle | bordered | elevated | glass
        "ui_density":   "comfortable",  # compact | comfortable | spacious
        "image_treatment": "natural",   # natural | desaturated | warm | cinematic
        "cursor_style":    "refined",   # default | refined
        "input_style":     "outline",   # outline | underline | filled
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


# ── Preset palette packs (one-click apply in BrandStudio) ────────────────────
# Each preset is a partial theme override deep-merged on top of DEFAULT_THEME.
PRESET_PALETTES = [
    {
        "id": "mood",
        "name": "MOOD Teal",
        "description": "Brand default — sea-glass teal on near-black",
        "palette": {"primary": "#26F5C9", "accent": "#B8977A", "background": "#0A0A0B",
                    "surface_1": "#141416", "surface_2": "#1C1C1F",
                    "selection_bg": "rgba(38,245,201,0.18)"},
    },
    {
        "id": "gold",
        "name": "Editorial Gold",
        "description": "Magazine-grade gilt accent — for editorial brands",
        "palette": {"primary": "#D4AF37", "accent": "#B8977A", "background": "#0A0A0B",
                    "selection_bg": "rgba(212,175,55,0.20)"},
    },
    {
        "id": "noir",
        "name": "Pure Noir",
        "description": "Pure black canvas — monochrome studios",
        "palette": {"primary": "#FFFFFF", "accent": "#A19D98", "background": "#000000",
                    "surface_1": "#0A0A0A", "surface_2": "#141414",
                    "selection_bg": "rgba(255,255,255,0.12)"},
    },
    {
        "id": "editorial-noir",
        "name": "Editorial Noir",
        "description": "Inspired by luxury hospitality — warm noir with copper accent",
        "palette": {"primary": "#C8A687", "accent": "#7A6553", "background": "#08070A",
                    "surface_1": "#11100F", "surface_2": "#1A1816", "surface_3": "#252220",
                    "text_primary": "#F1EAE1", "text_secondary": "#A89C8C",
                    "selection_bg": "rgba(200,166,135,0.20)"},
        "atmosphere": {"grain_intensity": 0.06, "vignette_intensity": 0.35},
    },
    {
        "id": "linear-mist",
        "name": "Linear Mist",
        "description": "Cool tech tone — clean, modern, calm",
        "palette": {"primary": "#8B7CFF", "accent": "#0063D4", "background": "#080808",
                    "surface_1": "#0F0F11", "surface_2": "#16161A", "surface_3": "#222226",
                    "text_primary": "#E1E1E7", "text_secondary": "#9A9AA8",
                    "border": "rgba(255,255,255,0.05)", "border_strong": "rgba(255,255,255,0.10)",
                    "selection_bg": "rgba(139,124,255,0.22)"},
        "atmosphere": {"grain_intensity": 0.02, "vignette_intensity": 0.15, "glass_opacity": 0.7},
    },
    {
        "id": "rose",
        "name": "Rose Quartz",
        "description": "Soft warmth — for residential boutique studios",
        "palette": {"primary": "#E8B4B8", "accent": "#9B7B7E", "background": "#0E0A0B",
                    "selection_bg": "rgba(232,180,184,0.18)"},
    },
    {
        "id": "forest",
        "name": "Deep Forest",
        "description": "Earthy luxe — sustainable / biophilic studios",
        "palette": {"primary": "#7AA489", "accent": "#B89C7A", "background": "#0A0E0B",
                    "selection_bg": "rgba(122,164,137,0.18)"},
    },
    {
        "id": "ocean",
        "name": "Midnight Sea",
        "description": "Architectural cool — for hospitality / yacht studios",
        "palette": {"primary": "#5B8FB8", "accent": "#B8977A", "background": "#070B11",
                    "selection_bg": "rgba(91,143,184,0.20)"},
    },
]


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
