"""
STORE-008A · Editorial Autopilot™ MVP
=====================================

Showroom-friendly read/action layer over the existing editorial schema.
NO new tables · NO new migrations · NO scheduler · NO publishing automation.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.tenant_context import get_tenant_context
from database import db

router = APIRouter()

PROOFREADING_STATUSES = {"draft", "in_proofreading", "ready_for_editorial_review", "changes_requested"}
APPROVED_STATUSES = {"approved", "ready_to_publish"}
PUBLISHED_STATUSES = {"published"}
BLOCKED_STATUSES = {"media_required"}

STATUS_LABEL = {
    "draft": "Bozza AI",
    "in_proofreading": "In proofreading",
    "ready_for_editorial_review": "In proofreading",
    "changes_requested": "Modifiche richieste",
    "approved": "Approvato",
    "ready_to_publish": "Pronto per pubblicazione",
    "published": "Pubblicato",
    "media_required": "Media richiesti",
}


def _market_label(market: Optional[Dict[str, Any]], locale: str = "it-IT") -> Optional[str]:
    """display_name on markets is a JSONB i18n map · resolve to a string."""
    if not market:
        return None
    dn = market.get("display_name")
    if isinstance(dn, dict):
        return dn.get(locale) or dn.get("en-US") or dn.get("en-GB") or next(iter(dn.values()), None)
    if isinstance(dn, str):
        return dn
    return market.get("code")


def _humanize_variant(v: Dict[str, Any], market: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    ai_meta = v.get("ai_meta") or {}
    if not isinstance(ai_meta, dict):
        ai_meta = {}
    s = v.get("status") or "draft"
    return {
        "id": v["id"],
        "title": v.get("title") or "(Senza titolo)",
        "excerpt": v.get("excerpt") or "",
        "market_id": v.get("market_id"),
        "market_label": _market_label(market),
        "market_code": market.get("code") if market else None,
        "target_locale": v.get("target_locale") or "—",
        "channel": ai_meta.get("channel") or v.get("editorial_edition") or "SEO Article",
        "source_label": (ai_meta.get("source") or {}).get("label") if isinstance(ai_meta.get("source"), dict) else None,
        "scheduled_at": v.get("scheduled_at"),
        "status": s,
        "status_label": STATUS_LABEL.get(s, s),
        "is_blocked": s in BLOCKED_STATUSES,
        "hero_image_url": v.get("hero_image_url"),
        "updated_at": v.get("updated_at"),
        "created_at": v.get("created_at"),
    }


# ── DASHBOARD ──────────────────────────────────────────────────────
@router.get("/editorial/autopilot/dashboard")
def autopilot_dashboard(ctx=Depends(get_tenant_context)):
    tid = ctx["tenant_id"]
    c = db()

    tm = (c.table("tenant_markets")
          .select("market_id,custom_settings,is_active,is_default,sort_order")
          .eq("tenant_id", tid).eq("is_active", True)
          .order("sort_order").execute().data or [])
    market_ids = [r["market_id"] for r in tm if r.get("market_id")]
    markets_meta: Dict[str, Dict[str, Any]] = {}
    if market_ids:
        mkts = (c.table("markets").select("id,code,display_name")
                .in_("id", market_ids).execute().data or [])
        markets_meta = {m["id"]: m for m in mkts}

    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    variants_recent = (c.table("editorial_variants")
                       .select("id,market_id,status,scheduled_at,created_at,title")
                       .eq("tenant_id", tid).gte("created_at", since)
                       .execute().data or [])

    per_market: Dict[str, Dict[str, Any]] = {}
    for row in tm:
        mid = row["market_id"]
        mkt = markets_meta.get(mid, {})
        cs = row.get("custom_settings") or {}
        if not isinstance(cs, dict):
            cs = {}
        per_market[mid] = {
            "market_id": mid,
            "code": mkt.get("code"),
            "label": _market_label(mkt) or mkt.get("code") or "—",
            "weekly_frequency": int(cs.get("weekly_frequency") or 0),
            "this_week_count": 0,
        }
    for v in variants_recent:
        mid = v.get("market_id")
        if mid in per_market:
            per_market[mid]["this_week_count"] += 1

    pipeline = {"in_proofreading": 0, "approved": 0, "published": 0, "blocked": 0}
    all_v = (c.table("editorial_variants").select("status")
             .eq("tenant_id", tid).execute().data or [])
    for v in all_v:
        s = v.get("status") or ""
        if s in PROOFREADING_STATUSES:
            pipeline["in_proofreading"] += 1
        elif s in APPROVED_STATUSES:
            pipeline["approved"] += 1
        elif s in PUBLISHED_STATUSES:
            pipeline["published"] += 1
        elif s in BLOCKED_STATUSES:
            pipeline["blocked"] += 1

    def _count(table: str, extra=None) -> int:
        q = c.table(table).select("id", count="exact").eq("tenant_id", tid)
        if extra:
            q = extra(q)
        return q.execute().count or 0

    brand_count = _count("brand_detected_entities")
    moodboard_count = _count("moodboards")
    material_count = _count("material_boards")
    spec_count = _count("specification_packages")
    media_count = _count("media_library", lambda q: q.is_("archived_at", "null"))
    stories_rows = (c.table("project_stories").select("id,status")
                    .eq("tenant_id", tid).is_("deleted_at", "null")
                    .execute().data or [])
    stories_unpub = sum(1 for s in stories_rows if (s.get("status") or "") != "published")

    opportunities = [
        {"key": "brands",     "count": brand_count,     "label": "Brand mai promossi",                "icon": "BookOpen"},
        {"key": "stories",    "count": stories_unpub,    "label": "Project Stories non pubblicate",     "icon": "Sparkles"},
        {"key": "materials",  "count": material_count,   "label": "Material Boards inutilizzate",       "icon": "Palette"},
        {"key": "moodboards", "count": moodboard_count,  "label": "Moodboards mai promosse",            "icon": "Image"},
        {"key": "specs",      "count": spec_count,       "label": "Specifications senza contenuto",     "icon": "FileText"},
        {"key": "media",      "count": media_count,      "label": "Immagini autorizzate in Media Library", "icon": "Camera"},
    ]

    covered = [pm for pm in per_market.values() if pm["this_week_count"] > 0]
    uncovered = [pm for pm in per_market.values() if pm["this_week_count"] == 0]

    return {
        "tenant_id": tid,
        "this_week": list(per_market.values()),
        "pipeline": pipeline,
        "opportunities": opportunities,
        "markets_covered": [{"market_id": p["market_id"], "code": p["code"], "label": p["label"], "count": p["this_week_count"]} for p in covered],
        "markets_uncovered": [{"market_id": p["market_id"], "code": p["code"], "label": p["label"]} for p in uncovered],
        "autopilot_mode": "review_only",
    }


# ── INBOX ──────────────────────────────────────────────────────────
@router.get("/editorial/inbox")
def inbox_list(status_filter: Optional[str] = None, ctx=Depends(get_tenant_context)):
    tid = ctx["tenant_id"]
    c = db()
    q = (c.table("editorial_variants")
         .select("id,title,excerpt,market_id,target_locale,status,scheduled_at,"
                 "hero_image_url,editorial_edition,ai_meta,updated_at,created_at")
         .eq("tenant_id", tid).order("updated_at", desc=True).limit(50))
    if status_filter == "approved":
        q = q.in_("status", list(APPROVED_STATUSES))
    elif status_filter == "published":
        q = q.in_("status", list(PUBLISHED_STATUSES))
    elif status_filter == "blocked":
        q = q.in_("status", list(BLOCKED_STATUSES))
    else:
        q = q.in_("status", list(PROOFREADING_STATUSES))
    rows = q.execute().data or []

    mids = list({r["market_id"] for r in rows if r.get("market_id")})
    mkts: Dict[str, Dict[str, Any]] = {}
    if mids:
        m = (c.table("markets").select("id,code,display_name")
             .in_("id", mids).execute().data or [])
        mkts = {x["id"]: x for x in m}

    return {
        "items": [_humanize_variant(r, mkts.get(r.get("market_id"))) for r in rows],
        "count": len(rows),
    }


@router.get("/editorial/inbox/{variant_id}")
def inbox_detail(variant_id: str, ctx=Depends(get_tenant_context)):
    tid = ctx["tenant_id"]
    c = db()
    rows = (c.table("editorial_variants").select("*")
            .eq("tenant_id", tid).eq("id", variant_id).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Variant not found")
    v = rows[0]

    market = None
    if v.get("market_id"):
        mrows = (c.table("markets").select("id,code,display_name")
                 .eq("id", v["market_id"]).limit(1).execute().data or [])
        if mrows:
            market = mrows[0]

    locale_profile = None
    if v.get("target_locale"):
        lrows = (c.table("locale_profiles")
                 .select("locale_code,language,editorial_tone,emotional_style,cta_style")
                 .eq("locale_code", v["target_locale"]).limit(1).execute().data or [])
        if lrows:
            locale_profile = lrows[0]

    ai_meta = v.get("ai_meta") or {}
    if not isinstance(ai_meta, dict):
        ai_meta = {}
    internal_tx = v.get("internal_translation") or {}
    if not isinstance(internal_tx, dict):
        internal_tx = {}
    hotspots = v.get("hotspot_data") or {}
    proposed = hotspots.get("proposed") if isinstance(hotspots, dict) else hotspots
    if not isinstance(proposed, list):
        proposed = []

    return {
        "id": v["id"],
        "title": v.get("title") or "(Senza titolo)",
        "excerpt": v.get("excerpt") or "",
        "body_blocks": v.get("body_blocks") or [],
        "hero_image_url": v.get("hero_image_url"),
        "target_locale": v.get("target_locale"),
        "blueprint_review_locale": v.get("blueprint_review_locale") or "it-IT",
        "market": market,
        "locale_profile": locale_profile,
        "channel": ai_meta.get("channel") or v.get("editorial_edition") or "SEO Article",
        "status": v.get("status"),
        "status_label": STATUS_LABEL.get(v.get("status") or "", v.get("status") or "—"),
        "scheduled_at": v.get("scheduled_at"),
        "explanation_local": internal_tx.get("explanation") or internal_tx.get("body") or "",
        "ai_notes": ai_meta.get("notes") or [],
        "ai_motivation": ai_meta.get("strategic_motivation") or ai_meta.get("motivation"),
        "ai_keywords": ai_meta.get("keywords") or [],
        "ai_audience": ai_meta.get("audience"),
        "ai_sources": ai_meta.get("sources") or [],
        "proposed_hotspots": proposed,
        "tone": v.get("tone_label"),
        "cultural_angle": v.get("cultural_angle"),
        "is_blocked": (v.get("status") or "") in BLOCKED_STATUSES,
        "updated_at": v.get("updated_at"),
    }


# ── ACTIONS ────────────────────────────────────────────────────────
class _NoteBody(BaseModel):
    notes: Optional[str] = None


def _patch_status(tid: str, variant_id: str, new_status: str, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    payload = {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}
    if extra:
        payload.update(extra)
    r = (db().table("editorial_variants").update(payload)
         .eq("tenant_id", tid).eq("id", variant_id).execute())
    if not r.data:
        raise HTTPException(404, "Variant not found")
    return r.data[0]


@router.post("/editorial/inbox/{variant_id}/approve")
def approve_variant(variant_id: str, ctx=Depends(get_tenant_context)):
    row = _patch_status(ctx["tenant_id"], variant_id, "approved")
    return {"ok": True, "status": row.get("status"), "id": variant_id}


@router.post("/editorial/inbox/{variant_id}/request-revision")
def request_revision(variant_id: str, body: _NoteBody, ctx=Depends(get_tenant_context)):
    tid = ctx["tenant_id"]
    cur = (db().table("editorial_variants").select("ai_meta")
           .eq("tenant_id", tid).eq("id", variant_id).limit(1).execute().data or [])
    if not cur:
        raise HTTPException(404, "Variant not found")
    meta = cur[0].get("ai_meta") or {}
    if not isinstance(meta, dict):
        meta = {}
    notes_list = meta.get("revision_notes") or []
    if not isinstance(notes_list, list):
        notes_list = []
    if body.notes:
        notes_list.append({
            "at": datetime.now(timezone.utc).isoformat(),
            "by": ctx.get("profile_id"),
            "text": body.notes,
        })
    meta["revision_notes"] = notes_list
    row = _patch_status(tid, variant_id, "changes_requested", extra={"ai_meta": meta})
    return {"ok": True, "status": row.get("status"), "notes_count": len(notes_list)}


@router.post("/editorial/inbox/{variant_id}/regenerate")
def regenerate_variant(variant_id: str, ctx=Depends(get_tenant_context)):
    tid = ctx["tenant_id"]
    cur = (db().table("editorial_variants").select("ai_meta")
           .eq("tenant_id", tid).eq("id", variant_id).limit(1).execute().data or [])
    if not cur:
        raise HTTPException(404, "Variant not found")
    meta = cur[0].get("ai_meta") or {}
    if not isinstance(meta, dict):
        meta = {}
    meta["regenerate_requested"] = True
    meta["regenerate_requested_at"] = datetime.now(timezone.utc).isoformat()
    row = _patch_status(tid, variant_id, "draft", extra={"ai_meta": meta})
    return {"ok": True, "status": row.get("status"), "regenerate_requested": True}


@router.post("/editorial/inbox/{variant_id}/publish")
def publish_variant(variant_id: str, ctx=Depends(get_tenant_context)):
    now_iso = datetime.now(timezone.utc).isoformat()
    row = _patch_status(
        ctx["tenant_id"], variant_id, "published",
        extra={"published_at": now_iso, "is_published": True},
    )
    return {"ok": True, "status": row.get("status"), "published_at": row.get("published_at")}
