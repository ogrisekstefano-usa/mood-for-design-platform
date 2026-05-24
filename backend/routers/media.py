"""
Media Library API — upload, list, patch metadata, hotspots.
Storage: Supabase. Metadata: cms_assets.
"""
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services import media_library as media
from services import storage as supa_storage
from routers._auth import require_admin_tenant

router = APIRouter(prefix='/media', tags=['media'])


@router.post('/upload')
async def upload(
    file: UploadFile = File(...),
    bucket: str = Form(default=supa_storage.BUCKET_CMS_ASSETS),
    folder_path: str = Form(default='/'),
    alt_text: str = Form(default='{}'),       # JSON string per locale
    caption: str = Form(default='{}'),
    tags: str = Form(default=''),             # comma-separated
    photographer: Optional[str] = Form(default=None),
    copyright_text: Optional[str] = Form(default=None, alias='copyright'),
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    import json
    if bucket not in (supa_storage.BUCKET_CMS_ASSETS, supa_storage.BUCKET_JOURNAL_MEDIA, supa_storage.BUCKET_TENANT_BRANDING):
        raise HTTPException(400, "Invalid bucket")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    if len(raw) > 50 * 1024 * 1024:
        raise HTTPException(413, "File too large (max 50MB)")
    try:
        return await media.upload_asset(
            db, tenant_id=tenant['id'],
            file_bytes=raw, filename=file.filename or 'upload.bin',
            content_type=file.content_type or 'application/octet-stream',
            bucket=bucket, folder_path=folder_path,
            alt_text=json.loads(alt_text or '{}'),
            caption=json.loads(caption or '{}'),
            tags=[t.strip() for t in tags.split(',') if t.strip()],
            photographer=photographer, copyright_=copyright_text,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get('/assets')
async def list_assets(
    folder_path: Optional[str] = Query(default=None),
    tag: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    return await media.list_assets(db, tenant_id=tenant['id'], folder_path=folder_path,
                                    tag=tag, search=search, limit=limit, offset=offset)


class AssetPatch(BaseModel):
    alt_text: Optional[dict] = None
    caption: Optional[dict] = None
    tags: Optional[list[str]] = None
    photographer: Optional[str] = None
    copyright: Optional[str] = None
    focal_point: Optional[dict] = None
    folder_path: Optional[str] = None


@router.patch('/assets/{asset_id}')
async def patch_asset(
    asset_id: str, body: AssetPatch,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    patch = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    try:
        return await media.update_asset(db, tenant_id=tenant['id'], asset_id=asset_id, patch=patch)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.delete('/assets/{asset_id}')
async def delete_asset(
    asset_id: str,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    return await media.soft_delete_asset(db, tenant_id=tenant['id'], asset_id=asset_id)


class HotspotsPayload(BaseModel):
    hotspots: list[dict]


@router.post('/assets/{asset_id}/hotspots')
async def set_hotspots(
    asset_id: str, body: HotspotsPayload,
    tenant=Depends(require_admin_tenant),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await media.set_hotspots(db, tenant_id=tenant['id'], asset_id=asset_id,
                                          hotspots=body.hotspots)
    except ValueError as e:
        raise HTTPException(400, str(e))
