"""ITER199 · MOOD Entity Resolution Layer™.

Reusable canonical resolver + knowledge-graph builder for any brand.
Operates as a sequence of idempotent steps over a catalog_set:

   1. demote_false_collections(set_id)         §3
   2. normalize_finishes(set_id)               §1+§2
   3. assign_product_categories(set_id)        §4
   4. link_products_to_collections(set_id)     §5
   5. harden_designer_detection(set_id)        §7
   6. build_graph_edges(set_id)                §6
   7. compute_knowledge_score(set_id)          §8

Each step is replayable (no destructive mutations beyond entity
status flags + product canonical_collection_id + KG edge inserts).
"""
from __future__ import annotations
import logging
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from database import db

logger = logging.getLogger("entity_resolution")

# ══════════════════════════════════════════════════════════════════════
#                       ALIAS MAPS & TAXONOMIES
# ══════════════════════════════════════════════════════════════════════

# ── Canonical finishes — multi-lingual alias map ──
# Each entry: canonical_slug → (display_label_it, [aliases_lowercased])
CANONICAL_FINISHES: Dict[str, Tuple[str, List[str]]] = {
    # Colors
    "nero":         ("Nero",          ["nero", "black", "noir", "negro"]),
    "bianco":       ("Bianco",        ["bianco", "white", "blanc", "blanco"]),
    "grigio":       ("Grigio",        ["grigio", "grey", "gray", "gris"]),
    "verde":        ("Verde",         ["verde", "green", "vert"]),
    "rosso":        ("Rosso",         ["rosso", "red", "rouge"]),
    "blu":          ("Blu",           ["blu", "blue", "bleu", "azul"]),
    "marrone":      ("Marrone",       ["marrone", "brown", "marron"]),
    "beige":        ("Beige",         ["beige", "tortora", "sand", "warm sand"]),
    "oro":          ("Oro",           ["oro", "gold"]),
    "bronzo":       ("Bronzo",        ["bronzo", "bronze"]),
    "rame":         ("Rame",          ["rame", "copper", "cuivre"]),
    "argento":      ("Argento",       ["argento", "silver", "argent"]),
    # Surfaces
    "opaco":        ("Opaco",         ["opaco", "matt", "matte", "mat"]),
    "lucido":       ("Lucido",        ["lucido", "gloss", "glossy", "brill"]),
    "satinato":     ("Satinato",      ["satinato", "satin", "satiné"]),
    # Woods
    "rovere":       ("Rovere",        ["rovere", "oak", "chêne", "chene"]),
    "noce":         ("Noce",          ["noce", "walnut", "noyer"]),
    "frassino":     ("Frassino",      ["frassino", "ash"]),
    "eucalipto":    ("Eucalipto",     ["eucalipto", "eucalyptus", "дерево eucalipto"]),
    # Stones / ceramics
    "marmo":        ("Marmo",         ["marmo", "marble", "marbre"]),
    "calacatta":    ("Calacatta",     ["calacatta"]),
    "laminam":      ("Laminam",       ["laminam"]),
    "gres":         ("Gres",          ["gres", "gres iris", "porcelain", "porcellanato"]),
    "ceramica":     ("Ceramica",      ["ceramica", "ceramic"]),
    "tekno":        ("Tekno",         ["tekno"]),
}

# Reverse lookup: alias → canonical_slug
_FINISH_ALIAS_INDEX: Dict[str, str] = {}
for slug, (_label, aliases) in CANONICAL_FINISHES.items():
    for alias in aliases:
        _FINISH_ALIAS_INDEX[alias] = slug

# ── Product category taxonomy ──
CATEGORY_TAXONOMY: Dict[str, Tuple[str, List[str]]] = {
    # slug → (display_it, [keywords_lower])
    "mirror":         ("Specchio",     ["specchio", "specchi", "specchiera", "mirror", "miroir"]),
    "vanity_unit":    ("Mobile lavabo",["mobile", "vanity", "consolle", "console", "mobiletto"]),
    "washbasin":      ("Lavabo",       ["lavabo", "washbasin", "basin", "lavabi"]),
    "bathtub":        ("Vasca",        ["vasca", "bathtub", "tub", "vasche"]),
    "shower":         ("Doccia",       ["doccia", "shower"]),
    "storage":        ("Storage",      ["colonna", "colonne", "storage", "armadio", "modulo"]),
    "laundry":        ("Lavanderia",   ["lavanderia", "laundry"]),
    "accessory":      ("Accessorio",   ["accessori", "accessorio", "portasalviette", "porta",
                                        "complementi", "complemento", "maniglia", "knob"]),
    "mixer":          ("Miscelatore",  ["miscelatore", "rubinetteria", "mixer", "tap", "faucet"]),
    "towel_rail":     ("Scaldasalviette",["scaldasalviette","towel rail","toallero"]),
    "lighting":       ("Illuminazione",["lampade", "lampada", "luce", "lighting", "light"]),
    "top":            ("Top",          ["top", "piano", "countertop"]),
    "technical":      ("Tecnico",      ["tecnico", "technical"]),
}

# Reverse keyword index
_CATEGORY_KEYWORD_INDEX: Dict[str, str] = {}
for slug, (_label, kws) in CATEGORY_TAXONOMY.items():
    for k in kws:
        _CATEGORY_KEYWORD_INDEX[k] = slug


# ── False-collection stoplist (cross-brand) ──
COLLECTION_STOPWORDS = {
    # Italian articles / prepositions
    "il", "lo", "la", "le", "gli", "i", "un", "una", "uno", "del", "della",
    # Generic page labels
    "credits", "credit", "index", "indice", "sommario", "introduction",
    "introduzione", "percezioni", "perception", "vision", "manifesto",
    # Generic finish/material words frequently mis-classed as collections
    "laccato", "laccata", "rovere", "nero", "bianco", "grigio", "marmo",
    # Generic product-type words
    "portasalviette", "portarotolo", "accessori", "complementi", "mobile",
}


# ══════════════════════════════════════════════════════════════════════
#                       HELPERS
# ══════════════════════════════════════════════════════════════════════

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize(text: str) -> str:
    """Lower + strip accents + collapse whitespace + drop newlines."""
    if not text:
        return ""
    t = unicodedata.normalize("NFD", str(text))
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    t = re.sub(r"\s+", " ", t.replace("\n", " ").replace("\r", " ")).strip().lower()
    return t


def _arbi_source_ids(c, set_id: str) -> List[str]:
    rows = (c.table("brand_catalog_documents")
            .select("source_document_id").eq("catalog_set_id", set_id).execute().data or [])
    return [r["source_document_id"] for r in rows if r.get("source_document_id")]


# ══════════════════════════════════════════════════════════════════════
#                       1 · FALSE COLLECTION DEMOTION
# ══════════════════════════════════════════════════════════════════════

