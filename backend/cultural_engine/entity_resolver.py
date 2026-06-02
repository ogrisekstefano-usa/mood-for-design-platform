"""Entity Resolver™ — Phase 1 Founding Brands Program (ITER192).

After all PDFs in a Brand Import Session™ are processed, this module
walks the resulting `products` rows and `product_sections.raw_text` to
build canonical knowledge objects:

  • materials_canonical
  • designers_canonical
  • collections_canonical
  • stories_canonical

Algorithm (deterministic, NO LLM in Phase 1):
  1. Normalize entity names (lowercase, strip diacritics)
  2. Lookup canonical row (tenant_id, brand_id, key)
  3. Fuzzy match via Levenshtein for variants ("Manzoni Tapinassi" ≈
     "Manzoni & Tapinassi")
  4. Insert or update mention_count + source_document_ids + evidence

Stories are extracted by theme keyword density:
  10 themes: sustainability, heritage, craftsmanship, innovation,
  material_culture, family_business, design_collaboration, hospitality,
  outdoor_living, customization
"""
from __future__ import annotations

import logging
import re
import unicodedata
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_key(text: str) -> str:
    if not text:
        return ""
    n = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    n = re.sub(r"[^a-zA-Z0-9]+", "-", n).strip("-").lower()
    return n


