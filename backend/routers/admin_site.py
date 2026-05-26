"""
Admin Site Governance API (ITER149)
Endpoints consumed by Blueprint Command Center UI to edit ALL public website
content — editorial_blocks, cms_sections, media references — with publish
workflow and locale completeness.
"""
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body, File, UploadFile, Form
from sqlalchemy import text
from datetime import datetime, timezone

from database import AsyncSessionLocal
from routers._auth import require_admin_tenant
from services import site_resolver
from services import storage as supa_storage

router = APIRouter(prefix="/admin/site", tags=["admin-site"])


# ─────────────────────────────────────────────────────────────────────────
#  EDITORIAL BLOCKS  (text / labels / CTA copy / SEO)
# ─────────────────────────────────────────────────────────────────────────

@router.get("/blocks")
async def list_blocks(
    namespace: str | None = Query(default=None, description="Filter by namespace, supports 'site.%' prefix-like with trailing %"),
    locale: str | None = Query(default=None, description="Include translation value for this locale"),
    limit: int = Query(default=200, le=500),
    tenant: dict = Depends(require_admin_tenant),
):
    async with AsyncSessionLocal() as session:
        if namespace and namespace.endswith('%'):
            ns_clause = "AND b.namespace LIKE :ns"
            ns_param  = namespace
        elif namespace:
            ns_clause = "AND b.namespace = :ns"
            ns_param  = namespace
        else:
            ns_clause = ""
            ns_param  = None

        params = {"tid": tenant['id'], "lim": limit}
        if ns_param is not None:
            params["ns"] = ns_param

        rows = (await session.execute(
            text(f"""
                SELECT b.id, b.namespace, b.block_key, b.block_type,
                       b.source_locale, b.source_value, b.is_active, b.notes,
                       b.updated_at,
                       COALESCE(
                         (SELECT json_agg(json_build_object(
                            'locale', t.locale, 'value', t.value, 'status', t.status,
                            'locked', t.locked, 'updated_at', t.updated_at))
                          FROM editorial_block_translations t WHERE t.block_id = b.id),
                         '[]'::json
                       ) AS translations
                FROM editorial_blocks b
                WHERE b.tenant_id = :tid
                  {ns_clause}
                ORDER BY b.namespace, b.block_key
                LIMIT :lim
            """),
            params,
        )).mappings().all()

        out = []
        for r in rows:
            item = dict(r)
            item['id'] = str(item['id'])
            item['updated_at'] = item['updated_at'].isoformat() if item['updated_at'] else None
            for t in item['translations']:
                if t.get('updated_at'):
                    t['updated_at'] = t['updated_at']  # already iso from json_build_object
            out.append(item)
        return {"blocks": out, "count": len(out)}


@router.get("/blocks/by-key")
async def get_block_by_key(
    namespace: str = Query(...),
    block_key: str = Query(...),
    tenant: dict = Depends(require_admin_tenant),
):
    async with AsyncSessionLocal() as session:
        row = (await session.execute(
            text("""
                SELECT b.id, b.namespace, b.block_key, b.block_type, b.source_locale, b.source_value,
                       b.is_active, b.notes,
                       COALESCE((SELECT json_agg(json_build_object(
                         'locale', t.locale, 'value', t.value, 'status', t.status, 'locked', t.locked))
                         FROM editorial_block_translations t WHERE t.block_id = b.id), '[]'::json) AS translations
                FROM editorial_blocks b
                WHERE b.tenant_id = :tid AND b.namespace = :ns AND b.block_key = :bk
            """),
            {"tid": tenant['id'], "ns": namespace, "bk": block_key},
        )).mappings().first()
        if not row:
            raise HTTPException(404, "Block not found")
        item = dict(row)
        item['id'] = str(item['id'])
        return item


def _validate_block_payload(body: dict) -> None:
    """Raise HTTPException if required block fields are missing."""
    required = ['namespace', 'block_key', 'block_type', 'source_locale', 'source_value']
    for k in required:
        if k not in body or body[k] is None:
            raise HTTPException(400, f"Missing field: {k}")


