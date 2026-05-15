"""
Media Library service — manages cms_assets (the unified asset table).
- Upload (delegates to services/storage.py for Supabase Storage)
- Image metadata extraction (Pillow): width/height, mime, dominant color, palette
- Hotspot CRUD on cms_assets.hotspots JSONB
"""
import io
import logging
import os
import re
import uuid
from typing import Optional
from collections import Counter

from PIL import Image  # already installed
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from services import storage as supa_storage

logger = logging.getLogger(__name__)

ALLOWED_MIMES = {
    'image/jpeg', 'image/png', 'image/webp', 'image/avif',
    'image/gif', 'image/svg+xml',
}


def _slug(name: str) -> str:
    base = re.sub(r'[^a-z0-9.\-]+', '-', name.lower()).strip('-')
    return base or 'file'


def _extract_image_meta(file_bytes: bytes) -> dict:
    """Return {width, height, aspect_ratio, dominant_color (hex), palette[hex]}."""
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img.load()
        w, h = img.size
        aspect = round(w / h, 3) if h else None

        # downscale and quantize to extract palette
        thumb = img.convert('RGB').resize((64, 64))
        quant = thumb.quantize(colors=6)
        palette = quant.getpalette()[:6 * 3]
        counts = Counter(quant.getdata())
        ranked = counts.most_common()
        hex_palette = []
        for idx, _ in ranked:
            r, g, b = palette[idx*3], palette[idx*3+1], palette[idx*3+2]
            hex_palette.append(f"#{r:02X}{g:02X}{b:02X}")
        return {
            'width': w, 'height': h, 'aspect_ratio': aspect,
            'dominant_color': hex_palette[0] if hex_palette else None,
            'palette': hex_palette,
        }
    except Exception as e:
        logger.warning("image meta extraction failed: %s", e)
        return {'width': None, 'height': None, 'aspect_ratio': None,
                'dominant_color': None, 'palette': []}


async def upload_asset(
    db: AsyncSession,
    *,
    tenant_id: str,
    file_bytes: bytes,
    filename: str,
    content_type: str,
    bucket: str = supa_storage.BUCKET_CMS_ASSETS,
    folder_path: str = '/',
    alt_text: Optional[dict] = None,
    tags: Optional[list[str]] = None,
    photographer: Optional[str] = None,
    copyright_: Optional[str] = None,
    caption: Optional[dict] = None,
    uploaded_by: Optional[str] = None,
) -> dict:
    if content_type not in ALLOWED_MIMES and not content_type.startswith('video/'):
        raise ValueError(f"Unsupported MIME type: {content_type}")

    # build storage path: tenant/{folder}/{uuid}-{slug}
    folder = (folder_path or '/').strip('/')
    safe_name = _slug(filename)
    rand = uuid.uuid4().hex[:8]
    path_parts = [tenant_id]
    if folder:
        path_parts.append(folder)
    path_parts.append(f"{rand}-{safe_name}")
    storage_path = '/'.join(path_parts)

    public = await supa_storage.upload_file(
        bucket=bucket,
        storage_path=storage_path,
        file_bytes=file_bytes,
        content_type=content_type,
    )

    meta = _extract_image_meta(file_bytes) if content_type.startswith('image/') and content_type != 'image/svg+xml' else {
        'width': None, 'height': None, 'aspect_ratio': None,
        'dominant_color': None, 'palette': [],
    }

    asset_id = str(uuid.uuid4())
    row = (await db.execute(
        text("""
            INSERT INTO cms_assets (
              id, tenant_id, source, storage_bucket, storage_path, public_url,
              alt_text, caption, focal_point, dimensions, tags, used_in,
              photographer, copyright, mime_type, file_size_bytes,
              aspect_ratio, dominant_color, palette, hotspots,
              folder_path, uploaded_by, created_by, updated_by,
              created_at, updated_at
            ) VALUES (
              CAST(:id AS uuid), CAST(:tid AS uuid), 'upload', :bk, :sp, :url,
              CAST(:alt AS jsonb), CAST(:cap AS jsonb),
              CAST(:fpt AS jsonb),
              CAST(:dim AS jsonb), CAST(:tags AS text[]), '{}'::jsonb,
              :photog, :cr, :mime, :size,
              :ar, :dc, CAST(:pal AS jsonb), '[]'::jsonb,
              :fp, CAST(:uid AS uuid), CAST(:uid AS uuid), CAST(:uid AS uuid),
              NOW(), NOW()
            )
            RETURNING id, public_url, dimensions, dominant_color, palette
        """),
        {
            'id': asset_id, 'tid': tenant_id, 'bk': bucket,
            'sp': storage_path, 'url': public,
            'alt': _json(alt_text or {}), 'cap': _json(caption or {}),
            'fpt': _json({'x': 0.5, 'y': 0.5}),
            'dim': _json({'width': meta['width'], 'height': meta['height']}),
            'tags': tags or [],
            'photog': photographer, 'cr': copyright_,
            'mime': content_type, 'size': len(file_bytes),
            'ar': meta['aspect_ratio'], 'dc': meta['dominant_color'],
            'pal': _json(meta['palette']),
            'fp': folder_path or '/',
            'uid': uploaded_by,
        },
    )).first()
    await db.commit()
    return {
        'id': asset_id, 'public_url': public,
        'storage_bucket': bucket, 'storage_path': storage_path,
        'mime_type': content_type, 'width': meta['width'], 'height': meta['height'],
        'aspect_ratio': meta['aspect_ratio'], 'dominant_color': meta['dominant_color'],
        'palette': meta['palette'], 'tags': tags or [],
    }


