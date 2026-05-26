"""
Site Resolver (ITER149)
─────────────────────────────────────────────────────────────────────────────
Joins cms_sections (layout skeleton) ⇄ editorial_blocks (i18n copy) ⇄
media_library (assets) and returns fully-resolved page content per locale.

Architecture (per project directive):
  • cms_sections.settings:
      {
        "blocks": { "<semantic_key>": "<editorial_block.full_key>" },
        "media":  { "<semantic_key>": "<media_library.id>"        },
        "options":{ free-form per section type (layout, dim, progress, ...)  }
      }
  • editorial_blocks key = "<namespace>.<block_key>"
  • Multi-locale via editorial_block_translations (fallback chain)
"""
from __future__ import annotations
from typing import Any
from sqlalchemy import text

from database import AsyncSessionLocal
from cache import content_cache
from tenant_resolver import get_corporate_tenant

DEFAULT_LOCALE = 'en-us'
LOCALE_FALLBACK = ['en-us', 'it']


def _split_block_key(full_key: str) -> tuple[str, str]:
    """'site.home.hero.title' → ('site.home', 'hero.title')  — namespace.block_key."""
    parts = full_key.split('.')
    if len(parts) < 3:
        # Treat as namespace=parts[0], key=rest
        return parts[0], '.'.join(parts[1:]) if len(parts) > 1 else ''
    # We split at the LAST 2 dots? Easier: namespace = everything except last 2 segments... Actually we keep
    # namespace = first 2 segments (site.home), block_key = rest
    return '.'.join(parts[:2]), '.'.join(parts[2:])


async def _fetch_block_values(session, tenant_id: str, full_keys: list[str], locale: str) -> dict[str, str]:
    """Fetch resolved block values keyed by their full_key."""
    if not full_keys:
        return {}

    # Build (namespace, block_key) pairs
    pairs = [_split_block_key(k) for k in full_keys]
    namespaces = list({p[0] for p in pairs})
    block_keys = list({p[1] for p in pairs})

    rows = (await session.execute(
        text("""
            SELECT b.namespace, b.block_key, b.source_locale, b.source_value,
                   t.locale AS tx_locale, t.value AS tx_value
            FROM editorial_blocks b
            LEFT JOIN editorial_block_translations t ON t.block_id = b.id
            WHERE b.tenant_id = :tid
              AND b.namespace = ANY(:ns)
              AND b.block_key = ANY(:bks)
              AND b.is_active = true
        """),
        {"tid": tenant_id, "ns": namespaces, "bks": block_keys},
    )).mappings().all()

    # Group: key -> {locale: value, '_source_locale': ..., '_source_value': ...}
    grouped: dict[str, dict[str, str]] = {}
    for r in rows:
        full = f"{r['namespace']}.{r['block_key']}"
        bucket = grouped.setdefault(full, {})
        bucket['_source_locale'] = r['source_locale']
        bucket['_source_value']  = r['source_value']
        if r['tx_locale']:
            bucket[r['tx_locale']] = r['tx_value']

    # Resolve per requested locale with fallback chain
    chain = [locale] + [l for l in LOCALE_FALLBACK if l != locale]
    out: dict[str, str] = {}
    for fk in full_keys:
        bucket = grouped.get(fk)
        if not bucket:
            out[fk] = ''
            continue
        val = None
        for loc in chain:
            v = bucket.get(loc)
            if v:
                val = v
                break
        if val is None:
            # final fallback: source_value
            val = bucket.get('_source_value') or ''
        out[fk] = val
    return out


async def _fetch_media(session, tenant_id: str, ids: list[str], locale: str) -> dict[str, dict]:
    if not ids:
        return {}
    rows = (await session.execute(
        text("""
            SELECT id, file_url, alt_text, focal_point, dominant_color, width, height,
                   description, mime_type
            FROM media_library
            WHERE tenant_id = :tid AND id = ANY(:ids) AND archived_at IS NULL
        """),
        {"tid": tenant_id, "ids": ids},
    )).mappings().all()
    out = {}
    for r in rows:
        out[str(r['id'])] = {
            'id': str(r['id']),
            'url': r['file_url'],
            'alt': r['alt_text'] or '',
            'focal_point': r['focal_point'],
            'dominant_color': r['dominant_color'],
            'width': r['width'],
            'height': r['height'],
            'mime_type': r['mime_type'],
        }
    return out


