"""Supplier Catalog PDF Extractor — Phase F1 (Product Visual Ecosystem™).

REVISIONE F1 · Strategic architecture update:

NON estrae più solo la "hero image più grande" per pagina.
Estrae TUTTI gli asset visuali utili compositivamente:
  • lifestyle / ambient shots
  • still life
  • cutout PNG
  • texture / material swatch
  • dettagli macro
  • technical views / dimension drawings
  • renderings
  • color variants

Filtri minimi (NON contestuali):
  • min 300x300 px (era 400x400 hero-only)
  • escluse solo immagini palesemente icona / logo (< 300px lato corto)
  • escluse immagini con area trascurabile (< 90k px²)
  • dedup per xref nello stesso pagina

Grouping:
  ogni candidato porta `nearby_pages_key` (window di 3 pagine consecutive)
  e `extracted_name` (best-effort dal testo della pagina) usati a valle
  dal visual_grouping.compute_visual_group_key().

Output legacy compatibile:
  ProductCandidate dataclass arricchito con `asset_index_in_page`,
  `nearby_pages_key` e booleani non-intrusivi. Le righe esistenti del
  finalize() continuano a leggere `page_number`, `image_bytes`,
  `product_name`, `category_hint`, `confidence` ecc.
"""
from __future__ import annotations

import io
import logging
import re
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional, Tuple

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

# ── Tuning (Phase F1) ────────────────────────────────────────────────
MIN_IMG_WIDTH_PX   = 300          # was 400 hero-only — abbassato
MIN_IMG_HEIGHT_PX  = 300
MIN_AREA_PX        = 90_000       # 300x300 = 90k — guardrail anti-icona
MAX_IMAGES_PER_PAGE = 6           # safety: pagine catalogo "wall of images"
MAX_PAGES          = 220
MAX_CANDIDATES_DEFAULT = 240      # era 80 — ora molti più asset
RENDER_DPI         = 130
PAGE_WINDOW        = 3            # group fallback when no name
SKIP_PAGE_KEYWORDS = (
    "indice", "index", "table of contents", "contents",
    "introduzione", "introduction", "summary",
    "table des matières",
)
EDITORIAL_NOISE_RE = re.compile(r"^[\s\W]+$")

NAME_BLACKLIST_RE = re.compile(
    r"^(?:"
    r"\d{2,4}\s*collection|"
    r"new\s*\d{4}|"
    r"preview\s*\d{4}|"
    r"index|indice|contents|content|"
    r"summary|sommario|"
    r"made\s+in\s+italy|"
    r"design\s+made\s+in\s+italy|"
    r"p\.?\s?v\.?|"
    r"dettaglio|detail|"
    r"info|infos|technical|tecnico|"
    r"finiture|finishes|finishings|"
    r"www\.|http"
    r")",
    re.IGNORECASE,
)

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
    page_number:          int
    image_bytes:          bytes
    image_ext:            str          # 'png' | 'jpg'
    width:                int
    height:               int
    product_name:         Optional[str]
    designer:             Optional[str]
    category_hint:        Optional[str]
    confidence:           float        # 0..1 — extraction confidence (NOT classification)
    asset_index_in_page:  int = 0      # 0 = largest on page (likely hero)
    nearby_pages_key:     int = 0      # window for fallback grouping
    extracted_name:       Optional[str] = None
    page_position:        Optional[str] = None  # 'top' | 'middle' | 'bottom' (rough)