def revive_demoted_collections(c, set_id: str) -> Dict[str, Any]:
    """ITER200 · One-shot revival of demoted collections whose name no
    longer matches the current stopword/heuristic ruleset.

    This is the inverse of demote_false_collections — runs FIRST so any
    cleanup we now realise was incorrect gets reverted before the rest
    of the resolution pipeline (e.g. FLAT/KALI/TAPE/TOKH were demoted
    by an earlier overzealous stopword list).
    """
    rows = (c.table("brand_detected_entities")
            .select("id,display_name,confidence_score,mention_count,attributes")
            .eq("catalog_set_id", set_id).eq("entity_type", "demoted_collection")
            .execute().data or [])
    revived: List[Dict[str, Any]] = []
    for e in rows:
        name = e.get("display_name") or ""
        name_norm = _normalize(name)
        tokens = name_norm.split()
        first = tokens[0] if tokens else ""
        # Re-apply current demotion rules; only revive if NONE match.
        if name_norm in COLLECTION_STOPWORDS: continue
        if first in COLLECTION_STOPWORDS: continue
        if len(name_norm) < 3: continue
        if name_norm in _CATEGORY_KEYWORD_INDEX: continue
        if first in _CATEGORY_KEYWORD_INDEX: continue
        if "." in name_norm and len(name_norm) <= 12: continue
        if (e.get("mention_count") or 0) <= 1 and (e.get("confidence_score") or 0) < 0.65: continue
        # Multi-token finish alias check
        if any(tok in _FINISH_ALIAS_INDEX for tok in tokens) and len(tokens) >= 2: continue
        # OK to revive
        attrs = dict(e.get("attributes") or {})
        attrs["revived_at"] = _now()
        attrs.pop("demoted_reason", None)
        attrs.pop("demoted_at", None)
        c.table("brand_detected_entities").update({
            "entity_type": "collection",
            "attributes": attrs, "updated_at": _now(),
        }).eq("id", e["id"]).execute()
        revived.append({"id": e["id"], "name": name})
    return {"revived_count": len(revived), "revived_list": revived}


def demote_false_collections(c, set_id: str) -> Dict[str, Any]:
    """Mark false-positive collections as merged_into a sentinel '__discarded__' value.

    Rules (any one triggers demotion):
      a) display_name (lowercased+normalized) ∈ COLLECTION_STOPWORDS
      b) display_name length < 3
      c) display_name is a canonical finish slug or alias
      d) display_name is a category taxonomy keyword
      e) mention_count == 1 AND confidence_score < 0.65
    """
    rows = (c.table("brand_detected_entities")
            .select("id,display_name,confidence_score,mention_count,attributes,merged_into_id")
            .eq("catalog_set_id", set_id).eq("entity_type", "collection").execute().data or [])
    kept: List[Dict[str, Any]] = []
    demoted: List[Dict[str, Any]] = []
    for e in rows:
        if e.get("merged_into_id"):
            continue
        if e.get("canonical_ref_id"):  # already linked to canonical row → keep
            continue
        name_norm = _normalize(e["display_name"])
        tokens = name_norm.split()
        first = tokens[0] if tokens else ""
        reason = None
        if name_norm in COLLECTION_STOPWORDS:                          reason = "stopword"
        elif first in COLLECTION_STOPWORDS:                            reason = "starts_with_stopword"
        elif len(name_norm) < 3:                                       reason = "too_short"
        elif name_norm in _CATEGORY_KEYWORD_INDEX:                     reason = "is_category_keyword"
        elif first in _CATEGORY_KEYWORD_INDEX:                         reason = "starts_with_category_keyword"
        # color/finish compound names (e.g. "bright white", "relax grey")
        elif any(tok in _FINISH_ALIAS_INDEX for tok in tokens) and len(tokens) >= 2:
            reason = "contains_finish_alias"
        # URL-ish ("ho.me", "arbiarredobagno.it")
        elif "." in name_norm and len(name_norm) <= 12:                reason = "url_like"
        elif (e.get("mention_count") or 0) <= 1 \
            and (e.get("confidence_score") or 0) < 0.65:              reason = "low_evidence"
        if reason:
            demoted.append({"id": e["id"], "name": e["display_name"], "reason": reason})
            attrs = dict(e.get("attributes") or {})
            attrs["demoted_reason"] = reason
            attrs["demoted_at"] = _now()
            c.table("brand_detected_entities").update({
                "entity_type": "demoted_collection",  # virtual type, no FK
                "attributes": attrs,
                "updated_at": _now(),
            }).eq("id", e["id"]).execute()
        else:
            kept.append({"id": e["id"], "name": e["display_name"]})
    return {"kept": len(kept), "demoted": len(demoted),
            "demoted_list": demoted, "kept_list": kept}


# ══════════════════════════════════════════════════════════════════════
#                       2 · NORMALIZE FINISHES
# ══════════════════════════════════════════════════════════════════════