async def resolve_page(slug: str, locale: str = DEFAULT_LOCALE) -> dict | None:
    tenant = await get_corporate_tenant()
    cache_key = f"site:page:{tenant['id']}:{slug}:{locale}"

    async def loader():
        async with AsyncSessionLocal() as session:
            page = (await session.execute(
                text("""
                    SELECT id, page_key, title, locale_meta, page_content
                    FROM cms_pages
                    WHERE tenant_id = :tid AND page_key = :slug AND status = 'published'
                """),
                {"tid": tenant['id'], "slug": slug},
            )).mappings().first()

            if not page:
                return None

            sections = (await session.execute(
                text("""
                    SELECT id, section_type, sort_order, settings
                    FROM cms_sections
                    WHERE page_id = :pid AND visible = true
                      AND COALESCE(deleted_at IS NULL, true)
                      AND section_type NOT IN ('navigation', 'footer')
                    ORDER BY sort_order
                """),
                {"pid": page['id']},
            )).mappings().all()

            # collect all block refs + media ids
            all_blocks: list[str] = []
            all_media: list[str] = []
            for s in sections:
                settings = s['settings'] or {}
                for v in (settings.get('blocks') or {}).values():
                    if isinstance(v, str) and v:
                        all_blocks.append(v)
                for v in (settings.get('media') or {}).values():
                    if isinstance(v, str) and v:
                        all_media.append(v)

            block_values = await _fetch_block_values(session, tenant['id'], all_blocks, locale)
            media_index  = await _fetch_media(session, tenant['id'], all_media, locale)

            resolved_sections = []
            for s in sections:
                settings = s['settings'] or {}
                # resolve blocks
                content = {}
                for sem, fk in (settings.get('blocks') or {}).items():
                    content[sem] = block_values.get(fk, '')
                # resolve media
                media = {}
                for sem, mid in (settings.get('media') or {}).items():
                    media[sem] = media_index.get(mid) if mid else None
                resolved_sections.append({
                    'id': str(s['id']),
                    'type': s['section_type'],
                    'sort': s['sort_order'],
                    'content': content,
                    'media': media,
                    'links': settings.get('links') or {},
                    'options': settings.get('options') or {},
                })

            seo_map = page['locale_meta'] or {}
            seo = dict(seo_map.get(locale) or seo_map.get(DEFAULT_LOCALE) or {})

            # Resolve og_image (media UUID) → public URL
            og_image_id = seo.get('og_image')
            if og_image_id:
                try:
                    media_row = await session.execute(
                        text("""SELECT file_url FROM media_library
                                WHERE id = CAST(:id AS uuid) AND tenant_id = :tid
                                  AND archived_at IS NULL LIMIT 1"""),
                        {"id": og_image_id, "tid": tenant['id']},
                    )
                    m = media_row.mappings().first()
                    if m:
                        seo['og_image_url'] = m['file_url']
                except Exception:
                    pass

            return {
                'page': {
                    'id': str(page['id']),
                    'slug': page['page_key'],
                    'title': seo.get('title') or page['title'] or page['page_key'].title(),
                    'meta_description': seo.get('description') or '',
                    'seo': seo,
                },
                'sections': resolved_sections,
            }

    return await content_cache.get_or_set(cache_key, loader, ttl=60)


async def resolve_navigation(locale: str = DEFAULT_LOCALE) -> dict:
    """Reads site.nav items + CTAs from editorial_blocks."""
    tenant = await get_corporate_tenant()
    cache_key = f"site:nav:{tenant['id']}:{locale}"

    async def loader():
        async with AsyncSessionLocal() as session:
            # Get the 'navigation' section on home page that carries the order/href
            sec_row = (await session.execute(
                text("""
                    SELECT s.settings
                    FROM cms_sections s
                    JOIN cms_pages p ON s.page_id = p.id
                    WHERE p.tenant_id = :tid AND s.section_type = 'navigation'
                      AND s.visible = true
                    ORDER BY s.sort_order
                    LIMIT 1
                """),
                {"tid": tenant['id']},
            )).mappings().first()

            settings = (sec_row or {}).get('settings') or {}
            items_cfg: list[dict] = settings.get('items') or []   # [{key, href, label_block, visible, position?}]
            cta_cfg: dict | None  = settings.get('cta') or None   # legacy {key, href, label_block}

            block_keys: list[str] = []
            for it in items_cfg:
                if it.get('label_block'):
                    block_keys.append(it['label_block'])
            if cta_cfg and cta_cfg.get('label_block'):
                block_keys.append(cta_cfg['label_block'])

            values = await _fetch_block_values(session, tenant['id'], block_keys, locale)

            def _render(it: dict) -> dict:
                return {
                    'key':  it['key'],
                    'href': it['href'],
                    'label': values.get(it.get('label_block', ''), '') or it.get('fallback', it['key']),
                }

            visible = [it for it in items_cfg if it.get('visible', True)]
            main  = [_render(it) for it in visible if (it.get('position') or 'main') == 'main']
            right = [_render(it) for it in visible if it.get('position') == 'right']

            cta = None
            if cta_cfg:
                cta = {
                    'key':   cta_cfg['key'],
                    'href':  cta_cfg['href'],
                    'label': values.get(cta_cfg.get('label_block', ''), '') or cta_cfg.get('fallback', ''),
                }

            return {'main': main, 'right': right, 'cta': cta}

    return await content_cache.get_or_set(cache_key, loader, ttl=60)


