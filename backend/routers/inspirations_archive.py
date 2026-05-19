"""inspirations_archive.py — Inspirations™ Editorial Archive.

Layer editoriale intelligente SOPRA la Media Library. NO duplica file:
ogni Inspiration è una `media_library` row con `is_inspiration=true` +
`inspiration_meta` JSONB (atmosphere_tags, material_tags, market_codes,
style_tags, palette, hospitality_profile, luxury_level, brand, collection,
product_name, material_family, supplier_reference).

Endpoints (montati sotto /api/inspirations):
  GET    /archive                  lista filtrata + facets
  POST   /archive/import           upload diretto OPPURE URL (Pinterest/Instagram/qualunque)
  GET    /archive/_filters         taxonomy curata per le UI dei filtri
  GET    /archive/{id}             dettaglio singolo
  PATCH  /archive/{id}             aggiorna inspiration_meta o tags
  DELETE /archive/{id}             rimuove il flag inspiration (NON cancella il file)
  GET    /archive/{id}/resonance   Market Resonance™ euristico + spiegazione editoriale
  GET    /archive/{id}/links       relazioni con altre entità
  POST   /archive/{id}/links       collega Inspiration a moodboard/project/account/...
  DELETE /archive/links/{link_id}  rimuove relazione

Linguaggio: 100% editoriale italiano. ZERO jargon SaaS.
"""
from __future__ import annotations

import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from cultural_engine import descriptor_mapper, editorial_interpreter, vision_provider_adapter
from database import db

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Taxonomy curata (no jargon, terminologia editoriale italiana) ────
ATMOSPHERE_TAGS = [
    {"key": "warm_minimal",    "label": "Warm Minimal"},
    {"key": "dramatic_luxury", "label": "Dramatic Luxury"},
    {"key": "soft_editorial",  "label": "Soft Editorial"},
    {"key": "architectural",   "label": "Architectural Contrast"},
    {"key": "mediterranean",   "label": "Mediterranean Light"},
    {"key": "nordic_calm",     "label": "Nordic Calm"},
    {"key": "hospitality",     "label": "Hospitality Warmth"},
    {"key": "indoor_outdoor",  "label": "Indoor / Outdoor"},
    {"key": "monumental",      "label": "Monumental Scale"},
    {"key": "intimate",        "label": "Intimate Layering"},
    {"key": "heritage",        "label": "Heritage Contemporary"},
    {"key": "understated",     "label": "Understated Elegance"},
]

MATERIAL_TAGS = [
    {"key": "marble",        "label": "Marmo"},
    {"key": "travertine",    "label": "Travertino"},
    {"key": "wood_dark",     "label": "Legno scuro"},
    {"key": "wood_natural",  "label": "Legno chiaro"},
    {"key": "brass",         "label": "Ottone"},
    {"key": "bronze",        "label": "Bronzo"},
    {"key": "linen",         "label": "Lino"},
    {"key": "velvet",        "label": "Velluto"},
    {"key": "boucle",        "label": "Bouclé"},
    {"key": "rattan",        "label": "Rattan"},
    {"key": "stone",         "label": "Pietra naturale"},
    {"key": "concrete",      "label": "Cemento"},
    {"key": "ceramic",       "label": "Ceramica"},
    {"key": "leather",       "label": "Pelle"},
    {"key": "glass",         "label": "Vetro"},
    {"key": "terracotta",    "label": "Terracotta"},
]

LUXURY_LEVELS = [
    {"key": "discreet",   "label": "Luxury discreto"},
    {"key": "refined",    "label": "Raffinato"},
    {"key": "scenic",     "label": "Scenografico"},
    {"key": "monumental", "label": "Monumentale"},
]

HOSPITALITY_PROFILES = [
    {"key": "residential", "label": "Residenziale"},
    {"key": "hospitality", "label": "Hospitality"},
    {"key": "retail",      "label": "Retail"},
    {"key": "office",      "label": "Office"},
]

