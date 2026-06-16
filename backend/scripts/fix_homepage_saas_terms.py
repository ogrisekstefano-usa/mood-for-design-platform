#!/usr/bin/env python3
"""
fix_homepage_saas_terms.py
Rimuove terminologia SaaS/MOOD dalla homepage pubblica.

Sezioni interessate:
  - hero_editorial: titolo, eyebrow, CTA primaria
  - cinematic_quote: titolo, quote
  - navigation (cms_pages): label CTA

Dopo le patch, pubblica la pagina home per aggiornare il snapshot live.
"""
import os
import sys
import json

sys.path.insert(0, '/app/backend')
from supabase import create_client

SUPABASE_URL = os.environ.get('SUPABASE_URL') or ''
SUPABASE_KEY = (os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or
               os.environ.get('SUPABASE_SERVICE_KEY') or
               os.environ.get('SUPABASE_KEY') or '')

if not SUPABASE_URL or not SUPABASE_KEY:
    # Fallback: legge da .env
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env')
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

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── 1. hero_editorial ──────────────────────────────────────────────────
HERO_ID = 'd02e01c9-6713-4e09-8ed6-17d28d8e4531'

hero_locale_content_patch = {
    "_default": {
        "eyebrow": "INTERIOR DESIGN STUDIO"
    },
    "it": {
        "eyebrow": "STUDIO DI INTERIOR DESIGN",
        "title": "Il tuo spazio.\nIl tuo progetto.",
        "sub": "Progettiamo ambienti che raccontano la tua storia. "
               "Un approccio su misura, dalla visione all'esecuzione.",
        "cta_primary": "Inizia il tuo progetto",
        "cta_secondary": "Per i professionisti"
    },
    "en": {
        "eyebrow": "INTERIOR DESIGN STUDIO",
        "title": "Your space.\nYour vision.",
        "sub": "We design environments that tell your story. "
               "A tailor-made approach, from vision to execution.",
        "cta_primary": "Begin your project",
        "cta_secondary": "For professionals"
    },
    "en-US": {
        "eyebrow": "INTERIOR DESIGN STUDIO",
        "title": "Your space.\nYour vision.",
        "sub": "We design environments that tell your story. "
               "A tailor-made approach, from vision to execution.",
        "cta_primary": "Begin your project",
        "cta_secondary": "For professionals"
    }
}

# Fetch existing to merge carefully (keep image + other locale keys intact)
existing = supabase.table('cms_sections').select('locale_content').eq('id', HERO_ID).single().execute()
existing_lc = existing.data.get('locale_content', {}) if existing.data else {}
# Merge patch over existing
for loc, vals in hero_locale_content_patch.items():
    if loc not in existing_lc:
        existing_lc[loc] = {}
    existing_lc[loc].update(vals)

res = supabase.table('cms_sections').update({'locale_content': existing_lc}).eq('id', HERO_ID).execute()
print(f"hero_editorial patch: {len(res.data)} rows updated")

# ── 2. cinematic_quote ─────────────────────────────────────────────────
CQ_ID = '049428ad-16bf-4611-8b31-a09e640be62e'

cq_patch = supabase.table('cms_sections').select('locale_content').eq('id', CQ_ID).single().execute()
cq_lc = cq_patch.data.get('locale_content', {}) if cq_patch.data else {}

cq_updates = {
    "_default": {"quote": "Pronti a trasformare il vostro spazio?"},
    "it": {
        "title": "Pronti a trasformare\nil vostro spazio?",
        "sub": "Raccontateci la vostra visione. Il nostro studio trasforma ogni spazio in un'opera su misura.",
        "private": "Inizia una conversazione con lo studio",
        "pro": "Collabora come professionista"
    },
    "en": {
        "title": "Ready to transform\nyour space?",
        "sub": "Tell us your vision. Our studio transforms every space into a bespoke work.",
        "private": "Start a conversation with the studio",
        "pro": "Collaborate as a professional"
    },
    "en-US": {
        "title": "Ready to transform\nyour space?",
        "sub": "Tell us your vision. Our studio transforms every space into a bespoke work.",
        "private": "Start a conversation with the studio",
        "pro": "Collaborate as a professional"
    }
}

for loc, vals in cq_updates.items():
    if loc not in cq_lc:
        cq_lc[loc] = {}
    cq_lc[loc].update(vals)

res2 = supabase.table('cms_sections').update({'locale_content': cq_lc}).eq('id', CQ_ID).execute()
print(f"cinematic_quote patch: {len(res2.data)} rows updated")

# ── 3. navigation CTA label ────────────────────────────────────────────
# Aggiorna la sezione nav_top nella pagina 'navigation'
nav_res = supabase.table('cms_sections').select('id, settings').eq('section_type', 'nav_top').execute()
if nav_res.data:
    for nav_sec in nav_res.data:
        sec_id = nav_sec['id']
        settings = nav_sec.get('settings', {}) or {}
        cta_obj = settings.get('cta', {}) or {}
        label_i18n = cta_obj.get('label_i18n', {}) or {}

        label_i18n['it-IT']   = 'Prenota una consulenza'
        label_i18n['en-US']   = 'Book a consultation'
        label_i18n['_default'] = 'Book a consultation'

        cta_obj['label_i18n'] = label_i18n
        settings['cta'] = cta_obj

        nav_upd = supabase.table('cms_sections').update({'settings': settings}).eq('id', sec_id).execute()
        print(f"nav_top CTA patch (id={sec_id}): {len(nav_upd.data)} rows updated")
else:
    print("nav_top section non trovata — skip")

# ── 4. Pubblica home e navigation ──────────────────────────────────────
import subprocess, sys

def publish_page(page_key):
    """Usa la funzione core di publish (storefront_revisions) per generare lo snapshot."""
    import importlib.util, sys as _sys
    # Aggiunge il backend al path se necessario
    if '/app/backend' not in _sys.path:
        _sys.path.insert(0, '/app/backend')

    # Trova il tenant_id dalla pagina
    page_res = supabase.table('cms_pages').select('id, tenant_id').eq('page_key', page_key).execute()
    if not page_res.data:
        print(f"Pagina '{page_key}' non trovata.")
        return
    page = page_res.data[0]
    tenant_id = page['tenant_id']

    # Carica la funzione core
    from core.storefront_revisions import publish_page as core_publish
    result = core_publish(
        tenant_id=tenant_id,
        page_key=page_key,
        profile_id=None,
        label='fix-homepage-saas-terms',
    )
    print(f"Pagina '{page_key}' pubblicata — {result.get('revision_id', 'ok')}")

publish_page('home')
publish_page('navigation')
print("Fatto.")
