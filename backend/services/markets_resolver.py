"""
Markets Resolver (Market Architecture First)
─────────────────────────────────────────────────────────────────────────────
Resolves the `markets` catalog enriched with platform_languages metadata
(RTL flag, enabled state) and computes `effective_locale` via the
fallback chain.

NO hardcoded markets, locales, or country labels — single source of truth
is the database.

Usage:
  await resolve_markets(locale='it-IT') -> {default_market, markets, groups}
"""
from __future__ import annotations
from sqlalchemy import text

from database import AsyncSessionLocal
from cache import content_cache


async def _all_enabled_locales() -> set[str]:
    async def loader():
        async with AsyncSessionLocal() as s:
            rows = (await s.execute(text(
                "SELECT code FROM platform_languages WHERE enabled = true"
            ))).all()
            return [r[0] for r in rows]
    codes = await content_cache.get_or_set('platform:enabled_locales', loader, ttl=300)
    return set(codes)


async def _platform_languages_index() -> dict[str, dict]:
    """Index of every platform_languages row, keyed by `code`."""
    async def loader():
        async with AsyncSessionLocal() as s:
            rows = (await s.execute(text("""
                SELECT code, name, native_name, enabled, public_enabled,
                       default_locale, rtl, fallback_locale, short_label
                FROM platform_languages
            """))).all()
            return [dict(zip(['code','name','native_name','enabled','public_enabled',
                              'default_locale','rtl','fallback_locale','short_label'], r))
                    for r in rows]
    rows = await content_cache.get_or_set('platform:languages_index', loader, ttl=300)
    return {r['code']: r for r in rows}


def _resolve_effective_locale(primary: str, fallback: str,
                              enabled: set[str], index: dict[str, dict]) -> str:
    """Walk fallback chain (max 6 hops) until we find an enabled locale."""
    seen = set()
    cur = primary
    for _ in range(6):
        if cur in seen:
            break
        seen.add(cur)
        meta = index.get(cur)
        if meta and meta.get('enabled'):
            return cur
        nxt = (meta or {}).get('fallback_locale') or fallback
        if not nxt or nxt == cur:
            break
        cur = nxt
    # Last resort: any enabled, prefer en-US, else first
    if 'en-US' in enabled:
        return 'en-US'
    return next(iter(enabled), primary)


def _localize(jsonb_value, locale: str, fallback: str = 'en-US') -> str | None:
    """Pick a string from a JSONB like {"it-IT": "Italia", "en-US": "Italy"}."""
    if not isinstance(jsonb_value, dict):
        return None
    return (jsonb_value.get(locale)
            or jsonb_value.get(fallback)
            or jsonb_value.get('en-US')
            or next(iter(jsonb_value.values()), None))


_MACRO_REGION_LABELS = {
    # Region keys come straight from markets.macro_region — labels
    # are returned per locale by joining against the request locale.
    # Until we wire region labels to CMS, return the raw key (it’s
    # presentation-ready short text). NO localized hardcoded mapping here.
}


async def resolve_markets(locale: str = 'it-IT') -> dict:
    """Return the public markets catalog + grouped layout."""
    enabled = await _all_enabled_locales()
    pl_index = await _platform_languages_index()

    async with AsyncSessionLocal() as session:
        rows = (await session.execute(text("""
            SELECT id, code, display_name, macro_region, countries,
                   primary_locale, fallback_locale, currency,
                   measurement_system, sort_order
            FROM markets
            WHERE active = true
            ORDER BY sort_order, code
        """))).all()

    markets_out: list[dict] = []
    region_buckets: dict[str, list[str]] = {}

    for r in rows:
        (mid, code, display_name, macro_region, countries,
         primary, fallback, currency, measurement, sort_order) = r

        effective = _resolve_effective_locale(primary, fallback, enabled, pl_index)
        rtl = bool(pl_index.get(effective, {}).get('rtl'))

        markets_out.append({
            'code': code,
            'display_name': _localize(display_name, locale),
            'macro_region': macro_region,
            'countries': countries or [],
            'primary_locale': primary,
            'fallback_locale': fallback,
            'effective_locale': effective,
            'currency': currency,
            'measurement_system': measurement,
            'rtl': rtl,
            'sort_order': sort_order,
        })
        region_buckets.setdefault(macro_region, []).append(code)

    groups = [
        {'key': region, 'markets': codes}
        for region, codes in sorted(region_buckets.items(), key=lambda x: x[0])
    ]

    # Default market: first by sort_order whose effective_locale is enabled
    default_code = next(
        (m['code'] for m in markets_out
         if m['effective_locale'] in enabled and m['primary_locale'] in enabled),
        markets_out[0]['code'] if markets_out else None,
    )

    return {
        'default_market': default_code,
        'markets': markets_out,
        'groups': groups,
    }


async def resolve_market_by_code(code: str, locale: str = 'it-IT') -> dict | None:
    catalog = await resolve_markets(locale=locale)
    for m in catalog['markets']:
        if m['code'] == code:
            return m
    return None
