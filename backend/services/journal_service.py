"""
Journal service — articles + localizations + blocks + draft/published workflow.
All operations tenant-aware. Snapshots saved to content_revisions.
"""
import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# ── Service input models ─────────────────────────────────────────────────────

@dataclass
class ArticleCreateData:
    article_type: str
    canonical_locale: str
    localizations: list[dict]
    hero_asset_id: Optional[str] = None
    author_display_name: Optional[str] = None
    actor_id: Optional[str] = None


@dataclass
class BlockCreateData:
    block_type: str
    sort_order: int = 0
    locale_content: Optional[dict] = None
    settings: Optional[dict] = None
    asset_refs: Optional[list[str]] = None


@dataclass
class ArticleListFilters:
    locale: str = 'en-us'
    category_slug: Optional[str] = None
    tag_slugs: Optional[list[str]] = None
    search: Optional[str] = None
    limit: int = 24
    offset: int = 0


class _SafeEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, (uuid.UUID,)):
            return str(o)
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        return super().default(o)


# ── helpers ──────────────────────────────────────────────────────────────────

def _json(v) -> str:
    return json.dumps(v if v is not None else {}, cls=_SafeEncoder)


async def _snapshot(db: AsyncSession, *, tenant_id: str, entity_type: str,
                    entity_id: str, action: str, actor_id: Optional[str] = None,
                    note: Optional[str] = None):
    if entity_type == 'journal_article':
        row = (await db.execute(
            text("""
                SELECT row_to_json(a) AS snap FROM (
                  SELECT ja.*, (
                    SELECT json_agg(al ORDER BY al.locale_code) FROM article_localizations al WHERE al.article_id = ja.id
                  ) AS localizations,
                  (
                    SELECT json_agg(b ORDER BY b.sort_order) FROM journal_article_blocks b WHERE b.article_id = ja.id AND b.deleted_at IS NULL
                  ) AS blocks
                  FROM journal_articles ja WHERE ja.id = CAST(:eid AS uuid)
                ) a
            """),
            {'eid': entity_id},
        )).first()
        snap = row[0] if row else {}
    else:
        snap = {}

    await db.execute(
        text("""
            INSERT INTO content_revisions
              (id, tenant_id, entity_type, entity_id, action, snapshot_json, actor_id, note, created_at)
            VALUES
              (gen_random_uuid(), CAST(:tid AS uuid), :et, CAST(:eid AS uuid), CAST(:act AS revision_action),
               CAST(:snap AS jsonb), :aid, :note, NOW())
        """),
        {
            'tid': tenant_id, 'et': entity_type, 'eid': entity_id, 'act': action,
            'snap': _json(snap), 'aid': actor_id, 'note': note,
        },
    )


# ── Categories / Tags ────────────────────────────────────────────────────────

async def upsert_category(db: AsyncSession, *, tenant_id: str, slug: str,
                          locale_meta: dict, sort_order: int = 0,
                          parent_id: Optional[str] = None) -> dict:
    row = (await db.execute(
        text("""
            INSERT INTO journal_categories
              (id, tenant_id, slug, parent_id, locale_meta, sort_order, created_at, updated_at)
            VALUES
              (gen_random_uuid(), CAST(:tid AS uuid), :sl, CAST(NULLIF(:pid,'') AS uuid),
               CAST(:lm AS jsonb), :so, NOW(), NOW())
            ON CONFLICT (tenant_id, slug) DO UPDATE
              SET locale_meta = EXCLUDED.locale_meta,
                  sort_order = EXCLUDED.sort_order,
                  parent_id = EXCLUDED.parent_id,
                  updated_at = NOW()
            RETURNING id::text, slug, locale_meta, sort_order
        """),
        {'tid': tenant_id, 'sl': slug, 'pid': parent_id or '',
         'lm': _json(locale_meta), 'so': sort_order},
    )).mappings().first()
    await db.commit()
    return dict(row)