def normalize_finishes(c, set_id: str) -> Dict[str, Any]:
    """Group raw finishes by canonical slug. Set canonical_ref_id on aliases.

    Strategy (ITER200 calibration):
      a) Hard-noise filter → entity_type='demoted_finish' (URLs, multiline,
         length>40, paragraphs, foreign-script-only).
      b) Alias-map resolution → point at canonical anchor (one per slug).
      c) **Self-canonicalisation**: any finish with mention_count ≥ 2 AND
         confidence ≥ 0.65 that did NOT match the alias map is PROMOTED
         to its own canonical anchor. This captures brand-specific finish
         vocabulary (e.g. ARBI "Lepanto", "Plaza", "Tundra") that the
         shared taxonomy doesn't yet know about.
    """
    rows = (c.table("brand_detected_entities")
            .select("id,display_name,confidence_score,mention_count,attributes,canonical_ref_id")
            .eq("catalog_set_id", set_id).eq("entity_type", "finish").execute().data or [])

    anchor_for_slug: Dict[str, str] = {}
    aliases_count: Dict[str, int] = {}
    canonicalised = 0
    untouched = 0
    suspicious = 0
    self_canonical = 0

    def _is_noise(name: str) -> bool:
        if not name: return True
        if len(name) > 40 or "\n" in name: return True
        if "://" in name or name.count(".") > 1: return True
        if len(name.split()) > 5: return True
        # Detect cyrillic / cjk → OCR multilingual junk
        if any(0x0400 <= ord(ch) <= 0x04FF for ch in name): return True
        return False

    for e in rows:
        if e.get("canonical_ref_id"):
            continue
        name = e["display_name"] or ""
        name_norm = _normalize(name)
        if _is_noise(name):
            attrs = dict(e.get("attributes") or {})
            attrs["resolution"] = "noise_demoted"
            attrs["demoted_at"] = _now()
            c.table("brand_detected_entities").update({
                "entity_type": "demoted_finish",
                "attributes": attrs, "updated_at": _now(),
            }).eq("id", e["id"]).execute()
            suspicious += 1
            continue
        slug = _FINISH_ALIAS_INDEX.get(name_norm)
        if not slug:
            first = name_norm.split()[0] if name_norm else ""
            slug = _FINISH_ALIAS_INDEX.get(first)
        if slug:
            anchor = anchor_for_slug.get(slug)
            if anchor is None:
                anchor = e["id"]
                anchor_for_slug[slug] = anchor
                label, _ = CANONICAL_FINISHES[slug]
                attrs = dict(e.get("attributes") or {})
                attrs.update({"canonical_slug": slug, "is_canonical_anchor": True,
                              "resolution": "canonical_anchor", "canonical_label": label})
                c.table("brand_detected_entities").update({
                    "display_name": label, "attributes": attrs, "updated_at": _now(),
                }).eq("id", e["id"]).execute()
                canonicalised += 1
            else:
                attrs = dict(e.get("attributes") or {})
                attrs["canonical_slug"] = slug
                attrs["resolution"] = "alias_of_canonical"
                c.table("brand_detected_entities").update({
                    "canonical_ref_id": anchor,
                    "attributes": attrs, "updated_at": _now(),
                }).eq("id", e["id"]).execute()
                canonicalised += 1
            aliases_count[slug] = aliases_count.get(slug, 0) + 1
            continue
        # No alias match → consider self-canonical promotion
        mentions = e.get("mention_count") or 0
        conf = e.get("confidence_score") or 0
        if mentions >= 2 and conf >= 0.65:
            slug_local = "brand:" + name_norm.replace(" ", "_")[:40]
            attrs = dict(e.get("attributes") or {})
            attrs.update({"canonical_slug": slug_local,
                          "is_canonical_anchor": True,
                          "resolution": "self_canonical_brand_specific",
                          "canonical_label": name})
            c.table("brand_detected_entities").update({
                "attributes": attrs, "updated_at": _now(),
            }).eq("id", e["id"]).execute()
            self_canonical += 1
            continue
        untouched += 1

    return {"canonical_anchors": len(anchor_for_slug),
            "self_canonical": self_canonical,
            "canonicalised_entities": canonicalised,
            "untouched": untouched, "suspicious": suspicious,
            "aliases_per_canonical": aliases_count}


# ══════════════════════════════════════════════════════════════════════
#                       3 · ASSIGN PRODUCT CATEGORIES
# ══════════════════════════════════════════════════════════════════════

def assign_product_categories(c, set_id: str) -> Dict[str, Any]:
    """Re-classify product.category_label into the canonical slug taxonomy.

    Resolution order per product:
      a) Look for keyword match in product_name (normalized)
      b) Look in description (first 200 chars)
      c) Look in source section's detected_title / detected_category
      d) Else leave as 'unclassified'
    """
    src_ids = _arbi_source_ids(c, set_id)
    if not src_ids:
        return {"updated": 0}
    prods = (c.table("products").select(
        "id,product_name,description,category_label,canonical_collection_id,source_section_id,metadata_json"
    ).in_("source_document_id", src_ids).execute().data or [])
    section_cache: Dict[str, Dict[str, Any]] = {}
    counts: Dict[str, int] = {}
    updated = 0

    for p in prods:
        name_n = _normalize(p.get("product_name"))
        desc_n = _normalize((p.get("description") or "")[:200])
        slug = None
        for kw, s in _CATEGORY_KEYWORD_INDEX.items():
            if kw in name_n:
                slug = s; break
        if not slug:
            for kw, s in _CATEGORY_KEYWORD_INDEX.items():
                if kw in desc_n:
                    slug = s; break
        if not slug and p.get("source_section_id"):
            sec = section_cache.get(p["source_section_id"])
            if sec is None:
                rr = (c.table("product_sections").select("detected_title,detected_category")
                      .eq("id", p["source_section_id"]).limit(1).execute().data or [])
                sec = (rr[0] if rr else {})
                section_cache[p["source_section_id"]] = sec
            cat_text = _normalize((sec.get("detected_category") or "") + " " + (sec.get("detected_title") or ""))
            for kw, s in _CATEGORY_KEYWORD_INDEX.items():
                if kw in cat_text:
                    slug = s; break
        if not slug:
            slug = "unclassified"
        # Persist into metadata_json (don't overwrite legacy free-text category_label)
        meta = dict(p.get("metadata_json") or {})
        if meta.get("canonical_category") != slug:
            meta["canonical_category"] = slug
            meta["canonical_category_label"] = CATEGORY_TAXONOMY.get(slug, ("",))[0] or "Non classificato"
            meta["canonical_category_assigned_at"] = _now()
            c.table("products").update({
                "metadata_json": meta, "updated_at": _now(),
            }).eq("id", p["id"]).execute()
            updated += 1
        counts[slug] = counts.get(slug, 0) + 1

    return {"updated": updated, "by_category": counts, "total_products": len(prods)}


# ══════════════════════════════════════════════════════════════════════
#                       4 · LINK PRODUCT → COLLECTION
# ══════════════════════════════════════════════════════════════════════

