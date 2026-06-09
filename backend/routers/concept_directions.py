"""
STORE-012A · GENERATE CONCEPT BOARD™
Discovery → Concept Direction Engine

After a designer completes the Design Discovery, Blueprint AI must turn the
collected intelligence (Style DNA, Material DNA, atmosphere, materials,
priorities) into 3 ready-to-edit Concept Boards.

Architecture
------------
* Zero new tables. Concept Boards are first-class `moodboards` rows whose
  `ai_metadata.concept_seed` captures the generation context.
* Every board has `journey_id` set — no orphans.
* Every seeded element references a real entity (`material_id` → brand atlas,
  `product_id` → product, `media_id` → media library). No external stock.
* Each generation produces a **Direction Set** (set_01, set_02, …). Re-running
  the endpoint appends a new alternative set; previous sets are preserved.
* If asset pools are too thin to populate a board, the board is still created
  but flagged with `needs_flags` (NEEDS_MEDIA / NEEDS_PRODUCT_SELECTION /
  NEEDS_MATERIAL_SELECTION) so the UI can surface the gap.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.tenant_context import get_tenant_context
from database import db
from routers.discover_brief import (
    MATERIAL_ATLAS_KEYWORDS,
    STYLE_LABEL,
    _compute_intelligence,
    _get_or_create_brief,
    _resolve_journey,
)

log = logging.getLogger(__name__)
router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ════════════════════════════════════════════════════════════════════
#  PALETTE LIBRARY
#  Atmosphere keys → 5-color palettes. The first match in the user's
#  atmosphere_signals decides the base palette. Each direction within a
#  set rotates through a curated trio so the 3 boards never look identical.
# ════════════════════════════════════════════════════════════════════
PALETTE_BY_ATMOSPHERE = {
    "warm":            ["#3a2e26", "#8b5a3c", "#c7a17a", "#e8d4b8", "#f5ede2"],
    "natural":         ["#2e3a2e", "#6b8068", "#a8b5a0", "#d4d8c8", "#eef0e7"],
    "elegant":         ["#1f1f1f", "#3e3e3e", "#8a8a8a", "#c8c2b3", "#ece8de"],
    "sophisticated":   ["#1c1a1f", "#2f2a2b", "#6b5b5b", "#a89d97", "#e9e3dd"],
    "relaxing":        ["#2c3a44", "#5c7488", "#a4b8c4", "#d8dfe2", "#f0eee8"],
    "family_oriented": ["#3a2b22", "#7a5b3e", "#c79867", "#e9d2ad", "#f7eddc"],
    "entertaining":    ["#1d1d1d", "#4a2b2b", "#8e3a3a", "#c8a784", "#efe1c8"],
    "refined":         ["#222024", "#403d44", "#7a7378", "#bfb6b2", "#e8e2dc"],
    "minimal":         ["#0f0f10", "#2a2a2c", "#7c7c80", "#c4c4c4", "#f4f4f2"],
    "timeless":        ["#1c1b1a", "#3a3530", "#7a6b58", "#bda988", "#e9ddc6"],
    "dramatic":        ["#0b0b0d", "#3b1e2e", "#7c2b3a", "#a9785a", "#dac6a0"],
    "bold":            ["#0a0a0a", "#5c0d18", "#a93e2a", "#dfa75b", "#f3e8c1"],
}
DEFAULT_PALETTE = PALETTE_BY_ATMOSPHERE["timeless"]


# ════════════════════════════════════════════════════════════════════
#  DIRECTION NAME REGISTRY
#  Composed dynamically from (style, atmosphere). Pre-curated combos win;
#  otherwise we fall back to "<AtmosphereAdj> <StyleLabel>".
# ════════════════════════════════════════════════════════════════════
DIRECTION_NAMES: Dict[Tuple[str, str], str] = {
    # (style_key, atmosphere_key)
    ("organic_luxury",       "warm"):            "Natural Luxury",
    ("organic_luxury",       "natural"):         "Organic Sanctuary",
    ("organic_luxury",       "refined"):         "Quiet Luxury",
    ("modern_italian",       "elegant"):         "Contemporary Italian",
    ("modern_italian",       "sophisticated"):   "Milanese Modern",
    ("modern_italian",       "timeless"):        "Italian Heritage",
    ("warm_contemporary",    "warm"):            "Warm Contemporary",
    ("warm_contemporary",    "family_oriented"): "Warm Family Living",
    ("warm_contemporary",    "natural"):         "Soft Contemporary",
    ("japandi",              "minimal"):         "Japandi Calm",
    ("japandi",              "natural"):         "Wabi Nordic",
    ("scandinavian",         "minimal"):         "Soft Nordic",
    ("scandinavian",         "natural"):         "Light Nordic",
    ("minimal",              "refined"):         "Refined Minimal",
    ("minimal",              "elegant"):         "Soft Minimal",
    ("minimal",              "timeless"):        "Essential Minimal",
    ("boutique_hospitality", "sophisticated"):   "Refined Hospitality",
    ("boutique_hospitality", "dramatic"):        "Cinematic Hospitality",
    ("boutique_hospitality", "entertaining"):    "Boutique Living",
    ("transitional",         "timeless"):        "Timeless Transitional",
    ("transitional",         "family_oriented"): "Transitional Family",
    ("timeless_classic",     "elegant"):         "Timeless Elegance",
    ("timeless_classic",     "refined"):         "Refined Classic",
    ("bold_modern",          "dramatic"):        "Cinematic Modern",
    ("bold_modern",          "bold"):            "Editorial Modern",
}
ATMOSPHERE_ADJ = {
    "warm": "Warm", "natural": "Natural", "elegant": "Elegant",
    "sophisticated": "Sophisticated", "relaxing": "Relaxing",
    "family_oriented": "Family", "entertaining": "Entertaining",
    "refined": "Refined", "minimal": "Soft", "timeless": "Timeless",
    "dramatic": "Cinematic", "bold": "Bold",
}


def _direction_name(style_key: str, atmosphere_key: Optional[str]) -> str:
    if atmosphere_key:
        key = (style_key, atmosphere_key)
        if key in DIRECTION_NAMES:
            return DIRECTION_NAMES[key]
    label = STYLE_LABEL.get(style_key, style_key.replace("_", " ").title())
    adj = ATMOSPHERE_ADJ.get(atmosphere_key or "", "")
    return f"{adj} {label}".strip()


# ════════════════════════════════════════════════════════════════════
#  ASSET POOLS
# ════════════════════════════════════════════════════════════════════
def _materials_pool(c, tid: str, material_signals: List[str]) -> List[Dict[str, Any]]:
    """Return brand_detected_entities (material/finish) matching any signal."""
    try:
        atlas = (c.table("brand_detected_entities")
                  .select("id,display_name,entity_type,mention_count,attributes")
                  .eq("tenant_id", tid)
                  .in_("entity_type", ["material", "finish"])
                  .order("mention_count", desc=True)
                  .limit(400).execute().data or [])
    except Exception:
        atlas = []
    pool: List[Dict[str, Any]] = []
    keywords = []
    for sig in material_signals or []:
        keywords.extend(MATERIAL_ATLAS_KEYWORDS.get(sig, [sig.replace("_", " ")]))
    keywords = [k.lower() for k in keywords]
    for e in atlas:
        name = (e.get("display_name") or "").lower()
        if not keywords or any(k in name for k in keywords):
            pool.append({
                "id":          e["id"],
                "name":        e.get("display_name"),
                "entity_type": e.get("entity_type"),
            })
    return pool


def _products_pool(c, tid: str, ptype: Optional[str]) -> List[Dict[str, Any]]:
    """Top-affinity products for the tenant. Best-effort filter by canonical
    collection name containing the project type keyword."""
    try:
        rows = (c.table("products")
                 .select("id,name,canonical_collection_id,brand_id")
                 .eq("tenant_id", tid)
                 .limit(300).execute().data or [])
    except Exception:
        rows = []
    return [{"id": r["id"], "name": r.get("name")} for r in rows if r.get("id")]


def _media_pool(c, tid: str) -> List[Dict[str, Any]]:
    """Tenant-owned media library entries usable as moodboard images."""
    try:
        rows = (c.table("media_library")
                 .select("id,file_url,alt_text")
                 .eq("tenant_id", tid)
                 .order("created_at", desc=True)
                 .limit(200).execute().data or [])
    except Exception:
        rows = []
    return [r for r in rows if r.get("file_url")]


def _slice_for_direction(pool: List[Dict[str, Any]], take: int, offset: int) -> List[Dict[str, Any]]:
    """Round-robin slice so each of the 3 directions gets a distinct subset."""
    if not pool:
        return []
    n = len(pool)
    return [pool[(offset + i) % n] for i in range(min(take, n))]


# ════════════════════════════════════════════════════════════════════
#  ELEMENT SEEDING (idempotent within a single moodboard)
# ════════════════════════════════════════════════════════════════════
def _position(x: int, y: int, w: int, h: int, z: int = 0) -> Dict[str, Any]:
    return {"x": x, "y": y, "width": w, "height": h, "z_index": z}


def _seed_elements(
    c, tid: str, moodboard_id: str, page_id: str,
    materials: List[Dict[str, Any]],
    products: List[Dict[str, Any]],
    images: List[Dict[str, Any]],
    palette: List[str],
    direction_name: str,
):
    """Insert moodboard_elements that reference real entities by id."""
    rows: List[Dict[str, Any]] = []
    sort = 0

    # Header text
    rows.append({
        "id": str(uuid.uuid4()),
        "tenant_id": tid,
        "moodboard_id": moodboard_id,
        "page_id": page_id,
        "type": "text",
        "sort_order": sort,
        "content": json.dumps({"text": direction_name, "variant": "headline"}),
        "position_json": _position(40, 40, 720, 90),
        "style_json": {"fontSize": 36, "fontWeight": 500},
        "title": direction_name,
    })
    sort += 1

    # Palette block (single element with 5 swatches in content)
    rows.append({
        "id": str(uuid.uuid4()),
        "tenant_id": tid,
        "moodboard_id": moodboard_id,
        "page_id": page_id,
        "type": "palette",
        "sort_order": sort,
        "content": json.dumps({"colors": palette}),
        "position_json": _position(40, 140, 720, 80),
        "style_json": {},
        "title": "Color Palette",
    })
    sort += 1

    # Images grid (top row)
    for i, m in enumerate(images[:8]):
        col = i % 4
        row = i // 4
        rows.append({
            "id": str(uuid.uuid4()),
            "tenant_id": tid,
            "moodboard_id": moodboard_id,
            "page_id": page_id,
            "type": "image",
            "sort_order": sort,
            "content": json.dumps({
                "media_id": m["id"],
                "file_url": m.get("file_url"),
                "caption": m.get("alt_text") or "",
            }),
            "position_json": _position(40 + col * 190, 240 + row * 220, 175, 200, z=1),
            "style_json": {},
            "title": m.get("alt_text") or None,
        })
        sort += 1

    # Materials row
    for i, m in enumerate(materials[:5]):
        rows.append({
            "id": str(uuid.uuid4()),
            "tenant_id": tid,
            "moodboard_id": moodboard_id,
            "page_id": page_id,
            "type": "material",
            "sort_order": sort,
            "content": json.dumps({
                "material_id": m["id"],
                "entity_id": m["id"],
                "display_name": m.get("name"),
            }),
            "position_json": _position(40 + i * 152, 690, 140, 140, z=1),
            "style_json": {},
            "title": m.get("name") or None,
        })
        sort += 1

    # Products row
    for i, p in enumerate(products[:5]):
        rows.append({
            "id": str(uuid.uuid4()),
            "tenant_id": tid,
            "moodboard_id": moodboard_id,
            "page_id": page_id,
            "type": "product",
            "sort_order": sort,
            "content": json.dumps({
                "product_id": p["id"],
                "display_name": p.get("name"),
            }),
            "position_json": _position(40 + i * 152, 850, 140, 160, z=1),
            "style_json": {},
            "title": p.get("name") or None,
        })
        sort += 1

    if rows:
        # batched insert
        c.table("moodboard_elements").insert(rows).execute()


# ════════════════════════════════════════════════════════════════════
#  CORE — generate a single Concept Board
# ════════════════════════════════════════════════════════════════════
def _create_concept_board(
    c, ctx: Dict[str, Any], journey: Dict[str, Any],
    *,
    set_id: str, set_index: int, set_created_at: str,
    direction_letter: str,
    direction_name: str,
    style_dna_snapshot: List[Dict[str, Any]],
    palette: List[str],
    materials: List[Dict[str, Any]],
    products: List[Dict[str, Any]],
    images: List[Dict[str, Any]],
) -> Dict[str, Any]:
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")
    jid = journey["id"]
    pid = journey.get("project_id")

    needs_flags: List[str] = []
    if len(materials) < 3:
        needs_flags.append("NEEDS_MATERIAL_SELECTION")
    if len(products) < 3:
        needs_flags.append("NEEDS_PRODUCT_SELECTION")
    if len(images) < 3:
        needs_flags.append("NEEDS_MEDIA")

    mb_id = str(uuid.uuid4())
    ai_metadata = {
        "concept_seed": {
            "journey_id":          jid,
            "set_id":              set_id,
            "set_index":           set_index,
            "set_label":           f"Direction Set {set_index:02d}",
            "set_created_at":      set_created_at,
            "direction_letter":    direction_letter,
            "direction_name":      direction_name,
            "style_dna_snapshot":  style_dna_snapshot,
            "color_palette":       palette,
            "material_entity_ids": [m["id"] for m in materials[:5]],
            "product_entity_ids":  [p["id"] for p in products[:5]],
            "media_ids":           [m["id"] for m in images[:8]],
            "needs_flags":         needs_flags,
            "generator":           "store-012a",
            "generator_version":   1,
        }
    }

    title = f"{direction_name} · Set {set_index:02d}{chr(0xA0)}· {direction_letter}"
    c.table("moodboards").insert({
        "id":             mb_id,
        "tenant_id":      tid,
        "journey_id":     jid,
        "project_id":     pid,
        "title":          title,
        "description":    None,
        "status":         "draft",
        "current_version": 1,
        "ai_metadata":    ai_metadata,
        "visibility":     "studio_only",
        "approval_state": "draft",
        "created_by":     uid,
        "created_at":     _now(),
        "updated_at":     _now(),
    }).execute()

    # Create a default page
    page_id = str(uuid.uuid4())
    c.table("moodboard_pages").insert({
        "id":            page_id,
        "tenant_id":     tid,
        "moodboard_id":  mb_id,
        "title":         direction_name,
        "page_type":     "cover",
        "aspect_ratio":  "landscape_16_9",
        "width":         1600,
        "height":        1080,
        "background":    {},
        "settings":      {"generated_by": "store-012a"},
        "sort_order":    0,
        "created_by":    uid,
    }).execute()

    # Seed elements
    _seed_elements(c, tid, mb_id, page_id,
                   materials[:5], products[:5], images[:8],
                   palette, direction_name)

    return {
        "moodboard_id":   mb_id,
        "direction_letter": direction_letter,
        "direction_name": direction_name,
        "set_id":         set_id,
        "set_index":      set_index,
        "set_label":      f"Direction Set {set_index:02d}",
        "counts": {
            "materials": len(materials[:5]),
            "products":  len(products[:5]),
            "images":    len(images[:8]),
        },
        "color_palette":  palette,
        "style_dna_snapshot": style_dna_snapshot,
        "needs_flags":    needs_flags,
    }


# ════════════════════════════════════════════════════════════════════
#  ENDPOINTS
# ════════════════════════════════════════════════════════════════════
class GenerateBody(BaseModel):
    force: bool = False  # reserved for future use


@router.post("/journeys/{jid}/concept-directions/generate")
def generate_concept_directions(jid: str, body: GenerateBody = GenerateBody(),
                                ctx=Depends(get_tenant_context)):
    """Generate a new Direction Set (3 Concept Boards) from Discovery intelligence.

    Multiple calls append new sets (Direction Set 01, Direction Set 02, …).
    """
    c = db()
    tid = ctx["tenant_id"]
    journey = _resolve_journey(c, tid, jid)
    brief = _get_or_create_brief(c, tid, jid)
    intel = _compute_intelligence(brief, c, tid)

    ca = brief.get("closed_answers") or {}
    snap = ca.get("project_snapshot") or {}
    atm = brief.get("atmosphere_signals") or []
    mat = brief.get("material_signals") or []

    style_dna = intel.get("style_dna") or []
    if len(style_dna) < 1:
        # Fallback: pick from the 10 styles deterministically so we still
        # produce 3 directions.
        style_dna = [
            {"key": "warm_contemporary", "label": "Warm Contemporary", "score": 40},
            {"key": "modern_italian",    "label": "Modern Italian",    "score": 35},
            {"key": "minimal",           "label": "Minimal",           "score": 25},
        ]

    # Determine set_index by counting existing concept moodboards on this journey.
    try:
        existing = (c.table("moodboards").select("ai_metadata")
                     .eq("tenant_id", tid).eq("journey_id", jid)
                     .is_("deleted_at", "null")
                     .execute().data or [])
    except Exception:
        existing = []
    seen_sets: set = set()
    for m in existing:
        seed = ((m.get("ai_metadata") or {}).get("concept_seed") or {})
        sid = seed.get("set_id")
        if sid:
            seen_sets.add(sid)
    set_index = len(seen_sets) + 1
    set_id = str(uuid.uuid4())
    set_created_at = _now()

    # Build pools (one query per type, reused across the 3 directions).
    materials_pool = _materials_pool(c, tid, mat)
    products_pool  = _products_pool(c, tid, snap.get("project_type"))
    media_pool     = _media_pool(c, tid)

    # Pick top 3 styles for the 3 directions; if fewer, recycle.
    direction_styles: List[Dict[str, Any]] = []
    for i in range(3):
        direction_styles.append(style_dna[i] if i < len(style_dna) else style_dna[-1])
    # Atmosphere assignments rotate per set so each set proposes alternative
    # pairings rather than repeating the first set verbatim.
    atm_pool = atm if atm else ["timeless"]
    atmosphere_for: List[str] = []
    rot = (set_index - 1)
    for i in range(3):
        atmosphere_for.append(atm_pool[(i + rot) % len(atm_pool)])
    # Style rotation: in set_02+ shift style assignments by one so direction
    # A/B/C end up with different style anchors than Set 01.
    if set_index > 1 and len(direction_styles) >= 3:
        shift = (set_index - 1) % 3
        direction_styles = direction_styles[shift:] + direction_styles[:shift]

    # Use set_index as offset rotation so set_02 picks different slices.
    rotation = (set_index - 1)
    directions: List[Dict[str, Any]] = []
    letters = ["A", "B", "C"] if set_index == 1 else ["A2", "B2", "C2"] if set_index == 2 else [f"A{set_index}", f"B{set_index}", f"C{set_index}"]
    for idx, letter in enumerate(letters):
        s = direction_styles[idx]
        a = atmosphere_for[idx]
        d_name = _direction_name(s["key"], a)

        palette = list(PALETTE_BY_ATMOSPHERE.get(a, DEFAULT_PALETTE))

        # Distinct subsets per direction × rotated by set_index
        m_offset = (idx * 5 + rotation * 3)
        p_offset = (idx * 5 + rotation * 4)
        i_offset = (idx * 8 + rotation * 5)

        direction = _create_concept_board(
            c, ctx, journey,
            set_id=set_id, set_index=set_index, set_created_at=set_created_at,
            direction_letter=letter,
            direction_name=d_name,
            style_dna_snapshot=style_dna[:3],
            palette=palette,
            materials=_slice_for_direction(materials_pool, 5, m_offset),
            products=_slice_for_direction(products_pool, 5, p_offset),
            images=_slice_for_direction(media_pool, 8, i_offset),
        )
        directions.append(direction)

    # Optional: emit timeline event
    try:
        c.table("journey_timeline_events").insert({
            "id":          str(uuid.uuid4()),
            "tenant_id":   tid,
            "journey_id":  jid,
            "event_type":  "concept_directions_generated",
            "narrative":   f"Blueprint AI generated Direction Set {set_index:02d} with 3 concept boards.",
            "metadata_json": {"set_id": set_id, "set_index": set_index,
                              "directions": [{"name": d["direction_name"],
                                              "moodboard_id": d["moodboard_id"]} for d in directions]},
            "created_at":  _now(),
        }).execute()
    except Exception:
        log.exception("timeline event failed (non-blocking)")

    return {
        "set_id":         set_id,
        "set_index":      set_index,
        "set_label":      f"Direction Set {set_index:02d}",
        "set_created_at": set_created_at,
        "directions":     directions,
    }


@router.get("/journeys/{jid}/concept-directions")
def list_concept_directions(jid: str, ctx=Depends(get_tenant_context)):
    """Return all Concept Boards on this journey, grouped by Direction Set."""
    c = db()
    tid = ctx["tenant_id"]
    _resolve_journey(c, tid, jid)
    try:
        rows = (c.table("moodboards")
                 .select("id,title,ai_metadata,updated_at,status")
                 .eq("tenant_id", tid).eq("journey_id", jid)
                 .is_("deleted_at", "null")
                 .order("created_at", desc=False)
                 .execute().data or [])
    except Exception:
        rows = []

    sets_map: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        seed = ((r.get("ai_metadata") or {}).get("concept_seed") or {})
        if not seed:
            continue
        sid = seed.get("set_id")
        if not sid:
            continue
        if sid not in sets_map:
            sets_map[sid] = {
                "set_id":         sid,
                "set_index":      seed.get("set_index"),
                "set_label":      seed.get("set_label") or f"Direction Set {seed.get('set_index', 0):02d}",
                "set_created_at": seed.get("set_created_at"),
                "directions":     [],
            }
        sets_map[sid]["directions"].append({
            "moodboard_id":     r["id"],
            "direction_letter": seed.get("direction_letter"),
            "direction_name":   seed.get("direction_name"),
            "color_palette":    seed.get("color_palette") or [],
            "style_dna_snapshot": seed.get("style_dna_snapshot") or [],
            "counts": {
                "materials": len(seed.get("material_entity_ids") or []),
                "products":  len(seed.get("product_entity_ids") or []),
                "images":    len(seed.get("media_ids") or []),
            },
            "needs_flags":      seed.get("needs_flags") or [],
            "title":            r.get("title"),
            "status":           r.get("status"),
            "updated_at":       r.get("updated_at"),
            # STORE-012C aggregated state
            "shared_at":        seed.get("shared_at"),
            "shared_by":        seed.get("shared_by"),
            "is_preferred":     bool(seed.get("is_preferred")),
            "reaction_counts":  _reaction_counts(seed.get("client_reactions") or []),
        })
        if seed.get("shared_at"):
            # propagate set-level shared marker
            sets_map[sid]["shared_at"] = sets_map[sid].get("shared_at") or seed.get("shared_at")

    sets_list = sorted(sets_map.values(), key=lambda s: s.get("set_index") or 0)
    return {"sets": sets_list, "total_sets": len(sets_list)}


# ════════════════════════════════════════════════════════════════════
#  STORE-012C · Share with client + Client feedback ingestion
# ════════════════════════════════════════════════════════════════════
def _reaction_counts(reactions: List[Dict[str, Any]]) -> Dict[str, int]:
    out = {"interested": 0, "explore_further": 0, "preferred": 0, "comment": 0}
    for r in reactions or []:
        k = r.get("reaction")
        if k in out:
            out[k] += 1
    return out


def _resolve_client_locale(c, tid: str, client_user_id: Optional[str]) -> str:
    """client.preferred_locale → tenant.primary_locale → it-IT."""
    if client_user_id:
        try:
            prof = (c.table("users_profile")
                     .select("locale,preferred_locale")
                     .eq("id", client_user_id).limit(1).execute().data or [])
            if prof:
                loc = prof[0].get("preferred_locale") or prof[0].get("locale")
                if loc:
                    return loc
        except Exception:
            pass
    try:
        ten = (c.table("tenants").select("primary_locale,default_locale")
                .eq("id", tid).limit(1).execute().data or [])
        if ten:
            loc = ten[0].get("primary_locale") or ten[0].get("default_locale")
            if loc:
                return loc
    except Exception:
        pass
    return "it-IT"


SHARE_EMAIL = {
    "it-IT": {
        "subject": "Nuove direzioni progettuali pronte per te",
        "body":    "Il tuo showroom ha preparato nuove direzioni progettuali per te. Accedi alla tua area riservata per vederle e lasciare il tuo feedback.",
        "cta":     "Apri la mia area riservata",
    },
    "en-US": {
        "subject": "New design directions are ready for you",
        "body":    "Your showroom has prepared new design directions for you. Access your private area to review them and share your feedback.",
        "cta":     "Open my private area",
    },
    "en-GB": {
        "subject": "New design directions are ready for you",
        "body":    "Your showroom has prepared new design directions for you. Access your private area to review them and share your feedback.",
        "cta":     "Open my private area",
    },
    "fr-FR": {
        "subject": "De nouvelles directions de projet sont prêtes",
        "body":    "Votre showroom a préparé de nouvelles directions de projet. Accédez à votre espace privé pour les consulter et nous laisser votre retour.",
        "cta":     "Ouvrir mon espace privé",
    },
}


def _email_strings(locale: str) -> Dict[str, str]:
    return SHARE_EMAIL.get(locale) or SHARE_EMAIL.get(locale.split("-")[0] + "-IT") or SHARE_EMAIL["it-IT"]


class ShareBody(BaseModel):
    notify: bool = True  # send email; default true


@router.post("/journeys/{jid}/concept-directions/{set_id}/share")
def share_concept_set(jid: str, set_id: str, body: ShareBody = ShareBody(),
                      ctx=Depends(get_tenant_context)):
    """Share a Direction Set with the client owner of the journey.

    Marks the 3 moodboards of the set as `status='sent'` and stamps
    `ai_metadata.concept_seed.shared_at` + `shared_by`. Emits a timeline
    event `concept_set_shared`. Optionally sends a notification email
    (no actions inside the email — only a CTA back to the private area).
    """
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")
    journey = _resolve_journey(c, tid, jid)

    # Fetch the 3 boards of the set
    rows = (c.table("moodboards").select("id,ai_metadata,status,title")
             .eq("tenant_id", tid).eq("journey_id", jid)
             .is_("deleted_at", "null").execute().data or [])
    in_set = [r for r in rows if ((r.get("ai_metadata") or {}).get("concept_seed") or {}).get("set_id") == set_id]
    if not in_set:
        raise HTTPException(404, "Direction Set not found")

    shared_at = _now()
    updates_done = 0
    for r in in_set:
        am = r.get("ai_metadata") or {}
        seed = dict(am.get("concept_seed") or {})
        seed["shared_at"] = shared_at
        seed["shared_by"] = uid
        am["concept_seed"] = seed
        new_status = r.get("status") if r.get("status") not in (None, "draft") else "sent"
        c.table("moodboards").update({
            "ai_metadata": am,
            "status":      new_status,
            "updated_at":  shared_at,
        }).eq("id", r["id"]).execute()
        updates_done += 1

    set_index = ((in_set[0].get("ai_metadata") or {}).get("concept_seed") or {}).get("set_index")
    set_label = f"Direction Set {(set_index or 0):02d}"

    # Timeline event
    try:
        c.table("journey_timeline_events").insert({
            "id":            str(uuid.uuid4()),
            "tenant_id":     tid,
            "journey_id":    jid,
            "event_type":    "concept_set_shared",
            "narrative_text": f"Hai condiviso {set_label} con il cliente.",
            "metadata":      {"set_id": set_id, "set_index": set_index,
                              "moodboard_ids": [r["id"] for r in in_set]},
            "created_by":    uid,
            "created_at":    shared_at,
        }).execute()
    except Exception:
        log.exception("share timeline event failed (non-blocking)")

    # Notification email (best-effort)
    email_result = {"sent": False, "reason": None}
    if body.notify:
        try:
            pid = journey.get("project_id")
            client_user_id = None
            client_email = None
            if pid:
                pr = (c.table("projects").select("client_user_id")
                      .eq("id", pid).limit(1).execute().data or [])
                if pr:
                    client_user_id = pr[0].get("client_user_id")
            if client_user_id:
                up = (c.table("users_profile").select("email,first_name").eq("id", client_user_id).limit(1).execute().data or [])
                if up:
                    client_email = up[0].get("email")
            if client_email:
                from services.email_service import send_email
                import os as _os
                locale = _resolve_client_locale(c, tid, client_user_id)
                strings = _email_strings(locale)
                base = (_os.environ.get("FRONTEND_URL") or
                        _os.environ.get("PUBLIC_BASE_URL") or "").rstrip("/")
                area_url = (base + f"/client/journey/{jid}/concepts") if base else f"/client/journey/{jid}/concepts"
                html = (
                    f"<p style='font-family:Inter,sans-serif;font-size:14px;color:#1f1f1f;line-height:1.6'>{strings['body']}</p>"
                    f"<p style='margin-top:24px'><a href='{area_url}' "
                    f"style='display:inline-block;padding:12px 22px;background:#d9b16c;color:#0a0d12;"
                    f"text-decoration:none;border-radius:999px;font-weight:500;font-family:Inter,sans-serif'>"
                    f"{strings['cta']}</a></p>"
                )
                send_email(
                    to=client_email, subject=strings["subject"],
                    body_html=html, body_text=strings["body"],
                    template="concept_review_invitation",
                    event_type="concept_review_invitation",
                    tenant_id=tid,
                    metadata={"journey_id": jid, "set_id": set_id, "locale": locale},
                )
                email_result = {"sent": True, "to": client_email, "locale": locale}
            else:
                email_result = {"sent": False, "reason": "no_client_email"}
        except Exception as e:
            log.exception("share email failed (non-blocking)")
            email_result = {"sent": False, "reason": str(e)[:120]}

    return {
        "set_id":     set_id,
        "set_label":  set_label,
        "shared_at":  shared_at,
        "boards":     updates_done,
        "email":      email_result,
    }


@router.post("/journeys/{jid}/concept-directions/{set_id}/unshare")
def unshare_concept_set(jid: str, set_id: str, ctx=Depends(get_tenant_context)):
    """Revoke a previously shared Direction Set."""
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")
    _resolve_journey(c, tid, jid)
    rows = (c.table("moodboards").select("id,ai_metadata,status")
             .eq("tenant_id", tid).eq("journey_id", jid)
             .is_("deleted_at", "null").execute().data or [])
    in_set = [r for r in rows if ((r.get("ai_metadata") or {}).get("concept_seed") or {}).get("set_id") == set_id]
    if not in_set:
        raise HTTPException(404, "Direction Set not found")
    now = _now()
    for r in in_set:
        am = r.get("ai_metadata") or {}
        seed = dict(am.get("concept_seed") or {})
        seed["shared_at"] = None
        seed["shared_by"] = None
        am["concept_seed"] = seed
        c.table("moodboards").update({
            "ai_metadata": am,
            "status":      "draft",
            "updated_at":  now,
        }).eq("id", r["id"]).execute()
    try:
        c.table("journey_timeline_events").insert({
            "id":            str(uuid.uuid4()),
            "tenant_id":     tid,
            "journey_id":    jid,
            "event_type":    "concept_set_unshared",
            "narrative_text": "Hai ritirato la condivisione del Direction Set.",
            "metadata":      {"set_id": set_id},
            "created_by":    uid,
            "created_at":    now,
        }).execute()
    except Exception:
        pass
    return {"set_id": set_id, "unshared_at": now, "boards": len(in_set)}


# ════════════════════════════════════════════════════════════════════
#  STORE-012D · CONCEPT PULSE™
#  Translates client feedback into an operational signal for the
#  designer. NEVER exposes the raw numeric Client Alignment Score™ —
#  only human-readable bands (high / medium / low).
# ════════════════════════════════════════════════════════════════════

# Score → band thresholds.
_ALIGNMENT_BANDS = (
    (15, "high"),
    (5,  "medium"),
    (0,  "low"),
)
_BAND_LABEL = {"high": "High alignment", "medium": "Medium alignment", "low": "Low alignment"}


def _band(score: int) -> str:
    for threshold, name in _ALIGNMENT_BANDS:
        if score >= threshold:
            return name
    return "low"


# Crude keyword heuristics for the "Open Material Board" suggestion.
_MATERIAL_KEYWORDS = (
    "material", "materiale", "materiali", "marble", "marmo", "wood", "legno",
    "oak", "rovere", "stone", "pietra", "metal", "metallo", "brass", "ottone",
    "concrete", "cemento", "leather", "pelle", "textile", "tessuto",
    "ceramic", "porcellana", "glass", "vetro",
)


def _comment_mentions_material(reactions: List[Dict[str, Any]]) -> bool:
    for r in reactions or []:
        if r.get("reaction") != "comment":
            continue
        text = (r.get("comment") or "").lower()
        if any(k in text for k in _MATERIAL_KEYWORDS):
            return True
    return False


@router.get("/journeys/{jid}/concept-pulse")
def get_concept_pulse(jid: str, ctx=Depends(get_tenant_context)):
    """Operational signal card for the latest shared Direction Set.

    Returns:
      · preferred_direction (or null)
      · ranking[] sorted by client_alignment_score (band only — no number)
      · feedback_summary{} counts per reaction across the set
      · suggested_next_action {key, headline, hint, action_type}
      · quick_actions[] deep-links

    The raw numeric score is intentionally NEVER returned.
    """
    c = db()
    tid = ctx["tenant_id"]
    _resolve_journey(c, tid, jid)

    rows = (c.table("moodboards")
             .select("id,title,ai_metadata,status")
             .eq("tenant_id", tid).eq("journey_id", jid)
             .is_("deleted_at", "null")
             .execute().data or [])

    # Group by set_id, retain only shared sets, pick the latest.
    sets_map: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        seed = ((r.get("ai_metadata") or {}).get("concept_seed") or {})
        if not seed.get("shared_at") or not seed.get("set_id"):
            continue
        sid = seed["set_id"]
        if sid not in sets_map:
            sets_map[sid] = {
                "set_id":         sid,
                "set_index":      seed.get("set_index") or 0,
                "set_label":      seed.get("set_label") or f"Direction Set {(seed.get('set_index') or 0):02d}",
                "set_shared_at":  seed.get("shared_at"),
                "boards":         [],
            }
        sets_map[sid]["boards"].append((r, seed))

    if not sets_map:
        return {
            "has_shared_set":      False,
            "set":                 None,
            "preferred_direction": None,
            "ranking":             [],
            "feedback_summary":    {"interested": 0, "explore_further": 0, "preferred": 0, "comment": 0},
            "suggested_next_action": {
                "key":          "wait_for_feedback",
                "headline":     "Share a Direction Set with your client",
                "hint":         "Once the client has direction options to react to, Concept Pulse™ will surface their alignment here.",
                "action_type":  "share",
            },
            "quick_actions": [
                {"key": "open_discovery", "label": "Open Discovery", "kind": "navigate",
                 "href": f"/studio/journey/{jid}/discover"},
            ],
        }

    # Latest shared set = highest set_index (fallback to most recent shared_at).
    latest = sorted(sets_map.values(),
                    key=lambda s: (s.get("set_index") or 0, s.get("set_shared_at") or ""),
                    reverse=True)[0]

    boards = latest["boards"]
    feedback_summary = {"interested": 0, "explore_further": 0, "preferred": 0, "comment": 0}
    all_reactions: List[Dict[str, Any]] = []
    ranking: List[Dict[str, Any]] = []
    preferred: Optional[Dict[str, Any]] = None

    for r, seed in boards:
        reactions = seed.get("client_reactions") or []
        all_reactions.extend(reactions)
        counts = _reaction_counts(reactions)
        for k, v in counts.items():
            feedback_summary[k] += v
        score = int(seed.get("client_alignment_score") or 0)
        ranking.append({
            "moodboard_id":     r["id"],
            "direction_letter": seed.get("direction_letter"),
            "direction_name":   seed.get("direction_name"),
            "alignment_band":   _band(score),
            "alignment_label":  _BAND_LABEL[_band(score)],
            "is_preferred":     bool(seed.get("is_preferred")),
            "reaction_counts":  counts,
            "color_palette":    seed.get("color_palette") or [],
        })
        if seed.get("is_preferred") and preferred is None:
            preferred = {
                "moodboard_id":     r["id"],
                "direction_letter": seed.get("direction_letter"),
                "direction_name":   seed.get("direction_name"),
                "color_palette":    seed.get("color_palette") or [],
                "alignment_band":   _band(score),
                "alignment_label":  _BAND_LABEL[_band(score)],
            }

    # Sort ranking by alignment band then reaction count (deterministic, score order
    # but band-bucketed; no exposed number).
    band_order = {"high": 0, "medium": 1, "low": 2}
    def _rank_key(b):
        rc = b["reaction_counts"]
        weight = rc["preferred"] * 10 + rc["interested"] * 3 + rc["explore_further"] * 2 + rc["comment"] * 5
        return (band_order[b["alignment_band"]], -weight, b["direction_letter"] or "")
    ranking.sort(key=_rank_key)
    for i, b in enumerate(ranking, 1):
        b["rank"] = i

    # ── Suggested next action (deterministic)
    explore_count   = feedback_summary["explore_further"]
    comment_count   = feedback_summary["comment"]
    interest_count  = feedback_summary["interested"]
    no_feedback     = (interest_count + explore_count + comment_count + feedback_summary["preferred"]) == 0
    material_signal = _comment_mentions_material(all_reactions)

    if preferred and material_signal:
        action = {
            "key":         "material_board_for_preferred",
            "headline":    f"Open Material Board to refine {preferred['direction_name']}",
            "hint":        "Comments mention specific materials — refine the selection together with the client.",
            "action_type": "material_board",
        }
    elif preferred:
        action = {
            "key":         "develop_preferred",
            "headline":    f"Develop {preferred['direction_name']} with material variants",
            "hint":        "Lean into the preferred direction with at least two material variants.",
            "action_type": "develop_preferred",
        }
    elif explore_count >= 2:
        action = {
            "key":         "second_direction_set",
            "headline":    "Prepare a second Direction Set on the requested alternatives",
            "hint":        f"The client asked to explore further on {explore_count} boards — generate alternatives.",
            "action_type": "generate_alternatives",
        }
    elif material_signal:
        action = {
            "key":         "open_material_board",
            "headline":    "Open Material Board and refine the material selection",
            "hint":        "Client comments reference materials — bring the conversation onto the Material Board.",
            "action_type": "material_board",
        }
    elif no_feedback:
        action = {
            "key":         "wait_or_remind",
            "headline":    "Awaiting client feedback",
            "hint":        "Send a gentle reminder or follow up directly to keep the momentum.",
            "action_type": "remind",
        }
    else:
        action = {
            "key":         "review_feedback",
            "headline":    "Review the client feedback before next move",
            "hint":        "Use the timeline below to read every reaction — then decide the next step.",
            "action_type": "review",
        }

    # ── Quick actions deep-links
    quick: List[Dict[str, Any]] = []
    if preferred:
        quick.append({
            "key":   "open_preferred",
            "label": "Open Preferred Concept",
            "kind":  "navigate",
            "href":  f"/moodboards/{preferred['moodboard_id']}",
        })
        quick.append({
            "key":   "material_board_preferred",
            "label": "Create Material Board from Preferred",
            "kind":  "navigate",
            "href":  f"/moodboards/{preferred['moodboard_id']}?intent=material_board",
        })
    quick.append({
        "key":   "generate_alternatives",
        "label": "Generate Alternative Directions",
        "kind":  "api",
        "href":  f"/api/journeys/{jid}/concept-directions/generate",
        "method": "POST",
    })
    quick.append({
        "key":   "view_feedback",
        "label": "View Client Feedback",
        "kind":  "navigate",
        "href":  f"/client/journey/{jid}/concepts",
    })

    return {
        "has_shared_set":       True,
        "set": {
            "set_id":        latest["set_id"],
            "set_index":     latest["set_index"],
            "set_label":     latest["set_label"],
            "set_shared_at": latest["set_shared_at"],
        },
        "preferred_direction":  preferred,
        "ranking":              ranking,
        "feedback_summary":     feedback_summary,
        "suggested_next_action": action,
        "quick_actions":        quick,
    }