async def _upsert_editorial_block_row(session, *, tenant_id: str, body: dict,
                                       source_hash: str):
    """Upsert the editorial_blocks row. Returns the block id."""
    row = (await session.execute(
        text("""
            INSERT INTO editorial_blocks
              (id, scope, tenant_id, namespace, block_key, block_type,
               source_locale, source_value, source_hash, is_active, notes, created_at, updated_at)
            VALUES
              (gen_random_uuid(), 'tenant', :tid, :ns, :bk, :bt,
               :sl, :sv, :sh, COALESCE(:active, true), :notes, NOW(), NOW())
            ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE SET
              block_type    = EXCLUDED.block_type,
              source_locale = EXCLUDED.source_locale,
              source_value  = EXCLUDED.source_value,
              source_hash   = EXCLUDED.source_hash,
              is_active     = EXCLUDED.is_active,
              notes         = EXCLUDED.notes,
              updated_at    = NOW()
            RETURNING id
        """),
        {
            "tid": tenant_id,
            "ns": body['namespace'], "bk": body['block_key'], "bt": body['block_type'],
            "sl": body['source_locale'], "sv": body['source_value'], "sh": source_hash,
            "active": body.get('is_active', True), "notes": body.get('notes'),
        },
    )).first()
    return row[0]


async def _upsert_block_translations(session, *, block_id, translations: list[dict],
                                      source_hash: str) -> None:
    """Upsert per-locale translations for a block."""
    for tr in translations:
        if not tr.get('locale') or tr.get('value') is None:
            continue
        await session.execute(
            text("""
                INSERT INTO editorial_block_translations
                  (id, block_id, locale, value, status, generated_by, source_hash, locked, created_at, updated_at)
                VALUES
                  (gen_random_uuid(), :bid, :loc, :val, COALESCE(:status,'manual'),
                   'admin', :sh, COALESCE(:locked, false), NOW(), NOW())
                ON CONFLICT (block_id, locale) DO UPDATE SET
                  value       = EXCLUDED.value,
                  status      = EXCLUDED.status,
                  source_hash = EXCLUDED.source_hash,
                  locked      = EXCLUDED.locked,
                  updated_at  = NOW()
            """),
            {"bid": block_id, "loc": tr['locale'], "val": tr['value'],
             "sh": source_hash,
             "status": tr.get('status'), "locked": tr.get('locked', False)},
        )


@router.put("/blocks")
async def upsert_block(
    body: dict = Body(...),
    tenant: dict = Depends(require_admin_tenant),
):
    """
    Upsert an editorial_block + per-locale translations.
    Body: {
      namespace, block_key, block_type, source_locale, source_value, is_active?, notes?,
      translations: [{locale, value, status?, locked?}, ...]
    }
    """
    _validate_block_payload(body)
    import hashlib
    # SHA-256 used as non-cryptographic content checksum (translation invalidation), not for security.
    source_hash = hashlib.sha256(body['source_value'].encode('utf-8')).hexdigest()
    async with AsyncSessionLocal() as session:
        block_id = await _upsert_editorial_block_row(
            session, tenant_id=tenant['id'], body=body, source_hash=source_hash,
        )
        await _upsert_block_translations(
            session, block_id=block_id,
            translations=body.get('translations') or [],
            source_hash=source_hash,
        )
        await session.commit()
        site_resolver.invalidate_site_cache()
        return {"id": str(block_id), "ok": True}


# ─────────────────────────────────────────────────────────────────────────
#  CMS SECTIONS  (homepage layout/skeleton)
# ─────────────────────────────────────────────────────────────────────────