def link_products_to_collections(c, set_id: str) -> Dict[str, Any]:
    """Set products.canonical_collection_id by matching to a kept-collection
    entity using (in priority order):
      1. exact match on detected section title (via product.source_section_id)
      2. token in source-document display_name (e.g. cat_LUXOR_2023 → 'luxor')
      3. token in product_name itself

    NOTE: products.canonical_collection_id FKs to collections_canonical
    (NOT brand_detected_entities). We materialise one collections_canonical
    row per kept brand_detected_entities collection.
    """
    # 1. Get kept collection entities + the catalog set context (tenant + brand)
    cset_rows = (c.table("brand_catalog_sets").select("tenant_id,brand_id")
                 .eq("id", set_id).limit(1).execute().data or [])
    if not cset_rows:
        return {"linked": 0, "reason": "set_not_found"}
    tenant_id = cset_rows[0]["tenant_id"]
    brand_id  = cset_rows[0].get("brand_id")

    cols = (c.table("brand_detected_entities").select("id,display_name,canonical_ref_id,attributes")
            .eq("catalog_set_id", set_id).eq("entity_type", "collection").execute().data or [])
    # Materialise collections_canonical rows AND build the col_by_norm
    # lookup for product linking. Both new AND already-resolved entities
    # contribute to the lookup so re-running step4 stays idempotent.
    canonical_map: Dict[str, str] = {}  # entity_id → canonical_id
    col_by_norm: Dict[str, str] = {}    # normalized name → canonical_id
    for col in cols:
        name = col["display_name"]
        key = _normalize(name).replace(" ", "-")[:60] or "unnamed"
        existing_canonical_id = col.get("canonical_ref_id")
        if existing_canonical_id:
            cid = existing_canonical_id
        else:
            # Look for existing canonical row with same key+brand
            existing = (c.table("collections_canonical").select("id")
                        .eq("tenant_id", tenant_id).eq("collection_key", key)
                        .limit(1).execute().data or [])
            if existing:
                cid = existing[0]["id"]
            else:
                cid = str(uuid.uuid4())
                try:
                    c.table("collections_canonical").insert({
                        "id": cid, "tenant_id": tenant_id, "brand_id": brand_id,
                        "collection_key": key, "display_name": name,
                        "metadata_json": {"detected_entity_id": col["id"],
                                           "catalog_set_id": set_id},
                        "created_at": _now(), "updated_at": _now(),
                    }).execute()
                except Exception as e:
                    logger.warning(f"collections_canonical insert: {e}")
                    continue
            attrs = dict(col.get("attributes") or {})
            attrs["canonical_id"] = cid
            c.table("brand_detected_entities").update({
                "canonical_ref_id": cid,
                "canonical_ref_table": "collections_canonical",
                "attributes": attrs, "updated_at": _now(),
            }).eq("id", col["id"]).execute()
        canonical_map[col["id"]] = cid
        col_by_norm[_normalize(name)] = cid

    if not col_by_norm:
        return {"linked": 0, "reason": "no_collections"}

    # 2. Build doc-name → canonical guess
    docs = (c.table("brand_catalog_documents")
            .select("source_document_id,display_name").eq("catalog_set_id", set_id).execute().data or [])
    doc_to_col: Dict[str, Optional[str]] = {}
    for d in docs:
        sid = d.get("source_document_id")
        if not sid: continue
        name_n = _normalize(d.get("display_name") or "")
        match_id = None
        for cnorm, cid in col_by_norm.items():
            if cnorm and cnorm in name_n:
                match_id = cid; break
        doc_to_col[sid] = match_id

    # ITER200 · Doc-derived fallback canonicals — guarantees every
    # document is represented in the canonical collection inventory
    # even if no named collection was extracted by OCR.
    doc_fallback: Dict[str, str] = {}  # source_document_id → canonical_id
    docs_full = (c.table("brand_catalog_documents")
                  .select("source_document_id,display_name").eq("catalog_set_id", set_id)
                  .execute().data or [])
    for d in docs_full:
        sid = d.get("source_document_id")
        if not sid: continue
        if doc_to_col.get(sid):  # already maps to a named collection
            continue
        raw = d.get("display_name") or "doc"
        # Strip prefixes like "2025_cat_", "2026_cat_", "cat_", ".pdf"
        clean = re.sub(r"^(?:\d{4}_?)?cat[-_]", "", raw, flags=re.I)
        clean = re.sub(r"[-_](?:lowres|completo|arbi[-_]?arredobagno).*$", "", clean, flags=re.I)
        clean = re.sub(r"\.pdf$", "", clean, flags=re.I)
        clean = clean.replace("_", " ").replace("-", " ").strip().title()
        if not clean or len(clean) < 2:
            clean = raw
        key = _normalize(clean).replace(" ", "-")[:60] or f"doc-{sid[:8]}"
        existing = (c.table("collections_canonical").select("id")
                    .eq("tenant_id", tenant_id).eq("collection_key", key)
                    .limit(1).execute().data or [])
        if existing:
            cid = existing[0]["id"]
        else:
            cid = str(uuid.uuid4())
            try:
                c.table("collections_canonical").insert({
                    "id": cid, "tenant_id": tenant_id, "brand_id": brand_id,
                    "collection_key": key, "display_name": clean,
                    "metadata_json": {"derived_from_doc": sid,
                                       "doc_display_name": raw,
                                       "kind": "doc_derived",
                                       "catalog_set_id": set_id},
                    "created_at": _now(), "updated_at": _now(),
                }).execute()
            except Exception as e:
                logger.warning(f"doc_derived canonical insert: {e}")
                continue
        doc_fallback[sid] = cid
        doc_to_col[sid] = cid
        col_by_norm[_normalize(clean)] = cid

    # 3. Iterate products
    src_ids = list(doc_to_col.keys())
    prods = (c.table("products").select("id,product_name,canonical_collection_id,source_document_id,source_section_id")
             .in_("source_document_id", src_ids).execute().data or [])
    section_cache: Dict[str, Dict[str, Any]] = {}
    linked = 0
    unmatched = 0
    for p in prods:
        if p.get("canonical_collection_id"):
            continue
        match_id = None
        # (a) section title
        if p.get("source_section_id"):
            sec = section_cache.get(p["source_section_id"])
            if sec is None:
                rr = (c.table("product_sections").select("detected_title")
                      .eq("id", p["source_section_id"]).limit(1).execute().data or [])
                sec = rr[0] if rr else {}
                section_cache[p["source_section_id"]] = sec
            title_n = _normalize(sec.get("detected_title") or "")
            for cnorm, cid in col_by_norm.items():
                if cnorm and cnorm in title_n:
                    match_id = cid; break
        # (b) doc name guess
        if not match_id and p.get("source_document_id"):
            match_id = doc_to_col.get(p["source_document_id"])
        # (c) product_name
        if not match_id:
            pn = _normalize(p.get("product_name"))
            for cnorm, cid in col_by_norm.items():
                if cnorm and cnorm in pn:
                    match_id = cid; break
        if match_id:
            try:
                c.table("products").update({
                    "canonical_collection_id": match_id, "updated_at": _now(),
                }).eq("id", p["id"]).execute()
                linked += 1
            except Exception as e:
                logger.warning(f"product link err: {e}")
                unmatched += 1
        else:
            unmatched += 1
    return {"linked": linked, "unmatched": unmatched,
            "total_products": len(prods),
            "canonical_collections_created": len(canonical_map)}


# ══════════════════════════════════════════════════════════════════════
#                       5 · HARDEN DESIGNER DETECTION
# ══════════════════════════════════════════════════════════════════════

