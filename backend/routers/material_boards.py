"""STORE-002 · Material Board Studio™ · backend router

Surface knowledge-native (KE-005B.2 compliant):
  · Ogni element punta a un entity_id (canonical Brand Atlas)
  · Riusa services/knowledge_usage_hooks per attach/detach
  · Riusa schema brand_entity_relations + entity_operational_usage

Endpoint:
  GET    /material-boards                     list per tenant
  POST   /material-boards                     create
  GET    /material-boards/{id}                detail (board + elements)
  PATCH  /material-boards/{id}                update meta (title, template, status)
  DELETE /material-boards/{id}                soft delete
  POST   /material-boards/{id}/elements       add (entity_id required)
  PATCH  /material-boards/{id}/elements/{eid} update (position, annotation)
  DELETE /material-boards/{id}/elements/{eid} remove
  POST   /material-boards/convert-from-moodboard/{moodboard_id}
                                              clone material/finish entities da una moodboard
  GET    /material-boards/{id}/palette        palette automatica (basata su entità)

Template:
  residential · kitchen · hospitality · retail · outdoor · luxury
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.tenant_context import get_tenant_context
from database import db
from services import knowledge_usage_hooks as hooks

logger = logging.getLogger("material_boards")
router = APIRouter()

VALID_TEMPLATES = ("residential", "kitchen", "hospitality", "retail", "outdoor", "luxury")
SURFACE = "material_board"


class MaterialBoardCreate(BaseModel):
    title:               Optional[str] = "Material Board"
    template_key:        Optional[str] = "residential"
    project_id:          Optional[str] = None
    journey_id:          Optional[str] = None
    source_moodboard_id: Optional[str] = None


class MaterialBoardPatch(BaseModel):
    title:        Optional[str] = None
    template_key: Optional[str] = None
    status:       Optional[str] = None
    palette:      Optional[List[Dict[str, Any]]] = None


class ElementCreate(BaseModel):
    entity_id:  str
    x:          Optional[float] = 60
    y:          Optional[float] = 60
    width:      Optional[float] = 220
    height:     Optional[float] = 260
    z_index:    Optional[int] = 0
    annotation: Optional[str] = None


class ElementPatch(BaseModel):
    x:          Optional[float] = None
    y:          Optional[float] = None
    width:      Optional[float] = None
    height:     Optional[float] = None
    z_index:    Optional[int] = None
    annotation: Optional[str] = None


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.get("/material-boards")
def list_boards(ctx=Depends(get_tenant_context)):
    rows = (db().table("material_boards")
            .select("id,title,template_key,status,project_id,journey_id,"
                    "source_moodboard_id,palette,created_at,updated_at")
            .eq("tenant_id", ctx["tenant_id"]).is_("deleted_at", "null")
            .order("updated_at", desc=True).limit(200).execute().data or [])
    return {"items": rows, "count": len(rows)}


@router.post("/material-boards")
def create_board(body: MaterialBoardCreate, ctx=Depends(get_tenant_context)):
    tpl = body.template_key or "residential"
    if tpl not in VALID_TEMPLATES:
        raise HTTPException(400, f"template_key non valido. Usa: {VALID_TEMPLATES}")
    payload = {
        "tenant_id":   ctx["tenant_id"],
        "title":       body.title or "Material Board",
        "template_key": tpl,
        "project_id":  body.project_id,
        "journey_id":  body.journey_id,
        "source_moodboard_id": body.source_moodboard_id,
        "created_by":  ctx.get("profile_id"),
    }
    r = db().table("material_boards").insert(payload).execute()
    return r.data[0] if r.data else payload


@router.get("/material-boards/{board_id}")
def detail_board(board_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    rows = (c.table("material_boards").select("*")
            .eq("id", board_id).eq("tenant_id", ctx["tenant_id"])
            .is_("deleted_at", "null").limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Material Board non trovata")
    board = rows[0]
    elements = (c.table("material_board_elements")
                .select("id,entity_id,position_json,annotation,sort_order,metadata,created_at")
                .eq("material_board_id", board_id)
                .order("sort_order").limit(500).execute().data or [])
    # Hydrate entities snapshot
    eids = [e["entity_id"] for e in elements if e.get("entity_id")]
    ent_map = {}
    if eids:
        ent_rows = (c.table("brand_detected_entities")
                    .select("id,display_name,entity_type,brand_id,canonical_ref_id,confidence_score")
                    .in_("id", eids).execute().data or [])
        ent_map = {e["id"]: e for e in ent_rows}
    for el in elements:
        el["entity"] = ent_map.get(el.get("entity_id"))
    return {"board": board, "elements": elements}


@router.patch("/material-boards/{board_id}")
def update_board(board_id: str, body: MaterialBoardPatch,
                  ctx=Depends(get_tenant_context)):
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items()
             if v is not None}
    if not patch:
        return {"ok": True}
    if "template_key" in patch and patch["template_key"] not in VALID_TEMPLATES:
        raise HTTPException(400, "template_key non valido")
    patch["updated_at"] = _now()
    db().table("material_boards").update(patch) \
        .eq("id", board_id).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True}


@router.delete("/material-boards/{board_id}")
def delete_board(board_id: str, ctx=Depends(get_tenant_context)):
    db().table("material_boards").update({"deleted_at": _now()}) \
        .eq("id", board_id).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True}


@router.post("/material-boards/{board_id}/elements")
def add_element(board_id: str, body: ElementCreate,
                 ctx=Depends(get_tenant_context)):
    c = db()
    # Guard board ownership
    own = (c.table("material_boards").select("id")
           .eq("id", board_id).eq("tenant_id", ctx["tenant_id"])
           .limit(1).execute().data or [])
    if not own:
        raise HTTPException(404, "Material Board non trovata")
    payload = {
        "tenant_id":         ctx["tenant_id"],
        "material_board_id": board_id,
        "entity_id":         body.entity_id,
        "position_json":     {"x": body.x, "y": body.y,
                                "width": body.width, "height": body.height,
                                "z_index": body.z_index or 0},
        "annotation":        body.annotation,
    }
    r = c.table("material_board_elements").insert(payload).execute()
    # KE-005B hook
    try:
        hooks.attach_entity(tenant_id=ctx["tenant_id"], surface_type=SURFACE,
                            surface_id=board_id, entity_id=body.entity_id,
                            user_id=ctx.get("profile_id"))
    except Exception as ex:
        logger.warning(f"attach_entity fallita: {ex}")
    return r.data[0] if r.data else payload


@router.patch("/material-boards/{board_id}/elements/{eid}")
def update_element(board_id: str, eid: str, body: ElementPatch,
                    ctx=Depends(get_tenant_context)):
    c = db()
    cur = (c.table("material_board_elements").select("position_json,annotation")
           .eq("id", eid).eq("material_board_id", board_id)
           .eq("tenant_id", ctx["tenant_id"]).limit(1).execute().data or [])
    if not cur:
        raise HTTPException(404, "Element non trovato")
    pos = cur[0].get("position_json") or {}
    body_d = body.model_dump(exclude_none=True)
    for k in ("x", "y", "width", "height", "z_index"):
        if k in body_d:
            pos[k] = body_d.pop(k)
    patch = {"position_json": pos, "updated_at": _now()}
    if "annotation" in body_d:
        patch["annotation"] = body_d["annotation"]
    c.table("material_board_elements").update(patch).eq("id", eid).execute()
    return {"ok": True}


@router.delete("/material-boards/{board_id}/elements/{eid}")
def delete_element(board_id: str, eid: str, ctx=Depends(get_tenant_context)):
    c = db()
    cur = (c.table("material_board_elements").select("entity_id")
           .eq("id", eid).eq("material_board_id", board_id)
           .eq("tenant_id", ctx["tenant_id"]).limit(1).execute().data or [])
    if not cur:
        return {"ok": True}
    entity_id = cur[0].get("entity_id")
    c.table("material_board_elements").delete().eq("id", eid).execute()
    if entity_id:
        try:
            hooks.detach_entity(tenant_id=ctx["tenant_id"], surface_type=SURFACE,
                                surface_id=board_id, entity_id=entity_id,
                                user_id=ctx.get("profile_id"))
        except Exception as ex:
            logger.warning(f"detach_entity fallita: {ex}")
    return {"ok": True}


@router.post("/material-boards/convert-from-moodboard/{moodboard_id}")
def convert_from_moodboard(moodboard_id: str, ctx=Depends(get_tenant_context)):
    """Crea una Material Board pre-popolata con le entità material/finish
    della moodboard. NO snapshot · solo entity_id refs.
    """
    c = db()
    mb = (c.table("moodboards").select("id,title,project_id,journey_id,tenant_id")
          .eq("id", moodboard_id).eq("tenant_id", ctx["tenant_id"])
          .limit(1).execute().data or [])
    if not mb:
        raise HTTPException(404, "Moodboard non trovata")
    mb_row = mb[0]
    # Estrai entità material/finish dai block della moodboard
    blocks = (c.table("moodboard_elements")
              .select("entity_id,type").eq("moodboard_id", moodboard_id)
              .not_.is_("entity_id", "null").execute().data or [])
    entity_ids = [b["entity_id"] for b in blocks if b.get("entity_id")]
    material_ids: List[str] = []
    if entity_ids:
        ents = (c.table("brand_detected_entities")
                .select("id,entity_type").in_("id", entity_ids)
                .in_("entity_type", ["material", "finish"]).execute().data or [])
        material_ids = [e["id"] for e in ents]
    # Create new Material Board
    new_board = c.table("material_boards").insert({
        "tenant_id":         ctx["tenant_id"],
        "title":             f"{mb_row.get('title') or 'Moodboard'} · Material Board",
        "template_key":      "residential",
        "project_id":        mb_row.get("project_id"),
        "journey_id":        mb_row.get("journey_id"),
        "source_moodboard_id": moodboard_id,
        "created_by":        ctx.get("profile_id"),
    }).execute().data[0]
    # Pre-populate elements + hooks
    for i, eid in enumerate(material_ids):
        x = 60 + (i % 4) * 240
        y = 60 + (i // 4) * 280
        c.table("material_board_elements").insert({
            "tenant_id":         ctx["tenant_id"],
            "material_board_id": new_board["id"],
            "entity_id":         eid,
            "position_json":     {"x": x, "y": y, "width": 220, "height": 260, "z_index": i},
            "sort_order":        i,
        }).execute()
        try:
            hooks.attach_entity(tenant_id=ctx["tenant_id"], surface_type=SURFACE,
                                surface_id=new_board["id"], entity_id=eid,
                                user_id=ctx.get("profile_id"))
        except Exception:
            pass
    return {"board": new_board, "materials_count": len(material_ids)}


@router.get("/material-boards/{board_id}/palette")
def auto_palette(board_id: str, ctx=Depends(get_tenant_context)):
    """Palette automatica · per ora basa sui colori salvati nelle entità."""
    c = db()
    els = (c.table("material_board_elements").select("entity_id")
           .eq("material_board_id", board_id)
           .eq("tenant_id", ctx["tenant_id"]).execute().data or [])
    eids = [e["entity_id"] for e in els if e.get("entity_id")]
    if not eids:
        return {"palette": []}
    ents = (c.table("brand_detected_entities")
            .select("display_name,attributes").in_("id", eids).execute().data or [])
    colors: List[Dict[str, Any]] = []
    for e in ents:
        attrs = e.get("attributes") or {}
        col = attrs.get("color") or attrs.get("hex") or attrs.get("palette")
        if col:
            colors.append({"name": e.get("display_name"), "color": col})
    return {"palette": colors[:8]}