async def list_categories(db: AsyncSession, *, tenant_id: str, locale: str = 'en-us') -> list[dict]:
    rows = (await db.execute(
        text("""
            SELECT id::text, slug, locale_meta, sort_order
            FROM journal_categories
            WHERE tenant_id = CAST(:tid AS uuid) AND deleted_at IS NULL AND is_active = true
            ORDER BY sort_order, slug
        """),
        {'tid': tenant_id},
    )).mappings().all()
    out = []
    for r in rows:
        meta = r['locale_meta'] or {}
        loc = meta.get(locale) or meta.get('en-us') or next(iter(meta.values()), {})
        out.append({
            'id': r['id'], 'slug': r['slug'],
            'name': loc.get('name', r['slug']),
            'description': loc.get('description'),
            'sort_order': r['sort_order'],
        })
    return out


async def upsert_tag(db: AsyncSession, *, tenant_id: str, slug: str,
                     locale_meta: dict, tag_group: Optional[str] = None) -> dict:
    row = (await db.execute(
        text("""
            INSERT INTO journal_tags (id, tenant_id, slug, locale_meta, tag_group, created_at, updated_at)
            VALUES (gen_random_uuid(), CAST(:tid AS uuid), :sl, CAST(:lm AS jsonb), :tg, NOW(), NOW())
            ON CONFLICT (tenant_id, slug) DO UPDATE
              SET locale_meta = EXCLUDED.locale_meta, tag_group = EXCLUDED.tag_group, updated_at = NOW()
            RETURNING id::text, slug, locale_meta, tag_group
        """),
        {'tid': tenant_id, 'sl': slug, 'lm': _json(locale_meta), 'tg': tag_group},
    )).mappings().first()
    await db.commit()
    return dict(row)


async def list_tags(db: AsyncSession, *, tenant_id: str, locale: str = 'en-us',
                    tag_group: Optional[str] = None) -> list[dict]:
    where = "tenant_id = CAST(:tid AS uuid) AND deleted_at IS NULL"
    params = {'tid': tenant_id}
    if tag_group:
        where += " AND tag_group = :tg"
        params['tg'] = tag_group
    rows = (await db.execute(
        text(f"SELECT id::text, slug, locale_meta, tag_group FROM journal_tags WHERE {where} ORDER BY slug"),
        params,
    )).mappings().all()
    out = []
    for r in rows:
        meta = r['locale_meta'] or {}
        loc = meta.get(locale) or meta.get('en-us') or next(iter(meta.values()), {})
        out.append({
            'id': r['id'], 'slug': r['slug'], 'tag_group': r['tag_group'],
            'label': loc.get('label', r['slug']),
        })
    return out


# ── Articles ─────────────────────────────────────────────────────────────────

async def create_article(db: AsyncSession, *, tenant_id: str,
                         data: ArticleCreateData) -> dict:
    """
    Create a new article in 'draft' status.
    data.localizations: [{locale_code, slug, title, excerpt?, seo_title?, seo_description?}]
    """
    if not data.localizations:
        raise ValueError("At least one localization required")

    article_id = str(uuid.uuid4())
    locale_codes = [loc['locale_code'] for loc in data.localizations]

    await db.execute(
        text("""
            INSERT INTO journal_articles (
              id, tenant_id, article_type, status, canonical_locale, translated_locales,
              hero_asset_id, author_display_name, created_by, updated_by, created_at, updated_at
            ) VALUES (
              CAST(:id AS uuid), CAST(:tid AS uuid), CAST(:typ AS journal_article_type), 'draft',
              :cl, CAST(:tl AS text[]), CAST(NULLIF(:hid,'') AS uuid), :auth, :aid, :aid, NOW(), NOW()
            )
        """),
        {'id': article_id, 'tid': tenant_id, 'typ': data.article_type, 'cl': data.canonical_locale,
         'tl': locale_codes, 'hid': data.hero_asset_id or '', 'auth': data.author_display_name,
         'aid': data.actor_id},
    )
    for loc in data.localizations:
        await db.execute(
            text("""
                INSERT INTO article_localizations (
                  id, article_id, locale_code, slug, title, excerpt,
                  seo_title, seo_description, canonical_url, created_at, updated_at
                ) VALUES (
                  gen_random_uuid(), CAST(:aid AS uuid), :lc, :sl, :t, :ex,
                  :st, :sd, :cu, NOW(), NOW()
                )
            """),
            {'aid': article_id, 'lc': loc['locale_code'], 'sl': loc['slug'],
             't': loc['title'], 'ex': loc.get('excerpt'),
             'st': loc.get('seo_title'), 'sd': loc.get('seo_description'),
             'cu': loc.get('canonical_url')},
        )
    await _snapshot(db, tenant_id=tenant_id, entity_type='journal_article',
                    entity_id=article_id, action='create', actor_id=data.actor_id)
    await db.commit()
    return await get_article(db, tenant_id=tenant_id, article_id=article_id)


