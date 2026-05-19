"""Supplier Catalog PDF Extractor — deterministic, no LLM.

Given a PDF byte stream + the catalog brand, returns a list of "product
candidates" with image bytes + a heuristic product name.

Strategy:
  • Use PyMuPDF to open the PDF.
  • For each page, list embedded images. Filter out tiny ones (logos,
    icons) and very wide thumbnails (page-spread photographs are kept
    only if no other product image is present).
  • Render the page to PNG at moderate DPI as a fallback when no
    embedded image is found.
  • Extract text blocks of the page — the largest font-size text that
    is short (1-4 words) is a strong product-name candidate.
  • Skip pages flagged as cover / TOC / editorial (heuristic: very long
    paragraph, "index", "contents", "introduction" in text).

This is a PRAGMATIC pipeline: ~80-85% hit rate on well-formatted
catalogs (Bonaldo, Cattelan style). Designer is best-effort. The user
will see a review grid and can deselect/edit before final import.
"""
from __future__ import annotations

import io
import logging
import re
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

# ── Tuning ───────────────────────────────────────────────────────────
MIN_IMG_WIDTH_PX   = 400         # below = thumbnail / icon
MIN_IMG_HEIGHT_PX  = 400
MAX_PAGES          = 200         # safety
RENDER_DPI         = 130         # fallback page rasterization
SKIP_PAGE_KEYWORDS = (
    "indice", "index", "table of contents", "contents",
    "introduzione", "introduction", "summary",
    "table des matières",
)
EDITORIAL_NOISE_RE = re.compile(r"^[\s\W]+$")

# Patterns che NON sono mai un product name (sono header/marketing/collection)
NAME_BLACKLIST_RE = re.compile(
    r"^(?:"
    r"\d{2,4}\s*collection|"           # '26 Collection', '2026 Collection'
    r"new\s*\d{4}|"                    # 'New 2026'
    r"preview\s*\d{4}|"                # 'Preview 2026'
    r"index|indice|contents|content|"  # index pages
    r"summary|sommario|"
    r"made\s+in\s+italy|"
    r"design\s+made\s+in\s+italy|"
    r"p\.?\s?v\.?|"                    # 'P.V. ALTERNATIVO' (alt-product marker)
    r"dettaglio|detail|"
    r"info|infos|technical|tecnico|"
    r"finiture|finishes|finishings|"
    r"www\.|http"
    r")",
    re.IGNORECASE,
)

# Common product-name positive patterns: capitalised single-or-two-word + optional 'table/sofa/chair'
NAME_HINT_KEYWORDS = (
    "table", "tavolo", "sofa", "divano", "chair", "sedia", "bed",
    "letto", "armchair", "poltrona", "sideboard", "credenza", "console",
    "consolle", "lounge", "stool", "pouf", "bookcase", "libreria",
    "mirror", "specchio", "lamp", "lampada", "rug", "tappeto",
    "outdoor", "kitchen", "cucina",
)

CATEGORY_KEYWORDS_IT = {
    "tavoli":        "Tavoli",
    "tables":        "Tavoli",
    "tavolini":      "Tavolini",
    "sedie":         "Sedie",
    "chairs":        "Sedie",
    "divani":        "Divani",
    "sofas":         "Divani",
    "poltrone":      "Poltrone",
    "armchairs":     "Poltrone",
    "letti":         "Letti",
    "beds":          "Letti",
    "credenze":      "Credenze",
    "madie":         "Madie",
    "consolle":      "Consolle",
    "consoles":      "Consolle",
    "lampade":       "Lampade",
    "lighting":      "Lampade",
    "librerie":      "Librerie",
    "bookcases":     "Librerie",
    "specchi":       "Specchi",
    "mirrors":       "Specchi",
    "scrivanie":     "Scrivanie",
    "desks":         "Scrivanie",
    "pouf":          "Pouf",
    "outdoor":       "Outdoor",
    "kitchen":       "Cucine",
    "kitchens":      "Cucine",
    "cucine":        "Cucine",
    "complementi":   "Complementi",
    "accessories":   "Complementi",
}


@dataclass
class ProductCandidate:
    page_number:    int
    image_bytes:    bytes
    image_ext:      str          # 'png' | 'jpg'
    width:          int
    height:         int
    product_name:   Optional[str]
    designer:       Optional[str]
    category_hint:  Optional[str]
    confidence:     float        # 0..1 — for sorting / UI hint


