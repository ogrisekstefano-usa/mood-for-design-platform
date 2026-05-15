#!/usr/bin/env python3
"""Storefront CMS™ — Seed Importer

Reads the legacy /app/frontend/src/site/content/*.js configs (dumped to JSON
via /app/backend/scripts/dump_site_content.mjs through /tmp/sitecontent/dump.mjs)
and imports them as cms_pages + cms_sections rows for a given tenant.

IDEMPOTENT — re-run safely. Existing sections for a (tenant, page_key) are
purged and re-inserted from the seed (to keep alignment as the JS evolves).
A `--keep-existing` flag preserves whatever is already in the DB.

LOCALE MAPPING — JS configs use simple language codes (it, en, fr, de, es).
At import time we mirror `en → en-US`, with `en-GB` left empty (the editor
shows it as "needs translation" — perfect future-AI-translation entry point).

USAGE
─────
    python3 seed_storefront_cms.py --tenant mood-demo-studio-81a09e
    python3 seed_storefront_cms.py --tenant mood-demo-studio-81a09e --keep-existing
"""
import argparse
import json
import os
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Add /app/backend to PYTHONPATH so we can import database
sys.path.insert(0, str(Path(__file__).parent.parent))
from database import db  # noqa: E402

NOW = lambda: datetime.now(timezone.utc).isoformat()  # noqa: E731

LOCALE_MAP = {
    'it': 'it',
    'en': 'en-US',  # legacy 'en' → canonical 'en-US'
    'fr': 'fr',
    'de': 'de',
    'es': 'es',
    'ae': 'ar',     # 'ae' (UAE market label) → canonical 'ar' (Arabic)
}


def _locale_bag(value):
    """Convert a `{it, en, fr, de, es}` JS dict into canonical `{_default, it, en-US, ...}` bag.
    Strings and other primitives are returned as-is.
    """
    if not isinstance(value, dict):
        return value
    # Detect a locale-keyed dict
    keys = set(value.keys())
    if keys.issubset(set(LOCALE_MAP.keys()) | {'_default'}):
        out = {}
        for src, dst in LOCALE_MAP.items():
            if src in value:
                out[dst] = value[src]
        # _default = Italian (platform default)
        if 'it' in value:
            out['_default'] = value['it']
        return out
    return value


def _deep_locale_normalize(obj):
    """Recursively walk and convert nested locale dicts."""
    if isinstance(obj, dict):
        # First check if THIS dict is a locale bag
        keys = set(obj.keys())
        if keys and keys.issubset(set(LOCALE_MAP.keys()) | {'_default'}):
            return _locale_bag(obj)
        return {k: _deep_locale_normalize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_deep_locale_normalize(v) for v in obj]
    return obj


def _ensure_page(client, tenant_id, page_key, title=None):
    r = client.table('cms_pages').select('*') \
        .eq('tenant_id', tenant_id).eq('page_key', page_key).limit(1).execute()
    if r.data:
        return r.data[0]
    new = {
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'page_key': page_key,
        'title': title or page_key.replace('_', ' ').title(),
        'locale_meta': {}, 'page_content': {},
        'status': 'draft',
        'created_at': NOW(), 'updated_at': NOW(),
    }
    client.table('cms_pages').insert(new).execute()
    return new


def _purge_sections(client, tenant_id, page_id):
    client.table('cms_sections').delete() \
        .eq('tenant_id', tenant_id).eq('page_id', page_id).execute()


def _create_section(client, tenant_id, page_id, section_type, sort_order, locale_content, settings=None):
    new = {
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'page_id': page_id,
        'section_type': section_type,
        'sort_order': sort_order,
        'visible': True,
        'locale_content': locale_content,
        'settings': settings or {},
        'created_at': NOW(), 'updated_at': NOW(),
    }
    client.table('cms_sections').insert(new).execute()
    return new


