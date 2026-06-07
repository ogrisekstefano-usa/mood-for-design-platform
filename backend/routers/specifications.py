"""STORE-003 · Specification Package™ · backend"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.tenant_context import get_tenant_context
from database import db

logger = logging.getLogger("specifications")
router = APIRouter()
VALID_STATUS = ("draft", "review", "approved", "ready")
VALID_ITEM_STATUS = ("proposed", "confirmed", "replaced", "removed")


class SpecCreate(BaseModel):
    title: Optional[str] = "Specification Package"
    project_id: Optional[str] = None
    journey_id: Optional[str] = None
    source_moodboard_id: Optional[str] = None
    source_material_board_id: Optional[str] = None


class SpecPatch(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ItemCreate(BaseModel):
    entity_id: str
    quantity: Optional[float] = 1
    unit: Optional[str] = "pz"
    material_finish: Optional[str] = None
    code: Optional[str] = None
    notes: Optional[str] = None
    price: Optional[float] = None


class ItemPatch(BaseModel):
    quantity: Optional[float] = None
    unit: Optional[str] = None
    material_finish: Optional[str] = None
    code: Optional[str] = None
    notes: Optional[str] = None
    price: Optional[float] = None
    status: Optional[str] = None
    sort_order: Optional[int] = None


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.get("/specifications")
def list_specs(ctx=Depends(get_tenant_context)):
    rows = (db().table("specification_packages")
            .select("id,title,status,project_id,journey_id,"
                    "source_moodboard_id,source_material_board_id,"
                    "notes,created_at,updated_at")
            .eq("tenant_id", ctx["tenant_id"]).is_("deleted_at", "null")
            .order("updated_at", desc=True).limit(200).execute().data or [])
    return {"items": rows, "count": len(rows)}


@router.post("/specifications")
def create_spec(body: SpecCreate, ctx=Depends(get_tenant_context)):
    payload = {
        "tenant_id":  ctx["tenant_id"],
        "title":      body.title or "Specification Package",
        "project_id": body.project_id,
        "journey_id": body.journey_id,
        "source_moodboard_id":      body.source_moodboard_id,
        "source_material_board_id": body.source_material_board_id,
        "created_by": ctx.get("profile_id"),
    }
    r = db().table("specification_packages").insert(payload).execute()
    return r.data[0] if r.data else payload


@router.get("/specifications/{spec_id}")
def detail_spec(spec_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    rows = (c.table("specification_packages").select("*")
            .eq("id", spec_id).eq("tenant_id", ctx["tenant_id"])
            .is_("deleted_at", "null").limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Specification non trovata")
    pkg = rows[0]
    items = (c.table("specification_items")
             .select("*").eq("specification_id", spec_id)
             .order("sort_order").limit(500).execute().data or [])
    eids = [it["entity_id"] for it in items if it.get("entity_id")]
    ent_map = {}
    if eids:
        ents = (c.table("brand_detected_entities")
                .select("id,display_name,entity_type,brand_id,canonical_ref_id,"
                        "confidence_score,attributes")
                .in_("id", eids).execute().data or [])
        # Hydrate brand name
        brand_ids = list({e.get("brand_id") for e in ents if e.get("brand_id")})
        brand_map = {}
        if brand_ids:
            brs = (c.table("brands").select("id,name")
                   .in_("id", brand_ids).execute().data or [])
            brand_map = {b["id"]: b["name"] for b in brs}
        for e in ents:
            e["brand_name"] = brand_map.get(e.get("brand_id"))
        ent_map = {e["id"]: e for e in ents}
    for it in items:
        it["entity"] = ent_map.get(it.get("entity_id"))
    return {"package": pkg, "items": items}


@router.patch("/specifications/{spec_id}")
def update_spec(spec_id: str, body: SpecPatch, ctx=Depends(get_tenant_context)):
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items()
             if v is not None}
    if "status" in patch and patch["status"] not in VALID_STATUS:
        raise HTTPException(400, f"status non valido. Usa {VALID_STATUS}")
    if not patch:
        return {"ok": True}
    patch["updated_at"] = _now()
    db().table("specification_packages").update(patch) \
        .eq("id", spec_id).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True}


@router.delete("/specifications/{spec_id}")
def delete_spec(spec_id: str, ctx=Depends(get_tenant_context)):
    db().table("specification_packages").update({"deleted_at": _now()}) \
        .eq("id", spec_id).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True}


@router.post("/specifications/{spec_id}/items")
def add_item(spec_id: str, body: ItemCreate, ctx=Depends(get_tenant_context)):
    c = db()
    own = (c.table("specification_packages").select("id")
           .eq("id", spec_id).eq("tenant_id", ctx["tenant_id"])
           .limit(1).execute().data or [])
    if not own:
        raise HTTPException(404, "Specification non trovata")
    payload = {
        "tenant_id":       ctx["tenant_id"],
        "specification_id": spec_id,
        "entity_id":       body.entity_id,
        "quantity":        body.quantity or 1,
        "unit":            body.unit or "pz",
        "material_finish": body.material_finish,
        "code":            body.code,
        "notes":           body.notes,
        "price":           body.price,
    }
    r = c.table("specification_items").insert(payload).execute()
    return r.data[0] if r.data else payload


@router.patch("/specifications/{spec_id}/items/{iid}")
def update_item(spec_id: str, iid: str, body: ItemPatch,
                 ctx=Depends(get_tenant_context)):
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items()
             if v is not None}
    if "status" in patch and patch["status"] not in VALID_ITEM_STATUS:
        raise HTTPException(400, f"status item non valido. Usa {VALID_ITEM_STATUS}")
    if not patch:
        return {"ok": True}
    patch["updated_at"] = _now()
    db().table("specification_items").update(patch) \
        .eq("id", iid).eq("specification_id", spec_id) \
        .eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True}


@router.delete("/specifications/{spec_id}/items/{iid}")
def delete_item(spec_id: str, iid: str, ctx=Depends(get_tenant_context)):
    db().table("specification_items").delete() \
        .eq("id", iid).eq("specification_id", spec_id) \
        .eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True}


def _populate_from_entity_ids(c, spec_id: str, tenant_id: str,
                               entity_ids: List[str]) -> int:
    if not entity_ids:
        return 0
    for i, eid in enumerate(entity_ids):
        c.table("specification_items").insert({
            "tenant_id":       tenant_id,
            "specification_id": spec_id,
            "entity_id":       eid,
            "quantity":        1,
            "unit":            "pz",
            "status":          "proposed",
            "sort_order":      i,
        }).execute()
    return len(entity_ids)


@router.post("/specifications/convert-from-moodboard/{moodboard_id}")
def convert_from_moodboard(moodboard_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    mb = (c.table("moodboards").select("id,title,project_id,journey_id")
          .eq("id", moodboard_id).eq("tenant_id", ctx["tenant_id"])
          .limit(1).execute().data or [])
    if not mb:
        raise HTTPException(404, "Moodboard non trovata")
    mb_row = mb[0]
    blocks = (c.table("moodboard_elements")
              .select("entity_id").eq("moodboard_id", moodboard_id)
              .not_.is_("entity_id", "null").execute().data or [])
    eids = list({b["entity_id"] for b in blocks if b.get("entity_id")})
    new_spec = c.table("specification_packages").insert({
        "tenant_id":  ctx["tenant_id"],
        "title":      f"{mb_row.get('title') or 'Moodboard'} · Specification",
        "project_id": mb_row.get("project_id"),
        "journey_id": mb_row.get("journey_id"),
        "source_moodboard_id": moodboard_id,
        "created_by": ctx.get("profile_id"),
    }).execute().data[0]
    n = _populate_from_entity_ids(c, new_spec["id"], ctx["tenant_id"], eids)
    return {"package": new_spec, "items_count": n}


@router.post("/specifications/convert-from-material-board/{board_id}")
def convert_from_material_board(board_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    mb = (c.table("material_boards")
          .select("id,title,project_id,journey_id,source_moodboard_id")
          .eq("id", board_id).eq("tenant_id", ctx["tenant_id"])
          .limit(1).execute().data or [])
    if not mb:
        raise HTTPException(404, "Material Board non trovata")
    row = mb[0]
    els = (c.table("material_board_elements")
           .select("entity_id").eq("material_board_id", board_id)
           .not_.is_("entity_id", "null").execute().data or [])
    eids = list({e["entity_id"] for e in els if e.get("entity_id")})
    new_spec = c.table("specification_packages").insert({
        "tenant_id":  ctx["tenant_id"],
        "title":      f"{row.get('title') or 'Material Board'} · Specification",
        "project_id": row.get("project_id"),
        "journey_id": row.get("journey_id"),
        "source_moodboard_id":      row.get("source_moodboard_id"),
        "source_material_board_id": board_id,
        "created_by": ctx.get("profile_id"),
    }).execute().data[0]
    n = _populate_from_entity_ids(c, new_spec["id"], ctx["tenant_id"], eids)
    return {"package": new_spec, "items_count": n}