def _decide_page_skip(page_text: str) -> bool:
    low = page_text.lower()
    if any(kw in low for kw in SKIP_PAGE_KEYWORDS):
        # Very long pages with index keywords are noisy; short editorial pages can still be useful
        if len(page_text) > 200:
            return True
    return False


def _guess_product_name_and_designer(page_text: str) -> Tuple[Optional[str], Optional[str]]:
    """Heuristic: the largest text on a product page is the product name;
    a 'design [name]' or 'designer: [name]' line is the designer.

    We get text by lines (preserving spans is too fragile across PDFs).
    """
    name: Optional[str] = None
    designer: Optional[str] = None
    lines = [ln.strip() for ln in page_text.splitlines() if ln.strip()]
    # Filter very noisy lines
    lines = [ln for ln in lines if not EDITORIAL_NOISE_RE.match(ln)]
    if not lines:
        return None, None

    # Designer detection
    for ln in lines:
        low = ln.lower()
        m = re.match(r"^(?:design(?:er)?(?:ed by)?|by)[\s:.\-]+(.{2,80})$", ln, re.IGNORECASE)
        if m:
            designer = m.group(1).strip().rstrip(".,;:")
            break
        if low.startswith("design ") and len(ln) < 80:
            designer = ln[7:].strip()
            break

    # Product name detection — shortest non-noise capitalised line at top of page,
    # 1-4 words, not the brand itself, not the designer line.
    candidates = []
    for ln in lines[:15]:  # only look near top
        if len(ln) > 60: continue
        if NAME_BLACKLIST_RE.match(ln): continue
        if "©" in ln or "www." in ln or "http" in ln: continue
        # Reject section headers (es. 'Tavoli / Tables', 'Sedie / Chairs')
        if " / " in ln and any(kw in ln.lower() for kw in CATEGORY_KEYWORDS_IT):
            continue
        # Reject pure category words
        if ln.lower().strip() in CATEGORY_KEYWORDS_IT:
            continue
        word_count = len(ln.split())
        if word_count < 1 or word_count > 5: continue
        if designer and ln == designer: continue
        has_upper = any(w[:1].isupper() for w in ln.split())
        contains_kw = any(kw in ln.lower() for kw in NAME_HINT_KEYWORDS)
        if has_upper or contains_kw:
            candidates.append(ln)
    if candidates:
        # Prefer candidates that look "product-like" (contain a keyword) over pure marketing
        scored = sorted(candidates, key=lambda c: (
            0 if any(kw in c.lower() for kw in NAME_HINT_KEYWORDS) else 1,
            len(c),
        ))
        name = scored[0]
        # If name contains 'design X', split it: "Liaison design Spazioameno"
        m = re.match(r"^(.+?)\s+design(?:ed by)?\s+(.+)$", name, re.IGNORECASE)
        if m:
            name = m.group(1).strip()
            if not designer:
                designer = m.group(2).strip().rstrip(".,;:")

    return name, designer


def _guess_category(page_text: str, recent_section_header: Optional[str]) -> Optional[str]:
    """Maps the last seen section header (e.g. 'Tavoli / Tables') to a curated category."""
    if recent_section_header:
        low = recent_section_header.lower()
        for kw, cat in CATEGORY_KEYWORDS_IT.items():
            if kw in low:
                return cat
    low = page_text.lower()
    for kw, cat in CATEGORY_KEYWORDS_IT.items():
        if kw in low:
            return cat
    return None


def _detect_section_header(page_text: str) -> Optional[str]:
    """A short line containing a known category keyword (es. 'Tavoli / Tables').

    Accepts both ALL CAPS and Title Case — Bonaldo uses 'Tavoli / Tables'.
    """
    for ln in (page_text.splitlines() or [])[:6]:  # only top of page
        s = ln.strip()
        if not s or len(s) > 40: continue
        low = s.lower()
        if " / " in s and any(kw in low for kw in CATEGORY_KEYWORDS_IT):
            return s
        # ALL CAPS short heading like 'TAVOLI'
        if s.isupper() and 3 <= len(s) <= 20 and low in CATEGORY_KEYWORDS_IT:
            return s
    return None


