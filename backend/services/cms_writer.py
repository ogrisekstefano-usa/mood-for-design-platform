"""
CMS write service — page/section autosave, publish, revert, reorder, locale tabs.
All operations tenant-aware; revisions logged to content_revisions.
"""
import json
import logging
import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class _SafeEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, uuid.UUID):
            return str(o)
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        return super().default(o)


def _json(v) -> str:
    return json.dumps(v if v is not None else {}, cls=_SafeEncoder)


# ── Pages ─────────────────────────────────────────────────────────────────────

async def list_pages(db: AsyncSession, *, tenant_id: str, include_drafts: bool = True) -> list[dict]:
    rows = (await db.execute(
        text(f"""
            SELECT id::text, page_key, title, status::text, locale_meta,
                   updated_at, published_at, scheduled_publish_at
            FROM cms_pages
            WHERE tenant_id = CAST(:tid AS uuid)
              {"" if include_drafts else "AND status='published'"}
              AND deleted_at IS NULL
            ORDER BY page_key
        """),
        {'tid': tenant_id},
    )).mappings().all()
    return [dict(r) for r in rows]


async def get_page(db: AsyncSession, *, tenant_id: str, page_id: str,
                   include_sections: bool = True) -> Optional[dict]:
    row = (await db.execute(
        text("""
            SELECT id::text, page_key, title, status::text,
                   locale_meta, page_content, draft_json, published_json,
                   ai_translated_locales, published_at, updated_at
            FROM cms_pages
            WHERE id = CAST(:pid AS uuid) AND tenant_id = CAST(:tid AS uuid) AND deleted_at IS NULL
        """),
        {'pid': page_id, 'tid': tenant_id},
    )).mappings().first()
    if not row:
        return None
    page = dict(row)
    if include_sections:
        srows = (await db.execute(
            text("""
                SELECT id::text, section_type, sort_order, visible,
                       locale_content, settings, asset_refs
                FROM cms_sections
                WHERE page_id = CAST(:pid AS uuid) AND tenant_id = CAST(:tid AS uuid) AND deleted_at IS NULL
                ORDER BY sort_order
            """),
            {'pid': page_id, 'tid': tenant_id},
        )).mappings().all()
        page['sections'] = [dict(r) for r in srows]
    return page


async def autosave_page_draft(db: AsyncSession, *, tenant_id: str, page_id: str,
                              draft_json: dict, actor_id: Optional[str] = None) -> dict:
    await db.execute(
        text("""
            UPDATE cms_pages
            SET draft_json = CAST(:dj AS jsonb), updated_at = NOW(), updated_by = :aid
            WHERE id = CAST(:pid AS uuid) AND tenant_id = CAST(:tid AS uuid)
        """),
        {'dj': _json(draft_json), 'pid': page_id, 'tid': tenant_id, 'aid': actor_id},
    )
    await _snapshot(db, tenant_id=tenant_id, entity_type='cms_page',
                    entity_id=page_id, action='autosave', actor_id=actor_id)
    await db.commit()
    return {'ok': True}


async def publish_page(db: AsyncSession, *, tenant_id: str, page_id: str,
                       actor_id: Optional[str] = None) -> dict:
    page = await get_page(db, tenant_id=tenant_id, page_id=page_id, include_sections=True)
    if not page:
        raise ValueError("Page not found")
    snapshot = {
        'page_key': page['page_key'], 'title': page['title'],
        'locale_meta': page['locale_meta'], 'page_content': page['page_content'],
        'sections': page['sections'],
    }
    await db.execute(
        text("""
            UPDATE cms_pages
            SET status = 'published',
                published_json = CAST(:pj AS jsonb),
                published_at = COALESCE(published_at, NOW()),
                updated_by = :aid, updated_at = NOW()
            WHERE id = CAST(:pid AS uuid) AND tenant_id = CAST(:tid AS uuid)
        """),
        {'pj': _json(snapshot), 'pid': page_id, 'tid': tenant_id, 'aid': actor_id},
    )
    await _snapshot(db, tenant_id=tenant_id, entity_type='cms_page',
                    entity_id=page_id, action='publish', actor_id=actor_id)
    await db.commit()
    return {'ok': True, 'status': 'published'}


async def revert_page(db: AsyncSession, *, tenant_id: str, page_id: str,
                      actor_id: Optional[str] = None) -> dict:
    await db.execute(
        text("UPDATE cms_pages SET draft_json = '{}'::jsonb, updated_at = NOW() WHERE id = CAST(:pid AS uuid) AND tenant_id = CAST(:tid AS uuid)"),
        {'pid': page_id, 'tid': tenant_id},
    )
    await _snapshot(db, tenant_id=tenant_id, entity_type='cms_page',
                    entity_id=page_id, action='revert', actor_id=actor_id)
    await db.commit()
    return {'ok': True}


# ── Sections ──────────────────────────────────────────────────────────────────