@router.get("/sections")
async def list_sections(
    page_slug: str = Query(default="home"),
    tenant: dict = Depends(require_admin_tenant),
):
    async with AsyncSessionLocal() as session:
        page = (await session.execute(
            text("SELECT id, page_key, status FROM cms_pages WHERE tenant_id=:tid AND page_key=:slug"),
            {"tid": tenant['id'], "slug": page_slug},
        )).mappings().first()
        if not page:
            raise HTTPException(404, f"Page '{page_slug}' not found")

        rows = (await session.execute(
            text("""
                SELECT id, section_type, sort_order, visible, settings, updated_at
                FROM cms_sections
                WHERE page_id = :pid AND COALESCE(deleted_at IS NULL, true)
                ORDER BY sort_order
            """),
            {"pid": page['id']},
        )).mappings().all()

        return {
            "page": {"id": str(page['id']), "slug": page['page_key'], "status": page['status']},
            "sections": [
                {**dict(r), "id": str(r['id']),
                 "updated_at": r['updated_at'].isoformat() if r['updated_at'] else None}
                for r in rows
            ],
        }


@router.patch("/sections/{section_id}")
async def patch_section(
    section_id: str,
    body: dict = Body(...),
    tenant: dict = Depends(require_admin_tenant),
):
    """Patch visible/sort_order/settings."""
    sets, params = [], {"sid": section_id, "tid": tenant['id']}
    if 'visible' in body:
        sets.append("visible = :v")
        params['v'] = bool(body['visible'])
    if 'sort_order' in body:
        sets.append("sort_order = :so")
        params['so'] = int(body['sort_order'])
    if 'settings' in body:
        sets.append("settings = :s::jsonb")
        import json as _json
        params['s'] = _json.dumps(body['settings'])
    if not sets:
        raise HTTPException(400, "Nothing to patch")
    sets.append("updated_at = NOW()")
    async with AsyncSessionLocal() as session:
        r = await session.execute(
            text(f"""UPDATE cms_sections SET {', '.join(sets)}
                     WHERE id=:sid AND tenant_id=:tid RETURNING id"""),
            params,
        )
        if r.first() is None:
            raise HTTPException(404, "Section not found")
        await session.commit()
        site_resolver.invalidate_site_cache()
        return {"ok": True}


@router.post("/sections/reorder")
async def reorder_sections(
    body: dict = Body(...),
    tenant: dict = Depends(require_admin_tenant),
):
    """Body: { ordered_ids: [section_id_in_new_order, ...] }"""
    ordered = body.get('ordered_ids') or []
    if not isinstance(ordered, list) or not ordered:
        raise HTTPException(400, "ordered_ids must be a non-empty list")
    async with AsyncSessionLocal() as session:
        for idx, sid in enumerate(ordered):
            await session.execute(
                text("UPDATE cms_sections SET sort_order=:o, updated_at=NOW() WHERE id=:sid AND tenant_id=:tid"),
                {"o": idx, "sid": sid, "tid": tenant['id']},
            )
        await session.commit()
        site_resolver.invalidate_site_cache()
        return {"ok": True, "count": len(ordered)}


@router.get("/pages")
async def list_admin_pages(
    tenant: dict = Depends(require_admin_tenant),
):
    """List all CMS pages for the page-editor sidebar."""
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(
            text("""
                SELECT id, page_key, title, status, updated_at
                FROM cms_pages
                WHERE tenant_id = :tid AND COALESCE(deleted_at IS NULL, true)
                ORDER BY
                  CASE page_key
                    WHEN 'home' THEN 0
                    WHEN 'audience' THEN 1
                    WHEN 'features' THEN 2
                    WHEN 'pricing' THEN 3
                    WHEN 'training' THEN 4
                    WHEN 'support' THEN 5
                    WHEN 'login' THEN 6
                    ELSE 99
                  END,
                  page_key
            """),
            {"tid": tenant['id']},
        )).mappings().all()
        return {"pages": [
            {"id": str(r['id']), "key": r['page_key'], "title": r['title'],
             "status": r['status'],
             "updated_at": r['updated_at'].isoformat() if r['updated_at'] else None}
            for r in rows
        ]}


# ─────────────────────────────────────────────────────────────────────────
#  PAGE CONTENT EDITOR  (ITER151 — unified text + media editing per page)
# ─────────────────────────────────────────────────────────────────────────