# Mapping atmosphere/material → market preferences (per la Market Resonance™)
# Ogni mercato ha "affinità" verso certi atmosphere/material/profile.
# Editorial-first: matching ridotto a poche regole comprensibili.
MARKET_AFFINITY = {
    "usa_miami": {
        "atmosphere": {"mediterranean": 3, "indoor_outdoor": 3, "hospitality": 3, "warm_minimal": 2, "soft_editorial": 1},
        "material":   {"travertine": 2, "rattan": 2, "linen": 2, "stone": 1, "wood_natural": 1, "ceramic": 1},
        "profile":    {"hospitality": 2, "residential": 1},
        "luxury":     {"scenic": 2, "refined": 2, "discreet": 1},
        "headline":   "Atmosfera luminosa, indoor/outdoor continuity, ospitalità mediterranea.",
    },
    "usa_nyc": {
        "atmosphere": {"architectural": 3, "understated": 3, "warm_minimal": 2, "intimate": 2},
        "material":   {"wood_dark": 2, "brass": 2, "leather": 2, "velvet": 1, "stone": 1},
        "profile":    {"residential": 2, "office": 1},
        "luxury":     {"discreet": 3, "refined": 2},
        "headline":   "Verticalità sartoriale, luxury discreto, eleganza architettonica.",
    },
    "uae_dubai": {
        "atmosphere": {"monumental": 3, "dramatic_luxury": 3, "hospitality": 2, "mediterranean": 1},
        "material":   {"marble": 3, "brass": 3, "bronze": 2, "velvet": 2, "ceramic": 1},
        "profile":    {"hospitality": 3, "residential": 1, "retail": 1},
        "luxury":     {"monumental": 3, "scenic": 2},
        "headline":   "Opulenza materica, scala monumentale, ospitalità cerimoniale.",
    },
    "uk_london": {
        "atmosphere": {"heritage": 3, "understated": 3, "intimate": 2, "soft_editorial": 2},
        "material":   {"velvet": 2, "wood_dark": 2, "leather": 2, "brass": 1, "linen": 1},
        "profile":    {"residential": 2, "hospitality": 1},
        "luxury":     {"refined": 3, "discreet": 2},
        "headline":   "Heritage contemporaneo, layering tessile, understatement.",
    },
    "italy_milano": {
        "atmosphere": {"architectural": 3, "warm_minimal": 2, "soft_editorial": 2, "understated": 2},
        "material":   {"travertine": 2, "wood_natural": 2, "brass": 2, "stone": 1, "ceramic": 1, "marble": 1},
        "profile":    {"residential": 2, "retail": 1, "office": 1},
        "luxury":     {"refined": 3, "discreet": 2, "scenic": 1},
        "headline":   "Rigore razionalista, dettaglio artigiano, cultura del progetto.",
    },
    "france_paris": {
        "atmosphere": {"heritage": 3, "intimate": 2, "soft_editorial": 2, "understated": 1},
        "material":   {"velvet": 2, "wood_natural": 2, "brass": 2, "marble": 1, "linen": 1, "boucle": 1},
        "profile":    {"residential": 3, "hospitality": 1},
        "luxury":     {"refined": 3, "scenic": 1, "discreet": 1},
        "headline":   "Eleganza haussmaniana, mix antiquariale, raffinatezza.",
    },
}

CURATED_MARKETS = [
    {"code": "usa_miami",    "label": "USA · Miami",       "city": "Miami",     "country": "Stati Uniti"},
    {"code": "usa_nyc",      "label": "USA · New York",    "city": "New York",  "country": "Stati Uniti"},
    {"code": "uae_dubai",    "label": "UAE · Dubai",       "city": "Dubai",     "country": "Emirati Arabi"},
    {"code": "uk_london",    "label": "UK · Londra",       "city": "Londra",    "country": "Regno Unito"},
    {"code": "italy_milano", "label": "Italia · Milano",   "city": "Milano",    "country": "Italia"},
    {"code": "france_paris", "label": "Francia · Parigi",  "city": "Parigi",    "country": "Francia"},
]

INSPIRATION_BUCKET = "inspirations"
MEDIA_BUCKET = "media-library"