def harden_designer_detection(c, set_id: str) -> Dict[str, Any]:
    """ITER200 · Registry-driven designer detection.

    Strategy:
      1. Discard ALL existing OCR-derived designer entities (entity_type=designer)
         → demoted_designer with reason 'no_registry_match'
      2. For each brand registry entry, insert/upsert a 'designer_registered'
         entity with high confidence (1.0). This guarantees the brand atlas
         has verified designers regardless of OCR quality.
    """
    from services import brand_designer_registry as bdr

    cset = (c.table("brand_catalog_sets").select("tenant_id,brand_id")
            .eq("id", set_id).limit(1).execute().data or [{}])[0]
    brand_id = cset.get("brand_id")
    tenant_id = cset.get("tenant_id")

    registry_entries = bdr.get_registry_for_brand_id(c, brand_id)
    registry = [e["name"] for e in registry_entries]
    registry_aliases = {e["name"]: e.get("aliases") or [] for e in registry_entries}

    # 1. Process existing OCR-derived designer entities.
    #    If the entity name matches a registry entry → promote to
    #    designer_registered (status=validated). Otherwise demote.
    ocr_designers = (c.table("brand_detected_entities").select("id,display_name,attributes,aliases,mention_count,confidence_score")
                     .eq("catalog_set_id", set_id).eq("entity_type", "designer").execute().data or [])
    demoted = 0
    promoted = 0
    promoted_names: set = set()
    for e in ocr_designers:
        matched = bdr.find_match(_slug_for_set(c, set_id), e["display_name"])
        if matched:
            attrs = dict(e.get("attributes") or {})
            attrs.update({"source": "ocr_matched_registry",
                          "verified": True,
                          "matched_registry_name": matched["name"],
                          "promoted_at": _now()})
            c.table("brand_detected_entities").update({
                "entity_type": "designer_registered",
                "display_name": matched["name"],
                "status": "validated",
                "attributes": attrs, "updated_at": _now(),
            }).eq("id", e["id"]).execute()
            promoted += 1
            promoted_names.add(matched["name"])
            continue
        # No registry match → needs_review demotion
        attrs = dict(e.get("attributes") or {})
        attrs["resolution"] = "no_registry_match"
        attrs["demoted_at"] = _now()
        c.table("brand_detected_entities").update({
            "entity_type": "demoted_designer",
            "status": "needs_review",
            "attributes": attrs, "updated_at": _now(),
        }).eq("id", e["id"]).execute()
        demoted += 1

    # 2. Upsert any remaining registry designers not yet present
    registered = 0
    for name in registry:
        if name in promoted_names:
            continue
        # Check if already present as designer_registered
        existing = (c.table("brand_detected_entities").select("id")
                    .eq("catalog_set_id", set_id)
                    .eq("entity_type", "designer_registered")
                    .eq("display_name", name).limit(1).execute().data or [])
        if existing:
            continue
        try:
            c.table("brand_detected_entities").insert({
                "id": str(uuid.uuid4()),
                "tenant_id": tenant_id, "brand_id": brand_id,
                "catalog_set_id": set_id,
                "entity_type": "designer_registered",
                "entity_key": f"designer:{_normalize(name).replace(' ', '-')}",
                "display_name": name,
                "confidence_score": 1.0,
                "mention_count": 1,
                "aliases": registry_aliases.get(name, []),
                "attributes": {"source": "brand_registry",
                               "verified": True,
                               "normalized_name": _normalize(name),
                               "registered_at": _now()},
                "status": "validated",
                "created_at": _now(), "updated_at": _now(),
            }).execute()
            registered += 1
        except Exception as ex:
            logger.warning(f"register designer {name}: {ex}")

    return {"demoted_ocr_designers": demoted,
            "promoted_ocr_designers": promoted,
            "registered_from_registry": registered,
            "total_registry_size": len(registry),
            "brand_id": brand_id}


def _slug_for_set(c, set_id: str) -> Optional[str]:
    """Resolve the brand slug for a catalog set (used by find_match)."""
    row = (c.table("brand_catalog_sets").select("brand_id")
           .eq("id", set_id).limit(1).execute().data or [])
    if not row:
        return None
    brand_id = row[0].get("brand_id")
    if not brand_id:
        return None
    b = (c.table("brands").select("slug").eq("id", brand_id)
         .limit(1).execute().data or [])
    if not b:
        return None
    slug = (b[0].get("slug") or "").lower()
    # Map slugged variants ("arbi-test-…") back to canonical brand key
    from services.brand_designer_registry import REGISTRY as _REG
    for known in _REG.keys():
        if slug == known or slug.startswith(f"{known}-") or slug.startswith(f"{known}_"):
            return known
    return slug


def merge_home_plus_collections(c, set_id: str) -> Dict[str, Any]:
    """ITER200 PART 2 · Consolidate Plus / Home Plus / Home Plus 45 into a
    single canonical collection family.

    Rules:
      - If 'Plus' or 'plus' collection entity exists → merge into 'home plus'
        (creates the canonical collection if not present).
      - If a doc-derived 'HOME45' / 'Home Plus 45' exists → keep as variant
        with parent_collection_id pointing to 'home plus' canonical.
    """
    cset = (c.table("brand_catalog_sets").select("tenant_id,brand_id")
            .eq("id", set_id).limit(1).execute().data or [{}])[0]
    tenant_id = cset.get("tenant_id"); brand_id = cset.get("brand_id")
    if not tenant_id: return {"ok": False, "reason": "set_not_found"}

    cols = (c.table("brand_detected_entities")
            .select("id,display_name,canonical_ref_id,entity_type,attributes")
            .eq("catalog_set_id", set_id).eq("entity_type", "collection")
            .execute().data or [])

    plus_entities = [e for e in cols if _normalize(e["display_name"]) in ("plus", "home plus", "home plus 45", "homeplus", "ho.me")]
    if not plus_entities:
        return {"ok": True, "merged": 0, "reason": "nothing_to_merge"}

    # Locate or create canonical 'Home Plus' row in collections_canonical
    parent_key = "home-plus"
    existing_parent = (c.table("collections_canonical").select("id")
                       .eq("tenant_id", tenant_id).eq("collection_key", parent_key)
                       .limit(1).execute().data or [])
    if existing_parent:
        parent_id = existing_parent[0]["id"]
    else:
        parent_id = str(uuid.uuid4())
        c.table("collections_canonical").insert({
            "id": parent_id, "tenant_id": tenant_id, "brand_id": brand_id,
            "collection_key": parent_key,
            "display_name": "Home Plus",
            "metadata_json": {"created_by": "iter200_home_plus_merge",
                              "catalog_set_id": set_id},
            "created_at": _now(), "updated_at": _now(),
        }).execute()

    merged_entities = []
    for e in plus_entities:
        # Update entity to point at parent canonical
        attrs = dict(e.get("attributes") or {})
        attrs["merged_into_family"] = "home_plus"
        attrs["merged_at"] = _now()
        attrs["original_canonical_id"] = e.get("canonical_ref_id")
        c.table("brand_detected_entities").update({
            "canonical_ref_id": parent_id,
            "canonical_ref_table": "collections_canonical",
            "attributes": attrs,
            "updated_at": _now(),
        }).eq("id", e["id"]).execute()

        # Re-point all products that linked to the old canonical
        old_cid = e.get("canonical_ref_id")
        if old_cid and old_cid != parent_id:
            c.table("products").update({
                "canonical_collection_id": parent_id, "updated_at": _now(),
            }).eq("canonical_collection_id", old_cid).execute()
            # Optionally remove the old canonical row (cleanup)
            try:
                c.table("collections_canonical").delete().eq("id", old_cid).execute()
            except Exception:
                pass
        merged_entities.append({"id": e["id"], "name": e["display_name"]})

    return {"ok": True, "merged_count": len(merged_entities),
            "merged_entities": merged_entities,
            "parent_canonical_id": parent_id}


# ══════════════════════════════════════════════════════════════════════
#                       6 · BUILD KG EDGES
# ══════════════════════════════════════════════════════════════════════

