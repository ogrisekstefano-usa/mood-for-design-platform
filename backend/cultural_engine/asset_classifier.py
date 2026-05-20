"""Asset Classifier — Layer 1 deterministic rule-based engine.

Phase F1 (Product Visual Ecosystem™).

Reads image bytes (or a PIL Image), computes a set of low-level visual
metrics, and classifies the asset along three orthogonal dimensions:

  • asset_type            (lifestyle | still_life | cutout | texture |
                           detail | technical | rendering | campaign |
                           material_sample | variant)
  • compositional_role    (hero | focal | supporting | accent |
                           background | structural)
  • view_angle            (front | side | back | top | three_quarter |
                           macro | context | flat | unknown)

It also returns scalar scores in [0..1]:
  whitespace_ratio, edge_density, visual_density_score,
  texture_repetition_score, subject_focus_score, negative_space_score,
  visual_weight, composition_friendly, editorial_score

And derives:
  moodboard_priority (1..5),  is_primary_asset (bool),
  dominant_color_palette ([{hex, ratio}, ...]),
  classification_confidence (0..1),
  classified_by ('rule').

NO LLM. Deterministic. Same input → same output. Safe to run on millions
of assets in batch.

The Vision LLM fallback (vision_asset_classifier.py) is invoked by the
caller ONLY when classification_confidence < 0.55, and is best-effort:
it enriches a couple of fields but the rule-based output stays
authoritative.
"""
from __future__ import annotations

import io
import logging
import math
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageFilter, ImageStat

logger = logging.getLogger(__name__)

# Confidence threshold below which the Layer 2 LLM fallback should run.
LOW_CONFIDENCE_THRESHOLD = 0.55

# Downsample target — keep this cheap; classifier should be CPU-fast.
ANALYSIS_LONG_SIDE = 384


# ── Low-level metrics ───────────────────────────────────────────────
def _load_image(image_input: Any) -> Optional[Image.Image]:
    if isinstance(image_input, Image.Image):
        return image_input.copy()
    if isinstance(image_input, (bytes, bytearray)):
        try:
            return Image.open(io.BytesIO(image_input))
        except Exception as e:
            logger.warning(f"asset_classifier: bad image bytes: {e}")
            return None
    if isinstance(image_input, str):
        # Path
        try:
            return Image.open(image_input)
        except Exception as e:
            logger.warning(f"asset_classifier: open path failed: {e}")
            return None
    return None


def _prepare(img: Image.Image) -> Image.Image:
    """Downsample to ANALYSIS_LONG_SIDE on long edge, convert to RGB."""
    img = img.convert("RGB")
    w, h = img.size
    long_side = max(w, h)
    if long_side > ANALYSIS_LONG_SIDE:
        scale = ANALYSIS_LONG_SIDE / long_side
        img = img.resize(
            (max(1, int(w * scale)), max(1, int(h * scale))),
            Image.Resampling.LANCZOS,
        )
    return img


def _whitespace_ratio(arr: np.ndarray, threshold: int = 240) -> float:
    """Pixel ratio where ALL RGB channels are >= threshold (near-white)."""
    if arr.size == 0:
        return 0.0
    mask = (arr[..., 0] >= threshold) & (arr[..., 1] >= threshold) & (arr[..., 2] >= threshold)
    return float(mask.mean())


def _corner_isolation(arr: np.ndarray, frac: float = 0.10) -> float:
    """How 'cutout-like' the image is: average whitespace of the 4 corner patches."""
    h, w = arr.shape[:2]
    cw, ch = max(2, int(w * frac)), max(2, int(h * frac))
    corners = [
        arr[:ch, :cw], arr[:ch, -cw:],
        arr[-ch:, :cw], arr[-ch:, -cw:],
    ]
    vals = [_whitespace_ratio(c) for c in corners]
    return float(np.mean(vals))