@router.get("/page-content/{page_key}")
async def get_page_content(
    page_key: str,
    tenant: dict = Depends(require_admin_tenant),
):
    """
    Returns full editable content for a page in ONE call:
    - sections (with type, sort_order, visible)
    - text blocks (auto-discovered from section.settings.blocks, with translations)
    - media slots (auto-discovered from section.settings.media, with media metadata)
    """
    async with AsyncSessionLocal() as session:
        page = (await session.execute(
            text("SELECT id, page_key, title, status FROM cms_pages WHERE tenant_id=:tid AND page_key=:slug"),
            {"tid": tenant['id'], "slug": page_key},
        )).mappings().first()
        if not page:
            raise HTTPException(404, f"Page '{page_key}' not found")

        sec_rows = (await session.execute(
            text("""
                SELECT id, section_type, sort_order, visible, settings
                FROM cms_sections
                WHERE page_id=:pid AND COALESCE(deleted_at IS NULL, true)
                ORDER BY sort_order
            """),
            {"pid": page['id']},
        )).mappings().all()

        # Auto-discover all block keys and media UUIDs referenced
        all_block_keys: set[str] = set()
        all_media_ids: set[str] = set()
        section_data = []
        for s in sec_rows:
            settings = s['settings'] or {}
            blocks_map = settings.get('blocks') or {}
            media_map  = settings.get('media')  or {}
            for k in blocks_map.values():
                if isinstance(k, str):
                    all_block_keys.add(k)
            for mid in media_map.values():
                if isinstance(mid, str):
                    all_media_ids.add(mid)
            section_data.append({
                "id":          str(s['id']),
                "section_type": s['section_type'],
                "sort_order":  s['sort_order'],
                "visible":     s['visible'],
                "blocks_map":  blocks_map,
                "media_map":   media_map,
                "settings":    settings,
            })

        # Bulk fetch blocks + translations
        blocks_by_key: dict[str, dict] = {}
        if all_block_keys:
            # Split each full_key 'site.home.hero.title' → namespace + block_key
            # using same convention as resolver: ns = first 2 parts, key = rest
            block_lookups: list[tuple[str, str, str]] = []
            for fk in all_block_keys:
                parts = fk.split('.')
                if len(parts) < 3:
                    continue
                ns = '.'.join(parts[:2])
                bk = '.'.join(parts[2:])
                block_lookups.append((fk, ns, bk))

            # Build a UNION of (ns, key) pairs in one query
            namespaces = tuple({n for _, n, _ in block_lookups})
            keys       = tuple({k for _, _, k in block_lookups})
            rows = (await session.execute(
                text("""
                    SELECT b.id, b.namespace, b.block_key, b.block_type, b.source_locale, b.source_value,
                           COALESCE(
                             (SELECT json_agg(json_build_object('locale', t.locale, 'value', t.value))
                              FROM editorial_block_translations t WHERE t.block_id = b.id),
                             '[]'::json
                           ) AS translations
                    FROM editorial_blocks b
                    WHERE b.tenant_id = :tid
                      AND b.namespace = ANY(:nss)
                      AND b.block_key = ANY(:bks)
                """),
                {"tid": tenant['id'], "nss": list(namespaces), "bks": list(keys)},
            )).mappings().all()
            indexed = {(r['namespace'], r['block_key']): r for r in rows}
            for full_key, ns, bk in block_lookups:
                row = indexed.get((ns, bk))
                if not row:
                    blocks_by_key[full_key] = {
                        "full_key": full_key, "id": None, "block_type": "text",
                        "source_locale": None, "source_value": "", "translations": {},
                    }
                    continue
                trs = {t['locale']: t['value'] for t in (row['translations'] or [])}
                blocks_by_key[full_key] = {
                    "full_key":      full_key,
                    "id":            str(row['id']),
                    "block_type":    row['block_type'],
                    "source_locale": row['source_locale'],
                    "source_value":  row['source_value'],
                    "translations":  trs,
                }

        # Bulk fetch media
        media_by_id: dict[str, dict] = {}
        if all_media_ids:
            mrows = (await session.execute(
                text("""
                    SELECT id, file_url, alt_text, category, mime_type,
                           width, height, dominant_color, file_name
                    FROM media_library
                    WHERE id = ANY(CAST(:ids AS uuid[])) AND archived_at IS NULL
                """),
                {"ids": list(all_media_ids)},
            )).mappings().all()
            for m in mrows:
                media_by_id[str(m['id'])] = {
                    **dict(m), "id": str(m['id']),
                }

        # Assemble final response: each section gets its resolved blocks + media
        sections_out = []
        for sd in section_data:
            blocks_out = []
            for slot, full_key in sd['blocks_map'].items():
                if not isinstance(full_key, str):
                    continue
                b = blocks_by_key.get(full_key)
                if b:
                    blocks_out.append({"slot": slot, **b})
            media_out = []
            for slot, media_id in sd['media_map'].items():
                if not isinstance(media_id, str):
                    continue
                m = media_by_id.get(media_id)
                media_out.append({
                    "slot":      slot,
                    "media_id":  media_id,
                    "media":     m,  # None if archived/missing
                })
            sections_out.append({
                "id":          sd['id'],
                "section_type": sd['section_type'],
                "sort_order":  sd['sort_order'],
                "visible":     sd['visible'],
                "blocks":      blocks_out,
                "media":       media_out,
                "settings":    sd['settings'],
            })

        return {
            "page": {"id": str(page['id']), "key": page['page_key'],
                     "title": page['title'], "status": page['status']},
            "sections": sections_out,
        }