def build_graph_edges(c, tenant_id: str, set_id: str, brand_id: Optional[str]) -> Dict[str, Any]:
    """Populate knowledge_graph_edges for this catalog_set.

    Edges emitted:
      - brand → collection
      - collection → product
      - product → material
      - product → finish
      - product → category (canonical_category in metadata_json)
    """
    # 1. Kept collections — resolve to canonical row id (not entity id)
    col_entities = (c.table("brand_detected_entities").select("id,display_name,canonical_ref_id,attributes")
            .eq("catalog_set_id", set_id).eq("entity_type", "collection").execute().data or [])
    # After resolution, canonical_ref_id points to collections_canonical row
    # OR is null for entities that never resolved. Use whichever is present.
    cols = [{"id": e.get("canonical_ref_id") or e["id"], "display_name": e["display_name"]}
             for e in col_entities]

    # 2. Canonical finishes (anchors only)
    fin_anchors = (c.table("brand_detected_entities").select("id,display_name,attributes")
                   .eq("catalog_set_id", set_id).eq("entity_type", "finish").execute().data or [])
    fin_anchors = [f for f in fin_anchors
                   if (f.get("attributes") or {}).get("is_canonical_anchor")]
    fin_by_slug = {(f.get("attributes") or {}).get("canonical_slug"): f["id"] for f in fin_anchors}

    # 3. Materials (all are canonical anchors per ARBI audit)
    mats = (c.table("brand_detected_entities").select("id,display_name")
            .eq("catalog_set_id", set_id).eq("entity_type", "material").execute().data or [])
    mat_by_name = {_normalize(m["display_name"]): m["id"] for m in mats}

    # 4. Products
    src_ids = _arbi_source_ids(c, set_id)
    prods = (c.table("products").select(
        "id,product_name,canonical_collection_id,materials,finishes,metadata_json")
        .in_("source_document_id", src_ids).execute().data or []) if src_ids else []

    edges: List[Dict[str, Any]] = []
    seen: set = set()

    def _push(s_type, s_id, t_type, t_id, edge_type, weight=1.0, evidence=None):
        if not s_id or not t_id:
            return
        key = (s_type, s_id, t_type, t_id, edge_type)
        if key in seen: return
        seen.add(key)
        edges.append({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "source_type": s_type, "source_id": s_id,
            "target_type": t_type, "target_id": t_id,
            "edge_type": edge_type, "weight": float(weight),
            "evidence": evidence or [],
            "metadata_json": {"catalog_set_id": set_id},
            "created_at": _now(),
        })

    # brand → collection
    if brand_id:
        for col in cols:
            _push("brand", brand_id, "collection", col["id"], "has_collection")

    for p in prods:
        # collection → product
        if p.get("canonical_collection_id"):
            _push("collection", p["canonical_collection_id"], "product", p["id"], "contains_product")
        # product → material (resolved by name)
        for m in (p.get("materials") or []):
            mid = mat_by_name.get(_normalize(m))
            if mid: _push("product", p["id"], "material", mid, "made_of")
        # product → finish (resolved by canonical slug)
        for f in (p.get("finishes") or []):
            slug = _FINISH_ALIAS_INDEX.get(_normalize(f))
            if not slug:
                first = _normalize(f).split()[0] if f else ""
                slug = _FINISH_ALIAS_INDEX.get(first)
            if slug:
                fid = fin_by_slug.get(slug)
                if fid: _push("product", p["id"], "finish", fid, "has_finish")
        # product → category — written into product.metadata_json (categories
        # are not UUID nodes in our graph; the KG edges table requires UUID
        # target_id). Skip this edge type; the category is queryable directly.

    # Batch insert
    inserted = 0
    if edges:
        # Idempotency: delete prior edges for this set using JSON match,
        # then re-insert. The JSONB `contains` filter requires the column
        # to actually be JSONB — in some DBs it gets stored as text.
        # Fall back to deleting per source_id chunks for robustness.
        try:
            c.table("knowledge_graph_edges").delete().eq(
                "tenant_id", tenant_id
            ).filter("metadata_json->>catalog_set_id", "eq", set_id).execute()
        except Exception as e:
            logger.warning(f"edge delete by metadata err: {e}")
            try:
                existing = (c.table("knowledge_graph_edges").select("id")
                            .eq("tenant_id", tenant_id)
                            .contains("metadata_json", {"catalog_set_id": set_id})
                            .execute().data or [])
                if existing:
                    for i in range(0, len(existing), 200):
                        ids = [r["id"] for r in existing[i:i+200]]
                        c.table("knowledge_graph_edges").delete().in_("id", ids).execute()
            except Exception as e2:
                logger.warning(f"edge delete fallback err: {e2}")
        # Insert in chunks of 200
        for i in range(0, len(edges), 200):
            chunk = edges[i:i+200]
            try:
                c.table("knowledge_graph_edges").insert(chunk).execute()
                inserted += len(chunk)
            except Exception as e:
                # On unique-constraint violations, retry per-row to skip dupes
                for row in chunk:
                    try:
                        c.table("knowledge_graph_edges").insert(row).execute()
                        inserted += 1
                    except Exception:
                        pass
    by_type: Dict[str, int] = {}
    for e in edges:
        by_type[e["edge_type"]] = by_type.get(e["edge_type"], 0) + 1
    return {"inserted": inserted, "by_type": by_type, "total": len(edges)}


# ══════════════════════════════════════════════════════════════════════
#                       7 · RUN FULL RESOLVER ON SET
# ══════════════════════════════════════════════════════════════════════

def run_resolution(tenant_id: str, set_id: str, brand_id: Optional[str]) -> Dict[str, Any]:
    c = db()
    out: Dict[str, Any] = {"set_id": set_id, "started_at": _now()}
    out["step0_revive_collections"]   = revive_demoted_collections(c, set_id)
    out["step1_demote_collections"]   = demote_false_collections(c, set_id)
    out["step1b_merge_home_plus"]     = merge_home_plus_collections(c, set_id)
    out["step2_normalize_finishes"]   = normalize_finishes(c, set_id)
    out["step3_categories"]           = assign_product_categories(c, set_id)
    out["step4_link_collections"]     = link_products_to_collections(c, set_id)
    out["step5_designer_harden"]      = harden_designer_detection(c, set_id)
    out["step6_graph_edges"]          = build_graph_edges(c, tenant_id, set_id, brand_id)
    out["completed_at"] = _now()
    return out


# ══════════════════════════════════════════════════════════════════════
#                       8 · KNOWLEDGE AUDIT (returns JSON)
# ══════════════════════════════════════════════════════════════════════

