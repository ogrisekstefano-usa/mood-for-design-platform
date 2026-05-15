"""
MOOD for DESIGN — Seed migration from seed_data.py → Supabase (Blueprint schema).
IDEMPOTENT. Deterministic UUIDs (UUIDv5) so re-runs upsert correctly.

Usage:
  python /app/backend/db/seed_migration.py            # bootstrap + upsert
  python /app/backend/db/seed_migration.py --force    # also rewrites locale_content

This script:
  1. Ensures 'mood-corporate' tenant exists in `tenants`.
  2. Ensures tenant_domain 'www.moodfordesign.com' is mapped.
  3. Upserts cms_pages from PAGES dict (page_key = slug).
  4. Upserts cms_sections from each page's sections list.
  5. Upserts a 'navigation' section (page=home) carrying main+cta+footer per locale.
"""
import asyncio
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# allow `from db.seed_data import ...` when run as script
ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

import asyncpg
from dotenv import load_dotenv
load_dotenv(ROOT_DIR / '.env')

from db.seed_data import PAGES, NAVIGATION, TENANTS  # noqa: E402

# Namespace for deterministic UUIDv5 — change requires re-seed all
NS = uuid.UUID('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')

CORP_SLUG = 'mood-corporate'
CORP_TENANT_ID = str(uuid.uuid5(NS, f'tenant:{CORP_SLUG}'))
CORP_DOMAIN = 'www.moodfordesign.com'

LOCALES = ['it', 'en-us', 'en-uk', 'fr', 'de', 'es']


def _page_uuid(page_key: str) -> str:
    return str(uuid.uuid5(NS, f'page:{CORP_SLUG}:{page_key}'))


def _section_uuid(page_key: str, section_id: str) -> str:
    return str(uuid.uuid5(NS, f'section:{CORP_SLUG}:{page_key}:{section_id}'))


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def upsert_tenant(conn: asyncpg.Connection) -> str:
    tenant_meta = TENANTS[0]
    cfg = tenant_meta.get('config', {})

    row = await conn.fetchrow(
        "SELECT id FROM tenants WHERE slug = $1", CORP_SLUG
    )
    if row:
        tenant_id = str(row['id'])
        # Patch enabled_modules / theme
        await conn.execute(
            """
            UPDATE tenants SET
              name = $2, status = 'active', active_plan = 'platform-owner',
              logo_url = $3, primary_color = $4, font_heading = $5, font_body = $6,
              default_language = $7, active_languages = $8::text[],
              enabled_modules = $9::jsonb, updated_at = NOW()
            WHERE id = $1
            """,
            tenant_id,
            tenant_meta['name'],
            cfg.get('logo_url'),
            '#00C9B3',
            'Playfair Display', 'Montserrat',
            cfg.get('primary_locale', 'en-us'),
            cfg.get('locales_enabled', LOCALES),
            json.dumps(['cms', 'journal', 'storefront', 'pricing', 'newsletter', 'contact']),
        )
    else:
        tenant_id = CORP_TENANT_ID
        await conn.execute(
            """
            INSERT INTO tenants (
              id, slug, name, status, active_plan, subscription_status,
              logo_url, primary_color, font_heading, font_body,
              default_language, active_languages, enabled_modules,
              max_users, max_projects, max_storage_gb,
              plan_assigned_at, created_at, updated_at
            ) VALUES (
              $1, $2, $3, 'active', 'platform-owner', 'active',
              $4, $5, $6, $7,
              $8, $9::text[], $10::jsonb,
              9999, 9999, 9999,
              NOW(), NOW(), NOW()
            )
            """,
            tenant_id, CORP_SLUG, tenant_meta['name'],
            cfg.get('logo_url'),
            '#00C9B3', 'Playfair Display', 'Montserrat',
            cfg.get('primary_locale', 'en-us'),
            cfg.get('locales_enabled', LOCALES),
            json.dumps(['cms', 'journal', 'storefront', 'pricing', 'newsletter', 'contact']),
        )

    # Ensure tenant_domain
    existing = await conn.fetchrow(
        "SELECT id FROM tenant_domains WHERE domain = $1", CORP_DOMAIN
    )
    if not existing:
        await conn.execute(
            """
            INSERT INTO tenant_domains (id, tenant_id, domain, type, is_primary, verification_status, created_at)
            VALUES ($1, $2, $3, 'custom_domain', true, 'verified', NOW())
            """,
            str(uuid.uuid5(NS, f'domain:{CORP_DOMAIN}')),
            tenant_id, CORP_DOMAIN,
        )

    print(f"  ✓ tenant '{CORP_SLUG}' id={tenant_id}")
    print(f"  ✓ domain '{CORP_DOMAIN}' mapped")
    return tenant_id


