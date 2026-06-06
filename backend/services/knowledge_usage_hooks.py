"""KE-005B.1 · Knowledge Usage Hooks (shared service)

Foundation per Knowledge-Native Surfaces. Una surface
(moodboard / journey / material board / client presentation / magazine /
social story / product selection / home staging pack) chiama questi
hook quando un'entità canonica viene attaccata/staccata.

DIRETTIVE UTENTE (KE-005B.1):
  1. NESSUN backfill automatico dei contenuti legacy.
  2. `entity_operational_usage` aggiornato ad ogni attach/detach.
  3. `brand_entity_relations` (Connected Assets) aggiornato ad ogni
     attach/detach.
  4. `entity_future_uses_v` riflette automaticamente (è una view su
     `entity_operational_usage` · zero codice extra).
  5. `knowledge_impact_events` NON registra attach/detach semplici —
     il ledger resta dedicato alle correzioni semantiche di KE-003.

Ogni attach genera:
  · brand_entity_relations   (relation_type='used_in_<surface>')
  · entity_operational_usage (asset_type=<surface>, asset_id=<surface_id>)

Ogni detach fa l'inverso.

Idempotente · tenant-isolated · zero side-effect su tabelle non
sotto KE-005B/KE-003.
"""
from __future__ import annotations
import logging
from typing import Any, Dict, Optional
from datetime import datetime, timezone
from database import db

logger = logging.getLogger("ke005b.hooks")

# Surface → relation_type (target_type = surface_type)
SURFACE_RELATION = {
    "moodboard":            "used_in_moodboard",
    "design_journey":       "used_in_design_journey",
    "material_board":       "used_in_material_board",
    "client_presentation":  "used_in_client_presentation",
    "magazine":             "used_in_magazine",
    "social_story":         "used_in_social_story",
    "product_selection":    "used_in_product_selection",
    "home_staging_pack":    "used_in_home_staging_pack",
}


