"""Blueprint Master Layouts™ — Page Skeleton registry.

Single-page structural layouts used by the "Add page" flow in the Moodboard
PRO editor. Each skeleton defines:

  - id              stable slug
  - label_key       i18n key for the card title
  - category_key    i18n key grouping (cover · narrative · materials · …)
  - page_type       maps to `moodboard_pages.page_type` enum
  - aspect_ratio    maps to `ASPECT_RATIO_PRESETS` keys
  - width / height  resolved from the aspect ratio (for previewing)
  - blocks          list of placeholder blocks {type, x, y, width, height,
                    z_index, content, style}

This is intentionally code-defined (not DB-seeded): the registry is global,
versioned via git, and read by `GET /api/moodboards/_meta/page_skeletons`.
Frontend NEVER hardcodes layouts — it always reads them from this endpoint.

All blocks are placeholder-style: empty `src`, empty `text`. The Moodboard
editor renders them as editable empty blocks the designer fills in.
"""
from typing import Dict, List, Any

# Geometry helpers — keep coordinates in the canvas reference frame (1400x2400
# for portrait, 1920x1200 for landscape cover, etc.). The frontend mini-preview
# scales them down via the same render path used by PagesNavigator thumbnails.
def _img(x, y, w, h, z=0, fit="cover", focal="center"):
    return {
        "type": "image", "x": x, "y": y, "width": w, "height": h, "z_index": z,
        "content": {"src": "", "caption": ""},
        "style": {"fit_mode": fit, "focal_point": focal},
    }

def _txt(x, y, w, h, z=1, size="body", align="left", color=None):
    style = {}
    if color:
        style["color"] = color
    return {
        "type": "text", "x": x, "y": y, "width": w, "height": h, "z_index": z,
        "content": {"text": "", "size": size, "align": align},
        "style": style,
    }

def _palette(x, y, w, h, z=1, colors=None):
    return {
        "type": "palette", "x": x, "y": y, "width": w, "height": h, "z_index": z,
        "content": {"colors": colors or ["#1A1814", "#A19D98", "#D4AF37", "#EFEBE4"]},
        "style": {},
    }

def _material(x, y, w, h, z=1):
    return {
        "type": "material", "x": x, "y": y, "width": w, "height": h, "z_index": z,
        "content": {"name": "", "finish": "", "swatch": ""},
        "style": {},
    }

def _product(x, y, w, h, z=1):
    return {
        "type": "product", "x": x, "y": y, "width": w, "height": h, "z_index": z,
        "content": {"name": "", "vendor": "", "price": "", "image": ""},
        "style": {},
    }


# Canvas dimensions per aspect ratio. Mirror of ASPECT_RATIO_PRESETS in
# moodboards_v1.py (single source of truth lives there; we duplicate here
# only to compute fresh layouts).
_W_PORTRAIT, _H_PORTRAIT = 1400, 2400
_W_EDITORIAL, _H_EDITORIAL = 1400, 1866
_W_LANDSCAPE, _H_LANDSCAPE = 1920, 1200
_W_SQUARE, _H_SQUARE = 1400, 1400


