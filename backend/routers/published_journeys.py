"""
ITER157.B · Published Design Journeys™ — public + admin API.

Mount strategy:
  • Admin endpoints  → prefix /api/admin/published-journeys (auth required)
  • Public endpoints → prefix /api/public/published-journeys  (no auth, tenant-scoped)

Resolution chain (locale fallback)
  1. Translation row for the requested locale
  2. Translation row for the tenant's canonical locale
  3. The canonical fields on the parent row
  4. Empty editorial state (no fake content)

This module never auto-publishes journeys. Publishing is always an
intentional curatorial act by the studio, triggered from inside the
operational Design Journey detail.
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional, List

from fastapi import APIRouter, HTTPException, Request, Query, Body, Depends
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from database import db

log = logging.getLogger(__name__)

router = APIRouter()
admin_router = APIRouter()


NOW = lambda: datetime.now(timezone.utc).isoformat()  # noqa: E731

# Whitelist for partial PATCH (admin)
ADMIN_PATCH_FIELDS = {
    "title", "editorial_excerpt", "atmosphere", "project_type", "location", "year",
    "hero_asset_id", "hero_url", "gallery_asset_ids", "material_tags",
    "seo_title", "seo_description",
    "visibility_status", "featured_order", "homepage_featured",
    "canonical_locale", "slug",
}
ALLOWED_VISIBILITY = {"draft", "published", "archived"}


# ── Helpers ────────────────────────────────────────────────────────
def _slugify(text: str) -> str:
    s = (text or "").strip().lower()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"[\s_-]+", "-", s)
    return s.strip("-") or "design-journey"


def _ensure_unique_slug(client, tenant_id: str, base: str, exclude_id: Optional[str] = None) -> str:
    candidate = base
    n = 1
    while True:
        q = (client.table("published_design_journeys").select("id")
             .eq("tenant_id", tenant_id).eq("slug", candidate))
        if exclude_id:
            q = q.neq("id", exclude_id)
        rows = (q.limit(1).execute()).data or []
        if not rows:
            return candidate
        n += 1
        candidate = f"{base}-{n}"


def _resolve_locale(parent: dict, translation: Optional[dict]) -> dict:
    """Merge translation row over the parent's canonical fields."""
    out = {
        "title":             parent.get("title"),
        "editorial_excerpt": parent.get("editorial_excerpt"),
        "atmosphere":        parent.get("atmosphere"),
        "location":          parent.get("location"),
        "seo_title":         parent.get("seo_title"),
        "seo_description":   parent.get("seo_description"),
    }
    if translation:
        for k in list(out.keys()):
            v = translation.get(k)
            if v not in (None, ""):
                out[k] = v
    return out


def _public_shape(parent: dict, translation: Optional[dict]) -> dict:
    resolved = _resolve_locale(parent, translation)
    return {
        "id":              parent["id"],
        "slug":            parent["slug"],
        "title":           resolved["title"],
        "excerpt":         resolved["editorial_excerpt"],
        "atmosphere":      resolved["atmosphere"],
        "location":        resolved["location"],
        "project_type":    parent.get("project_type"),
        "year":            parent.get("year"),
        "hero_url":        parent.get("hero_url"),
        "gallery_count":   len(parent.get("gallery_asset_ids") or []),
        "material_tags":   parent.get("material_tags") or [],
        "featured_order":  parent.get("featured_order") or 0,
        "homepage_featured": bool(parent.get("homepage_featured")),
        "published_at":    parent.get("published_at"),
        "seo": {
            "title":       resolved["seo_title"],
            "description": resolved["seo_description"],
        },
    }


# ───────────────────────────────────────────────────────────────────
# PUBLIC API
# ───────────────────────────────────────────────────────────────────
@router.get("/{tenant_slug}/feed")
def public_feed(tenant_slug: str,
                locale: str = Query("it-IT"),
                featured_only: bool = Query(True),
                limit: int = Query(12, ge=1, le=50)):
    """Homepage feed — featured + published, locale-resolved."""
    sb = db()
    # Resolve tenant
    t = (sb.table("tenants").select("id").eq("slug", tenant_slug).limit(1).execute()).data or []
    if not t:
        return {"tenant": tenant_slug, "locale": locale, "items": [], "count": 0}
    tid = t[0]["id"]

    q = (sb.table("published_design_journeys")
         .select("*")
         .eq("tenant_id", tid)
         .eq("visibility_status", "published"))
    if featured_only:
        q = q.eq("homepage_featured", True)
    rows = (q.order("featured_order").order("published_at", desc=True)
             .limit(limit).execute()).data or []

    if not rows:
        return {"tenant": tenant_slug, "locale": locale, "items": [], "count": 0,
                "empty_state": "curating"}

    ids = [r["id"] for r in rows]
    try:
        tx = (sb.table("published_design_journey_translations")
              .select("*")
              .in_("published_journey_id", ids)
              .eq("locale", locale)
              .execute()).data or []
    except Exception as e:
        log.info("pdj · translation fetch failed: %s", e)
        tx = []
    tx_by_id = {t["published_journey_id"]: t for t in tx}

    items = [_public_shape(r, tx_by_id.get(r["id"])) for r in rows]
    return {"tenant": tenant_slug, "locale": locale, "items": items, "count": len(items)}


