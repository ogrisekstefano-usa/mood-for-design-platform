"""
ITER167 · Patch cms_pages navigation page → nav_top section settings.

The /api/storefront/public/{tenant}/pages/navigation response shows
that `settings.cta.label_i18n` and `settings.login.label_i18n` store
the legacy "Inizia il tuo viaggio" / "Accedi" copy.

This script rewrites them to:
  · cta   → "Inizia il tuo Design Journey™" / "Begin your Design Journey™"
  · login → "Rientra" / "Re-enter"

It walks both `draft_json` AND `published_json` to keep the published
revision and the editing copy in sync.

Idempotent — only rewrites when current value matches a legacy term.
"""
import os
import sys
import json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database import db, db_available


LEGACY_LOGIN = {'accedi', 'login', 'sign in', 'entra nel tuo spazio'}
LEGACY_CTA   = {'inizia il tuo viaggio', 'begin your journey', 'begin your journey™'}

NEW_LOGIN_I18N = {
    'it-IT':    'Rientra',
    'en-US':    'Re-enter',
    '_default': 'Re-enter',
}
NEW_CTA_I18N = {
    'it-IT':    'Inizia il tuo Design Journey™',
    'en-US':    'Begin your Design Journey™',
    '_default': 'Begin your Design Journey™',
}


def _patch_label_i18n(block, banned, new_map):
    """Mutate block.label_i18n if any locale entry is a legacy banned value."""
    if not isinstance(block, dict):
        return False
    i18n = block.get('label_i18n')
    if not isinstance(i18n, dict):
        return False
    hit = any(
        isinstance(v, str) and v.strip().lower() in banned
        for v in i18n.values()
    )
    if not hit:
        return False
    block['label_i18n'] = dict(new_map)
    return True


def _walk_sections(page_obj):
    """Return the first nav_top section dict (or None)."""
    if not isinstance(page_obj, dict):
        return None
    sections = page_obj.get('sections') or []
    for s in sections:
        if s.get('section_type') == 'nav_top':
            return s
    return None


def main():
    if not db_available():
        print('[iter167] database unavailable — abort.')
        sys.exit(1)
    client = db()

    # ── 1. Update live cms_sections.nav_top settings ─────────────────────
    sections = client.table('cms_sections').select(
        'id, tenant_id, page_id, settings'
    ).eq('section_type', 'nav_top').execute()

    updated = 0
    page_ids_touched = set()
    for sec in sections.data or []:
        page_ids_touched.add(sec.get('page_id'))
        settings = sec.get('settings') or {}
        changed = False
        if _patch_label_i18n(settings.get('login'), LEGACY_LOGIN, NEW_LOGIN_I18N):
            changed = True
        if _patch_label_i18n(settings.get('cta'),   LEGACY_CTA,   NEW_CTA_I18N):
            changed = True
        if changed:
            client.table('cms_sections').update({'settings': settings}).eq('id', sec['id']).execute()
            updated += 1
            print(f"[iter167] patched live nav_top section={sec['id']}")

    # ── 2. Re-freeze the published_revision snapshot — public endpoint
    #    serves THAT, not the live cms_sections rows. We walk every page
    #    whose nav_top section was touched (or all nav pages) and update
    #    the snapshot's `sections[*].settings` accordingly.
    for page_id in page_ids_touched:
        page = (client.table('cms_pages').select(
            'id, published_revision_id'
        ).eq('id', page_id).limit(1).execute())
        if not page.data:
            continue
        rev_id = page.data[0].get('published_revision_id')
        if not rev_id:
            continue
        rev = (client.table('cms_page_revisions').select('snapshot')
               .eq('id', rev_id).limit(1).execute())
        if not rev.data:
            continue
        snap = rev.data[0].get('snapshot') or {}
        secs = snap.get('sections') or []
        snap_changed = False
        for s in secs:
            if s.get('section_type') != 'nav_top':
                continue
            settings = s.get('settings') or {}
            if _patch_label_i18n(settings.get('login'), LEGACY_LOGIN, NEW_LOGIN_I18N):
                snap_changed = True
            if _patch_label_i18n(settings.get('cta'),   LEGACY_CTA,   NEW_CTA_I18N):
                snap_changed = True
            s['settings'] = settings
        if snap_changed:
            client.table('cms_page_revisions').update({'snapshot': snap}).eq('id', rev_id).execute()
            print(f"[iter167] re-froze snapshot rev={rev_id} page={page_id}")

    print(f'[iter167] done — sections refreshed and snapshots synced.')


if __name__ == '__main__':
    main()
