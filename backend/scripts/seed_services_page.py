#!/usr/bin/env python3
"""
seed_services_page.py
─────────────────────
Crea la pagina CMS 'services' per il tenant 'studio'.

Struttura (opzione C — tipologie + processo):
  1. hero_editorial      — Hero "I Nostri Servizi"
  2. editorial_triptych  — 4 tipologie (Residenziale, Hospitality, Contract, Retail)
  3. atmosphere_statement — Qualità del lavoro
  4. design_journey      — Processo (Ascolto, Concept, Progettazione, Realizzazione)
  5. cinematic_quote     — CTA finale

VINCOLO: ZERO nuove tabelle, ZERO nuovi section types.
"""
import os, sys

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

tenant_res = sb.table('tenants').select('id').eq('slug', 'studio').single().execute()
TENANT_ID = tenant_res.data['id']

page_res = sb.table('cms_pages').select('id').eq('tenant_id', TENANT_ID).eq('page_key', 'services').execute()
if page_res.data:
    PAGE_ID = page_res.data[0]['id']
    print(f"Pagina 'services' esistente: {PAGE_ID}")
else:
    new_page = sb.table('cms_pages').insert({
        'tenant_id': TENANT_ID,
        'page_key':  'services',
        'title':     'Servizi',
        'status':    'published',
    }).execute()
    PAGE_ID = new_page.data[0]['id']
    print(f"Pagina 'services' creata: {PAGE_ID}")

sb.table('cms_sections').delete().eq('page_id', PAGE_ID).eq('tenant_id', TENANT_ID).execute()
print("Sezioni precedenti rimosse.")

