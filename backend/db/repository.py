"""
MOOD for DESIGN — Corporate Repository
Abstraction layer between API and database.

Architecture:
- If DATABASE_URL is configured → use Supabase PostgreSQL via SQLAlchemy
- If not configured → fall back to in-memory seed_data.py (dev/bootstrap mode)

This pattern allows:
1. Development without credentials (seed data)
2. Seamless activation when Supabase URL is provided
3. Same API surface regardless of data source
"""
import logging
import os
from typing import Optional
from database import is_db_configured, AsyncSessionLocal
from db.seed_data import get_page as seed_get_page, get_navigation as seed_get_navigation, get_tenant as seed_get_tenant, LOCALES

logger = logging.getLogger(__name__)

# Only import ORM models if DB is configured
if is_db_configured():
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from models import Tenant, Page, Section, SectionContent, NavigationItem, NavigationContent


class CorporateRepository:
    """
    Repository for mood-corporate tenant.
    Reads from Supabase if configured, falls back to seed data.
    """

    TENANT_SLUG = 'mood-corporate'
    FALLBACK_LOCALE = 'en-us'

    def _resolve_content(self, content_items, locale: str) -> dict:
        """Resolve multilingual content with fallback chain."""
        content_map = {c.locale_code: c.content for c in content_items}
        return (
            content_map.get(locale)
            or content_map.get(self.FALLBACK_LOCALE)
            or next(iter(content_map.values()), {})
        )

    # ── Pages ──────────────────────────────────────────────────────────────────

    async def get_page(self, slug: str, locale: str = 'en-us') -> Optional[dict]:
        if is_db_configured():
            try:
                return await self._get_page_db(slug, locale)
            except Exception as e:
                logger.warning(f"[Repo] DB error for page '{slug}', using seed fallback: {e}")
        return seed_get_page(slug, locale)

    async def _get_page_db(self, slug: str, locale: str) -> Optional[dict]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Page)
                .options(
                    selectinload(Page.sections).selectinload(Section.content_items)
                )
                .join(Page.tenant)
                .where(
                    Tenant.slug == self.TENANT_SLUG,
                    Page.slug == slug,
                    Page.is_published == True,
                    Tenant.is_active == True,
                )
            )
            page = result.scalar_one_or_none()
            if not page:
                return None

            sections = []
            for section in sorted(page.sections, key=lambda s: s.display_order):
                if not section.is_enabled:
                    continue
                resolved_content = self._resolve_content(section.content_items, locale)
                sections.append({
                    'id': section.id,
                    'type': section.type,
                    'display_order': section.display_order,
                    'config': section.config,
                    'content': resolved_content,
                })

            seo_map = page.seo or {}
            seo = seo_map.get(locale) or seo_map.get(self.FALLBACK_LOCALE) or {}

            return {
                'page': {
                    'id': page.id,
                    'slug': page.slug,
                    'title': seo.get('title', page.slug.replace('-', ' ').title()),
                    'meta_description': seo.get('description', ''),
                },
                'sections': sections,
            }

    # ── Navigation ─────────────────────────────────────────────────────────────

    async def get_navigation(self, locale: str = 'en-us') -> dict:
        if is_db_configured():
            try:
                return await self._get_navigation_db(locale)
            except Exception as e:
                logger.warning(f"[Repo] DB error for navigation, using seed: {e}")
        return seed_get_navigation(locale)

    async def _get_navigation_db(self, locale: str) -> dict:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(NavigationItem)
                .options(selectinload(NavigationItem.labels))
                .join(NavigationItem.tenant)
                .where(
                    Tenant.slug == self.TENANT_SLUG,
                    NavigationItem.is_active == True,
                )
                .order_by(NavigationItem.display_order)
            )
            items = result.scalars().all()

            def resolve_label(item):
                label_map = {c.locale_code: c.label for c in item.labels}
                return label_map.get(locale) or label_map.get(self.FALLBACK_LOCALE) or item.key

            main_items = [
                {'id': i.id, 'key': i.key, 'href': i.href, 'label': resolve_label(i)}
                for i in items if i.nav_group == 'main'
            ]
            cta_items = [i for i in items if i.nav_group == 'cta']
            cta = None
            if cta_items:
                c = cta_items[0]
                cta = {'id': c.id, 'key': c.key, 'href': c.href, 'label': resolve_label(c)}

            return {'main': main_items, 'cta': cta}

    # ── Locales ─────────────────────────────────────────────────────────────────

    async def get_locales(self) -> list:
        # Locales are global — seed data is source of truth for now
        return [l for l in LOCALES if l.get('is_active', True)]

    # ── Tenant Config ───────────────────────────────────────────────────────────

    async def get_tenant(self) -> Optional[dict]:
        if is_db_configured():
            try:
                async with AsyncSessionLocal() as session:
                    result = await session.execute(
                        select(Tenant).where(Tenant.slug == self.TENANT_SLUG)
                    )
                    tenant = result.scalar_one_or_none()
                    if tenant:
                        return {
                            'id': tenant.id, 'slug': tenant.slug,
                            'name': tenant.name, 'domain': tenant.domain,
                            'config': tenant.config, 'is_active': tenant.is_active,
                        }
            except Exception as e:
                logger.warning(f"[Repo] DB error for tenant, using seed: {e}")
        return seed_get_tenant('mood-corporate')


# Singleton instance
repository = CorporateRepository()
