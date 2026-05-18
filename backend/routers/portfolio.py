"""Phase S-CONNECT Step 3 — Portfolio (Projects Studio™) router.

Public + admin endpoints for the Portfolio Cultural Adaptation Studio.
NOT a project manager — pure cultural reinterpretation surface.

Admin (requires tenant_admin / super_admin):
  GET  /api/portfolio/admin/projects                  list masters + variant counts
  POST /api/portfolio/admin/projects                  create master
  GET  /api/portfolio/admin/projects/{id}             read master + variants
  PATCH /api/portfolio/admin/projects/{id}            update master
  DELETE /api/portfolio/admin/projects/{id}           delete master + variants
  POST /api/portfolio/admin/projects/{id}/publish     publish master
  PATCH /api/portfolio/admin/variants/{vid}           update variant (inline editing)
  POST /api/portfolio/admin/variants/{vid}/publish    publish variant
  POST /api/portfolio/admin/projects/{id}/compose     compose variant for a market
                                                       body: { market_id }

Public:
  GET /api/portfolio/public/{tenant_slug}/projects    list published variants
  GET /api/portfolio/public/{tenant_slug}/{slug}      detail for a slug+locale

Internal Translation safety: this module does NOT serve any review-only
content. There is no "internal translation" concept on portfolio — all
variants are public-facing.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from database import db
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_admin(user: Dict[str, Any]) -> str:
    role = (user.get("role") or "").lower()
    if role not in {"tenant_admin", "super_admin"}:
        raise HTTPException(403, "admin only")
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(403, "no tenant")
    return tenant_id


def _tenant_id_from_slug(slug: str) -> Optional[str]:
    r = db().table("tenants").select("id").eq("slug", slug).limit(1).execute().data or []
    return r[0]["id"] if r else None


# ─── Pydantic ─────────────────────────────────────────────────────
class MasterCreate(BaseModel):
    slug: str
    title: str
    category: Optional[str] = None
    subtitle: Optional[str] = None
    story_body: Optional[List[Dict[str, Any]]] = None
    gallery: Optional[List[Dict[str, Any]]] = None
    cover_image_url: Optional[str] = None
    client: Optional[str] = None
    location: Optional[str] = None
    year: Optional[int] = None
    material_palette: Optional[List[str]] = None
    default_locale: Optional[str] = "it-IT"


class MasterPatch(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    subtitle: Optional[str] = None
    story_body: Optional[List[Dict[str, Any]]] = None
    gallery: Optional[List[Dict[str, Any]]] = None
    cover_image_url: Optional[str] = None
    client: Optional[str] = None
    location: Optional[str] = None
    year: Optional[int] = None
    material_palette: Optional[List[str]] = None
    default_locale: Optional[str] = None


class VariantPatch(BaseModel):
    variant_title: Optional[str] = None
    cultural_angle: Optional[str] = None
    material_language: Optional[Dict[str, Any]] = None
    hospitality_tone: Optional[str] = None
    aspirational_narrative: Optional[str] = None
    luxury_perception: Optional[str] = None
    story_body: Optional[List[Dict[str, Any]]] = None
    gallery_overrides: Optional[Dict[str, Any]] = None
    cta_set: Optional[List[Dict[str, Any]]] = None
    seo: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


class ComposeBody(BaseModel):
    market_id: str


# ─── Admin ────────────────────────────────────────────────────────
@router.get("/admin/projects")
def list_masters(user: Dict[str, Any] = Depends(get_current_user)):
    tid = _require_admin(user)
    c = db()
    masters = (c.table("portfolio_projects").select("*")
               .eq("tenant_id", tid).order("created_at", desc=True).execute().data or [])
    if not masters:
        return {"projects": [], "total": 0}
    ids = [m["id"] for m in masters]
    variants = (c.table("portfolio_project_variants")
                .select("id,master_id,target_locale,market_code,status,is_published")
                .in_("master_id", ids).execute().data or [])
    by_master: Dict[str, List[Dict[str, Any]]] = {}
    for v in variants:
        by_master.setdefault(v["master_id"], []).append(v)
    for m in masters:
        m["variants"] = by_master.get(m["id"], [])
        m["variant_count"] = len(m["variants"])
    return {"projects": masters, "total": len(masters)}


@router.post("/admin/projects")
def create_master(body: MasterCreate, user: Dict[str, Any] = Depends(get_current_user)):
    tid = _require_admin(user)
    c = db()
    row = body.model_dump(exclude_none=True)
    row.update({"tenant_id": tid, "updated_at": _iso(), "created_at": _iso()})
    ins = c.table("portfolio_projects").insert(row).execute()
    return (ins.data or [{}])[0]


@router.get("/admin/projects/{master_id}")
def read_master(master_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    tid = _require_admin(user)
    c = db()
    m = (c.table("portfolio_projects").select("*")
         .eq("id", master_id).eq("tenant_id", tid).limit(1).execute().data or [])
    if not m:
        raise HTTPException(404, "master not found")
    v = (c.table("portfolio_project_variants").select("*")
         .eq("master_id", master_id).order("target_locale").execute().data or [])
    return {"master": m[0], "variants": v}


@router.patch("/admin/projects/{master_id}")
def patch_master(master_id: str, patch: MasterPatch, user: Dict[str, Any] = Depends(get_current_user)):
    tid = _require_admin(user)
    body = patch.model_dump(exclude_none=True)
    if not body:
        raise HTTPException(400, "empty patch")
    body["updated_at"] = _iso()
    c = db()
    r = (c.table("portfolio_projects").update(body)
         .eq("id", master_id).eq("tenant_id", tid).execute().data or [])
    if not r:
        raise HTTPException(404, "master not found")
    return r[0]


@router.delete("/admin/projects/{master_id}")
def delete_master(master_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    tid = _require_admin(user)
    c = db()
    c.table("portfolio_projects").delete().eq("id", master_id).eq("tenant_id", tid).execute()
    return {"ok": True}


@router.post("/admin/projects/{master_id}/publish")
def publish_master(master_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    tid = _require_admin(user)
    c = db()
    r = (c.table("portfolio_projects").update({
        "is_published": True, "status": "published",
        "published_at": _iso(), "updated_at": _iso(),
    }).eq("id", master_id).eq("tenant_id", tid).execute().data or [])
    if not r:
        raise HTTPException(404, "master not found")
    return r[0]


@router.patch("/admin/variants/{variant_id}")
def patch_variant(variant_id: str, patch: VariantPatch, user: Dict[str, Any] = Depends(get_current_user)):
    tid = _require_admin(user)
    body = patch.model_dump(exclude_none=True)
    if not body:
        raise HTTPException(400, "empty patch")
    body["updated_at"] = _iso()
    c = db()
    r = (c.table("portfolio_project_variants").update(body)
         .eq("id", variant_id).eq("tenant_id", tid).execute().data or [])
    if not r:
        raise HTTPException(404, "variant not found")
    return r[0]


@router.post("/admin/variants/{variant_id}/publish")
def publish_variant(variant_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    tid = _require_admin(user)
    c = db()
    r = (c.table("portfolio_project_variants").update({
        "is_published": True, "status": "published",
        "published_at": _iso(), "updated_at": _iso(),
    }).eq("id", variant_id).eq("tenant_id", tid).execute().data or [])
    if not r:
        raise HTTPException(404, "variant not found")
    return r[0]


@router.post("/admin/projects/{master_id}/compose")
async def compose_variant(master_id: str, body: ComposeBody, user: Dict[str, Any] = Depends(get_current_user)):
    """Compose Market Edition — cultural reinterpretation, NOT translation."""
    tid = _require_admin(user)
    from services.project_market_composer import compose_market_edition
    res = await compose_market_edition(master_id=master_id, market_id=body.market_id, tenant_id=tid)
    if not res.get("ok"):
        raise HTTPException(502, res.get("error") or "compose failed")
    return res


# ─── Public ───────────────────────────────────────────────────────
def _shape_variant_public(v: Dict[str, Any], master: Dict[str, Any]) -> Dict[str, Any]:
    # Build the public-facing portfolio article shape. Resolve gallery
    # overrides ON TOP of the master gallery (no duplicate images).
    gallery_master = master.get("gallery") or []
    overrides = v.get("gallery_overrides") or {}
    hero_id = overrides.get("hero_image_id")
    captions = overrides.get("captions_by_id") or {}
    ordered = list(gallery_master)
    if hero_id:
        ordered.sort(key=lambda g: 0 if g.get("id") == hero_id else 1)
    for g in ordered:
        gid = g.get("id")
        if gid and gid in captions:
            g["caption"] = captions[gid]
    return {
        "id":                    v["id"],
        "master_id":             v["master_id"],
        "slug":                  master.get("slug"),
        "title":                 v.get("variant_title") or master.get("title"),
        "subtitle":              master.get("subtitle"),
        "cultural_angle":        v.get("cultural_angle"),
        "material_language":     v.get("material_language") or {},
        "hospitality_tone":      v.get("hospitality_tone"),
        "aspirational_narrative":v.get("aspirational_narrative"),
        "luxury_perception":     v.get("luxury_perception"),
        "story_body":            v.get("story_body") or [],
        "gallery":               ordered,
        "cover_image_url":       master.get("cover_image_url"),
        "cta_set":               v.get("cta_set") or [],
        "seo":                   v.get("seo") or {},
        "client":                master.get("client"),
        "location":              master.get("location"),
        "year":                  master.get("year"),
        "category":              master.get("category"),
        "material_palette":      master.get("material_palette") or [],
        "target_locale":         v.get("target_locale"),
        "market_code":           v.get("market_code"),
        "published_at":          v.get("published_at"),
    }


@router.get("/public/{tenant_slug}/projects")
def list_public_projects(tenant_slug: str, locale_code: Optional[str] = None):
    tid = _tenant_id_from_slug(tenant_slug)
    if not tid:
        raise HTTPException(404, "tenant not found")
    c = db()
    masters = (c.table("portfolio_projects").select("*")
               .eq("tenant_id", tid).eq("is_published", True).execute().data or [])
    if not masters:
        return {"projects": [], "total": 0}
    master_by_id = {m["id"]: m for m in masters}
    qb = (c.table("portfolio_project_variants").select("*")
          .eq("tenant_id", tid).eq("is_published", True)
          .in_("master_id", list(master_by_id.keys())))
    if locale_code:
        qb = qb.eq("target_locale", locale_code)
    variants = qb.execute().data or []
    out = []
    seen_masters = set()
    for v in variants:
        m = master_by_id.get(v["master_id"])
        if not m:
            continue
        seen_masters.add(m["id"])
        out.append(_shape_variant_public(v, m))
    # masters without a published variant in this locale → omit. The
    # frontend can fallback to a different locale via slug_map.
    return {"projects": out, "total": len(out)}


@router.get("/public/{tenant_slug}/{project_slug}")
def public_detail(tenant_slug: str, project_slug: str, locale_code: Optional[str] = None):
    tid = _tenant_id_from_slug(tenant_slug)
    if not tid:
        raise HTTPException(404, "tenant not found")
    c = db()
    master = (c.table("portfolio_projects").select("*")
              .eq("tenant_id", tid).eq("slug", project_slug)
              .eq("is_published", True).limit(1).execute().data or [])
    if not master:
        raise HTTPException(404, "project not found")
    master = master[0]
    # Resolve variant: exact locale → any published.
    variant = None
    if locale_code:
        rows = (c.table("portfolio_project_variants").select("*")
                .eq("master_id", master["id"]).eq("target_locale", locale_code)
                .eq("is_published", True).limit(1).execute().data or [])
        if rows:
            variant = rows[0]
    if not variant:
        rows = (c.table("portfolio_project_variants").select("*")
                .eq("master_id", master["id"]).eq("is_published", True)
                .order("published_at", desc=True).limit(1).execute().data or [])
        if rows:
            variant = rows[0]
    if not variant:
        # Master is published but no variant yet: serve the master as-is.
        return {"project": {
            "id": master["id"], "slug": master["slug"], "title": master["title"],
            "subtitle": master.get("subtitle"), "story_body": master.get("story_body") or [],
            "gallery": master.get("gallery") or [], "cover_image_url": master.get("cover_image_url"),
            "client": master.get("client"), "location": master.get("location"),
            "year": master.get("year"), "category": master.get("category"),
            "material_palette": master.get("material_palette") or [],
            "target_locale": master.get("default_locale"), "market_code": None,
            "_source": "master_only",
        }}
    return {"project": _shape_variant_public(variant, master)}
