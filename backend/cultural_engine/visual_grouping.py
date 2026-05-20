"""Visual Grouping System™ — raggruppa asset visuali dello stesso prodotto.

Phase F1 (Product Visual Ecosystem™).

NON è similarity hashing pesante. È una euristica deterministica:

  visual_group_key =
      "<tenant_id_or_global>::<supplier_catalog_id_or_brand>::<normalized_name>::<collection_norm>"

Lo stesso prodotto fotografato in più angolazioni / dettagli / texture
viene riconosciuto perché:
  • condivide brand_id + supplier_catalog_id
  • condivide product_name normalizzato (whitespace/case/diacritici puliti
    + suffissi tecnici rimossi: "01", "02", "_detail", "_macro", " front")

Quando il nome manca:
  • fallback su page-window (pagine consecutive nello stesso catalogo)
    via `nearby_pages_key` — il catalog_extractor ora consegna anche
    `nearby_pages_key` su candidati senza nome.

Future:
  • dHash / pHash perceptual similarity per gruppi cross-catalog
  • semantic embedding via Vision LLM (Layer 2)
"""
from __future__ import annotations

import re
import unicodedata
from typing import Optional

# Suffissi tecnici/varianti che NON differenziano il prodotto.
# Rimossi per ottenere il base name del prodotto.
TECH_SUFFIXES = (
    r"\b(detail|macro|close[\-\s]?up|technical|tech|drawing|render|rendering|"
    r"front|back|side|top|bottom|three[\-\s]?quarter|34|"
    r"texture|fabric|material|finish|sample|swatch|"
    r"cutout|cut[\-\s]?out|isolated|"
    r"variant|colorway|color|colour|finitura|"
    r"campaign|editorial|lifestyle|ambient|context)\b"
)
_TECH_RE = re.compile(TECH_SUFFIXES, re.IGNORECASE)
_NUM_RE = re.compile(r"\b0?\d{1,2}\b")          # "01", "02", "12"
_SEP_RE = re.compile(r"[_\-\.\|/]+")
_MULTI_WS = re.compile(r"\s+")


def normalize_product_name(name: Optional[str]) -> Optional[str]:
    """Normalize a product name for grouping.

    Examples:
      'Flatiron Table 02 Detail'  → 'flatiron table'
      'OSHI_macro_front'          → 'oshi'
      'Liaison — Texture Sample'  → 'liaison'
      None or ''                  → None
    """
    if not name or not isinstance(name, str):
        return None
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    s = _SEP_RE.sub(" ", s)
    s = _TECH_RE.sub(" ", s)
    s = _NUM_RE.sub(" ", s)
    s = _MULTI_WS.sub(" ", s).strip().lower()
    # Strip trailing connector words
    s = re.sub(r"\b(by|design|edition|ed|series|model|mod)\b", " ", s)
    s = _MULTI_WS.sub(" ", s).strip()
    return s or None


def compute_visual_group_key(
    *,
    tenant_id: Optional[str],
    supplier_catalog_id: Optional[str],
    brand_id: Optional[str],
    brand_name: Optional[str],
    product_name: Optional[str],
    collection: Optional[str] = None,
    page_window: Optional[int] = None,
) -> str:
    """Produce a stable group key.

    Priority:
      1. (tenant, catalog, normalized_name)   — strongest signal
      2. (tenant, catalog, page_window)       — fallback: pages 12-15 cluster
      3. (tenant, brand, normalized_name)     — cross-catalog same product
      4. (orphan, hash-of-raw-name)           — last resort

    Returns a string of form 'scope::cluster' with no spaces.
    """
    scope = tenant_id or "global"

    norm = normalize_product_name(product_name)
    coll_norm = normalize_product_name(collection) or ""

    if supplier_catalog_id and norm:
        cluster = f"cat:{supplier_catalog_id}:p:{norm}"
        if coll_norm:
            cluster += f":c:{coll_norm}"
        return f"{scope}::{cluster}".replace(" ", "_")

    if supplier_catalog_id and page_window is not None:
        return f"{scope}::cat:{supplier_catalog_id}:w:{page_window:03d}"

    if brand_id and norm:
        return f"{scope}::brand:{brand_id}:p:{norm}".replace(" ", "_")

    if brand_name and norm:
        bslug = re.sub(r"[^a-z0-9]+", "-", brand_name.lower()).strip("-")
        return f"{scope}::brand:{bslug}:p:{norm}".replace(" ", "_")

    # Orphan — group only with itself
    raw = (product_name or "orphan").lower()
    raw = re.sub(r"\s+", "-", raw)
    return f"{scope}::orphan:{raw}"


def page_window_for(page_number: int, window_size: int = 3) -> int:
    """Pages [1-3] → 1, [4-6] → 4 etc. Used as fallback grouping when no name."""
    if not page_number or page_number < 1:
        return 0
    return ((page_number - 1) // window_size) * window_size + 1
