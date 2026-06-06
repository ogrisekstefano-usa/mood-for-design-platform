"""KE-005B · Knowledge-Native Surfaces · public API

Endpoint condivisi montati sotto /api:
  GET  /knowledge/entities/search        typeahead canonical entities
  GET  /knowledge/entities/{id}/context-panel  aggregator pannello unico
  POST /surfaces/{type}/{id}/attach      {entity_id}
  POST /surfaces/{type}/{id}/detach      {entity_id}
  GET  /surfaces/{type}/{id}/entities    lista attualmente attaccate

L'endpoint context-panel ritorna i dati per l'<EntityContextPanel /> in
una sola chiamata · 9 sezioni (Hero · Brand/Designer/Collection ·
Operational Readiness · Future Uses · Connected Assets · Certification ·
Materials · Provenance · Actions).

KE-005B.1 direttiva n.5: gli endpoint attach/detach NON scrivono mai in
knowledge_impact_events · vedi services/knowledge_usage_hooks.py.
"""
from __future__ import annotations
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db
from core.tenant_context import get_tenant_context
from services import knowledge_usage_hooks as hooks

logger = logging.getLogger("knowledge_surfaces")
router = APIRouter()


# ──────────────────────────────────────────────────────────────────────
# §1 · Typeahead search
# ──────────────────────────────────────────────────────────────────────
@router.get("/knowledge/entities/search")
def search_entities(type: Optional[str] = None, q: Optional[str] = None,
                    brand_id: Optional[str] = None,
                    catalog_set_id: Optional[str] = None,
                    limit: int = 30,
                    ctx=Depends(get_tenant_context)):
    """Typeahead su `brand_detected_entities`. Filtra per
    entity_type (multi-valore comma-separated) e matchea su display_name
    (ILIKE). Risultati ordinati per mention_count desc.
    Cross-brand isolation · sempre filtrato per tenant_id.
    """
    c = db()
    q_ = (c.table("brand_detected_entities")
          .select("id,entity_type,display_name,confidence_score,status,"
                  "mention_count,brand_id,catalog_set_id,canonical_ref_id,aliases")
          .eq("tenant_id", ctx["tenant_id"]))
    if type:
        types = [t.strip() for t in type.split(",") if t.strip()]
        q_ = q_.in_("entity_type", types)
    if brand_id:
        q_ = q_.eq("brand_id", brand_id)
    if catalog_set_id:
        q_ = q_.eq("catalog_set_id", catalog_set_id)
    if q:
        q_ = q_.ilike("display_name", f"%{q}%")
    rows = (q_.order("mention_count", desc=True)
              .limit(min(max(limit, 1), 100)).execute().data or [])
    return {"entities": rows, "count": len(rows)}


# ──────────────────────────────────────────────────────────────────────
# §2 · Attach / detach / list
# ──────────────────────────────────────────────────────────────────────
class AttachBody(BaseModel):
    entity_id:    str
    block_id:     Optional[str] = None
    milestone_id: Optional[str] = None


@router.post("/surfaces/{surface_type}/{surface_id}/attach")
def attach(surface_type: str, surface_id: str, body: AttachBody,
           ctx=Depends(get_tenant_context)):
    res = hooks.attach_entity(
        tenant_id=ctx["tenant_id"], surface_type=surface_type,
        surface_id=surface_id, entity_id=body.entity_id,
        user_id=ctx.get("profile_id"),
        extra={"block_id": body.block_id, "milestone_id": body.milestone_id},
    )
    if not res.get("ok"):
        raise HTTPException(400, res.get("error") or "attach failed")
    return res


@router.post("/surfaces/{surface_type}/{surface_id}/detach")
def detach(surface_type: str, surface_id: str, body: AttachBody,
           ctx=Depends(get_tenant_context)):
    res = hooks.detach_entity(
        tenant_id=ctx["tenant_id"], surface_type=surface_type,
        surface_id=surface_id, entity_id=body.entity_id,
        user_id=ctx.get("profile_id"),
    )
    return res


