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
    """Map homepage.js → cms_sections rows for page_key='home'."""
    sections = []
    # 1. store_hero
    hero = home.get('hero') or {}
    sections.append((
        'store_hero',
        {
            '_default': {
                'background_image_url': hero.get('backgroundImage'),
                'atmosphere': 'cinematic',
            },
            **{LOCALE_MAP.get(k, k): {
                'headline':        hero.get('headline', {}).get(k),
                'sub':             hero.get('sub', {}).get(k),
                'overline':        hero.get('overline', {}).get(k),
                'overline_italic': hero.get('overlineItalic', {}).get(k),
            } for k in ['it', 'en', 'fr', 'de', 'es']},
        },
        {'background_image_url': hero.get('backgroundImage')},
    ))
    # 2. dual_cta
    dp = home.get('dualPath') or {}
    priv, pro = dp.get('private') or {}, dp.get('pro') or {}
    sections.append((
        'dual_cta',
        {
            '_default': {
                'client_cta_href': priv.get('href') or '/start-project',
                'pro_cta_href':    pro.get('href') or '/professionals',
                'client_image_url': priv.get('image'),
                'pro_image_url':    pro.get('image'),
            },
            **{LOCALE_MAP.get(k, k): {
                'client_kicker':  priv.get('kicker', {}).get(k),
                'client_title':   priv.get('title', {}).get(k),
                'client_body':    priv.get('body', {}).get(k),
                'client_cta_label': priv.get('cta', {}).get(k),
                'pro_kicker':     pro.get('kicker', {}).get(k),
                'pro_title':      pro.get('title', {}).get(k),
                'pro_body':       pro.get('body', {}).get(k),
                'pro_cta_label':  pro.get('cta', {}).get(k),
            } for k in ['it', 'en', 'fr', 'de', 'es']},
        },
        {
            'client_image_url': priv.get('image'),
            'pro_image_url':    pro.get('image'),
        },
    ))
    # 3. value_props
    vp = home.get('valueProps') or {}
    pillars_normalized = []
    for it in (vp.get('items') or []):
        pillars_normalized.append({
            'id':    it.get('id'),
            'icon':  it.get('icon'),
            'title': _locale_bag(it.get('title') or {}),
            'body':  _locale_bag(it.get('body') or {}),
        })
    sections.append((
        'value_props',
        {
            '_default': {
                'section_title': vp.get('title', {}).get('it'),
                'pillars': pillars_normalized,
            },
            **{LOCALE_MAP.get(k, k): {
                'section_title': vp.get('title', {}).get(k),
            } for k in ['it', 'en', 'fr', 'de', 'es']},
        },
        {'pillars': pillars_normalized},
    ))
    # 4. projects_preview
    pi = home.get('projectsInspire') or {}
    items_normalized = []
    for it in (pi.get('items') or []):
        items_normalized.append({
            'id':       it.get('id'),
            'slug':     it.get('slug'),
            'image_url':it.get('image'),
            'category': _locale_bag(it.get('category') or {}),
            'location': _locale_bag(it.get('location') or {}),
        })
    sections.append((
        'projects_preview',
        {
            '_default': {
                'section_title':  pi.get('title', {}).get('it'),
                'cta_href':       '/projects',
                'items':          items_normalized,
            },
            **{LOCALE_MAP.get(k, k): {
                'section_title': pi.get('title', {}).get(k),
            } for k in ['it', 'en', 'fr', 'de', 'es']},
        },
        {'items': items_normalized},
    ))
    # 5. newsletter
    nl = home.get('newsletter') or {}
    sections.append((
        'newsletter',
        {
            '_default': {
                'decor_image_url': nl.get('decorImage'),
            },
            **{LOCALE_MAP.get(k, k): {
                'title':       nl.get('title', {}).get(k),
                'body':        nl.get('body', {}).get(k),
                'placeholder': nl.get('placeholder', {}).get(k),
                'cta_label':   nl.get('submit', {}).get(k),
            } for k in ['it', 'en', 'fr', 'de', 'es']},
        },
        {'decor_image_url': nl.get('decorImage')},
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
    """For start_project, professionals, navigation, ui — store the legacy
    config as a single all-encompassing section (`page_content` in settings)
    so the editor can iteratively decompose it later.
    """
    type_map = {
        'start_project': 'wizard_intro',
        'professionals': 'pro_hero',
        'navigation':    'nav_top',
        'ui':            'shared_ui_labels',
    }
    section_type = type_map.get(page_key, 'shared_ui_labels')
    normalized = _deep_locale_normalize(content)
    return [(
        section_type,
        {'_default': normalized},
        {'raw_legacy_content': normalized},
    )]


PAGE_BUILDERS = {
    'home':           build_home_sections,
    'projects':       build_projects_sections,
    'start_project':  lambda c: build_simple_page_sections('start_project', c),
    'professionals':  lambda c: build_simple_page_sections('professionals', c),
    'navigation':     lambda c: build_simple_page_sections('navigation', c),
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
