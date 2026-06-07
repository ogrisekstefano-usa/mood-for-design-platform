"""STORE-004 · Project Story™ · backend storytelling cinematico"""
from __future__ import annotations
import logging
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.tenant_context import get_tenant_context
from database import db

logger = logging.getLogger("project_stories")
router = APIRouter()


class StoryCreate(BaseModel):
    title: Optional[str] = "Project Story"
    client_name: Optional[str] = None
    project_id: Optional[str] = None
    journey_id: Optional[str] = None


class StoryPatch(BaseModel):
    title: Optional[str] = None
    client_name: Optional[str] = None
    cover_image_url: Optional[str] = None
    studio_name: Optional[str] = None
    status: Optional[str] = None
    sections: Optional[Dict[str, Any]] = None


def _now():
    return datetime.now(timezone.utc).isoformat()


def _entity_brief(c, eids: List[str]) -> Dict[str, Dict[str, Any]]:
    if not eids:
        return {}
    ents = (c.table("brand_detected_entities")
            .select("id,display_name,entity_type,brand_id,canonical_ref_id,confidence_score,attributes,source_page_ids")
            .in_("id", eids).execute().data or [])
    brand_ids = list({e.get("brand_id") for e in ents if e.get("brand_id")})
    brand_map = {}
    if brand_ids:
        brs = (c.table("brands").select("id,name")
               .in_("id", brand_ids).execute().data or [])
        brand_map = {b["id"]: b["name"] for b in brs}
    for e in ents:
        e["brand_name"] = brand_map.get(e.get("brand_id"))
    return {e["id"]: e for e in ents}


@router.get("/project-stories")
def list_stories(ctx=Depends(get_tenant_context)):
    rows = (db().table("project_stories")
            .select("id,title,client_name,status,share_token,cover_image_url,"
                    "journey_id,source_moodboard_id,source_specification_id,"
                    "created_at,updated_at")
            .eq("tenant_id", ctx["tenant_id"]).is_("deleted_at", "null")
            .order("updated_at", desc=True).limit(200).execute().data or [])
    return {"items": rows, "count": len(rows)}


@router.post("/project-stories")
def create_story(body: StoryCreate, ctx=Depends(get_tenant_context)):
    payload = {
        "tenant_id":   ctx["tenant_id"],
        "title":       body.title or "Project Story",
        "client_name": body.client_name,
        "project_id":  body.project_id,
        "journey_id":  body.journey_id,
        "share_token": secrets.token_urlsafe(16),
        "created_by":  ctx.get("profile_id"),
    }
    r = db().table("project_stories").insert(payload).execute()
    return r.data[0] if r.data else payload


@router.get("/project-stories/{story_id}")
def detail_story(story_id: str, ctx=Depends(get_tenant_context)):
    rows = (db().table("project_stories").select("*")
            .eq("id", story_id).eq("tenant_id", ctx["tenant_id"])
            .is_("deleted_at", "null").limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Project Story non trovata")
    return rows[0]


@router.patch("/project-stories/{story_id}")
def update_story(story_id: str, body: StoryPatch, ctx=Depends(get_tenant_context)):
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items()
             if v is not None}
    if not patch:
        return {"ok": True}
    patch["updated_at"] = _now()
    db().table("project_stories").update(patch) \
        .eq("id", story_id).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True}


@router.delete("/project-stories/{story_id}")
def delete_story(story_id: str, ctx=Depends(get_tenant_context)):
    db().table("project_stories").update({"deleted_at": _now()}) \
        .eq("id", story_id).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True}