def _edge_density(img: Image.Image) -> float:
    """Mean edge intensity normalized to [0..1]."""
    grey = img.convert("L").filter(ImageFilter.FIND_EDGES)
    arr = np.asarray(grey, dtype=np.float32)
    if arr.size == 0:
        return 0.0
    return float(min(1.0, arr.mean() / 80.0))


def _subject_focus_score(arr: np.ndarray) -> float:
    """Centro contiene il subject? Variance del centro / variance globale."""
    h, w = arr.shape[:2]
    cy0, cy1 = int(h * 0.25), int(h * 0.75)
    cx0, cx1 = int(w * 0.25), int(w * 0.75)
    center = arr[cy0:cy1, cx0:cx1]
    if center.size == 0 or arr.size == 0:
        return 0.5
    grey_center = np.asarray(Image.fromarray(center).convert("L"), dtype=np.float32)
    grey_full = np.asarray(Image.fromarray(arr).convert("L"), dtype=np.float32)
    full_std = float(grey_full.std()) + 1e-3
    ratio = float(grey_center.std()) / full_std
    return float(max(0.0, min(1.0, ratio * 0.9)))


def _texture_repetition_score(img: Image.Image) -> float:
    """Repetitività di pattern: divido in tile e misuro varianza dei means."""
    arr = np.asarray(img.convert("L"), dtype=np.float32)
    h, w = arr.shape
    if h < 32 or w < 32:
        return 0.0
    tile = 32
    means = []
    for y in range(0, h - tile, tile):
        for x in range(0, w - tile, tile):
            block = arr[y:y + tile, x:x + tile]
            means.append(float(block.mean()))
    if len(means) < 4:
        return 0.0
    means_arr = np.array(means, dtype=np.float32)
    # Low variance of tile-means → highly repetitive (texture).
    # Normalize: typical photo std≈30, texture std<8.
    std = float(means_arr.std())
    score = max(0.0, 1.0 - (std / 30.0))
    return float(min(1.0, score))


def _color_saturation(arr: np.ndarray) -> float:
    """Approx saturation via (max-min)/max of RGB."""
    if arr.size == 0:
        return 0.0
    a = arr.astype(np.float32)
    mx = a.max(axis=-1)
    mn = a.min(axis=-1)
    sat = np.where(mx > 0, (mx - mn) / (mx + 1e-3), 0.0)
    return float(sat.mean())


def _dominant_palette(img: Image.Image, k: int = 4) -> List[Dict[str, Any]]:
    """Top-k dominant colors via PIL quantize."""
    try:
        q = img.convert("RGB").quantize(colors=k, method=Image.Quantize.MEDIANCUT)
        palette = q.getpalette() or []
        counts = sorted(q.getcolors() or [], key=lambda x: -x[0])
        total = sum(c for c, _ in counts) or 1
        out: List[Dict[str, Any]] = []
        for count, idx in counts[:k]:
            r, g, b = palette[idx * 3], palette[idx * 3 + 1], palette[idx * 3 + 2]
            out.append({
                "hex":   f"#{r:02x}{g:02x}{b:02x}",
                "ratio": round(count / total, 3),
            })
        return out
    except Exception:
        return []


def _color_family(palette: List[Dict[str, Any]]) -> Optional[str]:
    """Heuristic mapping from dominant hex → color family label (italian)."""
    if not palette:
        return None
    hexv = palette[0]["hex"].lstrip("#")
    r = int(hexv[0:2], 16); g = int(hexv[2:4], 16); b = int(hexv[4:6], 16)
    # Neutral detection
    mx, mn = max(r, g, b), min(r, g, b)
    if mx - mn < 18:
        if mx > 220: return "bianco"
        if mx < 60:  return "nero"
        if mx < 110: return "grigio_scuro"
        return "grigio_chiaro"
    # Warm vs cool
    if r > g and r > b:
        if g > 100 and b < 100: return "ocra"
        return "terra"
    if g >= r and g > b:
        return "verde"
    if b >= r and b > g:
        if r > 100: return "blu_polvere"
        return "blu"
    return "neutro"


