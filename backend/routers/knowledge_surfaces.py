"""KE-005B · Knowledge-Native Surfaces · public API
Endpoint shared:
  GET  /knowledge/entities/search?type=&q=&brand_id=&limit=
  POST /surfaces/{type}/{id}/attach     {entity_id}
  POST /surfaces/{type}/{id}/detach     {entity_id}
  GET  /surfaces/{type}/{id}/entities
"""
from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import db
from core.tenant_context import get_tenant_context
from services import knowledge_usage_hooks as hooks

router = APIRouter()


@router.get("/knowledge/entities/search")
def search_entities(type: Optional[str] = None, q: Optional[str] = None,
                     brand_id: Optional[str] = None,
                     catalog_set_id: Optional[str] = None,
                     limit: int = 30,
                     ctx=Depends(get_tenant_context)):
    """Typeahead su `brand_detected_entities`. Filtra per
    entity_type (product/material/designer/image/brand/collection) e
    matchea su `display_name` (ILIKE)."""
    c = db()
    q_ = (c.table("brand_detected_entities")
          .select("id,entity_type,display_name,confidence_score,status,"
                   "mention_count,brand_id,catalog_set_id,canonical_ref_id,aliases")
          .eq("tenant_id", ctx["tenant_id"]))
    if type:
        # accept multiple comma-separated
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


class AttachBody(BaseModel):
    entity_id: str
    block_id: Optional[str] = None       # moodboard block (optional)
    milestone_id: Optional[str] = None   # journey milestone (optional)


@router.post("/surfaces/{surface_type}/{surface_id}/attach")
def attach(surface_type: str, surface_id: str, body: AttachBody,
            ctx=Depends(get_tenant_context)):
    res = hooks.attach_entity(
        tenant_id=ctx["tenant_id"], surface_type=surface_type,
        surface_id=surface_id, entity_id=body.entity_id,
        user_id=ctx.get("user_id"),
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
        user_id=ctx.get("user_id"),
    )
    return res


@router.get("/surfaces/{surface_type}/{surface_id}/entities")
def list_entities(surface_type: str, surface_id: str,
                   ctx=Depends(get_tenant_context)):
    return hooks.list_surface_entities(
        surface_type=surface_type, surface_id=surface_id)