PAGE_SKELETONS: List[Dict[str, Any]] = [
    # ── COVER FAMILY ────────────────────────────────────────────────────────
    {
        "id": "hero_full_bleed",
        "label_key": "moodboards.skeleton.hero_full_bleed",
        "category_key": "moodboards.skeleton.category.cover",
        "page_type": "cover",
        "aspect_ratio": "cover_landscape",
        "blocks": [
            _img(0, 0, _W_LANDSCAPE, _H_LANDSCAPE, z=0),
            _txt(120, 880, 1100, 120, z=2, size="display", align="left", color="#FFFFFF"),
            _txt(120, 1020, 600, 40, z=3, size="eyebrow", align="left", color="#D4AF37"),
        ],
    },
    {
        "id": "split_cover",
        "label_key": "moodboards.skeleton.split_cover",
        "category_key": "moodboards.skeleton.category.cover",
        "page_type": "cover",
        "aspect_ratio": "cover_landscape",
        "blocks": [
            _img(0, 0, 1100, _H_LANDSCAPE, z=0),
            _txt(1180, 360, 680, 40, z=1, size="eyebrow"),
            _txt(1180, 440, 680, 160, z=1, size="h1"),
            _txt(1180, 700, 680, 200, z=1, size="body"),
        ],
    },

    # ── NARRATIVE FAMILY ────────────────────────────────────────────────────
    {
        "id": "quote_page",
        "label_key": "moodboards.skeleton.quote_page",
        "category_key": "moodboards.skeleton.category.narrative",
        "page_type": "quote",
        "aspect_ratio": "editorial_3_4",
        "blocks": [
            _txt(200, 160, 1000, 40, z=1, size="eyebrow", align="center"),
            _txt(160, 700, 1080, 420, z=2, size="h2", align="center"),
            _txt(400, 1180, 600, 32, z=1, size="caption", align="center"),
        ],
    },
    {
        "id": "split_editorial",
        "label_key": "moodboards.skeleton.split_editorial",
        "category_key": "moodboards.skeleton.category.narrative",
        "page_type": "split_story",
        "aspect_ratio": "editorial_3_4",
        "blocks": [
            _img(0, 0, 700, _H_EDITORIAL, z=0),
            _txt(760, 300, 520, 40, z=1, size="eyebrow"),
            _txt(760, 380, 520, 120, z=1, size="h2"),
            _txt(760, 540, 520, 460, z=1, size="body"),
        ],
    },

    # ── ATMOSPHERE FAMILY ───────────────────────────────────────────────────
    {
        "id": "mood_triptych",
        "label_key": "moodboards.skeleton.mood_triptych",
        "category_key": "moodboards.skeleton.category.atmosphere",
        "page_type": "mood",
        "aspect_ratio": "editorial_3_4",
        "blocks": [
            _img(80, 80, 720, 960, z=0),
            _img(840, 80, 480, 460, z=0),
            _img(840, 580, 480, 460, z=0),
            _txt(80, 1100, 1240, 300, z=1, size="body"),
        ],
    },
    {
        "id": "gallery_spread",
        "label_key": "moodboards.skeleton.gallery_spread",
        "category_key": "moodboards.skeleton.category.atmosphere",
        "page_type": "gallery",
        "aspect_ratio": "editorial_3_4",
        "blocks": [
            _img(80, 80, 1240, 760, z=0),
            _img(80, 880, 600, 520, z=0),
            _img(720, 880, 600, 520, z=0),
            _txt(80, 1440, 1240, 32, z=1, size="caption"),
        ],
    },

    # ── MATERIALS FAMILY ────────────────────────────────────────────────────
    {
        "id": "palette_composition",
        "label_key": "moodboards.skeleton.palette_composition",
        "category_key": "moodboards.skeleton.category.materials",
        "page_type": "palette",
        "aspect_ratio": "editorial_3_4",
        "blocks": [
            _txt(80, 80, 600, 40, z=1, size="eyebrow"),
            _palette(80, 160, 1240, 160, z=1),
            _material(80, 380, 390, 520, z=1),
            _material(505, 380, 390, 520, z=1),
            _material(930, 380, 390, 520, z=1),
            _txt(80, 940, 1240, 200, z=1, size="body"),
        ],
    },
    {
        "id": "materials_grid",
        "label_key": "moodboards.skeleton.materials_grid",
        "category_key": "moodboards.skeleton.category.materials",
        "page_type": "material_board",
        "aspect_ratio": "square_1_1",
        "blocks": [
            _palette(40, 40, 1320, 120, z=1),
            _material(40, 200, 640, 580, z=1),
            _material(720, 200, 640, 280, z=1),
            _material(720, 500, 640, 280, z=1),
            _material(40, 820, 640, 540, z=1),
            _material(720, 820, 640, 540, z=1),
        ],
    },

    # ── PRODUCTS FAMILY ─────────────────────────────────────────────────────
    {
        "id": "product_focus",
        "label_key": "moodboards.skeleton.product_focus",
        "category_key": "moodboards.skeleton.category.products",
        "page_type": "product_grid",
        "aspect_ratio": "editorial_3_4",
        "blocks": [
            _product(80, 80, 760, _H_EDITORIAL - 160, z=1),
            _txt(900, 300, 420, 32, z=1, size="eyebrow"),
            _txt(900, 360, 420, 80, z=1, size="h3"),
            _txt(900, 480, 420, 280, z=1, size="body"),
            _palette(900, 800, 420, 80, z=1),
        ],
    },
    {
        "id": "product_grid_6",
        "label_key": "moodboards.skeleton.product_grid_6",
        "category_key": "moodboards.skeleton.category.products",
        "page_type": "product_grid",
        "aspect_ratio": "editorial_3_4",
        "blocks": [
            _txt(80, 80, 600, 40, z=1, size="eyebrow"),
            _product(80, 160, 390, 460, z=1),
            _product(505, 160, 390, 460, z=1),
            _product(930, 160, 390, 460, z=1),
            _product(80, 680, 390, 460, z=1),
            _product(505, 680, 390, 460, z=1),
            _product(930, 680, 390, 460, z=1),
        ],
    },

    # ── CLOSING FAMILY ──────────────────────────────────────────────────────
    {
        "id": "approval_page",
        "label_key": "moodboards.skeleton.approval_page",
        "category_key": "moodboards.skeleton.category.closing",
        "page_type": "approval",
        "aspect_ratio": "editorial_3_4",
        "blocks": [
            _txt(200, 200, 1000, 40, z=1, size="eyebrow", align="center"),
            _txt(160, 720, 1080, 300, z=2, size="h2", align="center"),
            _txt(400, 1300, 600, 32, z=1, size="caption", align="center"),
        ],
    },

    # ── BLANK ───────────────────────────────────────────────────────────────
    {
        "id": "blank",
        "label_key": "moodboards.skeleton.blank",
        "category_key": "moodboards.skeleton.category.blank",
        "page_type": "blank",
        "aspect_ratio": "portrait_a4",
        "blocks": [],
    },
]


def get_skeleton(skeleton_id: str) -> Dict[str, Any]:
    """Lookup by id; raises KeyError when missing (caller maps to 404)."""
    for sk in PAGE_SKELETONS:
        if sk["id"] == skeleton_id:
            return sk
    raise KeyError(skeleton_id)