# ─── Page builders ─────────────────────────────────────────────────────────
def build_home_sections(home):
    """Map homepage.js → cms_sections rows for page_key='home'.

    Layout: store_hero · value_props (services) · stats_band ·
    projects_preview · magazine_grid · brand_logos.
    """
    LOCALES = ['it', 'en', 'fr', 'de', 'es', 'ae']
    sections = []

    # ── 1. store_hero ────────────────────────────────────────────
    hero = home.get('hero') or {}
    sections.append((
        'store_hero',
        {
            '_default': {
                'background_image_url': hero.get('backgroundImage'),
                'atmosphere': 'cinematic',
                'cta_primary_href':   (hero.get('ctaPrimary')   or {}).get('href'),
                'cta_secondary_href': (hero.get('ctaSecondary') or {}).get('href'),
                'video_href':         (hero.get('videoLabel')   or {}).get('href'),
            },
            **{LOCALE_MAP.get(k, k): {
                'eyebrow':       (hero.get('eyebrow')  or {}).get(k),
                'headline':      (hero.get('headline') or {}).get(k),
                'sub':           (hero.get('sub')      or {}).get(k),
                'cta_primary':   ((hero.get('ctaPrimary')   or {}).get('label') or {}).get(k),
                'cta_secondary': ((hero.get('ctaSecondary') or {}).get('label') or {}).get(k),
                'video_kicker':  ((hero.get('videoLabel') or {}).get('kicker') or {}).get(k),
                'video_title':   ((hero.get('videoLabel') or {}).get('title')  or {}).get(k),
                'scroll_label':  (hero.get('scrollLabel') or {}).get(k),
            } for k in LOCALES},
        },
        {
            'background_image_url': hero.get('backgroundImage'),
            'cta_primary_href':     (hero.get('ctaPrimary')   or {}).get('href'),
            'cta_secondary_href':   (hero.get('ctaSecondary') or {}).get('href'),
        },
    ))

    # ── 2. value_props (Services) ────────────────────────────────
    svc = home.get('services') or {}
    pillars = [{
        'id': it.get('id'), 'icon': it.get('icon'), 'href': it.get('href'),
        'title': _locale_bag(it.get('title') or {}),
        'body':  _locale_bag(it.get('body')  or {}),
    } for it in (svc.get('items') or [])]
    sections.append((
        'value_props',
        {
            '_default': {
                'section_kicker': (svc.get('kicker') or {}).get('it'),
                'section_title':  (svc.get('title')  or {}).get('it'),
                'more_label':     (svc.get('moreLabel') or {}).get('it'),
                'pillars': pillars,
            },
            **{LOCALE_MAP.get(k, k): {
                'section_kicker': (svc.get('kicker')    or {}).get(k),
                'section_title':  (svc.get('title')     or {}).get(k),
                'more_label':     (svc.get('moreLabel') or {}).get(k),
            } for k in LOCALES},
        },
        {'pillars': pillars},
    ))

    # ── 3. stats_band ────────────────────────────────────────────
    st = home.get('stats') or {}
    stats_items = [{
        'id': it.get('id'), 'value': it.get('value'),
        'label': _locale_bag(it.get('label') or {}),
    } for it in (st.get('items') or [])]
    sections.append((
        'stats_band',
        {
            '_default': {
                'section_kicker': (st.get('kicker') or {}).get('it'),
                'section_title':  (st.get('title')  or {}).get('it'),
                'stats': stats_items,
            },
            **{LOCALE_MAP.get(k, k): {
                'section_kicker': (st.get('kicker') or {}).get(k),
                'section_title':  (st.get('title')  or {}).get(k),
            } for k in LOCALES},
        },
        {'stats': stats_items},
    ))

    # ── 4. projects_preview ──────────────────────────────────────
    pi = home.get('projectsInspire') or {}
    proj_items = [{
        'id': it.get('id'), 'slug': it.get('slug'), 'image_url': it.get('image'),
        'category': _locale_bag(it.get('category') or {}),
        'location': _locale_bag(it.get('location') or {}),
    } for it in (pi.get('items') or [])]
    sections.append((
        'projects_preview',
        {
            '_default': {
                'section_kicker': (pi.get('kicker') or {}).get('it'),
                'section_title':  (pi.get('title')  or {}).get('it'),
                'cta_label':      (pi.get('ctaLabel') or {}).get('it'),
                'cta_href':       pi.get('ctaHref') or '/projects',
                'more_label':     (pi.get('moreLabel') or {}).get('it'),
                'items': proj_items,
            },
            **{LOCALE_MAP.get(k, k): {
                'section_kicker': (pi.get('kicker')    or {}).get(k),
                'section_title':  (pi.get('title')     or {}).get(k),
                'cta_label':      (pi.get('ctaLabel')  or {}).get(k),
                'more_label':     (pi.get('moreLabel') or {}).get(k),
            } for k in LOCALES},
        },
        {'items': proj_items, 'cta_href': pi.get('ctaHref') or '/projects'},
    ))

    # ── 5. magazine_grid ─────────────────────────────────────────
    mg = home.get('magazine') or {}
    mag_items = [{
        'id': it.get('id'), 'slug': it.get('slug'), 'image_url': it.get('image'),
        'category': _locale_bag(it.get('category') or {}),
        'title':    _locale_bag(it.get('title')    or {}),
    } for it in (mg.get('items') or [])]
    sections.append((
        'magazine_grid',
        {
            '_default': {
                'section_kicker': (mg.get('kicker')   or {}).get('it'),
                'section_title':  (mg.get('title')    or {}).get('it'),
                'cta_label':      (mg.get('ctaLabel') or {}).get('it'),
                'cta_href':       mg.get('ctaHref') or '/magazine',
                'read_label':     (mg.get('readLabel') or {}).get('it'),
                'articles': mag_items,
            },
            **{LOCALE_MAP.get(k, k): {
                'section_kicker': (mg.get('kicker')    or {}).get(k),
                'section_title':  (mg.get('title')     or {}).get(k),
                'cta_label':      (mg.get('ctaLabel')  or {}).get(k),
                'read_label':     (mg.get('readLabel') or {}).get(k),
            } for k in LOCALES},
        },
        {'articles': mag_items, 'cta_href': mg.get('ctaHref') or '/magazine'},
    ))

    # ── 6. brand_logos ───────────────────────────────────────────
    bl = home.get('brandLogos') or {}
    logos = [{
        'id': it.get('id'), 'wordmark': it.get('wordmark'), 'href': it.get('href'),
    } for it in (bl.get('items') or [])]
    sections.append((
        'brand_logos',
        {
            '_default': {
                'section_kicker': (bl.get('kicker') or {}).get('it'),
                'logos': logos,
            },
            **{LOCALE_MAP.get(k, k): {
                'section_kicker': (bl.get('kicker') or {}).get(k),
            } for k in LOCALES},
        },
        {'logos': logos},
    ))

    return sections


