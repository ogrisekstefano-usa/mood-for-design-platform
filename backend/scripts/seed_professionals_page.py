#!/usr/bin/env python3
"""
seed_professionals_page.py
──────────────────────────
Crea (o ri-seeda) la pagina CMS 'professionals' per il tenant 'studio'.

Sezioni (riutilizza section types esistenti):
  1. hero_editorial      — Hero "La tua competenza, il nostro metodo."
  2. atmosphere_statement — Manifesto collaborazione
  3. editorial_triptych  — 3 vantaggi partnership
  4. design_journey      — Come inizia una collaborazione (4 step)
  5. professionals_cta   — CTA per tipo professionista
  6. cinematic_quote     — CTA finale

VINCOLO: ZERO nuove tabelle, ZERO nuovi section types.
"""
import os, sys, uuid

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

# ── Recupera tenant ─────────────────────────────────────────────────────────
tenant_res = sb.table('tenants').select('id').eq('slug', 'studio').single().execute()
TENANT_ID = tenant_res.data['id']

# ── Crea o aggiorna la pagina CMS ───────────────────────────────────────────
page_res = sb.table('cms_pages').select('id').eq('tenant_id', TENANT_ID).eq('page_key', 'professionals').execute()
if page_res.data:
    PAGE_ID = page_res.data[0]['id']
    print(f"Pagina 'professionals' esistente: {PAGE_ID}")
else:
    new_page = sb.table('cms_pages').insert({
        'tenant_id':   TENANT_ID,
        'page_key':    'professionals',
        'title':       'Per Professionisti',
        'description': 'Partnership e collaborazione con architetti, designer e professionisti del progetto.',
        'is_published': True,
    }).execute()
    PAGE_ID = new_page.data[0]['id']
    print(f"Pagina 'professionals' creata: {PAGE_ID}")

# ── Rimuovi sezioni precedenti ───────────────────────────────────────────────
sb.table('cms_sections').delete().eq('page_id', PAGE_ID).eq('tenant_id', TENANT_ID).execute()
print("Sezioni precedenti rimosse.")