def _page_window(pno: int, window: int = PAGE_WINDOW) -> int:
    if pno < 1:
        return 0
    return ((pno - 1) // window) * window + 1


def _decide_page_skip(page_text: str) -> bool:
    low = page_text.lower()
    if any(kw in low for kw in SKIP_PAGE_KEYWORDS):
        if len(page_text) > 200:
            return True
    return False


def _guess_product_name_and_designer(page_text: str) -> Tuple[Optional[str], Optional[str]]:
    """Identical to legacy heuristic — kept stable for back-compat."""
    name: Optional[str] = None
    designer: Optional[str] = None
    lines = [ln.strip() for ln in page_text.splitlines() if ln.strip()]
    lines = [ln for ln in lines if not EDITORIAL_NOISE_RE.match(ln)]
    if not lines:
        return None, None

    for ln in lines:
        m = re.match(r"^(?:design(?:er)?(?:ed by)?|by)[\s:.\-]+(.{2,80})$", ln, re.IGNORECASE)
        if m:
            designer = m.group(1).strip().rstrip(".,;:")
            break
        if ln.lower().startswith("design ") and len(ln) < 80:
            designer = ln[7:].strip()
            break

    candidates = []
    for ln in lines[:15]:
        if len(ln) > 60: continue
        if NAME_BLACKLIST_RE.match(ln): continue
        if "©" in ln or "www." in ln or "http" in ln: continue
        if " / " in ln and any(kw in ln.lower() for kw in CATEGORY_KEYWORDS_IT):
            continue
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
        scored = sorted(candidates, key=lambda c: (
            0 if any(kw in c.lower() for kw in NAME_HINT_KEYWORDS) else 1,
            len(c),
        ))
        name = scored[0]
        m = re.match(r"^(.+?)\s+design(?:ed by)?\s+(.+)$", name, re.IGNORECASE)
        if m:
            name = m.group(1).strip()
            if not designer:
                designer = m.group(2).strip().rstrip(".,;:")

    return name, designer


def _guess_category(page_text: str, recent_section_header: Optional[str]) -> Optional[str]:
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
    for ln in (page_text.splitlines() or [])[:6]:
        s = ln.strip()
        if not s or len(s) > 40: continue
        low = s.lower()
        if " / " in s and any(kw in low for kw in CATEGORY_KEYWORDS_IT):
            return s
        if s.isupper() and 3 <= len(s) <= 20 and low in CATEGORY_KEYWORDS_IT:
            return s
    return None


def _extract_images_from_page(page: "fitz.Page", doc: "fitz.Document") -> List[Tuple[bytes, str, int, int]]:
    """Phase F1: return ALL compositionally useful images on the page,
    ordered largest-first. NOT only the top-1.
    """
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
        if w * h < MIN_AREA_PX:
            continue
        ext = (base.get("ext") or "png").lower()
        if ext not in ("jpg", "jpeg", "png"):
            continue
        out.append((base["image"], "jpg" if ext == "jpeg" else ext, w, h))
    # Sort largest first — index 0 is the candidate hero/lifestyle
    out.sort(key=lambda x: x[2] * x[3], reverse=True)
    # Cap at MAX_IMAGES_PER_PAGE
    return out[:MAX_IMAGES_PER_PAGE]


def extract_candidates(pdf_bytes: bytes, brand: str,
                       max_candidates: int = MAX_CANDIDATES_DEFAULT) -> Dict[str, Any]:
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

        sh = _detect_section_header(page_text)
        if sh:
            recent_section_header = sh

        imgs = _extract_images_from_page(page, doc)
        if not imgs:
            continue

        # Skip page 0 cover (full bleed marketing)
        if pno == 0:
            continue

        name, designer = _guess_product_name_and_designer(page_text)
        category = _guess_category(page_text, recent_section_header)

        page_no_1based = pno + 1
        window = _page_window(page_no_1based)

        for idx, (img_bytes, img_ext, w, h) in enumerate(imgs):
            # Base extraction confidence — Layer 1 classifier will produce its own
            confidence = 0.6
            if name and any(kw in name.lower() for kw in NAME_HINT_KEYWORDS):
                confidence += 0.15
            if designer:
                confidence += 0.10
            if category:
                confidence += 0.10
            # Secondary images on page slightly lower extraction confidence
            if idx > 0:
                confidence -= 0.05 * idx
            confidence = max(0.20, min(confidence, 0.99))

            candidates.append(ProductCandidate(
                page_number=page_no_1based,
                image_bytes=img_bytes,
                image_ext=img_ext,
                width=w,
                height=h,
                # product_name is propagated to all images on the same page —
                # they belong to the same product (detail, cutout, lifestyle etc.)
                product_name=name,
                designer=designer,
                category_hint=category,
                confidence=round(confidence, 2),
                asset_index_in_page=idx,
                nearby_pages_key=window,
                extracted_name=name,
                page_position="middle",
            ))
            if len(candidates) >= max_candidates:
                break
        if len(candidates) >= max_candidates:
            warnings.append(f"Limite {max_candidates} asset raggiunto — il catalogo prosegue oltre questo punto.")
            break

    doc.close()

    # Dedup: NON dedup-by-name across pages anymore (we WANT detail + hero + cutout
    # of the same product). Dedup only EXACT duplicate (same page + same byte length)
    # which can happen if the PDF references the same xref via two transforms.
    deduped: List[ProductCandidate] = []
    seen: set[Tuple[int, int]] = set()
    for c in candidates:
        key = (c.page_number, len(c.image_bytes))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(c)

    return {
        "candidates": [
            {
                **asdict(c),
                "image_bytes": None,  # serialised separately by caller
                "image_size_kb": len(c.image_bytes) // 1024,
            }
            for c in deduped
        ],
        "_raw_candidates": deduped,  # internal — caller uses to persist bytes
        "pages":   pages_count,
        "method":  "pymupdf",
        "warnings": warnings,
        "brand":   brand,
    }
