"""
Tenant resolver — resolves the active tenant from request Host header.
Lookup order:
  1. Match `tenant_domains.domain` exactly (custom or platform_subdomain)
  2. Fallback to `mood-corporate` tenant for preview/local hosts
Cached for 60s.
"""
import os
from fastapi import Request, HTTPException
from sqlalchemy import select
from database import AsyncSessionLocal
from models import Tenant, TenantDomain
from cache import content_cache

CORPORATE_TENANT_SLUG = os.environ.get('CORPORATE_TENANT_SLUG', 'mood-corporate')


async def _load_by_domain(host: str) -> dict | None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Tenant)
            .join(TenantDomain, TenantDomain.tenant_id == Tenant.id)
            .where(TenantDomain.domain == host)
            .where(Tenant.status == 'active')
        )
        t = result.scalar_one_or_none()
        if not t:
            return None
        return _serialize_tenant(t)


async def _load_by_slug(slug: str) -> dict | None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Tenant).where(Tenant.slug == slug)
        )
        t = result.scalar_one_or_none()
        if not t:
            return None
        return _serialize_tenant(t)


def _serialize_tenant(t: Tenant) -> dict:
    return {
        'id': str(t.id),
        'slug': t.slug,
        'name': t.name,
        'status': t.status,
        'active_plan': t.active_plan,
        'enabled_modules': t.enabled_modules or [],
        'theme': {
            'logo_url': t.logo_url,
            'primary_color': t.primary_color,
            'secondary_color': t.secondary_color,
            'font_heading': t.font_heading,
            'font_body': t.font_body,
        },
        'default_language': t.default_language,
        'active_languages': t.active_languages or [],
    }


async def resolve_tenant_by_host(host: str | None) -> dict:
    """Resolve tenant by Host header. Always returns a tenant (fallback to corporate)."""
    if host:
        # strip port
        clean = host.split(':')[0].lower()
        cache_key = f'tenant:host:{clean}'
        cached = await content_cache.get_or_set(
            cache_key,
            lambda: _load_by_domain(clean),
            ttl=120,
        )
        if cached:
            return cached

    # fallback
    fallback_key = f'tenant:slug:{CORPORATE_TENANT_SLUG}'
    cached = await content_cache.get_or_set(
        fallback_key,
        lambda: _load_by_slug(CORPORATE_TENANT_SLUG),
        ttl=300,
    )
    if not cached:
        raise HTTPException(
            status_code=503,
            detail=f"Corporate tenant '{CORPORATE_TENANT_SLUG}' not provisioned in database.",
        )
    return cached


async def get_corporate_tenant() -> dict:
    """Always returns the mood-corporate tenant (used by /api/corporate/* routes)."""
    return await resolve_tenant_by_host(None)