# ── Models ────────────────────────────────────────────────────────────
class ImportPayload(BaseModel):
    """Import an Inspiration via URL or referenced media_library row."""
    # Option A: import from external URL (Pinterest, Instagram, image URL)
    url: Optional[str] = None
    source_kind: Optional[str] = None  # 'pinterest' | 'instagram' | 'url' | 'upload'

    # Option B: promote an existing media_library row to Inspiration
    media_id: Optional[str] = None

    # Editorial metadata (can be set on creation or later via PATCH)
    title:            Optional[str] = None
    description:      Optional[str] = None
    atmosphere_tags:  List[str] = Field(default_factory=list)
    material_tags:    List[str] = Field(default_factory=list)
    market_codes:     List[str] = Field(default_factory=list)
    style_tags:       List[str] = Field(default_factory=list)
    palette:          List[str] = Field(default_factory=list)
    hospitality_profile: Optional[str] = None
    luxury_level:     Optional[str] = None
    brand:            Optional[str] = None
    collection:       Optional[str] = None
    product_name:     Optional[str] = None
    material_family:  Optional[str] = None
    supplier_reference: Optional[str] = None


class InspirationPatch(BaseModel):
    inspiration_meta: Optional[Dict[str, Any]] = None
    tags:             Optional[List[str]] = None
    alt_text:         Optional[str] = None
    description:      Optional[str] = None
    is_inspiration:   Optional[bool] = None


class LinkCreate(BaseModel):
    target_type: str  # 'moodboard' | 'project' | 'account' | 'cultural_edition' | 'material' | 'magazine_post'
    target_id:   str
    note:        Optional[str] = None


class CulturalReadingRetryBody(BaseModel):
    """Body opzionale del re-trigger della lettura culturale.

    Quando presente, il pipeline riusa i segnali Vision già in cache e
    ribilancia SOLO Layer 3 (Editorial Interpretation) col nuovo registro.
    """
    narrative_mode:       Optional[str] = None
    narrative_intensity:  Optional[str] = None
    presentation_context: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slim(row: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in row.items() if k != "_id"}


def _detect_source_kind(url: str) -> str:
    u = (url or "").lower()
    if "pinterest." in u or "pin.it" in u:
        return "pinterest"
    if "instagram." in u:
        return "instagram"
    return "url"


async def _resolve_image_url(url: str, source_kind: str) -> str:
    """For Pinterest/Instagram URLs, attempt to extract an image via og:image.

    Fase 1: best-effort tramite meta tag og:image. Se fallisce, salviamo
    l'URL originale come fallback — la card mostrerà comunque una
    placeholder editoriale fino a sostituzione manuale.

    Async per non bloccare il worker FastAPI.
    """
    if source_kind == "url" and re.search(r"\.(jpe?g|png|webp|gif|avif)(\?|$)", url, re.I):
        return url
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=5.0,
                                     headers={"User-Agent": "Mozilla/5.0 (MOOD/Inspirations bot)"}) as c:
            r = await c.get(url)
            if r.status_code >= 400:
                return url
            html = r.text
            # og:image:secure_url > og:image > twitter:image
            for pat in [
                r'<meta[^>]+property=["\']og:image:secure_url["\'][^>]+content=["\']([^"\']+)["\']',
                r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
                r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']',
            ]:
                m = re.search(pat, html, re.I)
                if m:
                    return m.group(1)
    except Exception as e:
        logger.warning(f"og:image resolve failed for {url}: {e}")
    return url


def _build_inspiration_meta(body: ImportPayload) -> Dict[str, Any]:
    meta = {
        "atmosphere_tags":     body.atmosphere_tags or [],
        "material_tags":       body.material_tags or [],
        "market_codes":        body.market_codes or [],
        "style_tags":          body.style_tags or [],
        "palette":             body.palette or [],
        "hospitality_profile": body.hospitality_profile,
        "luxury_level":        body.luxury_level,
        "brand":               body.brand,
        "collection":          body.collection,
        "product_name":        body.product_name,
        "material_family":     body.material_family,
        "supplier_reference":  body.supplier_reference,
    }
    return {k: v for k, v in meta.items() if v not in (None, [], "")}