# ─────────────────────────────────────────────────────────────────────────
#  PAGE SEO META  (per-locale title / description / og_image)
# ─────────────────────────────────────────────────────────────────────────

@router.get("/pages/{page_key}/seo")
async def get_page_seo(
    page_key: str,
    tenant: dict = Depends(require_admin_tenant),
):
    """Return cms_pages.locale_meta (per-locale SEO) + resolved og_image URLs."""
    async with AsyncSessionLocal() as session:
        page = (await session.execute(
            text("SELECT id, locale_meta FROM cms_pages WHERE tenant_id=:tid AND page_key=:slug"),
            {"tid": tenant['id'], "slug": page_key},
        )).mappings().first()
        if not page:
            raise HTTPException(404, "page not found")
        locale_meta = dict(page['locale_meta'] or {})

        # Resolve og_image UUIDs → public URLs
        all_ids = {v.get('og_image') for v in locale_meta.values() if isinstance(v, dict) and v.get('og_image')}
        media_map: dict[str, str] = {}
        if all_ids:
            rows = (await session.execute(
                text("""SELECT id, file_url FROM media_library
                        WHERE id = ANY(CAST(:ids AS uuid[]))
                          AND tenant_id = :tid AND archived_at IS NULL"""),
                {"ids": list(all_ids), "tid": tenant['id']},
            )).mappings().all()
            media_map = {str(r['id']): r['file_url'] for r in rows}

        for loc, meta in locale_meta.items():
            if isinstance(meta, dict) and meta.get('og_image'):
                meta['og_image_url'] = media_map.get(meta['og_image'])

        return {"page_key": page_key, "locale_meta": locale_meta}


@router.put("/pages/{page_key}/seo")
async def update_page_seo(
    page_key: str,
    body: dict = Body(...),
    tenant: dict = Depends(require_admin_tenant),
):
    """
    Update SEO meta for a specific locale.
    Body: { locale: "it", title: "...", description: "...", og_image: "<media uuid>" | null }
    """
    import json as _json
    locale = (body.get('locale') or '').strip().lower()
    if not locale:
        raise HTTPException(400, "locale is required")
    title       = (body.get('title') or '').strip()
    description = (body.get('description') or '').strip()
    og_image    = body.get('og_image')
    if og_image and not isinstance(og_image, str):
        raise HTTPException(400, "og_image must be a media UUID string or null")

    new_meta = {"title": title, "description": description}
    if og_image:
        new_meta["og_image"] = og_image

    async with AsyncSessionLocal() as session:
        page = (await session.execute(
            text("SELECT id, locale_meta FROM cms_pages WHERE tenant_id=:tid AND page_key=:slug"),
            {"tid": tenant['id'], "slug": page_key},
        )).mappings().first()
        if not page:
            raise HTTPException(404, "page not found")
        locale_meta = dict(page['locale_meta'] or {})
        locale_meta[locale] = new_meta
        await session.execute(
            text("UPDATE cms_pages SET locale_meta = CAST(:m AS jsonb), updated_at = NOW() WHERE id = CAST(:pid AS uuid)"),
            {"m": _json.dumps(locale_meta), "pid": str(page['id'])},
        )
        await session.commit()
    # Invalidate cache
    site_resolver.invalidate_site_cache()
    return {"page_key": page_key, "locale": locale, "meta": new_meta}


