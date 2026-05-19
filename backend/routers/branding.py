"""Brand Studio — tenant branding + theme overrides + curated presets.

Endpoints:
  GET    /api/branding                  current tenant branding + theme
  PUT    /api/branding                  upsert branding_settings + theme_settings
  GET    /api/branding/presets          curated theme presets
  POST   /api/branding/apply-preset     apply a preset key to the tenant
"""
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.tenant_context import require_permission, audit_log
from core.permissions import P_TENANT_BRANDING
from database import db

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Schemas ──────────────────────────────────────────────────────────
class Branding(BaseModel):
    public_brand_name: Optional[str] = None
    tagline: Optional[str] = None
    short_description: Optional[str] = None
    long_manifesto: Optional[str] = None
    website_url: Optional[str] = None
    support_email: Optional[str] = None
    phone: Optional[str] = None
    social_links: Optional[List[Dict[str, str]]] = None
    primary_logo_url: Optional[str] = None
    monochrome_logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    social_og_logo_url: Optional[str] = None
    # ── Multi-locale identity bags (Fase 0.5 — multi-locale audit fix) ──
    # Each key is a BCP-47 locale ('it-IT', 'en-US', 'en-GB', 'fr-FR',
    # 'de-DE', 'es-ES', 'es-MX', 'ar-AE', …). Values are simple strings.
    # The single-string columns above remain the canonical default locale
    # mirror for legacy / unauth public endpoints.
    public_brand_name_i18n: Optional[Dict[str, str]] = None
    tagline_i18n: Optional[Dict[str, str]] = None
    short_description_i18n: Optional[Dict[str, str]] = None

    # ── Voce editoriale dello studio (Brand Voice™ persistente) ──────
    # Dimensioni opzionali consumate dal Cultural Intelligence Engine™
    # per modulare il registro di TUTTE le interpretazioni editoriali
    # generate per questo tenant. È poi sovrascrivibile contestualmente
    # dal Narrative Mode™ all'interno di ogni Inspiration / Cultural Edition.
    #
    # Keys attese (tutte opzionali):
    #   communication_personality  · strategic | technical | editorial | hospitality
    #                                | commercial_soft | luxury | minimal_executive
    #                                | cultural_consultant
    #   vocabulary_style           · architecture_studio | interior_design
    #                                | luxury_hospitality | executive | editorial_magazine
    #                                | retail_showroom | international_consultancy
    #   narrative_intensity        · minimal | balanced | editorial | cinematic
    #   interpretation_density     · concise | standard | deep_analysis
    editorial_voice: Optional[Dict[str, Any]] = None


class ThemePalette(BaseModel):
    primary: Optional[str] = None
    secondary: Optional[str] = None
    accent: Optional[str] = None
    background: Optional[str] = None
    surface: Optional[str] = None
    text_primary: Optional[str] = None
    text_secondary: Optional[str] = None
    border: Optional[str] = None
    success: Optional[str] = None
    warning: Optional[str] = None
    danger: Optional[str] = None


class ThemeTypography(BaseModel):
    display: Optional[str] = None
    body: Optional[str] = None


class Theme(BaseModel):
    preset_key: Optional[str] = None
    mode: Optional[str] = None             # "light" | "dark"  — base canvas mode
    palette: Optional[ThemePalette] = None
    typography: Optional[ThemeTypography] = None
    radius: Optional[str] = None           # "0px" | "2px" | "4px" | "8px" | "12px"
    density: Optional[str] = None          # "compact" | "comfortable" | "spacious"
    shadow: Optional[str] = None           # "none" | "soft" | "medium" | "strong"


class BrandingUpsert(BaseModel):
    branding: Optional[Branding] = None
    theme: Optional[Theme] = None


class ApplyPresetBody(BaseModel):
    preset_key: str = Field(min_length=1)


# ── Helpers ──────────────────────────────────────────────────────────
def _get_tenant(client, tenant_id: str) -> dict:
    r = client.table("tenants").select(
        "id, slug, name, branding_settings, theme_settings"
    ).eq("id", tenant_id).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Tenant not found")
    return r.data[0]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Endpoints ────────────────────────────────────────────────────────
