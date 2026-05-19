"""
market_intelligence.py — Phase 1 Foundation API.
═══════════════════════════════════════════════════════════════════════
Endpoints for the Market Intelligence Engine™. Read-mostly foundation —
NO AI inference, NO pattern recognition. Phase 1 = clean architecture.

  GET  /api/market-intelligence/submarkets        — taxonomy (public, no auth)
  POST /api/market-intelligence/events            — anonymous signal ingest
  GET  /api/market-intelligence/insights          — tenant editorial briefs
  GET  /api/market-intelligence/health            — system status
  GET  /api/market-intelligence/adapters          — tenant Brand Voice Adapters
  PATCH/api/market-intelligence/adapters          — update adapters (one or more)
  GET  /api/market-intelligence/aggregates        — read pre-computed signal rollups
  POST /api/market-intelligence/aggregates/recompute — recompute rollups for tenant
"""
from __future__ import annotations

import hashlib
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/market-intelligence", tags=["market-intelligence"])


# ───────────────────────────────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────────────────────────────
def _session_hash(req: Request, tenant_hint: Optional[str] = None) -> str:
    """
    Generate a privacy-preserving rotating session hash.
      HMAC-style: SHA256(daily_salt + ip + ua + tenant_hint)
    Never stores raw IP. Rotates daily (the salt is the UTC date string),
    so identifying the same anonymous visitor across days is impossible.
    """
    daily_salt = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    client_ip = (req.headers.get("x-forwarded-for") or req.client.host or "0.0.0.0").split(",")[0].strip()
    ua = (req.headers.get("user-agent") or "")[:200]
    secret = os.environ.get("MARKET_SIGNAL_SALT", "mood-mi-2026")
    raw = f"{secret}|{daily_salt}|{client_ip}|{ua}|{tenant_hint or ''}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _strip_pii(event_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Drop common PII fields if a client accidentally sends them.
    The frontend hook should never include these — defense in depth.
    """
    if not isinstance(event_data, dict):
        return {}
    BLOCKED = {"email", "phone", "name", "first_name", "last_name", "address",
               "ip", "ip_address", "lat", "lng", "latitude", "longitude",
               "user_id", "session_id", "cookie", "device_id", "fingerprint"}
    return {k: v for k, v in event_data.items() if k.lower() not in BLOCKED}


def _normalize_geo(req: Request) -> Dict[str, Optional[str]]:
    """
    Read coarse geo hints from edge headers — region-level only.
    Compatible with Cloudflare / Vercel / Fastly headers when present.
    """
    h = req.headers
    return {
        "geo_country": (h.get("cf-ipcountry") or h.get("x-vercel-ip-country") or "")[:2].upper() or None,
        "geo_region":  (h.get("cf-region-code") or h.get("x-vercel-ip-country-region") or "")[:8] or None,
        "geo_city":    (h.get("cf-ipcity") or h.get("x-vercel-ip-city") or "")[:64] or None,
    }


def _safe_submarket(row: Dict[str, Any]) -> Dict[str, Any]:
    """Drop server-only fields for public taxonomy responses."""
    return {k: v for k, v in row.items() if k not in ("id", "created_at", "updated_at")}


# ───────────────────────────────────────────────────────────────────────
# 1 · SUBMARKETS (taxonomy)
# ───────────────────────────────────────────────────────────────────────
@router.get("/submarkets")
def list_submarkets(
    market: Optional[str] = Query(None, description="Filter by macro_market_code"),
    country: Optional[str] = Query(None, description="Filter by ISO country code"),
):
    """Public taxonomy — designer-facing keyword arrays per submarket."""
    c = db()
    q = c.table("market_submarkets").select("*").eq("active", True).order("sort_order")
    if market:
        q = q.eq("macro_market_code", market)
    if country:
        q = q.eq("country_code", country.upper())
    rows = q.execute().data or []
    return {"submarkets": [_safe_submarket(r) for r in rows]}


# ───────────────────────────────────────────────────────────────────────
# 2 · EVENTS (anonymous signal ingest)
# ───────────────────────────────────────────────────────────────────────
class EventIn(BaseModel):
    tenant_id:      str
    event_type:     str = Field(..., max_length=64)
    market_code:    Optional[str] = Field(None, max_length=64)
    submarket_code: Optional[str] = Field(None, max_length=64)
    locale_code:    Optional[str] = Field(None, max_length=16)
    event_data:     Optional[Dict[str, Any]] = None


ALLOWED_EVENT_TYPES = {
    "gallery_open", "gallery_view_complete",
    "hotspot_open", "hotspot_complete",
    "article_open", "article_read",
    "cta_open", "cta_submit", "cta_click",
    "project_view", "project_complete",
    "material_focus", "material_zoom",
    "moodboard_view", "moodboard_share",
    "image_engage", "image_zoom",
    "session_start", "session_end",
}


@router.post("/events", status_code=204)
def ingest_event(body: EventIn, req: Request):
    """
    Anonymous signal ingestion. No auth required (public storefronts ingest
    their own traffic). All PII stripped server-side.
    """
    if body.event_type not in ALLOWED_EVENT_TYPES:
        raise HTTPException(400, f"unknown event_type: {body.event_type}")

    # Verify tenant exists & active
    c = db()
    t = c.table("tenants").select("id").eq("id", body.tenant_id).limit(1).execute().data
    if not t:
        raise HTTPException(404, "tenant not found")

    geo = _normalize_geo(req)
    record = {
        "tenant_id":      body.tenant_id,
        "session_hash":   _session_hash(req, body.tenant_id),
        "market_code":    body.market_code,
        "submarket_code": body.submarket_code,
        "locale_code":    body.locale_code,
        "event_type":     body.event_type,
        "event_data":     _strip_pii(body.event_data),
        **geo,
    }
    try:
        c.table("market_behavior_events").insert(record).execute()
    except Exception:
        # Fire-and-forget — ingestion failures must never break visitor UX.
        pass
    return None


# ───────────────────────────────────────────────────────────────────────
# 3 · INSIGHTS (editorial narratives for the tenant)
# ───────────────────────────────────────────────────────────────────────
@router.get("/insights")
def list_insights(
    user: Dict[str, Any] = Depends(get_current_user),
    market: Optional[str] = Query(None),
    submarket: Optional[str] = Query(None),
    status: str = Query("published"),
):
    """
    Tenant-scoped editorial insights. Phase 1 returns whatever has been
    seeded/generated externally; the AI generation pipeline lives in
    Phase 2 and writes into this same table.
    """
    tenant_id = user.get("tenant_id") or user.get("active_tenant_id")
    if not tenant_id:
        return {"insights": [], "tenant_id": None}

    c = db()
    q = (c.table("market_insights")
           .select("id, market_code, submarket_code, locale_code, insight_type, "
                   "headline, narrative, recommendation, status, generated_at")
           .eq("tenant_id", tenant_id))
    if status and status != "all":
        q = q.eq("status", status)
    if market:
        q = q.eq("market_code", market)
    if submarket:
        q = q.eq("submarket_code", submarket)
    rows = q.order("generated_at", desc=True).limit(60).execute().data or []
    return {"insights": rows, "tenant_id": tenant_id}


# ───────────────────────────────────────────────────────────────────────
# 4 · HEALTH (system foundation status)
# ───────────────────────────────────────────────────────────────────────
@router.get("/health")
def health(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Foundation health: counts of submarkets, recent events for this tenant,
    and current insight inventory. Editorial-facing — NO CTR%, NO bounces.
    """
    tenant_id = user.get("tenant_id") or user.get("active_tenant_id")
    c = db()
    sm_count = (c.table("market_submarkets").select("id", count="exact")
                 .eq("active", True).execute().count) or 0
    ev_count_24h = 0
    insights_count = 0
    if tenant_id:
        # supabase-py count via head=True is the standard way to count
        since = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        ev = (c.table("market_behavior_events").select("id", count="exact")
                .eq("tenant_id", tenant_id).execute())
        ev_count_24h = ev.count or 0
        ins = (c.table("market_insights").select("id", count="exact")
                 .eq("tenant_id", tenant_id).eq("status", "published").execute())
        insights_count = ins.count or 0
    return {
        "phase": 1,
        "system": "Market Intelligence Engine™",
        "status": "listening",
        "submarkets_active": sm_count,
        "events_total":      ev_count_24h,
        "insights_published": insights_count,
        "ai_inference_enabled": False,
        "tenant_id": tenant_id,
    }


