"""Editorial Taxonomy API — Sprint JOURNEY-TAXONOMY-I18N (iter118).

Exposes the editorial taxonomy registry to the frontend so that Journey
cards / status badges / CRM stages / Companion states all render via
DB-driven (well, registry-driven) lookups instead of inline strings.

The taxonomy is ALSO embedded in /api/blueprint/i18n/{locale} and
/api/public/i18n/{locale} for clients that already fetch the i18n bundle
(see server.py wire-up). This endpoint is the canonical, scoped surface
for taxonomy-only fetches (cheaper than full i18n).
"""
from fastapi import APIRouter, HTTPException
from taxonomy import (
    TAXONOMY, flatten_for_locale, list_taxonomy_types,
    TAXONOMY_FALLBACK_CHAIN, TAXONOMY_SOURCE_LOCALE,
)

router = APIRouter()

# Locale visibility mirrors the public registry (public_enabled).
# Blueprint operational locales are a strict subset — the taxonomy endpoint
# accepts ALL public locales so client + admin surfaces can both read it.
ALLOWED_TAXONOMY_LOCALES = frozenset({
    "it", "en-US", "en-GB", "fr", "de", "es", "ar",
})


@router.get("/{locale}")
def get_taxonomy(locale: str):
    """Returns the full taxonomy registry resolved for the requested locale.

    Format:
       {
         "locale": "en-US",
         "fallback_chain": ["en-US", "it"],
         "taxonomies": {
            "journey_lifecycle_client": { "in_progress": "The journey is unfolding", ... },
            "journey_lifecycle_studio": { "in_progress": "Journey unfolding", ... },
            ...
         },
         "flat": { "taxonomy.journey_lifecycle_client.in_progress": "...", ... }
       }
    """
    if locale not in ALLOWED_TAXONOMY_LOCALES:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "unknown_taxonomy_locale",
                "message": f"Taxonomy is not available for locale '{locale}'.",
                "allowed": sorted(ALLOWED_TAXONOMY_LOCALES),
            },
        )

    resolved: dict[str, dict[str, str]] = {}
    for tax_type, entries in TAXONOMY.items():
        resolved[tax_type] = {}
        for key, by_locale in entries.items():
            resolved[tax_type][key] = (
                by_locale.get(locale)
                or by_locale.get("en-US")
                or by_locale.get(TAXONOMY_SOURCE_LOCALE)
                or key
            )

    return {
        "locale": locale,
        "source_locale": TAXONOMY_SOURCE_LOCALE,
        "fallback_chain": list(TAXONOMY_FALLBACK_CHAIN),
        "taxonomies": resolved,
        "flat": flatten_for_locale(locale),
    }


@router.get("")
def list_taxonomies():
    """Returns the list of taxonomy types and their key counts. Used by the
    Translation Studio governance to render coverage tables."""
    return {
        "types": [
            {"type": t, "key_count": len(TAXONOMY[t])}
            for t in list_taxonomy_types()
        ],
        "allowed_locales": sorted(ALLOWED_TAXONOMY_LOCALES),
        "source_locale": TAXONOMY_SOURCE_LOCALE,
    }
