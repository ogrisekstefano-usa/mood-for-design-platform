"""Phase R-MARKET-1A — Markets catalog API.

Three groups of endpoints:

  PLATFORM (Super Admin only):
    GET    /api/markets               — list all markets in the catalog
    GET    /api/markets/{id}          — single market
    POST   /api/markets               — create
    PATCH  /api/markets/{id}          — partial update
    DELETE /api/markets/{id}          — soft-disable (active=false)

  TENANT-OWNER (or super admin impersonating):
    GET   /api/tenants/me/markets             — list with activation state
    PATCH /api/tenants/me/markets/{market_id} — toggle active / order / default

  STOREFRONT PUBLIC (anonymous — for the future Country/Language selector):
    GET   /api/storefront/public/{slug}/markets

The PLATFORM tier is intentionally locked to super_admin: tenants must
learn MOOD's canonical market definitions. A future phase may open the
custom_settings JSONB on tenant_markets so studios can tweak
per-tenant CTA labels without forking the platform catalog.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import db
from middleware.auth import get_current_user
from core.tenant_context import get_tenant_context
from core.permissions import is_super_admin

logger = logging.getLogger(__name__)
router = APIRouter(tags=["markets"])


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not is_super_admin(current_user.get("role")):
        raise HTTPException(403, "Super admin only")
    return current_user


# ─── Models ──────────────────────────────────────────────────────────────

class MarketIn(BaseModel):
    code:               str = Field(..., min_length=2, max_length=64)
    display_name:       Dict[str, str] = Field(default_factory=dict)
    macro_region:       str
    countries:          List[str] = Field(default_factory=list)
    primary_locale:     str
    fallback_locale:    str = "en-US"
    currency:           str = "EUR"
    measurement_system: str = "metric"
    cultural_profile:   Dict[str, Any] = Field(default_factory=dict)
    tone_of_voice:      Dict[str, Any] = Field(default_factory=dict)
    cta_style:          Dict[str, Any] = Field(default_factory=dict)
    seo_intent:         Dict[str, Any] = Field(default_factory=dict)
    sub_regions:        List[Dict[str, Any]] = Field(default_factory=list)
    active:             bool = True
    sort_order:         int = 0


class MarketPatch(BaseModel):
    display_name:       Optional[Dict[str, str]] = None
    macro_region:       Optional[str] = None
    countries:          Optional[List[str]] = None
    primary_locale:     Optional[str] = None
    fallback_locale:    Optional[str] = None
    currency:           Optional[str] = None
    measurement_system: Optional[str] = None
    cultural_profile:   Optional[Dict[str, Any]] = None
    tone_of_voice:      Optional[Dict[str, Any]] = None
    cta_style:          Optional[Dict[str, Any]] = None
    seo_intent:         Optional[Dict[str, Any]] = None
    sub_regions:        Optional[List[Dict[str, Any]]] = None
    active:             Optional[bool] = None
    sort_order:         Optional[int] = None


class TenantMarketPatch(BaseModel):
    is_active:       Optional[bool] = None
    is_default:      Optional[bool] = None
    sort_order:      Optional[int] = None
    custom_settings: Optional[Dict[str, Any]] = None


# ─── Public storefront endpoint (anonymous) ──────────────────────────────

@router.get("/storefront/public/{slug}/markets")
def public_tenant_markets(slug: str):
    """Anonymous endpoint used by the future Country/Language selector.
    Returns ONLY active markets for the tenant, with the public-facing
    fields needed by the storefront (display_name + locale + countries +
    currency + measurement_system + macro_region + sub_regions stub).
    """
    c = db()
    t = (c.table("tenants").select("id,slug").eq("slug", slug).limit(1).execute().data or [])
    if not t:
        raise HTTPException(404, "Tenant not found")
    tid = t[0]["id"]

    tm = (c.table("tenant_markets").select("market_id,is_active,is_default,sort_order")
          .eq("tenant_id", tid).eq("is_active", True)
          .order("sort_order").execute().data or [])
    if not tm:
        return {"tenant_slug": slug, "default_market": None, "markets": []}

    market_ids = [row["market_id"] for row in tm]
    markets = (c.table("markets").select(
        "id,code,display_name,macro_region,countries,primary_locale,"
        "fallback_locale,currency,measurement_system,sub_regions,sort_order"
    ).in_("id", market_ids).eq("active", True).execute().data or [])
    by_id = {m["id"]: m for m in markets}

    default_market = None
    out = []
    for link in tm:
        m = by_id.get(link["market_id"])
        if not m:
            continue
        entry = {**m, "is_default": link["is_default"]}
        if link["is_default"]:
            default_market = entry
        out.append(entry)

    return {
        "tenant_slug":    slug,
        "default_market": default_market,
        "markets":        sorted(out, key=lambda x: (not x["is_default"], x["sort_order"])),
    }


# ─── Tenant-owner endpoints ──────────────────────────────────────────────

@router.get("/tenants/me/markets")
def my_tenant_markets(ctx=Depends(get_tenant_context)):
    """List of markets WITH per-tenant activation state. Returns ALL
    platform markets joined with tenant_markets so the admin UI can show
    activate/deactivate toggles. Active flag comes from tenant_markets
    when a link exists, else defaults to False.
    """
    c = db()
    tid = ctx["tenant_id"]
    all_markets = (c.table("markets").select("*").eq("active", True)
                   .order("sort_order").execute().data or [])
    links = (c.table("tenant_markets").select("*")
             .eq("tenant_id", tid).execute().data or [])
    by_market = {l["market_id"]: l for l in links}
    out = []
    for m in all_markets:
        link = by_market.get(m["id"])
        out.append({
            **m,
            "is_active":       bool(link and link["is_active"]),
            "is_default":      bool(link and link["is_default"]),
            "tenant_sort":     (link or {}).get("sort_order", 999),
            "custom_settings": (link or {}).get("custom_settings", {}),
        })
    out.sort(key=lambda x: (x["tenant_sort"], x["sort_order"]))
    return {"markets": out, "total": len(out)}


@router.patch("/tenants/me/markets/{market_id}")
def patch_my_tenant_market(market_id: str, patch: TenantMarketPatch, ctx=Depends(get_tenant_context)):
    """Toggle a market's activation / order / default flag for the current
    tenant. is_default is mutex (only one default per tenant)."""
    c = db()
    tid = ctx["tenant_id"]

    # Confirm market exists.
    m = (c.table("markets").select("id,active").eq("id", market_id).limit(1).execute().data or [])
    if not m or not m[0]["active"]:
        raise HTTPException(404, "Market not found or inactive")

    body = patch.model_dump(exclude_none=True)
    if not body:
        raise HTTPException(400, "Empty patch")

    body["updated_at"] = _iso()

    # Enforce single-default-per-tenant FIRST (before upsert) so the
    # unique constraint `uq_tenant_markets_default` doesn't fire when we
    # claim is_default on the target row.
    if body.get("is_default"):
        c.table("tenant_markets").update({"is_default": False, "updated_at": _iso()}) \
         .eq("tenant_id", tid).neq("market_id", market_id).execute()

    # Find existing link.
    existing = (c.table("tenant_markets").select("id")
                .eq("tenant_id", tid).eq("market_id", market_id)
                .limit(1).execute().data or [])
    if existing:
        c.table("tenant_markets").update(body).eq("id", existing[0]["id"]).execute()
    else:
        row = {
            "id":          str(uuid.uuid4()),
            "tenant_id":   tid,
            "market_id":   market_id,
            "is_active":   body.get("is_active", True),
            "is_default":  body.get("is_default", False),
            "sort_order":  body.get("sort_order", 0),
            "custom_settings": body.get("custom_settings", {}),
            "activated_at": _iso(),
            "updated_at":  _iso(),
        }
        c.table("tenant_markets").insert(row).execute()

    return {"ok": True}


# ─── Super-admin platform endpoints ──────────────────────────────────────

@router.get("/markets")
def list_markets(_=Depends(_require_super_admin)):
    c = db()
    rows = c.table("markets").select("*").order("sort_order").execute().data or []
    return {"markets": rows, "total": len(rows)}


@router.get("/markets/{market_id}")
def get_market(market_id: str, _=Depends(_require_super_admin)):
    c = db()
    m = (c.table("markets").select("*").eq("id", market_id).limit(1).execute().data or [])
    if not m:
        raise HTTPException(404, "Market not found")
    return m[0]


@router.post("/markets")
def create_market(payload: MarketIn, _=Depends(_require_super_admin)):
    c = db()
    row = payload.model_dump()
    row["id"] = str(uuid.uuid4())
    row["created_at"] = _iso()
    row["updated_at"] = _iso()
    try:
        c.table("markets").insert(row).execute()
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(409, f"Market with code '{payload.code}' already exists")
        raise
    return row


@router.patch("/markets/{market_id}")
def patch_market(market_id: str, patch: MarketPatch, _=Depends(_require_super_admin)):
    c = db()
    body = patch.model_dump(exclude_none=True)
    if not body:
        raise HTTPException(400, "Empty patch")
    body["updated_at"] = _iso()
    r = c.table("markets").update(body).eq("id", market_id).execute()
    if not r.data:
        raise HTTPException(404, "Market not found")
    return r.data[0]


@router.delete("/markets/{market_id}")
def soft_delete_market(market_id: str, _=Depends(_require_super_admin)):
    c = db()
    r = c.table("markets").update({"active": False, "updated_at": _iso()}) \
         .eq("id", market_id).execute()
    if not r.data:
        raise HTTPException(404, "Market not found")
    return {"ok": True}
