"""Public i18n endpoint — Sprint HARDENING-I18N-GUARD™ (iter117).

Separation from Blueprint operational locales:
  · /api/blueprint/i18n/{locale}  → 6 operational locales only (it, en-US, en-GB, fr, de, es)
  · /api/public/i18n/{locale}     → full registry public_enabled (includes ar, future zh/ja)

This is the public-facing companion endpoint for the Client Companion,
the public marketing site, the onboarding flows, and the Dossier surface.
It uses the SAME DEFAULT_I18N dictionary as the Blueprint endpoint —
the only difference is the allowed locale set.

Mirrors the frontend Global Language Registry public_enabled flag.
"""
from fastapi import APIRouter, HTTPException, Query
from routers.blueprint import DEFAULT_I18N, LOCALE_FALLBACK, _deep_merge, _flatten, _get_setting
from database import db, db_available

router = APIRouter()

# Public-facing locales: superset of Blueprint operational + extras (ar today,
# zh/ja future). Keep this in sync with public_enabled flags in
# /app/frontend/src/site/content/languages.js.
PUBLIC_LOCALES = frozenset({
    "it", "en-US", "en-GB", "fr", "de", "es", "ar",
})


@router.get("/i18n/{locale}")
def get_public_locale_strings(
    locale: str,
    tenant_slug: str = Query(None),
):
    """Returns flattened translation map for a public-facing locale.

    Unlike the Blueprint endpoint, this accepts AR (and future ZH/JA).
    Unknown / disabled locales return 404 (not 403): they simply do not
    exist on the platform from a public perspective.
    """
    if locale not in PUBLIC_LOCALES:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "unknown_public_locale",
                "message": f"Locale '{locale}' is not part of the public language registry.",
                "public_locales": sorted(PUBLIC_LOCALES),
            },
        )

    base = DEFAULT_I18N.get(locale) or DEFAULT_I18N.get(LOCALE_FALLBACK, {})
    overrides = {}
    if db_available() and tenant_slug:
        client = db()
        t = client.table('tenants').select('id').eq('slug', tenant_slug).limit(1).execute()
        if t.data:
            ov = _get_setting(client, t.data[0]['id'], f'i18n.{locale}', None)
            if ov:
                overrides = ov

    merged = _deep_merge(base, overrides)
    flat = _flatten(merged)
    # Sprint JOURNEY-TAXONOMY-I18N™: embed editorial taxonomy directly inside
    # the i18n payload so the frontend `t()` resolver picks up keys like
    # `taxonomy.journey_lifecycle_studio.in_progress` without a separate fetch.
    try:
        from taxonomy import flatten_for_locale as _tax_flatten  # noqa: WPS433
        flat.update(_tax_flatten(locale))
    except Exception:
        pass  # taxonomy module absent or broken — fail soft, i18n still works
    return {
        "locale": locale,
        "fallback": LOCALE_FALLBACK if locale not in DEFAULT_I18N else None,
        "messages": flat,
        "scope": "public",
    }


@router.get("/i18n")
def list_public_locales():
    """Returns available public locales (full registry public_enabled).

    Note: Blueprint admin lists 6 operational locales via /api/blueprint/i18n.
    This endpoint returns the WIDER public set so Client Companion / public site
    can present languages like Arabic that are not allowed in admin surfaces.
    """
    return {
        "locales": [
            {"code": "it",    "label": "Italian",     "native": "Italiano",      "rtl": False},
            {"code": "en-US", "label": "English (US)","native": "English (US)",  "rtl": False},
            {"code": "en-GB", "label": "English (UK)","native": "English (UK)",  "rtl": False},
            {"code": "fr",    "label": "French",      "native": "Français",      "rtl": False},
            {"code": "de",    "label": "German",      "native": "Deutsch",       "rtl": False},
            {"code": "es",    "label": "Spanish",     "native": "Español",       "rtl": False},
            {"code": "ar",    "label": "Arabic (UAE)","native": "العربية",        "rtl": True},
        ],
        "default": LOCALE_FALLBACK,
        "scope": "public",
    }