sections = [
    # 1. Hero
    {
        'tenant_id':    TENANT_ID,
        'page_id':      PAGE_ID,
        'section_type': 'hero_editorial',
        'sort_order':   10,
        'visible':      True,
        'settings':     { 'cta_primary_href': '/consulenza', 'cta_secondary_href': '/projects' },
        'locale_content': {
            '_default': { 'eyebrow': 'INTERIOR DESIGN' },
            'it': {
                'eyebrow':       'COSA PROGETTIAMO',
                'title':         'Dal concept\nalla consegna chiavi.',
                'sub':           'Progettiamo spazi residenziali, commerciali e contract con la stessa attenzione al dettaglio, alla qualità e alla relazione con il committente.',
                'cta_primary':   'Prenota una consulenza',
                'cta_secondary': 'Scopri i nostri progetti',
            },
            'en': {
                'eyebrow':       'WHAT WE DESIGN',
                'title':         'From concept\nto key handover.',
                'sub':           'We design residential, commercial and contract spaces with the same attention to detail, quality and client relationship.',
                'cta_primary':   'Book a consultation',
                'cta_secondary': 'Discover our projects',
            },
            'en-US': {
                'eyebrow':       'WHAT WE DESIGN',
                'title':         'From concept\nto key handover.',
                'sub':           'We design residential, commercial and contract spaces with the same attention to detail, quality and client relationship.',
                'cta_primary':   'Book a consultation',
                'cta_secondary': 'Discover our projects',
            },
        },
    },

    # 2. Triptych — 4 tipologie (nota: triptych può avere N blocchi)
    {
        'tenant_id':    TENANT_ID,
        'page_id':      PAGE_ID,
        'section_type': 'editorial_triptych',
        'sort_order':   20,
        'visible':      True,
        'settings':     {},
        'locale_content': {
            '_default': { 'eyebrow': 'TIPOLOGIE' },
            'it': {
                'eyebrow': 'AMBITI DI PROGETTO',
                'title':   'Quattro mondi.\nUna sola qualità.',
                'blocks': [
                    {
                        'id':    'res',
                        'title': 'Residenziale',
                        'body':  'Abitazioni private, ville, appartamenti di pregio. Ogni spazio racconta chi ci vive — dalla ristrutturazione integrale al restyling selettivo.',
                    },
                    {
                        'id':    'hosp',
                        'title': 'Hospitality',
                        'body':  'Hotel boutique, resort, residenze turistiche. Ambienti che offrono un\'esperienza memorabile dal check-in all\'ultima notte.',
                    },
                    {
                        'id':    'cont',
                        'title': 'Contract',
                        'body':  'Uffici direzionali, spazi corporate, retail. Progettazione efficiente, rispetto delle tempistiche e scalabilità su più sedi.',
                    },
                    {
                        'id':    'ret',
                        'title': 'Retail & Showroom',
                        'body':  'Concept store, showroom di brand, flagship store. Spazi che comunicano l\'identità del brand attraverso ogni superficie.',
                    },
                ],
            },
            'en': {
                'eyebrow': 'PROJECT AREAS',
                'title':   'Four worlds.\nOne standard.',
                'blocks': [
                    {
                        'id':    'res',
                        'title': 'Residential',
                        'body':  'Private homes, villas, luxury apartments. Every space tells the story of who lives there — from full renovation to selective restyling.',
                    },
                    {
                        'id':    'hosp',
                        'title': 'Hospitality',
                        'body':  'Boutique hotels, resorts, tourist residences. Environments that deliver a memorable experience from check-in to the last night.',
                    },
                    {
                        'id':    'cont',
                        'title': 'Contract',
                        'body':  'Executive offices, corporate spaces, retail. Efficient design, timeline compliance and scalability across multiple locations.',
                    },
                    {
                        'id':    'ret',
                        'title': 'Retail & Showroom',
                        'body':  "Concept stores, brand showrooms, flagship stores. Spaces that communicate brand identity through every surface.",
                    },
                ],
            },
        },
    },

    # 3. Atmosphere Statement — Qualità del metodo
    {
        'tenant_id':    TENANT_ID,
        'page_id':      PAGE_ID,
        'section_type': 'atmosphere_statement',
        'sort_order':   30,
        'visible':      True,
        'settings':     { 'cta_href': '/about', 'alignment': 'editorial-left' },
        'locale_content': {
            '_default': { 'eyebrow': 'IL NOSTRO APPROCCIO' },
            'it': {
                'eyebrow': 'IL NOSTRO APPROCCIO',
                'title':   'Non vendiamo soluzioni.\nAscoltiamo storie.',
                'body':    'Ogni progetto inizia con l\'ascolto. Non proponiamo mai un concept prima di capire chi abiterà lo spazio, come lo userà, cosa sente quando ci entra. Solo dopo inizia il progetto.',
                'cta':     'Chi siamo',
            },
            'en': {
                'eyebrow': 'OUR APPROACH',
                'title':   "We don't sell solutions.\nWe listen to stories.",
                'body':    'Every project begins with listening. We never propose a concept before understanding who will inhabit the space, how they will use it, what they feel when they enter it. Only then does the project begin.',
                'cta':     'About us',
            },
            'en-US': {
                'eyebrow': 'OUR APPROACH',
                'title':   "We don't sell solutions.\nWe listen to stories.",
                'body':    'Every project begins with listening. We never propose a concept before understanding who will inhabit the space, how they will use it, what they feel when they enter it. Only then does the project begin.',
                'cta':     'About us',
            },
        },
    },

    # 4. Design Journey — Processo (Ascolto, Concept, Progettazione, Realizzazione)
    {
        'tenant_id':    TENANT_ID,
        'page_id':      PAGE_ID,
        'section_type': 'design_journey',
        'sort_order':   40,
        'visible':      True,
        'settings': {
            'cta_href': '/consulenza',
            'steps': [
                {
                    'id': '01',
                    'title': { 'it': 'Ascolto',        'en': 'Listening' },
                    'body':  { 'it': 'Il primo incontro non serve a presentare lo studio. Serve a capire il committente, lo spazio, il tempo e il budget disponibile.',
                               'en': 'The first meeting is not about presenting the studio. It\'s about understanding the client, the space, the timeline and the available budget.' },
                },
                {
                    'id': '02',
                    'title': { 'it': 'Concept',        'en': 'Concept' },
                    'body':  { 'it': 'Sviluppiamo una visione progettuale coerente: moodboard, planimetrie, materiali e palette cromatica. Tutto discusso e condiviso prima di procedere.',
                               'en': 'We develop a coherent design vision: moodboard, floor plans, materials and color palette. Everything discussed and shared before proceeding.' },
                },
                {
                    'id': '03',
                    'title': { 'it': 'Progettazione',  'en': 'Design' },
                    'body':  { 'it': 'Tavole esecutive, abaco finiture, selezione fornitori. Ogni dettaglio è documentato e verificato prima dell\'avvio cantiere.',
                               'en': 'Executive drawings, material schedules, supplier selection. Every detail is documented and verified before construction begins.' },
                },
                {
                    'id': '04',
                    'title': { 'it': 'Realizzazione',  'en': 'Execution' },
                    'body':  { 'it': 'Direzione lavori e supervisione diretta. Seguiamo il cantiere fino alla consegna finale, garantendo che il progetto rimanga fedele alla visione.',
                               'en': 'Site management and direct supervision. We follow construction through to final handover, ensuring the project remains true to the vision.' },
                },
            ],
        },
        'locale_content': {
            '_default': { 'eyebrow': 'IL PROCESSO' },
            'it': {
                'eyebrow': 'COME LAVORIAMO',
                'title':   'Il processo\nprogettuale.',
                'cta':     'Prenota una consulenza',
            },
            'en': {
                'eyebrow': 'HOW WE WORK',
                'title':   'The design\nprocess.',
                'cta':     'Book a consultation',
            },
            'en-US': {
                'eyebrow': 'HOW WE WORK',
                'title':   'The design\nprocess.',
                'cta':     'Book a consultation',
            },
        },
    },

    # 5. CTA Finale
    {
        'tenant_id':    TENANT_ID,
        'page_id':      PAGE_ID,
        'section_type': 'cinematic_quote',
        'sort_order':   50,
        'visible':      True,
        'settings':     { 'private_href': '/consulenza', 'pro_href': '/projects' },
        'locale_content': {
            '_default': { 'quote': 'Hai uno spazio da trasformare?' },
            'it': {
                'title':   'Hai uno spazio\nda trasformare?',
                'sub':     'Parliamoci. Il primo incontro è sempre una conversazione, non una proposta.',
                'private': 'Prenota una consulenza',
                'pro':     'Scopri i nostri progetti',
            },
            'en': {
                'title':   'Do you have a space\nto transform?',
                'sub':     'Let\'s talk. The first meeting is always a conversation, not a proposal.',
                'private': 'Book a consultation',
                'pro':     'Discover our projects',
            },
            'en-US': {
                'title':   'Do you have a space\nto transform?',
                'sub':     'Let\'s talk. The first meeting is always a conversation, not a proposal.',
                'private': 'Book a consultation',
                'pro':     'Discover our projects',
            },
        },
    },
]

res = sb.table('cms_sections').insert(sections).execute()
print(f"{len(res.data)} sezioni inserite.")

from core.storefront_revisions import publish_page as core_publish
result = core_publish(tenant_id=TENANT_ID, page_key='services', profile_id=None, label='seed-services-page')
print("Pagina 'services' pubblicata.")
print("FATTO.")
