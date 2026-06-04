"""Review Workspace™ V3 · Brand Knowledge Package → Ecosistema MOOD.

Endpoints (mounted under /api/knowledge):

  GET  /catalog-sets/{set_id}/entities/{entity_id}/future-uses
       Aggregated "Utilizzato in" counters per asset_type, plus
       always-available "Disponibile per" surfaces. Real DB data via
       entity_future_uses_v (no hardcoded values).

  GET  /catalog-sets/{set_id}/entities/{entity_id}/connected-assets
       Connected Assets™ network (multi-type nodes + edges) for the
       Entity Inspector. Builds from brand_entity_relations + canonical
       cross-refs. Future-proof shape ready for PROJECT / MOODBOARD /
       JOURNEY node types (returns empty arrays where not yet wired).

  GET  /catalog-sets/{set_id}/entities/{entity_id}/project-impact
       M7 PLACEHOLDER — returns zero-state Project Impact™ payload
       (residential / hospitality / retail / office / home_staging).
       NO economic KPIs.

  POST /catalog-sets/{set_id}/entities/{entity_id}/apply-correction
       Post-approval Knowledge Impact event. Body: { scope, source_input,
       canonical_target, impact_preview? }. Writes knowledge_impact_events
       and returns the ROI payload for the UI card.
"""
from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import db
from core.tenant_context import get_tenant_context

logger = logging.getLogger("review_workspace_v3")
router = APIRouter()


# ─── Static lists ────────────────────────────────────────────────────
AVAILABLE_SURFACES = [
    "moodboard",
    "design_journey",
    "material_board",
    "client_presentation",
    "product_selection",
    "magazine",
    "social_story",
    "home_staging_pack",
]

PROJECT_TYPES = ["residential", "hospitality", "retail", "office", "home_staging"]


