"""Section Text Parser — Phase 1 Knowledge Factory.

Extracts structured fields (dimensions, finishes, materials, description IT/EN)
from a raw text block belonging to a product section.

Pure regex + vocabulary lookup. NO LLM in Phase 1.

Public API:
    parse_section_text(raw_text: str) -> Dict[str, Any]

Returns:
{
  "description":        "Free-form best paragraph",
  "description_i18n":   {"it": "...", "en": "..."},
  "materials":          ["ceramic", "steel"],
  "finishes":           ["Taj Mahal", "Darwin"],
  "dimensions_raw":     ["400 cm", "120 × 240 cm"],
  "dimensions_structured": {"length_cm": 400, "width_cm": 120, "height_cm": 75},
  "applications":       ["residential", "outdoor"],
  "field_confidence":   {field: score}
}
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ── Materials vocabulary (IT/EN/FR — Phase 1 baseline) ──────────────
MATERIALS_VOCAB: Dict[str, str] = {
    # canonical_key → search pattern
    "ceramic":    r"\b(ceramica|ceramic|ceramique|porcelain|porcellanata)\b",
    "marble":     r"\b(marmo|marble|marbre)\b",
    "wood":       r"\b(legno|wood|bois|noce|rovere|frassino|teak|walnut|oak|ash|olmo)\b",
    "steel":      r"\b(acciaio|steel|stainless|inox|metallo|metal)\b",
    "aluminum":   r"\b(allumini[oa]|aluminium|aluminum)\b",
    "brass":      r"\b(ottone|brass|laiton)\b",
    "glass":      r"\b(vetro|glass|verre|crystal|cristall[oi])\b",
    "leather":    r"\b(pelle|cuoio|leather|cuir)\b",
    "fabric":     r"\b(tessuto|fabric|tissu|velluto|velvet|lin[ao]|linen|cotone)\b",
    "stone":      r"\b(pietra|stone|pierre|granito|granite)\b",
    "concrete":   r"\b(cemento|concrete|béton)\b",
    "lacquer":    r"\b(laccato|lacquer|laque|laccatura)\b",
    "rattan":     r"\b(rattan|midollino)\b",
    "plastic":    r"\b(plastica|plastic|polipropilene|polypropylene|polietilene|polyethylene)\b",
    "resin":      r"\b(resina|resin)\b",
}

# ── Application contexts ────────────────────────────────────────────
APPLICATIONS_VOCAB: Dict[str, str] = {
    "residential":  r"\b(residenziale|residential|home|casa|domestic[oa]?)\b",
    "outdoor":      r"\b(outdoor|esterni?|exterieur|giardino|garden)\b",
    "hospitality":  r"\b(hospitality|albergo|hotel|h[ôo]tellerie|contract)\b",
    "contract":     r"\b(contract|ufficio|office|workplace)\b",
    "dining":       r"\b(dining|pranzo|sala\s+da\s+pranzo)\b",
    "lounge":       r"\b(lounge|relax|salotto)\b",
}

# ── Headers that introduce finish lists ─────────────────────────────
FINISH_HEADERS = (
    "finiture", "finishes", "finitions",
    "finitura", "finish",
    "colori", "colors", "couleurs",
    "rivestimenti", "coverings",
)

# ── Headers that introduce material lists ───────────────────────────
MATERIAL_HEADERS = (
    "materiali", "materials", "matériaux",
)

# ── Phase 1.5 · Known finish vocabulary (Cattelan / industry baseline) ──
# Capitalized finish/color names commonly used in premium catalogues.
# Detection: case-sensitive search on normalized text, plus the more
# generic capitalized-phrase rule below.
KNOWN_FINISHES = (
    # Metal coatings
    "Oxybrass", "Oxygrey", "Oxychrome",
    "Titanium", "Titanio", "Embossed Titanium",
    "Bronze", "Bronzo", "Embossed Bronze",
    "Black", "Nero", "Matt Black",
    "Brass", "Ottone", "Burnished Brass",
    "Chrome", "Cromo",
    # Stone / ceramic finishes (Cattelan + industry-standard)
    "Carrara", "Calacatta", "Borghini Calacatta",
    "Lepanto", "Sahara Noir", "Sahara",
    "Travertine", "Travertino",
    "Statuario", "Statuary",
    "Marquinia", "Nero Marquina",
    "Eramosa", "Patagonia",
    "Biscuit", "Cement", "Cemento",
    "Taj Mahal", "Darwin",
    # Wood finishes
    "Burned Oak", "Rovere Bruciato",
    "Walnut", "Noce",
    "Oak", "Rovere",
    "Ash", "Frassino",
    "Smoked Oak", "Rovere Affumicato",
    # Color / fabric callouts (Cattelan Tortora etc.)
    "Tortora", "Sand", "Sabbia", "Ivory", "Avorio",
    "Olive", "Oliva",
    "Cognac", "Tobacco",
)
KNOWN_FINISHES_LOWER = {f.lower() for f in KNOWN_FINISHES}

# ── Dimensions regex ────────────────────────────────────────────────
# Examples: 240×100×75, 240x100x75, 240 x 100 cm, Ø 120, ⌀120
DIM_3D_RE = re.compile(
    r"(\d{2,4})\s*[x×X*]\s*(\d{2,4})\s*[x×X*]\s*(\d{2,4})\s*(cm|mm|m|inch)?",
    re.IGNORECASE,
)
DIM_2D_RE = re.compile(
    r"(\d{2,4})\s*[x×X*]\s*(\d{2,4})\s*(cm|mm|m|inch)?",
    re.IGNORECASE,
)
DIM_DIAMETER_RE = re.compile(
    r"(?:[ØøⓄ⌀])\s*(\d{2,4})\s*(cm|mm)?",
)
DIM_HEIGHT_RE = re.compile(
    r"\b[hH]\s*[:.]?\s*(\d{2,4})\s*(cm|mm)?",
)
DIM_RAW_RE = re.compile(
    r"\b\d{2,4}\s*(?:cm|mm)\b",
    re.IGNORECASE,
)

# ── Title-like / header lines we should NOT use as description ──────
HEADER_LIKE_RE = re.compile(
    r"^(?:design(?:er|ed)?(?:\s+by)?[\s:.\-]|"
    r"by\s+|"
    r"finiture\b|finishes\b|materiali\b|materials\b|"
    r"dimensions?\b|dimensioni\b|"
    r"pagina\s+\d+|page\s+\d+|"
    r"\d{1,3}\s*$"
    r")",
    re.IGNORECASE,
)

# ─────────────────────────────────────────────────────────────────────
def _normalize_text(text: str) -> str:
    """Collapse whitespace, normalize unicode quirks."""
    if not text:
        return ""
    # Normalize × → x for dimension matching
    text = text.replace("\u2715", "x").replace("\u00d7", "x")
    # Collapse multiple spaces but keep newlines
    text = re.sub(r"[ \t]+", " ", text)
    return text


def _extract_materials(text: str) -> Tuple[List[str], float]:
    """Return (materials, confidence) using vocabulary match."""
    found: List[str] = []
    low = text.lower()
    for key, pattern in MATERIALS_VOCAB.items():
        if re.search(pattern, low, re.IGNORECASE):
            found.append(key)
    found = sorted(set(found))
    # Confidence: scales with how many materials matched
    if not found:
        return [], 0.0
    conf = min(0.95, 0.50 + 0.10 * len(found))
    return found, conf


def _extract_finishes(text: str) -> Tuple[List[str], float]:
    """Detect lines following a finish-header AND inline finish callouts.

    Phase 1.5 (ITER189) inline detection:
      • Match known finish names case-insensitively anywhere in the text
      • Match capitalized 1-3 word phrases following "in <Finish>" / "with <Finish>"
        / "frame in <Finish>" / "top in <Finish>" patterns
    """
    finishes: List[str] = []
    norm = text or ""

    # ── (1) Block-style detection (legacy) ──
    lines = norm.splitlines()
    in_block = False
    block_lines = 0
    for raw in lines:
        ln = raw.strip()
        low = ln.lower().rstrip(":.")
        if low in FINISH_HEADERS or any(low.startswith(h) for h in FINISH_HEADERS):
            in_block = True
            block_lines = 0
            continue
        if in_block:
            block_lines += 1
            if not ln:
                if block_lines > 1:
                    in_block = False
                continue
            if len(ln) > 50 or block_lines > 30:
                in_block = False
                continue
            if any(ln.lower().startswith(h) for h in (*MATERIAL_HEADERS, "dimensioni", "dimensions")):
                in_block = False
                continue
            words = ln.split()
            if 1 <= len(words) <= 5 and ln[0].isalpha():
                clean = re.sub(r"[\s\-\.,;:]+$", "", ln)
                clean = re.sub(r"\s+\d{2,}$", "", clean)
                if 2 <= len(clean) <= 50:
                    finishes.append(clean)

    # ── (2) Phase 1.5 · Inline detection of known finish names ──
    low_norm = norm.lower()
    for f in KNOWN_FINISHES:
        # Case-insensitive whole-word match
        if re.search(rf"\b{re.escape(f.lower())}\b", low_norm):
            finishes.append(f)

    # ── (3) Phase 1.5 · Capitalized phrases after "in/with/and/frame/top/base in" ──
    pattern = re.compile(
        r"\b(?:in|with|and|frame in|top in|base in|inserto in|finitura)\s+"
        r"([A-Z][A-Za-zÀ-ÿ]+(?:\s+[A-Z][A-Za-zÀ-ÿ]+){0,2})",
    )
    for m in pattern.finditer(norm):
        phrase = m.group(1).strip()
        # Skip generic words
        if phrase.lower() in ("the", "this", "italy", "italia", "design", "and"):
            continue
        if 4 <= len(phrase) <= 50:
            finishes.append(phrase)

    # Dedup (case-insensitive)
    seen: set = set()
    unique: List[str] = []
    for f in finishes:
        k = f.lower().strip()
        if k in seen:
            continue
        seen.add(k)
        unique.append(f)

    if not unique:
        return [], 0.0
    conf = min(0.92, 0.45 + 0.05 * len(unique))
    return unique, conf


def _extract_dimensions(text: str) -> Tuple[List[str], Dict[str, Any], float]:
    """Return (dimensions_raw, dimensions_structured, confidence).

    Phase 1.5 (ITER189) hardening for Cattelan-style tabular schemas:
      • detect SAG. prefix as dimensional marker
      • detect runs of isolated numbers on consecutive lines
        (e.g., "200 / 120 / 240 / 120 / 130 / 300" = width/depth/etc.)
      • detect comma-decimal Italian notation (53,5)
    """
    raw_hits: List[str] = []
    structured: Dict[str, Any] = {}
    norm = _normalize_text(text)

    # 3D match (e.g., 240x100x75 cm)
    for m in DIM_3D_RE.finditer(norm):
        a, b, c, unit = m.group(1), m.group(2), m.group(3), (m.group(4) or "cm").lower()
        raw_hits.append(f"{a}×{b}×{c} {unit}")
        if "length_cm" not in structured:
            structured.update({
                "length_cm": int(a) if unit == "cm" else None,
                "width_cm":  int(b) if unit == "cm" else None,
                "height_cm": int(c) if unit == "cm" else None,
                "unit": unit,
            })

    # 2D match (e.g., 240x100 cm) — only if 3D didn't fire on the same start
    for m in DIM_2D_RE.finditer(norm):
        # Skip if part of a 3D capture already
        after = norm[m.end():m.end() + 3]
        if re.search(r"[x×X*]\s*\d", after):
            continue
        a, b, unit = m.group(1), m.group(2), (m.group(3) or "cm").lower()
        raw_hits.append(f"{a}×{b} {unit}")
        if "length_cm" not in structured:
            structured.update({
                "length_cm": int(a) if unit == "cm" else None,
                "width_cm":  int(b) if unit == "cm" else None,
                "unit": unit,
            })

    # Diameter
    for m in DIM_DIAMETER_RE.finditer(norm):
        d, unit = m.group(1), (m.group(2) or "cm").lower()
        raw_hits.append(f"Ø {d} {unit}")
        structured.setdefault("diameter_cm", int(d) if unit == "cm" else None)

    # Height (h: 75 cm)
    for m in DIM_HEIGHT_RE.finditer(norm):
        h, unit = m.group(1), (m.group(2) or "cm").lower()
        raw_hits.append(f"h {h} {unit}")
        structured.setdefault("height_cm", int(h) if unit == "cm" else None)

    # ── Phase 1.5 · Tabular detection ──
    # Cattelan technical schemas list dimensions as runs of isolated numbers
    # on consecutive lines: "200\n120\n240\n120\n130\n300\nSAG.\n..."
    # We detect runs of ≥3 numeric-only lines (with optional comma decimals)
    # and emit them as tabular dimensions.
    tabular_run: List[str] = []
    sag_seen = False
    for raw in (text or "").splitlines():
        ln = raw.strip()
        if not ln:
            if tabular_run and len(tabular_run) >= 3:
                raw_hits.append("tabular: " + " · ".join(tabular_run))
            tabular_run = []
            continue
        if re.fullmatch(r"SAG\.?", ln, re.IGNORECASE):
            sag_seen = True
            continue
        # Match isolated number (with optional Ø prefix, comma decimal, A/B prefix)
        m = re.fullmatch(r"[ØA-D]?\s*\d{2,4}(?:[.,]\d{1,2})?", ln)
        if m:
            tabular_run.append(ln)
            continue
        # End of run on non-numeric line
        if tabular_run and len(tabular_run) >= 3:
            raw_hits.append("tabular: " + " · ".join(tabular_run))
        tabular_run = []
    if tabular_run and len(tabular_run) >= 3:
        raw_hits.append("tabular: " + " · ".join(tabular_run))

    if sag_seen and tabular_run:
        # boost confidence for SAG-pattern
        pass

    raw_hits = list(dict.fromkeys(raw_hits))
    if not raw_hits:
        return [], {}, 0.0
    # Boost confidence when both structured + tabular signals present
    base = 0.55
    base += min(0.30, 0.08 * len(raw_hits))
    if structured.get("length_cm") or structured.get("diameter_cm"):
        base += 0.05
    if sag_seen:
        base += 0.05
    conf = min(0.95, base)
    structured = {k: v for k, v in structured.items() if v is not None}
    return raw_hits, structured, conf


def _extract_applications(text: str) -> List[str]:
    found: List[str] = []
    low = text.lower()
    for key, pattern in APPLICATIONS_VOCAB.items():
        if re.search(pattern, low, re.IGNORECASE):
            found.append(key)
    return sorted(set(found))


def _detect_language(snippet: str) -> str:
    """Heuristic IT/EN detection — falls back to langdetect if available."""
    if not snippet or len(snippet) < 20:
        return "und"
    low = snippet.lower()
    # Tier 1: cheap stopword test
    it_score = sum(1 for w in (" il ", " la ", " e ", " di ", " del ", " della ", " con ", " per ", " un ", " una ", " da ", " in ") if w in f" {low} ")
    en_score = sum(1 for w in (" the ", " of ", " and ", " in ", " with ", " for ", " is ", " on ", " a ", " an ") if w in f" {low} ")
    if it_score >= en_score + 2:
        return "it"
    if en_score >= it_score + 2:
        return "en"
    try:
        import langdetect
        langdetect.DetectorFactory.seed = 0
        return langdetect.detect(snippet)
    except Exception:
        return "und"


def _extract_description(text: str) -> Tuple[Optional[str], Dict[str, str]]:
    """Pick the longest editorial-looking paragraph. Split into IT/EN via
    cheap language detection.
    """
    if not text:
        return None, {}
    # Group lines into paragraphs (blank-line separated)
    paragraphs: List[str] = []
    buf: List[str] = []
    for ln in text.splitlines():
        s = ln.strip()
        if not s:
            if buf:
                paragraphs.append(" ".join(buf))
                buf = []
            continue
        if HEADER_LIKE_RE.match(s):
            if buf:
                paragraphs.append(" ".join(buf))
                buf = []
            continue
        if len(s) < 30 and re.match(r"^[A-Z]{2,}", s):
            # All-caps short header line
            if buf:
                paragraphs.append(" ".join(buf))
                buf = []
            continue
        buf.append(s)
    if buf:
        paragraphs.append(" ".join(buf))

    # Filter: keep paragraphs ≥ 60 chars and ≥ 3 sentences-worth of content
    candidates = [p for p in paragraphs if len(p) >= 60 and " " in p]
    if not candidates:
        return None, {}
    # Sort longest first — best editorial paragraph
    candidates.sort(key=lambda p: -len(p))
    desc_i18n: Dict[str, str] = {}
    main: Optional[str] = None
    for p in candidates[:3]:  # at most 3 paragraphs
        lang = _detect_language(p[:300])
        if lang not in ("it", "en"):
            continue
        if lang not in desc_i18n:
            desc_i18n[lang] = p
            if main is None:
                main = p
        if "it" in desc_i18n and "en" in desc_i18n:
            break
    if main is None and candidates:
        # Fallback: store the longest paragraph as `it` (default tone)
        main = candidates[0]
        desc_i18n.setdefault("it", main)
    return main, desc_i18n


# ─── Public API ───────────────────────────────────────────────────────
def parse_section_text(raw_text: str) -> Dict[str, Any]:
    """Run the full text parsing pipeline on a section's raw text."""
    norm = _normalize_text(raw_text or "")

    materials, mat_conf = _extract_materials(norm)
    finishes, fin_conf = _extract_finishes(norm)
    dims_raw, dims_struct, dim_conf = _extract_dimensions(norm)
    applications = _extract_applications(norm)
    description, desc_i18n = _extract_description(norm)

    field_confidence = {
        "materials":  round(mat_conf, 3),
        "finishes":   round(fin_conf, 3),
        "dimensions": round(dim_conf, 3),
        "description": round(0.65 if description and len(description) > 120 else (0.45 if description else 0.0), 3),
    }

    return {
        "description":           description,
        "description_i18n":      desc_i18n,
        "materials":             materials,
        "finishes":              finishes,
        "dimensions_raw":        dims_raw,
        "dimensions_structured": dims_struct,
        "applications":          applications,
        "field_confidence":      field_confidence,
    }