@router.put("/sections/{section_id}/media-slot")
async def update_section_media_slot(
    section_id: str,
    body: dict = Body(...),
    tenant: dict = Depends(require_admin_tenant),
):
    """
    Update or remove a single media slot inside cms_sections.settings.media.
    Body: { slot: "image", media_id: "<uuid>" | null }
    """
    slot     = (body.get('slot') or '').strip()
    media_id = body.get('media_id')
    if not slot:
        raise HTTPException(400, "slot is required")
    if media_id is not None and not isinstance(media_id, str):
        raise HTTPException(400, "media_id must be string or null")

    async with AsyncSessionLocal() as session:
        # Validate media exists (if assigning)
        if media_id:
            mrow = (await session.execute(
                text("SELECT id FROM media_library WHERE id = CAST(:mid AS uuid) AND tenant_id = :tid AND archived_at IS NULL"),
                {"mid": media_id, "tid": tenant['id']},
            )).first()
            if mrow is None:
                raise HTTPException(404, "media not found")
        # Patch settings.media[slot]
        import json as _json
        row = (await session.execute(
            text("""SELECT settings FROM cms_sections WHERE id = CAST(:sid AS uuid) AND tenant_id = :tid"""),
            {"sid": section_id, "tid": tenant['id']},
        )).mappings().first()
        if not row:
            raise HTTPException(404, "section not found")
        settings = dict(row['settings'] or {})
        media_map = dict(settings.get('media') or {})
        if media_id is None:
            media_map.pop(slot, None)
        else:
            media_map[slot] = media_id
        settings['media'] = media_map
        await session.execute(
            text("UPDATE cms_sections SET settings = CAST(:s AS jsonb), updated_at = NOW() WHERE id = CAST(:sid AS uuid)"),
            {"sid": section_id, "s": _json.dumps(settings)},
        )
        await session.commit()
        site_resolver.invalidate_site_cache()
        return {"ok": True, "slot": slot, "media_id": media_id}


@router.get("/media-usages")
async def get_media_usages(
    tenant: dict = Depends(require_admin_tenant),
):
    """
    Returns a map of {media_id: [{page_key, section_type, slot}, ...]}
    so the MediaPicker can display "used in Home Hero" etc.
    """
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(
            text("""
                SELECT s.id AS section_id, s.section_type, s.settings, p.page_key
                FROM cms_sections s
                JOIN cms_pages p ON p.id = s.page_id
                WHERE p.tenant_id = :tid AND COALESCE(s.deleted_at IS NULL, true)
            """),
            {"tid": tenant['id']},
        )).mappings().all()

        usages: dict[str, list[dict]] = {}
        for r in rows:
            settings = r['settings'] or {}
            media_map = settings.get('media') or {}
            if not isinstance(media_map, dict):
                continue
            for slot, mid in media_map.items():
                if not isinstance(mid, str):
                    continue
                usages.setdefault(mid, []).append({
                    "page_key":     r['page_key'],
                    "section_type": r['section_type'],
                    "slot":         slot,
                })
        return {"usages": usages}


# ─────────────────────────────────────────────────────────────────────────
#  MEDIA LIBRARY  (list / patch / browse) — uploads still go via /api/media
# ─────────────────────────────────────────────────────────────────────────