# ─── Helpers ─────────────────────────────────────────────────────────
def _require_set(c, tid: str, set_id: str) -> Dict[str, Any]:
    rows = (c.table("brand_catalog_sets").select("id,brand_id,tenant_id,status")
            .eq("id", set_id).eq("tenant_id", tid).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Catalog Set non trovato")
    return rows[0]


def _require_entity(c, set_id: str, entity_id: str) -> Dict[str, Any]:
    rows = (c.table("brand_detected_entities")
            .select("id,catalog_set_id,brand_id,entity_type,entity_key,display_name,"
                    "confidence_score,status,canonical_ref_table,canonical_ref_id,"
                    "source_document_ids,source_page_ids,mention_count")
            .eq("id", entity_id).eq("catalog_set_id", set_id)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Entità non trovata")
    return rows[0]


# ─── 1 · FUTURE USES™ ────────────────────────────────────────────────
@router.get("/catalog-sets/{set_id}/entities/{entity_id}/future-uses")
def entity_future_uses(set_id: str, entity_id: str,
                        ctx=Depends(get_tenant_context)):
    """Real-data Future Uses™ counters for the Entity Inspector.

    Reads from `entity_future_uses_v` (aggregated view over
    entity_operational_usage). Surfaces with zero usage are still
    returned with count=0 so the UI can render the "Disponibile per"
    state vs "Utilizzato in" state consistently.
    """
    c = db()
    tid = ctx["tenant_id"]
    _require_set(c, tid, set_id)
    ent = _require_entity(c, set_id, entity_id)

    used_in: Dict[str, int] = {s: 0 for s in AVAILABLE_SURFACES}
    try:
        rows = (c.table("entity_future_uses_v")
                .select("*")
                .eq("tenant_id", tid)
                .eq("entity_type", ent["entity_type"])
                .eq("entity_id", entity_id)
                .limit(1).execute().data or [])
        if rows:
            r = rows[0]
            used_in = {
                "moodboard": int(r.get("moodboard_count") or 0),
                "design_journey": int(r.get("design_journey_count") or 0),
                "material_board": int(r.get("material_board_count") or 0),
                "client_presentation": int(r.get("client_presentation_count") or 0),
                "magazine": int(r.get("magazine_count") or 0),
                "social_story": int(r.get("social_story_count") or 0),
                "product_selection": int(r.get("product_selection_count") or 0),
                "home_staging_pack": int(r.get("home_staging_pack_count") or 0),
            }
    except Exception as ex:
        logger.warning(f"entity_future_uses_v lookup failed: {ex}")

    # Also resolve canonical entity_id (e.g. promoted material -> materials_canonical row)
    # so the UI knows the SSoT key the asset surfaces will reuse.
    canonical_id = ent.get("canonical_ref_id") or entity_id

    total_uses = sum(used_in.values())
    return {
        "entity_id": entity_id,
        "canonical_entity_id": canonical_id,
        "entity_type": ent["entity_type"],
        "display_name": ent["display_name"],
        "used_in": used_in,
        "available_for": AVAILABLE_SURFACES,
        "total_uses": total_uses,
        "state": "in_use" if total_uses > 0 else "available",
    }


# ─── 2 · CONNECTED ASSETS™ NETWORK ──────────────────────────────────
@router.get("/catalog-sets/{set_id}/entities/{entity_id}/connected-assets")
def entity_connected_assets(set_id: str, entity_id: str,
                             ctx=Depends(get_tenant_context)):
    """Connected Assets™ network for the Entity Inspector.

    Returns nodes + edges grouped by entity_type. Future-proof for the
    full type vocabulary: PRODUCT / MATERIAL / DESIGNER / IMAGE / BRAND
    / DOCUMENT / PROJECT / MOODBOARD / JOURNEY. Types not yet wired
    return as empty groups (UI shows the structure).
    """
    c = db()
    tid = ctx["tenant_id"]
    _require_set(c, tid, set_id)
    ent = _require_entity(c, set_id, entity_id)

    # Pull all relations referencing this entity (both directions)
    nodes_by_id: Dict[str, Dict[str, Any]] = {}
    edges: List[Dict[str, Any]] = []
    try:
        rels = (c.table("brand_entity_relations")
                .select("id,source_entity_id,target_entity_id,relation_type,metadata_json")
                .eq("catalog_set_id", set_id)
                .or_(f"source_entity_id.eq.{entity_id},target_entity_id.eq.{entity_id}")
                .limit(200).execute().data or [])
    except Exception:
        rels = []

    referenced_ids = set()
    for r in rels:
        s = r.get("source_entity_id")
        t = r.get("target_entity_id")
        if s and s != entity_id:
            referenced_ids.add(s)
        if t and t != entity_id:
            referenced_ids.add(t)
        edges.append({
            "id": r.get("id"),
            "from": s,
            "to": t,
            "relation": r.get("relation_type"),
        })

    if referenced_ids:
        try:
            others = (c.table("brand_detected_entities")
                      .select("id,entity_type,display_name,confidence_score")
                      .in_("id", list(referenced_ids)[:200])
                      .execute().data or [])
            for o in others:
                nodes_by_id[o["id"]] = {
                    "id": o["id"],
                    "type": o["entity_type"].upper(),
                    "label": o["display_name"],
                    "confidence": float(o.get("confidence_score") or 0),
                }
        except Exception as ex:
            logger.warning(f"connected-assets nodes lookup: {ex}")

    # Source documents and images (always relevant)
    doc_ids = ent.get("source_document_ids") or []
    if doc_ids:
        try:
            docs = (c.table("brand_catalog_documents")
                    .select("source_document_id,display_name")
                    .in_("source_document_id", doc_ids[:30])
                    .eq("catalog_set_id", set_id).execute().data or [])
            for d in docs:
                did = d.get("source_document_id")
                if did:
                    nodes_by_id[did] = {
                        "id": did,
                        "type": "DOCUMENT",
                        "label": d.get("display_name") or "Documento",
                        "confidence": 1.0,
                    }
                    edges.append({"id": None, "from": entity_id, "to": did,
                                  "relation": "appears_in"})
        except Exception:
            pass

    # Group nodes by type (future-proof structure)
    groups_template = {
        "PRODUCT": [], "MATERIAL": [], "DESIGNER": [], "IMAGE": [],
        "BRAND": [], "COLLECTION": [], "DOCUMENT": [],
        "PROJECT": [], "MOODBOARD": [], "JOURNEY": [],
    }
    for node in nodes_by_id.values():
        t = node["type"]
        if t in groups_template:
            groups_template[t].append(node)
        else:
            # Unknown type — still expose so it''s visible
            groups_template.setdefault(t, []).append(node)

    return {
        "center": {
            "id": entity_id,
            "type": ent["entity_type"].upper(),
            "label": ent["display_name"],
            "confidence": float(ent.get("confidence_score") or 0),
        },
        "groups": groups_template,
        "edges": edges,
        "counts": {k: len(v) for k, v in groups_template.items()},
        "total_relations": len(edges),
    }


# ─── 3 · PROJECT IMPACT™ (M7 placeholder) ───────────────────────────
@router.get("/catalog-sets/{set_id}/entities/{entity_id}/project-impact")
def entity_project_impact(set_id: str, entity_id: str,
                           ctx=Depends(get_tenant_context)):
    """M7 PLACEHOLDER — Project Impact™ foundation.

    Returns zero-state per project_type. NO economic KPIs are surfaced
    in V3.1 (value_aggregate stays null even if stored).
    """
    c = db()
    tid = ctx["tenant_id"]
    _require_set(c, tid, set_id)
    ent = _require_entity(c, set_id, entity_id)

    rows: List[Dict[str, Any]] = []
    try:
        rows = (c.table("entity_project_impact")
                .select("project_type,project_count,client_count,"
                        "moodboard_count,journey_count")
                .eq("tenant_id", tid)
                .eq("entity_type", ent["entity_type"])
                .eq("entity_id", entity_id)
                .execute().data or [])
    except Exception as ex:
        logger.warning(f"entity_project_impact lookup: {ex}")

    by_type = {r["project_type"]: r for r in rows}
    payload = []
    for pt in PROJECT_TYPES:
        row = by_type.get(pt) or {}
        payload.append({
            "project_type": pt,
            "project_count": int(row.get("project_count") or 0),
            "client_count": int(row.get("client_count") or 0),
            "moodboard_count": int(row.get("moodboard_count") or 0),
            "journey_count": int(row.get("journey_count") or 0),
            # NO economic KPI in V3.1
            "value_aggregate": None,
        })

    return {
        "entity_id": entity_id,
        "entity_type": ent["entity_type"],
        "display_name": ent["display_name"],
        "rows": payload,
        "is_placeholder": True,
        "note": "M7 placeholder · KPI economici non attivi in V3.1",
    }


# ─── 4 · APPLY CORRECTION (Knowledge Impact) ────────────────────────
class ApplyCorrectionBody(BaseModel):
    scope: str = Field(..., description="only_here | catalog | brand")
    source_input: Optional[str] = None
    canonical_target: Optional[str] = None
    # The UI can hand us an impact preview computed client-side; we still
    # persist it server-side so the ledger reflects what was shown.
    occurrences_corrected: int = 0
    products_improved: int = 0
    images_linked: int = 0
    future_moodboards_unlocked: int = 0
    materials_consolidated: int = 0
    designers_consolidated: int = 0


@router.post("/catalog-sets/{set_id}/entities/{entity_id}/apply-correction")
def entity_apply_correction(set_id: str, entity_id: str,
                             body: ApplyCorrectionBody,
                             ctx=Depends(get_tenant_context)):
    """Post-approval Knowledge Impact event. Persists ROI ledger and
    returns the impact payload the UI renders inside the Knowledge
    Impact card.
    """
    if body.scope not in ("only_here", "catalog", "brand"):
        raise HTTPException(400, "scope deve essere only_here | catalog | brand")
    c = db()
    tid = ctx["tenant_id"]
    _require_set(c, tid, set_id)
    ent = _require_entity(c, set_id, entity_id)

    insert_row = {
        "tenant_id": tid,
        "catalog_set_id": set_id,
        "entity_type": ent["entity_type"],
        "entity_id": entity_id,
        "scope": body.scope,
        "source_input": body.source_input,
        "canonical_target": body.canonical_target,
        "occurrences_corrected": body.occurrences_corrected,
        "products_improved": body.products_improved,
        "images_linked": body.images_linked,
        "future_moodboards_unlocked": body.future_moodboards_unlocked,
        "materials_consolidated": body.materials_consolidated,
        "designers_consolidated": body.designers_consolidated,
        "preview_payload": {},
        "created_by": ctx.get("user_id"),
    }
    try:
        created = (c.table("knowledge_impact_events")
                   .insert(insert_row, returning="representation")
                   .execute().data or [])
    except Exception as ex:
        logger.error(f"knowledge_impact_events insert failed: {ex}")
        raise HTTPException(500, "Errore registrazione Knowledge Impact")

    row = created[0] if created else insert_row
    # Strip _id if present (Mongo-style safety) — not applicable here but defensive.
    row.pop("_id", None)

    return {
        "ok": True,
        "event": row,
        "impact": {
            "occurrences_corrected": row["occurrences_corrected"],
            "products_improved": row["products_improved"],
            "images_linked": row["images_linked"],
            "future_moodboards_unlocked": row["future_moodboards_unlocked"],
            "materials_consolidated": row["materials_consolidated"],
            "designers_consolidated": row["designers_consolidated"],
        },
        "scope": body.scope,
    }