@router.get("/{tenant_slug}/{slug}")
def public_detail(tenant_slug: str, slug: str, locale: str = Query("it-IT")):
    """Single published journey by slug (locale resolved)."""
    sb = db()
    t = (sb.table("tenants").select("id").eq("slug", tenant_slug).limit(1).execute()).data or []
    if not t:
        raise HTTPException(status_code=404, detail="tenant_not_found")
    tid = t[0]["id"]
    rows = (sb.table("published_design_journeys").select("*")
            .eq("tenant_id", tid).eq("slug", slug)
            .eq("visibility_status", "published")
            .limit(1).execute()).data or []
    if not rows:
        raise HTTPException(status_code=404, detail="published_journey_not_found")
    parent = rows[0]
    try:
        tx = (sb.table("published_design_journey_translations").select("*")
              .eq("published_journey_id", parent["id"]).eq("locale", locale)
              .limit(1).execute()).data or []
    except Exception:
        tx = []
    return {"item": _public_shape(parent, tx[0] if tx else None), "locale": locale}


# ───────────────────────────────────────────────────────────────────
# ADMIN API (tenant-scoped via require_tenant)
# ───────────────────────────────────────────────────────────────────
class PublishCreatePayload(BaseModel):
    design_journey_id:    Optional[str] = None
    portfolio_project_id: Optional[str] = None
    title:                str
    slug:                 Optional[str] = None
    canonical_locale:     str  = "it-IT"
    editorial_excerpt:    Optional[str] = None
    atmosphere:           Optional[str] = None
    project_type:         Optional[str] = None
    location:             Optional[str] = None
    year:                 Optional[int] = None
    hero_asset_id:        Optional[str] = None
    hero_url:             Optional[str] = None
    gallery_asset_ids:    List[str] = Field(default_factory=list)
    material_tags:        List[Any] = Field(default_factory=list)
    seo_title:            Optional[str] = None
    seo_description:      Optional[str] = None
    visibility_status:    str  = "draft"
    featured_order:       int  = 0
    homepage_featured:    bool = False


@admin_router.get("/")
def admin_list(status: Optional[str] = None, limit: int = 100,
               ctx: dict = Depends(get_tenant_context)):
    sb = db()
    q = (sb.table("published_design_journeys").select("*")
         .eq("tenant_id", ctx["tenant_id"]))
    if status:
        q = q.eq("visibility_status", status)
    rows = (q.order("homepage_featured", desc=True)
             .order("featured_order")
             .order("updated_at", desc=True)
             .limit(limit).execute()).data or []
    return {"items": rows, "count": len(rows)}


@admin_router.post("/")
def admin_create(payload: PublishCreatePayload,
                 ctx: dict = Depends(get_tenant_context)):
    sb = db()
    if payload.visibility_status not in ALLOWED_VISIBILITY:
        raise HTTPException(status_code=400, detail="invalid_visibility_status")

    slug = _ensure_unique_slug(sb, ctx["tenant_id"],
                                payload.slug or _slugify(payload.title))
    now = NOW()
    row = {
        "id":                    str(uuid.uuid4()),
        "tenant_id":             ctx["tenant_id"],
        "design_journey_id":     payload.design_journey_id,
        "portfolio_project_id":  payload.portfolio_project_id,
        "slug":                  slug,
        "canonical_locale":      payload.canonical_locale,
        "title":                 payload.title,
        "editorial_excerpt":     payload.editorial_excerpt,
        "atmosphere":            payload.atmosphere,
        "project_type":          payload.project_type,
        "location":              payload.location,
        "year":                  payload.year,
        "hero_asset_id":         payload.hero_asset_id,
        "hero_url":              payload.hero_url,
        "gallery_asset_ids":     payload.gallery_asset_ids or [],
        "material_tags":         payload.material_tags or [],
        "seo_title":             payload.seo_title,
        "seo_description":       payload.seo_description,
        "visibility_status":     payload.visibility_status,
        "featured_order":        payload.featured_order,
        "homepage_featured":     payload.homepage_featured,
        "published_at":          now if payload.visibility_status == "published" else None,
        "created_by":            ctx.get("profile_id"),
        "created_at":            now,
        "updated_at":            now,
    }
    sb.table("published_design_journeys").insert(row).execute()
    return {"item": row, "created": True}