# ── Classification rules ────────────────────────────────────────────
def _classify_asset_type(m: Dict[str, float], page_position: Optional[str] = None) -> Tuple[str, float]:
    """Returns (asset_type, base_confidence)."""
    ws = m["whitespace_ratio"]
    ci = m["corner_isolation"]
    ed = m["edge_density"]
    tx = m["texture_repetition_score"]
    sat = m["color_saturation"]
    sf = m["subject_focus_score"]
    ar = m["aspect_ratio"]

    # 1. CUTOUT — high corner isolation + high whitespace + centered subject
    if ci > 0.78 and ws > 0.50 and sf > 0.35:
        return ("cutout", 0.88)
    if ci > 0.65 and ws > 0.40:
        return ("cutout", 0.72)

    # 2. TEXTURE — low whitespace, high repetition, near-square
    if tx > 0.65 and ws < 0.15 and 0.7 <= ar <= 1.45:
        return ("texture", 0.85)
    if tx > 0.55 and ws < 0.20:
        return ("texture", 0.68)

    # 3. TECHNICAL — very low saturation (line drawings, dimension specs)
    if sat < 0.05 and ed > 0.25:
        return ("technical", 0.80)
    if sat < 0.08 and ed > 0.18 and ws > 0.40:
        return ("technical", 0.70)

    # 4. RENDERING — smooth gradients (low edge density) + high saturation + low texture
    if ed < 0.10 and sat > 0.18 and tx < 0.35 and ws < 0.30:
        return ("rendering", 0.62)

    # 5. DETAIL / MACRO — single subject filling most of frame, no whitespace
    if sf > 0.65 and ws < 0.15 and ed > 0.20:
        return ("detail", 0.70)

    # 6. STILL_LIFE — moderate whitespace, single composition, medium edge
    if 0.20 <= ws <= 0.55 and ed > 0.12 and 0.7 <= ar <= 1.55:
        return ("still_life", 0.65)

    # 7. LIFESTYLE — wide aspect (≥1.3) OR very low whitespace + complex composition
    if ar >= 1.30 and ws < 0.25 and ed > 0.10:
        return ("lifestyle", 0.72)
    if ws < 0.10 and ed > 0.15 and sf < 0.60:
        return ("lifestyle", 0.60)

    # 8. MATERIAL_SAMPLE — small near-square, low edge density, low texture rep too,
    #    medium saturation (single uniform finish patch).
    if 0.85 <= ar <= 1.15 and ed < 0.15 and ws < 0.25:
        return ("material_sample", 0.55)

    # Fallback: still_life with low confidence (Layer 2 will be consulted)
    return ("still_life", 0.40)


def _classify_compositional_role(asset_type: str, m: Dict[str, float],
                                 ordinal_in_group: int = 0) -> str:
    """First lifestyle/big image of the product → hero. Else fall back by type."""
    ar = m["aspect_ratio"]
    ws = m["whitespace_ratio"]
    if asset_type == "lifestyle" and ordinal_in_group == 0:
        return "hero"
    if asset_type in ("lifestyle", "campaign"):
        return "focal" if ws < 0.20 else "supporting"
    if asset_type in ("still_life", "cutout"):
        return "focal" if ws < 0.35 else "supporting"
    if asset_type == "detail":
        return "accent"
    if asset_type == "texture":
        return "background"
    if asset_type in ("technical", "rendering"):
        return "structural"
    if asset_type == "material_sample":
        return "accent"
    return "supporting"


