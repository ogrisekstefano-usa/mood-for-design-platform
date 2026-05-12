"""Blueprint Section Engine — server-side section catalog.

The Section Engine is the rendering backbone of EVERY Blueprint surface:
homepage, landing pages, proposals, magazine articles, moodboards, showcase
pages, client portals, onboarding flows.

A "page" is just an ordered list of sections. Each section has:
    - id        : stable uuid
    - type      : registered section type (must exist in SECTION_TYPES)
    - visible   : bool
    - order     : int
    - content   : locale-aware bag — { _default: {...}, [locale]: {...overrides} }
    - settings  : per-instance theme overrides (optional)

The catalog below is the single source of truth for what sections exist
on the platform. Frontend reads it via /api/blueprint/sections/catalog and
renders the corresponding React component from its registry.

NO hardcoded content — content lives in DB (tenant_settings).
"""
from typing import Dict, Any, List


# ── Atmospheric / layout presets reusable across many section types ─────────
LAYOUT_VARIANTS = ["editorial", "centered", "asymmetric_left", "asymmetric_right", "split"]
ATMOSPHERE_VARIANTS = ["clean", "cinematic", "glass", "grain"]


SECTION_TYPES: List[Dict[str, Any]] = [
    {
        "type": "hero",
        "category": "intro",
        "label": "Hero",
        "description": "Cinematic title introduction — eyebrow, headline, sub, CTAs, media",
        "icon": "Layers",
        "reusable_in": ["homepage", "landing", "showcase", "proposal", "magazine"],
        "schema": {
            "eyebrow":   {"type": "string", "i18n": True,  "max": 80},
            "headline":  {"type": "string", "i18n": True,  "max": 240, "required": True},
            "subline":   {"type": "richtext", "i18n": True, "max": 600},
            "primary_cta":   {"type": "cta", "i18n": True},
            "secondary_cta": {"type": "cta", "i18n": True},
            "media":     {"type": "media", "i18n": False},
            "layout":    {"type": "enum", "options": LAYOUT_VARIANTS, "default": "editorial"},
            "atmosphere": {"type": "enum", "options": ATMOSPHERE_VARIANTS, "default": "cinematic"},
            "height":    {"type": "enum", "options": ["compact", "tall", "fullscreen"], "default": "tall"},
        },
        "defaults": {
            "eyebrow": "Blueprint OS™",
            "headline": "Timeless elegance, engineered.",
            "subline":  "A luxury operating system for international design firms.",
            "primary_cta":   {"label": "Get started", "href": "/auth/signup"},
            "secondary_cta": {"label": "Discover",    "href": "#about"},
            "layout": "editorial",
            "atmosphere": "cinematic",
            "height": "tall",
        },
    },
    {
        "type": "feature_grid",
        "category": "content",
        "label": "Feature Grid",
        "description": "Modular grid of capabilities / services",
        "icon": "Grid",
        "reusable_in": ["homepage", "landing", "showcase", "proposal"],
        "schema": {
            "eyebrow":  {"type": "string", "i18n": True},
            "headline": {"type": "string", "i18n": True, "required": True},
            "items":    {"type": "list", "of": "feature",
                         "shape": {"icon": "string", "title": "i18n", "description": "i18n"},
                         "max": 12, "min": 1},
            "columns":  {"type": "enum", "options": ["2", "3", "4"], "default": "3"},
            "layout":   {"type": "enum", "options": LAYOUT_VARIANTS, "default": "editorial"},
            "atmosphere": {"type": "enum", "options": ATMOSPHERE_VARIANTS, "default": "clean"},
        },
        "defaults": {
            "eyebrow": "Capabilities",
            "headline": "Refined. Intuitive. Powerful.",
            "items": [
                {"icon": "Layers", "title": "Moodboards", "description": "Block-based canvas with hotspot intelligence."},
                {"icon": "FolderOpen", "title": "Projects", "description": "Lead-to-handoff visibility, in one workspace."},
                {"icon": "FileText", "title": "Proposals", "description": "Editorial pitch decks with client signoff."},
            ],
            "columns": "3",
            "layout": "editorial",
            "atmosphere": "clean",
        },
    },
    {
        "type": "gallery",
        "category": "content",
        "label": "Gallery",
        "description": "Image grid / carousel — projects, references, materials",
        "icon": "Image",
        "reusable_in": ["homepage", "showcase", "magazine", "moodboard"],
        "schema": {
            "eyebrow":  {"type": "string", "i18n": True},
            "headline": {"type": "string", "i18n": True},
            "items":    {"type": "list", "of": "image",
                         "shape": {"src": "string", "caption": "i18n", "alt": "i18n"},
                         "max": 24, "min": 1},
            "variant":  {"type": "enum", "options": ["mosaic", "grid", "carousel", "marquee"], "default": "mosaic"},
            "aspect":   {"type": "enum", "options": ["square", "portrait", "landscape", "varied"], "default": "varied"},
        },
        "defaults": {
            "eyebrow": "Recent work",
            "headline": "Selected projects.",
            "items": [],
            "variant": "mosaic",
            "aspect": "varied",
        },
    },
    {
        "type": "quote",
        "category": "content",
        "label": "Editorial Quote",
        "description": "Pull-quote / testimonial in editorial typography",
        "icon": "Quote",
        "reusable_in": ["homepage", "landing", "magazine", "proposal", "showcase"],
        "schema": {
            "quote":     {"type": "richtext", "i18n": True, "required": True},
            "author":    {"type": "string", "i18n": True},
            "role":      {"type": "string", "i18n": True},
            "alignment": {"type": "enum", "options": ["left", "center"], "default": "center"},
        },
        "defaults": {
            "quote": "Design is the silent ambassador of your brand.",
            "author": "Paul Rand",
            "role": "Designer",
            "alignment": "center",
        },
    },
    {
        "type": "stats",
        "category": "content",
        "label": "Stats Bar",
        "description": "Numeric KPIs in editorial layout",
        "icon": "BarChart3",
        "reusable_in": ["homepage", "showcase", "proposal"],
        "schema": {
            "items": {"type": "list", "of": "stat",
                      "shape": {"value": "string", "label": "i18n", "suffix": "string"},
                      "max": 6, "min": 2},
            "layout": {"type": "enum", "options": ["row", "split"], "default": "row"},
        },
        "defaults": {
            "items": [
                {"value": "120", "suffix": "+", "label": "Projects delivered"},
                {"value": "14",  "suffix": "",  "label": "Countries"},
                {"value": "9",   "suffix": "yr", "label": "Practice"},
            ],
            "layout": "row",
        },
    },
    {
        "type": "cta",
        "category": "conversion",
        "label": "CTA Band",
        "description": "Conversion band — headline + buttons",
        "icon": "ArrowRight",
        "reusable_in": ["homepage", "landing", "showcase", "magazine", "proposal", "client_portal"],
        "schema": {
            "eyebrow":   {"type": "string", "i18n": True},
            "headline":  {"type": "string", "i18n": True, "required": True},
            "subline":   {"type": "string", "i18n": True},
            "primary_cta":   {"type": "cta", "i18n": True},
            "secondary_cta": {"type": "cta", "i18n": True},
            "atmosphere": {"type": "enum", "options": ATMOSPHERE_VARIANTS, "default": "glass"},
        },
        "defaults": {
            "eyebrow": "Start now",
            "headline": "Build your studio's Blueprint.",
            "subline":  "From first lead to final signoff — one calm operating system.",
            "primary_cta":   {"label": "Create workspace", "href": "/auth/signup"},
            "secondary_cta": {"label": "Talk to us",        "href": "#contact"},
            "atmosphere": "glass",
        },
    },
    {
        "type": "split",
        "category": "content",
        "label": "Split / Side-by-side",
        "description": "Asymmetric content + media block",
        "icon": "Columns",
        "reusable_in": ["homepage", "landing", "magazine", "showcase", "client_portal"],
        "schema": {
            "eyebrow":   {"type": "string", "i18n": True},
            "headline":  {"type": "string", "i18n": True, "required": True},
            "body":      {"type": "richtext", "i18n": True},
            "media":     {"type": "media", "i18n": False},
            "side":      {"type": "enum", "options": ["left", "right"], "default": "right"},
            "primary_cta": {"type": "cta", "i18n": True},
        },
        "defaults": {
            "eyebrow": "Philosophy",
            "headline": "Material driven. Atmospherically conceived.",
            "body": "Every project begins with the silence between things — light, weight, proportion.",
            "media": None,
            "side": "right",
        },
    },
    {
        "type": "logo_strip",
        "category": "trust",
        "label": "Logo Strip",
        "description": "Marquee of brand / partner / press logos",
        "icon": "Globe",
        "reusable_in": ["homepage", "showcase", "proposal"],
        "schema": {
            "eyebrow":  {"type": "string", "i18n": True},
            "items":    {"type": "list", "of": "logo",
                         "shape": {"src": "string", "alt": "string", "href": "string"},
                         "max": 24, "min": 1},
            "animate":  {"type": "boolean", "default": True},
        },
        "defaults": {
            "eyebrow": "Trusted by",
            "items": [],
            "animate": True,
        },
    },
    {
        "type": "magazine_grid",
        "category": "content",
        "label": "Magazine Grid",
        "description": "Editorial articles index",
        "icon": "BookOpen",
        "reusable_in": ["homepage", "magazine"],
        "schema": {
            "eyebrow":  {"type": "string", "i18n": True},
            "headline": {"type": "string", "i18n": True},
            "source":   {"type": "string", "default": "/api/inspirations?limit=4"},
            "columns":  {"type": "enum", "options": ["2", "3", "4"], "default": "3"},
        },
        "defaults": {
            "eyebrow": "Inspirations",
            "headline": "Latest from the magazine.",
            "source": "/api/inspirations?limit=6",
            "columns": "3",
        },
    },
    {
        "type": "faq",
        "category": "content",
        "label": "FAQ",
        "description": "Accordion of Q&A",
        "icon": "HelpCircle",
        "reusable_in": ["homepage", "landing", "showcase", "client_portal"],
        "schema": {
            "eyebrow":  {"type": "string", "i18n": True},
            "headline": {"type": "string", "i18n": True},
            "items":    {"type": "list", "of": "qa",
                         "shape": {"question": "i18n", "answer": "i18n"},
                         "max": 24, "min": 1},
        },
        "defaults": {
            "eyebrow": "Questions",
            "headline": "Frequently asked.",
            "items": [],
        },
    },
]


