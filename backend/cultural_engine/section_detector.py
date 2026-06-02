"""Section Detector — Phase 1 Knowledge Factory.

Detects product spreads inside a catalog PDF.

A "section" is a contiguous range of pages [start, end] that visually
describes one product (or one tightly coupled variant set). The detector
uses cheap text heuristics — no LLM, no OCR. Layout signals leveraged:

  • Big typography rows (PyMuPDF font_size)
  • "design X" / "by X" designer lines within 3 lines of a title
  • TOC / index pages (first 5 pages, "Indice" / "Index" / "Sommario")
  • Layout continuity: pages without a new title belong to the previous
    section as long as they contain at least one large image OR continue
    showing dimensions / finish references.

Output:
  List[Section] where Section is a dict with start_page, end_page,
  detected_title, detected_designer, detected_category, raw_text,
  confidence_score.

Confidence model:
  0.90  → title detected via TOC cross-check + designer line
  0.75  → title detected + designer line OR category match
  0.60  → title detected only
  0.40  → fallback section (no title detected — adjacent pages grouped)
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional, Tuple

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

MAX_PAGES = 250

# Skip pages containing these tokens for indexing
TOC_KEYWORDS = (
    "indice", "index", "table of contents", "contents",
    "introduzione", "introduction", "sommario",
    "table des matières",
)
COVER_KEYWORDS = ("collection", "catalogue", "catalog", "preview")

# Title detection
TITLE_BLACKLIST = re.compile(
    r"^(?:"
    r"\d{2,4}\s*collection|"
    r"new\s*\d{4}|"
    r"preview\s*\d{4}|"
    r"index|indice|contents|sommario|"
    r"summary|"
    r"made\s+in\s+italy|"
    r"design\s+made\s+in\s+italy|"
    r"info|infos|technical|tecnico|"
    r"finiture|finishes|finishings|finitions|finitura|finish|"
    r"materiali|materials|matériaux|"
    r"dimensioni|dimensions?|misure|sizes?|"
    r"colori|colors|couleurs|"
    r"rivestimenti|coverings|"
    r"prezzo|price|prix|"
    r"www\.|http"
    r")\b",
    re.IGNORECASE,
)
DESIGNER_RE = re.compile(
    r"^(?:design(?:er|ed)?(?:\s+by)?|by)[\s:.\-]+(.{2,80})$",
    re.IGNORECASE,
)
DESIGNER_PREFIX_RE = re.compile(r"^design\s+(.{2,80})$", re.IGNORECASE)

CATEGORY_KEYWORDS = {
    "tavoli": "Tavoli", "tables": "Tavoli", "table": "Tavoli",
    "tavolini": "Tavolini",
    "sedie": "Sedie", "chairs": "Sedie", "chair": "Sedie",
    "divani": "Divani", "sofas": "Divani", "sofa": "Divani",
    "poltrone": "Poltrone", "armchairs": "Poltrone", "armchair": "Poltrone",
    "letti": "Letti", "beds": "Letti", "bed": "Letti",
    "credenze": "Credenze", "madie": "Madie",
    "consolle": "Consolle", "consoles": "Consolle", "console": "Consolle",
    "lampade": "Lampade", "lighting": "Lampade", "lamp": "Lampade",
    "librerie": "Librerie", "bookcases": "Librerie",
    "specchi": "Specchi", "mirrors": "Specchi", "mirror": "Specchi",
    "scrivanie": "Scrivanie", "desks": "Scrivanie", "desk": "Scrivanie",
    "pouf": "Pouf", "outdoor": "Outdoor",
    "kitchen": "Cucine", "kitchens": "Cucine", "cucine": "Cucine",
    "complementi": "Complementi", "accessories": "Complementi",
    "sgabelli": "Sgabelli", "stools": "Sgabelli",
}


@dataclass
class DetectedSection:
    section_index: int
    start_page: int
    end_page: int
    detected_title: Optional[str] = None
    detected_designer: Optional[str] = None
    detected_category: Optional[str] = None
    raw_text: str = ""
    confidence_score: float = 0.40
    page_titles: List[str] = field(default_factory=list)  # internal scratch
    metadata: Dict[str, Any] = field(default_factory=dict)


# ─── TOC extraction ────────────────────────────────────────────────────
def _extract_toc(doc: "fitz.Document") -> List[Tuple[str, int]]:
    """Return list of (entry_text, page) pairs found in the first 6 pages.
    Uses both PyMuPDF's native ToC and heuristic table parsing as fallback.
    """
    out: List[Tuple[str, int]] = []
    try:
        native = doc.get_toc() or []
        for level, title, page in native:
            if title and page > 0:
                out.append((title.strip(), page))
    except Exception:
        pass
    if out:
        return out

    # Heuristic ToC: scan first 6 pages for `<text>....<digit>` patterns
    for pno in range(min(6, doc.page_count)):
        page = doc.load_page(pno)
        text = page.get_text("text") or ""
        low = text.lower()
        if not any(k in low for k in TOC_KEYWORDS):
            continue
        for line in text.splitlines():
            m = re.match(r"^(.{3,60}?)[\s\.\-_]{2,}(\d{1,3})\s*$", line.strip())
            if m:
                title = m.group(1).strip()
                page_n = int(m.group(2))
                if 3 <= len(title) <= 60 and 1 <= page_n <= doc.page_count:
                    out.append((title, page_n))
    return out


# ─── Per-page title detection ──────────────────────────────────────────
def _page_title(page: "fitz.Page") -> Tuple[Optional[str], Optional[str], float]:
    """Detect (title, designer, font_size_max). Title heuristic:
    largest font line in upper half of the page that is NOT blacklisted
    AND has 1-5 words.

    Phase 1.5 (ITER189) hardening:
      • reject titles that are pure punctuation / quote glyphs (Cattelan
        uses U+201C "“" and similar as decorative elements at font 28+)
      • require ≥2 alphabetic characters
      • require non-numeric content
    """
    page_dict = page.get_text("dict") or {}
    blocks = page_dict.get("blocks") or []
    candidates: List[Tuple[float, str, float]] = []  # (font_size, text, y_pos)
    page_height = page.rect.height or 1000.0

    for blk in blocks:
        if blk.get("type") != 0:
            continue
        for line in blk.get("lines") or []:
            for span in line.get("spans") or []:
                txt = (span.get("text") or "").strip()
                sz = float(span.get("size") or 0)
                if not txt or sz < 14:
                    continue
                if len(txt) > 60 or TITLE_BLACKLIST.match(txt):
                    continue
                # ── Phase 1.5 · reject decorative glyph / punctuation only ──
                alpha_chars = sum(1 for ch in txt if ch.isalpha())
                if alpha_chars < 2:
                    continue
                # Reject titles that are mostly digits (e.g., page numbers, years)
                digit_chars = sum(1 for ch in txt if ch.isdigit())
                if digit_chars > alpha_chars:
                    continue
                bbox = span.get("bbox") or [0, 0, 0, 0]
                y_pos = bbox[1] / page_height
                # Only upper 60% of page
                if y_pos > 0.6:
                    continue
                words = txt.split()
                if 1 <= len(words) <= 5:
                    candidates.append((sz, txt, y_pos))

    title = None
    title_font = 0.0
    if candidates:
        # Largest font, ties broken by upper-most
        candidates.sort(key=lambda c: (-c[0], c[2]))
        # Filter: must not be a pure category word
        for sz, txt, _ in candidates:
            if txt.lower().strip() in CATEGORY_KEYWORDS:
                continue
            title = txt.strip()
            title_font = sz
            break

    # Designer detection: scan ALL text lines for design[er]? pattern
    designer = None
    text = page.get_text("text") or ""
    for ln in text.splitlines():
        ln = ln.strip()
        if not ln or len(ln) > 80:
            continue
        m = DESIGNER_RE.match(ln)
        if m:
            designer = m.group(1).strip().rstrip(".,;:")
            break
        m = DESIGNER_PREFIX_RE.match(ln)
        if m and not designer:
            designer = m.group(1).strip().rstrip(".,;:")

    return title, designer, title_font


def _page_category(page_text: str) -> Optional[str]:
    low = page_text.lower()
    for kw, cat in CATEGORY_KEYWORDS.items():
        if re.search(rf"\b{re.escape(kw)}\b", low):
            return cat
    return None


def _is_skip_page(page_text: str, pno: int) -> bool:
    low = page_text.lower()
    if any(k in low for k in TOC_KEYWORDS) and len(page_text) > 200:
        return True
    return False


# ─── Section assembly ─────────────────────────────────────────────────
def detect_sections(pdf_bytes: bytes) -> Dict[str, Any]:
    """Open the PDF and return a list of DetectedSection dicts.

    Returns:
        {
          "sections":   List[Dict],
          "page_count": int,
          "toc_entries": int,
          "warnings":   List[str],
        }
    """
    warnings: List[str] = []
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise RuntimeError(f"PDF non leggibile: {e}")

    page_count = min(doc.page_count, MAX_PAGES)
    if doc.page_count > MAX_PAGES:
        warnings.append(
            f"Catalogo lungo {doc.page_count} pagine — analizzate solo le prime {MAX_PAGES}."
        )

    toc = _extract_toc(doc)
    toc_titles = {t[0].strip().lower() for t in toc}

    # Per-page analysis
    page_titles: List[Optional[str]] = [None] * page_count
    page_designers: List[Optional[str]] = [None] * page_count
    page_categories: List[Optional[str]] = [None] * page_count
    page_skips: List[bool] = [False] * page_count
    page_texts: List[str] = [""] * page_count
    page_font_max: List[float] = [0.0] * page_count

    last_category: Optional[str] = None
    for pno in range(page_count):
        page = doc.load_page(pno)
        ptext = page.get_text("text") or ""
        page_texts[pno] = ptext
        if pno == 0:  # cover skip
            page_skips[pno] = True
            continue
        if _is_skip_page(ptext, pno):
            page_skips[pno] = True
            continue
        title, designer, font_sz = _page_title(page)
        cat = _page_category(ptext)
        if cat:
            last_category = cat
        page_titles[pno] = title
        page_designers[pno] = designer
        page_categories[pno] = cat or last_category
        page_font_max[pno] = font_sz

    # ── Phase 1.5 · TOC cross-validation ──
    # If we have a non-trivial TOC (≥5 entries), demote any "title" candidate
    # that does NOT match a TOC entry (case-insensitive, fuzzy prefix). This
    # avoids treating section headers / decorative text as new product titles.
    if len(toc_titles) >= 5:
        norm_toc = {t.strip().lower(): t for t in toc_titles}
        toc_lower_set = set(norm_toc.keys())
        for pno in range(page_count):
            t = page_titles[pno]
            if not t:
                continue
            t_low = t.strip().lower()
            if t_low in toc_lower_set:
                continue
            # Substring match (TOC entry contains this OR vice versa)
            match = any(t_low in tk or tk in t_low for tk in toc_lower_set if len(tk) >= 4)
            if not match:
                # Demote to continuation page (drop the title detection)
                page_titles[pno] = None

    # Assemble sections: each NEW title starts a new section; pages with
    # no title continue the previous section (until next title).
    sections: List[DetectedSection] = []
    current: Optional[DetectedSection] = None
    section_idx = 0

    for pno in range(page_count):
        if page_skips[pno]:
            # Close current section if open, then continue
            if current:
                sections.append(current)
                current = None
            continue
        title = page_titles[pno]
        designer = page_designers[pno]
        category = page_categories[pno]
        page_no_1 = pno + 1
        if title:
            # Start a new section
            if current:
                sections.append(current)
            section_idx += 1
            current = DetectedSection(
                section_index=section_idx,
                start_page=page_no_1,
                end_page=page_no_1,
                detected_title=title,
                detected_designer=designer,
                detected_category=category,
                raw_text=page_texts[pno],
            )
            current.page_titles.append(title)
        else:
            # Continuation page
            if current is None:
                # First content page without a title → orphan section
                section_idx += 1
                current = DetectedSection(
                    section_index=section_idx,
                    start_page=page_no_1,
                    end_page=page_no_1,
                    detected_category=category,
                    raw_text=page_texts[pno],
                    confidence_score=0.30,
                )
            else:
                current.end_page = page_no_1
                current.raw_text += "\n" + page_texts[pno]
                if not current.detected_designer and designer:
                    current.detected_designer = designer
                if not current.detected_category and category:
                    current.detected_category = category

    if current:
        sections.append(current)

    # Confidence scoring
    for sec in sections:
        score = 0.0
        if sec.detected_title:
            score += 0.45
            # TOC cross-check
            if sec.detected_title.strip().lower() in toc_titles:
                score += 0.20
        if sec.detected_designer:
            score += 0.20
        if sec.detected_category:
            score += 0.10
        if sec.end_page - sec.start_page >= 1:
            score += 0.05  # multi-page is a stronger product signal
        sec.confidence_score = round(min(0.99, max(0.20, score or 0.30)), 3)

    doc.close()

    return {
        "sections":    [_serialize(s) for s in sections],
        "page_count":  page_count,
        "toc_entries": len(toc),
        "warnings":    warnings,
    }


def _serialize(sec: DetectedSection) -> Dict[str, Any]:
    d = asdict(sec)
    d.pop("page_titles", None)
    return d