def _to_card(row: Dict[str, Any]) -> Dict[str, Any]:
    """Slim representation for the editorial archive grid."""
    meta = row.get("inspiration_meta") or {}
    return {
        "id":                 row.get("id"),
        "title":              row.get("alt_text") or meta.get("product_name") or row.get("file_name") or "Senza titolo",
        "description":        row.get("description"),
        "image_url":          row.get("file_url"),
        "source_url":         row.get("source_url"),
        "source_kind":        row.get("source_kind") or "upload",
        "width":              row.get("width"),
        "height":             row.get("height"),
        "dominant_color":     row.get("dominant_color"),
        "atmosphere_tags":    meta.get("atmosphere_tags") or [],
        "material_tags":      meta.get("material_tags") or [],
        "market_codes":       meta.get("market_codes") or [],
        "style_tags":         meta.get("style_tags") or [],
        "palette":            meta.get("palette") or [],
        "hospitality_profile": meta.get("hospitality_profile"),
        "luxury_level":       meta.get("luxury_level"),
        "brand":              meta.get("brand"),
        "collection":         meta.get("collection"),
        "product_name":       meta.get("product_name"),
        "tags":               row.get("tags") or [],
        "created_at":         row.get("created_at"),
        "updated_at":         row.get("updated_at"),
    }