# Map by type for fast lookup
SECTION_TYPES_BY_KEY = {s["type"]: s for s in SECTION_TYPES}


def section_defaults(section_type: str) -> Dict[str, Any]:
    """Default content payload for a given section type."""
    s = SECTION_TYPES_BY_KEY.get(section_type)
    return s["defaults"] if s else {}


def section_known(section_type: str) -> bool:
    return section_type in SECTION_TYPES_BY_KEY


# ── Default page seeds (used when a page slug has never been customized) ────
# Page templates use only section TYPES — content uses defaults above.
DEFAULT_PAGE_TEMPLATES: Dict[str, List[Dict[str, Any]]] = {
    "homepage": [
        {"type": "hero",          "visible": True},
        {"type": "feature_grid",  "visible": True},
        {"type": "split",         "visible": True},
        {"type": "gallery",       "visible": True},
        {"type": "stats",         "visible": True},
        {"type": "quote",         "visible": True},
        {"type": "magazine_grid", "visible": True},
        {"type": "cta",           "visible": True},
    ],
    "showcase": [
        {"type": "hero",     "visible": True},
        {"type": "gallery",  "visible": True},
        {"type": "logo_strip","visible": True},
        {"type": "cta",      "visible": True},
    ],
    "about": [
        {"type": "hero",  "visible": True},
        {"type": "split", "visible": True},
        {"type": "quote", "visible": True},
        {"type": "cta",   "visible": True},
    ],
}


def default_page(slug: str) -> Dict[str, Any]:
    """Return a fresh page document with default sections for the given slug."""
    import uuid
    template = DEFAULT_PAGE_TEMPLATES.get(slug, [])
    sections = []
    for idx, item in enumerate(template):
        sections.append({
            "id":      str(uuid.uuid4()),
            "type":    item["type"],
            "visible": item.get("visible", True),
            "order":   idx,
            "content": {"_default": section_defaults(item["type"])},
            "settings": {},
        })
    return {
        "slug":     slug,
        "title":    slug.replace("-", " ").title(),
        "locale_default": None,  # inherits tenant default
        "published": False,
        "sections": sections,
    }
