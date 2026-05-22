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
import re
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from core.tenant_context import get_tenant_context
from database import db

router = APIRouter(tags=["editorial-calendar"])


# ── ITER131hf · Intelligence suggestions localisation ────────────────────
# The intelligence rules below emit Italian copy by default. Translate it
# on the way out so EN-US toasts never carry IT text.
_INTEL_EN = {
    "under-published": {
        "title": "Market {region} has no recent publications",
        "body":  "No releases in the past 30 days for {region}. Schedule at least one magazine piece or project to keep SEO saturation alive.",
        "cta_label": "Plan content",
    },
    "seo-pressure": {
        "title": "Low SEO pressure",
        "body":  "In the past 30 days you have published many projects but few editorial pieces. Articles drive international discoverability.",
        "cta_label": "Open Magazine Studio",
    },
    "authority-gap": {
        "title": "Authority gap on projects",
        "body":  "Strong editorial rhythm but very few projects published. Two or three case studies will lift authority and professional conversion.",
        "cta_label": "Open Projects Studio",
    },
    "empty-pipeline": {
        "title": "Editorial pipeline empty",
        "body":  "Nothing scheduled in the future. International presence needs continuity — plan at least four releases across the next four weeks.",
        "cta_label": "Open Editorial Calendar",
    },
    "primary-cadence": {
        "title": "Low cadence in the primary market ({region})",
        "body":  "The primary market needs a minimum of two to three releases per month to consolidate authority.",
        "cta_label": "Plan in the primary market",
    },
}