async def resolve_footer(locale: str = DEFAULT_LOCALE) -> dict:
    """Reads site.footer from editorial_blocks (manifesto + minimal link list)."""
    tenant = await get_corporate_tenant()
    cache_key = f"site:footer:{tenant['id']}:{locale}"

    async def loader():
        async with AsyncSessionLocal() as session:
            sec_row = (await session.execute(
                text("""
                    SELECT s.settings
                    FROM cms_sections s
                    JOIN cms_pages p ON s.page_id = p.id
                    WHERE p.tenant_id = :tid AND s.section_type = 'footer'
                      AND s.visible = true
                    LIMIT 1
                """),
                {"tid": tenant['id']},
            )).mappings().first()

            settings = (sec_row or {}).get('settings') or {}
            links_cfg: list[dict] = settings.get('links') or []
            legal_cfg: list[dict] = settings.get('legal') or []
            social_cfg: list[dict] = settings.get('social') or []  # [{key, href, icon}]
            blocks_map: dict      = settings.get('blocks') or {}    # {manifesto: 'site.footer.manifesto', copyright: '...'}

            block_keys = []
            block_keys.extend(blocks_map.values())
            for L in links_cfg:
                if L.get('label_block'): block_keys.append(L['label_block'])
            for L in legal_cfg:
                if L.get('label_block'): block_keys.append(L['label_block'])

            values = await _fetch_block_values(session, tenant['id'], block_keys, locale)

            return {
                'manifesto':  values.get(blocks_map.get('manifesto', ''), ''),
                'copyright':  values.get(blocks_map.get('copyright', ''), ''),
                'links':  [{'key': L['key'], 'href': L['href'],
                            'label': values.get(L.get('label_block', ''), '') or L.get('fallback', ''),
                            'group': L.get('group'),
                            'isHeading': L.get('isHeading', False)}
                           for L in links_cfg if L.get('visible', True)],
                'legal':  [{'key': L['key'], 'href': L['href'],
                            'label': values.get(L.get('label_block', ''), '') or L.get('fallback', ''),
                            'isHeading': L.get('isHeading', False)}
                           for L in legal_cfg if L.get('visible', True)],
                'social': [{'key': s['key'], 'href': s['href'], 'icon': s.get('icon', s['key'])}
                           for s in social_cfg if s.get('visible', True)],
            }

    return await content_cache.get_or_set(cache_key, loader, ttl=60)


async def resolve_locales() -> dict:
    """Returns enabled locales for the corporate tenant (Locale Governance)."""
    tenant = await get_corporate_tenant()

    async def loader():
        async with AsyncSessionLocal() as session:
            row = (await session.execute(
                text("""
                    SELECT default_language, active_languages
                    FROM tenants WHERE id = :tid
                """),
                {"tid": tenant['id']},
            )).mappings().first()
            if not row:
                return {'default': DEFAULT_LOCALE, 'enabled': [DEFAULT_LOCALE]}
            return {
                'default': row['default_language'] or DEFAULT_LOCALE,
                'enabled': list(row['active_languages'] or [DEFAULT_LOCALE]),
            }

    return await content_cache.get_or_set(f"site:locales:{tenant['id']}", loader, ttl=120)


async def resolve_block(full_key: str, locale: str = DEFAULT_LOCALE) -> dict[str, Any] | None:
    tenant = await get_corporate_tenant()
    async with AsyncSessionLocal() as session:
        values = await _fetch_block_values(session, tenant['id'], [full_key], locale)
        return {'key': full_key, 'value': values.get(full_key, ''), 'locale': locale}


def invalidate_site_cache():
    """Call after any admin mutation."""
    content_cache.clear_prefix('site:')