# ── Sezioni da inserire ──────────────────────────────────────────────────────
sections = [
    # 1. Hero editoriale
    {
        'tenant_id':    TENANT_ID,
        'page_id':      PAGE_ID,
        'section_type': 'hero_editorial',
        'sort_order':   10,
        'visible':      True,
        'locale_content': {
            '_default': { 'eyebrow': 'PER PROFESSIONISTI' },
            'it': {
                'eyebrow':         'PER ARCHITETTI E DESIGNER',
                'title':           'La tua competenza,\nil nostro metodo.',
                'sub':             'Collaboriamo con professionisti del progetto per realizzare spazi che durano nel tempo. Porta il tuo progetto — noi portiamo la rete, la metodologia e la presenza operativa.',
                'cta_primary':     'Prenota una consulenza',
                'cta_secondary':   'Scopri i nostri progetti',
            },
            'en': {
                'eyebrow':         'FOR ARCHITECTS & DESIGNERS',
                'title':           'Your expertise,\nour method.',
                'sub':             'We collaborate with design professionals to create spaces that endure. Bring your project — we bring the network, the methodology and the operational presence.',
                'cta_primary':     'Book a consultation',
                'cta_secondary':   'Discover our projects',
            },
            'en-US': {
                'eyebrow':         'FOR ARCHITECTS & DESIGNERS',
                'title':           'Your expertise,\nour method.',
                'sub':             'We collaborate with design professionals to create spaces that endure. Bring your project — we bring the network, the methodology and the operational presence.',
                'cta_primary':     'Book a consultation',
                'cta_secondary':   'Discover our projects',
            },
        },
        'settings': {
            'cta_primary_href':   '/consulenza',
            'cta_secondary_href': '/projects',
        },
    },

    # 2. Atmosphere Statement — Manifesto collaborazione
    {
        'tenant_id':    TENANT_ID,
        'page_id':      PAGE_ID,
        'section_type': 'atmosphere_statement',
        'sort_order':   20,
        'visible':      True,
        'locale_content': {
            '_default': { 'eyebrow': 'PERCHÉ COLLABORARE' },
            'it': {
                'eyebrow': 'PERCHÉ COLLABORARE CON NOI',
                'title':   'Non subappaltiamo.\nCo-progettiamo.',
                'body':    'Ogni collaborazione con lo studio è una partnership reale. Portiamo la nostra rete di fornitori qualificati, la nostra metodologia progettuale e la nostra presenza diretta in cantiere — integrandoci con il tuo processo senza sovrapporci.',
                'cta':     'Come lavoriamo',
            },
            'en': {
                'eyebrow': 'WHY COLLABORATE WITH US',
                'title':   "We don't subcontract.\nWe co-design.",
                'body':    'Every collaboration with our studio is a real partnership. We bring our network of qualified suppliers, our design methodology and our direct on-site presence — integrating with your process without overlapping it.',
                'cta':     'How we work',
            },
            'en-US': {
                'eyebrow': 'WHY COLLABORATE WITH US',
                'title':   "We don't subcontract.\nWe co-design.",
                'body':    'Every collaboration with our studio is a real partnership. We bring our network of qualified suppliers, our design methodology and our direct on-site presence — integrating with your process without overlapping it.',
                'cta':     'How we work',
            },
        },
        'settings': { 'cta_href': '/about', 'alignment': 'editorial-left' },
    },

    # 3. Editorial Triptych — 3 vantaggi partnership
    {
        'tenant_id':    TENANT_ID,
        'page_id':      PAGE_ID,
        'section_type': 'editorial_triptych',
        'sort_order':   30,
        'visible':      True,
        'settings':     {},
        'locale_content': {
            '_default': { 'eyebrow': 'COSA PORTIAMO' },
            'it': {
                'eyebrow': 'COSA PORTIAMO ALLA COLLABORAZIONE',
                'title':   'Tre ragioni per\nlavorare insieme.',
                'blocks': [
                    {
                        'id':    'b1',
                        'title': 'Rete Fornitori Qualificati',
                        'body':  'Accesso alla nostra selezione consolidata di artigiani, maestranze e brand di eccellenza — verificati nel tempo su cantieri reali.',
                    },
                    {
                        'id':    'b2',
                        'title': 'Direzione Lavori',
                        'body':  'Presenza diretta in cantiere dall\'inizio alla consegna. Supervisiamo esecuzione, qualità e conformità al progetto.',
                    },
                    {
                        'id':    'b3',
                        'title': 'Gestione Integrata',
                        'body':  'Coordinamento fornitori, budget, timeline e documentazione — tutto sotto un\'unica regia, con trasparenza totale verso il committente.',
                    },
                ],
            },
            'en': {
                'eyebrow': 'WHAT WE BRING TO THE COLLABORATION',
                'title':   'Three reasons\nto work together.',
                'blocks': [
                    {
                        'id':    'b1',
                        'title': 'Qualified Supplier Network',
                        'body':  'Access to our consolidated selection of craftsmen, skilled workers and excellence brands — verified over time on real projects.',
                    },
                    {
                        'id':    'b2',
                        'title': 'Site Management',
                        'body':  'Direct on-site presence from start to handover. We supervise execution, quality and project compliance.',
                    },
                    {
                        'id':    'b3',
                        'title': 'Integrated Management',
                        'body':  'Supplier coordination, budget, timeline and documentation — all under one direction, with full transparency to the client.',
                    },
                ],
            },
        },
    },

    # 4. Design Journey — Come inizia una collaborazione (4 step)
    {
        'tenant_id':    TENANT_ID,
        'page_id':      PAGE_ID,
        'section_type': 'design_journey',
        'sort_order':   40,
        'visible':      True,
        'locale_content': {
            '_default': { 'eyebrow': 'IL PROCESSO' },
            'it': {
                'eyebrow': 'IL PROCESSO DI COLLABORAZIONE',
                'title':   'Come nasce\nuna partnership.',
                'cta':     'Prenota una consulenza',
            },
            'en': {
                'eyebrow': 'THE COLLABORATION PROCESS',
                'title':   'How a partnership\nbegins.',
                'cta':     'Book a consultation',
            },
            'en-US': {
                'eyebrow': 'THE COLLABORATION PROCESS',
                'title':   'How a partnership\nbegins.',
                'cta':     'Book a consultation',
            },
        },
        'settings': {
            'cta_href': '/consulenza',
            'steps': [
                {
                    'id': '01',
                    'title': { 'it': 'Primo contatto',  'en': 'First contact' },
                    'body':  { 'it': 'Ci racconti il progetto, le esigenze e la timeline. Anche in modo informale.',
                               'en': 'Tell us about the project, requirements and timeline. Even informally.' },
                },
                {
                    'id': '02',
                    'title': { 'it': 'Assessment',      'en': 'Assessment' },
                    'body':  { 'it': 'Valutiamo insieme la compatibilità, definiamo i ruoli e stabiliamo le aspettative.',
                               'en': 'We assess compatibility together, define roles and set expectations.' },
                },
                {
                    'id': '03',
                    'title': { 'it': 'Accordo',         'en': 'Agreement' },
                    'body':  { 'it': 'Formalizzazione dei termini, definizione del perimetro e avvio operativo.',
                               'en': 'Formalizing terms, defining scope and beginning operations.' },
                },
                {
                    'id': '04',
                    'title': { 'it': 'Esecuzione',      'en': 'Execution' },
                    'body':  { 'it': 'Lavoriamo fianco a fianco, dalla progettazione alla consegna al committente.',
                               'en': 'We work side by side, from design through handover to the client.' },
                },
            ],
        },
    },

    # 5. Professionals CTA — Chi può collaborare
    {
        'tenant_id':    TENANT_ID,
        'page_id':      PAGE_ID,
        'section_type': 'professionals_cta',
        'sort_order':   50,
        'visible':      True,
        'locale_content': {
            '_default': { 'eyebrow': 'CHI PUÒ COLLABORARE' },
            'it': {
                'eyebrow': 'CON CHI COLLABORIAMO',
                'title':   'Architetti, designer\ne professionisti del progetto.',
                'body':    'Apriamo collaborazioni con studi di architettura, interior designer freelance, general contractor, showroom di materiali e artigiani specializzati. Lavoriamo su selezione — ogni partnership è valutata caso per caso.',
                'cta':     'Prenota una consulenza',
                'blocks': [
                    { 'id': 'p1', 'label': { 'it': 'Architetti', 'en': 'Architects' } },
                    { 'id': 'p2', 'label': { 'it': 'Interior Designer', 'en': 'Interior Designers' } },
                    { 'id': 'p3', 'label': { 'it': 'General Contractor', 'en': 'General Contractors' } },
                    { 'id': 'p4', 'label': { 'it': 'Showroom & Brand', 'en': 'Showroom & Brands' } },
                    { 'id': 'p5', 'label': { 'it': 'Artigiani', 'en': 'Craftsmen' } },
                ],
            },
            'en': {
                'eyebrow': 'WHO WE COLLABORATE WITH',
                'title':   'Architects, designers\nand project professionals.',
                'body':    'We open collaborations with architecture firms, freelance interior designers, general contractors, material showrooms and specialized craftsmen. We work by selection — each partnership is evaluated case by case.',
                'cta':     'Book a consultation',
            },
            'en-US': {
                'eyebrow': 'WHO WE COLLABORATE WITH',
                'title':   'Architects, designers\nand project professionals.',
                'body':    'We open collaborations with architecture firms, freelance interior designers, general contractors, material showrooms and specialized craftsmen. We work by selection — each partnership is evaluated case by case.',
                'cta':     'Book a consultation',
            },
        },
        'settings': { 'cta_href': '/consulenza' },
    },

    # 6. Cinematic Quote — CTA finale
    {
        'tenant_id':    TENANT_ID,
        'page_id':      PAGE_ID,
        'section_type': 'cinematic_quote',
        'sort_order':   60,
        'visible':      True,
        'locale_content': {
            '_default': { 'quote': 'Hai un progetto da realizzare insieme?' },
            'it': {
                'title':   'Hai un progetto\nda realizzare insieme?',
                'sub':     'Lavoriamo con un numero selezionato di professionisti. Parliamoci.',
                'private': 'Prenota una consulenza',
                'pro':     'Scopri i nostri progetti',
            },
            'en': {
                'title':   'Do you have a project\nto build together?',
                'sub':     'We work with a selected number of professionals. Let\'s talk.',
                'private': 'Book a consultation',
                'pro':     'Discover our projects',
            },
            'en-US': {
                'title':   'Do you have a project\nto build together?',
                'sub':     'We work with a selected number of professionals. Let\'s talk.',
                'private': 'Book a consultation',
                'pro':     'Discover our projects',
            },
        },
        'settings': {
            'private_href': '/consulenza',
            'pro_href':     '/projects',
        },
    },
]

# ── Inserimento sezioni ──────────────────────────────────────────────────────
res = sb.table('cms_sections').insert(sections).execute()
print(f"{len(res.data)} sezioni inserite.")

# ── Pubblica la pagina ────────────────────────────────────────────────────────
from core.storefront_revisions import publish_page as core_publish
result = core_publish(tenant_id=TENANT_ID, page_key='professionals', profile_id=None, label='seed-professionals-page')
print(f"Pagina 'professionals' pubblicata.")
print("FATTO.")
