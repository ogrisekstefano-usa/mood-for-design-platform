"""
Corporate Repository — reads from Blueprint CMS tables (cms_pages, cms_sections).
Tenant-aware via tenant_resolver. Cached for 60s per page+locale.
"""
from __future__ import annotations
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import AsyncSessionLocal
from models import CmsPage, CmsSection, Tenant, TenantDomain
from cache import content_cache
from tenant_resolver import get_corporate_tenant

FALLBACK_LOCALE = 'en-us'


def _resolve_locale(content_map: dict, locale: str) -> dict:
    """Resolve multilingual content with chain: requested → en-us → first available."""
    if not isinstance(content_map, dict):
        return {}
    return (
        content_map.get(locale)
        or content_map.get(FALLBACK_LOCALE)
        or next(iter(content_map.values()), {})
    )


class CorporateRepository:

    async def get_tenant(self) -> dict:
        return await get_corporate_tenant()

    # ── Pages ─────────────────────────────────────────────────────────────────

    async def get_page(self, slug: str, locale: str = FALLBACK_LOCALE) -> Optional[dict]:
        tenant = await self.get_tenant()
        cache_key = f'page:{tenant["id"]}:{slug}:{locale}'
        return await content_cache.get_or_set(
            cache_key,
            lambda: self._fetch_page(tenant['id'], slug, locale),
            ttl=60,
        )

    async def _fetch_page(self, tenant_id: str, slug: str, locale: str) -> Optional[dict]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(CmsPage)
                .options(selectinload(CmsPage.sections))
                .where(CmsPage.tenant_id == tenant_id)
                .where(CmsPage.page_key == slug)
                .where(CmsPage.status == 'published')
            )
            page = result.scalar_one_or_none()
            if not page:
                return None

            sections_out = []
            for section in page.sections:
                if not section.visible:
                    continue
                if section.section_type == 'navigation':
                    # navigation is served via /api/corporate/navigation
                    continue
                resolved = _resolve_locale(section.locale_content or {}, locale)
                sections_out.append({
                    'id': str(section.id),
                    'type': section.section_type,
                    'display_order': section.sort_order,
                    'config': section.settings or {},
                    'content': resolved,
                    'asset_refs': [str(a) for a in (section.asset_refs or [])],
                })

            seo_map = page.locale_meta or {}
            seo = seo_map.get(locale) or seo_map.get(FALLBACK_LOCALE) or {}

            return {
                'page': {
                    'id': str(page.id),
                    'slug': page.page_key,
                    'title': seo.get('title', page.title or page.page_key.replace('-', ' ').title()),
                    'meta_description': seo.get('description', ''),
                    'seo': seo,
                    'template': (page.page_content or {}).get('template', 'corporate-default'),
                },
                'sections': sections_out,
            }

    async def list_pages(self) -> list[dict]:
        tenant = await self.get_tenant()
        cache_key = f'pages_list:{tenant["id"]}'

        async def loader():
            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    select(CmsPage.page_key, CmsPage.status)
                    .where(CmsPage.tenant_id == tenant['id'])
                )
                return [
                    {'slug': r[0], 'published': r[1] == 'published'}
                    for r in result.all()
                ]
        return await content_cache.get_or_set(cache_key, loader, ttl=120)

    # ── Navigation (stored as a dedicated cms_section type: 'navigation') ─────

    async def get_navigation(self, locale: str = FALLBACK_LOCALE) -> dict:
        tenant = await self.get_tenant()
        cache_key = f'nav:{tenant["id"]}:{locale}'

        async def loader():
            async with AsyncSessionLocal() as session:
                # navigation lives on the 'home' page as a section of type 'navigation'
                result = await session.execute(
                    select(CmsSection)
                    .join(CmsPage, CmsSection.page_id == CmsPage.id)
                    .where(CmsPage.tenant_id == tenant['id'])
                    .where(CmsSection.section_type == 'navigation')
                    .order_by(CmsSection.sort_order)
                )
                sections = result.scalars().all()
                if not sections:
                    return {'main': [], 'cta': None, 'footer': {}}

                # Aggregate all navigation rows into a single resolved structure.
                resolved = _resolve_locale(sections[0].locale_content or {}, locale)
                settings = sections[0].settings or {}
                return {
                    'main': resolved.get('main', settings.get('main', [])),
                    'cta': resolved.get('cta', settings.get('cta')),
                    'footer': resolved.get('footer', settings.get('footer', {})),
                }

        return await content_cache.get_or_set(cache_key, loader, ttl=120)


repository = CorporateRepository()
