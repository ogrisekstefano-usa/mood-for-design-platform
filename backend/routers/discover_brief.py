"""
STORE-011 · DESIGN DISCOVERY™ ENGINE
The first design conversation. Five to eight minutes.
Visual-first. Knowledge-native. Zero new schema.

Storage
-------
All data is persisted in journey_briefs (1:1 with design_journeys):
  · closed_answers.project_snapshot   → STEP 1
  · closed_answers.style_selections   → STEP 2
  · closed_answers.style_dna          → STEP 2 (computed)
  · atmosphere_signals[]              → STEP 3 (reused JSONB column)
  · material_signals[]                → STEP 4 (reused JSONB column)
  · closed_answers.priorities         → STEP 5
  · closed_answers.inspirations       → STEP 6
  · closed_answers.notes              → STEP 7
  · closed_answers.discovery_status   → in_progress | completed
  · closed_answers.discovery_version  → 'v2'
  · closed_answers.completed_at       → ISO timestamp

Intelligence (deterministic, no LLM)
------------------------------------
Style DNA   ← aggregate tag counts from selected curated images
Material DNA← material_signals + cross-match brand_detected_entities
Project Profile ← composed from chips
Recommendations ← moodboard_templates filtered by category + Brand Atlas
                  entities filtered by material affinity
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from database import db

log = logging.getLogger(__name__)
router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ════════════════════════════════════════════════════════════════════
#  STATIC CATALOG
#  These values drive the Discovery wizard. All copy is English; the
#  frontend handles any localisation overrides.
# ════════════════════════════════════════════════════════════════════

PROJECT_TYPES = [
    {"key": "kitchen",     "label": "Kitchen"},
    {"key": "living",      "label": "Living"},
    {"key": "bathroom",    "label": "Bathroom"},
    {"key": "bedroom",     "label": "Bedroom"},
    {"key": "outdoor",     "label": "Outdoor"},
    {"key": "full_home",   "label": "Full Home"},
    {"key": "office",      "label": "Office"},
    {"key": "retail",      "label": "Retail"},
    {"key": "hospitality", "label": "Hospitality"},
]

SPACE_STATUSES = [
    {"key": "new_build",     "label": "New Build"},
    {"key": "renovation",    "label": "Renovation"},
    {"key": "existing_space","label": "Existing Space"},
]

TIMELINES = [
    {"key": "immediate",    "label": "Immediate"},
    {"key": "1_3_months",   "label": "1–3 Months"},
    {"key": "3_6_months",   "label": "3–6 Months"},
    {"key": "6_12_months",  "label": "6–12 Months"},
    {"key": "exploring",    "label": "Exploring"},
]

INVESTMENT_RANGES = [
    {"key": "essential",       "label": "Essential"},
    {"key": "mid_range",       "label": "Mid Range"},
    {"key": "premium",         "label": "Premium"},
    {"key": "luxury",          "label": "Luxury"},
    {"key": "to_be_defined",   "label": "To Be Defined"},
]

ATMOSPHERES = [
    {"key": "warm",            "label": "Warm"},
    {"key": "elegant",         "label": "Elegant"},
    {"key": "relaxing",        "label": "Relaxing"},
    {"key": "sophisticated",   "label": "Sophisticated"},
    {"key": "natural",         "label": "Natural"},
    {"key": "family_oriented", "label": "Family-Oriented"},
    {"key": "entertaining",    "label": "Entertaining"},
    {"key": "refined",         "label": "Refined"},
    {"key": "minimal",         "label": "Minimal"},
    {"key": "timeless",        "label": "Timeless"},
    {"key": "dramatic",        "label": "Dramatic"},
    {"key": "bold",            "label": "Bold"},
]

MATERIALS = [
    {"key": "natural_stone", "label": "Natural Stone"},
    {"key": "marble",        "label": "Marble"},
    {"key": "wood",          "label": "Wood"},
    {"key": "ceramic",       "label": "Ceramic"},
    {"key": "metal",         "label": "Metal"},
    {"key": "glass",         "label": "Glass"},
    {"key": "textile",       "label": "Textile"},
    {"key": "leather",       "label": "Leather"},
    {"key": "concrete",      "label": "Concrete"},
]

# Brand Atlas entity_type / display_name keywords used for cross-matching.
MATERIAL_ATLAS_KEYWORDS = {
    "natural_stone": ["stone", "travertine", "limestone", "quartzite", "granite"],
    "marble":        ["marble", "calacatta", "carrara", "statuario", "marmo"],
    "wood":          ["wood", "oak", "walnut", "rovere", "noce", "ash", "teak"],
    "ceramic":       ["ceramic", "porcelain", "terracotta", "laminam", "gres"],
    "metal":         ["metal", "brass", "bronze", "steel", "ottone", "alluminio"],
    "glass":         ["glass", "vetro", "crystal"],
    "textile":       ["textile", "fabric", "tessuto", "linen", "wool", "velvet"],
    "leather":       ["leather", "pelle", "cuoio"],
    "concrete":      ["concrete", "cemento"],
}

PRIORITIES = [
    {"key": "design",            "label": "Design"},
    {"key": "functionality",     "label": "Functionality"},
    {"key": "durability",        "label": "Durability"},
    {"key": "maintenance",       "label": "Maintenance"},
    {"key": "sustainability",    "label": "Sustainability"},
    {"key": "prestige",          "label": "Prestige"},
    {"key": "hospitality",       "label": "Hospitality"},
    {"key": "family_life",       "label": "Family Life"},
    {"key": "flexibility",       "label": "Flexibility"},
    {"key": "investment_value",  "label": "Investment Value"},
]

# Style taxonomy (used both as the DNA targets and as the affinity tags
# attached to each curated image below).
STYLES = [
    {"key": "modern_italian",       "label": "Modern Italian"},
    {"key": "warm_contemporary",    "label": "Warm Contemporary"},
    {"key": "organic_luxury",       "label": "Organic Luxury"},
    {"key": "japandi",              "label": "Japandi"},
    {"key": "boutique_hospitality", "label": "Boutique Hospitality"},
    {"key": "scandinavian",         "label": "Scandinavian"},
    {"key": "minimal",              "label": "Minimal"},
    {"key": "transitional",         "label": "Transitional"},
    {"key": "timeless_classic",     "label": "Timeless Classic"},
    {"key": "bold_modern",          "label": "Bold Modern"},
]

# 30 curated images. Each carries 1–2 style tags so selection can be
# converted into Style DNA scores. URLs are Unsplash CDN (no auth).
# Tag rule: primary tag weight=2, secondary weight=1.
STYLE_IMAGES = [
    # Modern Italian / Warm Contemporary
    {"id": "img-01", "url": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&auto=format&fit=crop", "tags": ["modern_italian", "warm_contemporary"]},
    {"id": "img-02", "url": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&auto=format&fit=crop", "tags": ["modern_italian"]},
    {"id": "img-03", "url": "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=900&auto=format&fit=crop", "tags": ["warm_contemporary", "timeless_classic"]},
    # Organic Luxury
    {"id": "img-04", "url": "https://images.unsplash.com/photo-1615873968403-89e068629265?w=900&auto=format&fit=crop", "tags": ["organic_luxury", "warm_contemporary"]},
    {"id": "img-05", "url": "https://images.unsplash.com/photo-1618219740975-d40978bb7378?w=900&auto=format&fit=crop", "tags": ["organic_luxury"]},
    {"id": "img-06", "url": "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=900&auto=format&fit=crop", "tags": ["organic_luxury", "boutique_hospitality"]},
    # Japandi
    {"id": "img-07", "url": "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=900&auto=format&fit=crop", "tags": ["japandi", "minimal"]},
    {"id": "img-08", "url": "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=900&auto=format&fit=crop", "tags": ["japandi"]},
    {"id": "img-09", "url": "https://images.unsplash.com/photo-1567016432779-094069958ea5?w=900&auto=format&fit=crop", "tags": ["japandi", "scandinavian"]},
    # Scandinavian
    {"id": "img-10", "url": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=900&auto=format&fit=crop", "tags": ["scandinavian"]},
    {"id": "img-11", "url": "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=900&auto=format&fit=crop", "tags": ["scandinavian", "minimal"]},
    {"id": "img-12", "url": "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=900&auto=format&fit=crop", "tags": ["scandinavian", "warm_contemporary"]},
    # Minimal
    {"id": "img-13", "url": "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=900&auto=format&fit=crop", "tags": ["minimal"]},
    {"id": "img-14", "url": "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=900&auto=format&fit=crop", "tags": ["minimal", "modern_italian"]},
    {"id": "img-15", "url": "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=900&auto=format&fit=crop", "tags": ["minimal"]},
    # Boutique Hospitality
    {"id": "img-16", "url": "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&auto=format&fit=crop", "tags": ["boutique_hospitality", "organic_luxury"]},
    {"id": "img-17", "url": "https://images.unsplash.com/photo-1571508601891-ca5e7a713859?w=900&auto=format&fit=crop", "tags": ["boutique_hospitality"]},
    {"id": "img-18", "url": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&auto=format&fit=crop", "tags": ["boutique_hospitality", "bold_modern"]},
    # Transitional
    {"id": "img-19", "url": "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=900&auto=format&fit=crop", "tags": ["transitional", "timeless_classic"]},
    {"id": "img-20", "url": "https://images.unsplash.com/photo-1565182999561-18d7dc61c393?w=900&auto=format&fit=crop", "tags": ["transitional"]},
    {"id": "img-21", "url": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=900&auto=format&fit=crop", "tags": ["transitional", "warm_contemporary"]},
    # Timeless Classic
    {"id": "img-22", "url": "https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=900&auto=format&fit=crop", "tags": ["timeless_classic"]},
    {"id": "img-23", "url": "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=900&auto=format&fit=crop", "tags": ["timeless_classic", "modern_italian"]},
    {"id": "img-24", "url": "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=900&auto=format&fit=crop", "tags": ["timeless_classic"]},
    # Bold Modern
    {"id": "img-25", "url": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&auto=format&fit=crop", "tags": ["bold_modern"]},
    {"id": "img-26", "url": "https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=900&auto=format&fit=crop", "tags": ["bold_modern", "modern_italian"]},
    {"id": "img-27", "url": "https://images.unsplash.com/photo-1600573472556-e636c2acda88?w=900&auto=format&fit=crop", "tags": ["bold_modern", "boutique_hospitality"]},
    # Warm Contemporary
    {"id": "img-28", "url": "https://images.unsplash.com/photo-1616137148650-4aa14651e02a?w=900&auto=format&fit=crop", "tags": ["warm_contemporary"]},
    {"id": "img-29", "url": "https://images.unsplash.com/photo-1600121848594-d8644e57abab?w=900&auto=format&fit=crop", "tags": ["warm_contemporary", "organic_luxury"]},
    {"id": "img-30", "url": "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=900&auto=format&fit=crop", "tags": ["warm_contemporary", "transitional"]},
]

# Convenience map
STYLE_LABEL = {s["key"]: s["label"] for s in STYLES}
IMAGE_BY_ID = {i["id"]: i for i in STYLE_IMAGES}


# ════════════════════════════════════════════════════════════════════
#  Pydantic
# ════════════════════════════════════════════════════════════════════
class DiscoverPatch(BaseModel):
    project_snapshot: Optional[Dict[str, Any]] = None  # {project_type, space_status, timeline, investment_range}
    style_selections: Optional[List[str]] = None       # list of image ids
    atmosphere_signals: Optional[List[str]] = None     # atmosphere keys
    material_signals: Optional[List[str]] = None       # material keys
    priorities: Optional[List[str]] = None             # ordered priority keys
    inspirations: Optional[Dict[str, Any]] = None      # {website_urls, pinterest_urls, instagram_urls, media_ids, doc_ids}
    notes: Optional[str] = None


class CompleteBody(BaseModel):
    force: bool = False  # allow completion with partial data


# ════════════════════════════════════════════════════════════════════
#  Helpers
# ════════════════════════════════════════════════════════════════════
def _resolve_journey(c, tid: str, jid: str) -> Dict[str, Any]:
    rows = (c.table("design_journeys").select("*")
            .eq("id", jid).eq("tenant_id", tid).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Design Journey not found")
    return rows[0]


def _get_or_create_brief(c, tid: str, jid: str) -> Dict[str, Any]:
    rows = (c.table("journey_briefs").select("*")
            .eq("journey_id", jid).eq("tenant_id", tid).limit(1).execute().data or [])
    if rows:
        return rows[0]
    new_brief = {
        "id":                 str(uuid.uuid4()),
        "tenant_id":          tid,
        "journey_id":         jid,
        "closed_answers":     {},
        "atmosphere_signals": [],
        "material_signals":   [],
        "intake_version":     "discover_v2",
        "created_at":         _now(),
        "updated_at":         _now(),
    }
    c.table("journey_briefs").insert(new_brief).execute()
    return new_brief


def _compute_completion(brief: Dict[str, Any]) -> Dict[str, Any]:
    """Compute per-step completion. Returns sections + overall percentage.
    7 sections, weight roughly distributed (snapshot heaviest)."""
    ca = brief.get("closed_answers") or {}
    snap = ca.get("project_snapshot") or {}
    style_sel = ca.get("style_selections") or []
    atm = brief.get("atmosphere_signals") or []
    mat = brief.get("material_signals") or []
    prio = ca.get("priorities") or []
    insp = ca.get("inspirations") or {}
    notes = (ca.get("notes") or "").strip()

    # snapshot is "done" only when all 4 chips set
    snapshot_done = all(snap.get(k) for k in ("project_type", "space_status", "timeline", "investment_range"))
    insp_done = any([
        insp.get("website_urls"),
        insp.get("pinterest_urls"),
        insp.get("instagram_urls"),
        insp.get("media_ids"),
        insp.get("doc_ids"),
    ])

    sections = [
        {"key": "snapshot",     "label": "Project Snapshot",  "weight": 20, "done": snapshot_done},
        {"key": "style",        "label": "Style Discovery",   "weight": 20, "done": len(style_sel) >= 5},
        {"key": "atmosphere",   "label": "How It Feels",      "weight": 15, "done": len(atm) >= 2},
        {"key": "materials",    "label": "Material Affinity", "weight": 15, "done": len(mat) >= 2},
        {"key": "priorities",   "label": "Priorities",        "weight": 10, "done": len(prio) >= 2},
        {"key": "inspirations", "label": "Inspirations",      "weight": 10, "done": bool(insp_done)},
        {"key": "notes",        "label": "Notes",             "weight": 10, "done": len(notes) >= 1},
    ]
    pct = sum(s["weight"] for s in sections if s["done"])
    return {"sections": sections, "progress_pct": pct, "ready_to_complete": pct >= 60}


def _compute_intelligence(brief: Dict[str, Any], c, tid: str) -> Dict[str, Any]:
    """Deterministic Style DNA + Material DNA + Project Profile + Recommendations."""
    ca = brief.get("closed_answers") or {}
    snap = ca.get("project_snapshot") or {}
    selections = ca.get("style_selections") or []
    atm_signals = brief.get("atmosphere_signals") or []
    mat_signals = brief.get("material_signals") or []

    # ── STYLE DNA: aggregate tag weights from selected images
    weights: Dict[str, int] = {}
    for img_id in selections:
        img = IMAGE_BY_ID.get(img_id)
        if not img:
            continue
        tags = img.get("tags") or []
        for idx, t in enumerate(tags):
            weights[t] = weights.get(t, 0) + (2 if idx == 0 else 1)
    total_w = sum(weights.values()) or 1
    style_dna = [
        {"key": k, "label": STYLE_LABEL.get(k, k), "score": round((v * 100.0) / total_w)}
        for k, v in sorted(weights.items(), key=lambda kv: kv[1], reverse=True)
    ][:5]

    # ── MATERIAL DNA: combine user-selected materials with Brand Atlas matches
    material_labels = {m["key"]: m["label"] for m in MATERIALS}
    material_dna: List[Dict[str, Any]] = []
    for mkey in mat_signals:
        material_dna.append({
            "key":          mkey,
            "label":        material_labels.get(mkey, mkey.replace("_", " ").title()),
            "source":       "client_selection",
            "atlas_matches": [],
        })
    # Cross-match Brand Atlas entities by keyword
    try:
        atlas = (c.table("brand_detected_entities")
                  .select("id,display_name,entity_type,mention_count")
                  .eq("tenant_id", tid)
                  .in_("entity_type", ["material", "finish"])
                  .order("mention_count", desc=True)
                  .limit(400).execute().data or [])
    except Exception:
        atlas = []
    for entry in material_dna:
        keywords = MATERIAL_ATLAS_KEYWORDS.get(entry["key"], [entry["key"].replace("_", " ")])
        matches: List[Dict[str, Any]] = []
        for e in atlas:
            name = (e.get("display_name") or "").lower()
            if any(k in name for k in keywords):
                matches.append({
                    "id": e["id"],
                    "name": e["display_name"],
                    "entity_type": e.get("entity_type"),
                    "mention_count": e.get("mention_count") or 0,
                })
            if len(matches) >= 5:
                break
        entry["atlas_matches"] = matches

    # ── PROJECT PROFILE: composed string
    def _lbl(items, key):
        for it in items:
            if it["key"] == key:
                return it["label"]
        return key.replace("_", " ").title() if key else None

    pp_parts: List[str] = []
    inv = _lbl(INVESTMENT_RANGES, snap.get("investment_range"))
    if inv and inv != "To Be Defined":
        pp_parts.append(inv)
    ptype = _lbl(PROJECT_TYPES, snap.get("project_type"))
    if ptype:
        pp_parts.append(ptype)
    primary_style = style_dna[0]["label"] if style_dna else None
    if primary_style:
        pp_parts.append(primary_style)
    project_profile = {
        "headline":          " · ".join(pp_parts) if pp_parts else "Project profile pending",
        "project_type":      ptype,
        "space_status":      _lbl(SPACE_STATUSES, snap.get("space_status")),
        "timeline":          _lbl(TIMELINES, snap.get("timeline")),
        "investment_range":  inv,
        "primary_atmosphere": _lbl(ATMOSPHERES, atm_signals[0]) if atm_signals else None,
        "atmosphere_chips":  [_lbl(ATMOSPHERES, a) for a in atm_signals],
    }

    # ── RECOMMENDATIONS
    # 1) Moodboard templates filtered by category match (best effort)
    templates: List[Dict[str, Any]] = []
    try:
        ptype_key = snap.get("project_type")
        q = (c.table("moodboard_templates")
              .select("id,name,slug,category,tags,description")
              .is_("archived_at", "null").order("sort_order").limit(60))
        rows = q.execute().data or []
        # Filter: platform OR own tenant
        rows = [t for t in rows if t.get("tenant_id") is None or t.get("tenant_id") == tid]
        def _match_score(t):
            score = 0
            if ptype_key and (t.get("category") or "").lower() == ptype_key:
                score += 5
            tags = [str(x).lower() for x in (t.get("tags") or [])]
            for s in style_dna[:3]:
                if any(s["key"].replace("_", " ") in tag or tag in s["key"] for tag in tags):
                    score += 2
            return score
        rows_scored = sorted(((_match_score(r), r) for r in rows), key=lambda x: x[0], reverse=True)
        templates = [r for sc, r in rows_scored if sc > 0][:5]
        if not templates:
            templates = [r for _, r in rows_scored[:3]]
    except Exception:
        log.exception("recommend_templates failed (non-blocking)")

    # 2) Brand Atlas: top entities by material match (already computed)
    brand_atlas_picks: List[Dict[str, Any]] = []
    for entry in material_dna:
        for m in entry["atlas_matches"][:2]:
            brand_atlas_picks.append({**m, "matched_for": entry["label"]})

    # 3) Atmosphere keywords used as soft suggestions
    inspiration_terms = list({_lbl(ATMOSPHERES, a) for a in atm_signals} | {s["label"] for s in style_dna[:3]})
    inspiration_terms = [t for t in inspiration_terms if t]

    recommendations = {
        "moodboard_templates": templates,
        "brand_atlas":         brand_atlas_picks,
        "inspiration_terms":   inspiration_terms,
    }

    return {
        "style_dna":        style_dna,
        "material_dna":     material_dna,
        "project_profile":  project_profile,
        "recommendations":  recommendations,
        "computed_at":      _now(),
    }


# ════════════════════════════════════════════════════════════════════
#  Endpoints
# ════════════════════════════════════════════════════════════════════
@router.get("/discover/catalog")
def get_catalog():
    """Static catalog driving the wizard. No auth required (cache-friendly)."""
    return {
        "project_types":      PROJECT_TYPES,
        "space_statuses":     SPACE_STATUSES,
        "timelines":          TIMELINES,
        "investment_ranges":  INVESTMENT_RANGES,
        "atmospheres":        ATMOSPHERES,
        "materials":          MATERIALS,
        "priorities":         PRIORITIES,
        "styles":             STYLES,
        "style_images":       STYLE_IMAGES,
    }


@router.get("/journeys/{jid}/discover-brief")
def get_discover(jid: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _resolve_journey(c, tid, jid)
    brief = _get_or_create_brief(c, tid, jid)
    completion = _compute_completion(brief)
    ca = brief.get("closed_answers") or {}
    return {
        "brief_id":            brief["id"],
        "journey_id":          jid,
        "project_snapshot":    ca.get("project_snapshot") or {},
        "style_selections":    ca.get("style_selections") or [],
        "atmosphere_signals":  brief.get("atmosphere_signals") or [],
        "material_signals":    brief.get("material_signals") or [],
        "priorities":          ca.get("priorities") or [],
        "inspirations":        ca.get("inspirations") or {},
        "notes":               ca.get("notes") or "",
        "discovery_status":    ca.get("discovery_status") or "in_progress",
        "completed_at":        ca.get("completed_at"),
        "completion":          completion,
    }


@router.put("/journeys/{jid}/discover-brief")
def patch_discover(jid: str, body: DiscoverPatch, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _resolve_journey(c, tid, jid)
    brief = _get_or_create_brief(c, tid, jid)

    ca = dict(brief.get("closed_answers") or {})
    patch: Dict[str, Any] = {"updated_at": _now()}

    if body.project_snapshot is not None:
        merged = {**(ca.get("project_snapshot") or {}), **body.project_snapshot}
        ca["project_snapshot"] = merged
    if body.style_selections is not None:
        # Dedupe + cap at 30
        seen = []
        for s in body.style_selections:
            if s in IMAGE_BY_ID and s not in seen:
                seen.append(s)
        ca["style_selections"] = seen[:30]
    if body.priorities is not None:
        valid = {p["key"] for p in PRIORITIES}
        ca["priorities"] = [p for p in body.priorities if p in valid][:10]
    if body.inspirations is not None:
        ca["inspirations"] = {**(ca.get("inspirations") or {}), **body.inspirations}
    if body.notes is not None:
        ca["notes"] = body.notes.strip()
    if body.atmosphere_signals is not None:
        valid = {a["key"] for a in ATMOSPHERES}
        atm = [a for a in body.atmosphere_signals if a in valid]
        patch["atmosphere_signals"] = atm
    if body.material_signals is not None:
        valid = {m["key"] for m in MATERIALS}
        mat = [m for m in body.material_signals if m in valid]
        patch["material_signals"] = mat

    # If currently completed but user is editing again, re-open.
    if ca.get("discovery_status") == "completed":
        ca["discovery_status"] = "in_progress"

    ca["discovery_version"] = "v2"
    patch["closed_answers"] = ca

    c.table("journey_briefs").update(patch).eq("id", brief["id"]).execute()
    fresh = (c.table("journey_briefs").select("*")
              .eq("id", brief["id"]).limit(1).execute().data or [brief])[0]
    return {
        "brief_id":           fresh["id"],
        "journey_id":         jid,
        "project_snapshot":   (fresh.get("closed_answers") or {}).get("project_snapshot") or {},
        "style_selections":   (fresh.get("closed_answers") or {}).get("style_selections") or [],
        "atmosphere_signals": fresh.get("atmosphere_signals") or [],
        "material_signals":   fresh.get("material_signals") or [],
        "priorities":         (fresh.get("closed_answers") or {}).get("priorities") or [],
        "inspirations":       (fresh.get("closed_answers") or {}).get("inspirations") or {},
        "notes":               (fresh.get("closed_answers") or {}).get("notes") or "",
        "discovery_status":   (fresh.get("closed_answers") or {}).get("discovery_status") or "in_progress",
        "completion":         _compute_completion(fresh),
    }


@router.post("/journeys/{jid}/discover-brief/complete")
def complete_discover(jid: str, body: CompleteBody = CompleteBody(), ctx=Depends(get_tenant_context)):
    """Mark Discovery as completed. Optionally unlock the brief milestone
    (status: approved) and the INSPIRE step (status: in_progress)."""
    c = db()
    tid = ctx["tenant_id"]
    _resolve_journey(c, tid, jid)
    brief = _get_or_create_brief(c, tid, jid)
    completion = _compute_completion(brief)
    if not completion["ready_to_complete"] and not body.force:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "DISCOVER-INCOMPLETE",
                "message": "Discovery needs at least 60% completion (or force=true).",
                "completion": completion,
            },
        )
    ca = dict(brief.get("closed_answers") or {})
    ca["discovery_status"] = "completed"
    ca["completed_at"] = _now()
    ca["discovery_version"] = "v2"
    c.table("journey_briefs").update({
        "closed_answers": ca,
        "updated_at": _now(),
    }).eq("id", brief["id"]).execute()

    # Best-effort: advance the brief milestone → approved, inspirations → in_progress.
    try:
        mils = (c.table("journey_milestones").select("id,milestone_type,status")
                 .eq("journey_id", jid).eq("tenant_id", tid).execute().data or [])
        for m in mils:
            if m["milestone_type"] == "brief" and m["status"] not in ("approved", "closed"):
                c.table("journey_milestones").update({
                    "status": "approved",
                    "approved_at": _now(),
                    "updated_at": _now(),
                }).eq("id", m["id"]).execute()
            if m["milestone_type"] == "inspirations" and m["status"] in (None, "not_started"):
                c.table("journey_milestones").update({
                    "status": "in_progress",
                    "started_at": _now(),
                    "updated_at": _now(),
                }).eq("id", m["id"]).execute()
    except Exception:
        log.exception("milestone advance failed (non-blocking)")

    # Best-effort: emit timeline event
    try:
        c.table("journey_timeline_events").insert({
            "id":           str(uuid.uuid4()),
            "tenant_id":    tid,
            "journey_id":   jid,
            "event_type":   "discovery_completed",
            "narrative":    "Discovery completed. Blueprint AI is ready.",
            "created_at":   _now(),
        }).execute()
    except Exception:
        pass

    fresh = (c.table("journey_briefs").select("*")
              .eq("id", brief["id"]).limit(1).execute().data or [brief])[0]
    intel = _compute_intelligence(fresh, c, tid)
    return {
        "discovery_status": "completed",
        "completed_at":     ca["completed_at"],
        "completion":       _compute_completion(fresh),
        "intelligence":     intel,
    }


@router.get("/journeys/{jid}/discover-brief/intelligence")
def get_intelligence(jid: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _resolve_journey(c, tid, jid)
    brief = _get_or_create_brief(c, tid, jid)
    return _compute_intelligence(brief, c, tid)