async def get_article(db: AsyncSession, *, tenant_id: str, article_id: str) -> Optional[dict]:
    row = (await db.execute(
        text("""
            SELECT a.id::text, a.tenant_id::text, a.article_type::text, a.status::text,
                   a.canonical_locale, a.translated_locales, a.hero_asset_id::text,
                   a.author_display_name, a.ai_generated, a.ai_metadata,
                   a.published_at, a.scheduled_publish_at, a.reading_time_minutes,
                   a.draft_json, a.published_json,
                   a.created_at, a.updated_at
            FROM journal_articles a
            WHERE a.id = CAST(:aid AS uuid) AND a.tenant_id = CAST(:tid AS uuid) AND a.deleted_at IS NULL
        """),
        {'aid': article_id, 'tid': tenant_id},
    )).mappings().first()
    if not row:
        return None
    art = dict(row)
    art['localizations'] = [dict(r) for r in (await db.execute(
        text("""SELECT locale_code, slug, title, excerpt, seo_title, seo_description, canonical_url
                FROM article_localizations WHERE article_id = CAST(:aid AS uuid)
                ORDER BY locale_code"""),
        {'aid': article_id},
    )).mappings().all()]
    art['blocks'] = [dict(r) for r in (await db.execute(
        text("""SELECT id::text, block_type, sort_order, visible, locale_content, settings, asset_refs
                FROM journal_article_blocks WHERE article_id = CAST(:aid AS uuid) AND deleted_at IS NULL
                ORDER BY sort_order"""),
        {'aid': article_id},
    )).mappings().all()]
    return art


async def autosave_draft(db: AsyncSession, *, tenant_id: str, article_id: str,
                         draft_json: dict, actor_id: Optional[str] = None) -> dict:
    await db.execute(
        text("""
            UPDATE journal_articles
              SET draft_json = CAST(:dj AS jsonb), updated_by = :aid, updated_at = NOW()
              WHERE id = CAST(:aid_a AS uuid) AND tenant_id = CAST(:tid AS uuid)
        """),
        {'dj': _json(draft_json), 'aid': actor_id, 'aid_a': article_id, 'tid': tenant_id},
    )
    await _snapshot(db, tenant_id=tenant_id, entity_type='journal_article',
                    entity_id=article_id, action='autosave', actor_id=actor_id)
    await db.commit()
    return {'ok': True}