async def patch_section(db: AsyncSession, *, tenant_id: str, section_id: str,
                        patch: dict, actor_id: Optional[str] = None) -> dict:
    """Update locale_content / settings / asset_refs / visible / section_type / sort_order."""
    sets = []
    params = {'sid': section_id, 'tid': tenant_id}
    if 'locale_content' in patch:
        sets.append("locale_content = CAST(:lc AS jsonb)")
        params['lc'] = _json(patch['locale_content'])
    if 'settings' in patch:
        sets.append("settings = CAST(:st AS jsonb)")
        params['st'] = _json(patch['settings'])
    if 'asset_refs' in patch:
        sets.append("asset_refs = CAST(:ar AS uuid[])")
        params['ar'] = patch['asset_refs'] or []
    if 'visible' in patch:
        sets.append("visible = :vis")
        params['vis'] = bool(patch['visible'])
    if 'section_type' in patch:
        sets.append("section_type = :stype")
        params['stype'] = patch['section_type']
    if 'sort_order' in patch:
        sets.append("sort_order = :so")
        params['so'] = int(patch['sort_order'])
    if not sets:
        raise ValueError("No section fields to update")
    sets.append("updated_at = NOW()")
    await db.execute(
        text(f"UPDATE cms_sections SET {', '.join(sets)} WHERE id = CAST(:sid AS uuid) AND tenant_id = CAST(:tid AS uuid) AND deleted_at IS NULL"),
        params,
    )
    await _snapshot(db, tenant_id=tenant_id, entity_type='cms_section',
                    entity_id=section_id, action='autosave', actor_id=actor_id)
    await db.commit()
    return {'ok': True, 'patched': list(patch.keys())}


async def reorder_sections(db: AsyncSession, *, tenant_id: str, page_id: str,
                           order: list[str], actor_id: Optional[str] = None) -> dict:
    for i, sid in enumerate(order):
        await db.execute(
            text("""UPDATE cms_sections SET sort_order = :so, updated_at = NOW()
                    WHERE id = CAST(:sid AS uuid) AND page_id = CAST(:pid AS uuid) AND tenant_id = CAST(:tid AS uuid)"""),
            {'so': i, 'sid': sid, 'pid': page_id, 'tid': tenant_id},
        )
    await _snapshot(db, tenant_id=tenant_id, entity_type='cms_page',
                    entity_id=page_id, action='manual_save', actor_id=actor_id,
                    note='sections reorder')
    await db.commit()
    return {'ok': True, 'reordered': len(order)}


async def add_section(db: AsyncSession, *, tenant_id: str, page_id: str,
                      section_type: str, sort_order: Optional[int] = None,
                      locale_content: Optional[dict] = None,
                      settings: Optional[dict] = None,
                      asset_refs: Optional[list[str]] = None,
                      actor_id: Optional[str] = None) -> dict:
    if sort_order is None:
        m = (await db.execute(
            text("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM cms_sections WHERE page_id = CAST(:pid AS uuid) AND deleted_at IS NULL"),
            {'pid': page_id},
        )).scalar()
        sort_order = m or 0
    sid = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO cms_sections
              (id, tenant_id, page_id, section_type, sort_order, visible,
               locale_content, settings, asset_refs, created_at, updated_at)
            VALUES
              (CAST(:sid AS uuid), CAST(:tid AS uuid), CAST(:pid AS uuid), :st, :so, true,
               CAST(:lc AS jsonb), CAST(:s AS jsonb), CAST(:ar AS uuid[]), NOW(), NOW())
        """),
        {'sid': sid, 'tid': tenant_id, 'pid': page_id, 'st': section_type, 'so': sort_order,
         'lc': _json(locale_content or {}), 's': _json(settings or {}),
         'ar': asset_refs or []},
    )
    await db.commit()
    return {'id': sid, 'section_type': section_type, 'sort_order': sort_order}


async def soft_delete_section(db: AsyncSession, *, tenant_id: str, section_id: str,
                              actor_id: Optional[str] = None) -> dict:
    await db.execute(
        text("UPDATE cms_sections SET deleted_at = NOW() WHERE id = CAST(:sid AS uuid) AND tenant_id = CAST(:tid AS uuid)"),
        {'sid': section_id, 'tid': tenant_id},
    )
    await db.commit()
    return {'ok': True}


# ── Snapshots ─────────────────────────────────────────────────────────────────

async def _snapshot(db: AsyncSession, *, tenant_id: str, entity_type: str,
                    entity_id: str, action: str, actor_id: Optional[str] = None,
                    note: Optional[str] = None):
    snap = {}
    if entity_type == 'cms_page':
        page = await get_page(db, tenant_id=tenant_id, page_id=entity_id, include_sections=True)
        snap = page or {}
    elif entity_type == 'cms_section':
        row = (await db.execute(
            text("""SELECT row_to_json(cs) FROM cms_sections cs WHERE id = CAST(:e AS uuid)"""),
            {'e': entity_id},
        )).first()
        snap = row[0] if row else {}

    await db.execute(
        text("""
            INSERT INTO content_revisions
              (id, tenant_id, entity_type, entity_id, action, snapshot_json, actor_id, note, created_at)
            VALUES
              (gen_random_uuid(), CAST(:tid AS uuid), :et, CAST(:eid AS uuid),
               CAST(:act AS revision_action), CAST(:sn AS jsonb), :aid, :note, NOW())
        """),
        {'tid': tenant_id, 'et': entity_type, 'eid': entity_id, 'act': action,
         'sn': _json(snap), 'aid': actor_id, 'note': note},
    )


async def get_revisions(db: AsyncSession, *, tenant_id: str, entity_type: str,
                        entity_id: str, limit: int = 50) -> list[dict]:
    rows = (await db.execute(
        text("""SELECT id::text, action::text, actor_id::text, note, created_at
                FROM content_revisions
                WHERE tenant_id = CAST(:tid AS uuid) AND entity_type = :et
                  AND entity_id = CAST(:eid AS uuid)
                ORDER BY created_at DESC LIMIT :lim"""),
        {'tid': tenant_id, 'et': entity_type, 'eid': entity_id, 'lim': limit},
    )).mappings().all()
    return [dict(r) for r in rows]
