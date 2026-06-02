"""ITER200 · Brand Designer Registry™ — multi-brand verified designers.

The registry is the SINGLE source of truth for designer attribution.
OCR / Vision pipelines NEVER create a verified designer; they can only
create `needs_review` candidates. A name is promoted to verified ONLY
when it appears in the per-brand registry below or is manually approved
through the Review Actions UI.

Architecture (scalable for multi-brand certification roadmap):
  • REGISTRY[brand_slug] = list[DesignerEntry]
  • DesignerEntry = {"name", "aliases"?, "verified_by"?, "studio"?, "notes"?}
  • Resolution functions accept brand_id OR brand_slug and resolve via
    a runtime lookup against the `brands` table.

Add a new brand by appending one block. No structural code changes.
"""
from __future__ import annotations
import unicodedata
from typing import Any, Dict, List, Optional


# ── Helpers ────────────────────────────────────────────────────────
def _normalize(text: str) -> str:
    if not text:
        return ""
    t = unicodedata.normalize("NFD", str(text))
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    return " ".join(t.split()).strip().lower()


# ── Per-brand registries (brand_slug → list[DesignerEntry]) ────────
# Each entry: {"name": canonical_display, "aliases": [normalized alt], "verified_by": "source_url" }
REGISTRY: Dict[str, List[Dict[str, Any]]] = {
    # ARBI Arredobagno — verified via arbiarredobagno.com + archived
    # collection catalogs (HOME, HO.ME, PLUS, NUVOLE, BABILA, KALI, FLAT, KE).
    "arbi": [
        {"name": "Marco Acerbis",
         "aliases": ["m. acerbis", "marco acerbis design"],
         "verified_by": "arbiarredobagno.com (HO.ME, HOME PLUS)"},
        {"name": "Meneghello Paolelli Associati",
         "aliases": ["meneghello paolelli", "meneghello paolelli associates",
                     "meneghello & paolelli"],
         "verified_by": "arbiarredobagno.com (Belt, Cuir, Panier)"},
        {"name": "Calvi Brambilla",
         "aliases": ["calvi brambilla studio", "studio calvi brambilla"],
         "verified_by": "arbiarredobagno.com (flagship store)"},
        {"name": "Massimo Iosa Ghini",
         "aliases": ["iosa ghini", "m. iosa ghini", "studio iosa ghini"],
         "verified_by": "ARBI historic catalogs"},
        {"name": "Enrico Cesana",
         "aliases": ["e. cesana"],
         "verified_by": "ARBI historic catalogs"},
        {"name": "Carlo Colombo",
         "aliases": ["c. colombo"],
         "verified_by": "ARBI historic catalogs"},
        {"name": "Studio Quattroterzi",
         "aliases": ["quattroterzi", "4/3"],
         "verified_by": "ARBI historic catalogs"},
        {"name": "Lievore Altherr Molina",
         "aliases": ["lievore altherr", "altherr molina"],
         "verified_by": "ARBI historic catalogs"},
        {"name": "Stefano Cavazzana",
         "aliases": ["s. cavazzana"],
         "verified_by": "ARBI historic catalogs"},
        {"name": "Luca Papini",
         "aliases": ["l. papini"],
         "verified_by": "ARBI historic catalogs"},
    ],

    # Placeholders for next certification waves (P2).
    # When activated, populate from official brand sources.
    "arrital":   [],
    "margraf":   [],
    "nemo":      [],
    "samoa":     [],
    "riva1920":  [],
}


# ── Public API ─────────────────────────────────────────────────────
def list_brands_with_registry() -> List[str]:
    """Slugs that have at least one verified designer."""
    return [k for k, v in REGISTRY.items() if v]


def get_registry_for_brand(brand_slug: Optional[str]) -> List[Dict[str, Any]]:
    if not brand_slug:
        return []
    return REGISTRY.get(brand_slug, [])


def get_registry_for_brand_id(c, brand_id: Optional[str]) -> List[Dict[str, Any]]:
    """Resolve brand_id → slug → registry. Returns [] if unknown."""
    if not brand_id:
        return []
    rows = (c.table("brands").select("slug").eq("id", brand_id)
            .limit(1).execute().data or [])
    if not rows:
        return []
    slug = (rows[0].get("slug") or "").lower()
    # Tolerate auto-generated slugs like "arbi-test-1780373380" → "arbi"
    for known in REGISTRY.keys():
        if slug == known or slug.startswith(f"{known}-") or slug.startswith(f"{known}_"):
            return REGISTRY[known]
    return REGISTRY.get(slug, [])


def find_match(brand_slug: Optional[str], candidate: str) -> Optional[Dict[str, Any]]:
    """Return the matching DesignerEntry if `candidate` resolves to a
    registered designer for the brand, else None."""
    if not candidate:
        return None
    reg = get_registry_for_brand(brand_slug)
    if not reg:
        return None
    cn = _normalize(candidate)
    for entry in reg:
        if _normalize(entry["name"]) == cn:
            return entry
        for a in entry.get("aliases", []) or []:
            if _normalize(a) == cn:
                return entry
        # Substring match (last name)
        if cn in _normalize(entry["name"]) and len(cn) >= 4:
            return entry
    return None


# ── Legacy compatibility (callers expecting the older shape) ───────
# Old code referenced REGISTRIES[brand_id] = list[str]. Keep a thin
# lookup for backwards compatibility while the runtime path uses the
# richer structured form above.
def names_for_brand_id(c, brand_id: Optional[str]) -> List[str]:
    return [e["name"] for e in get_registry_for_brand_id(c, brand_id)]


# Kept for the entity_resolution_service import. Resolved lazily at call
# time by `harden_designer_detection` via names_for_brand_id().
REGISTRIES: Dict[str, List[str]] = {}