@router.post("/project-stories/generate-from-specification/{spec_id}")
def generate_from_specification(spec_id: str, ctx=Depends(get_tenant_context)):
    """Genera la Project Story leggendo Specification → Material Board → Moodboard.
    Auto-popola le 6 sezioni in <5 secondi.
    """
    c = db()
    tid = ctx["tenant_id"]
    spec = (c.table("specification_packages")
            .select("id,title,project_id,journey_id,source_moodboard_id,"
                    "source_material_board_id,notes")
            .eq("id", spec_id).eq("tenant_id", tid).limit(1).execute().data or [])
    if not spec:
        raise HTTPException(404, "Specification non trovata")
    s = spec[0]
    # Items dalla specification
    items = (c.table("specification_items")
             .select("entity_id,quantity,unit,code,material_finish,price,notes,status")
             .eq("specification_id", spec_id).order("sort_order")
             .execute().data or [])
    spec_eids = [it["entity_id"] for it in items if it.get("entity_id")]
    # Moodboard source
    moodboard = None
    mb_eids = []
    if s.get("source_moodboard_id"):
        mbr = (c.table("moodboards").select("id,title")
               .eq("id", s["source_moodboard_id"]).limit(1).execute().data or [])
        if mbr:
            moodboard = mbr[0]
        blocks = (c.table("moodboard_elements")
                  .select("entity_id").eq("moodboard_id", s["source_moodboard_id"])
                  .not_.is_("entity_id", "null").execute().data or [])
        mb_eids = list({b["entity_id"] for b in blocks if b.get("entity_id")})
    # Material Board source
    matboard = None
    mat_eids = []
    if s.get("source_material_board_id"):
        mbb = (c.table("material_boards").select("id,title,template_key")
               .eq("id", s["source_material_board_id"]).limit(1).execute().data or [])
        if mbb:
            matboard = mbb[0]
        mels = (c.table("material_board_elements")
                .select("entity_id").eq("material_board_id", s["source_material_board_id"])
                .not_.is_("entity_id", "null").execute().data or [])
        mat_eids = list({e["entity_id"] for e in mels if e.get("entity_id")})
    # Hydrate entities
    all_eids = list(set(spec_eids + mb_eids + mat_eids))
    ent_map = _entity_brief(c, all_eids)
    # Project / Journey context
    project_meta = {}
    if s.get("project_id"):
        pr = (c.table("projects").select("id,title,account_name,client_name")
              .eq("id", s["project_id"]).limit(1).execute().data or [])
        if pr:
            project_meta = pr[0]
    # Build sections
    sections = {
        "cover": {
            "title":      project_meta.get("title") or s.get("title") or "Project Story",
            "client":     project_meta.get("account_name") or project_meta.get("client_name"),
            "studio":     None,  # editable
        },
        "vision": {
            "headline":    "La direzione del progetto",
            "body":        s.get("notes") or "Una visione costruita su materie, luce e proporzione · curata dal Brand Atlas.",
        },
        "moodboard": {
            "source_id":   s.get("source_moodboard_id"),
            "title":       (moodboard or {}).get("title"),
            "entity_ids":  mb_eids[:24],
        },
        "material_board": {
            "source_id":   s.get("source_material_board_id"),
            "title":       (matboard or {}).get("title"),
            "template":    (matboard or {}).get("template_key"),
            "entity_ids":  mat_eids[:24],
        },
        "selected_products": [
            {
                "entity_id":       it["entity_id"],
                "display_name":    (ent_map.get(it["entity_id"]) or {}).get("display_name"),
                "brand_name":      (ent_map.get(it["entity_id"]) or {}).get("brand_name"),
                "entity_type":     (ent_map.get(it["entity_id"]) or {}).get("entity_type"),
                "quantity":        it.get("quantity"),
                "unit":            it.get("unit"),
                "code":            it.get("code"),
                "material_finish": it.get("material_finish"),
                "status":          it.get("status"),
            }
            for it in items if it.get("entity_id") and it.get("status") not in ("removed",)
        ],
        "summary": {
            "items_count":     len(items),
            "moodboard_count": len(mb_eids),
            "material_count":  len(mat_eids),
            "closing":         "Un progetto pronto per essere abitato.",
        },
    }
    payload = {
        "tenant_id":   tid,
        "title":       f"{project_meta.get('title') or s.get('title') or 'Project'} · Project Story",
        "client_name": project_meta.get("account_name") or project_meta.get("client_name"),
        "project_id":  s.get("project_id"),
        "journey_id":  s.get("journey_id"),
        "source_moodboard_id":      s.get("source_moodboard_id"),
        "source_material_board_id": s.get("source_material_board_id"),
        "source_specification_id":  spec_id,
        "share_token": secrets.token_urlsafe(16),
        "sections":    sections,
        "status":      "draft",
        "created_by":  ctx.get("profile_id"),
    }
    r = db().table("project_stories").insert(payload).execute()
    return r.data[0] if r.data else payload


# Public share endpoint (no auth · usato dal cliente via link)
public_router = APIRouter()


@public_router.get("/story/{share_token}")
def public_story(share_token: str):
    rows = (db().table("project_stories").select("*")
            .eq("share_token", share_token)
            .is_("deleted_at", "null").limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Project Story non trovata")
    s = rows[0]
    # Hide internal fields
    s.pop("tenant_id", None)
    s.pop("created_by", None)
    return s