async def upsert_page(conn: asyncpg.Connection, tenant_id: str, page_key: str, page_data: dict) -> str:
    page_id = _page_uuid(page_key)
    locale_meta = json.dumps(page_data.get('seo', {}))
    page_content = json.dumps({'template': page_data.get('template', 'corporate-default')})
    status = 'published' if page_data.get('is_published', True) else 'draft'

    await conn.execute(
        """
        INSERT INTO cms_pages (
          id, tenant_id, page_key, title, locale_meta, page_content, status,
          ai_translated_locales, approval_meta, created_at, updated_at, published_at
        ) VALUES (
          $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7,
          $8::text[], '{}'::jsonb, NOW(), NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          page_key = EXCLUDED.page_key,
          title = EXCLUDED.title,
          locale_meta = EXCLUDED.locale_meta,
          page_content = EXCLUDED.page_content,
          status = EXCLUDED.status,
          ai_translated_locales = EXCLUDED.ai_translated_locales,
          updated_at = NOW(),
          published_at = COALESCE(cms_pages.published_at, NOW())
        """,
        page_id, tenant_id, page_key,
        page_data.get('seo', {}).get('en-us', {}).get('title', page_key.title()),
        locale_meta, page_content, status,
        LOCALES,
    )
    return page_id


async def upsert_section(conn: asyncpg.Connection, tenant_id: str, page_id: str,
                          page_key: str, section: dict) -> str:
    section_id = _section_uuid(page_key, section['id'])
    locale_content = section.get('content', {}) or {}
    settings = section.get('config', {}) or {}

    await conn.execute(
        """
        INSERT INTO cms_sections (
          id, tenant_id, page_id, section_type, sort_order, visible,
          locale_content, settings, asset_refs, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7::jsonb, $8::jsonb, ARRAY[]::uuid[], NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          section_type = EXCLUDED.section_type,
          sort_order = EXCLUDED.sort_order,
          visible = EXCLUDED.visible,
          locale_content = EXCLUDED.locale_content,
          settings = EXCLUDED.settings,
          updated_at = NOW()
        """,
        section_id, tenant_id, page_id,
        section['type'],
        section.get('display_order', 0),
        section.get('is_enabled', True),
        json.dumps(locale_content),
        json.dumps(settings),
    )
    return section_id


async def upsert_navigation(conn: asyncpg.Connection, tenant_id: str, home_page_id: str):
    """
    Persist navigation as a dedicated 'navigation' section on the home page.
    locale_content shape per locale: {main: [...], cta: {...}, footer: {...}}
    """
    section_id = _section_uuid('home', 'navigation-global')

    # Build {locale: {main, cta, footer}} from NAVIGATION dict
    locale_content = {}
    for loc in LOCALES:
        main_items = [
            {
                'id': item['id'],
                'key': item['key'],
                'href': item['href'],
                'label': item['labels'].get(loc) or item['labels'].get('en-us'),
                'order': item.get('order', 0),
            }
            for item in NAVIGATION['main']
        ]
        cta = NAVIGATION.get('cta')
        cta_resolved = None
        if cta:
            cta_resolved = {
                'id': cta['id'], 'key': cta['key'], 'href': cta['href'],
                'label': cta['labels'].get(loc) or cta['labels'].get('en-us'),
            }
        footer = {
            group: {
                'heading': data['heading'].get(loc) or data['heading'].get('en-us'),
                'links': [
                    {'label': l['label'].get(loc) or l['label'].get('en-us'), 'href': l['href']}
                    for l in data['links']
                ]
            }
            for group, data in NAVIGATION.get('footer', {}).items()
        }
        locale_content[loc] = {'main': main_items, 'cta': cta_resolved, 'footer': footer}

    await conn.execute(
        """
        INSERT INTO cms_sections (
          id, tenant_id, page_id, section_type, sort_order, visible,
          locale_content, settings, asset_refs, created_at, updated_at
        ) VALUES (
          $1, $2, $3, 'navigation', -1, true,
          $4::jsonb, '{}'::jsonb, ARRAY[]::uuid[], NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          locale_content = EXCLUDED.locale_content,
          updated_at = NOW()
        """,
        section_id, tenant_id, home_page_id, json.dumps(locale_content),
    )


async def main():
    url = os.environ['SESSION_POOLER_URL']
    conn = await asyncpg.connect(url, command_timeout=60)
    try:
        print("─── Seeding mood-corporate into Supabase ───")
        tenant_id = await upsert_tenant(conn)

        home_id = None
        for page_key, page_data in PAGES.items():
            page_id = await upsert_page(conn, tenant_id, page_key, page_data)
            if page_key == 'home':
                home_id = page_id

            n = 0
            for section in page_data.get('sections', []):
                await upsert_section(conn, tenant_id, page_id, page_key, section)
                n += 1
            print(f"  ✓ page '{page_key}' ({n} sections)")

        if home_id:
            await upsert_navigation(conn, tenant_id, home_id)
            print("  ✓ navigation (multilingual) persisted on home page")

        # Verification
        pcount = await conn.fetchval(
            "SELECT COUNT(*) FROM cms_pages WHERE tenant_id = $1", tenant_id
        )
        scount = await conn.fetchval(
            "SELECT COUNT(*) FROM cms_sections WHERE tenant_id = $1", tenant_id
        )
        print(f"─── DONE: {pcount} pages, {scount} sections for tenant '{CORP_SLUG}' ───")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
