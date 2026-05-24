"""ITER145.A · Email Editorial Resolver™.

Single source of truth for resolving email copy across the locale chain
via Editorial Runtime™ (`system.email.*` namespace).

Public functions
────────────────
  resolve_email_copy(template_key, locale, *, tenant_id=None)
    → dict of {field_name: value} (e.g. subject, preheader, body, cta, …)
    Walks the in-family fallback chain; uses ALE-produced translations
    first, falls back to the Italian source, then to the optional inline
    `fallback_copy` for backwards-compat with the legacy hardcoded layer.

  resolve_enabled_locales(tenant_id)
    → dict with `{enabled_locales, default_locale, fallback_locale,
        locale_source, available_platform_locales}`. Tenant Locale
    Orchestration™ source of truth.

  filter_to_enabled(locale, enabled_locales, default_locale)
    → returns the locale if enabled, otherwise the default; the rest
    of the platform must use this whenever it accepts user-supplied
    locale input.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from database import db, db_available
from services.editorial_content_orchestrator import (
    _fallback_chain,
    _normalize_locale,
    resolve_page_bundle,
)
from services.tenant_config_resolver import resolve_tenant_config

log = logging.getLogger(__name__)

# Platform-wide canonical locales (Blueprint operator governance).
PLATFORM_LOCALES: List[str] = [
    "it-IT", "en-US", "en-GB", "fr-FR", "de-DE", "es-ES",
]
PLATFORM_DEFAULT_LOCALE = "it-IT"
PLATFORM_FALLBACK_LOCALE = "it-IT"

# Page-key naming convention: system-email-<template_key (dashed)>.
def _page_key_for(template_key: str) -> str:
    return f"system-email-{template_key.replace('_', '-')}"


def resolve_email_copy(
    template_key: str,
    locale: str,
    *,
    tenant_id: Optional[str] = None,
) -> Dict[str, str]:
    """Return per-locale copy dict for a single email template.

    Output keys follow the seeded shape:
      {subject, preheader, eyebrow, title, body, cta, legal, …}

    `template_key` examples: 'auth_reset', 'invite', 'onboarding',
    'lead_captured', 'magic_link'.
    """
    page_key = _page_key_for(template_key)
    # Locale filter so we never render a locale the tenant disabled.
    if tenant_id:
        info = resolve_enabled_locales(tenant_id)
        locale = filter_to_enabled(
            locale, info["enabled_locales"], info["default_locale"]
        )

    bundle = resolve_page_bundle(page_key, locale, scope="system")
    # Prefix-strip namespace: system.email.auth_reset.subject → subject
    prefix = f"system.email.{template_key}."
    out: Dict[str, str] = {}
    for full_key, value in bundle.items():
        if full_key.startswith(prefix):
            field = full_key[len(prefix):]
            out[field] = value
    return out


def resolve_enabled_locales(tenant_id: Optional[str]) -> Dict[str, Any]:
    """Return the runtime locale envelope for the tenant.

    Locale orchestration source of truth.

    Output:
      {
        'enabled_locales':  [...subset of PLATFORM_LOCALES...],
        'default_locale':   'it-IT',
        'fallback_locale':  'it-IT',
        'locale_source':    'tenant' | 'platform_default',
        'available_platform_locales': [...full platform list...],
      }
    """
    cfg = resolve_tenant_config(tenant_id) if tenant_id else {}
    enabled = cfg.get("enabled_locales") or []
    # Sanity-filter to canonical platform locales (defensive).
    enabled = [loc for loc in enabled if loc in PLATFORM_LOCALES]
    if not enabled:
        enabled = list(PLATFORM_LOCALES)
        source = "platform_default"
    else:
        source = "tenant"

    default = cfg.get("default_locale")
    if not default or default not in enabled:
        default = PLATFORM_DEFAULT_LOCALE if PLATFORM_DEFAULT_LOCALE in enabled else enabled[0]

    return {
        "enabled_locales":  enabled,
        "default_locale":   default,
        "fallback_locale":  PLATFORM_FALLBACK_LOCALE,
        "locale_source":    source,
        "available_platform_locales": list(PLATFORM_LOCALES),
    }


def filter_to_enabled(
    locale: str,
    enabled_locales: List[str],
    default_locale: str,
) -> str:
    """Coerce a locale to the tenant-allowed set.

    NO global locale leakage: any locale outside `enabled_locales`
    silently degrades to the tenant default.
    """
    if not locale:
        return default_locale
    locale = _normalize_locale(locale)
    # Compare on full BCP-47 token first
    for el in enabled_locales:
        if el.lower() == locale.lower():
            return el
    # Then on language family (e.g. en-AU → en-US if en-US is enabled)
    family = locale.split("-")[0].lower()
    for el in enabled_locales:
        if el.split("-")[0].lower() == family:
            return el
    return default_locale


def resolve_email_stats(template_key: Optional[str] = None) -> Dict[str, Any]:
    """Diagnostic — count blocks + translation coverage for the Runtime
    Inspector locale block.
    """
    if not db_available():
        return {"blocks": 0, "translations": 0, "stale": 0}
    c = db()
    q = c.table("editorial_blocks").select("id, namespace, block_key") \
         .like("namespace", "system.email%")
    blocks = q.execute().data or []
    block_ids = [b["id"] for b in blocks]
    if not block_ids:
        return {"blocks": 0, "translations": 0, "stale": 0}
    trans = (c.table("editorial_block_translations")
             .select("block_id, locale, status")
             .in_("block_id", block_ids).execute().data or [])
    stale = 0
    for t in trans:
        # ALE may not always populate source_value_hash_at_translation; be defensive.
        if t.get("status") == "stale":
            stale += 1
    return {
        "blocks":       len(blocks),
        "translations": len(trans),
        "stale":        stale,
        "locales_covered": sorted({(t.get("locale") or "").lower() for t in trans}),
    }