# ───────────────────────────────────────────────────────────────────────
# 5 · BRAND VOICE ADAPTERS (tenant-owned)
# ───────────────────────────────────────────────────────────────────────
#
# 8 editorial dimensions, each a small signed integer from -2 to +2,
# centered at 0 (neutral — let the cultural foundation speak).
# These DO NOT modify macro cultural foundations; they orient the
# brand voice WITHIN them.

ADAPTER_KEYS = [
    "tone_warmth",
    "hospitality_level",
    "visual_boldness",
    "editorial_pacing",
    "architectural_intensity",
    "emotional_intensity",
    "material_storytelling",
    "cta_style",
]


def _validate_adapters(payload: Dict[str, Any]) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for k, v in (payload or {}).items():
        if k not in ADAPTER_KEYS:
            continue
        try:
            iv = int(v)
        except (TypeError, ValueError):
            raise HTTPException(400, f"adapter '{k}' must be integer in [-2,+2]")
        if iv < -2 or iv > 2:
            raise HTTPException(400, f"adapter '{k}' out of range [-2,+2]")
        out[k] = iv
    return out


@router.get("/adapters")
def get_adapters(user: Dict[str, Any] = Depends(get_current_user)):
    tenant_id = user.get("tenant_id") or user.get("active_tenant_id")
    if not tenant_id:
        raise HTTPException(404, "tenant not resolved")
    c = db()
    row = (c.table("tenants").select("brand_voice_adapters")
            .eq("id", tenant_id).limit(1).execute().data)
    current = (row[0].get("brand_voice_adapters") if row else {}) or {}
    # Provide explicit default values for any missing keys
    return {
        "adapters": {k: int(current.get(k, 0)) for k in ADAPTER_KEYS},
        "keys": ADAPTER_KEYS,
        "range": [-2, 2],
    }


