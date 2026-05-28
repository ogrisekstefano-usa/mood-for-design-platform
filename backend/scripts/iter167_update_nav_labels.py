"""
ITER167 · Access Continuity™ — Public Navigation Label Refresh.

Updates the cms_pages.navigation `login_label` and `cta` for every tenant:
  · login_label: "Accedi" / "Sign in" → "Rientra" / "Re-enter"
  · cta:          "Inizia il tuo viaggio" / "Begin your journey"
                  → "Inizia il tuo Design Journey™" / "Begin your Design Journey™"

Idempotent: only rewrites legacy values. Safe to run multiple times.

Usage (from /app):
    python backend/scripts/iter167_update_nav_labels.py
"""
import os
import sys
import json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import db, db_available

LEGACY_LOGIN_LABELS = {
    'it': {'accedi', 'entra nel tuo spazio', 'login'},
    'en': {'sign in', 'login', 'enter your space'},
    'fr': {'accéder', 'connexion'},
    'de': {'anmelden'},
    'es': {'acceder'},
}
NEW_LOGIN_LABELS = {
    'it': 'Rientra',
    'en': 'Re-enter',
    'fr': 'Revenir',
    'de': 'Wiedereintreten',
    'es': 'Volver',
}

LEGACY_CTA_LABELS = {
    'it': {'inizia il tuo viaggio', 'inizia il tuo viaggio™', 'begin your journey'},
    'en': {'begin your journey', 'begin your journey™', 'start your journey'},
}
NEW_CTA_LABELS = {
    'it': 'Inizia il tuo Design Journey™',
    'en': 'Begin your Design Journey™',
    'fr': 'Commencez votre Design Journey™',
    'de': 'Starten Sie Ihre Design Journey™',
    'es': 'Comienza tu Design Journey™',
}


def _is_legacy(value, registry):
    if not value:
        return True
    if isinstance(value, str):
        return value.strip().lower() in {v for s in registry.values() for v in s}
    if isinstance(value, dict):
        for k, v in value.items():
            if not isinstance(v, str):
                continue
            allowed = registry.get(k, set())
            if v.strip().lower() in allowed:
                return True
    return False


def _build_label(new_map):
    return dict(new_map)


def main():
    if not db_available():
        print('[iter167] database unavailable — abort.')
        sys.exit(1)

    client = db()
    rows = client.table('cms_pages').select('*').eq('page_key', 'navigation').execute()
    if not rows.data:
        print('[iter167] no navigation rows found.')
        return

    updated = 0
    for row in rows.data:
        cfg = row.get('content') or {}
        nav = cfg.get('public_nav') if isinstance(cfg, dict) else None
        if not isinstance(nav, dict):
            # try nested cms_pages.content shape (varies by tenant seed)
            nav = cfg.get('navigation') if isinstance(cfg, dict) else None
        if not isinstance(nav, dict):
            continue

        changed = False
        # login_label
        if _is_legacy(nav.get('login_label'), LEGACY_LOGIN_LABELS):
            nav['login_label'] = _build_label(NEW_LOGIN_LABELS)
            changed = True
        # cta block — may live at cfg.cta.label_i18n
        cta_block = cfg.get('cta') if isinstance(cfg, dict) else None
        if isinstance(cta_block, dict):
            lbl = cta_block.get('label_i18n') or cta_block.get('label')
            if _is_legacy(lbl, LEGACY_CTA_LABELS):
                cta_block['label_i18n'] = _build_label(NEW_CTA_LABELS)
                changed = True

        if changed:
            client.table('cms_pages').update({'content': cfg}).eq('id', row['id']).execute()
            updated += 1
            print(f"[iter167] updated tenant={row.get('tenant_id')}  page={row['id']}")

    print(f'[iter167] done — {updated} navigation row(s) refreshed.')


if __name__ == '__main__':
    main()
