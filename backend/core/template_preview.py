"""Template preview builder — generates an editorial SVG thumbnail purely from
the structural data of a template (positions + sizes + types + palette colors).

Design intent:
  - No raster, no external assets, no AI calls
  - Block tints derived from `type` (text/image/palette/note/product/material)
  - Palette blocks reveal their actual color swatches inside the thumbnail
  - Same aspect ratio as canvas (1400×2400) — normalized to 220×360 viewBox

The output is a `dict` with two fields the frontend can consume:
  {
    "preview_svg": "<svg ...>...</svg>",     # ready-to-inject
    "palette":     ["#1A1814", "#D4AF37", …] # primary palette for swatch row
  }
"""
from typing import List, Dict, Any
import json
import html


# Canvas reference (matches CANVAS_W/CANVAS_H in MoodboardEditor.jsx)
CANVAS_W = 1400
CANVAS_H = 2400
PREVIEW_W = 220
PREVIEW_H = 360

# Editorial tints (intentionally muted — no neon, no cartoon palette).
# These map to neutral grayscale steps with one warm accent for media blocks.
TYPE_TINTS = {
    "image":    {"fill": "rgba(255,255,255,0.10)", "stroke": "rgba(255,255,255,0.18)"},
    "product":  {"fill": "rgba(255,255,255,0.08)", "stroke": "rgba(255,255,255,0.16)"},
    "material": {"fill": "rgba(214,197,168,0.18)","stroke": "rgba(214,197,168,0.30)"},
    "palette":  {"fill": "rgba(255,255,255,0.04)","stroke": "rgba(255,255,255,0.10)"},
    "text":     {"fill": "rgba(255,255,255,0.02)","stroke": "rgba(255,255,255,0.06)"},
    "note":     {"fill": "rgba(255,213,128,0.10)","stroke": "rgba(255,213,128,0.22)"},
    "video":    {"fill": "rgba(255,255,255,0.10)","stroke": "rgba(255,255,255,0.18)"},
    "hotspot":  {"fill": "rgba(38,245,201,0.10)", "stroke": "rgba(38,245,201,0.40)"},
}


def _parse_jsonish(v):
    if v is None:
        return {}
    if isinstance(v, dict):
        return v
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return {}
    return {}


def _block_geometry(b: dict) -> Dict[str, float]:
    """Read position from position_json (post-002) with legacy fallback."""
    pos = _parse_jsonish(b.get("position_json"))
    if pos:
        return {
            "x": pos.get("x", 40), "y": pos.get("y", 40),
            "w": pos.get("width", 320), "h": pos.get("height", 240),
        }
    # Legacy: layout-inside-content
    content = _parse_jsonish(b.get("content"))
    layout = content.get("layout") or {}
    return {
        "x": layout.get("x", 40), "y": layout.get("y", 40),
        "w": layout.get("width", 320), "h": layout.get("height", 240),
    }


def _extract_palette(blocks: List[dict]) -> List[str]:
    """Collect HEX colors from palette-type blocks (max 5)."""
    out = []
    for b in blocks:
        if b.get("type") != "palette":
            continue
        content = _parse_jsonish(b.get("content"))
        colors = content.get("colors") or []
        for c in colors:
            if isinstance(c, str) and c.startswith("#") and c not in out:
                out.append(c)
                if len(out) >= 5:
                    return out
    return out


def _render_text_glyph(x: float, y: float, w: float, size: str) -> str:
    """Emit 1-3 horizontal lines as a 'typographic' affordance."""
    rules = {"display": (3, 7, 0.65), "h1": (2, 6, 0.6), "h2": (2, 5, 0.55),
             "h3": (2, 4, 0.5), "eyebrow": (1, 3, 0.35), "body": (3, 3, 0.5),
             "caption": (1, 2, 0.35)}
    lines, gap, max_w_frac = rules.get(size, rules["body"])
    out = []
    for i in range(lines):
        line_w = w * max_w_frac * (1 - 0.15 * (i % 2))
        out.append(
            f'<rect x="{x:.1f}" y="{(y + i * gap):.1f}" width="{line_w:.1f}" height="2" '
            f'fill="rgba(255,255,255,0.55)" rx="1"/>'
        )
    return "".join(out)


def build_preview(blocks: List[dict]) -> Dict[str, Any]:
    """Return preview_svg + palette for a list of template blocks."""
    if not blocks:
        return {"preview_svg": "", "palette": []}

    sx = PREVIEW_W / CANVAS_W
    # Determine vertical bound from blocks (so previews stay tight)
    max_y = max(
        _block_geometry(b)["y"] + _block_geometry(b)["h"]
        for b in blocks
    ) if blocks else CANVAS_H
    max_y = min(max(max_y, 600), CANVAS_H)
    sy = PREVIEW_H / max_y

    palette = _extract_palette(blocks)

    rects = []
    # Sort by sort_order so layered blocks paint in the right z-order
    for b in sorted(blocks, key=lambda x: x.get("sort_order", 0)):
        g = _block_geometry(b)
        x, y, w, h = g["x"] * sx, g["y"] * sy, g["w"] * sx, g["h"] * sy
        if w < 1 or h < 1:
            continue
        btype = b.get("type") or "image"
        tint = TYPE_TINTS.get(btype, TYPE_TINTS["image"])
        rects.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" '
            f'fill="{tint["fill"]}" stroke="{tint["stroke"]}" stroke-width="0.6" rx="2"/>'
        )
        if btype == "palette":
            content = _parse_jsonish(b.get("content"))
            colors = (content.get("colors") or [])[:5]
            if colors:
                sw = w / max(1, len(colors))
                for i, c in enumerate(colors):
                    rects.append(
                        f'<rect x="{(x + i * sw):.1f}" y="{y:.1f}" width="{sw:.1f}" '
                        f'height="{h:.1f}" fill="{html.escape(c)}" opacity="0.95"/>'
                    )
        elif btype == "text":
            content = _parse_jsonish(b.get("content"))
            rects.append(_render_text_glyph(x + 4, y + 6, w - 8, content.get("size", "body")))

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {PREVIEW_W} {PREVIEW_H}" '
        f'preserveAspectRatio="xMidYMid meet" width="100%" height="100%">'
        f'<rect width="100%" height="100%" fill="rgba(0,0,0,0.35)"/>'
        f'{"".join(rects)}'
        f'</svg>'
    )
    return {"preview_svg": svg, "palette": palette}