def build_projects_sections(proj):
    sections = []
    categories = proj.get('categories') or []
    items = proj.get('items') or []
    # 1. projects_hero — minimal placeholder content
    sections.append((
        'projects_hero',
        {
            'it':    {'eyebrow': 'ARCHIVIO PROGETTI', 'title': 'Progetti che ispirano', 'sub': 'Una selezione di lavori che raccontano la nostra visione editoriale.'},
            'en-US': {'eyebrow': 'PROJECT ARCHIVE',  'title': 'Projects that inspire', 'sub': 'A selection of work telling our editorial vision.'},
            'en-GB': {'eyebrow': 'PROJECT ARCHIVE',  'title': 'Projects that inspire', 'sub': 'A selection of work telling our editorial vision.'},
            'fr':    {'eyebrow': 'ARCHIVE PROJETS',  'title': 'Projets qui inspirent', 'sub': 'Une sélection de réalisations.'},
            'de':    {'eyebrow': 'PROJEKTARCHIV',    'title': 'Projekte, die inspirieren', 'sub': 'Eine Auswahl unserer Arbeiten.'},
            'es':    {'eyebrow': 'ARCHIVO DE PROYECTOS', 'title': 'Proyectos que inspiran', 'sub': 'Una selección de trabajos.'},
        },
        {},
    ))
    # 2. projects_filters
    cats_normalized = [{
        'slug':  c.get('slug') if isinstance(c, dict) else None,
        'label': _locale_bag(c.get('label') or {}) if isinstance(c, dict) else None,
    } for c in categories]
    sections.append((
        'projects_filters',
        {
            '_default': {'categories': cats_normalized},
            'it':    {'all_label': 'TUTTI'},
            'en-US': {'all_label': 'ALL'},
            'en-GB': {'all_label': 'ALL'},
            'fr':    {'all_label': 'TOUS'},
            'de':    {'all_label': 'ALLE'},
            'es':    {'all_label': 'TODOS'},
        },
        {'categories': cats_normalized},
    ))
    # 3. projects_collection
    items_normalized = []
    for p in items:
        if not isinstance(p, dict):
            continue
        items_normalized.append({
            'slug':       p.get('slug'),
            'title':      _locale_bag(p.get('title') or {}),
            'location':   _locale_bag(p.get('location') or {}),
            'year':       p.get('year'),
            'category':   p.get('category'),
            'cover_url':  p.get('cover'),
            'lead':       _locale_bag(p.get('lead') or {}),
        })
    sections.append((
        'projects_collection',
        {'_default': {'projects': items_normalized}},
        {'projects': items_normalized},
    ))
    return sections