def _classify_view_angle(m: Dict[str, float], asset_type: str) -> str:
    """Best-effort heuristic. Real angle detection needs Vision LLM."""
    ar = m["aspect_ratio"]
    sf = m["subject_focus_score"]
    if asset_type == "detail" and sf > 0.7:
        return "macro"
    if asset_type == "texture":
        return "flat"
    if asset_type == "technical":
        return "flat"
    if asset_type == "lifestyle":
        return "context"
    if ar < 0.7:
        return "front"  # tall — likely front view
    if 0.85 <= ar <= 1.15 and asset_type in ("still_life", "cutout"):
        return "three_quarter"
    return "unknown"


def _editorial_score(m: Dict[str, float], asset_type: str) -> float:
    """Quality-perception score 0..1 — feeds moodboard_priority."""
    ed = m["edge_density"]
    sf = m["subject_focus_score"]
    sat = m["color_saturation"]
    ar = m["aspect_ratio"]
    base = {
        "lifestyle":       0.85,
        "still_life":      0.78,
        "cutout":          0.72,
        "detail":          0.70,
        "texture":         0.62,
        "campaign":        0.88,
        "rendering":       0.58,
        "material_sample": 0.55,
        "variant":         0.55,
        "technical":       0.30,
    }.get(asset_type, 0.55)
    # Light bonus for golden ratio / wide aspect (3:2 → 1.5)
    if 1.35 <= ar <= 1.70:
        base += 0.05
    # Saturation contributes only modestly (technical drawings should NOT be punished here twice)
    if asset_type != "technical":
        base += min(0.05, sat * 0.15)
    # Subject focus boost
    base += min(0.05, sf * 0.08)
    return float(round(max(0.0, min(1.0, base)), 3))


def _visual_weight(m: Dict[str, float], asset_type: str) -> float:
    """Quanto domina visivamente — usato dallo Smart Moodboard Engine futuro."""
    ed = m["edge_density"]
    ws = m["whitespace_ratio"]
    sat = m["color_saturation"]
    base = (1.0 - ws) * 0.55 + ed * 0.25 + sat * 0.20
    if asset_type in ("lifestyle", "campaign"):
        base += 0.10
    if asset_type in ("texture", "material_sample"):
        base -= 0.10
    return float(round(max(0.0, min(1.0, base)), 3))


def _composition_friendly(m: Dict[str, float], asset_type: str) -> float:
    """Adatto a moodboard / layout (cutouts e still_life sono i top)."""
    ws = m["whitespace_ratio"]
    sf = m["subject_focus_score"]
    base = {
        "cutout":          0.92,
        "still_life":      0.80,
        "detail":          0.74,
        "texture":         0.72,
        "lifestyle":       0.68,
        "material_sample": 0.70,
        "rendering":       0.55,
        "campaign":        0.65,
        "variant":         0.65,
        "technical":       0.25,
    }.get(asset_type, 0.55)
    base += min(0.08, sf * 0.10)
    if 0.30 <= ws <= 0.55:
        base += 0.05  # comfortable air around subject
    return float(round(max(0.0, min(1.0, base)), 3))


def _moodboard_priority(editorial: float, composition: float, weight: float) -> int:
    """1 (lowest) … 5 (highest). Combines the three scalar scores."""
    combo = (editorial * 0.45) + (composition * 0.40) + (weight * 0.15)
    if combo >= 0.85: return 5
    if combo >= 0.70: return 4
    if combo >= 0.55: return 3
    if combo >= 0.40: return 2
    return 1


def _confidence(asset_type_conf: float, m: Dict[str, float]) -> float:
    """Refine the base type confidence with signal strength."""
    bonus = 0.0
    if m["edge_density"] > 0.18:
        bonus += 0.04
    if m["subject_focus_score"] > 0.50:
        bonus += 0.04
    if m["corner_isolation"] > 0.70 or m["corner_isolation"] < 0.15:
        bonus += 0.04  # clear signal either way
    return float(round(min(0.99, asset_type_conf + bonus), 3))