@router.get("")
def get_branding(ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    client = db()
    t = _get_tenant(client, ctx["tenant_id"])
    return {
        "tenant_id": t["id"],
        "tenant_name": t.get("name"),
        "branding": t.get("branding_settings") or {},
        "theme":    t.get("theme_settings") or {},
    }


@router.put("")
def update_branding(
    body: BrandingUpsert,
    ctx: dict = Depends(require_permission(P_TENANT_BRANDING)),
):
    client = db()
    t = _get_tenant(client, ctx["tenant_id"])
    update: Dict[str, Any] = {}

    if body.branding is not None:
        existing = t.get("branding_settings") or {}
        # Merge — only update keys explicitly provided (drop None)
        patch = {k: v for k, v in body.branding.model_dump().items() if v is not None}
        # ── i18n bags need DEEP merge, not shallow replace ────────────
        # When the user edits ONLY en-US, the frontend sends
        # `public_brand_name_i18n: {'en-US': 'NEW'}`. A shallow merge
        # would wipe the it-IT / fr-FR / es-ES entries already saved.
        I18N_FIELDS = ("public_brand_name_i18n", "tagline_i18n", "short_description_i18n")
        for f in I18N_FIELDS:
            if f in patch and isinstance(patch[f], dict):
                patch[f] = {**(existing.get(f) or {}), **patch[f]}
        update["branding_settings"] = {**existing, **patch}

    if body.theme is not None:
        existing = t.get("theme_settings") or {}
        # Deep-ish merge: palette & typography are dicts inside the theme.
        theme_in = body.theme.model_dump(exclude_none=True)
        merged = {**existing, **{k: v for k, v in theme_in.items()
                                 if k not in ("palette", "typography")}}
        if "palette" in theme_in:
            merged["palette"] = {**(existing.get("palette") or {}), **theme_in["palette"]}
        if "typography" in theme_in:
            merged["typography"] = {**(existing.get("typography") or {}), **theme_in["typography"]}
        update["theme_settings"] = merged

    if not update:
        return {"branding": t.get("branding_settings") or {}, "theme": t.get("theme_settings") or {}}

    client.table("tenants").update(update).eq("id", t["id"]).execute()
    audit_log(ctx["tenant_id"], ctx["profile_id"], "branding.updated",
              resource_type="tenant", resource_id=t["id"],
              metadata={"keys_changed": list(update.keys())})
    fresh = _get_tenant(client, t["id"])
    return {
        "tenant_id": fresh["id"],
        "branding": fresh.get("branding_settings") or {},
        "theme":    fresh.get("theme_settings") or {},
    }


@router.get("/presets")
def list_presets(_ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    client = db()
    r = client.table("theme_presets").select(
        "key, label, description, vibe_tags, preview_url, theme, is_default, sort_order"
    ).order("sort_order").execute()
    return {"presets": r.data or []}


@router.post("/apply-preset")
def apply_preset(
    body: ApplyPresetBody,
    ctx: dict = Depends(require_permission(P_TENANT_BRANDING)),
):
    client = db()
    r = client.table("theme_presets").select("key, theme") \
        .eq("key", body.preset_key).limit(1).execute()
    if not r.data:
        raise HTTPException(404, f"Preset '{body.preset_key}' not found")
    preset = r.data[0]
    theme = preset["theme"] or {}
    theme["preset_key"] = preset["key"]
    client.table("tenants").update({"theme_settings": theme}).eq("id", ctx["tenant_id"]).execute()
    audit_log(ctx["tenant_id"], ctx["profile_id"], "branding.preset_applied",
              resource_type="tenant", resource_id=ctx["tenant_id"],
              metadata={"preset_key": preset["key"]})
    t = _get_tenant(client, ctx["tenant_id"])
    return {
        "tenant_id": t["id"],
        "branding": t.get("branding_settings") or {},
        "theme":    t.get("theme_settings") or {},
    }



# ─────────────────────────────────────────────────────────────────────
# AA.1 — Studio Palette Memory™
#
# Tenant-scoped, team-shared "studio_palette" of recently used colours.
# Stored INSIDE theme_settings.studio_palette as a list of:
#   { hex, name?, mood?, created_by, last_used_at }
# Cap at MAX_STUDIO_PALETTE entries to avoid explosion. On overflow we
# drop the oldest entry by last_used_at.
# ─────────────────────────────────────────────────────────────────────

MAX_STUDIO_PALETTE = 24


def _normalize_hex(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return ""
    if not s.startswith("#"):
        s = "#" + s
    if len(s) == 4 and all(c in "0123456789abcdefABCDEF" for c in s[1:]):
        s = "#" + "".join(c * 2 for c in s[1:])
    if len(s) != 7 or not all(c in "0123456789abcdefABCDEF" for c in s[1:]):
        return ""
    return s.lower()


def _read_studio_palette(theme: Dict[str, Any] | None) -> List[Dict[str, Any]]:
    pal = (theme or {}).get("studio_palette") or []
    # Defensive: filter malformed entries
    return [p for p in pal if isinstance(p, dict) and p.get("hex")]


def _write_studio_palette(client, tenant_id: str, palette: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Persist a fresh studio_palette back to the tenant — never overwrites
    other theme keys."""
    fresh = _get_tenant(client, tenant_id)
    theme = fresh.get("theme_settings") or {}
    theme["studio_palette"] = palette[:MAX_STUDIO_PALETTE]
    client.table("tenants").update({"theme_settings": theme}).eq("id", tenant_id).execute()
    return theme["studio_palette"]


class StudioPaletteEntryIn(BaseModel):
    hex:   str = Field(..., min_length=4, max_length=9)
    name:  Optional[str] = Field(None, max_length=60)
    mood:  Optional[str] = Field(None, max_length=60)


class StudioPaletteReorderIn(BaseModel):
    order: List[str] = Field(..., description="hex codes in desired order")


@router.get("/studio-palette")
def get_studio_palette(ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    """Return the team-shared Studio Palette Memory, newest-used first."""
    client = db()
    t = _get_tenant(client, ctx["tenant_id"])
    palette = _read_studio_palette(t.get("theme_settings"))
    # Defensive sort: most recently used first
    palette.sort(key=lambda p: p.get("last_used_at") or "", reverse=True)
    return {"palette": palette, "max": MAX_STUDIO_PALETTE}


@router.post("/studio-palette")
def add_to_studio_palette(
    body: StudioPaletteEntryIn,
    ctx: dict = Depends(require_permission(P_TENANT_BRANDING)),
):
    """Add (or refresh `last_used_at` of) a color in the Studio Palette.
    Idempotent on hex — repeated uses just bump the timestamp."""
    hex_norm = _normalize_hex(body.hex)
    if not hex_norm:
        raise HTTPException(400, "Invalid hex color.")

    client = db()
    t = _get_tenant(client, ctx["tenant_id"])
    palette = _read_studio_palette(t.get("theme_settings"))

    now = _now_iso()
    # Look up existing
    existing_idx = next((i for i, p in enumerate(palette)
                        if (p.get("hex") or "").lower() == hex_norm), None)
    if existing_idx is not None:
        # Refresh metadata in place
        e = palette[existing_idx]
        e["last_used_at"] = now
        if body.name is not None:  e["name"] = body.name.strip() or None
        if body.mood is not None:  e["mood"] = body.mood.strip() or None
    else:
        palette.append({
            "hex": hex_norm,
            "name": (body.name or "").strip() or None,
            "mood": (body.mood or "").strip() or None,
            "created_by": ctx["profile_id"],
            "last_used_at": now,
        })

    # Enforce cap: keep newest MAX
    palette.sort(key=lambda p: p.get("last_used_at") or "", reverse=True)
    saved = _write_studio_palette(client, ctx["tenant_id"], palette)
    audit_log(ctx["tenant_id"], ctx["profile_id"], "studio_palette.touched",
              resource_type="tenant", resource_id=ctx["tenant_id"],
              metadata={"hex": hex_norm})
    return {"palette": saved, "max": MAX_STUDIO_PALETTE}


@router.delete("/studio-palette/{hex_code}")
def remove_from_studio_palette(
    hex_code: str,
    ctx: dict = Depends(require_permission(P_TENANT_BRANDING)),
):
    """Remove a single color from the team palette."""
    hex_norm = _normalize_hex(hex_code if hex_code.startswith("#") else "#" + hex_code)
    if not hex_norm:
        raise HTTPException(400, "Invalid hex color.")
    client = db()
    t = _get_tenant(client, ctx["tenant_id"])
    palette = [p for p in _read_studio_palette(t.get("theme_settings"))
               if (p.get("hex") or "").lower() != hex_norm]
    saved = _write_studio_palette(client, ctx["tenant_id"], palette)
    audit_log(ctx["tenant_id"], ctx["profile_id"], "studio_palette.removed",
              resource_type="tenant", resource_id=ctx["tenant_id"],
              metadata={"hex": hex_norm})
    return {"palette": saved, "max": MAX_STUDIO_PALETTE}


@router.patch("/studio-palette/reorder")
def reorder_studio_palette(
    body: StudioPaletteReorderIn,
    ctx: dict = Depends(require_permission(P_TENANT_BRANDING)),
):
    """Reorder the Studio Palette by an explicit hex sequence. Missing
    entries are kept at the end in their previous relative order."""
    desired = [_normalize_hex(h) for h in (body.order or [])]
    desired = [h for h in desired if h]
    client = db()
    t = _get_tenant(client, ctx["tenant_id"])
    current = _read_studio_palette(t.get("theme_settings"))
    by_hex = {(p.get("hex") or "").lower(): p for p in current}
    ordered: List[Dict[str, Any]] = []
    seen = set()
    for h in desired:
        if h in by_hex and h not in seen:
            ordered.append(by_hex[h]); seen.add(h)
    for p in current:
        h = (p.get("hex") or "").lower()
        if h not in seen:
            ordered.append(p); seen.add(h)
    saved = _write_studio_palette(client, ctx["tenant_id"], ordered)
    return {"palette": saved, "max": MAX_STUDIO_PALETTE}
