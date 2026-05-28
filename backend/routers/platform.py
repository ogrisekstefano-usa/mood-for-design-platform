"""Platform router — ITER168 Hotfix B.

Endpoints
---------
PHONE DIAL CODES (public, no auth · no tenant)
  GET  /api/platform/phone-dial-codes               · list all enabled (full ISO)
  GET  /api/platform/phone-dial-codes/{iso2}        · one entry

LANGUAGES (DB-driven · replaces languages.js static registry)
  GET  /api/platform/languages                       · public (enabled only)
  GET  /api/admin/platform/languages                 · admin (all + meta)
  PATCH /api/admin/platform/languages/{code}         · admin update
  POST /api/admin/platform/languages/{code}/default  · set default_locale (atomic)

The endpoints DO NOT require a tenant: they describe platform-level
configuration shared across all tenants.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from middleware.auth import get_current_user
from core.permissions import is_super_admin
from database import db

logger = logging.getLogger(__name__)
router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slim(row: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not row:
        return {}
    return {k: v for k, v in row.items() if k != "_id"}


# ════════════════════════════════════════════════════════════════════════
# § PHONE DIAL CODES
# ════════════════════════════════════════════════════════════════════════
@router.get("/phone-dial-codes")
def list_phone_dial_codes(
    locale: str = Query("en", description="UI locale for localized name (it/en/fr/de/es)"),
    q:      Optional[str] = Query(None, description="Free-text search across name, ISO, dial, aliases"),
    region: Optional[str] = Query(None, description="Optional macro_region filter"),
):
    """Return the full enabled phone dial code registry.

    NOT gated by tenant or by language enable state.
    A client may live in market X but have phone number from country Y.
    """
    c = db()
    qb = c.table("phone_dial_codes").select(
        "iso2,country_name,dial_code,flag_emoji,name_i18n,"
        "search_aliases,display_priority,region"
    ).eq("enabled", True)
    if region:
        qb = qb.eq("region", region)
    rows = qb.order("display_priority").order("country_name").execute().data or []

    needle = (q or "").strip().lower()
    out = []
    for r in rows:
        i18n = r.get("name_i18n") or {}
        label = i18n.get(locale) or r["country_name"]
        if needle:
            hay = " ".join([
                r["iso2"].lower(),
                r["country_name"].lower(),
                r["dial_code"].lower(),
                label.lower(),
                " ".join(r.get("search_aliases") or []).lower(),
            ])
            if needle not in hay:
                continue
        out.append({
            "iso2":       r["iso2"],
            "label":      label,
            "country_name": r["country_name"],
            "dial_code":  r["dial_code"],
            "flag":       r.get("flag_emoji") or "",
            "region":     r.get("region"),
            "priority":   r.get("display_priority", 100),
        })
    return {
        "total":  len(out),
        "locale": locale,
        "filter": {"q": q, "region": region},
        "codes":  out,
    }


@router.get("/phone-dial-codes/{iso2}")
def get_phone_dial_code(iso2: str, locale: str = Query("en")):
    c = db()
    rows = (c.table("phone_dial_codes").select("*")
            .eq("iso2", iso2.upper()).eq("enabled", True)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Country code not found")
    r = rows[0]
    i18n = r.get("name_i18n") or {}
    return {
        "iso2":      r["iso2"],
        "label":     i18n.get(locale) or r["country_name"],
        "country_name": r["country_name"],
        "dial_code": r["dial_code"],
        "flag":      r.get("flag_emoji") or "",
        "region":    r.get("region"),
    }


# ════════════════════════════════════════════════════════════════════════
# § PLATFORM LANGUAGES — Public read
# ════════════════════════════════════════════════════════════════════════
@router.get("/languages")
def list_languages(scope: str = Query("public",
                   description="public|blueprint|all · filters by enable state")):
    """Public read of platform languages.

    Scope:
      • public    → returns enabled + public_enabled rows (for storefront)
      • blueprint → returns enabled + blueprint_enabled rows (for app shell)
      • all       → returns ALL enabled rows
    """
    c = db()
    q = c.table("platform_languages").select("*").eq("enabled", True)
    if scope == "public":
        q = q.eq("public_enabled", True)
    elif scope == "blueprint":
        q = q.eq("blueprint_enabled", True)
    rows = q.order("sort_order").execute().data or []
    return {
        "scope": scope,
        "total": len(rows),
        "languages": [_slim(r) for r in rows],
    }


# ════════════════════════════════════════════════════════════════════════
# § PLATFORM LANGUAGES — Admin CRUD
# ════════════════════════════════════════════════════════════════════════
class LanguagePatch(BaseModel):
    name:                   Optional[str]  = None
    native_name:            Optional[str]  = None
    region:                 Optional[str]  = None
    dial_code:              Optional[str]  = None
    enabled:                Optional[bool] = None
    public_enabled:         Optional[bool] = None
    blueprint_enabled:      Optional[bool] = None
    rtl:                    Optional[bool] = None
    fallback_locale:        Optional[str]  = None
    sort_order:             Optional[int]  = None
    ai_translation_enabled: Optional[bool] = None
    short_label:            Optional[str]  = None
    base_code:              Optional[str]  = None


# Blueprint operational whitelist (hard-coded canon; mirrors languages.js)
BLUEPRINT_OPERATIONAL_CODES = frozenset({"it", "en-US", "en-GB", "fr", "de", "es"})


def _require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not is_super_admin(current_user.get("role")):
        raise HTTPException(403, "Super admin only")
    return current_user


@router.get("/admin/languages")
def admin_list_languages(_user=Depends(_require_super_admin)):
    """Full list with admin metadata. NO filtering."""
    c = db()
    rows = (c.table("platform_languages").select("*")
            .order("sort_order").execute().data or [])
    return {
        "total":     len(rows),
        "languages": [_slim(r) for r in rows],
        "blueprint_operational_codes": sorted(BLUEPRINT_OPERATIONAL_CODES),
    }


@router.patch("/admin/languages/{code}")
def admin_update_language(code: str, patch: LanguagePatch,
                          _user=Depends(_require_super_admin)):
    """Update toggles / metadata for one language row.

    Enforces:
      • blueprint_enabled = TRUE ONLY for whitelisted codes
      • cannot disable the row that is default_locale (use set-default first)
    """
    c = db()
    rows = (c.table("platform_languages").select("*")
            .eq("code", code).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, f"Lingua {code} non trovata")
    current = rows[0]

    body = patch.model_dump(exclude_unset=True)

    # Enforce blueprint operational whitelist
    if body.get("blueprint_enabled") is True and code not in BLUEPRINT_OPERATIONAL_CODES:
        raise HTTPException(400,
            f"Codice {code} non è nel whitelist Blueprint operativo "
            f"({sorted(BLUEPRINT_OPERATIONAL_CODES)}). "
            f"Aggiorna la whitelist nel routers/platform.py per estenderla.")

    # Cannot disable the default locale
    if body.get("enabled") is False and current.get("default_locale"):
        raise HTTPException(400,
            "Impossibile disattivare la lingua predefinita. "
            "Imposta prima un'altra lingua come predefinita.")

    body["updated_at"] = _now()
    c.table("platform_languages").update(body).eq("code", code).execute()

    updated = (c.table("platform_languages").select("*")
               .eq("code", code).limit(1).execute().data or [])[0]
    return {"language": _slim(updated), "changed_fields": list(body.keys())}


@router.post("/admin/languages/{code}/default")
def admin_set_default(code: str, _user=Depends(_require_super_admin)):
    """Set this language as the platform default (atomic flip)."""
    c = db()
    rows = (c.table("platform_languages").select("*")
            .eq("code", code).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, f"Lingua {code} non trovata")
    if not rows[0].get("enabled"):
        raise HTTPException(400, "Impossibile rendere predefinita una lingua disattivata.")

    # Two-step (Supabase REST doesn't support multi-row tx; we use the
    # partial unique index `platform_languages_one_default` as guard).
    c.table("platform_languages").update({"default_locale": False,
                                           "updated_at": _now()}
        ).eq("default_locale", True).execute()
    c.table("platform_languages").update({"default_locale": True,
                                           "updated_at": _now()}
        ).eq("code", code).execute()

    return {"ok": True, "default_locale": code}
