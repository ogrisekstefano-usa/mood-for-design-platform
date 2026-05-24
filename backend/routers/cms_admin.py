"""CMS admin API — page autosave/publish/revert + section CRUD/reorder."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services import cms_writer as cms
from routers._auth import require_admin_tenant
from cache import content_cache

router = APIRouter(prefix='/cms', tags=['cms-admin'])


@router.get('/pages')
async def list_pages(
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    return {'items': await cms.list_pages(db, tenant_id=tenant['id'])}


@router.get('/pages/{page_id}')
async def get_page(
    page_id: str,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    page = await cms.get_page(db, tenant_id=tenant['id'], page_id=page_id)
    if not page:
        raise HTTPException(404, "Page not found")
    return page


class PageDraftBody(BaseModel):
    draft_json: dict


@router.patch('/pages/{page_id}/draft')
async def autosave_page(
    page_id: str, body: PageDraftBody,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    return await cms.autosave_page_draft(db, tenant_id=tenant['id'],
                                          page_id=page_id, draft_json=body.draft_json)


@router.post('/pages/{page_id}/publish')
async def publish_page(
    page_id: str,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await cms.publish_page(db, tenant_id=tenant['id'], page_id=page_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    else:
        # invalidate read caches
        content_cache.clear_prefix(f'page:{tenant["id"]}')
        content_cache.clear_prefix(f'pages_list:{tenant["id"]}')
        content_cache.clear_prefix(f'nav:{tenant["id"]}')
        return result


@router.post('/pages/{page_id}/revert')
async def revert_page(
    page_id: str,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    return await cms.revert_page(db, tenant_id=tenant['id'], page_id=page_id)


# ── Sections ──────────────────────────────────────────────────────────────────

class SectionPatch(BaseModel):
    locale_content: Optional[dict] = None
    settings: Optional[dict] = None
    asset_refs: Optional[list[str]] = None
    visible: Optional[bool] = None
    section_type: Optional[str] = None
    sort_order: Optional[int] = None


@router.patch('/sections/{section_id}')
async def patch_section(
    section_id: str, body: SectionPatch,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    patch = body.model_dump(exclude_none=True)
    try:
        result = await cms.patch_section(db, tenant_id=tenant['id'],
                                          section_id=section_id, patch=patch)
    except ValueError as e:
        raise HTTPException(400, str(e))
    else:
        content_cache.clear_prefix(f'page:{tenant["id"]}')
        return result


class SectionCreate(BaseModel):
    page_id: str
    section_type: str
    sort_order: Optional[int] = None
    locale_content: Optional[dict] = None
    settings: Optional[dict] = None
    asset_refs: Optional[list[str]] = None


@router.post('/sections')
async def add_section(
    body: SectionCreate,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await cms.add_section(db, tenant_id=tenant['id'], **body.model_dump())
    content_cache.clear_prefix(f'page:{tenant["id"]}')
    return result


class ReorderBody(BaseModel):
    page_id: str
    order: list[str]


@router.post('/sections/reorder')
async def reorder_sections(
    body: ReorderBody,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await cms.reorder_sections(db, tenant_id=tenant['id'],
                                          page_id=body.page_id, order=body.order)
    content_cache.clear_prefix(f'page:{tenant["id"]}')
    return result


@router.delete('/sections/{section_id}')
async def delete_section(
    section_id: str,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await cms.soft_delete_section(db, tenant_id=tenant['id'], section_id=section_id)
    content_cache.clear_prefix(f'page:{tenant["id"]}')
    return result


@router.get('/revisions/{entity_type}/{entity_id}')
async def revisions(
    entity_type: str, entity_id: str, limit: int = 50,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    if entity_type not in ('cms_page', 'cms_section', 'journal_article'):
        raise HTTPException(400, "Unsupported entity_type")
    return {'items': await cms.get_revisions(db, tenant_id=tenant['id'],
                                              entity_type=entity_type,
                                              entity_id=entity_id, limit=limit)}
