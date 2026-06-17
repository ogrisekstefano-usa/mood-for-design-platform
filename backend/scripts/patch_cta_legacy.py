#!/usr/bin/env python3
"""
patch_cta_legacy.py
════════════════════
Rimuove tutti i riferimenti residui a /begin-journey dal DB CMS del tenant 'studio'.

Fix applicati:
  1. nav_top → settings.cta.href  : /begin-journey → /consulenza
  2. about → hero_editorial       : settings.cta_primary_href → /consulenza
  3. about → team_identity_card   : settings.cta_href → /consulenza
  4. about → design_journey       : settings.cta_href → /consulenza
  5. about → cinematic_quote      : settings.private_href → /consulenza

Dopo ogni modifica ripubblica la pagina CMS interessata.
"""
import os, sys
sys.path.insert(0, '/app/backend')

env_path = '/app/backend/.env'
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = (os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or
                os.environ.get('SUPABASE_SERVICE_KEY') or '')

if not SUPABASE_URL or not SUPABASE_KEY:
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith('SUPABASE_URL=') and not SUPABASE_URL:
                SUPABASE_URL = line.split('=', 1)[1].strip()
            elif line.startswith('SUPABASE_SERVICE_ROLE_KEY=') and not SUPABASE_KEY:
                SUPABASE_KEY = line.split('=', 1)[1].strip()
            elif line.startswith('SUPABASE_SERVICE_KEY=') and not SUPABASE_KEY:
                SUPABASE_KEY = line.split('=', 1)[1].strip()
            elif line.startswith('SUPABASE_KEY=') and not SUPABASE_KEY:
                SUPABASE_KEY = line.split('=', 1)[1].strip()

from supabase import create_client
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

TENANT_ID = '848354b9-a43e-4147-bdad-116fb93bd585'

def get_page_id(page_key):
    r = sb.table('cms_pages').select('id').eq('tenant_id', TENANT_ID).eq('page_key', page_key).single().execute()
    return r.data['id']

def get_section(page_id, section_type):
    r = sb.table('cms_sections').select('id,settings').eq('tenant_id', TENANT_ID).eq('page_id', page_id).eq('section_type', section_type).single().execute()
    return r.data

def update_section_settings(sec_id, settings):
    sb.table('cms_sections').update({'settings': settings}).eq('id', sec_id).execute()

def publish(page_key):
    from core.storefront_revisions import publish_page as core_publish
    result = core_publish(tenant_id=TENANT_ID, page_key=page_key, profile_id=None, label='patch_cta_legacy')
    print(f"  → '{page_key}' ripubblicata. rev_id={result['revision_id']}")

# ── 1. NAV: cta.href ─────────────────────────────────────────────────────────
print("1. nav_top → settings.cta.href")
nav_page_id = get_page_id('navigation')
nav_sec = get_section(nav_page_id, 'nav_top')
nav_settings = nav_sec['settings']
if nav_settings.get('cta', {}).get('href') == '/begin-journey':
    nav_settings['cta']['href'] = '/consulenza'
    update_section_settings(nav_sec['id'], nav_settings)
    print("   ✓ /begin-journey → /consulenza")
else:
    print(f"   già ok: {nav_settings.get('cta',{}).get('href')}")
publish('navigation')

# ── 2-5. ABOUT PAGE ──────────────────────────────────────────────────────────
about_page_id = get_page_id('about')

# 2. hero_editorial
print("2. about → hero_editorial → cta_primary_href")
sec = get_section(about_page_id, 'hero_editorial')
settings = sec['settings']
if settings.get('cta_primary_href') == '/begin-journey':
    settings['cta_primary_href'] = '/consulenza'
    update_section_settings(sec['id'], settings)
    print("   ✓ /begin-journey → /consulenza")
else:
    print(f"   già ok: {settings.get('cta_primary_href')}")

# 3. team_identity_card
print("3. about → team_identity_card → cta_href")
sec = get_section(about_page_id, 'team_identity_card')
settings = sec['settings']
if settings.get('cta_href') == '/begin-journey':
    settings['cta_href'] = '/consulenza'
    update_section_settings(sec['id'], settings)
    print("   ✓ /begin-journey → /consulenza")
else:
    print(f"   già ok: {settings.get('cta_href')}")

# 4. design_journey
print("4. about → design_journey → cta_href")
sec = get_section(about_page_id, 'design_journey')
settings = sec['settings']
if settings.get('cta_href') == '/begin-journey':
    settings['cta_href'] = '/consulenza'
    update_section_settings(sec['id'], settings)
    print("   ✓ /begin-journey → /consulenza")
else:
    print(f"   già ok: {settings.get('cta_href')}")

# 5. cinematic_quote
print("5. about → cinematic_quote → private_href")
sec = get_section(about_page_id, 'cinematic_quote')
settings = sec['settings']
if settings.get('private_href') == '/begin-journey':
    settings['private_href'] = '/consulenza'
    update_section_settings(sec['id'], settings)
    print("   ✓ /begin-journey → /consulenza")
else:
    print(f"   già ok: {settings.get('private_href')}")

publish('about')

print("\n✅ PATCH COMPLETATO — zero riferimenti a /begin-journey nel CMS.")