def _localize_suggestions(suggestions: List[Dict[str, Any]], request: Request) -> List[Dict[str, Any]]:
    """Translate the operational-intelligence suggestion strings.

    When `Accept-Language` does not start with `it`, we replace the IT
    copy with the editorial English variant defined above (keeping the
    same shape and the same `kind` / `severity` codes). When IT, the
    payload passes through unchanged."""
    al = (request.headers.get('Accept-Language') or '').lower()
    if al.startswith('it'):
        return suggestions
    out = []
    for s in suggestions:
        kind = s.get('kind')
        spec = _INTEL_EN.get(kind)
        if not spec:
            out.append(s)
            continue
        region = ''
        # Recover region from the title format strings.
        m = re.search(r'\(([A-Z]{2,3})\)', s.get('title', ''))
        if m:
            region = m.group(1)
        else:
            m2 = re.search(r'Mercato ([A-Z]{2,3})', s.get('title', ''))
            if m2:
                region = m2.group(1)
        out.append({
            **s,
            "title":     spec["title"].format(region=region) if region else spec["title"].split(' ({region})')[0],
            "body":      spec["body"].format(region=region)  if region else spec["body"],
            "cta_label": spec["cta_label"],
        })
    return out


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
             .select("id,slug,status,locale_content,default_locale,locale_market,published_at,updated_at,category_slug,editorial_tone,cover_url")
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
            # Pull excerpt from locale_content
            lc = a.get("locale_content") or {}
            excerpt = ""
            for k in (loc, "it-IT", "en-US"):
                v = lc.get(k) if isinstance(lc.get(k), dict) else None
                if v and v.get("excerpt"):
                    excerpt = v["excerpt"]
                    break
            events.append({
                "id": f"article-{a['id']}",
                "type": "article",
                "title": _pick_title(a.get("locale_content"), loc, a.get("slug", "—")),
                "excerpt": excerpt,
                "slug": a.get("slug"),
                "cover_url": a.get("cover_url"),
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
                "public_url": f"/magazine/{a.get('slug')}",
            })

    # ── Portfolio projects ───────────────────────────────────────────
    if not type_filter or type_filter == "project":
        r = (c.table("portfolio_projects")
             .select("id,slug,title,status,published_at,updated_at,default_locale,category,location,year,cover_image_url")
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
                "excerpt": p.get("location") or "",
                "slug": p.get("slug"),
                "cover_url": p.get("cover_image_url"),
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
                "public_url": f"/projects/{p.get('slug')}",
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
                "excerpt": "",
                "slug": pg.get("page_key"),
                "cover_url": None,
                "datetime": d.isoformat(),
                "locale": "—",
                "country": {"code": "—", "flag": "🌐", "country": "Global"},
                "status": pg.get("status") or "draft",
                "cta_target": "Storefront orchestration",
                "seo_goal": "Public surface",
                "approval_state": "approved" if pg.get("status") == "published" else "pending",
                "edit_href": f"/blueprint/experience?page={pg.get('page_key')}",
                "public_url": "/" if pg.get("page_key") == "home" else f"/{pg.get('page_key')}",
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


# ────────────────────────────────────────────────────────────────────────
# SCHEDULING — drag&drop endpoint
# ────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel


class RescheduleBody(BaseModel):
    datetime: str  # ISO 8601


@router.patch("/{event_id}/schedule")
def reschedule_event(event_id: str, body: RescheduleBody, ctx=Depends(get_tenant_context)):
    """Update the scheduled_publish_at / published_at of an event by dragging it
    onto another date in the calendar. event_id format: `{type}-{uuid}`.

    • article → magazine_articles.published_at + status='scheduled' (kept 'published' if already)
    • project → portfolio_projects.published_at + status='scheduled' (kept 'published' if already)
    • page    → cms_pages.scheduled_publish_at (status moves to 'scheduled' if currently draft)
    """
    if not _is_admin(ctx["role"]):
        raise HTTPException(403, "admin required")
    if "-" not in event_id:
        raise HTTPException(400, "invalid event_id")
    etype, eid = event_id.split("-", 1)
    try:
        new_dt = datetime.fromisoformat(body.datetime.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(400, "invalid datetime")
    iso = new_dt.isoformat()
    c = db()
    table, payload = None, {}
    if etype == "article":
        table = "magazine_articles"
        cur = (c.table(table).select("status").eq("id", eid).eq("tenant_id", ctx["tenant_id"]).limit(1).execute())
        if not cur.data:
            raise HTTPException(404)
        status = cur.data[0].get("status") or "draft"
        payload = {"published_at": iso, "status": "scheduled" if status != "published" else "published"}
    elif etype == "project":
        table = "portfolio_projects"
        cur = (c.table(table).select("status").eq("id", eid).eq("tenant_id", ctx["tenant_id"]).limit(1).execute())
        if not cur.data:
            raise HTTPException(404)
        status = cur.data[0].get("status") or "draft"
        payload = {"published_at": iso, "status": "scheduled" if status != "published" else "published"}
    elif etype == "page":
        table = "cms_pages"
        cur = (c.table(table).select("status").eq("id", eid).eq("tenant_id", ctx["tenant_id"]).limit(1).execute())
        if not cur.data:
            raise HTTPException(404)
        status = cur.data[0].get("status") or "draft"
        payload = {"scheduled_publish_at": iso, "status": "scheduled" if status == "draft" else status}
    else:
        raise HTTPException(400, "unknown event type")
    c.table(table).update(payload).eq("id", eid).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True, "event_id": event_id, "datetime": iso, "type": etype}


# ────────────────────────────────────────────────────────────────────────
# OPERATIONS INTELLIGENCE — rule-based market/CTA/SEO suggestions
# ────────────────────────────────────────────────────────────────────────
@router.get("/intelligence")
def operations_intelligence(request: Request, ctx=Depends(get_tenant_context)):
    if not _is_admin(ctx["role"]):
        raise HTTPException(403, "admin required")
    tenant_id = ctx["tenant_id"]
    c = db()
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=30)

    arts = (c.table("magazine_articles")
              .select("id,locale_market,default_locale,published_at,status,category_slug")
              .eq("tenant_id", tenant_id).execute()).data or []
    pjs = (c.table("portfolio_projects")
             .select("id,default_locale,published_at,status,category")
             .eq("tenant_id", tenant_id).execute()).data or []
    # Active markets via tenant_markets→markets join
    tm = (c.table("tenant_markets").select("market_id,is_active,is_default").eq("tenant_id", tenant_id).eq("is_active", True).execute()).data or []
    market_ids = [m["market_id"] for m in tm if m.get("market_id")]
    markets = []
    if market_ids:
        mrows = (c.table("markets").select("id,code,primary_locale").in_("id", market_ids).execute()).data or []
        id2m = {m["id"]: m for m in mrows}
        for t in tm:
            m = id2m.get(t.get("market_id"))
            if not m:
                continue
            markets.append({
                "locale_code": m.get("primary_locale") or m.get("code") or "",
                "is_primary": bool(t.get("is_default")),
                "is_published": bool(t.get("is_active")),
            })

    # Aggregate by market locale
    by_locale: Dict[str, Dict[str, int]] = {}
    for a in arts:
        loc = (a.get("default_locale") or a.get("locale_market") or "—").split("-")[-1].upper()
        bucket = by_locale.setdefault(loc, {"articles_total": 0, "articles_30d": 0, "projects_total": 0, "projects_30d": 0})
        bucket["articles_total"] += 1
        dt = a.get("published_at")
        if dt:
            try:
                d = datetime.fromisoformat(dt.replace("Z", "+00:00"))
                if d >= window_start:
                    bucket["articles_30d"] += 1
            except Exception:
                pass
    for p in pjs:
        loc = (p.get("default_locale") or "—").split("-")[-1].upper()
        bucket = by_locale.setdefault(loc, {"articles_total": 0, "articles_30d": 0, "projects_total": 0, "projects_30d": 0})
        bucket["projects_total"] += 1
        dt = p.get("published_at")
        if dt:
            try:
                d = datetime.fromisoformat(dt.replace("Z", "+00:00"))
                if d >= window_start:
                    bucket["projects_30d"] += 1
            except Exception:
                pass

    suggestions: List[Dict[str, Any]] = []
    active_markets = [m["locale_code"] for m in markets if m.get("is_published") or m.get("is_primary")]

    # ── Rule 1: Markets activated but with no publications in 30 days ──
    for code in active_markets:
        region = code.split("-")[-1].upper()
        b = by_locale.get(region, {"articles_30d": 0, "projects_30d": 0})
        if b["articles_30d"] + b["projects_30d"] == 0:
            suggestions.append({
                "severity": "high",
                "kind": "under-published",
                "title": f"Mercato {region} senza pubblicazioni",
                "body": f"Nessuna uscita negli ultimi 30 giorni per {region}. Pianifica almeno un articolo magazine o un progetto per mantenere la saturazione SEO.",
                "cta_label": "Pianifica contenuto",
                "cta_href": "/blueprint/editorial",
            })

    # ── Rule 2: Article-to-project imbalance (last 30d) ──
    total_30 = sum(b["articles_30d"] + b["projects_30d"] for b in by_locale.values())
    if total_30 > 0:
        arts_30 = sum(b["articles_30d"] for b in by_locale.values())
        ratio = arts_30 / total_30
        if ratio < 0.3:
            suggestions.append({
                "severity": "medium",
                "kind": "seo-pressure",
                "title": "SEO pressure bassa",
                "body": "Negli ultimi 30 giorni hai pubblicato molti progetti ma pochi articoli editoriali. Gli articoli generano discoverability internazionale.",
                "cta_label": "Apri Magazine Studio",
                "cta_href": "/blueprint/editorial",
            })
        elif ratio > 0.8 and len([p for p in pjs if p.get("status") == "published"]) < 6:
            suggestions.append({
                "severity": "medium",
                "kind": "authority-gap",
                "title": "Authority gap progetti",
                "body": "Forte ritmo editoriale ma pochi progetti pubblicati. Pubblicare 2-3 case study aumenta authority e conversione professional.",
                "cta_label": "Apri Projects Studio",
                "cta_href": "/blueprint/projects-studio",
            })

    # ── Rule 3: Empty calendar going forward ──
    future_count = sum(1 for a in arts if a.get("published_at") and datetime.fromisoformat(a["published_at"].replace("Z","+00:00")) > now)
    future_count += sum(1 for p in pjs if p.get("published_at") and datetime.fromisoformat(p["published_at"].replace("Z","+00:00")) > now)
    if future_count == 0:
        suggestions.append({
            "severity": "high",
            "kind": "empty-pipeline",
            "title": "Pipeline editoriale vuota",
            "body": "Nessuna pubblicazione programmata nel futuro. La presenza internazionale richiede continuità: pianifica almeno 4 uscite nelle prossime 4 settimane.",
            "cta_label": "Apri Editorial Calendar",
            "cta_href": "/blueprint/editorial-calendar",
        })

    # ── Rule 4: Primary market under-served ──
    primary = next((m for m in markets if m.get("is_primary")), None)
    if primary:
        region = (primary.get("locale_code") or "").split("-")[-1].upper()
        b = by_locale.get(region, {"articles_30d": 0, "projects_30d": 0})
        if b["articles_30d"] + b["projects_30d"] < 2:
            suggestions.append({
                "severity": "medium",
                "kind": "primary-cadence",
                "title": f"Cadenza bassa nel mercato primario ({region})",
                "body": "Il mercato primario richiede un ritmo minimo di 2-3 uscite/mese per consolidare authority.",
                "cta_label": "Pianifica nel mercato primario",
                "cta_href": "/blueprint/editorial-calendar",
            })

    return {
        "suggestions": _localize_suggestions(suggestions, request),
        "by_locale": by_locale,
        "window_days": 30,
    }
