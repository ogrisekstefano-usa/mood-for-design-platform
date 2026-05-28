"""ITER168 · Atmospheric Panels™ router (Blueprint Chameleon™ Layer).

Public reader + admin governance for the Emotional Interpretation Layer.

  · GET  /api/atmospheric/panels       → public list (filterable)
  · GET  /api/atmospheric/panels/{slug} → public detail
  · GET  /api/admin/atmospheric/panels  → admin list (incl. inactive)
  · POST /api/admin/atmospheric/panels  → upsert
  · DELETE /api/admin/atmospheric/panels/{id} → soft-delete (active=false)

The "interpretation" + "title" support per-locale overrides via the
`atmospheric_panel_locales` table.
"""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field

from database import db
from middleware.auth import require_root_superadmin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["atmospheric-panels"])


# ── Schemas ──────────────────────────────────────────────────────────
class AtmosphericPanelOut(BaseModel):
    id: str
    slug: str
    title: str
    emotional_tone: str
    light_temperature: str
    spatial_density: str
    motion_level: str
    materiality: List[str]
    cultural_influence: List[str]
    hospitality_index: int
    visual_assets: list
    overlay_tone: Optional[str] = None
    interpretation: Optional[str] = None
    locale_affinity: List[str]
    market_affinity: List[str]
    display_order: int
    active: bool


class AtmosphericPanelIn(BaseModel):
    slug: str
    title: str
    emotional_tone: str = Field(default='calm')
    light_temperature: str = Field(default='neutral')
    spatial_density: str = Field(default='minimal')
    motion_level: str = Field(default='still')
    materiality: List[str] = []
    cultural_influence: List[str] = []
    hospitality_index: int = 50
    visual_assets: list = []
    overlay_tone: Optional[str] = None
    interpretation: Optional[str] = None
    locale_affinity: List[str] = []
    market_affinity: List[str] = []
    display_order: int = 100
    active: bool = True


# ── Helpers ─────────────────────────────────────────────────────────
def _apply_locale_override(row: dict, locale: Optional[str]) -> dict:
    """If a per-locale override exists, merge it into the row."""
    if not locale:
        return row
    try:
        c = db()
        ov = (c.table('atmospheric_panel_locales')
              .select('title, interpretation')
              .eq('panel_id', row['id']).eq('locale', locale).limit(1)
              .execute())
        if ov.data:
            o = ov.data[0]
            if o.get('title'):
                row['title'] = o['title']
            if o.get('interpretation'):
                row['interpretation'] = o['interpretation']
    except Exception:
        pass
    return row


# ── PUBLIC endpoints ─────────────────────────────────────────────────
@router.get("/atmospheric/panels", response_model=List[AtmosphericPanelOut])
def list_panels(
    locale: Optional[str]  = Query(default=None, max_length=10),
    market: Optional[str]  = Query(default=None, max_length=4),
    tone:   Optional[str]  = Query(default=None, max_length=20),
    limit:  int            = Query(default=12, ge=1, le=60),
):
    """List active platform Atmospheric Panels, optionally filtered.

    Chameleon™ orchestration parameters:
      • `locale` — soft filter against `locale_affinity` (no result ⇒ all)
      • `market` — soft filter against `market_affinity`  (no result ⇒ all)
      • `tone`   — exact `emotional_tone` match
    """
    try:
        c = db()
        q = c.table('atmospheric_panels').select('*').eq('active', True)
        if tone:
            q = q.eq('emotional_tone', tone)
        rows = q.order('display_order', desc=False).limit(limit).execute().data or []

        def _affinity_match(row, locale_v, market_v):
            la = row.get('locale_affinity') or []
            ma = row.get('market_affinity') or []
            if locale_v and la and locale_v not in la:
                # Soft fallback: base lang (it from it-IT)
                base = (locale_v.split('-')[0] or '').lower()
                if not any((x or '').lower().startswith(base + '-') for x in la):
                    return False
            if market_v and ma and market_v.upper() not in [m.upper() for m in ma]:
                return False
            return True

        rows = [r for r in rows if _affinity_match(r, locale, market)]
        rows = [_apply_locale_override(r, locale) for r in rows]
        rows = [_serialize(r) for r in rows]
        return rows
    except Exception as e:
        logger.exception("list_panels failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/atmospheric/panels/{slug}", response_model=AtmosphericPanelOut)
def get_panel(slug: str, locale: Optional[str] = None):
    try:
        c = db()
        r = (c.table('atmospheric_panels').select('*')
             .eq('slug', slug).eq('active', True).limit(1).execute())
        if not r.data:
            raise HTTPException(status_code=404, detail="panel_not_found")
        row = _apply_locale_override(r.data[0], locale)
        return _serialize(row)
    except HTTPException:
        raise
    except Exception:
        logger.exception("get_panel failed")
        raise HTTPException(status_code=500, detail="panel_error")


# ── ADMIN endpoints (root superadmin only) ──────────────────────────
@router.get("/admin/atmospheric/panels", response_model=List[AtmosphericPanelOut])
def admin_list(_=Depends(require_root_superadmin)):
    c = db()
    rows = (c.table('atmospheric_panels').select('*')
            .order('display_order', desc=False).execute().data or [])
    return [_serialize(r) for r in rows]


@router.post("/admin/atmospheric/panels", response_model=AtmosphericPanelOut)
def admin_upsert(body: AtmosphericPanelIn, _=Depends(require_root_superadmin)):
    c = db()
    payload = body.model_dump()
    existing = (c.table('atmospheric_panels').select('id')
                .eq('slug', body.slug).is_('tenant_id', 'null').limit(1)
                .execute().data or [])
    if existing:
        c.table('atmospheric_panels').update(payload).eq('id', existing[0]['id']).execute()
        pid = existing[0]['id']
    else:
        r = c.table('atmospheric_panels').insert(payload).execute()
        pid = r.data[0]['id']
    final = c.table('atmospheric_panels').select('*').eq('id', pid).limit(1).execute().data[0]
    return _serialize(final)


@router.delete("/admin/atmospheric/panels/{panel_id}")
def admin_soft_delete(panel_id: str, _=Depends(require_root_superadmin)):
    c = db()
    c.table('atmospheric_panels').update({'active': False}).eq('id', panel_id).execute()
    return {"ok": True, "id": panel_id}


# ── Serializer ──────────────────────────────────────────────────────
def _serialize(r: dict) -> dict:
    return {
        "id":                 r["id"],
        "slug":               r["slug"],
        "title":              r["title"],
        "emotional_tone":     r["emotional_tone"],
        "light_temperature":  r["light_temperature"],
        "spatial_density":    r["spatial_density"],
        "motion_level":       r["motion_level"],
        "materiality":        r.get("materiality") or [],
        "cultural_influence": r.get("cultural_influence") or [],
        "hospitality_index":  r.get("hospitality_index") or 50,
        "visual_assets":      r.get("visual_assets") or [],
        "overlay_tone":       r.get("overlay_tone"),
        "interpretation":     r.get("interpretation"),
        "locale_affinity":    r.get("locale_affinity") or [],
        "market_affinity":    r.get("market_affinity") or [],
        "display_order":      r.get("display_order") or 100,
        "active":             bool(r.get("active", True)),
    }