def build_simple_page_sections(page_key, content):
    """For start_project, professionals, ui — store the legacy config as a single
    all-encompassing section so the editor can iteratively decompose it later.
    """
    type_map = {
        'start_project': 'wizard_intro',
        'professionals': 'pro_hero',
        'ui':            'shared_ui_labels',
    }
    section_type = type_map.get(page_key, 'shared_ui_labels')
    normalized = _deep_locale_normalize(content)
    return [(
        section_type,
        {'_default': normalized},
        {'raw_legacy_content': normalized},
    )]


def build_navigation_sections(nav):
    """Build dedicated nav_top + footer_columns sections from navigation.js."""
    sections = []

    # ── nav_top — header
    brand = nav.get('brand') or {}
    header = nav.get('header') or {}
    header_links_normalized = []
    for it in (header.get('links') or []):
        if not isinstance(it, dict): continue
        header_links_normalized.append({
            'id':         it.get('id'),
            'href':       it.get('href'),
            'label':      _locale_bag(it.get('label') or {}),
            'open_in_new_tab': bool(it.get('open_in_new_tab', False)),
            'visible':    True,
            'show_on_mobile': True,
            'show_on_desktop': True,
            'is_cta':     False,
        })
    access = header.get('access') or {}
    sections.append((
        'nav_top',
        {
            '_default': {
                'logo_src':    brand.get('logoSrc') or '/brand/mood-for-design-mark.png',
                'logo_size':   104,
                'links':       header_links_normalized,
                'access_href': access.get('href') or '/auth/login',
            },
            **{LOCALE_MAP.get(k, k): {
                'access_label': access.get('label', {}).get(k),
            } for k in ['it', 'en', 'fr', 'de', 'es']},
        },
        {
            'logo_src':    brand.get('logoSrc') or '/brand/mood-for-design-mark.png',
            'logo_size':   104,
            'links':       header_links_normalized,
            'access_href': access.get('href') or '/auth/login',
        },
    ))

    # ── footer_columns — footer
    footer = nav.get('footer') or {}
    columns_normalized = []
    for col in (footer.get('columns') or []):
        if not isinstance(col, dict): continue
        col_links = []
        for ln in (col.get('links') or []):
            if not isinstance(ln, dict): continue
            col_links.append({
                'href':  ln.get('href'),
                'label': _locale_bag(ln.get('label') or {}),
                'open_in_new_tab': bool(ln.get('open_in_new_tab', False)),
                'visible': True,
            })
        columns_normalized.append({
            'id':      col.get('id'),
            'title':   _locale_bag(col.get('title') or {}),
            'links':   col_links,
            'visible': True,
        })

    socials_normalized = []
    for s in (footer.get('socials') or []):
        if not isinstance(s, dict): continue
        socials_normalized.append({
            'id':    s.get('id'),
            'href':  s.get('href'),
            'icon':  s.get('icon'),
            'label': s.get('label'),
            'visible': True,
        })

    showroom = footer.get('showroom') or {}
    book_cta = showroom.get('bookCta') or {}

    sections.append((
        'footer_columns',
        {
            '_default': {
                'columns':           columns_normalized,
                'socials':           socials_normalized,
                'showroom_address_lines': showroom.get('addressLines') or [],
                'book_cta_href':     book_cta.get('href'),
            },
            **{LOCALE_MAP.get(k, k): {
                'tagline':           footer.get('tagline', {}).get(k),
                'showroom_title':    showroom.get('title', {}).get(k),
                'book_cta_label':    book_cta.get('label', {}).get(k),
                'copyright':         footer.get('copyright', {}).get(k),
            } for k in ['it', 'en', 'fr', 'de', 'es']},
        },
        {
            'columns':           columns_normalized,
            'socials':           socials_normalized,
            'showroom_address_lines': showroom.get('addressLines') or [],
            'book_cta_href':     book_cta.get('href'),
        },
    ))

    return sections