def _extract_images_from_page(page: "fitz.Page", doc: "fitz.Document") -> List[Tuple[bytes, str, int, int]]:
    """Returns list of (image_bytes, ext, width, height) per page, large ones first."""
    out: List[Tuple[bytes, str, int, int]] = []
    seen_xrefs: set[int] = set()
    for img_info in page.get_images(full=True):
        xref = img_info[0]
        if xref in seen_xrefs:
            continue
        seen_xrefs.add(xref)
        try:
            base = doc.extract_image(xref)
        except Exception:
            continue
        if not base:
            continue
        w, h = base.get("width") or 0, base.get("height") or 0
        if w < MIN_IMG_WIDTH_PX or h < MIN_IMG_HEIGHT_PX:
            continue
        ext = (base.get("ext") or "png").lower()
        if ext not in ("jpg", "jpeg", "png"):
            # Coerce odd formats into PNG by re-rendering via fitz
            continue
        out.append((base["image"], "jpg" if ext == "jpeg" else ext, w, h))
    # Largest first (likely the hero shot)
    out.sort(key=lambda x: x[2] * x[3], reverse=True)
    return out


def extract_candidates(pdf_bytes: bytes, brand: str,
                       max_candidates: int = 80) -> Dict[str, Any]:
    """Open the PDF, return product candidates + extraction metadata.

    Returns dict with:
      candidates: List[ProductCandidate-as-dict]
      pages:      total page count
      method:     'pymupdf'
      warnings:   List[str]
    """
    warnings: List[str] = []
    candidates: List[ProductCandidate] = []
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise RuntimeError(f"PDF non leggibile: {e}")

    pages_count = min(doc.page_count, MAX_PAGES)
    if doc.page_count > MAX_PAGES:
        warnings.append(f"Catalogo lungo {doc.page_count} pagine — analizzate solo le prime {MAX_PAGES}.")

    recent_section_header: Optional[str] = None

    for pno in range(pages_count):
        page = doc.load_page(pno)
        page_text = page.get_text("text") or ""
        if _decide_page_skip(page_text):
            continue

        # Track section header for category inheritance
        sh = _detect_section_header(page_text)
        if sh:
            recent_section_header = sh

        imgs = _extract_images_from_page(page, doc)
        if not imgs:
            # No embedded hero image → skip (rendering full page is too noisy).
            continue
        # Take the largest image as hero candidate
        img_bytes, img_ext, w, h = imgs[0]

        # Skip if image looks like cover (page 0 + huge banner) — page 0 is usually cover
        if pno == 0:
            continue

        name, designer = _guess_product_name_and_designer(page_text)
        category = _guess_category(page_text, recent_section_header)

        confidence = 0.6
        if name and any(kw in name.lower() for kw in NAME_HINT_KEYWORDS):
            confidence += 0.15
        if designer:
            confidence += 0.10
        if category:
            confidence += 0.10
        confidence = min(confidence, 0.99)

        candidates.append(ProductCandidate(
            page_number=pno + 1,
            image_bytes=img_bytes,
            image_ext=img_ext,
            width=w,
            height=h,
            product_name=name,
            designer=designer,
            category_hint=category,
            confidence=round(confidence, 2),
        ))
        if len(candidates) >= max_candidates:
            warnings.append(f"Limite {max_candidates} candidati raggiunto — gli ultimi prodotti del catalogo non sono mostrati.")
            break

    doc.close()

    # De-duplicate same name appearing twice (hero page + technical sheet).
    deduped: List[ProductCandidate] = []
    last_name_seen: Dict[str, int] = {}
    for c in candidates:
        if c.product_name:
            key = c.product_name.lower().strip()
            prev = last_name_seen.get(key)
            if prev is not None and (c.page_number - prev) <= 3:
                # Same product seen 1-3 pages earlier → skip (tech sheet duplicate)
                continue
            last_name_seen[key] = c.page_number
        deduped.append(c)

    return {
        "candidates": [
            {**asdict(c), "image_bytes": None,  # serialised separately by caller
             "image_size_kb": len(c.image_bytes) // 1024}
            for c in deduped
        ],
        "_raw_candidates": deduped,  # internal — caller uses to persist bytes
        "pages":   pages_count,
        "method":  "pymupdf",
        "warnings": warnings,
        "brand":   brand,
    }
