"""
Geo service — countries + operating markets, DB-driven, no hardcoded.
Italian name fallback is sourced from editorial_blocks
(namespace = 'geo.country.<ISO2>.label'). When a translation is
missing, we fall back to the English country name from the DB.
"""
from __future__ import annotations
from sqlalchemy import text
from database import AsyncSessionLocal
from tenant_resolver import get_corporate_tenant


async def list_countries(locale: str = 'it-IT', q: str | None = None) -> list[dict]:
    q_norm = (q or '').strip().lower()
    tenant = await get_corporate_tenant()
    tid    = tenant['id']
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(text("""
            SELECT iso2, iso3, name_en, flag_emoji, dial_code,
                   continent, region
              FROM countries
             WHERE is_active = TRUE
             ORDER BY name_en
        """))).mappings().all()

        tx = (await s.execute(text("""
            SELECT b.block_key, COALESCE(t.value, b.source_value) AS val
              FROM editorial_blocks b
              LEFT JOIN editorial_block_translations t
                ON t.block_id = b.id AND t.locale = :loc
             WHERE b.tenant_id = :tid
               AND b.namespace = 'geo.country'
        """), {"loc": locale, "tid": tid})).mappings().all()
        labels: dict[str, str] = {}
        for r in tx:
            key = (r['block_key'] or '').split('.')[0]
            if r['val']:
                labels[key] = r['val']

    out: list[dict] = []
    for r in rows:
        label = labels.get(r['iso2']) or r['name_en']
        if q_norm and q_norm not in label.lower() and q_norm not in r['iso2'].lower():
            continue
        out.append({
            'iso2':      r['iso2'],
            'iso3':      r['iso3'],
            'label':     label,
            'name_en':   r['name_en'],
            'flag':      r['flag_emoji'],
            'dial_code': r['dial_code'],
            'continent': r['continent'],
            'region':    r['region'],
        })
    # Sort by localized label
    out.sort(key=lambda c: c['label'].lower())
    return out


async def list_operating_markets(locale: str = 'it-IT') -> list[dict]:
    """Public-facing markets: only is_active + public_enabled."""
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(text("""
            SELECT id, code, display_name, primary_locale, sort_order
              FROM markets
             WHERE active = TRUE AND public_enabled = TRUE
             ORDER BY sort_order, code
        """))).mappings().all()
    out: list[dict] = []
    for r in rows:
        dn = r['display_name'] or {}
        label = dn.get(locale) or dn.get('en-US') or dn.get('it-IT') or r['code']
        out.append({
            'id':             str(r['id']),
            'code':           r['code'],
            'label':          label,
            'primary_locale': r['primary_locale'],
        })
    return out