@router.get("/media")
async def list_media(
    category: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    tenant: dict = Depends(require_admin_tenant),
):
    async with AsyncSessionLocal() as session:
        params = {"tid": tenant['id'], "lim": limit}
        cat_clause = ""
        if category:
            cat_clause = "AND category = :cat"
            params['cat'] = category
        rows = (await session.execute(
            text(f"""
                SELECT id, file_url, alt_text, category, tags, width, height,
                       mime_type, focal_point, dominant_color, description,
                       file_name, created_at
                FROM media_library
                WHERE tenant_id = :tid AND archived_at IS NULL
                  {cat_clause}
                ORDER BY created_at DESC
                LIMIT :lim
            """),
            params,
        )).mappings().all()
        return {
            "media": [
                {**dict(r),
                 "id": str(r['id']),
                 "created_at": r['created_at'].isoformat() if r['created_at'] else None}
                for r in rows
            ],
        }


@router.post("/media/register")
async def register_external_media(
    body: dict = Body(...),
    tenant: dict = Depends(require_admin_tenant),
):
    """
    Register an externally-hosted asset into media_library.
    Body: { file_url, file_name, alt_text?, category?, description?, mime_type?, width?, height?, dominant_color? }
    """
    if not body.get('file_url'):
        raise HTTPException(400, "file_url required")
    async with AsyncSessionLocal() as session:
        r = (await session.execute(
            text("""
                INSERT INTO media_library
                  (id, tenant_id, bucket, storage_path, file_url, file_name, file_type,
                   alt_text, category, description, mime_type, width, height, dominant_color,
                   created_at)
                VALUES
                  (gen_random_uuid(), :tid, 'external', :fname, :url, :fname, COALESCE(:mt,'image/jpeg'),
                   :alt, :cat, :desc, COALESCE(:mt,'image/jpeg'), :w, :h, :dc, NOW())
                RETURNING id
            """),
            {"tid": tenant['id'], "url": body['file_url'],
             "fname": body.get('file_name', body['file_url'].rsplit('/', 1)[-1][:200]),
             "alt": body.get('alt_text'), "cat": body.get('category', 'site'),
             "desc": body.get('description'), "mt": body.get('mime_type'),
             "w": body.get('width'), "h": body.get('height'), "dc": body.get('dominant_color')},
        )).first()
        await session.commit()
        return {"id": str(r[0])}


@router.post("/media/upload")
async def upload_media(
    file: UploadFile = File(...),
    alt_text: str = Form(default=''),
    category: str = Form(default='site'),
    description: Optional[str] = Form(default=None),
    tenant: dict = Depends(require_admin_tenant),
):
    """
    Direct file upload to Supabase Storage with metadata in media_library.
    Accepts JPEG/PNG/WebP/AVIF. Max 25MB (post crop/filter compression).
    """
    if file.content_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/avif'):
        raise HTTPException(400, f"Unsupported MIME: {file.content_type}")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(413, "File too large (max 25MB)")

    # Extract dimensions + dominant color (Pillow)
    try:
        from PIL import Image
        import io as _io
        from collections import Counter
        img = Image.open(_io.BytesIO(raw))
        img.load()
        w, h = img.size
        thumb = img.convert('RGB').resize((48, 48))
        quant = thumb.quantize(colors=4)
        palette = quant.getpalette()[:12]
        idx = Counter(quant.getdata()).most_common(1)[0][0]
        r0, g0, b0 = palette[idx*3], palette[idx*3+1], palette[idx*3+2]
        dominant = f"#{r0:02X}{g0:02X}{b0:02X}"
    except Exception:
        w = h = None
        dominant = None

    # Upload to Supabase Storage (cms-assets bucket)
    import uuid
    safe_name = (file.filename or 'upload').rsplit('.', 1)[0][:60]
    ext = (file.content_type.split('/')[-1] or 'jpg').replace('jpeg', 'jpg')
    storage_path = f"{tenant['id']}/{category}/{uuid.uuid4().hex[:10]}-{safe_name}.{ext}"
    public_url = await supa_storage.upload_file(
        bucket=supa_storage.BUCKET_CMS_ASSETS,
        storage_path=storage_path,
        file_bytes=raw,
        content_type=file.content_type,
    )

    async with AsyncSessionLocal() as session:
        row = (await session.execute(
            text("""
                INSERT INTO media_library
                  (id, tenant_id, bucket, storage_path, file_url, file_name, file_type,
                   alt_text, category, description, mime_type, width, height,
                   dominant_color, created_at)
                VALUES
                  (gen_random_uuid(), :tid, :bk, :sp, :url, :fname, :mt,
                   :alt, :cat, :desc, :mt, :w, :h, :dc, NOW())
                RETURNING id, file_url, alt_text, category, mime_type, width, height,
                          dominant_color, file_name, created_at
            """),
            {"tid": tenant['id'], "bk": supa_storage.BUCKET_CMS_ASSETS,
             "sp": storage_path, "url": public_url,
             "fname": f"{safe_name}.{ext}",
             "alt": alt_text or None, "cat": category,
             "desc": description, "mt": file.content_type,
             "w": w, "h": h, "dc": dominant},
        )).mappings().first()
        await session.commit()
        return {
            "id": str(row['id']),
            "file_url": row['file_url'],
            "alt_text": row['alt_text'],
            "category": row['category'],
            "width": row['width'], "height": row['height'],
            "dominant_color": row['dominant_color'],
            "file_name": row['file_name'],
            "mime_type": row['mime_type'],
            "created_at": row['created_at'].isoformat() if row['created_at'] else None,
        }


