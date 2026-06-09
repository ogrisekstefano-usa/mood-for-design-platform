"""
STORE-012B · MOODBOARD V2.1 — DESIGN INTELLIGENCE WORKSPACE™
The Working Moodboard is a NEW moodboard derived from a Concept Direction.
Concept Board → historical design direction.
Working Moodboard → operational workspace where decisions live.

Endpoints
---------
* POST  /api/journeys/{jid}/working-moodboards/from-concept/{concept_mb_id}
* GET   /api/journeys/{jid}/working-moodboards
* GET   /api/moodboards/{id}/project-brain
* PATCH /api/moodboard-elements/{eid}/approval-status

Architecture
------------
* Zero new tables. Working Moodboards live in `moodboards` with
  `ai_metadata.working_seed` capturing the derivation context.
* 5 sections = 5 `moodboard_pages` (Vision · Materials · Products ·
  Atmosphere · Design Notes).
* Every element is knowledge-native — material/product elements expose
  `entity_id` + `material_id` + `brand_id` already on first write
  (NFC-ready).
* Approval Layer™ lives at element level inside
  `moodboard_elements.content.approval_status ∈
  {suggested, discussed, approved, rejected}`. Default = `suggested`.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.tenant_context import get_tenant_context
from database import db
from routers.discover_brief import (
    _compute_intelligence,
    _get_or_create_brief,
    _resolve_journey,
)

log = logging.getLogger(__name__)
router = APIRouter()

APPROVAL_STATES = ("suggested", "discussed", "approved", "rejected")
WORKING_SECTIONS = ("vision", "materials", "products", "atmosphere", "notes")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ════════════════════════════════════════════════════════════════════
#  PROJECT BRAIN™  (formerly AI Context Bar™)
# ════════════════════════════════════════════════════════════════════
def _next_action_for(brief: Dict[str, Any], pulse: Dict[str, Any]) -> Dict[str, str]:
    """Recommended Next Action™ — designer always knows the next step."""
    ca = (brief or {}).get("closed_answers") or {}
    status = ca.get("discovery_status")
    if status != "completed":
        return {
            "key":      "complete_discovery",
            "headline": "Complete Discovery first",
            "hint":     "Working Moodboards need Discovery intelligence to come to life.",
        }
    if not pulse.get("has_shared_set"):
        return {
            "key":      "share_concept_set",
            "headline": "Share a Concept Direction Set with your client",
            "hint":     "Once the client has options to react to, the Working Moodboard learns from their feedback.",
        }
    # Defer to Concept Pulse's own suggestion when available.
    sna = (pulse.get("suggested_next_action") or {})
    if sna.get("headline"):
        return {
            "key":      sna.get("key") or "from_pulse",
            "headline": sna["headline"],
            "hint":     sna.get("hint") or "",
        }
    return {
        "key":      "refine_working_moodboard",
        "headline": "Refine the Working Moodboard with the client",
        "hint":     "Iterate on materials, products and notes until the proposal feels right.",
    }


@router.get("/moodboards/{mbid}/project-brain")
def get_project_brain(mbid: str, ctx=Depends(get_tenant_context)):
    """Operational context for the Working Moodboard. Never a chatbot."""
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("moodboards").select("id,journey_id,ai_metadata,title")
             .eq("id", mbid).eq("tenant_id", tid).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Moodboard not found")
    mb = rows[0]
    jid = mb.get("journey_id")
    if not jid:
        raise HTTPException(400, "Moodboard is not linked to a Journey")

    journey = _resolve_journey(c, tid, jid)
    brief = _get_or_create_brief(c, tid, jid)
    intel = _compute_intelligence(brief, c, tid)

    # Client + project metadata (best effort)
    project_meta: Dict[str, Any] = {}
    client_meta: Dict[str, Any] = {}
    pid = journey.get("project_id")
    if pid:
        pr = (c.table("projects")
               .select("id,client_user_id")
               .eq("id", pid).limit(1).execute().data or [])
        if pr:
            p = pr[0]
            project_meta = {
                "id":           p["id"],
                "name":         journey.get("title") or "",
                "project_type": journey.get("project_type"),
                "timeline":     None,
                "budget_range": None,
            }
            cuid = p.get("client_user_id")
            if cuid:
                up = (c.table("users_profile").select("id,first_name,last_name,email")
                       .eq("id", cuid).limit(1).execute().data or [])
                if up:
                    client_meta = {
                        "id":         up[0]["id"],
                        "first_name": up[0].get("first_name"),
                        "last_name":  up[0].get("last_name"),
                        "email":      up[0].get("email"),
                    }

    # Concept Pulse re-using STORE-012D logic
    from routers.concept_directions import get_concept_pulse  # lazy import
    try:
        pulse = get_concept_pulse(jid, ctx)
    except Exception:
        log.exception("project-brain failed to read concept-pulse")
        pulse = {"has_shared_set": False, "suggested_next_action": {},
                 "preferred_direction": None, "ranking": [], "feedback_summary": {}}

    seed = ((mb.get("ai_metadata") or {}).get("working_seed") or {})
    next_action = _next_action_for(brief, pulse)

    return {
        "moodboard_id":      mbid,
        "journey_id":        jid,
        "client":            client_meta,
        "project":           project_meta,
        "discovery": {
            "status":              (brief.get("closed_answers") or {}).get("discovery_status"),
            "style_dna":           intel.get("style_dna") or [],
            "material_dna":        intel.get("material_dna") or [],
            "project_profile":     intel.get("project_profile") or {},
            "investment_profile":  ((brief.get("closed_answers") or {}).get("project_snapshot") or {}).get("investment_range"),
            "atmosphere_signals":  brief.get("atmosphere_signals") or [],
        },
        "concept_pulse": {
            "has_shared_set":      pulse.get("has_shared_set"),
            "preferred_direction": pulse.get("preferred_direction"),
            "ranking":             pulse.get("ranking") or [],
            "feedback_summary":    pulse.get("feedback_summary") or {},
        },
        "recommended_next_action": next_action,
        "working_seed": {
            "source_concept_id": seed.get("source_concept_id"),
            "source_set_id":     seed.get("source_set_id"),
            "derived_at":        seed.get("derived_at"),
        },
    }


# ════════════════════════════════════════════════════════════════════
#  WORKING MOODBOARD GENERATION
# ════════════════════════════════════════════════════════════════════
def _section_page(tid: str, mb_id: str, section: str, idx: int, uid: Optional[str]) -> Dict[str, Any]:
    titles = {
        "vision":     "Vision",
        "materials":  "Materials",
        "products":   "Products",
        "atmosphere": "Atmosphere",
        "notes":      "Design Notes",
    }
    return {
        "id":            str(uuid.uuid4()),
        "tenant_id":     tid,
        "moodboard_id":  mb_id,
        "title":         titles[section],
        "page_type":     "cover" if section == "vision" else "gallery",
        "aspect_ratio":  "portrait_4_5" if section == "vision" else "landscape_16_9",
        "width":         1600, "height": 1080,
        "background":    {},
        "settings":      {"section": section, "generated_by": "store-012b"},
        "sort_order":    idx,
        "created_by":    uid,
    }


def _el(tid: str, mb_id: str, page_id: str, sort: int, *, type: str,
        content: Dict[str, Any], title: Optional[str] = None,
        position: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    # Approval Layer™ — every element has a default status
    content_with_status = {**content, "approval_status": "suggested"}
    return {
        "id":            str(uuid.uuid4()),
        "tenant_id":     tid,
        "moodboard_id":  mb_id,
        "page_id":       page_id,
        "type":          type,
        "sort_order":    sort,
        "content":       json.dumps(content_with_status),
        "position_json": position or {"x": 0, "y": 0, "width": 600, "height": 200, "z_index": 0},
        "style_json":    {},
        "title":         title,
    }


def _fetch_material_entities(c, tid: str, entity_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    if not entity_ids:
        return {}
    try:
        rows = (c.table("brand_detected_entities")
                 .select("id,display_name,entity_type,attributes,brand_id")
                 .eq("tenant_id", tid).in_("id", entity_ids).execute().data or [])
    except Exception:
        return {}
    return {r["id"]: r for r in rows}


def _fetch_product_entities(c, tid: str, ids: List[str]) -> Dict[str, Dict[str, Any]]:
    if not ids:
        return {}
    try:
        rows = (c.table("products")
                 .select("id,name,brand_id,canonical_collection_id")
                 .eq("tenant_id", tid).in_("id", ids).execute().data or [])
    except Exception:
        return {}
    return {r["id"]: r for r in rows}


def _fetch_media(c, tid: str, ids: List[str]) -> Dict[str, Dict[str, Any]]:
    if not ids:
        return {}
    try:
        rows = (c.table("media_library")
                 .select("id,file_url,alt_text").eq("tenant_id", tid)
                 .in_("id", ids).execute().data or [])
    except Exception:
        return {}
    return {r["id"]: r for r in rows}


@router.post("/journeys/{jid}/working-moodboards/from-concept/{concept_mb_id}")
def generate_working_moodboard(jid: str, concept_mb_id: str,
                               ctx=Depends(get_tenant_context)):
    """Derive a Working Moodboard from a Concept Board (idempotent)."""
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")
    _resolve_journey(c, tid, jid)

    # Load concept board
    cb = (c.table("moodboards").select("id,journey_id,title,ai_metadata")
            .eq("id", concept_mb_id).eq("tenant_id", tid).limit(1).execute().data or [])
    if not cb:
        raise HTTPException(404, "Concept Board not found")
    cb = cb[0]
    if cb.get("journey_id") != jid:
        raise HTTPException(400, "Concept Board does not belong to this Journey")
    concept_seed = ((cb.get("ai_metadata") or {}).get("concept_seed") or {})
    if not concept_seed:
        raise HTTPException(400, "Source moodboard is not a Concept Board")

    # Idempotency — return existing derived board if any.
    existing = (c.table("moodboards")
                  .select("id,title,ai_metadata,updated_at")
                  .eq("tenant_id", tid).eq("journey_id", jid)
                  .is_("deleted_at", "null").execute().data or [])
    for r in existing:
        ws = ((r.get("ai_metadata") or {}).get("working_seed") or {})
        if ws.get("source_concept_id") == concept_mb_id:
            return {"created": False, "moodboard_id": r["id"], "title": r.get("title"),
                    "derived_at": ws.get("derived_at")}

    # Pull Discovery intel for richer atmosphere
    brief = _get_or_create_brief(c, tid, jid)
    intel = _compute_intelligence(brief, c, tid)

    direction_name = concept_seed.get("direction_name") or cb.get("title") or "Working Moodboard"
    style_dna_top = (concept_seed.get("style_dna_snapshot") or intel.get("style_dna") or [])[:3]
    palette = concept_seed.get("color_palette") or []
    material_ids = concept_seed.get("material_entity_ids") or []
    product_ids = concept_seed.get("product_entity_ids") or []
    media_ids = concept_seed.get("media_ids") or []

    materials = _fetch_material_entities(c, tid, material_ids)
    products  = _fetch_product_entities(c, tid, product_ids)
    media     = _fetch_media(c, tid, media_ids)

    derived_at = _now()
    mb_id = str(uuid.uuid4())
    title = f"{direction_name} · Working Moodboard"

    ai_metadata = {
        "working_seed": {
            "source_concept_id": concept_mb_id,
            "source_set_id":     concept_seed.get("set_id"),
            "set_index":         concept_seed.get("set_index"),
            "direction_name":    direction_name,
            "derived_at":        derived_at,
            "mode":              "working",
            "sections":          list(WORKING_SECTIONS),
            "style_dna_snapshot": style_dna_top,
            "color_palette":     palette,
            "generator":         "store-012b",
            "generator_version": 1,
        }
    }

    c.table("moodboards").insert({
        "id":             mb_id,
        "tenant_id":      tid,
        "journey_id":     jid,
        "project_id":     None,
        "title":          title,
        "status":         "draft",
        "current_version": 1,
        "ai_metadata":    ai_metadata,
        "visibility":     "studio_only",
        "approval_state": "draft",
        "created_by":     uid,
        "created_at":     derived_at,
        "updated_at":     derived_at,
    }).execute()

    # 5 pages
    pages = [_section_page(tid, mb_id, s, i, uid) for i, s in enumerate(WORKING_SECTIONS)]
    c.table("moodboard_pages").insert(pages).execute()
    page_by_section = {p["settings"]["section"]: p["id"] for p in pages}

    elements: List[Dict[str, Any]] = []

    # VISION section: hero text + 3 style descriptors
    vp = page_by_section["vision"]
    elements.append(_el(tid, mb_id, vp, 0, type="text",
        content={"text": direction_name, "variant": "headline"},
        title=direction_name,
        position={"x": 80, "y": 120, "width": 1440, "height": 140, "z_index": 1}))
    descriptors = [s.get("label") for s in style_dna_top if s.get("label")]
    for i, d in enumerate(descriptors[:3]):
        elements.append(_el(tid, mb_id, vp, 1 + i, type="text",
            content={"text": d, "variant": "subline"}, title=d,
            position={"x": 80, "y": 300 + i * 60, "width": 1440, "height": 50, "z_index": 1}))
    # Hero image (first media)
    if media_ids:
        m = media.get(media_ids[0])
        if m:
            elements.append(_el(tid, mb_id, vp, 10, type="image",
                content={"media_id": m["id"], "file_url": m.get("file_url"), "role": "hero"},
                title=m.get("alt_text"),
                position={"x": 80, "y": 500, "width": 1440, "height": 520, "z_index": 1}))
    # Palette swatch element
    if palette:
        elements.append(_el(tid, mb_id, vp, 11, type="palette",
            content={"colors": palette},
            title="Color Palette",
            position={"x": 80, "y": 1040, "width": 1440, "height": 60, "z_index": 1}))

    # MATERIALS section — entity-native, NFC-ready
    mp = page_by_section["materials"]
    for i, mid in enumerate(material_ids[:6]):
        entity = materials.get(mid)
        if not entity:
            continue
        col = i % 3
        row = i // 3
        elements.append(_el(tid, mb_id, mp, i, type="material",
            content={
                # Knowledge-native, NFC-ready triple identity
                "entity_id":   entity["id"],
                "material_id": entity["id"],
                "brand_id":    entity.get("brand_id"),
                "display_name": entity.get("display_name"),
                "entity_type":  entity.get("entity_type"),
                "attributes":   entity.get("attributes") or {},
                "source":      "concept_seed",
            },
            title=entity.get("display_name"),
            position={"x": 80 + col * 480, "y": 120 + row * 360, "width": 460, "height": 340, "z_index": 1}))

    # PRODUCTS section
    pp = page_by_section["products"]
    for i, pidx in enumerate(product_ids[:6]):
        entity = products.get(pidx)
        if not entity:
            continue
        col = i % 3
        row = i // 3
        elements.append(_el(tid, mb_id, pp, i, type="product",
            content={
                "entity_id":  entity["id"],
                "product_id": entity["id"],
                "brand_id":   entity.get("brand_id"),
                "display_name": entity.get("name"),
                "canonical_collection_id": entity.get("canonical_collection_id"),
                "source":     "concept_seed",
            },
            title=entity.get("name"),
            position={"x": 80 + col * 480, "y": 120 + row * 360, "width": 460, "height": 340, "z_index": 1}))

    # ATMOSPHERE section — gallery from media (concept + Discovery-driven)
    ap = page_by_section["atmosphere"]
    for i, mdid in enumerate(media_ids[:8]):
        m = media.get(mdid)
        if not m:
            continue
        col = i % 4
        row = i // 4
        elements.append(_el(tid, mb_id, ap, i, type="image",
            content={"media_id": m["id"], "file_url": m.get("file_url"), "source": "concept_seed"},
            title=m.get("alt_text"),
            position={"x": 80 + col * 360, "y": 120 + row * 280, "width": 340, "height": 260, "z_index": 1}))

    # DESIGN NOTES — single editable text block
    npg = page_by_section["notes"]
    elements.append(_el(tid, mb_id, npg, 0, type="text",
        content={"text": "Designer workspace — capture decisions, open questions, next steps.",
                 "variant": "note", "editable": True},
        title="Design Notes",
        position={"x": 80, "y": 120, "width": 1440, "height": 600, "z_index": 1}))

    if elements:
        c.table("moodboard_elements").insert(elements).execute()

    # Timeline event
    try:
        c.table("journey_timeline_events").insert({
            "id":          str(uuid.uuid4()),
            "tenant_id":   tid,
            "journey_id":  jid,
            "event_type":  "working_moodboard_generated",
            "narrative_text": f"Hai generato il Working Moodboard a partire da {direction_name}.",
            "metadata":    {"working_moodboard_id": mb_id, "source_concept_id": concept_mb_id},
            "created_by":  uid,
            "created_at":  derived_at,
        }).execute()
    except Exception:
        log.exception("working_moodboard_generated timeline event failed (non-blocking)")

    return {
        "created":       True,
        "moodboard_id":  mb_id,
        "title":         title,
        "derived_at":    derived_at,
        "sections":      list(WORKING_SECTIONS),
        "element_count": len(elements),
    }


@router.get("/journeys/{jid}/working-moodboards")
def list_working_moodboards(jid: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _resolve_journey(c, tid, jid)
    rows = (c.table("moodboards")
              .select("id,title,ai_metadata,status,updated_at")
              .eq("tenant_id", tid).eq("journey_id", jid)
              .is_("deleted_at", "null")
              .order("created_at", desc=False).execute().data or [])
    out: List[Dict[str, Any]] = []
    for r in rows:
        ws = ((r.get("ai_metadata") or {}).get("working_seed") or {})
        if not ws.get("source_concept_id"):
            continue
        out.append({
            "moodboard_id":      r["id"],
            "title":             r.get("title"),
            "status":            r.get("status"),
            "derived_at":        ws.get("derived_at"),
            "source_concept_id": ws.get("source_concept_id"),
            "direction_name":    ws.get("direction_name"),
            "color_palette":     ws.get("color_palette") or [],
        })
    return {"working_moodboards": out, "total": len(out)}


# ════════════════════════════════════════════════════════════════════
#  APPROVAL LAYER™
# ════════════════════════════════════════════════════════════════════
class ApprovalPatch(BaseModel):
    approval_status: str


@router.get("/moodboards/{mbid}/working-payload")
def get_working_payload(mbid: str, ctx=Depends(get_tenant_context)):
    """One-shot fetch of moodboard + pages + elements grouped by section,
    designed for the WorkingMoodboardPage frontend."""
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("moodboards").select("id,journey_id,title,ai_metadata,status")
             .eq("id", mbid).eq("tenant_id", tid).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Moodboard not found")
    mb = rows[0]
    pages = (c.table("moodboard_pages")
              .select("id,title,page_type,settings,sort_order")
              .eq("tenant_id", tid).eq("moodboard_id", mbid)
              .order("sort_order").execute().data or [])
    elements = (c.table("moodboard_elements")
                  .select("id,page_id,type,content,title,sort_order")
                  .eq("tenant_id", tid).eq("moodboard_id", mbid)
                  .order("sort_order").execute().data or [])
    by_page: Dict[str, List[Dict[str, Any]]] = {}
    for e in elements:
        cnt = e.get("content")
        if isinstance(cnt, str):
            try:
                cnt = json.loads(cnt)
            except Exception:
                cnt = {}
        by_page.setdefault(e["page_id"], []).append({
            "id":         e["id"],
            "type":       e.get("type"),
            "content":    cnt,
            "title":      e.get("title"),
            "sort_order": e.get("sort_order"),
        })
    sections: List[Dict[str, Any]] = []
    for p in pages:
        settings = p.get("settings") or {}
        section = settings.get("section") or (p.get("title") or "").lower()
        sections.append({
            "page_id":   p["id"],
            "section":   section,
            "title":     p.get("title"),
            "page_type": p.get("page_type"),
            "elements":  by_page.get(p["id"]) or [],
        })
    return {
        "moodboard_id": mbid,
        "title":        mb.get("title"),
        "status":       mb.get("status"),
        "journey_id":   mb.get("journey_id"),
        "working_seed": (mb.get("ai_metadata") or {}).get("working_seed") or {},
        "sections":     sections,
    }



@router.patch("/moodboard-elements/{element_id}/approval-status")
def set_element_approval(element_id: str, body: ApprovalPatch,
                         ctx=Depends(get_tenant_context)):
    if body.approval_status not in APPROVAL_STATES:
        raise HTTPException(422, f"approval_status must be one of {list(APPROVAL_STATES)}")
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("moodboard_elements").select("id,content,moodboard_id")
              .eq("id", element_id).eq("tenant_id", tid).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Element not found")
    el = rows[0]
    content = el.get("content")
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except Exception:
            content = {}
    elif not isinstance(content, dict):
        content = {}
    content["approval_status"] = body.approval_status
    content["approval_changed_at"] = _now()
    c.table("moodboard_elements").update({
        "content": json.dumps(content),
    }).eq("id", element_id).execute()
    return {"element_id": element_id, "approval_status": body.approval_status}


# ════════════════════════════════════════════════════════════════════
#  CLIENT PROPOSAL VIEW™  (read-only)
# ════════════════════════════════════════════════════════════════════
@router.get("/client/moodboards/{mbid}/presentation")
def client_moodboard_presentation(mbid: str, ctx=Depends(get_tenant_context)):
    from routers.client_portal import _require_client, _verify_journey_ownership
    profile_id = _require_client(ctx)
    tid = ctx["tenant_id"]
    c = db()
    mb_rows = (c.table("moodboards").select("id,journey_id,title,ai_metadata,status")
                .eq("id", mbid).eq("tenant_id", tid).limit(1).execute().data or [])
    if not mb_rows:
        raise HTTPException(404, "Moodboard not found")
    mb = mb_rows[0]
    jid = mb.get("journey_id")
    if not jid:
        raise HTTPException(400, "Moodboard not linked to a Journey")
    _verify_journey_ownership(c, tid, jid, profile_id, ctx.get("role"))

    ws = ((mb.get("ai_metadata") or {}).get("working_seed") or {})
    # Aggregate elements grouped by section (via pages.settings.section)
    pages = (c.table("moodboard_pages")
                .select("id,title,page_type,settings,sort_order")
                .eq("tenant_id", tid).eq("moodboard_id", mbid)
                .order("sort_order").execute().data or [])
    elements = (c.table("moodboard_elements")
                  .select("id,page_id,type,content,title,sort_order")
                  .eq("tenant_id", tid).eq("moodboard_id", mbid)
                  .order("sort_order").execute().data or [])

    by_page: Dict[str, List[Dict[str, Any]]] = {}
    for e in elements:
        cnt = e.get("content")
        if isinstance(cnt, str):
            try:
                cnt = json.loads(cnt)
            except Exception:
                cnt = {}
        # In the client view we hide explicit approval status to keep the
        # presentation clean (status is a designer-side concept).
        if isinstance(cnt, dict):
            cnt = {k: v for k, v in cnt.items() if not k.startswith("approval_")}
        by_page.setdefault(e["page_id"], []).append({
            "id":         e["id"],
            "type":       e.get("type"),
            "content":    cnt,
            "title":      e.get("title"),
            "sort_order": e.get("sort_order"),
        })

    sections: List[Dict[str, Any]] = []
    for p in pages:
        settings = p.get("settings") or {}
        section = settings.get("section") or p.get("title", "").lower()
        sections.append({
            "section":   section,
            "title":     p.get("title"),
            "elements":  by_page.get(p["id"]) or [],
        })

    return {
        "moodboard_id":  mbid,
        "journey_id":    jid,
        "title":         mb.get("title"),
        "direction_name": ws.get("direction_name"),
        "color_palette": ws.get("color_palette") or [],
        "style_dna_snapshot": ws.get("style_dna_snapshot") or [],
        "sections":      sections,
        "mode":          "presentation",
    }