async def add_block(db: AsyncSession, *, tenant_id: str, article_id: str,
                    data: BlockCreateData) -> dict:
    block_id = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO journal_article_blocks
              (id, article_id, tenant_id, block_type, sort_order, locale_content, settings, asset_refs,
               created_at, updated_at)
            VALUES
              (CAST(:bid AS uuid), CAST(:aid AS uuid), CAST(:tid AS uuid), :bt, :so,
               CAST(:lc AS jsonb), CAST(:st AS jsonb), CAST(:ar AS uuid[]), NOW(), NOW())
        """),
        {'bid': block_id, 'aid': article_id, 'tid': tenant_id,
         'bt': data.block_type, 'so': data.sort_order,
         'lc': _json(data.locale_content or {}), 'st': _json(data.settings or {}),
         'ar': data.asset_refs or []},
    )
    await db.commit()
    return {'id': block_id, 'block_type': data.block_type, 'sort_order': data.sort_order}


async def reorder_blocks(db: AsyncSession, *, tenant_id: str, article_id: str,
                         order: list[str]) -> dict:
    for i, bid in enumerate(order):
        await db.execute(
            text("""UPDATE journal_article_blocks
                    SET sort_order = :so, updated_at = NOW()
                    WHERE id = CAST(:bid AS uuid) AND article_id = CAST(:aid AS uuid) AND tenant_id = CAST(:tid AS uuid)"""),
            {'so': i, 'bid': bid, 'aid': article_id, 'tid': tenant_id},
        )
    await db.commit()
    return {'ok': True, 'reordered': len(order)}


async def publish_article(db: AsyncSession, *, tenant_id: str, article_id: str,
                          actor_id: Optional[str] = None) -> dict:
    # build published_json from current state (article + localizations + blocks)
    art = await get_article(db, tenant_id=tenant_id, article_id=article_id)
    if not art:
        raise ValueError("Article not found")
    snapshot = {
        'article_type': art['article_type'], 'canonical_locale': art['canonical_locale'],
        'hero_asset_id': art['hero_asset_id'], 'author_display_name': art['author_display_name'],
        'localizations': art['localizations'], 'blocks': art['blocks'],
    }
    await db.execute(
        text("""
            UPDATE journal_articles
              SET status = 'published',
                  published_json = CAST(:pj AS jsonb),
                  published_at = COALESCE(published_at, NOW()),
                  published_by = :aid,
                  updated_at = NOW()
              WHERE id = CAST(:a AS uuid) AND tenant_id = CAST(:t AS uuid)
        """),
        {'pj': _json(snapshot), 'aid': actor_id, 'a': article_id, 't': tenant_id},
    )
    await _snapshot(db, tenant_id=tenant_id, entity_type='journal_article',
                    entity_id=article_id, action='publish', actor_id=actor_id)
    await db.commit()
    return {'ok': True, 'status': 'published'}


async def revert_article(db: AsyncSession, *, tenant_id: str, article_id: str,
                          actor_id: Optional[str] = None) -> dict:
    """Revert: discard draft_json by clearing it (live remains untouched)."""
    await db.execute(
        text("""
            UPDATE journal_articles SET draft_json = '{}'::jsonb, updated_at = NOW(), updated_by = :aid
              WHERE id = CAST(:a AS uuid) AND tenant_id = CAST(:t AS uuid)
        """),
        {'aid': actor_id, 'a': article_id, 't': tenant_id},
    )
    await _snapshot(db, tenant_id=tenant_id, entity_type='journal_article',
                    entity_id=article_id, action='revert', actor_id=actor_id)
    await db.commit()
    return {'ok': True}


async def list_public_articles(db: AsyncSession, *, tenant_id: str,
                                filters: ArticleListFilters) -> dict:
    joins = []
    where = ["a.tenant_id = CAST(:tid AS uuid)", "a.status = 'published'", "a.deleted_at IS NULL"]
    params = {'tid': tenant_id, 'loc': filters.locale,
              'lim': filters.limit, 'off': filters.offset}
    if filters.category_slug:
        joins.append("JOIN article_category_map cm ON cm.article_id = a.id")
        joins.append("JOIN journal_categories c ON c.id = cm.category_id")
        where.append("c.slug = :cslug")
        params['cslug'] = filters.category_slug
    if filters.tag_slugs:
        joins.append("JOIN article_tag_map tm ON tm.article_id = a.id")
        joins.append("JOIN journal_tags tg ON tg.id = tm.tag_id")
        where.append("tg.slug = ANY(:tslugs)")
        params['tslugs'] = filters.tag_slugs
    if filters.search:
        joins.append("JOIN article_localizations alx ON alx.article_id = a.id")
        where.append("alx.locale_code = :loc AND (alx.title ILIKE :q OR alx.excerpt ILIKE :q)")
        params['q'] = f"%{filters.search}%"

    join_sql = " ".join(joins)
    # Optimized: LEFT JOIN to fetch hero asset + locale rows in a single pass
    # (was N+1 with correlated subqueries; now bounded by LIMIT).
    sql = f"""
        WITH filtered AS (
          SELECT DISTINCT a.id, a.published_at
          FROM journal_articles a
          {join_sql}
          WHERE {' AND '.join(where)}
          ORDER BY a.published_at DESC NULLS LAST
          LIMIT :lim OFFSET :off
        )
        SELECT a.id::text,
               a.article_type::text,
               a.published_at,
               a.hero_asset_id::text,
               a.author_display_name,
               a.reading_time_minutes,
               hero.public_url AS hero_url,
               row_to_json(al)      AS loc,
               row_to_json(al2)     AS loc_canon
        FROM journal_articles a
        JOIN filtered f                              ON f.id = a.id
        LEFT JOIN cms_assets hero                    ON hero.id = a.hero_asset_id
        LEFT JOIN article_localizations al           ON al.article_id  = a.id AND al.locale_code = :loc
        LEFT JOIN article_localizations al2          ON al2.article_id = a.id AND al2.locale_code = a.canonical_locale
        ORDER BY a.published_at DESC NULLS LAST
    """
    rows = (await db.execute(text(sql), params)).mappings().all()
    items = []
    for r in rows:
        loc = r['loc'] or r['loc_canon'] or {}
        items.append({
            'id': r['id'], 'type': r['article_type'],
            'title': loc.get('title'), 'excerpt': loc.get('excerpt'),
            'slug': loc.get('slug'),
            'published_at': r['published_at'].isoformat() if r['published_at'] else None,
            'hero_url': r['hero_url'],
            'author': r['author_display_name'],
            'reading_time': r['reading_time_minutes'],
        })
    return {'items': items, 'limit': filters.limit, 'offset': filters.offset}


async def get_public_article(db: AsyncSession, *, tenant_id: str, slug: str,
                              locale: str = 'en-us') -> Optional[dict]:
    row = (await db.execute(
        text("""
            SELECT a.id::text, a.article_type::text, a.canonical_locale, a.published_at,
                   a.hero_asset_id::text, a.published_json,
                   (SELECT public_url FROM cms_assets WHERE id = a.hero_asset_id) AS hero_url,
                   a.author_display_name, a.reading_time_minutes
            FROM journal_articles a
            JOIN article_localizations al ON al.article_id = a.id
            WHERE a.tenant_id = CAST(:tid AS uuid)
              AND a.status = 'published' AND a.deleted_at IS NULL
              AND al.slug = :slug AND al.locale_code = :loc
            LIMIT 1
        """),
        {'tid': tenant_id, 'slug': slug, 'loc': locale},
    )).mappings().first()
    if not row:
        # fallback: try any locale with that slug
        row = (await db.execute(
            text("""
                SELECT a.id::text, a.article_type::text, a.canonical_locale, a.published_at,
                       a.hero_asset_id::text, a.published_json,
                       (SELECT public_url FROM cms_assets WHERE id = a.hero_asset_id) AS hero_url,
                       a.author_display_name, a.reading_time_minutes
                FROM journal_articles a
                JOIN article_localizations al ON al.article_id = a.id
                WHERE a.tenant_id = CAST(:tid AS uuid)
                  AND a.status = 'published' AND a.deleted_at IS NULL
                  AND al.slug = :slug
                LIMIT 1
            """),
            {'tid': tenant_id, 'slug': slug},
        )).mappings().first()
        if not row:
            return None

    pub = dict(row)
    published = pub.pop('published_json') or {}
    locs = published.get('localizations', [])
    loc_row = next((lc for lc in locs if lc.get('locale_code') == locale), None) \
              or next((lc for lc in locs if lc.get('locale_code') == pub['canonical_locale']), {})
    return {
        'id': pub['id'],
        'type': pub['article_type'],
        'title': loc_row.get('title'),
        'excerpt': loc_row.get('excerpt'),
        'seo_title': loc_row.get('seo_title'),
        'seo_description': loc_row.get('seo_description'),
        'canonical_locale': pub['canonical_locale'],
        'hero_url': pub['hero_url'],
        'author': pub['author_display_name'],
        'reading_time': pub['reading_time_minutes'],
        'published_at': pub['published_at'].isoformat() if pub['published_at'] else None,
        'blocks': published.get('blocks', []),
    }


async def get_revisions(db: AsyncSession, *, tenant_id: str, article_id: str,
                        limit: int = 50) -> list[dict]:
    rows = (await db.execute(
        text("""
            SELECT id::text, action::text, actor_id::text, note, created_at
            FROM content_revisions
            WHERE tenant_id = CAST(:tid AS uuid) AND entity_type = 'journal_article'
              AND entity_id = CAST(:eid AS uuid)
            ORDER BY created_at DESC
            LIMIT :lim
        """),
        {'tid': tenant_id, 'eid': article_id, 'lim': limit},
    )).mappings().all()
    return [dict(r) for r in rows]