PAGE_BUILDERS = {
    'home':           build_home_sections,
    'projects':       build_projects_sections,
    'start_project':  lambda c: build_simple_page_sections('start_project', c),
    'professionals':  lambda c: build_simple_page_sections('professionals', c),
    'navigation':     build_navigation_sections,
    'ui':             lambda c: build_simple_page_sections('ui', c),
}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--tenant', required=True, help='Tenant slug (e.g. mood-demo-studio-81a09e)')
    p.add_argument('--keep-existing', action='store_true',
                   help='Do not purge existing sections before re-seeding')
    p.add_argument('--dump-source', default='/tmp/site_dump.json',
                   help='Path to the dumped JSON from dump_site_content.mjs')
    args = p.parse_args()

    if not os.path.exists(args.dump_source):
        print(f'⚠ Dump file not found: {args.dump_source}')
        print('  Run first:  cd /tmp/sitecontent && node dump.mjs > /tmp/site_dump.json')
        sys.exit(1)

    with open(args.dump_source) as f:
        dump = json.load(f)

    client = db()
    t = client.table('tenants').select('id, slug, name').eq('slug', args.tenant).limit(1).execute()
    if not t.data:
        print(f'❌ Tenant slug not found: {args.tenant}')
        sys.exit(2)
    tenant_id = t.data[0]['id']
    print(f'→ Seeding tenant: {t.data[0]["name"]} ({tenant_id})')

    for page_key, content in dump.items():
        if page_key not in PAGE_BUILDERS:
            print(f'  · skip {page_key} (no builder)')
            continue
        page = _ensure_page(client, tenant_id, page_key)
        if not args.keep_existing:
            _purge_sections(client, tenant_id, page['id'])
        sections = PAGE_BUILDERS[page_key](content)
        for idx, (stype, locale_content, settings) in enumerate(sections):
            _create_section(client, tenant_id, page['id'], stype, idx * 10, locale_content, settings)
        print(f'  ✓ {page_key:<16} {len(sections)} section(s)')

    print('✓ Seed complete')


if __name__ == '__main__':
    main()
