"""
Journal API — public reads + admin writes (CRUD + draft/publish workflow).
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services import journal_service as js
from routers._auth import require_admin_tenant
from tenant_resolver import get_corporate_tenant

router = APIRouter(prefix='/journal', tags=['journal'])


# ── Public reads ─────────────────────────────────────────────────────────────

@router.get('/categories')
async def public_categories(
    locale: str = 'en-us',
    db: AsyncSession = Depends(get_db),
):
    tenant = await get_corporate_tenant()
    return {'items': await js.list_categories(db, tenant_id=tenant['id'], locale=locale)}


@router.get('/tags')
async def public_tags(
    locale: str = 'en-us',
    group: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    tenant = await get_corporate_tenant()
    return {'items': await js.list_tags(db, tenant_id=tenant['id'], locale=locale, tag_group=group)}


@router.get('/articles')
async def public_articles(
    locale: str = 'en-us',
    category: Optional[str] = None,
    tags: Optional[str] = None,    # comma-separated
    search: Optional[str] = None,
    limit: int = Query(default=24, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    tenant = await get_corporate_tenant()
    tag_list = [t.strip() for t in (tags or '').split(',') if t.strip()] or None
    return await js.list_public_articles(
        db, tenant_id=tenant['id'], locale=locale,
        category_slug=category, tag_slugs=tag_list, search=search,
        limit=limit, offset=offset,
    )


@router.get('/articles/{slug}')
async def public_article_detail(
    slug: str, locale: str = 'en-us',
    db: AsyncSession = Depends(get_db),
):
    tenant = await get_corporate_tenant()
    article = await js.get_public_article(db, tenant_id=tenant['id'], slug=slug, locale=locale)
    if not article:
        raise HTTPException(404, f"Article '{slug}' not found")
    return article


# ── Admin: categories/tags ───────────────────────────────────────────────────

class CategoryUpsert(BaseModel):
    slug: str
    locale_meta: dict        # {locale: {name, description?}}
    sort_order: int = 0
    parent_id: Optional[str] = None


@router.post('/admin/categories')
async def admin_upsert_category(
    body: CategoryUpsert,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    return await js.upsert_category(db, tenant_id=tenant['id'], **body.model_dump())


class TagUpsert(BaseModel):
    slug: str
    locale_meta: dict        # {locale: {label}}
    tag_group: Optional[str] = None  # material|style|designer|country|year|other


@router.post('/admin/tags')
async def admin_upsert_tag(
    body: TagUpsert,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    return await js.upsert_tag(db, tenant_id=tenant['id'], **body.model_dump())


# ── Admin: articles CRUD + workflow ──────────────────────────────────────────

class Localization(BaseModel):
    locale_code: str
    slug: str
    title: str
    excerpt: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    canonical_url: Optional[str] = None


class ArticleCreate(BaseModel):
    article_type: str = 'editorial'
    canonical_locale: str = 'en-us'
    localizations: list[Localization]
    hero_asset_id: Optional[str] = None
    author_display_name: Optional[str] = None


@router.post('/admin/articles')
async def admin_create_article(
    body: ArticleCreate,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await js.create_article(
            db, tenant_id=tenant['id'],
            article_type=body.article_type,
            canonical_locale=body.canonical_locale,
            localizations=[l.model_dump() for l in body.localizations],
            hero_asset_id=body.hero_asset_id,
            author_display_name=body.author_display_name,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get('/admin/articles/{article_id}')
async def admin_get_article(
    article_id: str,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    article = await js.get_article(db, tenant_id=tenant['id'], article_id=article_id)
    if not article:
        raise HTTPException(404, "Article not found")
    return article


class DraftAutosave(BaseModel):
    draft_json: dict


@router.patch('/admin/articles/{article_id}/draft')
async def admin_autosave_draft(
    article_id: str, body: DraftAutosave,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    return await js.autosave_draft(db, tenant_id=tenant['id'], article_id=article_id,
                                    draft_json=body.draft_json)


class BlockCreate(BaseModel):
    block_type: str
    sort_order: int = 0
    locale_content: Optional[dict] = None
    settings: Optional[dict] = None
    asset_refs: Optional[list[str]] = None


@router.post('/admin/articles/{article_id}/blocks')
async def admin_add_block(
    article_id: str, body: BlockCreate,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    return await js.add_block(db, tenant_id=tenant['id'], article_id=article_id,
                               **body.model_dump())


class ReorderPayload(BaseModel):
    order: list[str]


@router.post('/admin/articles/{article_id}/blocks/reorder')
async def admin_reorder_blocks(
    article_id: str, body: ReorderPayload,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    return await js.reorder_blocks(db, tenant_id=tenant['id'], article_id=article_id,
                                    order=body.order)


@router.post('/admin/articles/{article_id}/publish')
async def admin_publish(
    article_id: str,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await js.publish_article(db, tenant_id=tenant['id'], article_id=article_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post('/admin/articles/{article_id}/revert')
async def admin_revert(
    article_id: str,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    return await js.revert_article(db, tenant_id=tenant['id'], article_id=article_id)


@router.get('/admin/articles/{article_id}/revisions')
async def admin_revisions(
    article_id: str, limit: int = 50,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    return {'items': await js.get_revisions(db, tenant_id=tenant['id'],
                                             article_id=article_id, limit=limit)}
