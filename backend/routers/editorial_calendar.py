"""
Editorial Calendar™ — International Editorial Operations™ aggregator.

ONE endpoint, ONE feed, all editorial events visible in a single timeline:
  • magazine_articles (published + drafts with target schedule)
  • portfolio_projects (published)
  • cms_pages (published + scheduled_publish_at)

This is the operational heart of the platform — what is publishing, where,
when, in which locale, with which CTA target. No conceptual abstractions.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from core.tenant_context import get_tenant_context
from database import db

router = APIRouter(tags=["editorial-calendar"])


def _is_admin(role: str) -> bool:
    return role in ("super_admin", "tenant_admin")


def _locale_to_country(locale: str) -> Dict[str, str]:
    """Map a BCP-47 locale to a country flag + label for the calendar UI."""
    if not locale:
        return {"code": "—", "flag": "🌐", "country": "Global"}
    parts = locale.replace("_", "-").split("-")
    region = parts[1].upper() if len(parts) > 1 else parts[0].upper()
    FLAGS = {
        "US": "🇺🇸", "GB": "🇬🇧", "IT": "🇮🇹", "FR": "🇫🇷",
        "DE": "🇩🇪", "ES": "🇪🇸", "MX": "🇲🇽", "AE": "🇦🇪",
        "JP": "🇯🇵", "SE": "🇸🇪", "NO": "🇳🇴", "CH": "🇨🇭",
    }
    COUNTRIES = {
        "US": "United States", "GB": "United Kingdom", "IT": "Italia",
        "FR": "France", "DE": "Deutschland", "ES": "España",
        "MX": "México", "AE": "United Arab Emirates", "JP": "Japan",
    }
    return {
        "code": region,
        "flag": FLAGS.get(region, "🌐"),
        "country": COUNTRIES.get(region, region),
    }


def _pick_title(locale_content: Optional[Dict[str, Any]], default_locale: str, fallback: str = "—") -> str:
    if not locale_content:
        return fallback
    for key in (default_locale, "it-IT", "en-US"):
        v = (locale_content.get(key) or {}).get("title") if isinstance(locale_content.get(key), dict) else None
        if v:
            return v
    # accept flat shape too
    for v in locale_content.values():
        if isinstance(v, dict) and v.get("title"):
            return v["title"]
    return fallback


@router.get("")
def get_editorial_calendar(
    ctx=Depends(get_tenant_context),
    start: Optional[str] = Query(None, description="ISO date (inclusive)"),
    end:   Optional[str] = Query(None, description="ISO date (exclusive)"),
    type_filter: Optional[str] = Query(None, description="article|project|page"),
):
    if not _is_admin(ctx["role"]):
        raise HTTPException(403, "admin required")
    tenant_id = ctx["tenant_id"]

    # Default window: previous 14 days → next 60 days
    now = datetime.now(timezone.utc)
    start_dt = datetime.fromisoformat(start) if start else now - timedelta(days=14)
    end_dt   = datetime.fromisoformat(end)   if end   else now + timedelta(days=60)
    start_iso, end_iso = start_dt.isoformat(), end_dt.isoformat()

    c = db()
    events: List[Dict[str, Any]] = []

    # ── Magazine articles ─────────────────────────────────────────────
    if not type_filter or type_filter == "article":
        r = (c.table("magazine_articles")
             .select("id,slug,status,locale_content,default_locale,locale_market,published_at,updated_at,category_slug,editorial_tone")
             .eq("tenant_id", tenant_id).execute())
        for a in (r.data or []):
            dt = a.get("published_at") or a.get("updated_at")
            if not dt:
                continue
            try:
                d = datetime.fromisoformat(dt.replace("Z", "+00:00"))
            except Exception:
                continue
            if not (start_dt <= d <= end_dt):
                continue
            loc = a.get("default_locale") or a.get("locale_market") or "en-US"
            country = _locale_to_country(loc)
            events.append({
                "id": f"article-{a['id']}",
                "type": "article",
                "title": _pick_title(a.get("locale_content"), loc, a.get("slug", "—")),
                "slug": a.get("slug"),
                "datetime": d.isoformat(),
                "locale": loc,
                "country": country,
                "status": a.get("status") or "draft",
                "cta_target": "Magazine readers · SEO",
                "seo_goal": a.get("category_slug") or "Editorial",
                "approval_state": "approved" if a.get("status") == "published" else "pending",
                "category": a.get("category_slug"),
                "tone": a.get("editorial_tone"),
                "edit_href": f"/blueprint/editorial?article={a['id']}",
            })

    # ── Portfolio projects ───────────────────────────────────────────
    if not type_filter or type_filter == "project":
        r = (c.table("portfolio_projects")
             .select("id,slug,title,status,published_at,updated_at,default_locale,category,location,year")
             .eq("tenant_id", tenant_id).execute())
        for p in (r.data or []):
            dt = p.get("published_at") or p.get("updated_at")
            if not dt:
                continue
            try:
                d = datetime.fromisoformat(dt.replace("Z", "+00:00"))
            except Exception:
                continue
            if not (start_dt <= d <= end_dt):
                continue
            loc = p.get("default_locale") or "it-IT"
            country = _locale_to_country(loc)
            events.append({
                "id": f"project-{p['id']}",
                "type": "project",
                "title": p.get("title") or p.get("slug", "—"),
                "slug": p.get("slug"),
                "datetime": d.isoformat(),
                "locale": loc,
                "country": country,
                "status": p.get("status") or "draft",
                "cta_target": "Professional consultation",
                "seo_goal": p.get("category") or "Portfolio",
                "approval_state": "approved" if p.get("status") == "published" else "pending",
                "category": p.get("category"),
                "location": p.get("location"),
                "edit_href": f"/blueprint/projects-studio?project={p['id']}",
            })

    # ── Storefront pages ─────────────────────────────────────────────
    if not type_filter or type_filter == "page":
        r = (c.table("cms_pages")
             .select("id,page_key,title,status,scheduled_publish_at,published_at,last_published_at,updated_at")
             .eq("tenant_id", tenant_id).execute())
        for pg in (r.data or []):
            dt = pg.get("scheduled_publish_at") or pg.get("last_published_at") or pg.get("published_at") or pg.get("updated_at")
            if not dt:
                continue
            try:
                d = datetime.fromisoformat(dt.replace("Z", "+00:00"))
            except Exception:
                continue
            if not (start_dt <= d <= end_dt):
                continue
            events.append({
                "id": f"page-{pg['id']}",
                "type": "page",
                "title": pg.get("title") or pg.get("page_key") or "—",
                "slug": pg.get("page_key"),
                "datetime": d.isoformat(),
                "locale": "—",
                "country": {"code": "—", "flag": "🌐", "country": "Global"},
                "status": pg.get("status") or "draft",
                "cta_target": "Storefront orchestration",
                "seo_goal": "Public surface",
                "approval_state": "approved" if pg.get("status") == "published" else "pending",
                "edit_href": f"/blueprint/experience?page={pg.get('page_key')}",
            })

    events.sort(key=lambda e: e["datetime"])

    # ── Stats by market (today's international presence) ─────────────
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end   = today_start + timedelta(days=1)
    by_market: Dict[str, Dict[str, Any]] = {}
    for ev in events:
        code = ev["country"]["code"]
        bucket = by_market.setdefault(code, {
            "code": code, "flag": ev["country"]["flag"],
            "country": ev["country"]["country"],
            "today": 0, "scheduled": 0, "published": 0,
        })
        d = datetime.fromisoformat(ev["datetime"])
        if today_start <= d < today_end:
            bucket["today"] += 1
        if ev["status"] in ("scheduled", "draft") and d >= today_start:
            bucket["scheduled"] += 1
        if ev["status"] == "published":
            bucket["published"] += 1

    return {
        "window": {"start": start_iso, "end": end_iso},
        "events": events,
        "by_market": list(by_market.values()),
        "totals": {
            "events": len(events),
            "published": sum(1 for e in events if e["status"] == "published"),
            "scheduled": sum(1 for e in events if e["status"] in ("scheduled", "draft") and datetime.fromisoformat(e["datetime"]) >= today_start),
            "markets": len(by_market),
        },
    }
