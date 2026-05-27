"""Storefront Registry — Tenant public-facing section catalog.

Sections used by the Cinematic Storefront Studio™ to compose the tenant's
DEMO STORE pages (homepage, projects, onboarding flows, professionals
gateway, navigation, shared UI).

Strict separation from `section_registry.py` (Corporate Blueprint OS™ demo)
to prevent contamination between the platform marketing pages and the
tenant's actual storefront.

KEY DESIGN DECISIONS
────────────────────
1. Every text field is multilingual by default (`i18n: True`) — content is
   stored as a locale-keyed JSONB in `cms_sections.locale_content`.
2. Image/media fields point to `cms_assets.id` rather than raw URLs — so
   focal_point + alt_text + reverse-index work consistently.
3. `default_pages` enumerates the 6 fixed page_keys for Session B
   (home, projects, start_project, professionals, navigation, ui).
   Each page lists the section TYPES it bootstraps with.
4. Defaults intentionally use SHORT, neutral seed strings — the SeedScript
   imports rich content from the JS configs on first migration.
"""
from typing import Dict, Any, List


# ── Page key catalog (Session B locks to these 6) ──────────────────────────
PAGE_KEYS = ['home', 'projects', 'start_project', 'professionals', 'navigation', 'ui']


# ── Storefront-specific section catalog ────────────────────────────────────
STOREFRONT_SECTION_TYPES: List[Dict[str, Any]] = [
    # ── HOMEPAGE sections ──────────────────────────────────────────────────
    {
        "type": "store_hero",
        "category": "homepage",
        "label": "Editorial Hero",
        "description": "Cinematic full-bleed hero with eyebrow, dual headline, sub, atmosphere overlay.",
        "icon": "Image",
        "reusable_in": ["home"],
        "schema": {
            "eyebrow":         {"type": "string", "i18n": True, "max": 60},
            "headline":        {"type": "richtext", "i18n": True, "max": 280, "required": True},
            "sub":             {"type": "richtext", "i18n": True, "max": 600},
            "overline":        {"type": "string", "i18n": True, "max": 80},
            "overline_italic": {"type": "string", "i18n": True, "max": 100},
            "background_asset_id": {"type": "asset_ref"},
            "atmosphere":      {"type": "enum", "options": ["cinematic", "editorial", "glass"], "default": "cinematic"},
        },
        "defaults": {"atmosphere": "cinematic"},
    },
    {
        "type": "dual_cta",
        "category": "homepage",
        "label": "Dual Pathway",
        "description": "Two parallel paths (Client · Professional) with kicker, title, body, CTA.",
        "icon": "Columns",
        "reusable_in": ["home"],
        "schema": {
            "section_kicker":  {"type": "string", "i18n": True, "max": 60},
            "section_title":   {"type": "string", "i18n": True, "max": 120},
            "client_kicker":   {"type": "string", "i18n": True},
            "client_title":    {"type": "string", "i18n": True},
            "client_body":     {"type": "richtext", "i18n": True},
            "client_cta_label":{"type": "string", "i18n": True},
            "client_cta_href": {"type": "string"},
            "pro_kicker":      {"type": "string", "i18n": True},
            "pro_title":       {"type": "string", "i18n": True},
            "pro_body":        {"type": "richtext", "i18n": True},
            "pro_cta_label":   {"type": "string", "i18n": True},
            "pro_cta_href":    {"type": "string"},
        },
        "defaults": {"client_cta_href": "/start-project", "pro_cta_href": "/professionals"},
    },
    {
        "type": "value_props",
        "category": "homepage",
        "label": "Value Pillars",
        "description": "3-column editorial value propositions with eyebrow and statement.",
        "icon": "LayoutGrid",
        "reusable_in": ["home"],
        "schema": {
            "section_kicker": {"type": "string", "i18n": True},
            "section_title":  {"type": "string", "i18n": True},
            "pillars":        {"type": "array", "item": {
                "eyebrow":  {"type": "string", "i18n": True},
                "title":    {"type": "string", "i18n": True},
                "body":     {"type": "richtext", "i18n": True},
                "asset_id": {"type": "asset_ref"},
            }},
        },
        "defaults": {"pillars": []},
    },
    {
        "type": "projects_preview",
        "category": "homepage",
        "label": "Featured Projects",
        "description": "Curated grid linking to the projects archive.",
        "icon": "Image",
        "reusable_in": ["home"],
        "schema": {
            "section_kicker": {"type": "string", "i18n": True},
            "section_title":  {"type": "string", "i18n": True},
            "section_lead":   {"type": "richtext", "i18n": True},
            "cta_label":      {"type": "string", "i18n": True},
            "cta_href":       {"type": "string"},
            "project_slugs":  {"type": "array", "item": {"type": "string"}},
        },
        "defaults": {"cta_href": "/projects", "project_slugs": []},
    },
    {
        "type": "newsletter",
        "category": "homepage",
        "label": "Editorial Newsletter",
        "description": "Subscription invite with editorial copy and consent.",
        "icon": "Mail",
        "reusable_in": ["home"],
        "schema": {
            "kicker":          {"type": "string", "i18n": True},
            "title":           {"type": "richtext", "i18n": True},
            "body":            {"type": "richtext", "i18n": True},
            "placeholder":     {"type": "string", "i18n": True},
            "cta_label":       {"type": "string", "i18n": True},
            "consent_text":    {"type": "richtext", "i18n": True},
        },
        "defaults": {},
    },
    {
        "type": "stats_band",
        "category": "homepage",
        "label": "Stats Band",
        "description": "Dark editorial band with key numbers (projects, countries, brands, satisfaction, years).",
        "icon": "BarChart3",
        "reusable_in": ["home"],
        "schema": {
            "section_kicker": {"type": "string", "i18n": True},
            "section_title":  {"type": "string", "i18n": True},
            "stats": {"type": "array", "item": {
                "value": {"type": "string"},                       # e.g. "850+", "98%"
                "label": {"type": "string", "i18n": True},
                "id":    {"type": "string"},
            }},
        },
        "defaults": {"stats": []},
    },
    {
        "type": "magazine_grid",
        "category": "homepage",
        "label": "Magazine Grid",
        "description": "Latest journal/magazine articles in a 3-up editorial grid.",
        "icon": "BookOpen",
        "reusable_in": ["home"],
        "schema": {
            "section_kicker": {"type": "string", "i18n": True},
            "section_title":  {"type": "string", "i18n": True},
            "cta_label":      {"type": "string", "i18n": True},
            "cta_href":       {"type": "string"},
            "articles": {"type": "array", "item": {
                "id":         {"type": "string"},
                "slug":       {"type": "string"},
                "category":   {"type": "string", "i18n": True},
                "title":      {"type": "string", "i18n": True},
                "read_label": {"type": "string", "i18n": True},
                "image_url":  {"type": "string"},
                "asset_id":   {"type": "asset_ref"},
            }},
        },
        "defaults": {"cta_href": "/magazine", "articles": []},
    },
    {
        "type": "brand_logos",
        "category": "homepage",
        "label": "Brand Partners",
        "description": "Row of partner brand logos / wordmarks.",
        "icon": "Award",
        "reusable_in": ["home"],
        "schema": {
            "section_kicker": {"type": "string", "i18n": True},
            "logos": {"type": "array", "item": {
                "id":        {"type": "string"},
                "name":      {"type": "string"},
                "wordmark":  {"type": "string"},            # text fallback when no image
                "image_url": {"type": "string"},
                "href":      {"type": "string"},
            }},
        },
        "defaults": {"logos": []},
    },

    # ── TEAM IDENTITY — Phase T.1 ─────────────────────────────────────────
    # Public-safe "Your Reference" block. Renders 1-2 real studio leaders
    # using data from /api/storefront/{slug}/team-leaders. Never a corporate
    # team grid; never an AI / chatbot.
    {
        "type": "team_identity_card",
        "category": "homepage",
        "label": "Your Reference",
        "description": "Cinematic introduction of the studio's primary human reference.",
        "icon": "UserCircle",
        "reusable_in": ["home", "professionals"],
        "schema": {
            "eyebrow":      {"type": "string", "i18n": True},
            "headline":     {"type": "richtext", "i18n": True},
            "subheadline":  {"type": "richtext", "i18n": True},
            "cta_label":    {"type": "string", "i18n": True},
            "cta_href":     {"type": "string"},
            "variant":      {"type": "string"},   # 'warm' | 'dark'
            "alignment":    {"type": "string"},   # 'portrait_left' | 'portrait_right'
            "max_leaders":  {"type": "number"},   # 1 or 2 — UI caps at 2
        },
        "defaults": {
            "eyebrow":     "Il tuo riferimento",
            "headline":    "Ogni progetto nasce da una relazione.",
            "subheadline": "Sarò il tuo punto di contatto durante le prime fasi: ascolto, raccolgo il tuo brief e ti accompagno passo dopo passo.",
            "cta_label":   "Inizia il tuo progetto",
            "cta_href":    "/start-project",
            "variant":     "warm",
            "alignment":   "portrait_left",
            "max_leaders": 1,
        },
    },

    # ── PROJECTS archive ───────────────────────────────────────────────────
    {
        "type": "projects_hero",
        "category": "projects",
        "label": "Archive Hero",
        "description": "Editorial intro to the projects archive.",
        "icon": "BookOpen",
        "reusable_in": ["projects"],
        "schema": {
            "eyebrow":  {"type": "string", "i18n": True},
            "title":    {"type": "richtext", "i18n": True},
            "sub":      {"type": "richtext", "i18n": True},
        },
        "defaults": {},
    },
    {
        "type": "projects_filters",
        "category": "projects",
        "label": "Filter Bar",
        "description": "Category & typology filters editorial pills.",
        "icon": "Filter",
        "reusable_in": ["projects"],
        "schema": {
            "all_label":        {"type": "string", "i18n": True},
            "categories":       {"type": "array", "item": {
                "slug":  {"type": "string"},
                "label": {"type": "string", "i18n": True},
            }},
        },
        "defaults": {"categories": []},
    },
    {
        "type": "projects_collection",
        "category": "projects",
        "label": "Projects Collection",
        "description": "The full list of project entries with cover + meta.",
        "icon": "Image",
        "reusable_in": ["projects"],
        "schema": {
            "projects": {"type": "array", "item": {
                "slug":     {"type": "string"},
                "title":    {"type": "string", "i18n": True},
                "location": {"type": "string", "i18n": True},
                "year":     {"type": "string"},
                "category": {"type": "string"},
                "cover_asset_id": {"type": "asset_ref"},
                "lead":     {"type": "richtext", "i18n": True},
            }},
        },
        "defaults": {"projects": []},
    },

    # ── ONBOARDING (private wizard) ────────────────────────────────────────
    {
        "type": "wizard_intro",
        "category": "onboarding",
        "label": "Wizard Intro",
        "description": "Welcome screen before step 1.",
        "icon": "Play",
        "reusable_in": ["start_project"],
        "schema": {
            "eyebrow":     {"type": "string", "i18n": True},
            "title":       {"type": "richtext", "i18n": True},
            "sub":         {"type": "richtext", "i18n": True},
            "begin_label": {"type": "string", "i18n": True},
        },
        "defaults": {},
    },
    {
        "type": "wizard_step",
        "category": "onboarding",
        "label": "Wizard Step",
        "description": "One cinematic step of the private client wizard.",
        "icon": "ChevronRight",
        "reusable_in": ["start_project"],
        "schema": {
            "step_key":    {"type": "string"},
            "kicker":      {"type": "string", "i18n": True},
            "title":       {"type": "richtext", "i18n": True},
            "sub":         {"type": "richtext", "i18n": True},
            "field_type":  {"type": "enum", "options": ["mood_cards", "single_choice", "multi_choice", "slider", "short_text", "long_text", "image_choice"], "default": "mood_cards"},
            "options":     {"type": "array", "item": {
                "value":    {"type": "string"},
                "label":    {"type": "string", "i18n": True},
                "asset_id": {"type": "asset_ref"},
            }},
            "required":    {"type": "boolean", "default": False},
        },
        "defaults": {"field_type": "mood_cards", "options": [], "required": False},
    },
    {
        "type": "wizard_completion",
        "category": "onboarding",
        "label": "Wizard Completion",
        "description": "Confirmation screen after the last step.",
        "icon": "Check",
        "reusable_in": ["start_project"],
        "schema": {
            "eyebrow":      {"type": "string", "i18n": True},
            "title":        {"type": "richtext", "i18n": True},
            "sub":          {"type": "richtext", "i18n": True},
            "primary_cta":  {"type": "string", "i18n": True},
            "secondary_cta":{"type": "string", "i18n": True},
        },
        "defaults": {},
    },

    # ── PROFESSIONALS gateway ──────────────────────────────────────────────
    {
        "type": "pro_hero",
        "category": "professionals",
        "label": "Pro Hero",
        "description": "Gateway hero for architects & designers.",
        "icon": "Building2",
        "reusable_in": ["professionals"],
        "schema": {
            "eyebrow": {"type": "string", "i18n": True},
            "title":   {"type": "richtext", "i18n": True},
            "sub":     {"type": "richtext", "i18n": True},
            "cta_label": {"type": "string", "i18n": True},
        },
        "defaults": {},
    },
    {
        "type": "pro_benefits",
        "category": "professionals",
        "label": "Pro Benefits",
        "description": "Editorial list of partnership benefits.",
        "icon": "Award",
        "reusable_in": ["professionals"],
        "schema": {
            "section_kicker": {"type": "string", "i18n": True},
            "section_title":  {"type": "richtext", "i18n": True},
            "items": {"type": "array", "item": {
                "title": {"type": "string", "i18n": True},
                "body":  {"type": "richtext", "i18n": True},
            }},
        },
        "defaults": {"items": []},
    },
    {
        "type": "pro_intake_step",
        "category": "professionals",
        "label": "Pro Intake Step",
        "description": "One step of the A&D intake flow.",
        "icon": "ChevronRight",
        "reusable_in": ["professionals"],
        "schema": {
            "step_key":   {"type": "string"},
            "kicker":     {"type": "string", "i18n": True},
            "title":      {"type": "richtext", "i18n": True},
            "sub":        {"type": "richtext", "i18n": True},
            "field_type": {"type": "enum", "options": ["short_text", "long_text", "single_choice", "multi_choice"], "default": "short_text"},
            "required":   {"type": "boolean", "default": False},
        },
        "defaults": {"field_type": "short_text", "required": False},
    },

    # ── NAVIGATION & SHARED UI ─────────────────────────────────────────────
    {
        "type": "nav_top",
        "category": "chrome",
        "label": "Top Navigation",
        "description": "Header logo, primary links, locale switcher, CTAs.",
        "icon": "Menu",
        "reusable_in": ["navigation"],
        "schema": {
            "logo_text":       {"type": "string"},
            "primary_links":   {"type": "array", "item": {
                "href":  {"type": "string"},
                "label": {"type": "string", "i18n": True},
            }},
            "primary_cta_label": {"type": "string", "i18n": True},
            "primary_cta_href":  {"type": "string"},
            "secondary_cta_label": {"type": "string", "i18n": True},
            "secondary_cta_href":  {"type": "string"},
        },
        "defaults": {"primary_links": []},
    },
    {
        "type": "footer_columns",
        "category": "chrome",
        "label": "Editorial Footer",
        "description": "Multi-column footer with showroom info and legal links.",
        "icon": "AlignJustify",
        "reusable_in": ["navigation"],
        "schema": {
            "columns": {"type": "array", "item": {
                "title": {"type": "string", "i18n": True},
                "links": {"type": "array", "item": {
                    "href":  {"type": "string"},
                    "label": {"type": "string", "i18n": True},
                }},
            }},
            "showroom_address": {"type": "richtext", "i18n": True},
            "copyright":        {"type": "string", "i18n": True},
        },
        "defaults": {"columns": []},
    },
    {
        "type": "shared_ui_labels",
        "category": "chrome",
        "label": "Shared UI Labels",
        "description": "Generic labels used across the storefront (Back, Open, Archive…).",
        "icon": "Type",
        "reusable_in": ["ui"],
        "schema": {
            "labels": {"type": "object"},  # free-form locale-keyed dict
        },
        "defaults": {"labels": {}},
    },
    # ── GENERIC BLOCKS (ITER157.E.3) ────────────────────────────────────
    # Drag-and-drop friendly free-form blocks that any editor can add to
    # any page. They render via the EditorialFreeBlocks component on the
    # public site.
    {
        "type": "block_heading",
        "category": "generic",
        "label": "Titolo",
        "description": "Titolo editoriale autonomo. Trascinabile, riutilizzabile in qualsiasi pagina.",
        "icon": "Heading",
        "reusable_in": "*",
        "schema": {
            "title":    {"type": "string",   "i18n": True, "max": 240, "required": True},
            "eyebrow":  {"type": "string",   "i18n": True, "max": 80},
            "size":     {"type": "enum",     "options": ["sm", "md", "lg", "xl"], "default": "lg"},
            "align":    {"type": "enum",     "options": ["left", "center", "right"], "default": "left"},
        },
        "defaults": {"size": "lg", "align": "left"},
    },
    {
        "type": "block_text",
        "category": "generic",
        "label": "Testo",
        "description": "Paragrafo editoriale autonomo. Supporta formattazione minimale (P2).",
        "icon": "AlignLeft",
        "reusable_in": "*",
        "schema": {
            "body":     {"type": "richtext", "i18n": True, "max": 4000, "required": True},
            "align":    {"type": "enum",     "options": ["left", "center", "right"], "default": "left"},
            "width":    {"type": "enum",     "options": ["narrow", "default", "wide"], "default": "default"},
        },
        "defaults": {"align": "left", "width": "default"},
    },
    {
        "type": "block_image",
        "category": "generic",
        "label": "Immagine",
        "description": "Immagine editoriale autonoma con caption e ratio configurabile.",
        "icon": "Image",
        "reusable_in": "*",
        "schema": {
            "url":      {"type": "string",   "required": True},
            "caption":  {"type": "string",   "i18n": True, "max": 240},
            "alt":      {"type": "string",   "i18n": True, "max": 240},
            "ratio":    {"type": "enum",     "options": ["1:1", "4:3", "3:2", "16:9", "21:9"], "default": "16:9"},
            "filter":   {"type": "string",   "max": 240},  # future P2: brightness/contrast/grayscale
        },
        "defaults": {"ratio": "16:9"},
    },
    {
        "type": "block_video_youtube",
        "category": "generic",
        "label": "Video YouTube",
        "description": "Embed YouTube responsive. Inserire URL o ID video.",
        "icon": "Youtube",
        "reusable_in": "*",
        "schema": {
            "video_id":     {"type": "string", "required": True},
            "title":        {"type": "string", "i18n": True, "max": 240},
            "caption":      {"type": "string", "i18n": True, "max": 240},
            "autoplay":     {"type": "bool",   "default": False},
        },
        "defaults": {"autoplay": False},
    },
]


STOREFRONT_SECTIONS_BY_KEY = {s["type"]: s for s in STOREFRONT_SECTION_TYPES}


def storefront_section_defaults(section_type: str) -> Dict[str, Any]:
    s = STOREFRONT_SECTIONS_BY_KEY.get(section_type)
    return s["defaults"] if s else {}


def is_known_storefront_section(section_type: str) -> bool:
    return section_type in STOREFRONT_SECTIONS_BY_KEY


# ── Default page composition (used on first seed) ─────────────────────────
DEFAULT_PAGE_COMPOSITION: Dict[str, List[str]] = {
    "home": ["store_hero", "value_props", "stats_band", "projects_preview", "magazine_grid", "brand_logos"],
    "projects": ["projects_hero", "projects_filters", "projects_collection"],
    "start_project": ["wizard_intro", "wizard_step", "wizard_completion"],
    "professionals": ["pro_hero", "pro_benefits", "pro_intake_step"],
    "navigation": ["nav_top", "footer_columns"],
    "ui": ["shared_ui_labels"],
}


def page_section_types(page_key: str) -> List[str]:
    return DEFAULT_PAGE_COMPOSITION.get(page_key, [])
