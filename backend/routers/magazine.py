"""Magazine engine — Phase Y.1 + Y.2 lite + Y.3 (save reference).

Editorial lead-generation core. Project-driven, NEVER product-driven.

Endpoints
─────────
PUBLIC (anonymous-friendly — published articles only)
    GET  /api/magazine/public/{tenant_slug}/articles
    GET  /api/magazine/public/{tenant_slug}/articles/{slug}
    POST /api/magazine/public/{tenant_slug}/save-reference
        body: { hotspot_id?, article_id, locale, lead?: {email, first_name, ...} }

ADMIN (tenant_admin / super_admin)
    GET    /api/magazine/admin/articles
    POST   /api/magazine/admin/articles
    PATCH  /api/magazine/admin/articles/{id}
    DELETE /api/magazine/admin/articles/{id}
    POST   /api/magazine/admin/articles/{id}/publish
    POST   /api/magazine/admin/articles/{id}/hotspots
    PATCH  /api/magazine/admin/hotspots/{id}
    DELETE /api/magazine/admin/hotspots/{id}

ASSIGNEE / ADMIN
    GET    /api/magazine/admin/references-queue
    PATCH  /api/magazine/admin/references-queue/{id}

CLIENT (logged-in client only)
    POST   /api/magazine/client/save-reference
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from database import db

router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_admin(role: str) -> bool:
    return (role or "").lower() in {"tenant_admin", "super_admin"}


# ─── helpers ────────────────────────────────────────────────────────────

def _tenant_id_from_slug(slug: str) -> Optional[str]:
    c = db()
    r = c.table("tenants").select("id").eq("slug", slug).limit(1).execute()
    return r.data[0]["id"] if r.data else None


def _strip_internal(row: Dict[str, Any]) -> Dict[str, Any]:
    row.pop("_id", None)
    return row


def _serialize_article(row: Dict[str, Any], with_hotspots: bool = False) -> Dict[str, Any]:
    out = _strip_internal(dict(row))
    if with_hotspots:
        hs = (db().table("article_hotspots")
              .select("*").eq("article_id", row["id"]).eq("visible", True)
              .order("sort_order").execute())
        out["hotspots"] = [_strip_internal(h) for h in (hs.data or [])]
    return out


# ─── PUBLIC routes ──────────────────────────────────────────────────────

@router.get("/public/{tenant_slug}/articles")
def public_articles(tenant_slug: str,
                    locale: Optional[str] = None,
                    category: Optional[str] = None,
                    limit: int = Query(20, ge=1, le=60)):
    """Anonymous-friendly list of *published* tenant articles, newest first."""
    tid = _tenant_id_from_slug(tenant_slug)
    if not tid:
        raise HTTPException(404, "tenant not found")
    c = db()
    q = (c.table("magazine_articles")
         .select("id,slug,cover_url,hero_url,locale_content,category_slug,tags,reading_minutes,published_at,view_count,save_count")
         .eq("tenant_id", tid).eq("status", "published")
         .order("published_at", desc=True).limit(limit))
    if category:
        q = q.eq("category_slug", category)
    r = q.execute()
    items = [_strip_internal(x) for x in (r.data or [])]
    return {"articles": items, "tenant": {"slug": tenant_slug}}


@router.get("/public/{tenant_slug}/articles/{slug}")
def public_article_detail(tenant_slug: str, slug: str):
    tid = _tenant_id_from_slug(tenant_slug)
    if not tid:
        raise HTTPException(404, "tenant not found")
    c = db()
    r = (c.table("magazine_articles").select("*")
         .eq("tenant_id", tid).eq("slug", slug).eq("status", "published")
         .limit(1).execute())
    if not r.data:
        raise HTTPException(404, "article not found")
    article = _serialize_article(r.data[0], with_hotspots=True)
    # Best-effort view counter
    try:
        c.table("magazine_articles").update(
            {"view_count": (article.get("view_count") or 0) + 1}
        ).eq("id", article["id"]).execute()
    except Exception:
        pass
    return {"article": article}


class PublicSaveReferenceBody(BaseModel):
    article_id: str
    hotspot_id: Optional[str] = None
    locale: Optional[str] = "it"
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    reference_type: Optional[str] = None
    # soft lead (anonymous capture)
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    project_type: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    referrer: Optional[str] = None
    utm: Optional[Dict[str, Any]] = None


@router.post("/public/{tenant_slug}/save-reference", status_code=201)
def public_save_reference(tenant_slug: str, body: PublicSaveReferenceBody):
    """Anonymous "Save this reference" flow.

    Creates (or reuses) a `magazine_anonymous_leads` row and immediately
    inserts a `moodboard_candidates` row attributed to that lead. When
    the visitor later completes onboarding the lead is reconciled into
    a real profile and the candidate is rebound.
    """
    tid = _tenant_id_from_slug(tenant_slug)
    if not tid:
        raise HTTPException(404, "tenant not found")
    if not body.email:
        raise HTTPException(400, "email required for anonymous save")

    c = db()
    # Verify article belongs to this tenant
    art = (c.table("magazine_articles").select("id,tenant_id")
           .eq("id", body.article_id).eq("tenant_id", tid).limit(1).execute())
    if not art.data:
        raise HTTPException(404, "article not in tenant scope")
    hotspot = None
    if body.hotspot_id:
        h = (c.table("article_hotspots").select("*")
             .eq("id", body.hotspot_id).eq("tenant_id", tid).limit(1).execute())
        hotspot = h.data[0] if h.data else None

    # Soft lead
    lead_id = str(uuid.uuid4())
    c.table("magazine_anonymous_leads").insert({
        "id": lead_id, "tenant_id": tid,
        "email": body.email, "first_name": body.first_name, "last_name": body.last_name,
        "project_type": body.project_type, "city": body.city, "country": body.country,
        "source_article_id": body.article_id, "source_hotspot_id": body.hotspot_id,
        "source_locale": body.locale, "source_referrer": body.referrer,
        "source_utm": body.utm or {},
    }).execute()

    # Candidate snapshot
    cand_id = str(uuid.uuid4())
    snap_title = body.title or (hotspot or {}).get("locale_content", {}).get(body.locale or "it", {}).get("label") or "Design reference"
    snap_image = body.image_url or (hotspot or {}).get("image_url")
    snap_ref   = body.reference_type or (hotspot or {}).get("reference_type") or "atmosphere"
    c.table("moodboard_candidates").insert({
        "id": cand_id, "tenant_id": tid,
        "anonymous_lead_id": lead_id,
        "source_type": "article_hotspot" if body.hotspot_id else "article",
        "source_id": body.hotspot_id or body.article_id,
        "source_article_id": body.article_id, "source_hotspot_id": body.hotspot_id,
        "title": snap_title, "description": body.description, "image_url": snap_image,
        "reference_type": snap_ref, "status": "saved",
        "source_locale": body.locale, "source_referrer": body.referrer,
        "source_utm": body.utm or {},
    }).execute()

    # Increment save counter
    try:
        art_row = (c.table("magazine_articles").select("save_count").eq("id", body.article_id).limit(1).execute()).data[0]
        c.table("magazine_articles").update(
            {"save_count": (art_row.get("save_count") or 0) + 1}
        ).eq("id", body.article_id).execute()
    except Exception:
        pass

    return {
        "ok": True,
        "lead_id": lead_id,
        "candidate_id": cand_id,
        "next_step": "complete_onboarding",
        "onboarding_url": "/start-project",
        "message": "Reference saved · complete your project profile to share it with a real advisor.",
    }


# ─── CLIENT (logged-in) save-reference ──────────────────────────────────

class ClientSaveReferenceBody(BaseModel):
    article_id: str
    hotspot_id: Optional[str] = None
    locale: Optional[str] = "it"
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    reference_type: Optional[str] = None
    action: str = "save_to_project"  # save_to_project | send_to_advisor | add_to_moodboard


@router.post("/client/save-reference", status_code=201)
def client_save_reference(body: ClientSaveReferenceBody,
                          ctx=Depends(get_tenant_context)):
    """Logged-in CLIENT path: persist a moodboard_candidate, attribute to
    the client + auto-link to their assignee (if any) so the advisor
    sees it in their Design References Queue."""
    role = (ctx.role or "").lower()
    if role != "client":
        raise HTTPException(403, "client account required")
    c = db()
    art = (c.table("magazine_articles").select("id")
           .eq("id", body.article_id).eq("tenant_id", ctx.tenant_id).limit(1).execute())
    if not art.data:
        raise HTTPException(404, "article not in tenant scope")

    hotspot = None
    if body.hotspot_id:
        h = (c.table("article_hotspots").select("*")
             .eq("id", body.hotspot_id).eq("tenant_id", ctx.tenant_id).limit(1).execute())
        hotspot = h.data[0] if h.data else None

    # Resolve assignee for this client (Phase S.1)
    assignee_id = None
    try:
        a = (c.table("human_assignments").select("assignee_user_id")
             .eq("tenant_id", ctx.tenant_id)
             .eq("subject_type", "client").eq("subject_id", ctx.user_id)
             .eq("status", "active").limit(1).execute())
        assignee_id = a.data[0]["assignee_user_id"] if a.data else None
    except Exception:
        pass

    # Resolve client's project_id (first active project)
    project_id = None
    try:
        p = (c.table("projects").select("id").eq("tenant_id", ctx.tenant_id)
             .eq("client_user_id", ctx.user_id).order("created_at", desc=True)
             .limit(1).execute())
        project_id = p.data[0]["id"] if p.data else None
    except Exception:
        pass

    status = "sent_to_advisor" if body.action == "send_to_advisor" else "saved"
    cand_id = str(uuid.uuid4())
    snap_title = body.title or (hotspot or {}).get("locale_content", {}).get(body.locale or "it", {}).get("label") or "Design reference"
    snap_ref   = body.reference_type or (hotspot or {}).get("reference_type") or "atmosphere"
    c.table("moodboard_candidates").insert({
        "id": cand_id, "tenant_id": ctx.tenant_id,
        "client_user_id": ctx.user_id,
        "assignee_user_id": assignee_id, "project_id": project_id,
        "source_type": "article_hotspot" if body.hotspot_id else "article",
        "source_id": body.hotspot_id or body.article_id,
        "source_article_id": body.article_id, "source_hotspot_id": body.hotspot_id,
        "title": snap_title, "description": body.description, "image_url": body.image_url,
        "reference_type": snap_ref, "status": status, "source_locale": body.locale,
    }).execute()

    # Look up assignee display name for the toast
    advisor_name = None
    if assignee_id:
        try:
            u = (c.table("users_profile").select("first_name,last_name,display_name")
                 .eq("id", assignee_id).limit(1).execute())
            if u.data:
                row = u.data[0]
                advisor_name = (row.get("display_name") or
                                f"{row.get('first_name') or ''} {row.get('last_name') or ''}".strip() or None)
        except Exception:
            pass

    return {
        "ok": True,
        "candidate_id": cand_id,
        "status": status,
        "advisor_name": advisor_name,
        "toast": f"Reference shared with {advisor_name}." if advisor_name else "Reference saved to your project.",
    }


# ─── ADMIN routes ───────────────────────────────────────────────────────

class ArticleUpsertBody(BaseModel):
    slug: str
    locale_content: Dict[str, Any] = Field(default_factory=dict)
    body_blocks: List[Dict[str, Any]] = Field(default_factory=list)
    cover_url: Optional[str] = None
    hero_url: Optional[str] = None
    category_slug: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    default_locale: str = "it"
    reading_minutes: Optional[int] = None
    scope: str = "tenant"


@router.get("/admin/articles")
def admin_list_articles(ctx=Depends(get_tenant_context)):
    if not _is_admin(ctx.role):
        raise HTTPException(403, "admin required")
    c = db()
    r = (c.table("magazine_articles").select("*")
         .eq("tenant_id", ctx.tenant_id).order("updated_at", desc=True).execute())
    return {"articles": [_serialize_article(x) for x in (r.data or [])]}


@router.post("/admin/articles", status_code=201)
def admin_create_article(body: ArticleUpsertBody, ctx=Depends(get_tenant_context)):
    if not _is_admin(ctx.role):
        raise HTTPException(403, "admin required")
    c = db()
    aid = str(uuid.uuid4())
    c.table("magazine_articles").insert({
        "id": aid, "tenant_id": ctx.tenant_id,
        "slug": body.slug, "status": "draft",
        "locale_content": body.locale_content, "body_blocks": body.body_blocks,
        "cover_url": body.cover_url, "hero_url": body.hero_url,
        "category_slug": body.category_slug, "tags": body.tags,
        "default_locale": body.default_locale, "reading_minutes": body.reading_minutes,
        "scope": body.scope, "created_by": ctx.user_id,
    }).execute()
    r = c.table("magazine_articles").select("*").eq("id", aid).limit(1).execute()
    return _serialize_article(r.data[0])


class ArticlePatchBody(BaseModel):
    locale_content: Optional[Dict[str, Any]] = None
    body_blocks:    Optional[List[Dict[str, Any]]] = None
    cover_url:      Optional[str] = None
    hero_url:       Optional[str] = None
    category_slug:  Optional[str] = None
    tags:           Optional[List[str]] = None
    default_locale: Optional[str] = None
    reading_minutes: Optional[int] = None


@router.patch("/admin/articles/{aid}")
def admin_patch_article(aid: str, body: ArticlePatchBody, ctx=Depends(get_tenant_context)):
    if not _is_admin(ctx.role):
        raise HTTPException(403, "admin required")
    c = db()
    art = (c.table("magazine_articles").select("id").eq("id", aid)
           .eq("tenant_id", ctx.tenant_id).limit(1).execute())
    if not art.data:
        raise HTTPException(404)
    patch = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    patch["updated_at"] = _now()
    c.table("magazine_articles").update(patch).eq("id", aid).execute()
    r = c.table("magazine_articles").select("*").eq("id", aid).limit(1).execute()
    return _serialize_article(r.data[0])


@router.post("/admin/articles/{aid}/publish")
def admin_publish_article(aid: str, ctx=Depends(get_tenant_context)):
    if not _is_admin(ctx.role):
        raise HTTPException(403, "admin required")
    c = db()
    art = (c.table("magazine_articles").select("id").eq("id", aid)
           .eq("tenant_id", ctx.tenant_id).limit(1).execute())
    if not art.data:
        raise HTTPException(404)
    c.table("magazine_articles").update({
        "status": "published", "published_at": _now(), "published_by": ctx.user_id,
        "updated_at": _now(),
    }).eq("id", aid).execute()
    return {"ok": True, "article_id": aid}


@router.delete("/admin/articles/{aid}")
def admin_delete_article(aid: str, ctx=Depends(get_tenant_context)):
    if not _is_admin(ctx.role):
        raise HTTPException(403, "admin required")
    c = db()
    art = (c.table("magazine_articles").select("id").eq("id", aid)
           .eq("tenant_id", ctx.tenant_id).limit(1).execute())
    if not art.data:
        raise HTTPException(404)
    c.table("magazine_articles").delete().eq("id", aid).execute()
    return {"ok": True}


class HotspotUpsertBody(BaseModel):
    block_id: str
    x_pct: float = Field(..., ge=0, le=100)
    y_pct: float = Field(..., ge=0, le=100)
    reference_type: str = "atmosphere"
    locale_content: Dict[str, Any] = Field(default_factory=dict)
    linked_material_id: Optional[str] = None
    linked_asset_id:    Optional[str] = None
    linked_article_id:  Optional[str] = None
    cta_action:         str = "save_to_project"
    sort_order:         int = 0


@router.post("/admin/articles/{aid}/hotspots", status_code=201)
def admin_create_hotspot(aid: str, body: HotspotUpsertBody, ctx=Depends(get_tenant_context)):
    if not _is_admin(ctx.role):
        raise HTTPException(403, "admin required")
    c = db()
    art = (c.table("magazine_articles").select("id").eq("id", aid)
           .eq("tenant_id", ctx.tenant_id).limit(1).execute())
    if not art.data:
        raise HTTPException(404)
    hid = str(uuid.uuid4())
    c.table("article_hotspots").insert({
        "id": hid, "tenant_id": ctx.tenant_id, "article_id": aid,
        "block_id": body.block_id, "x_pct": body.x_pct, "y_pct": body.y_pct,
        "reference_type": body.reference_type, "locale_content": body.locale_content,
        "linked_material_id": body.linked_material_id, "linked_asset_id": body.linked_asset_id,
        "linked_article_id": body.linked_article_id,
        "cta_action": body.cta_action, "sort_order": body.sort_order,
    }).execute()
    r = c.table("article_hotspots").select("*").eq("id", hid).limit(1).execute()
    return _strip_internal(r.data[0])


class HotspotPatchBody(BaseModel):
    x_pct:          Optional[float] = Field(None, ge=0, le=100)
    y_pct:          Optional[float] = Field(None, ge=0, le=100)
    reference_type: Optional[str] = None
    locale_content: Optional[Dict[str, Any]] = None
    cta_action:     Optional[str] = None
    visible:        Optional[bool] = None
    sort_order:     Optional[int] = None


@router.patch("/admin/hotspots/{hid}")
def admin_patch_hotspot(hid: str, body: HotspotPatchBody, ctx=Depends(get_tenant_context)):
    if not _is_admin(ctx.role):
        raise HTTPException(403, "admin required")
    c = db()
    h = (c.table("article_hotspots").select("id").eq("id", hid)
         .eq("tenant_id", ctx.tenant_id).limit(1).execute())
    if not h.data:
        raise HTTPException(404)
    patch = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    patch["updated_at"] = _now()
    c.table("article_hotspots").update(patch).eq("id", hid).execute()
    r = c.table("article_hotspots").select("*").eq("id", hid).limit(1).execute()
    return _strip_internal(r.data[0])


@router.delete("/admin/hotspots/{hid}")
def admin_delete_hotspot(hid: str, ctx=Depends(get_tenant_context)):
    if not _is_admin(ctx.role):
        raise HTTPException(403, "admin required")
    c = db()
    h = (c.table("article_hotspots").select("id").eq("id", hid)
         .eq("tenant_id", ctx.tenant_id).limit(1).execute())
    if not h.data:
        raise HTTPException(404)
    c.table("article_hotspots").delete().eq("id", hid).execute()
    return {"ok": True}


# ─── ADVISOR / ADMIN — Design References Queue (Y.3/Y.4 lite) ───────────

@router.get("/admin/references-queue")
def admin_references_queue(status: Optional[str] = None,
                           ctx=Depends(get_tenant_context)):
    role = (ctx.role or "").lower()
    if role not in {"tenant_admin", "super_admin", "designer", "project_manager"}:
        raise HTTPException(403, "studio access required")
    c = db()
    q = (c.table("moodboard_candidates").select("*")
         .eq("tenant_id", ctx.tenant_id).order("created_at", desc=True))
    # Designers see only candidates assigned to them; admins see everything.
    if role in {"designer", "project_manager"}:
        q = q.eq("assignee_user_id", ctx.user_id)
    if status:
        q = q.eq("status", status)
    r = q.limit(200).execute()
    return {"candidates": [_strip_internal(x) for x in (r.data or [])]}


class CandidatePatchBody(BaseModel):
    status:       Optional[str] = None      # saved | sent_to_advisor | added_to_moodboard | dismissed
    advisor_note: Optional[str] = None


@router.patch("/admin/references-queue/{cid}")
def admin_patch_candidate(cid: str, body: CandidatePatchBody, ctx=Depends(get_tenant_context)):
    role = (ctx.role or "").lower()
    if role not in {"tenant_admin", "super_admin", "designer", "project_manager"}:
        raise HTTPException(403, "studio access required")
    c = db()
    r = (c.table("moodboard_candidates").select("id,assignee_user_id")
         .eq("id", cid).eq("tenant_id", ctx.tenant_id).limit(1).execute())
    if not r.data:
        raise HTTPException(404)
    if role in {"designer", "project_manager"} and r.data[0].get("assignee_user_id") != ctx.user_id:
        raise HTTPException(403, "not your reference")
    patch = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    patch["updated_at"] = _now()
    c.table("moodboard_candidates").update(patch).eq("id", cid).execute()
    return {"ok": True}
