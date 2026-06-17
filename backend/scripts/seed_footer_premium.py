#!/usr/bin/env python3
"""
seed_footer_premium.py
═══════════════════════
Crea la sezione footer CMS premium per il tenant 'studio'.

REGOLE APPLICATE:
  - Struttura completa con colonne di navigazione e sezione legale
  - NESSUN dato fittizio: nessun indirizzo, nessun telefono, nessuna email inventata
  - NESSUN recapito inventato: social senza handle specifici, solo icone tipo-link
  - Il footer dimostra la struttura CMS — i dati reali vengono inseriti dal tenant

Struttura footer:
  colonna 1: Brand + claim editoriale
  colonna 2: Naviga (links principali)
  colonna 3: Servizi (links tipologici)
  colonna 4: Info legali (privacy, cookie, termini)
  fondo: copyright + colophon CMS

Pubblica la pagina 'footer' dopo l'inserimento.
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

# ── Recupera page_id footer ───────────────────────────────────────────────────
page_res = sb.table('cms_pages').select('id').eq('tenant_id', TENANT_ID).eq('page_key', 'footer').single().execute()
PAGE_ID = page_res.data['id']
print(f"Footer page ID: {PAGE_ID}")

# ── Rimuovi sezione precedente ────────────────────────────────────────────────
sb.table('cms_sections').delete().eq('page_id', PAGE_ID).eq('tenant_id', TENANT_ID).execute()
print("Sezioni precedenti rimosse.")

# ── Nuovo contenuto footer ────────────────────────────────────────────────────
FOOTER_SETTINGS = {
    # ── Colonna brand ──────────────────────────────────────────────────────────
    'brand': {
        'show_logo': True,
        'claim': {
            'it': 'Interior design residenziale\ne hospitality di qualità.',
            'en': 'Residential interior design\nand quality hospitality.',
            '_default': 'Interior design.',
        },
    },

    # ── Colonne di navigazione ─────────────────────────────────────────────────
    'nav_cols': [
        {
            'id':      'col_studio',
            'heading': {'it': 'Studio', 'en': 'Studio', '_default': 'Studio'},
            'links': [
                {'id': 'fn_about',  'href': '/about',         'label': {'it': 'Chi siamo',        'en': 'About us',    '_default': 'About'}},
                {'id': 'fn_proj',   'href': '/projects',      'label': {'it': 'Progetti',          'en': 'Projects',    '_default': 'Projects'}},
                {'id': 'fn_serv',   'href': '/servizi',       'label': {'it': 'Servizi',           'en': 'Services',    '_default': 'Services'}},
                {'id': 'fn_pro',    'href': '/professionals', 'label': {'it': 'Professionisti',    'en': 'Professionals','_default': 'Professionals'}},
            ],
        },
        {
            'id':      'col_contenuti',
            'heading': {'it': 'Contenuti', 'en': 'Content', '_default': 'Content'},
            'links': [
                {'id': 'fn_mag',    'href': '/magazine',      'label': {'it': 'Magazine',          'en': 'Magazine',    '_default': 'Magazine'}},
                {'id': 'fn_cons',   'href': '/consulenza',    'label': {'it': 'Prenota consulenza','en': 'Book consultation','_default': 'Consultation'}},
            ],
        },
        {
            'id':      'col_legal',
            'heading': {'it': 'Legale', 'en': 'Legal', '_default': 'Legal'},
            'links': [
                {'id': 'fn_priv',   'href': '/privacy',       'label': {'it': 'Privacy Policy',   'en': 'Privacy Policy','_default': 'Privacy Policy'}},
                {'id': 'fn_cook',   'href': '/cookies',       'label': {'it': 'Cookie Policy',    'en': 'Cookie Policy', '_default': 'Cookie Policy'}},
                {'id': 'fn_terms',  'href': '/terms',         'label': {'it': 'Termini di servizio','en': 'Terms of service','_default': 'Terms'}},
            ],
        },
    ],

    # ── Colophon ───────────────────────────────────────────────────────────────
    'colophon': {
        'enabled': True,
        'copyright': {
            'it': '© {year} Studio. Tutti i diritti riservati.',
            'en': '© {year} Studio. All rights reserved.',
            '_default': '© {year} Studio.',
        },
        # Note: nessun indirizzo, telefono o email — dati reali inseribili dal tenant
        'center': {
            'it': 'Costruito con MOOD for DESIGN™',
            'en': 'Built with MOOD for DESIGN™',
            '_default': 'Built with MOOD for DESIGN™',
        },
        'center_link_href': 'https://www.moodfordesign.com',
    },

    # ── Social (struttura presente, handle vuoti — da compilare dal tenant) ─────
    'social': {
        'show':     True,
        'accounts': [
            # Gli handle sono intenzionalmente assenti: il tenant li compila dal pannello CMS
            {'platform': 'instagram', 'href': '', 'visible': True},
            {'platform': 'linkedin',  'href': '', 'visible': True},
            {'platform': 'pinterest', 'href': '', 'visible': False},
        ],
        'note': 'Social handles non configurati — inserire dal pannello CMS.',
    },
}

FOOTER_LOCALE_CONTENT = {
    'it': {
        'eyebrow': 'Studio',
        'brand_note': 'Interior design residenziale e hospitality.',
    },
    'en': {
        'eyebrow': 'Studio',
        'brand_note': 'Residential interior design and hospitality.',
    },
    '_default': {
        'eyebrow': 'Studio',
    },
}

# ── Inserisci nuova sezione footer ─────────────────────────────────────────────
res = sb.table('cms_sections').insert({
    'tenant_id':      TENANT_ID,
    'page_id':        PAGE_ID,
    'section_type':   'footer',
    'sort_order':     0,
    'visible':        True,
    'locale_content': FOOTER_LOCALE_CONTENT,
    'settings':       FOOTER_SETTINGS,
}).execute()
print(f"Sezione footer inserita: {res.data[0]['id']}")

# ── Pubblica la pagina ─────────────────────────────────────────────────────────
from core.storefront_revisions import publish_page as core_publish
result = core_publish(tenant_id=TENANT_ID, page_key='footer', profile_id=None, label='seed-footer-premium-no-fake-data')
print(f"Footer pubblicato. rev_id={result['revision_id']}")
print("\n✅ FATTO — footer premium configurato senza dati fittizi.")
print("   → Social handles da compilare dal pannello CMS tenant.")