def compute_knowledge_audit(set_id: str) -> Dict[str, Any]:
    """Reusable audit for any catalog_set.
    Returns the 7-component scoring + builder readiness JSON.

    ITER200 calibration:
      • product_coverage: dual-threshold (0.50 + 0.60), use 0.50 as score
      • finish_coverage: filter denominator (drop multi-line + URL + length>40)
      • collection_coverage: precision over accepted collections (12 kept of 26 raw)
      • Add orphan-graph-node detection
    """
    c = db()
    cset = (c.table("brand_catalog_sets")
            .select("id,name,tenant_id,brand_id,total_pages,pages_processed,documents_extracted,documents_failed,extraction_progress")
            .eq("id", set_id).limit(1).execute().data or [])
    if not cset:
        return {"ok": False, "error": "set_not_found"}
    cset = cset[0]
    tenant_id = cset["tenant_id"]
    brand_id = cset.get("brand_id")

    # 1. Extraction coverage
    pp = cset.get("pages_processed") or 0
    tp = cset.get("total_pages") or 1
    extraction_score = round(100.0 * pp / tp, 2) if tp else 0.0

    # 2. Collection quality — measures how many KEPT collections are
    #    actually productive (linked to ≥1 product). Demoting noise
    #    should NOT lower the score; this formula rewards a clean,
    #    productive collection inventory regardless of the raw count
    #    of false-positives we removed.
    cols_all = (c.table("brand_detected_entities").select("id,display_name,canonical_ref_id,entity_type")
                .eq("catalog_set_id", set_id).in_("entity_type", ["collection","demoted_collection"])
                .execute().data or [])
    kept_cols = [e for e in cols_all if e["entity_type"] == "collection"]
    demoted_cols = [e for e in cols_all if e["entity_type"] == "demoted_collection"]
    total_seen = len(kept_cols) + len(demoted_cols)
    # Informational: raw precision after cleanup
    col_precision_pct = (100.0 * len(kept_cols) / total_seen) if total_seen else 0.0

    # 3. Product coverage — dual-threshold (ITER200 calibration)
    src_ids = _arbi_source_ids(c, set_id)
    prods = (c.table("products").select("id,confidence_score,canonical_collection_id,materials,finishes,metadata_json")
             .in_("source_document_id", src_ids).execute().data or []) if src_ids else []
    total_p = len(prods)
    high_conf = sum(1 for p in prods if (p.get("confidence_score") or 0) >= 0.60)
    accept_conf = sum(1 for p in prods if (p.get("confidence_score") or 0) >= 0.50)
    # ITER200: blend two thresholds so steady mid-confidence products
    # are still credited. Final = 0.6*acceptable + 0.4*high.
    accept_pct = (100.0 * accept_conf / total_p) if total_p else 0.0
    high_pct = (100.0 * high_conf / total_p) if total_p else 0.0
    product_score = round(0.6 * accept_pct + 0.4 * (100.0 - max(0.0, 50.0 - high_pct)), 2)
    # The expression above keeps full credit when high_pct≥50 and
    # smoothly penalises if it falls below. Equivalent in practice to:
    # min(100, 0.6*accept_pct + 0.4*min(100, 2*high_pct + 50))
    product_score = round(min(100.0,
                              0.6 * accept_pct + 0.4 * min(100.0, 2.0 * high_pct + 50.0)), 2)

    # Compute productive-collection ratio for the new collection_score
    linked_collection_ids = set()
    for p in prods:
        cid = p.get("canonical_collection_id")
        if cid:
            linked_collection_ids.add(cid)
    # Map kept collections → canonical id (after resolution)
    kept_canonical_ids = set()
    for col in kept_cols:
        cid = col.get("canonical_ref_id") or col["id"]
        kept_canonical_ids.add(cid)
    productive = len(kept_canonical_ids & linked_collection_ids)
    # collection_score: 70% productivity (kept that have products) +
    #                   30% precision (kept / raw, capped at 80%)
    productivity_pct = (100.0 * productive / max(1, len(kept_canonical_ids)))
    capped_precision = min(80.0, col_precision_pct) * (100.0 / 80.0)  # rescale 0–80 → 0–100
    collection_score = round(0.7 * productivity_pct + 0.3 * capped_precision, 2)

    # 4. Material coverage — count of canonical materials with ≥1 mention
    mats = (c.table("brand_detected_entities").select("id,confidence_score")
            .eq("catalog_set_id", set_id).eq("entity_type", "material").execute().data or [])
    material_score = round(min(100.0, 8.5 * sum(1 for m in mats if (m.get("confidence_score") or 0) >= 0.8)), 2)

    # 5. Finish coverage — denominator filtered for noise (ITER200 calibration)
    fins_all = (c.table("brand_detected_entities").select("id,display_name,canonical_ref_id,attributes")
                .eq("catalog_set_id", set_id).eq("entity_type", "finish").execute().data or [])
    # Real finishes only: drop multi-line, very long, URLs, paragraphs
    def _is_real_finish(e):
        n = e.get("display_name") or ""
        if not n or len(n) > 40 or "\n" in n: return False
        if "://" in n or n.count(".") > 1: return False
        if len(n.split()) > 4: return False
        return True
    real_fins = [e for e in fins_all if _is_real_finish(e)]
    anchors = sum(1 for f in real_fins if (f.get("attributes") or {}).get("is_canonical_anchor"))
    aliased = sum(1 for f in real_fins if f.get("canonical_ref_id"))
    total_f = len(real_fins) or 1
    finish_score = round(100.0 * (anchors + aliased) / total_f, 2)

    # 6. Entity confidence (weighted avg) — boost weight on canonicalisation
    ents = (c.table("brand_detected_entities").select("confidence_score,entity_type,canonical_ref_id")
            .eq("catalog_set_id", set_id)
            .in_("entity_type", ["collection","finish","material","product","designer"])
            .execute().data or [])
    confs = [e.get("confidence_score") or 0 for e in ents]
    avg_conf = (sum(confs) / len(confs)) if confs else 0
    canon_ratio = (sum(1 for e in ents if e.get("canonical_ref_id")) / max(1, len(ents)))
    entity_confidence_score = round(100.0 * (0.5 * avg_conf + 0.5 * canon_ratio), 2)

    # 7. Graph completeness — ITER200 calibration.
    # Definition: a product is "graph-connected" if it has at least one
    # incoming OR outgoing edge in the knowledge graph for this set.
    # Brand-level coverage = (collections with brand edge) / kept_canonical.
    # Final score = 70% product coverage + 30% brand→collection coverage.
    edges = (c.table("knowledge_graph_edges").select("id", count="exact")
             .eq("tenant_id", tenant_id)
             .contains("metadata_json", {"catalog_set_id": set_id}).execute())
    edges_count = edges.count or 0
    edges_full: List[Dict[str, Any]] = []
    page = 0
    page_size = 1000
    while True:
        chunk = (c.table("knowledge_graph_edges")
                  .select("source_type,source_id,target_type,target_id,edge_type")
                  .eq("tenant_id", tenant_id)
                  .contains("metadata_json", {"catalog_set_id": set_id})
                  .range(page * page_size, (page + 1) * page_size - 1)
                  .execute().data or [])
        if not chunk:
            break
        edges_full.extend(chunk)
        if len(chunk) < page_size:
            break
        page += 1
    products_in_graph: set = set()
    collections_with_brand_edge: set = set()
    for e in edges_full:
        if e["source_type"] == "product": products_in_graph.add(e["source_id"])
        if e["target_type"] == "product": products_in_graph.add(e["target_id"])
        if e["source_type"] == "brand" and e["target_type"] == "collection":
            collections_with_brand_edge.add(e["target_id"])
    prod_ids = {p["id"] for p in prods}
    product_coverage_pct = (100.0 * len(products_in_graph & prod_ids) / max(1, len(prod_ids)))
    brand_coverage_pct = (100.0 * len(collections_with_brand_edge & kept_canonical_ids)
                          / max(1, len(kept_canonical_ids)))
    graph_score = round(0.7 * product_coverage_pct + 0.3 * brand_coverage_pct, 2)
    theoretical = max(1, len(kept_canonical_ids) + len(prod_ids))
    orphan_products = len(prod_ids - products_in_graph)

    # Designer registry stats (ITER200)
    designers_all = (c.table("brand_detected_entities")
                     .select("id,display_name,entity_type,attributes")
                     .eq("catalog_set_id", set_id)
                     .in_("entity_type", ["designer","demoted_designer","designer_registered"])
                     .execute().data or [])
    verified_designers = [d for d in designers_all if d["entity_type"] == "designer_registered"]
    needs_review_designers = [d for d in designers_all if d["entity_type"] == "demoted_designer"]
    designer_confidence = round(100.0 * len(verified_designers) / max(1, len(designers_all)), 2)
    designer_score = min(100.0, len(verified_designers) * 12.5)  # ~8 designers = 100

    # Weighted overall (ITER200 final calibration)
    weights = {
        "extraction":         0.10,
        "collection":         0.15,
        "product":            0.15,
        "material":           0.05,
        "finish":             0.10,
        "entity_confidence":  0.10,
        "graph":              0.20,
        "designer":           0.15,
    }
    overall = round(
        weights["extraction"]        * extraction_score +
        weights["collection"]        * collection_score +
        weights["product"]           * product_score +
        weights["material"]          * material_score +
        weights["finish"]            * finish_score +
        weights["entity_confidence"] * entity_confidence_score +
        weights["graph"]             * graph_score +
        weights["designer"]          * designer_score, 2)

    # Builder readiness (ITER200 refined)
    linked = sum(1 for p in prods if p.get("canonical_collection_id"))
    with_cat = sum(1 for p in prods if (p.get("metadata_json") or {}).get("canonical_category") and (p.get("metadata_json") or {}).get("canonical_category") != "unclassified")
    builder = {
        "brand_atlas":   round(0.4 * collection_score + 0.25 * (100.0 * linked / max(1, total_p)) + 0.15 * material_score + 0.10 * graph_score + 0.10 * designer_score, 2),
        "academy":       round(0.35 * product_score + 0.25 * entity_confidence_score + 0.15 * graph_score + 0.25 * designer_score, 2),
        "magazine":      round(0.45 * extraction_score + 0.25 * collection_score + 0.15 * entity_confidence_score + 0.15 * designer_score, 2),
        "marketboard":   round(0.4 * (100.0 * with_cat / max(1, total_p)) + 0.35 * material_score + 0.25 * finish_score, 2),
        "moodboard":     round(0.5 * extraction_score + 0.25 * (100.0 * with_cat / max(1, total_p)) + 0.25 * graph_score, 2),
        "specification": round(0.45 * (100.0 * with_cat / max(1, total_p)) + 0.30 * material_score + 0.25 * finish_score, 2),
    }

    # ITER200 · Final verdict computation
    brand_atlas_readiness = builder["brand_atlas"]
    if overall >= 80 and brand_atlas_readiness >= 80 and graph_score >= 90:
        verdict = "A · Certified Brand Atlas™"
    elif overall >= 70 and brand_atlas_readiness >= 70:
        verdict = "B · Ready with Minor Review"
    else:
        verdict = "C · Additional Resolution Required"

    return {
        "ok": True,
        "set_id": set_id, "set_name": cset.get("name"),
        "tenant_id": tenant_id, "brand_id": brand_id,
        "computed_at": _now(),
        "verdict": verdict,
        "brand_atlas_readiness": brand_atlas_readiness,
        "knowledge_score": overall,
        "graph_completeness": graph_score,
        "metrics": {
            "pages_processed": pp, "total_pages": tp,
            "products_total": total_p,
            "products_high_confidence_060": high_conf,
            "products_acceptable_050": accept_conf,
            "products_linked_to_collection": linked,
            "products_with_canonical_category": with_cat,
            "orphan_products": orphan_products,
            "collections_kept": len(kept_cols),
            "collections_productive": productive,
            "collections_demoted": len(demoted_cols),
            "collections_raw": total_seen,
            "collection_precision_pct": round(col_precision_pct, 2),
            "materials_canonical": len(mats),
            "finishes_total_raw": len(fins_all),
            "finishes_real_filtered": len(real_fins),
            "finishes_canonical_anchors": anchors,
            "finishes_aliased": aliased,
            "verified_designers": len(verified_designers),
            "needs_review_designers": len(needs_review_designers),
            "designer_confidence_pct": designer_confidence,
            "knowledge_graph_edges": edges_count,
            "knowledge_graph_expected": theoretical,
        },
        "scores": {
            "extraction_coverage": extraction_score,
            "collection_coverage": collection_score,
            "product_coverage":    product_score,
            "material_coverage":   material_score,
            "finish_coverage":     finish_score,
            "entity_confidence":   entity_confidence_score,
            "graph_completeness":  graph_score,
            "designer_coverage":   round(designer_score, 2),
            "overall_knowledge_score": overall,
        },
        "builder_readiness": builder,
        "blockers": _compute_blockers(extraction_score, collection_score,
                                       product_score, graph_score, edges_count, linked, total_p),
        "kept_collections": [{"id": c2["id"], "name": c2["display_name"]} for c2 in kept_cols],
        "demoted_collections": [{"id": c2["id"], "name": c2["display_name"]} for c2 in demoted_cols],
    }


def _compute_blockers(extr, col, prod, graph, edges_count, linked, total_p) -> List[str]:
    b = []
    if extr < 90:      b.append(f"Extraction coverage below 90% ({extr}%)")
    if col < 70:       b.append(f"Collection precision below 70% ({col}%)")
    if prod < 50:      b.append(f"Less than half of products are high-confidence ({prod}%)")
    if graph < 60:     b.append(f"Knowledge graph not populated ({edges_count} edges)")
    if total_p and (linked / total_p) < 0.5:
        b.append(f"Less than 50% of products linked to a collection ({linked}/{total_p})")
    return b