@router.get("/surfaces/{surface_type}/{surface_id}/entities")
def list_entities(surface_type: str, surface_id: str,
                  ctx=Depends(get_tenant_context)):
    return hooks.list_surface_entities(
        tenant_id=ctx["tenant_id"],
        surface_type=surface_type, surface_id=surface_id)


# ──────────────────────────────────────────────────────────────────────
# §3 · Entity Context Panel · aggregator
# ──────────────────────────────────────────────────────────────────────
def _safe(coro, fallback):
    try:
        return coro()
    except Exception as ex:
        logger.warning(f"context-panel section failed: {ex}")
        return fallback


@router.get("/knowledge/entities/{entity_id}/context-panel")
def entity_context_panel(entity_id: str,
                          ctx=Depends(get_tenant_context)):
    """Aggregator pannello unico per <EntityContextPanel />.
    Ritorna 9 sezioni ordinate secondo direttiva KE-005B.1:
      1. hero
      2. brand_designer_collection
      3. operational_readiness
      4. future_uses
      5. connected_assets (chip summary)
      6. certification
      7. materials
      8. provenance
      9. actions (metadata per CTA, no logica)
    Tutti i campi sono READ-only e tenant-isolated.
    """
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("brand_detected_entities")
            .select("id,entity_type,display_name,catalog_set_id,brand_id,"
                    "canonical_ref_id,canonical_ref_table,confidence_score,"
                    "status,mention_count,source_document_ids,source_page_ids,"
                    "aliases,attributes,created_at,updated_at")
            .eq("id", entity_id).eq("tenant_id", tid)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Entità non trovata")
    ent = rows[0]

    # ── 1 · Hero ──────────────────────────────────────────────────────
    hero = {
        "entity_id":    ent["id"],
        "display_name": ent.get("display_name") or "—",
        "entity_type":  ent.get("entity_type"),
        "confidence":   ent.get("confidence_score"),
        "mention_count": ent.get("mention_count") or 0,
    }

    # ── 2 · Brand / Designer / Collection ────────────────────────────
    brand_designer = {"brand": None, "designer": None, "collection": None}
    if ent.get("brand_id"):
        br = (c.table("brands").select("id,name,slug")
              .eq("id", ent["brand_id"]).limit(1).execute().data or [])
        if br:
            brand_designer["brand"] = br[0]
    # Cross-entity lookup per designer / collection
    attrs = ent.get("attributes") or {}
    if isinstance(attrs, dict):
        if attrs.get("designer"):
            brand_designer["designer"] = {"name": attrs.get("designer")}
        if attrs.get("collection"):
            brand_designer["collection"] = {"name": attrs.get("collection")}

    # ── 3 · Operational Readiness ─────────────────────────────────────
    # Regole minime · entity certificata (status='approved' o canonical_ref_id≠NULL)
    # e display_name presente → READY per moodboard/journey.
    is_certified = bool(ent.get("canonical_ref_id")) or ent.get("status") == "approved"
    has_name = bool(ent.get("display_name"))
    operational_readiness = {
        "moodboard":           {"ready": is_certified and has_name,
                                "missing": [] if (is_certified and has_name) else
                                            (["display_name"] if not has_name else ["certification"])},
        "design_journey":      {"ready": is_certified and has_name,
                                "missing": [] if (is_certified and has_name) else ["certification"]},
        "material_board":      {"ready": is_certified and has_name and ent.get("entity_type") in ("material", "finish"),
                                "missing": [] if ent.get("entity_type") in ("material", "finish") else ["wrong_type"]},
        "client_presentation": {"ready": is_certified and has_name,
                                "missing": [] if (is_certified and has_name) else ["certification"]},
    }

    # ── 4 · Future Uses™ ─────────────────────────────────────────────
    fu_rows = (c.table("entity_future_uses_v")
               .select("*")
               .eq("entity_id", entity_id)
               .eq("tenant_id", tid).limit(1).execute().data or [])
    fu = fu_rows[0] if fu_rows else {}
    future_uses = {
        "moodboard":           int(fu.get("moodboard_count")           or 0),
        "design_journey":      int(fu.get("design_journey_count")      or 0),
        "material_board":      int(fu.get("material_board_count")      or 0),
        "client_presentation": int(fu.get("client_presentation_count") or 0),
        "magazine":            int(fu.get("magazine_count")            or 0),
    }

    # ── 5 · Connected Assets · chip summary ──────────────────────────
    ca_rows = (c.table("brand_entity_relations")
               .select("source_entity_id,target_entity_id,target_type,relation_type")
               .eq("tenant_id", tid)
               .or_(f"source_entity_id.eq.{entity_id},target_entity_id.eq.{entity_id}")
               .limit(500).execute().data or [])
    ca_counts: Dict[str, int] = {}
    for r in ca_rows:
        rt = r.get("relation_type") or ""
        if rt.startswith("used_in_"):
            ca_counts[rt[len("used_in_"):]] = ca_counts.get(rt[len("used_in_"):], 0) + 1
        elif rt:
            ca_counts[rt] = ca_counts.get(rt, 0) + 1
    connected_assets = {
        "total_relations": len(ca_rows),
        "by_relation":     ca_counts,
    }

    # ── 6 · Certification ────────────────────────────────────────────
    certification = {
        "status":             ent.get("status"),
        "is_certified":       is_certified,
        "canonical_ref_id":   ent.get("canonical_ref_id"),
        "canonical_ref_table": ent.get("canonical_ref_table"),
        "confidence":         ent.get("confidence_score"),
        "certified_at":       ent.get("updated_at") if is_certified else None,
    }

    # ── 7 · Materials (per product/finish entities) ──────────────────
    materials: List[Dict[str, Any]] = []
    if ent.get("entity_type") == "product":
        mat_rels = (c.table("brand_entity_relations")
                    .select("target_entity_id,relation_type,metadata_json")
                    .eq("tenant_id", tid)
                    .eq("source_entity_id", entity_id)
                    .in_("relation_type", ["has_material", "has_finish"])
                    .limit(50).execute().data or [])
        if mat_rels:
            target_ids = [m["target_entity_id"] for m in mat_rels if m.get("target_entity_id")]
            mat_entities = []
            if target_ids:
                mat_entities = (c.table("brand_detected_entities")
                                .select("id,display_name,entity_type")
                                .in_("id", target_ids).execute().data or [])
            ent_map = {m["id"]: m for m in mat_entities}
            for r in mat_rels:
                e = ent_map.get(r["target_entity_id"])
                if e:
                    materials.append({"id": e["id"], "display_name": e["display_name"],
                                       "type": e["entity_type"], "relation": r["relation_type"]})

    # ── 8 · Provenance ───────────────────────────────────────────────
    src_docs = ent.get("source_document_ids") or []
    src_pages = ent.get("source_page_ids") or []
    provenance = {
        "source_document_ids": src_docs if isinstance(src_docs, list) else [],
        "source_page_ids":     src_pages if isinstance(src_pages, list) else [],
        "mention_count":       ent.get("mention_count") or 0,
        "confidence":          ent.get("confidence_score"),
        "aliases":             ent.get("aliases") or [],
    }

    # ── 9 · Actions metadata ─────────────────────────────────────────
    actions = {
        "deep_link_review_workspace":
            f"/catalog-sets/{ent.get('catalog_set_id')}/workspace?focus={entity_id}"
            if ent.get("catalog_set_id") else None,
        "can_swap":   is_certified,
        "can_remove": True,
    }

    return {
        "entity_id": entity_id,
        "sections": {
            "hero":                       hero,
            "brand_designer_collection":  brand_designer,
            "operational_readiness":      operational_readiness,
            "future_uses":                future_uses,
            "connected_assets":           connected_assets,
            "certification":              certification,
            "materials":                  materials,
            "provenance":                 provenance,
            "actions":                    actions,
        },
    }
