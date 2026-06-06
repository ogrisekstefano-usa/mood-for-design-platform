"""KE-005B.1 · Knowledge Usage Hooks (shared service)

Foundation per Knowledge-Native Surfaces. Una surface (moodboard /
journey / material board / client presentation) chiama questi hook
quando un'entità canonica viene attaccata/staccata.

Ogni attach genera:
  1. brand_entity_relations  (relation_type='used_in_<surface>')
  2. entity_operational_usage (counter per surface)
  3. knowledge_impact_events  (event audit · scope='only_here')

I detach fanno l'inverso. Idempotente: due attach uguali non
duplicano la riga di relation.
"""
from __future__ import annotations
import logging
from typing import Any, Dict, Optional
from datetime import datetime, timezone
from database import db

logger = logging.getLogger("ke005b.hooks")

# Surface → relation_type mapping
SURFACE_RELATION = {
    "moodboard":            "used_in_moodboard",
    "design_journey":       "used_in_design_journey",
    "material_board":       "used_in_material_board",
    "client_presentation":  "used_in_client_presentation",
}


def _resolve_entity(c, entity_id: str) -> Optional[Dict[str, Any]]:
    rows = (c.table("brand_detected_entities")
            .select("id,entity_type,display_name,catalog_set_id,brand_id,tenant_id,canonical_ref_id,mention_count")
            .eq("id", entity_id).limit(1).execute().data or [])
    return rows[0] if rows else None