def _levenshtein(a: str, b: str) -> int:
    """Simple O(n*m) Levenshtein for short strings (≤80 chars)."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i] + [0] * len(b)
        for j, cb in enumerate(b, 1):
            cost = 0 if ca == cb else 1
            curr[j] = min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
        prev = curr
    return prev[-1]


# ─── Story theme vocabulary (10 themes Italian + English) ─────────────
THEME_KEYWORDS: Dict[str, List[str]] = {
    "sustainability": [
        "sustainability", "sostenibilità", "sostenibile", "eco", "ecologi",
        "recycle", "ricicl", "reclaimed", "recuperat",
        "fsc", "responsable", "responsabile", "low impact",
        "biodegradabile", "rinnovabil", "renewable",
    ],
    "heritage": [
        "heritage", "tradition", "tradizione", "1920", "founded", "fondat",
        "since 19", "dal 19", "history", "storia", "100 years", "anni di",
        "ancestral", "ancestrale", "patrimonio",
    ],
    "craftsmanship": [
        "craftsmanship", "artigian", "handcraft", "manufactur", "fatto a mano",
        "made by hand", "lavorazione", "savoir-faire",
        "master", "maestria", "manualità", "skilled",
    ],
    "innovation": [
        "innovation", "innovazione", "research", "ricerca",
        "patent", "brevett", "experimental", "sperimentale",
        "new technology", "tecnologia",
    ],
    "material_culture": [
        "material culture", "cultura materica", "materia prima",
        "raw material", "natural", "naturale", "wood culture",
        "stone culture", "petra", "essenza",
    ],
    "family_business": [
        "family business", "famiglia", "family-owned", "azienda familiare",
        "father and son", "padre e figlio", "generation", "generazione",
        "third generation", "terza generazione",
    ],
    "design_collaboration": [
        "design by", "design:", "designer", "designed by", "collaboration",
        "collaborazione", "in collaborazione", "co-design", "studio",
    ],
    "hospitality": [
        "hospitality", "hotel", "hôtel", "resort", "boutique hotel",
        "spa", "luxury hotel", "restaurant", "ristorante",
        "lobby", "lounge", "contract hospitality",
    ],
    "outdoor_living": [
        "outdoor", "garden", "giardino", "terrace", "terrazza",
        "patio", "esterni", "weather resistant", "resistente",
        "all-weather", "open air",
    ],
    "customization": [
        "customization", "personalizz", "bespoke", "made to measure",
        "su misura", "tailor", "tailored", "configurable",
        "configurabile", "made to order", "on demand",
    ],
}


def _normalize_designer(name: str) -> str:
    """Designer-specific normalization (handles '& Manzoni', 'design ', etc.)."""
    if not name:
        return ""
    n = re.sub(r"^design(?:er|ed)?\s+", "", name, flags=re.IGNORECASE)
    n = re.sub(r"\bdesign\s*:?\s*", "", n, flags=re.IGNORECASE)
    n = re.sub(r"\s+", " ", n).strip(" .,;:")
    return _normalize_key(n)


def _brand_filter(query, brand_id: Optional[str]):
    """Apply brand_id filter handling NULL properly (Supabase client quirk)."""
    if brand_id:
        return query.eq("brand_id", brand_id)
    return query.is_("brand_id", "null")


# ─── Public API ───────────────────────────────────────────────────────
def resolve_session_entities(
    db_client: Any,
    *,
    tenant_id: str,
    brand_id: Optional[str],
    brand_import_session_id: str,
) -> Dict[str, Any]:
    """Run the full entity resolution pass for a completed session.

    Returns counts dict:
        {
          "materials":   {created: int, updated: int, total: int},
          "designers":   {created: int, updated: int, total: int},
          "collections": {created: int, updated: int, total: int},
          "stories":     {created: int, updated: int, total: int},
        }
    """
    counts: Dict[str, Any] = {
        "materials":   {"created": 0, "updated": 0, "total": 0},
        "designers":   {"created": 0, "updated": 0, "total": 0},
        "collections": {"created": 0, "updated": 0, "total": 0},
        "stories":     {"created": 0, "updated": 0, "total": 0},
    }

    # Fetch all products in this session
    products = (db_client.table("products")
                .select("id,product_name,designer_name,category_label,"
                        "materials,source_document_id,source_pages,source_section_id,"
                        "metadata_json,brand_id")
                .eq("tenant_id", tenant_id)
                .eq("brand_import_session_id", brand_import_session_id)
                .execute().data or [])

    # Fetch all section texts (for story extraction)
    sections = (db_client.table("product_sections")
                .select("id,source_document_id,raw_text,start_page")
                .in_("source_document_id",
                     list({p.get("source_document_id") for p in products if p.get("source_document_id")}) or ["__none__"])
                .execute().data or [])

    # ─── Materials ───
    mat_by_key: Dict[str, Dict[str, Any]] = {}
    mat_to_product: Dict[str, List[str]] = defaultdict(list)
    for p in products:
        for raw_mat in (p.get("materials") or []):
            key = _normalize_key(str(raw_mat))
            if not key:
                continue
            mat_to_product[key].append(p["id"])
            if key not in mat_by_key:
                mat_by_key[key] = {
                    "material_key": key,
                    "display_name": str(raw_mat).title(),
                    "evidence": [],
                    "source_document_ids": set(),
                }
            mat_by_key[key]["evidence"].append({
                "product_id":   p["id"],
                "product_name": p.get("product_name"),
                "source_document_id": p.get("source_document_id"),
            })
            if p.get("source_document_id"):
                mat_by_key[key]["source_document_ids"].add(p["source_document_id"])

    for key, data in mat_by_key.items():
        q = (db_client.table("materials_canonical").select("*")
             .eq("tenant_id", tenant_id)
             .eq("material_key", key))
        q = _brand_filter(q, brand_id)
        existing = (q.limit(1).execute().data or [])
        mention_count = len(data["evidence"])
        if existing:
            row = existing[0]
            prior_docs = set(row.get("source_document_ids") or [])
            prior_docs.update(data["source_document_ids"])
            prior_ev = row.get("evidence") or []
            db_client.table("materials_canonical").update({
                "mention_count":       (row.get("mention_count") or 0) + mention_count,
                "source_document_ids": list(prior_docs),
                "evidence":            prior_ev + data["evidence"],
                "updated_at":          _now(),
            }).eq("id", row["id"]).execute()
            counts["materials"]["updated"] += 1
        else:
            db_client.table("materials_canonical").insert({
                "id":                 str(uuid.uuid4()),
                "tenant_id":          tenant_id,
                "brand_id":           brand_id,
                "material_key":       key,
                "display_name":       data["display_name"],
                "mention_count":      mention_count,
                "source_document_ids": list(data["source_document_ids"]),
                "evidence":           data["evidence"],
                "confidence_score":   round(min(0.99, 0.55 + 0.05 * mention_count), 3),
            }).execute()
            counts["materials"]["created"] += 1
    counts["materials"]["total"] = len(mat_by_key)

    # ─── Designers (cross-brand) ───
    des_by_key: Dict[str, Dict[str, Any]] = {}
    for p in products:
        raw_d = p.get("designer_name")
        if not raw_d:
            continue
        key = _normalize_designer(raw_d)
        if not key:
            continue
        if key not in des_by_key:
            des_by_key[key] = {
                "designer_key": key,
                "display_name": raw_d.strip(),
                "product_ids":  [],
                "source_document_ids": set(),
            }
        des_by_key[key]["product_ids"].append(p["id"])
        if p.get("source_document_id"):
            des_by_key[key]["source_document_ids"].add(p["source_document_id"])

    # Fuzzy match: merge keys within Levenshtein ≤ 2
    keys_sorted = sorted(des_by_key.keys())
    merged: Dict[str, str] = {}
    for i, k in enumerate(keys_sorted):
        if k in merged:
            continue
        for k2 in keys_sorted[i + 1:]:
            if k2 in merged:
                continue
            if _levenshtein(k, k2) <= 2 and abs(len(k) - len(k2)) <= 4:
                merged[k2] = k
    for src, target in merged.items():
        data = des_by_key.pop(src, None)
        if not data:
            continue
        des_by_key[target]["product_ids"].extend(data["product_ids"])
        des_by_key[target]["source_document_ids"].update(data["source_document_ids"])

    for key, data in des_by_key.items():
        existing = (db_client.table("designers_canonical").select("*")
                    .eq("tenant_id", tenant_id)
                    .eq("designer_key", key)
                    .limit(1).execute().data or [])
        pcount = len(set(data["product_ids"]))
        if existing:
            row = existing[0]
            prior_docs = set(row.get("source_document_ids") or [])
            prior_docs.update(data["source_document_ids"])
            db_client.table("designers_canonical").update({
                "product_count":       (row.get("product_count") or 0) + pcount,
                "mention_count":       (row.get("mention_count") or 0) + pcount,
                "source_document_ids": list(prior_docs),
                "updated_at":          _now(),
            }).eq("id", row["id"]).execute()
            designer_id = row["id"]
            counts["designers"]["updated"] += 1
        else:
            designer_id = str(uuid.uuid4())
            db_client.table("designers_canonical").insert({
                "id":                  designer_id,
                "tenant_id":           tenant_id,
                "brand_id":            brand_id,
                "designer_key":        key,
                "display_name":        data["display_name"],
                "mention_count":       pcount,
                "product_count":       pcount,
                "source_document_ids": list(data["source_document_ids"]),
            }).execute()
            counts["designers"]["created"] += 1
        # Back-reference products → canonical_designer_id
        for pid in set(data["product_ids"]):
            db_client.table("products").update({
                "canonical_designer_id": designer_id, "updated_at": _now(),
            }).eq("id", pid).execute()
    counts["designers"]["total"] = len(des_by_key)

    # ─── Collections (1 per source_document, keyed by filename) ───
    doc_rows = (db_client.table("source_documents")
                .select("id,original_filename,metadata_json")
                .eq("brand_import_session_id", brand_import_session_id)
                .execute().data or [])
    for doc in doc_rows:
        fname = (doc.get("original_filename") or "").rsplit(".", 1)[0]
        coll_seed = re.sub(r"[-_]", " ", fname).strip().title() or "Default Collection"
        col_key = _normalize_key(coll_seed)
        if not col_key:
            continue
        q = (db_client.table("collections_canonical").select("*")
             .eq("tenant_id", tenant_id)
             .eq("collection_key", col_key))
        q = _brand_filter(q, brand_id)
        existing = (q.limit(1).execute().data or [])
        prods_in_doc = [p["id"] for p in products if p.get("source_document_id") == doc["id"]]
        if existing:
            row = existing[0]
            prior_docs = set(row.get("source_document_ids") or [])
            prior_docs.add(doc["id"])
            db_client.table("collections_canonical").update({
                "product_count":       (row.get("product_count") or 0) + len(prods_in_doc),
                "source_document_ids": list(prior_docs),
                "updated_at":          _now(),
            }).eq("id", row["id"]).execute()
            collection_id = row["id"]
            counts["collections"]["updated"] += 1
        else:
            collection_id = str(uuid.uuid4())
            db_client.table("collections_canonical").insert({
                "id":                  collection_id,
                "tenant_id":           tenant_id,
                "brand_id":            brand_id,
                "collection_key":      col_key,
                "display_name":        coll_seed,
                "product_count":       len(prods_in_doc),
                "source_document_ids": [doc["id"]],
            }).execute()
            counts["collections"]["created"] += 1
        # Back-reference products → canonical_collection_id
        for pid in prods_in_doc:
            db_client.table("products").update({
                "canonical_collection_id": collection_id, "updated_at": _now(),
            }).eq("id", pid).execute()
    counts["collections"]["total"] = counts["collections"]["created"] + counts["collections"]["updated"]

    # ─── Stories (theme detection per source_document) ───
    for doc in doc_rows:
        doc_id = doc["id"]
        doc_sections = [s for s in sections if s.get("source_document_id") == doc_id]
        full_text = "\n".join((s.get("raw_text") or "") for s in doc_sections).lower()
        if not full_text:
            continue
        for theme, keywords in THEME_KEYWORDS.items():
            evidence: List[Dict[str, Any]] = []
            for kw in keywords:
                for m in re.finditer(re.escape(kw.lower()), full_text):
                    start = max(0, m.start() - 60)
                    end = min(len(full_text), m.end() + 120)
                    snippet = full_text[start:end].replace("\n", " ").strip()
                    evidence.append({
                        "keyword":   kw,
                        "snippet":   snippet[:280],
                        "doc_id":    doc_id,
                    })
                    if len(evidence) >= 5:
                        break
                if len(evidence) >= 5:
                    break
            if not evidence:
                continue
            # Theme is confirmed (≥1 hit). Upsert canonical row.
            q = (db_client.table("stories_canonical").select("*")
                 .eq("tenant_id", tenant_id)
                 .eq("theme", theme)
                 .eq("title", f"{theme} · session"))
            q = _brand_filter(q, brand_id)
            existing = (q.limit(1).execute().data or [])
            if existing:
                row = existing[0]
                prior_ev = row.get("evidence") or []
                prior_docs = set(row.get("source_document_ids") or [])
                prior_docs.add(doc_id)
                db_client.table("stories_canonical").update({
                    "evidence":            prior_ev + evidence,
                    "source_document_ids": list(prior_docs),
                    "updated_at":          _now(),
                }).eq("id", row["id"]).execute()
                counts["stories"]["updated"] += 1
            else:
                db_client.table("stories_canonical").insert({
                    "id":                  str(uuid.uuid4()),
                    "tenant_id":           tenant_id,
                    "brand_id":            brand_id,
                    "theme":               theme,
                    "title":               f"{theme} · session",
                    "evidence":            evidence,
                    "source_document_ids": [doc_id],
                    "confidence_score":    round(min(0.99, 0.40 + 0.10 * len(evidence)), 3),
                }).execute()
                counts["stories"]["created"] += 1
    counts["stories"]["total"] = counts["stories"]["created"] + counts["stories"]["updated"]

    return counts