def _resolve_entity(c, entity_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
    """Risolve l'entità rispettando tenant isolation (cross-brand safety)."""
    rows = (c.table("brand_detected_entities")
            .select("id,entity_type,display_name,catalog_set_id,brand_id,"
                    "tenant_id,canonical_ref_id,mention_count,status")
            .eq("id", entity_id).eq("tenant_id", tenant_id)
            .limit(1).execute().data or [])
    return rows[0] if rows else None


def attach_entity(*, tenant_id: str, surface_type: str, surface_id: str,
                  entity_id: str, user_id: Optional[str] = None,
                  extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Hook idempotente: lega entity_id a una surface.

    Ritorna {ok: bool, relation: dict|None, entity_snapshot: dict, error?: str}.
    """
    if surface_type not in SURFACE_RELATION:
        return {"ok": False, "error": f"surface_type non supportato: {surface_type}"}
    c = db()
    ent = _resolve_entity(c, entity_id, tenant_id)
    if not ent:
        # Cross-tenant safety: l'entità non esiste OR appartiene ad altro tenant
        return {"ok": False, "error": "entity non trovata (o cross-tenant)"}

    rel_type = SURFACE_RELATION[surface_type]
    snapshot = {
        "id":               ent["id"],
        "type":             ent.get("entity_type"),
        "display_name":     ent.get("display_name"),
        "canonical_ref_id": ent.get("canonical_ref_id"),
        "brand_id":         ent.get("brand_id"),
        "catalog_set_id":   ent.get("catalog_set_id"),
    }

    # 1) brand_entity_relations · idempotent (skip su duplicato)
    rel_row = None
    try:
        existing = (c.table("brand_entity_relations")
                    .select("id,metadata_json")
                    .eq("source_entity_id", entity_id)
                    .eq("target_entity_id", surface_id)
                    .eq("relation_type", rel_type)
                    .limit(1).execute().data or [])
        if existing:
            rel_row = existing[0]
        else:
            payload = {
                "tenant_id":         tenant_id,
                "brand_id":          ent.get("brand_id"),
                "catalog_set_id":    ent.get("catalog_set_id"),
                "source_entity_id":  entity_id,
                "source_type":       ent.get("entity_type"),
                "target_entity_id":  surface_id,
                "target_type":       surface_type,
                "relation_type":     rel_type,
                "confidence_score":  1.0,
                "metadata_json":     {"attached_by": user_id,
                                       "snapshot":    snapshot,
                                       "extra":       extra or {}},
            }
            ins = c.table("brand_entity_relations").insert(
                payload, returning="representation").execute()
            rel_row = (ins.data or [None])[0]
    except Exception as ex:
        logger.warning(f"attach_entity[relations] {ex}")

    # 2) entity_operational_usage · upsert idempotente
    try:
        existing = (c.table("entity_operational_usage")
                    .select("id,usage_context")
                    .eq("entity_id", entity_id)
                    .eq("asset_type", surface_type)
                    .eq("asset_id", surface_id).limit(1).execute().data or [])
        now_iso = datetime.now(timezone.utc).isoformat()
        if existing:
            ctx_blob = existing[0].get("usage_context") or {}
            ctx_blob["usage_count"]  = int(ctx_blob.get("usage_count") or 1) + 1
            ctx_blob["last_used_at"] = now_iso
            c.table("entity_operational_usage").update(
                {"usage_context": ctx_blob}).eq("id", existing[0]["id"]).execute()
        else:
            c.table("entity_operational_usage").insert({
                "tenant_id":     tenant_id,
                "entity_id":     entity_id,
                "entity_type":   ent.get("entity_type"),
                "asset_type":    surface_type,
                "asset_id":      surface_id,
                "usage_context": {"usage_count":    1,
                                   "first_used_at":  now_iso,
                                   "last_used_at":   now_iso,
                                   "brand_id":       ent.get("brand_id"),
                                   "catalog_set_id": ent.get("catalog_set_id"),
                                   "extra":          extra or {}},
                "created_by":    user_id,
            }).execute()
    except Exception as ex:
        logger.warning(f"attach_entity[operational_usage] {ex}")

    # NOTA · KE-005B.1 direttiva utente n.5:
    #   knowledge_impact_events NON viene scritto per attach/detach.
    #   Il ledger resta dedicato alle correzioni semantiche (KE-003).

    return {"ok": True, "relation": rel_row, "entity_snapshot": snapshot}


def detach_entity(*, tenant_id: str, surface_type: str, surface_id: str,
                  entity_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Reverse hook · idempotente."""
    if surface_type not in SURFACE_RELATION:
        return {"ok": False, "error": "surface_type non supportato"}
    c = db()
    rel_type = SURFACE_RELATION[surface_type]
    # 1) Remove relation (filtra tenant per safety)
    try:
        c.table("brand_entity_relations").delete() \
            .eq("tenant_id", tenant_id) \
            .eq("source_entity_id", entity_id) \
            .eq("target_entity_id", surface_id) \
            .eq("relation_type", rel_type).execute()
    except Exception as ex:
        logger.warning(f"detach[relations] {ex}")
    # 2) Decrement / delete usage counter
    try:
        existing = (c.table("entity_operational_usage")
                    .select("id,usage_context")
                    .eq("tenant_id", tenant_id)
                    .eq("entity_id", entity_id)
                    .eq("asset_type", surface_type)
                    .eq("asset_id", surface_id).limit(1).execute().data or [])
        if existing:
            ctx_blob = existing[0].get("usage_context") or {}
            new_count = max(0, int(ctx_blob.get("usage_count") or 1) - 1)
            if new_count == 0:
                c.table("entity_operational_usage").delete() \
                    .eq("id", existing[0]["id"]).execute()
            else:
                ctx_blob["usage_count"]  = new_count
                ctx_blob["last_used_at"] = datetime.now(timezone.utc).isoformat()
                c.table("entity_operational_usage").update(
                    {"usage_context": ctx_blob}).eq("id", existing[0]["id"]).execute()
    except Exception as ex:
        logger.warning(f"detach[operational_usage] {ex}")
    return {"ok": True}


def list_surface_entities(*, tenant_id: str, surface_type: str,
                           surface_id: str) -> Dict[str, Any]:
    """Ritorna le entità correntemente attaccate a una surface (tenant-safe)."""
    if surface_type not in SURFACE_RELATION:
        return {"entities": [], "count": 0}
    c = db()
    rows = (c.table("brand_entity_relations")
            .select("source_entity_id,source_type,metadata_json,created_at")
            .eq("tenant_id", tenant_id)
            .eq("target_entity_id", surface_id)
            .eq("relation_type", SURFACE_RELATION[surface_type])
            .order("created_at", desc=True).limit(500).execute().data or [])
    out = []
    for r in rows:
        snap = (r.get("metadata_json") or {}).get("snapshot") or {}
        out.append({
            "entity_id":    r["source_entity_id"],
            "entity_type":  r.get("source_type") or snap.get("type"),
            "display_name": snap.get("display_name"),
            "attached_at":  r.get("created_at"),
        })
    return {"entities": out, "count": len(out)}


def sync_entity_refs(*, tenant_id: str, surface_type: str, surface_id: str,
                      previous_ids: list, new_ids: list,
                      user_id: Optional[str] = None) -> Dict[str, Any]:
    """Diff-based reconciliation per superfici multi-entity (es. milestone
    con entity_refs JSONB). Calcola added/removed e chiama attach/detach
    per ciascuna. Idempotente.
    """
    prev = set(str(x) for x in (previous_ids or []) if x)
    new  = set(str(x) for x in (new_ids or []) if x)
    added   = new - prev
    removed = prev - new
    results = {"attached": [], "detached": [], "errors": []}
    for eid in added:
        r = attach_entity(tenant_id=tenant_id, surface_type=surface_type,
                          surface_id=surface_id, entity_id=eid, user_id=user_id)
        if r.get("ok"):
            results["attached"].append(eid)
        else:
            results["errors"].append({"entity_id": eid, "op": "attach",
                                        "error": r.get("error")})
    for eid in removed:
        r = detach_entity(tenant_id=tenant_id, surface_type=surface_type,
                          surface_id=surface_id, entity_id=eid, user_id=user_id)
        if r.get("ok"):
            results["detached"].append(eid)
        else:
            results["errors"].append({"entity_id": eid, "op": "detach",
                                        "error": r.get("error")})
    return results