def attach_entity(*, tenant_id: str, surface_type: str, surface_id: str,
                   entity_id: str, user_id: Optional[str] = None,
                   extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Hook idempotente: lega entity_id a una surface."""
    if surface_type not in SURFACE_RELATION:
        return {"ok": False, "error": f"surface_type non supportato: {surface_type}"}
    c = db()
    ent = _resolve_entity(c, entity_id)
    if not ent:
        return {"ok": False, "error": "entity non trovata"}

    rel_type = SURFACE_RELATION[surface_type]
    # Snapshot of entity for downstream rendering (id + display_name + type)
    snapshot = {
        "id": ent["id"],
        "type": ent.get("entity_type"),
        "display_name": ent.get("display_name"),
        "canonical_ref_id": ent.get("canonical_ref_id"),
    }

    # 1) brand_entity_relations (idempotent · skip if duplicate)
    rel_row = None
    try:
        existing = (c.table("brand_entity_relations")
                    .select("id").eq("source_entity_id", entity_id)
                    .eq("target_entity_id", surface_id)
                    .eq("relation_type", rel_type).limit(1).execute().data or [])
        if existing:
            rel_row = existing[0]
        else:
            rel_row = (c.table("brand_entity_relations").insert({
                "tenant_id":         tenant_id,
                "brand_id":          ent.get("brand_id"),
                "catalog_set_id":    ent.get("catalog_set_id"),
                "source_entity_id":  entity_id,
                "source_type":       ent.get("entity_type"),
                "target_entity_id":  surface_id,
                "target_type":       surface_type,
                "relation_type":     rel_type,
                "confidence_score":  1.0,
                "metadata":          {"attached_by": user_id, "snapshot": snapshot},
            }, returning="representation").execute().data or [None])[0]
    except Exception as ex:
        logger.warning(f"attach_entity[relations] {ex}")

    # 2) entity_operational_usage (upsert · increment via metadata)
    try:
        existing = (c.table("entity_operational_usage")
                    .select("id,metadata")
                    .eq("entity_id", entity_id)
                    .eq("asset_type", surface_type)
                    .eq("asset_id", surface_id).limit(1).execute().data or [])
        now_iso = datetime.now(timezone.utc).isoformat()
        if existing:
            md = existing[0].get("metadata") or {}
            md["usage_count"] = int(md.get("usage_count") or 1) + 1
            md["last_used_at"] = now_iso
            c.table("entity_operational_usage").update({"metadata": md}) \
                .eq("id", existing[0]["id"]).execute()
        else:
            c.table("entity_operational_usage").insert({
                "tenant_id":   tenant_id,
                "entity_id":   entity_id,
                "entity_type": ent.get("entity_type"),
                "asset_type":  surface_type,
                "asset_id":    surface_id,
                "metadata":    {"usage_count": 1, "first_used_at": now_iso,
                                  "last_used_at": now_iso,
                                  "brand_id": ent.get("brand_id"),
                                  "catalog_set_id": ent.get("catalog_set_id")},
            }).execute()
    except Exception as ex:
        logger.warning(f"attach_entity[operational_usage] {ex}")

    # 3) knowledge_impact_events (1 event · low-noise scope='only_here')
    try:
        c.table("knowledge_impact_events").insert({
            "tenant_id":               tenant_id,
            "catalog_set_id":          ent.get("catalog_set_id"),
            "entity_type":             ent.get("entity_type"),
            "entity_id":               entity_id,
            "scope":                   "only_here",
            "source_input":            f"{surface_type}:{surface_id[:8]}",
            "canonical_target":        ent.get("display_name") or "—",
            "occurrences_corrected":   1,
            "products_improved":       0,
            "images_linked":           0,
            "future_moodboards_unlocked": 1 if surface_type == "moodboard" else 0,
            "materials_consolidated":  0,
            "designers_consolidated":  0,
            "preview_payload":         {"hook": "attach_entity",
                                          "surface_type": surface_type,
                                          "surface_id": surface_id},
            "created_by":              user_id,
        }).execute()
    except Exception as ex:
        logger.warning(f"attach_entity[impact] {ex}")

    return {"ok": True, "relation": rel_row, "entity_snapshot": snapshot}


def detach_entity(*, tenant_id: str, surface_type: str, surface_id: str,
                   entity_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Reverse hook · idempotente."""
    if surface_type not in SURFACE_RELATION:
        return {"ok": False, "error": f"surface_type non supportato"}
    c = db()
    rel_type = SURFACE_RELATION[surface_type]
    # Remove relation
    try:
        c.table("brand_entity_relations").delete() \
            .eq("source_entity_id", entity_id) \
            .eq("target_entity_id", surface_id) \
            .eq("relation_type", rel_type).execute()
    except Exception as ex:
        logger.warning(f"detach[relations] {ex}")
    # Decrement usage
    try:
        existing = (c.table("entity_operational_usage")
                    .select("id,metadata")
                    .eq("entity_id", entity_id)
                    .eq("asset_type", surface_type)
                    .eq("asset_id", surface_id).limit(1).execute().data or [])
        if existing:
            md = existing[0].get("metadata") or {}
            new_count = max(0, int(md.get("usage_count") or 1) - 1)
            if new_count == 0:
                c.table("entity_operational_usage").delete() \
                    .eq("id", existing[0]["id"]).execute()
            else:
                md["usage_count"] = new_count
                md["last_used_at"] = datetime.now(timezone.utc).isoformat()
                c.table("entity_operational_usage").update({"metadata": md}) \
                    .eq("id", existing[0]["id"]).execute()
    except Exception as ex:
        logger.warning(f"detach[operational_usage] {ex}")
    return {"ok": True}


def list_surface_entities(*, surface_type: str, surface_id: str) -> Dict[str, Any]:
    """Ritorna le entità correntemente attaccate a una surface."""
    if surface_type not in SURFACE_RELATION:
        return {"entities": [], "count": 0}
    c = db()
    rows = (c.table("brand_entity_relations")
            .select("source_entity_id,source_type,metadata,created_at")
            .eq("target_entity_id", surface_id)
            .eq("relation_type", SURFACE_RELATION[surface_type])
            .order("created_at", desc=True).limit(500).execute().data or [])
    out = []
    for r in rows:
        snap = (r.get("metadata") or {}).get("snapshot") or {}
        out.append({
            "entity_id":    r["source_entity_id"],
            "entity_type":  r["source_type"],
            "display_name": snap.get("display_name"),
            "attached_at":  r.get("created_at"),
        })
    return {"entities": out, "count": len(out)}
