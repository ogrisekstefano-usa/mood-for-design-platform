"""
Editorial Copy CMS · Surface Governance System™
================================================

Surfaces-first navigation API. Lets the studio admin edit narrative
copy per editorial surface (Home, Begin Journey, Guided Tour, …)
instead of wading through 2268 flat i18n keys.

Endpoints (all admin-only, mounted at `/api/admin/editorial-copy`):

  GET  /surfaces                            · list all editorial surfaces
  GET  /surfaces/{code}/phrases             · phrases for one surface, with tenant override applied
  PATCH /phrases/{phrase_id}                · upsert tenant override
  DELETE /phrases/{phrase_id}/override      · clear tenant override (revert to platform default)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from database import db

router = APIRouter()

# Roles allowed to govern editorial copy
ADMIN_ROLES = {"super_admin", "tenant_admin", "studio_owner", "founder"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_admin(ctx: dict) -> None:
    role = (ctx.get("role") or "").lower()
    if role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Editorial Copy CMS is admin-only")


# ─────────────────────────────────────────────────────────────────
# GET /api/admin/editorial-copy/surfaces
# ─────────────────────────────────────────────────────────────────
@router.get("/surfaces")
def list_surfaces(ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    sb = db()
    rows = (
        sb.table("editorial_surfaces")
        .select("code, name, description, icon, sort_order, preview_route, voice_hints")
        .eq("enabled", True)
        .order("sort_order")
        .execute()
    ).data or []
    return {"surfaces": rows}


# ─────────────────────────────────────────────────────────────────
# GET /api/admin/editorial-copy/surfaces/{code}/phrases
# ─────────────────────────────────────────────────────────────────
@router.get("/surfaces/{code}/phrases")
def list_phrases(code: str, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    sb = db()

    surfaces = (
        sb.table("editorial_surfaces").select("id, code, name, description, preview_route, voice_hints")
        .eq("code", code).limit(1).execute()
    ).data
    if not surfaces:
        raise HTTPException(status_code=404, detail="Surface not found")
    surface = surfaces[0]

    phrases = (
        sb.table("editorial_phrases")
        .select("id, phrase_key, scope, position, eyebrow, title, body, cta, meta")
        .eq("surface_id", surface["id"]).order("position").execute()
    ).data or []

    # Apply tenant overrides
    overrides = (
        sb.table("editorial_phrase_overrides")
        .select("phrase_id, eyebrow, title, body, cta, updated_at")
        .eq("tenant_id", ctx["tenant_id"]).execute()
    ).data or []
    by_id = {o["phrase_id"]: o for o in overrides}

    out = []
    for p in phrases:
        ov = by_id.get(p["id"])
        out.append({
            "id": p["id"],
            "phrase_key": p["phrase_key"],
            "scope": p["scope"],
            "position": p["position"],
            "meta": p.get("meta") or {},
            "default": {
                "eyebrow": p.get("eyebrow"),
                "title":   p.get("title"),
                "body":    p.get("body"),
                "cta":     p.get("cta"),
            },
            "override": ({
                "eyebrow": ov.get("eyebrow"),
                "title":   ov.get("title"),
                "body":    ov.get("body"),
                "cta":     ov.get("cta"),
                "updated_at": ov.get("updated_at"),
            } if ov else None),
            # Effective = override fields if set, else default
            "effective": {
                "eyebrow": (ov or {}).get("eyebrow") if ov and ov.get("eyebrow") else p.get("eyebrow"),
                "title":   (ov or {}).get("title")   if ov and ov.get("title")   else p.get("title"),
                "body":    (ov or {}).get("body")    if ov and ov.get("body")    else p.get("body"),
                "cta":     (ov or {}).get("cta")     if ov and ov.get("cta")     else p.get("cta"),
            },
        })

    return {
        "surface": surface,
        "phrases": out,
    }


# ─────────────────────────────────────────────────────────────────
# PATCH /api/admin/editorial-copy/phrases/{phrase_id}
# ─────────────────────────────────────────────────────────────────
class PhraseOverrideIn(BaseModel):
    eyebrow: Optional[dict] = None
    title:   Optional[dict] = None
    body:    Optional[dict] = None
    cta:     Optional[dict] = None


@router.patch("/phrases/{phrase_id}")
def upsert_override(
    phrase_id: str,
    payload: PhraseOverrideIn = Body(...),
    ctx: dict = Depends(get_tenant_context),
):
    _require_admin(ctx)
    sb = db()
    tid = ctx["tenant_id"]

    # Resolve phrase to make sure it exists
    p = (sb.table("editorial_phrases").select("id").eq("id", phrase_id).limit(1).execute()).data
    if not p:
        raise HTTPException(status_code=404, detail="Phrase not found")

    existing = (
        sb.table("editorial_phrase_overrides")
        .select("id").eq("tenant_id", tid).eq("phrase_id", phrase_id).limit(1).execute()
    ).data
    record = {
        "tenant_id":  tid,
        "phrase_id":  phrase_id,
        "eyebrow":    payload.eyebrow,
        "title":      payload.title,
        "body":       payload.body,
        "cta":        payload.cta,
        "updated_by": ctx.get("profile_id"),
        "updated_at": _now(),
    }
    if existing:
        sb.table("editorial_phrase_overrides").update(record).eq("id", existing[0]["id"]).execute()
    else:
        sb.table("editorial_phrase_overrides").insert(record).execute()

    return {"ok": True, "phrase_id": phrase_id, "updated_at": record["updated_at"]}


# ─────────────────────────────────────────────────────────────────
# DELETE /api/admin/editorial-copy/phrases/{phrase_id}/override
# ─────────────────────────────────────────────────────────────────
@router.delete("/phrases/{phrase_id}/override")
def clear_override(phrase_id: str, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    sb = db()
    sb.table("editorial_phrase_overrides").delete().eq(
        "tenant_id", ctx["tenant_id"]).eq("phrase_id", phrase_id).execute()
    return {"ok": True}