# ── Public API ──────────────────────────────────────────────────────
def classify_asset(
    image_input: Any,
    *,
    width: Optional[int] = None,
    height: Optional[int] = None,
    ordinal_in_group: int = 0,
    page_position: Optional[str] = None,
) -> Dict[str, Any]:
    """Run Layer 1 classification on an asset.

    Args:
        image_input: PIL.Image | raw bytes | path
        width/height: optional explicit dims (used if PIL fails)
        ordinal_in_group: 0 for the first asset of the visual group
                         (boosts hero compositional role)
        page_position: optional ('top'|'middle'|'bottom') — used softly

    Returns dict with all rule-based metadata. Safe to store directly
    inside `inspiration_meta` JSONB.
    """
    img = _load_image(image_input)
    if img is None:
        # Skeleton fallback when image can't be loaded
        return {
            "asset_type": "still_life",
            "compositional_role": "supporting",
            "view_angle": "unknown",
            "classification_confidence": 0.30,
            "classified_by": "rule_fallback",
            "editorial_score": 0.40,
            "moodboard_priority": 2,
            "is_primary_asset": False,
        }

    img = _prepare(img)
    w, h = img.size
    arr = np.asarray(img.convert("RGB"))

    # 1. Metrics
    ws = _whitespace_ratio(arr)
    ci = _corner_isolation(arr)
    ed = _edge_density(img)
    sf = _subject_focus_score(arr)
    tx = _texture_repetition_score(img)
    sat = _color_saturation(arr)
    palette = _dominant_palette(img)
    color_family = _color_family(palette)
    ar = float(w / max(1, h))
    ns = float(ws)  # negative space ratio ≈ whitespace ratio

    metrics = {
        "aspect_ratio":             round(ar, 3),
        "whitespace_ratio":         round(ws, 3),
        "corner_isolation":         round(ci, 3),
        "edge_density":             round(ed, 3),
        "subject_focus_score":      round(sf, 3),
        "texture_repetition_score": round(tx, 3),
        "color_saturation":         round(sat, 3),
        "negative_space_score":     round(ns, 3),
        "visual_density_score":     round(1.0 - ws, 3),
    }

    # 2. Classification
    asset_type, type_conf = _classify_asset_type(metrics, page_position=page_position)
    comp_role = _classify_compositional_role(asset_type, metrics, ordinal_in_group=ordinal_in_group)
    view_angle = _classify_view_angle(metrics, asset_type)

    # 3. Derived scores
    ed_score = _editorial_score(metrics, asset_type)
    vw = _visual_weight(metrics, asset_type)
    cf = _composition_friendly(metrics, asset_type)
    priority = _moodboard_priority(ed_score, cf, vw)
    confidence = _confidence(type_conf, metrics)

    return {
        # ── Classification (3 orthogonal dimensions)
        "asset_type":                 asset_type,
        "compositional_role":         comp_role,
        "view_angle":                 view_angle,
        # ── Quality / weight scores
        "editorial_score":            ed_score,
        "visual_weight":              vw,
        "composition_friendly":       cf,
        "moodboard_priority":         priority,
        "is_primary_asset":           bool(comp_role == "hero"),
        # ── Confidence / provenance
        "classification_confidence":  confidence,
        "classified_by":              "rule",
        # ── Low-level metrics (kept for re-classification / future ML)
        "aspect_ratio":               metrics["aspect_ratio"],
        "whitespace_ratio":           metrics["whitespace_ratio"],
        "edge_density":               metrics["edge_density"],
        "subject_focus_score":        metrics["subject_focus_score"],
        "texture_repetition_score":   metrics["texture_repetition_score"],
        "negative_space_score":       metrics["negative_space_score"],
        "visual_density_score":       metrics["visual_density_score"],
        # ── Color
        "dominant_color_palette":     palette,
        "color_family":               color_family,
    }


def needs_vision_fallback(classification: Dict[str, Any]) -> bool:
    """True when Layer 1 confidence is low enough to ask the Vision LLM."""
    return float(classification.get("classification_confidence") or 0.0) < LOW_CONFIDENCE_THRESHOLD