async def list_assets(
    db: AsyncSession, *, tenant_id: str,
    folder_path: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50, offset: int = 0,
) -> dict:
    where = ["tenant_id = :tid", "deleted_at IS NULL"]
    params = {'tid': tenant_id, 'lim': limit, 'off': offset}
    if folder_path:
        where.append("folder_path = :fp")
        params['fp'] = folder_path
    if tag:
        where.append(":tag = ANY(tags)")
        params['tag'] = tag
    if search:
        where.append("(alt_text::text ILIKE :q OR caption::text ILIKE :q OR storage_path ILIKE :q)")
        params['q'] = f"%{search}%"
    sql = f"""
        SELECT id::text, public_url, alt_text, caption, dimensions, tags,
               aspect_ratio, dominant_color, mime_type, folder_path, hotspots, created_at
        FROM cms_assets
        WHERE {' AND '.join(where)}
        ORDER BY created_at DESC
        LIMIT :lim OFFSET :off
    """
    rows = (await db.execute(text(sql), params)).mappings().all()
    count_sql = f"SELECT COUNT(*) FROM cms_assets WHERE {' AND '.join(where)}"
    count_params = {k: v for k, v in params.items() if k not in ('lim', 'off')}
    total = (await db.execute(text(count_sql), count_params)).scalar()
    return {'items': [dict(r) for r in rows], 'total': total, 'limit': limit, 'offset': offset}


async def update_asset(db: AsyncSession, *, tenant_id: str, asset_id: str, patch: dict) -> dict:
    """Patch metadata: alt_text, caption, tags, photographer, copyright, focal_point, folder_path."""
    allowed = {'alt_text', 'caption', 'tags', 'photographer', 'copyright',
               'focal_point', 'folder_path'}
    fields = {k: v for k, v in patch.items() if k in allowed}
    if not fields:
        raise ValueError("No updatable fields provided")

    sets = []
    params = {'tid': tenant_id, 'aid': asset_id}
    for k, v in fields.items():
        if k in ('alt_text', 'caption', 'focal_point'):
            sets.append(f"{k} = CAST(:p_{k} AS jsonb)")
            params[f"p_{k}"] = _json(v or {})
        elif k == 'tags':
            sets.append("tags = CAST(:p_tags AS text[])")
            params['p_tags'] = v or []
        else:
            sets.append(f"{k} = :p_{k}")
            params[f"p_{k}"] = v
    sets.append("updated_at = NOW()")
    await db.execute(
        text(f"""
            UPDATE cms_assets
            SET {', '.join(sets)}
            WHERE id = CAST(:aid AS uuid) AND tenant_id = CAST(:tid AS uuid) AND deleted_at IS NULL
        """),
        params,
    )
    await db.commit()
    return {'ok': True, 'patched': list(fields.keys())}


async def soft_delete_asset(db: AsyncSession, *, tenant_id: str, asset_id: str) -> dict:
    await db.execute(
        text("""
            UPDATE cms_assets SET deleted_at = NOW()
            WHERE id = CAST(:aid AS uuid) AND tenant_id = CAST(:tid AS uuid)
        """),
        {'aid': asset_id, 'tid': tenant_id},
    )
    await db.commit()
    return {'ok': True}


# ── Hotspots ──────────────────────────────────────────────────────────────────

async def set_hotspots(db: AsyncSession, *, tenant_id: str, asset_id: str, hotspots: list[dict]) -> dict:
    """Replace all hotspots on an asset. Each hotspot: {x, y, label{}, tooltip{}, url, open_blank}."""
    # validate
    for h in hotspots:
        if not (0 <= float(h.get('x', -1)) <= 100):
            raise ValueError("x must be 0..100")
        if not (0 <= float(h.get('y', -1)) <= 100):
            raise ValueError("y must be 0..100")
    await db.execute(
        text("""
            UPDATE cms_assets SET hotspots = CAST(:hs AS jsonb), updated_at = NOW()
            WHERE id = CAST(:aid AS uuid) AND tenant_id = CAST(:tid AS uuid)
        """),
        {'aid': asset_id, 'tid': tenant_id, 'hs': _json(hotspots)},
    )
    await db.commit()
    return {'ok': True, 'count': len(hotspots)}


def _json(value) -> str:
    import json as _j
    return _j.dumps(value if value is not None else {})