@admin_router.patch("/{journey_id}")
def admin_update(journey_id: str, payload: dict = Body(...),
                 ctx: dict = Depends(get_tenant_context)):
    sb = db()
    existing = (sb.table("published_design_journeys").select("*")
                .eq("id", journey_id).eq("tenant_id", ctx["tenant_id"])
                .limit(1).execute()).data or []
    if not existing:
        raise HTTPException(status_code=404, detail="published_journey_not_found")

    updates = {k: v for k, v in payload.items() if k in ADMIN_PATCH_FIELDS}
    if "visibility_status" in updates:
        if updates["visibility_status"] not in ALLOWED_VISIBILITY:
            raise HTTPException(status_code=400, detail="invalid_visibility_status")
        if updates["visibility_status"] == "published" and not existing[0].get("published_at"):
            updates["published_at"] = NOW()
    if "slug" in updates and updates["slug"] != existing[0].get("slug"):
        updates["slug"] = _ensure_unique_slug(sb, ctx["tenant_id"],
                                              _slugify(updates["slug"]),
                                              exclude_id=journey_id)
    if not updates:
        return {"item": existing[0], "updated": False}
    updates["updated_at"] = NOW()
    sb.table("published_design_journeys").update(updates) \
      .eq("id", journey_id).execute()
    refreshed = (sb.table("published_design_journeys").select("*")
                 .eq("id", journey_id).limit(1).execute()).data or []
    return {"item": refreshed[0] if refreshed else existing[0], "updated": True}


@admin_router.delete("/{journey_id}")
def admin_delete(journey_id: str, ctx: dict = Depends(get_tenant_context)):
    """Archive (soft-delete). Editorial permanence — DB row survives."""
    sb = db()
    existing = (sb.table("published_design_journeys").select("id")
                .eq("id", journey_id).eq("tenant_id", ctx["tenant_id"])
                .limit(1).execute()).data or []
    if not existing:
        raise HTTPException(status_code=404, detail="published_journey_not_found")
    sb.table("published_design_journeys").update({
        "visibility_status": "archived",
        "homepage_featured": False,
        "updated_at":        NOW(),
    }).eq("id", journey_id).execute()
    return {"archived": True, "id": journey_id}


@admin_router.put("/{journey_id}/translations/{locale}")
def admin_upsert_translation(journey_id: str, locale: str,
                              payload: dict = Body(...),
                              ctx: dict = Depends(get_tenant_context)):
    sb = db()
    parent = (sb.table("published_design_journeys").select("id")
              .eq("id", journey_id).eq("tenant_id", ctx["tenant_id"])
              .limit(1).execute()).data or []
    if not parent:
        raise HTTPException(status_code=404, detail="published_journey_not_found")

    fields = {k: payload.get(k) for k in
              ("title", "editorial_excerpt", "atmosphere", "location",
               "seo_title", "seo_description") if k in payload}
    fields["status"] = payload.get("status", "manual")
    fields["generated_by"] = payload.get("generated_by")

    existing = (sb.table("published_design_journey_translations").select("id")
                .eq("published_journey_id", journey_id).eq("locale", locale)
                .limit(1).execute()).data or []
    if existing:
        fields["updated_at"] = NOW()
        sb.table("published_design_journey_translations").update(fields) \
          .eq("id", existing[0]["id"]).execute()
        return {"updated": True}
    fields.update({
        "id":                   str(uuid.uuid4()),
        "tenant_id":            ctx["tenant_id"],
        "published_journey_id": journey_id,
        "locale":               locale,
        "created_at":           NOW(),
        "updated_at":           NOW(),
    })
    sb.table("published_design_journey_translations").insert(fields).execute()
    return {"created": True}


# ───────────────────────────────────────────────────────────────────
# REORDER (drag-to-curate from Blueprint Experience)
# ───────────────────────────────────────────────────────────────────
class ReorderPayload(BaseModel):
    order: List[str]  # ordered list of published_journey ids


@admin_router.post("/reorder")
def admin_reorder(payload: ReorderPayload,
                  ctx: dict = Depends(get_tenant_context)):
    sb = db()
    for idx, jid in enumerate(payload.order):
        sb.table("published_design_journeys").update({
            "featured_order": idx,
            "updated_at":     NOW(),
        }).eq("id", jid).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"reordered": len(payload.order)}