class AdaptersPatch(BaseModel):
    adapters: Dict[str, Any] = Field(default_factory=dict)


@router.patch("/adapters")
def update_adapters(body: AdaptersPatch, user: Dict[str, Any] = Depends(get_current_user)):
    tenant_id = user.get("tenant_id") or user.get("active_tenant_id")
    if not tenant_id:
        raise HTTPException(404, "tenant not resolved")
    role = user.get("role") or user.get("active_role") or ""
    if role not in ("super_admin", "tenant_admin", "studio_admin", "owner"):
        raise HTTPException(403, "admins only")
    patch = _validate_adapters(body.adapters)
    c = db()
    row = (c.table("tenants").select("brand_voice_adapters")
            .eq("id", tenant_id).limit(1).execute().data)
    existing = (row[0].get("brand_voice_adapters") if row else {}) or {}
    merged = {**existing, **patch}
    c.table("tenants").update({"brand_voice_adapters": merged}).eq("id", tenant_id).execute()
    return {"adapters": {k: int(merged.get(k, 0)) for k in ADAPTER_KEYS}}


# ───────────────────────────────────────────────────────────────────────
# 6 · SIGNAL AGGREGATES (read + recompute)
# ───────────────────────────────────────────────────────────────────────
@router.get("/aggregates")
def list_aggregates(
    user: Dict[str, Any] = Depends(get_current_user),
    window: str = Query("7d", regex="^(24h|7d|30d)$"),
    submarket: Optional[str] = Query(None),
):
    """
    Pre-computed signal rollups. Editorial-facing — counts only, NEVER
    raw rates. The frontend uses these to render passive presence
    indicators (NOT CTR%).
    """
    tenant_id = user.get("tenant_id") or user.get("active_tenant_id")
    if not tenant_id:
        return {"aggregates": [], "window": window}
    c = db()
    q = (c.table("market_signal_aggregates").select("*")
           .eq("tenant_id", tenant_id).eq("window_key", window))
    if submarket:
        q = q.eq("submarket_code", submarket)
    rows = q.order("event_count", desc=True).limit(120).execute().data or []
    return {"aggregates": rows, "window": window}


@router.post("/aggregates/recompute")
def recompute_aggregates(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Recompute aggregates for THIS tenant only. Phase 1 = on-demand
    (admins press a button or it runs at low frequency). Phase 2 will
    schedule this via a cron worker.
    """
    tenant_id = user.get("tenant_id") or user.get("active_tenant_id")
    if not tenant_id:
        raise HTTPException(404, "tenant not resolved")
    role = user.get("role") or user.get("active_role") or ""
    if role not in ("super_admin", "tenant_admin", "studio_admin", "owner"):
        raise HTTPException(403, "admins only")

    c = db()
    now = datetime.now(timezone.utc)
    windows = {
        "24h": now - timedelta(hours=24),
        "7d":  now - timedelta(days=7),
        "30d": now - timedelta(days=30),
    }
    # Aggregate in-memory (Phase 1 is read-mostly; a tenant rarely has
    # more than ~50k events in 30d which fits comfortably in memory).
    rebuilt = 0
    for window_key, since in windows.items():
        rows = (c.table("market_behavior_events")
                  .select("market_code, submarket_code, event_type, session_hash, created_at")
                  .eq("tenant_id", tenant_id)
                  .gte("created_at", since.isoformat())
                  .limit(50000)
                  .execute().data or [])
        buckets: Dict[tuple, Dict[str, Any]] = {}
        for r in rows:
            key = (r.get("market_code") or "", r.get("submarket_code") or "", r.get("event_type"))
            b = buckets.setdefault(key, {"count": 0, "sessions": set(), "last": None})
            b["count"] += 1
            if r.get("session_hash"):
                b["sessions"].add(r["session_hash"])
            ts = r.get("created_at")
            if ts and (b["last"] is None or ts > b["last"]):
                b["last"] = ts

        # Wipe previous aggregates for this tenant + window, then bulk-insert
        c.table("market_signal_aggregates").delete() \
            .eq("tenant_id", tenant_id).eq("window_key", window_key).execute()

        if buckets:
            insert_rows = [{
                "tenant_id":       tenant_id,
                "market_code":     k[0] or None,
                "submarket_code":  k[1] or None,
                "event_type":      k[2],
                "window_key":      window_key,
                "event_count":     v["count"],
                "unique_sessions": len(v["sessions"]),
                "last_event_at":   v["last"],
            } for k, v in buckets.items()]
            c.table("market_signal_aggregates").insert(insert_rows).execute()
            rebuilt += len(insert_rows)

    return {"ok": True, "rebuilt_rows": rebuilt, "tenant_id": tenant_id, "computed_at": now.isoformat()}
