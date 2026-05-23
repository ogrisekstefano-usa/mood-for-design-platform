"""Seed the 4 nav.* keys that the topbar/sidebar emit (MISS in overlay)."""
import json
from pathlib import Path

LOCALES_DIR = Path('/app/frontend/src/i18n/strings')

NAV = {
    'it-IT': {
        'dashboard':           'Dashboard',
        'workspace_switcher':  'Spazio di lavoro',
        'new_journey':         'Nuovo Journey',
        'section': { 'studio_pulse': 'Studio Pulse™' },
    },
    'en-US': {
        'dashboard':           'Dashboard',
        'workspace_switcher':  'Workspace',
        'new_journey':         'New Journey',
        'section': { 'studio_pulse': 'Studio Pulse™' },
    },
    'en-GB': {
        'dashboard':           'Dashboard',
        'workspace_switcher':  'Workspace',
        'new_journey':         'New Journey',
        'section': { 'studio_pulse': 'Studio Pulse™' },
    },
    'fr-FR': {
        'dashboard':           'Tableau de bord',
        'workspace_switcher':  'Espace de travail',
        'new_journey':         'Nouveau Parcours',
        'section': { 'studio_pulse': 'Studio Pulse™' },
    },
    'de-DE': {
        'dashboard':           'Dashboard',
        'workspace_switcher':  'Arbeitsbereich',
        'new_journey':         'Neue Journey',
        'section': { 'studio_pulse': 'Studio Pulse™' },
    },
    'es-ES': {
        'dashboard':           'Panel',
        'workspace_switcher':  'Espacio de trabajo',
        'new_journey':         'Nuevo Journey',
        'section': { 'studio_pulse': 'Studio Pulse™' },
    },
    'ar': {
        'dashboard':           'لوحة التحكّم',
        'workspace_switcher':  'مساحة العمل',
        'new_journey':         'رحلة جديدة',
        'section': { 'studio_pulse': 'Studio Pulse™' },
    },
}

FILES = ['it-IT.json','en-US.json','en-GB.json','fr-FR.json','de-DE.json','es-ES.json','ar.json']

def deep_merge(a, b):
    out = dict(a)
    for k, v in b.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out

for f in FILES:
    loc = f.replace('.json','')
    p = LOCALES_DIR / f
    cur = json.loads(p.read_text(encoding='utf-8'))
    nav = cur.get('nav', {})
    nav = deep_merge(nav, NAV[loc])
    cur['nav'] = nav
    p.write_text(json.dumps(cur, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'  {loc} → nav.* seeded')

print('✅ nav.* MISS keys closed.')