@router.delete("/media/{media_id}")
async def delete_media(
    media_id: str,
    tenant: dict = Depends(require_admin_tenant),
):
    """Soft-archive a media_library entry. Storage object is kept (manual cleanup)."""
    async with AsyncSessionLocal() as session:
        r = await session.execute(
            text("""
                UPDATE media_library SET archived_at = NOW()
                WHERE id = CAST(:mid AS uuid) AND tenant_id = :tid AND archived_at IS NULL
                RETURNING id
            """),
            {"mid": media_id, "tid": tenant['id']},
        )
        if r.first() is None:
            raise HTTPException(404, "Media not found")
        await session.commit()
        return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────
#  PUBLISH  (page-level status)
# ─────────────────────────────────────────────────────────────────────────

@router.post("/pages/{slug}/publish")
async def publish_page(slug: str, tenant: dict = Depends(require_admin_tenant)):
    async with AsyncSessionLocal() as session:
        r = await session.execute(
            text("""
                UPDATE cms_pages SET status='published', published_at=NOW(), updated_at=NOW()
                WHERE tenant_id=:tid AND page_key=:slug RETURNING id
            """),
            {"tid": tenant['id'], "slug": slug},
        )
        if r.first() is None:
            raise HTTPException(404, "Page not found")
        await session.commit()
        site_resolver.invalidate_site_cache()
        return {"ok": True, "status": "published"}


@router.post("/pages/{slug}/unpublish")
async def unpublish_page(slug: str, tenant: dict = Depends(require_admin_tenant)):
    async with AsyncSessionLocal() as session:
        r = await session.execute(
            text("UPDATE cms_pages SET status='draft', updated_at=NOW() WHERE tenant_id=:tid AND page_key=:slug RETURNING id"),
            {"tid": tenant['id'], "slug": slug},
        )
        if r.first() is None:
            raise HTTPException(404, "Page not found")
        await session.commit()
        site_resolver.invalidate_site_cache()
        return {"ok": True, "status": "draft"}


# ─────────────────────────────────────────────────────────────────────────
#  LOCALES  (Locale Governance read for admin)
# ─────────────────────────────────────────────────────────────────────────

@router.get("/locales")
async def admin_locales(tenant: dict = Depends(require_admin_tenant)):
    return await site_resolver.resolve_locales()


# ─────────────────────────────────────────────────────────────────────────
#  CACHE
# ─────────────────────────────────────────────────────────────────────────

@router.post("/cache/invalidate")
async def admin_invalidate(tenant: dict = Depends(require_admin_tenant)):
    site_resolver.invalidate_site_cache()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────
#  AUTH check (used by admin UI gate)
# ─────────────────────────────────────────────────────────────────────────

@router.get("/whoami")
async def admin_whoami(tenant: dict = Depends(require_admin_tenant)):
    return {"tenant": {"id": str(tenant['id']), "slug": tenant.get('slug', 'mood-corporate')}}
