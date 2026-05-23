"""Atelier Dashboard™ · DB-driven content router.

ITER138 · Phase 2 (post-cinematic) — replaces every hardcoded mock string,
image URL and demo array in the React `AtelierDashboardPage` with
tenant-scoped, locale-aware, admin-editable content.

Endpoints
─────────
GET  /api/atelier/dashboard/config        — current tenant's dashboard config
                                            (hero copy + media bindings + i18n
                                            labels + active inspiration quote)
GET  /api/atelier/dashboard/media          — media library for this tenant
                                            (filter by kind: hero / project_card_fallback
                                            / inspiration)
GET  /api/atelier/dashboard/quotes         — inspiration quote library

Admin
─────
PUT  /api/atelier/dashboard/config        — upsert tenant config (admin only)
POST /api/atelier/dashboard/media         — add/update a media asset
DELETE /api/atelier/dashboard/media/{id}  — remove a media asset
POST /api/atelier/dashboard/quotes        — add/update a quote
DELETE /api/atelier/dashboard/quotes/{id} — remove a quote

All read endpoints transparently route through the Editorial Translation
Layer (ALE) so locale ≠ source quotes/labels return semantic rewrites, not
literal translations.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional, List, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from database import db
from core.tenant_context import get_tenant_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/atelier/dashboard", tags=["atelier-dashboard"])


# ── Pydantic schemas ─────────────────────────────────────────────────

class DashboardMedia(BaseModel):
    id: str
    media_kind: str
    file_url: str
    alt_text: Optional[str] = None
    focal_point_x: float = 0.5
    focal_point_y: float = 0.5
    grading_profile: str = "nordic_cinematic"
    overlay_intensity: float = 0.45
    brightness_offset: float = 0.0
    locale: str = "*"
    sort_order: int = 0
    is_active: bool = True


class DashboardQuote(BaseModel):
    id: str
    quote_text: str
    quote_author: Optional[str] = None
    quote_source: Optional[str] = None
    locale: str = "en-US"
    media_id: Optional[str] = None
    media: Optional[DashboardMedia] = None  # hydrated when read
    is_active: bool = True
    sort_order: int = 0


class DashboardConfig(BaseModel):
    hero_eyebrow: Optional[str] = None
    hero_greeting_morning: Optional[str] = None
    hero_greeting_afternoon: Optional[str] = None
    hero_greeting_evening: Optional[str] = None
    hero_summary_template: Optional[str] = None
    hero_signature: Optional[str] = None
    hero_media: Optional[DashboardMedia] = None
    hero_overlay_profile: str = "cinematic_left"
    kpi_active_label: Optional[str] = None
    kpi_dossier_label: Optional[str] = None
    kpi_awaiting_label: Optional[str] = None
    kpi_deliveries_label: Optional[str] = None
    section_projects_title: Optional[str] = None
    section_projects_cta: Optional[str] = None
    section_activity_title: Optional[str] = None
    section_milestones_title: Optional[str] = None
    section_inspiration_title: Optional[str] = None
    project_card_fallback_media: List[DashboardMedia] = Field(default_factory=list)
    inspiration_quote: Optional[DashboardQuote] = None
    inspiration_media: Optional[DashboardMedia] = None


class DashboardConfigPut(BaseModel):
    """Subset accepted on admin write."""
    locale: str = "*"
    hero_eyebrow: Optional[str] = None
    hero_greeting_morning: Optional[str] = None
    hero_greeting_afternoon: Optional[str] = None
    hero_greeting_evening: Optional[str] = None
    hero_summary_template: Optional[str] = None
    hero_signature: Optional[str] = None
    hero_media_id: Optional[str] = None
    hero_overlay_profile: Optional[str] = None
    kpi_active_label: Optional[str] = None
    kpi_dossier_label: Optional[str] = None
    kpi_awaiting_label: Optional[str] = None
    kpi_deliveries_label: Optional[str] = None
    section_projects_title: Optional[str] = None
    section_projects_cta: Optional[str] = None
    section_activity_title: Optional[str] = None
    section_milestones_title: Optional[str] = None
    section_inspiration_title: Optional[str] = None


class DashboardMediaIn(BaseModel):
    media_kind: Literal['hero', 'project_card_fallback', 'inspiration']
    file_url: str
    alt_text: Optional[str] = None
    focal_point_x: float = 0.5
    focal_point_y: float = 0.5
    grading_profile: str = "nordic_cinematic"
    overlay_intensity: float = 0.45
    brightness_offset: float = 0.0
    locale: str = "*"
    sort_order: int = 0


class DashboardQuoteIn(BaseModel):
    quote_text: str
    quote_author: Optional[str] = None
    quote_source: Optional[str] = None
    locale: str = "en-US"
    media_id: Optional[str] = None
    sort_order: int = 0


# ── Helpers ──────────────────────────────────────────────────────────

def _record_to_media(rec: dict) -> DashboardMedia:
    return DashboardMedia(
        id=str(rec["id"]),
        media_kind=rec["media_kind"],
        file_url=rec["file_url"],
        alt_text=rec.get("alt_text"),
        focal_point_x=float(rec.get("focal_point_x", 0.5) or 0.5),
        focal_point_y=float(rec.get("focal_point_y", 0.5) or 0.5),
        grading_profile=rec.get("grading_profile") or "nordic_cinematic",
        overlay_intensity=float(rec.get("overlay_intensity", 0.45) or 0.45),
        brightness_offset=float(rec.get("brightness_offset", 0.0) or 0.0),
        locale=rec.get("locale") or "*",
        sort_order=int(rec.get("sort_order", 0) or 0),
        is_active=bool(rec.get("is_active", True)),
    )


def _record_to_quote(rec: dict, media_by_id: dict) -> DashboardQuote:
    media = None
    if rec.get("media_id") and rec["media_id"] in media_by_id:
        media = media_by_id[rec["media_id"]]
    return DashboardQuote(
        id=str(rec["id"]),
        quote_text=rec["quote_text"],
        quote_author=rec.get("quote_author"),
        quote_source=rec.get("quote_source"),
        locale=rec.get("locale") or "en-US",
        media_id=str(rec["media_id"]) if rec.get("media_id") else None,
        media=media,
        is_active=bool(rec.get("is_active", True)),
        sort_order=int(rec.get("sort_order", 0) or 0),
    )


def _pick_media(records: List[dict], kind: str, tenant_id: str,
                locale: str) -> Optional[dict]:
    """Tenant + locale priority: tenant+locale > tenant+* > NULL+locale > NULL+*"""
    pool = [r for r in records if r.get("media_kind") == kind and r.get("is_active", True)]
    if not pool:
        return None
    def prio(r):
        t = 0 if r.get("tenant_id") == tenant_id else 1
        l = 0 if r.get("locale") == locale else (1 if r.get("locale") == "*" else 2)
        return (t, l, int(r.get("sort_order", 0) or 0))
    pool.sort(key=prio)
    return pool[0] if pool else None


def _pick_config(records: List[dict], tenant_id: str, locale: str) -> Optional[dict]:
    pool = [r for r in records if r.get("is_active", True)]
    def prio(r):
        t = 0 if r.get("tenant_id") == tenant_id else 1
        l = 0 if r.get("locale") == locale else (1 if r.get("locale") == "*" else 2)
        return (t, l)
    pool.sort(key=prio)
    return pool[0] if pool else None


def _localize_quote(q: DashboardQuote, target_locale: str, tenant_id: str) -> DashboardQuote:
    """ALE-on-read: rewrite quote.text into target_locale via existing TM."""
    if not q or not target_locale or target_locale.startswith(q.locale.split("-")[0]):
        return q
    try:
        from services.editorial_translation_layer import (
            localize_records as _ale_localize_records,
            normalize_locale as _ale_norm,
        )
        ale_target = _ale_norm(target_locale)
        if ale_target and ale_target != (q.locale or "en-US").split("-")[0]:
            seed = [{"quote_text": q.quote_text}]
            out = _ale_localize_records(
                seed, fields=("quote_text",),
                target_locale=ale_target, tenant_id=tenant_id,
                surface="atelier_dashboard_quote",
            )
            if out and out[0].get("quote_text"):
                q.quote_text = out[0]["quote_text"]
    except Exception as e:
        logger.warning("ALE quote localization skipped: %s", e)
    return q


# ── READ endpoints ───────────────────────────────────────────────────

@router.get("/config", response_model=DashboardConfig)
def get_config(
    ctx: dict = Depends(get_tenant_context),
    locale: str = Query("en-US", description="Active UI locale"),
):
    """Return the resolved dashboard config for this tenant + locale.

    Resolution priority (tenant > global, locale > '*'):
        1. tenant_id == this_tenant AND locale == this_locale
        2. tenant_id == this_tenant AND locale == '*'
        3. tenant_id IS NULL    AND locale == this_locale
        4. tenant_id IS NULL    AND locale == '*'
    """
    c = db()
    tid = ctx["tenant_id"]
    locale = (locale or "en-US").strip()

    # 1. All config rows visible to this tenant
    cfg_rows = (c.table("atelier_dashboard_config")
                .select("*")
                .or_(f"tenant_id.eq.{tid},tenant_id.is.null")
                .execute().data or [])
    cfg = _pick_config(cfg_rows, tid, locale) or {}

    # 2. All media rows visible to this tenant
    media_rows = (c.table("atelier_dashboard_media")
                  .select("*")
                  .or_(f"tenant_id.eq.{tid},tenant_id.is.null")
                  .eq("is_active", True)
                  .execute().data or [])

    hero_rec = None
    if cfg.get("hero_media_id"):
        hero_rec = next((m for m in media_rows if str(m["id"]) == str(cfg["hero_media_id"])), None)
    if not hero_rec:
        hero_rec = _pick_media(media_rows, "hero", tid, locale)
    hero_media = _record_to_media(hero_rec) if hero_rec else None

    # Project card fallbacks — sorted by tenant priority then sort_order
    fallback_records = [m for m in media_rows if m.get("media_kind") == "project_card_fallback"]
    fallback_records.sort(key=lambda r: (
        0 if r.get("tenant_id") == tid else 1,
        int(r.get("sort_order", 0) or 0),
    ))
    fallback_media = [_record_to_media(r) for r in fallback_records[:8]]

    # Inspiration quote (rotate by day-of-year for stability)
    q_rows = (c.table("atelier_dashboard_quotes")
              .select("*")
              .or_(f"tenant_id.eq.{tid},tenant_id.is.null")
              .eq("is_active", True)
              .order("sort_order")
              .execute().data or [])
    quote = None
    inspiration_media = None
    if q_rows:
        idx = datetime.now(timezone.utc).timetuple().tm_yday % len(q_rows)
        # Prefer tenant-owned quotes if any exist
        tenant_quotes = [q for q in q_rows if q.get("tenant_id") == tid]
        chosen = (tenant_quotes[idx % len(tenant_quotes)] if tenant_quotes
                  else q_rows[idx])
        media_by_id = {str(m["id"]): _record_to_media(m) for m in media_rows}
        quote = _record_to_quote(chosen, media_by_id)
        quote = _localize_quote(quote, locale, tid)

    # Inspiration ambient media (separate from quote media)
    insp_rec = _pick_media(media_rows, "inspiration", tid, locale)
    if insp_rec:
        inspiration_media = _record_to_media(insp_rec)
    if not inspiration_media and quote and quote.media:
        inspiration_media = quote.media

    return DashboardConfig(
        hero_eyebrow=cfg.get("hero_eyebrow"),
        hero_greeting_morning=cfg.get("hero_greeting_morning"),
        hero_greeting_afternoon=cfg.get("hero_greeting_afternoon"),
        hero_greeting_evening=cfg.get("hero_greeting_evening"),
        hero_summary_template=cfg.get("hero_summary_template"),
        hero_signature=cfg.get("hero_signature"),
        hero_media=hero_media,
        hero_overlay_profile=cfg.get("hero_overlay_profile") or "cinematic_left",
        kpi_active_label=cfg.get("kpi_active_label"),
        kpi_dossier_label=cfg.get("kpi_dossier_label"),
        kpi_awaiting_label=cfg.get("kpi_awaiting_label"),
        kpi_deliveries_label=cfg.get("kpi_deliveries_label"),
        section_projects_title=cfg.get("section_projects_title"),
        section_projects_cta=cfg.get("section_projects_cta"),
        section_activity_title=cfg.get("section_activity_title"),
        section_milestones_title=cfg.get("section_milestones_title"),
        section_inspiration_title=cfg.get("section_inspiration_title"),
        project_card_fallback_media=fallback_media,
        inspiration_quote=quote,
        inspiration_media=inspiration_media,
    )


@router.get("/media")
def list_media(
    ctx: dict = Depends(get_tenant_context),
    kind: Optional[str] = Query(None, description="Filter by media_kind"),
):
    c = db()
    tid = ctx["tenant_id"]
    q = (c.table("atelier_dashboard_media").select("*")
         .or_(f"tenant_id.eq.{tid},tenant_id.is.null")
         .eq("is_active", True)
         .order("sort_order"))
    if kind:
        q = q.eq("media_kind", kind)
    rows = q.execute().data or []
    return {"media": [_record_to_media(r).dict() for r in rows]}


@router.get("/quotes")
def list_quotes(
    ctx: dict = Depends(get_tenant_context),
    locale: str = Query("en-US"),
):
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("atelier_dashboard_quotes").select("*")
            .or_(f"tenant_id.eq.{tid},tenant_id.is.null")
            .eq("is_active", True)
            .order("sort_order")
            .execute().data or [])
    media_rows = (c.table("atelier_dashboard_media").select("*")
                  .or_(f"tenant_id.eq.{tid},tenant_id.is.null")
                  .execute().data or [])
    media_by_id = {str(m["id"]): _record_to_media(m) for m in media_rows}
    quotes = [_record_to_quote(r, media_by_id) for r in rows]
    quotes = [_localize_quote(q, locale, tid) for q in quotes]
    return {"quotes": [q.dict() for q in quotes]}


# ── WRITE endpoints (admin gated) ────────────────────────────────────

def _require_admin(ctx: dict) -> None:
    role = (ctx.get("role") or "").lower()
    if role not in ("super_admin", "tenant_admin", "owner", "designer"):
        raise HTTPException(status_code=403, detail="admin role required")


@router.put("/config")
def upsert_config(payload: DashboardConfigPut, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    c = db()
    tid = ctx["tenant_id"]
    row = {
        "tenant_id": tid,
        "locale": payload.locale or "*",
        **{k: v for k, v in payload.dict(exclude={"locale"}).items() if v is not None},
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    res = (c.table("atelier_dashboard_config")
           .upsert(row, on_conflict="tenant_id,locale")
           .execute())
    return {"ok": True, "id": (res.data or [{}])[0].get("id")}


@router.post("/media")
def create_media(payload: DashboardMediaIn, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    c = db()
    row = {**payload.dict(), "tenant_id": ctx["tenant_id"]}
    res = c.table("atelier_dashboard_media").insert(row).execute()
    rec = (res.data or [{}])[0]
    return {"ok": True, "media": _record_to_media(rec).dict() if rec else None}


@router.delete("/media/{media_id}")
def delete_media(media_id: UUID, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    c = db()
    tid = ctx["tenant_id"]
    # Only allow deleting tenant-owned media (not global system defaults)
    (c.table("atelier_dashboard_media")
     .update({"is_active": False})
     .eq("id", str(media_id))
     .eq("tenant_id", tid)
     .execute())
    return {"ok": True}


@router.post("/quotes")
def create_quote(payload: DashboardQuoteIn, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    c = db()
    row = {**payload.dict(), "tenant_id": ctx["tenant_id"]}
    res = c.table("atelier_dashboard_quotes").insert(row).execute()
    return {"ok": True, "id": (res.data or [{}])[0].get("id")}


@router.delete("/quotes/{quote_id}")
def delete_quote(quote_id: UUID, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    c = db()
    tid = ctx["tenant_id"]
    (c.table("atelier_dashboard_quotes")
     .update({"is_active": False})
     .eq("id", str(quote_id))
     .eq("tenant_id", tid)
     .execute())
    return {"ok": True}