def _compute_resonance(meta: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Heuristic Market Resonance™ — trasparente, non un'AI cheap.

    Punteggi pesi 1-3, sommati e normalizzati per mercato. Output
    ordinato decrescente. Sempre 6 mercati curati restituiti.
    """
    atmos = set(meta.get("atmosphere_tags") or [])
    mats  = set(meta.get("material_tags") or [])
    prof  = meta.get("hospitality_profile")
    lux   = meta.get("luxury_level")
    selected_markets = set(meta.get("market_codes") or [])

    rows = []
    for market in CURATED_MARKETS:
        code = market["code"]
        aff = MARKET_AFFINITY.get(code, {})
        max_possible = (
            sum(sorted(aff.get("atmosphere", {}).values(), reverse=True)[:3])
            + sum(sorted(aff.get("material",   {}).values(), reverse=True)[:3])
            + (max(aff.get("profile", {}).values()) if aff.get("profile") else 0)
            + (max(aff.get("luxury",  {}).values()) if aff.get("luxury") else 0)
        ) or 1

        score = 0
        matched_atmos: List[str] = []
        matched_mats:  List[str] = []
        for t in atmos:
            w = aff.get("atmosphere", {}).get(t, 0)
            if w:
                score += w
                matched_atmos.append(t)
        for t in mats:
            w = aff.get("material", {}).get(t, 0)
            if w:
                score += w
                matched_mats.append(t)
        if prof:
            score += aff.get("profile", {}).get(prof, 0)
        if lux:
            score += aff.get("luxury", {}).get(lux, 0)

        # Boost if user explicitly tagged the market
        if code in selected_markets:
            score += max_possible * 0.20

        pct = max(0, min(100, round((score / max_possible) * 100))) if max_possible else 0

        # Editorial explanation
        if pct == 0 and not matched_atmos and not matched_mats:
            explanation = "MOOD sta costruendo il profilo culturale di questo riferimento."
        else:
            explanation = aff.get("headline", "")

        rows.append({
            "market_code":    code,
            "market_label":   market["label"],
            "city":           market["city"],
            "percentage":     pct,
            "explanation":    explanation,
            "matched_atmosphere": matched_atmos,
            "matched_materials":  matched_mats,
        })

    rows.sort(key=lambda r: r["percentage"], reverse=True)
    return rows


# ─── Cultural Intelligence Engine™ — 3-layer orchestration ────────────
def _fetch_brand_voice(tenant_id: str) -> Optional[Dict[str, Any]]:
    """Read the persistent Brand Voice™ from tenant.branding_settings.editorial_voice."""
    try:
        rows = (db().table("tenants").select("branding_settings")
                .eq("id", tenant_id).limit(1).execute().data or [])
        if not rows:
            return None
        bs = rows[0].get("branding_settings") or {}
        ev = bs.get("editorial_voice")
        return ev if isinstance(ev, dict) and ev else None
    except Exception:
        return None


async def _run_cultural_reading(media_id: str, tenant_id: str, image_url: str,
                                 narrative_mode: Optional[str] = None,
                                 narrative_intensity: Optional[str] = None,
                                 presentation_context: Optional[str] = None,
                                 skip_vision: bool = False) -> Dict[str, Any]:
    """Run the full hybrid pipeline. If skip_vision=True and a previous reading
    exists, only re-run Layer 3 (Narrative Mode adaptation)."""
    started = _now()
    result: Dict[str, Any] = {
        "status":            "in_progress",
        "raw_vision_signals": None,
        "mapped_cultural_descriptors": None,
        "market_resonance":  None,
        "editorial_interpretation": None,
        "provider_meta":     {},
        "generated_at":      started,
    }
    brand_voice = _fetch_brand_voice(tenant_id)
    try:
        if skip_vision:
            # Reuse previous vision signals + descriptors, only re-render narrative.
            prev = (db().table("media_library").select("cultural_reading")
                    .eq("id", media_id).eq("tenant_id", tenant_id).limit(1).execute().data or [])
            cached = (prev[0].get("cultural_reading") if prev else None) or {}
            if cached.get("status") != "ready":
                skip_vision = False  # fall through to full pipeline
            else:
                result["raw_vision_signals"] = cached.get("raw_vision_signals")
                result["mapped_cultural_descriptors"] = cached.get("mapped_cultural_descriptors")
                result["market_resonance"] = cached.get("market_resonance")
                result["provider_meta"] = {**(cached.get("provider_meta") or {}),
                                            "narrative_only_refresh": True}

        if not skip_vision:
            vision = await vision_provider_adapter.analyze_image(image_url)
            result["provider_meta"] = {
                "vision_provider": vision.get("provider"),
                "vision_model":    vision.get("model"),
                "vision_latency_ms": vision.get("latency_ms"),
                "vision_error":    vision.get("error"),
            }
            signals = vision.get("signals") or {}
            result["raw_vision_signals"] = signals
            if not signals:
                result["status"] = "failed"
                _save_cultural_reading(media_id, tenant_id, result)
                return result
            mapping = descriptor_mapper.map_signals_to_culture(signals)
            result["mapped_cultural_descriptors"] = {
                "activated": mapping.get("activated_descriptors", []),
                "by_category": mapping.get("descriptors_by_category", {}),
            }
            result["market_resonance"] = mapping.get("market_resonance", [])

        # Layer 3+4 — Editorial interpretation modulata da Brand Voice + Narrative Mode
        activated_list = (result["mapped_cultural_descriptors"] or {}).get("activated", []) \
            if result.get("mapped_cultural_descriptors") else []
        editorial = await editorial_interpreter.interpret(
            result["raw_vision_signals"] or {},
            activated_list,
            result["market_resonance"] or [],
            brand_voice=brand_voice,
            narrative_mode=narrative_mode,
            narrative_intensity=narrative_intensity,
            presentation_context=presentation_context,
        )
        result["editorial_interpretation"] = editorial
        pm = result.setdefault("provider_meta", {})
        pm["editorial_provider"] = editorial.get("provider")
        pm["editorial_model"]    = editorial.get("model")
        pm["editorial_fallback"] = editorial.get("fallback")
        pm["narrative_mode"]     = narrative_mode
        pm["narrative_intensity"] = narrative_intensity
        pm["presentation_context"] = presentation_context

        result["status"] = "ready"
    except Exception as e:
        logger.exception(f"cultural reading pipeline failed for {media_id}: {e}")
        result["status"] = "failed"
        result["provider_meta"].setdefault("pipeline_error", str(e)[:300])

    _save_cultural_reading(media_id, tenant_id, result)
    return result


def _save_cultural_reading(media_id: str, tenant_id: str, payload: Dict[str, Any]) -> None:
    try:
        res = db().table("media_library").update({
            "cultural_reading": payload,
            "updated_at":       _now(),
        }).eq("id", media_id).eq("tenant_id", tenant_id).execute()
        if not res.data:
            logger.warning(f"cultural reading persist returned no rows for {media_id}")
    except Exception as e:
        logger.error(f"cultural reading persist FAILED for {media_id}: {e}")
        # Surface failure as a minimal flag inside cultural_reading so the
        # UI doesn't get stuck on 'pending' forever.
        try:
            db().table("media_library").update({
                "cultural_reading": {"status": "failed", "persist_error": str(e)[:200]},
                "updated_at": _now(),
            }).eq("id", media_id).eq("tenant_id", tenant_id).execute()
        except Exception:
            pass


def _mark_cultural_reading_pending(media_id: str, tenant_id: str) -> None:
    """Mark the cultural reading as pending immediately so the UI can show status."""
    try:
        db().table("media_library").update({
            "cultural_reading": {"status": "pending", "queued_at": _now()},
            "updated_at":       _now(),
        }).eq("id", media_id).eq("tenant_id", tenant_id).execute()
    except Exception:
        pass


import asyncio
def _kick_off_cultural_reading(media_id: str, tenant_id: str, image_url: str,
                                narrative_mode: Optional[str] = None,
                                narrative_intensity: Optional[str] = None,
                                presentation_context: Optional[str] = None,
                                skip_vision: bool = False) -> None:
    """Fire-and-forget background runner usable from sync FastAPI BackgroundTasks."""
    if not image_url:
        return
    _mark_cultural_reading_pending(media_id, tenant_id)
    try:
        asyncio.create_task(_run_cultural_reading(
            media_id, tenant_id, image_url,
            narrative_mode=narrative_mode,
            narrative_intensity=narrative_intensity,
            presentation_context=presentation_context,
            skip_vision=skip_vision,
        ))
    except RuntimeError:
        asyncio.run(_run_cultural_reading(
            media_id, tenant_id, image_url,
            narrative_mode=narrative_mode,
            narrative_intensity=narrative_intensity,
            presentation_context=presentation_context,
            skip_vision=skip_vision,
        ))


# ─── Endpoints ────────────────────────────────────────────────────────
@router.get("/archive/_filters")
def filters_taxonomy():
    """Taxonomy curata per i filtri UI — niente metadata engine vibes."""
    return {
        "markets":              CURATED_MARKETS,
        "atmosphere_tags":      ATMOSPHERE_TAGS,
        "material_tags":        MATERIAL_TAGS,
        "luxury_levels":        LUXURY_LEVELS,
        "hospitality_profiles": HOSPITALITY_PROFILES,
    }


@router.get("/archive")
def list_archive(
    market:      Optional[str] = Query(None),
    atmosphere:  Optional[str] = Query(None),
    material:    Optional[str] = Query(None),
    luxury:      Optional[str] = Query(None),
    profile:     Optional[str] = Query(None),
    q:           Optional[str] = Query(None),
    limit:       int = Query(60, le=200),
    offset:      int = 0,
    ctx=Depends(get_tenant_context),
):
    c = db()
    tid = ctx["tenant_id"]
    base = (c.table("media_library")
            .select("id,file_url,file_name,alt_text,description,width,height,dominant_color,"
                    "source_url,source_kind,tags,inspiration_meta,created_at,updated_at")
            .eq("tenant_id", tid)
            .eq("is_inspiration", True)
            .is_("archived_at", None))
    if q:
        base = base.or_(f"alt_text.ilike.%{q}%,description.ilike.%{q}%,file_name.ilike.%{q}%")

    rows = base.order("created_at", desc=True).range(offset, offset + limit - 1).execute().data or []

    # Client-side JSON filters (Supabase doesn't allow easy JSONB array filter via PostgREST shim)
    def keep(r: Dict[str, Any]) -> bool:
        meta = r.get("inspiration_meta") or {}
        if market and market not in (meta.get("market_codes") or []):
            return False
        if atmosphere and atmosphere not in (meta.get("atmosphere_tags") or []):
            return False
        if material and material not in (meta.get("material_tags") or []):
            return False
        if luxury and luxury != meta.get("luxury_level"):
            return False
        if profile and profile != meta.get("hospitality_profile"):
            return False
        return True

    filtered = [r for r in rows if keep(r)]
    return {
        "items": [_to_card(r) for r in filtered],
        "total": len(filtered),
        "next_offset": offset + len(rows) if len(rows) == limit else None,
    }


@router.get("/archive/{media_id}")
def get_archive_item(media_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    rows = (c.table("media_library").select("*")
            .eq("id", media_id).eq("tenant_id", ctx["tenant_id"]).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Riferimento non trovato")
    r = rows[0]
    card = _to_card(r)
    card["bucket"] = r.get("bucket")
    card["storage_path"] = r.get("storage_path")
    card["is_inspiration"] = bool(r.get("is_inspiration"))
    # Resonance embed (legacy heuristic — kept as quick fallback)
    card["resonance"] = _compute_resonance(r.get("inspiration_meta") or {})
    # Cultural Intelligence Engine™ embed
    card["cultural_reading"] = r.get("cultural_reading") or {"status": "absent"}
    # Links
    links = (c.table("inspiration_links").select("*")
             .eq("media_id", media_id).eq("tenant_id", ctx["tenant_id"]).execute().data or [])
    card["links"] = [_slim(link) for link in links]
    return card


@router.get("/archive/{media_id}/cultural-reading")
def get_cultural_reading(media_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    rows = (c.table("media_library").select("cultural_reading,file_url")
            .eq("id", media_id).eq("tenant_id", ctx["tenant_id"]).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Riferimento non trovato")
    cr = rows[0].get("cultural_reading") or {"status": "absent"}
    return cr


@router.post("/archive/{media_id}/cultural-reading", status_code=202)
def retry_cultural_reading(media_id: str, background_tasks: BackgroundTasks,
                            body: Optional[CulturalReadingRetryBody] = None,
                            ctx=Depends(get_tenant_context)):
    """Manual re-trigger of the cultural reading pipeline.

    Quando arriva un body con `narrative_mode` / `narrative_intensity` /
    `presentation_context`, ribilancia SOLO Layer 3 (Editorial Interpretation)
    riutilizzando i segnali Vision già in cache: niente nuovo costo, ~3-5s.
    """
    c = db()
    rows = (c.table("media_library").select("id,file_url,cultural_reading")
            .eq("id", media_id).eq("tenant_id", ctx["tenant_id"]).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Riferimento non trovato")
    image_url = rows[0].get("file_url")
    if not image_url:
        raise HTTPException(400, "Nessuna immagine associata al riferimento")

    narrative_mode = body.narrative_mode if body else None
    narrative_intensity = body.narrative_intensity if body else None
    presentation_context = body.presentation_context if body else None

    # Se ho già una lettura ready e l'utente sta solo cambiando direzione,
    # salto Layer 1 (Vision) → ribilancia solo l'interpretazione editoriale.
    existing = (rows[0].get("cultural_reading") or {})
    has_ready_reading = existing.get("status") == "ready"
    skip_vision = bool(has_ready_reading and (narrative_mode or narrative_intensity or presentation_context))

    background_tasks.add_task(
        _kick_off_cultural_reading,
        media_id, ctx["tenant_id"], image_url,
        narrative_mode=narrative_mode,
        narrative_intensity=narrative_intensity,
        presentation_context=presentation_context,
        skip_vision=skip_vision,
    )
    return {
        "status":      "queued",
        "media_id":    media_id,
        "narrative_only": skip_vision,
    }


@router.get("/archive/{media_id}/resonance")
def get_resonance(media_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    rows = (c.table("media_library").select("inspiration_meta")
            .eq("id", media_id).eq("tenant_id", ctx["tenant_id"]).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Riferimento non trovato")
    return {"items": _compute_resonance(rows[0].get("inspiration_meta") or {})}


@router.post("/archive/import", status_code=201)
async def import_inspiration(body: ImportPayload, background_tasks: BackgroundTasks,
                              ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    now = _now()
    meta = _build_inspiration_meta(body)

    if body.media_id:
        # Promote existing media_library row to Inspiration (no new file)
        rows = (c.table("media_library").select("id,inspiration_meta,file_url")
                .eq("id", body.media_id).eq("tenant_id", tid).limit(1).execute().data or [])
        if not rows:
            raise HTTPException(404, "Asset Media Library non trovato")
        merged = {**(rows[0].get("inspiration_meta") or {}), **meta}
        patch = {
            "is_inspiration": True,
            "inspiration_meta": merged,
            "updated_at": now,
        }
        if body.title:
            patch["alt_text"] = body.title
        if body.description:
            patch["description"] = body.description
        r = (c.table("media_library").update(patch)
             .eq("id", body.media_id).eq("tenant_id", tid).execute())
        image_url = (r.data[0].get("file_url") if r.data else rows[0].get("file_url"))
        background_tasks.add_task(_kick_off_cultural_reading, body.media_id, tid, image_url)
        return _to_card(r.data[0]) if r.data else {"id": body.media_id, **patch}

    if not body.url:
        raise HTTPException(400, "Fornisci un URL oppure un media_id esistente")

    source_kind = body.source_kind or _detect_source_kind(body.url)
    resolved = await _resolve_image_url(body.url, source_kind)

    mid = str(uuid.uuid4())
    # For external references we synth a path so the NOT NULL constraint passes.
    synthetic_path = f"external/{source_kind}/{mid}"
    row = {
        "id":               mid,
        "tenant_id":        tid,
        "uploaded_by":      ctx.get("profile_id"),
        "bucket":           "external",
        "storage_path":     synthetic_path,
        "file_url":         resolved,
        "file_name":        body.title or (body.url.split("/")[-1] or "inspiration")[:120],
        "file_type":        "image/external",
        "file_size":        None,
        "alt_text":         body.title,
        "description":      body.description,
        "category":         "inspiration",
        "tags":             ["inspiration"],
        "metadata_json":    {},
        "is_inspiration":   True,
        "inspiration_meta": meta,
        "source_url":       body.url,
        "source_kind":      source_kind,
        "created_at":       now,
        "updated_at":       now,
    }
    try:
        c.table("media_library").insert(row).execute()
    except Exception as e:
        logger.error(f"insert inspiration failed: {e}")
        raise HTTPException(500, "Impossibile salvare il riferimento")
    background_tasks.add_task(_kick_off_cultural_reading, mid, tid, resolved)
    return _to_card(row)


@router.patch("/archive/{media_id}")
def patch_archive_item(media_id: str, body: InspirationPatch, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("media_library").select("inspiration_meta,tags")
            .eq("id", media_id).eq("tenant_id", tid).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Riferimento non trovato")
    patch: Dict[str, Any] = {"updated_at": _now()}
    if body.inspiration_meta is not None:
        # merge anziché replace per non perdere campi precedenti
        merged = {**(rows[0].get("inspiration_meta") or {}), **body.inspiration_meta}
        patch["inspiration_meta"] = merged
    if body.tags is not None:
        patch["tags"] = body.tags
    if body.alt_text is not None:
        patch["alt_text"] = body.alt_text
    if body.description is not None:
        patch["description"] = body.description
    if body.is_inspiration is not None:
        patch["is_inspiration"] = body.is_inspiration
    r = (c.table("media_library").update(patch)
         .eq("id", media_id).eq("tenant_id", tid).execute())
    return _to_card(r.data[0]) if r.data else {"id": media_id, **patch}


@router.delete("/archive/{media_id}", status_code=204)
def unflag_archive_item(media_id: str, ctx=Depends(get_tenant_context)):
    """Rimuove il flag Inspiration. NON cancella il file dalla Media Library."""
    c = db()
    (c.table("media_library").update({"is_inspiration": False, "updated_at": _now()})
     .eq("id", media_id).eq("tenant_id", ctx["tenant_id"]).execute())
    return None


# ── Relations ─────────────────────────────────────────────────────────
@router.post("/archive/{media_id}/links", status_code=201)
def create_link(media_id: str, body: LinkCreate, ctx=Depends(get_tenant_context)):
    if body.target_type not in {"moodboard", "project", "account", "cultural_edition", "material", "magazine_post"}:
        raise HTTPException(400, "target_type non riconosciuto")
    c = db()
    tid = ctx["tenant_id"]
    # Idempotent: try insert; on conflict pass
    row = {
        "id":          str(uuid.uuid4()),
        "tenant_id":   tid,
        "media_id":    media_id,
        "target_type": body.target_type,
        "target_id":   body.target_id,
        "note":        body.note,
        "created_by":  ctx.get("profile_id"),
        "created_at":  _now(),
    }
    try:
        c.table("inspiration_links").insert(row).execute()
    except Exception:
        # likely UNIQUE conflict — fetch existing
        existing = (c.table("inspiration_links").select("*")
                    .eq("tenant_id", tid).eq("media_id", media_id)
                    .eq("target_type", body.target_type).eq("target_id", body.target_id)
                    .limit(1).execute().data or [])
        if existing:
            return _slim(existing[0])
        raise HTTPException(500, "Impossibile creare la relazione")
    return _slim(row)


@router.get("/archive/{media_id}/links")
def list_links(media_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    rows = (c.table("inspiration_links").select("*")
            .eq("media_id", media_id).eq("tenant_id", ctx["tenant_id"]).execute().data or [])
    return {"items": [_slim(r) for r in rows]}


@router.delete("/archive/links/{link_id}", status_code=204)
def delete_link(link_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    (c.table("inspiration_links").delete()
     .eq("id", link_id).eq("tenant_id", ctx["tenant_id"]).execute())
    return None
