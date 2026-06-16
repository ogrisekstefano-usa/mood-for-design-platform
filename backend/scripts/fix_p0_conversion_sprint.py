#!/usr/bin/env python3
"""
fix_p0_conversion_sprint.py
────────────────────────────
STUDIO IDENTITY & CONVERSION SPRINT — P0 Fixes

Operazioni:
  1. Footer: rimuove social MOOD, pulisce colophon_link
  2. Footer locale: aggiorna link "Inizia un progetto" → "Prenota una consulenza" → /consulenza
  3. hero_editorial: CTA primaria → "Prenota una consulenza" → /consulenza
  4. design_journey: CTA → "Scopri il processo" → /about (non tenta conversione, informativa)
  5. professionals_cta: CTA → "Prenota una consulenza" → /consulenza
  6. cinematic_quote: percorso privati → "Prenota una consulenza" → /consulenza
  7. Pubblica pagina home e navigation

Vincoli:
  - ZERO nuove tabelle
  - ZERO nuovi moduli
  - Solo patch CMS + publish
"""
import os, sys, json

sys.path.insert(0, '/app/backend')

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env')
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

def patch_section(sec_id, updates: dict, label: str):
    res = sb.table('cms_sections').update(updates).eq('id', sec_id).execute()
    ok = len(res.data) > 0
    print(f"  {'✓' if ok else '✗'} {label}")
    return ok

def merge_lc(sec_id, patches: dict):
    """Merge patches into existing locale_content."""
    existing = sb.table('cms_sections').select('locale_content').eq('id', sec_id).single().execute()
    lc = (existing.data or {}).get('locale_content') or {}
    for loc, vals in patches.items():
        if loc not in lc:
            lc[loc] = {}
        lc[loc].update(vals)
    return patch_section(sec_id, {'locale_content': lc}, f"locale_content patch ({sec_id[:8]})")

def merge_settings(sec_id, path_key, new_val, label: str):
    """Merge into settings dict at path_key."""
    existing = sb.table('cms_sections').select('settings').eq('id', sec_id).single().execute()
    settings = (existing.data or {}).get('settings') or {}
    # Support dot notation: 'links.cta_href'
    keys = path_key.split('.')
    d = settings
    for k in keys[:-1]:
        if k not in d:
            d[k] = {}
        d = d[k]
    d[keys[-1]] = new_val
    return patch_section(sec_id, {'settings': settings}, label)

# ─── IDs delle sezioni ──────────────────────────────────────────────────────
HERO_ID          = 'd02e01c9-6713-4e09-8ed6-17d28d8e4531'
DESIGN_JOURNEY_ID = '336615b1-4a01-5602-8634-903b98914edd'
PROFESSIONALS_ID  = '49b4b8d5-72e7-48de-866e-c784c8634c8d'
CINEMATIC_ID      = '049428ad-16bf-4611-8b31-a09e640be62e'
FOOTER_ID         = 'd839a470-c9ce-449d-bd5d-4e8a5a0e30db'

print("\n=== P0 FIX 1 — Footer social links (rimuove MOOD) ===")
existing_footer = sb.table('cms_sections').select('settings').eq('id', FOOTER_ID).single().execute()
footer_settings = (existing_footer.data or {}).get('settings') or {}
# Svuota i social link MOOD (li imposta come placeholder vuoti per il CMS admin)
footer_settings['social_links'] = [
    { 'href': '', 'kind': 'instagram', 'label': 'Instagram' },
    { 'href': '', 'kind': 'linkedin',  'label': 'LinkedIn'  },
]
# Rimuove il colophon MOOD
footer_settings['colophon_link']    = ''
footer_settings['colophon_enabled'] = False
patch_section(FOOTER_ID, {'settings': footer_settings}, 'footer social_links + colophon_link')

print("\n=== P0 FIX 2 — Footer locale: CTA 'Inizia un progetto' → 'Prenota una consulenza' ===")
existing_footer_lc = sb.table('cms_sections').select('locale_content').eq('id', FOOTER_ID).single().execute()
footer_lc = (existing_footer_lc.data or {}).get('locale_content') or {}
for lang in ['it', 'en', 'en-US']:
    cols = (footer_lc.get(lang) or {}).get('cols') or []
    for col in cols:
        for link in (col.get('links') or []):
            if '/begin-journey' in (link.get('href') or ''):
                link['href'] = '/consulenza'
            if 'Inizia un progetto' in (link.get('label') or ''):
                link['label'] = 'Prenota una consulenza'
    if cols:
        footer_lc[lang] = footer_lc.get(lang) or {}
        footer_lc[lang]['cols'] = cols
patch_section(FOOTER_ID, {'locale_content': footer_lc}, 'footer.cols CTA label + href')

print("\n=== P0 FIX 3 — hero_editorial: CTA primaria ===")
merge_lc(HERO_ID, {
    'it': {'cta_primary': 'Prenota una consulenza'},
    'en': {'cta_primary': 'Book a consultation'},
    'en-US': {'cta_primary': 'Book a consultation'},
})
# Update settings href
existing_hero = sb.table('cms_sections').select('settings').eq('id', HERO_ID).single().execute()
hero_settings = (existing_hero.data or {}).get('settings') or {}
hero_settings['cta_primary_href'] = '/consulenza'
patch_section(HERO_ID, {'settings': hero_settings}, 'hero_editorial cta_primary_href → /consulenza')

print("\n=== P0 FIX 4 — design_journey: CTA editoriale (non conversione) ===")
merge_lc(DESIGN_JOURNEY_ID, {
    'it': {'cta': 'Scopri il processo'},
    'en': {'cta': 'Discover the process'},
    'en-US': {'cta': 'Discover the process'},
})

print("\n=== P0 FIX 5 — professionals_cta: CTA → Prenota una consulenza ===")
merge_lc(PROFESSIONALS_ID, {
    'it': {'cta': 'Prenota una consulenza'},
    'en': {'cta': 'Book a consultation'},
    'en-US': {'cta': 'Book a consultation'},
})
existing_pro = sb.table('cms_sections').select('settings').eq('id', PROFESSIONALS_ID).single().execute()
pro_settings = (existing_pro.data or {}).get('settings') or {}
pro_settings['cta_href'] = '/consulenza'
patch_section(PROFESSIONALS_ID, {'settings': pro_settings}, 'professionals_cta cta_href → /consulenza')

print("\n=== P0 FIX 6 — cinematic_quote: percorso privati → /consulenza ===")
merge_lc(CINEMATIC_ID, {
    'it': {'private': 'Prenota una consulenza'},
    'en': {'private': 'Book a consultation'},
    'en-US': {'private': 'Book a consultation'},
})
existing_cq = sb.table('cms_sections').select('settings').eq('id', CINEMATIC_ID).single().execute()
cq_settings = (existing_cq.data or {}).get('settings') or {}
cq_settings['private_href'] = '/consulenza'
patch_section(CINEMATIC_ID, {'settings': cq_settings}, 'cinematic_quote private_href → /consulenza')

print("\n=== PUBLISH homepage ===")
from core.storefront_revisions import publish_page as core_publish
page_res = sb.table('cms_pages').select('tenant_id').eq('page_key', 'home').execute()
tenant_id = page_res.data[0]['tenant_id']
result = core_publish(tenant_id=tenant_id, page_key='home', profile_id=None, label='p0-conversion-sprint')
print(f"  ✓ home pubblicata")

print("\n=== FATTO ===")
