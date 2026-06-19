#!/usr/bin/env python3
"""
patch_professionals_partner_sprint.py
══════════════════════════════════════
Aggiorna la pagina CMS 'professionals' per il Partner Sprint:

- Hero: nuova headline + subheadline + immagine + CTA → /partner-application
- Atmosphere: copy già buono, solo CTA link aggiornato
- Triptych: mantiene vantaggi, copy neutro
- Design Journey: step aggiornati (processo partner) + CTA → /partner-application
- Professionals CTA: aggiunto Developer + CTA → /partner-application
- Cinematic Quote: nuova headline + CTA → /partner-application
"""
import os, sys, uuid
sys.path.insert(0, '/app/backend')

SUPABASE_URL = ''; SUPABASE_KEY = ''
with open('/app/backend/.env') as f:
    for line in f:
        line = line.strip()
        if line.startswith('SUPABASE_URL='): SUPABASE_URL = line.split('=',1)[1].strip()
        elif line.startswith('SUPABASE_SERVICE_ROLE_KEY='): SUPABASE_KEY = line.split('=',1)[1].strip()
        elif line.startswith('SUPABASE_SERVICE_KEY='): SUPABASE_KEY = line.split('=',1)[1].strip()

from supabase import create_client
sb = create_client(SUPABASE_URL, SUPABASE_KEY)
TENANT_ID = '848354b9-a43e-4147-bdad-116fb93bd585'

page_res = sb.table('cms_pages').select('id').eq('tenant_id', TENANT_ID).eq('page_key', 'professionals').single().execute()
PAGE_ID = page_res.data['id']
print(f"[OK] Pagina professionals: {PAGE_ID}")

secs = sb.table('cms_sections').select('id,section_type,sort_order').eq('page_id', PAGE_ID).eq('tenant_id', TENANT_ID).order('sort_order').execute()
by_type = {s['section_type']: s['id'] for s in secs.data}
print(f"[OK] Sezioni trovate: {list(by_type.keys())}")

PARTNER_APPLY = '/partner-application'
HERO_IMAGE = 'https://images.pexels.com/photos/4977353/pexels-photo-4977353.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'

patches = []

# ── 1. Hero editorial ─────────────────────────────────────────────────────────
if 'hero_editorial' in by_type:
    patches.append((by_type['hero_editorial'], {
        'locale_content': {
            '_default': { 'eyebrow': 'PARTNER NETWORK' },
            'it': {
                'eyebrow':       'PARTNER NETWORK',
                'title':         'Le migliori collaborazioni\nnascono da una visione condivisa.',
                'sub':           'Collaboriamo con architetti, interior designer, showroom, contractor e professionisti che desiderano sviluppare progetti di qualità insieme.',
                'cta_primary':   'Proponi una collaborazione',
                'cta_secondary': 'Scopri i nostri progetti',
            },
            'en': {
                'eyebrow':       'PARTNER NETWORK',
                'title':         'The best collaborations\nbegin with a shared vision.',
                'sub':           'We collaborate with architects, interior designers, showrooms, contractors and professionals who want to develop quality projects together.',
                'cta_primary':   'Propose a collaboration',
                'cta_secondary': 'Discover our projects',
            },
            'en-US': {
                'eyebrow':       'PARTNER NETWORK',
                'title':         'The best collaborations\nbegin with a shared vision.',
                'sub':           'We collaborate with architects, interior designers, showrooms, contractors and professionals who want to develop quality projects together.',
                'cta_primary':   'Propose a collaboration',
                'cta_secondary': 'Discover our projects',
            },
        },
        'settings': {
            'cta_primary_href':   PARTNER_APPLY,
            'cta_secondary_href': '/projects',
            'bg_image':           HERO_IMAGE,
        },
    }))

# ── 4. Design Journey — processo partner (4 step) ─────────────────────────────
if 'design_journey' in by_type:
    patches.append((by_type['design_journey'], {
        'locale_content': {
            '_default': { 'eyebrow': 'IL PROCESSO' },
            'it': {
                'eyebrow': 'COME NASCE UNA COLLABORAZIONE',
                'title':   'Dal primo contatto\nalla collaborazione attiva.',
                'cta':     'Proponi una collaborazione',
            },
            'en': {
                'eyebrow': 'THE COLLABORATION PROCESS',
                'title':   'From first contact\nto active collaboration.',
                'cta':     'Propose a collaboration',
            },
            'en-US': {
                'eyebrow': 'THE COLLABORATION PROCESS',
                'title':   'From first contact\nto active collaboration.',
                'cta':     'Propose a collaboration',
            },
        },
        'settings': {
            'cta_href': PARTNER_APPLY,
            'steps': [
                {
                    'id': '01',
                    'title': { 'it': 'Candidatura', 'en': 'Application' },
                    'body':  {
                        'it': 'Compila il brief di collaborazione. Ci racconti il tuo studio, il tuo approccio al progetto e come immagini una partnership.',
                        'en': 'Fill in the collaboration brief. Tell us about your studio, your approach to design and how you envision a partnership.',
                    },
                },
                {
                    'id': '02',
                    'title': { 'it': 'Valutazione', 'en': 'Review' },
                    'body':  {
                        'it': 'Il nostro team valuta il profilo entro 5 giorni lavorativi. Cerchiamo complementarietà, non sovrapposizione.',
                        'en': 'Our team reviews the profile within 5 business days. We look for complementarity, not overlap.',
                    },
                },
                {
                    'id': '03',
                    'title': { 'it': 'Primo confronto', 'en': 'First meeting' },
                    'body':  {
                        'it': 'Una conversazione diretta per capire affinità, obiettivi e il primo progetto su cui potremmo lavorare insieme.',
                        'en': 'A direct conversation to understand affinity, goals and the first project we could work on together.',
                    },
                },
                {
                    'id': '04',
                    'title': { 'it': 'Collaborazione attiva', 'en': 'Active collaboration' },
                    'body':  {
                        'it': 'Entra nella rete professionale MOOD for DESIGN. Un progetto, poi il prossimo.',
                        'en': 'Join the MOOD for DESIGN professional network. One project, then the next.',
                    },
                },
            ],
        },
    }))

# ── 5. Professionals CTA — Chi collabora ─────────────────────────────────────
if 'professionals_cta' in by_type:
    patches.append((by_type['professionals_cta'], {
        'locale_content': {
            '_default': { 'eyebrow': 'CHI COLLABORA CON NOI' },
            'it': {
                'eyebrow': 'CHI COLLABORA CON NOI',
                'title':   'Professionisti che condividono\nla nostra visione del progetto.',
                'body':    'Lavoriamo con studi di architettura, interior designer, general contractor, showroom di materiali, brand e developer. Ogni collaborazione è selezionata e costruita su misura.',
                'cta':     'Entra nella rete professionale',
                'blocks': [
                    { 'id': 'p1', 'label': { 'it': 'Architetti',         'en': 'Architects' } },
                    { 'id': 'p2', 'label': { 'it': 'Interior Designer',  'en': 'Interior Designers' } },
                    { 'id': 'p3', 'label': { 'it': 'General Contractor', 'en': 'General Contractors' } },
                    { 'id': 'p4', 'label': { 'it': 'Showroom & Brand',   'en': 'Showroom & Brands' } },
                    { 'id': 'p5', 'label': { 'it': 'Artigiani',          'en': 'Craftsmen' } },
                    { 'id': 'p6', 'label': { 'it': 'Developer',          'en': 'Developer' } },
                ],
            },
            'en': {
                'eyebrow': 'WHO COLLABORATES WITH US',
                'title':   'Professionals who share\nour vision of design.',
                'body':    'We work with architecture firms, interior designers, general contractors, material showrooms, brands and developers. Each collaboration is selected and built to measure.',
                'cta':     'Join the professional network',
                'blocks': [
                    { 'id': 'p1', 'label': { 'it': 'Architetti',         'en': 'Architects' } },
                    { 'id': 'p2', 'label': { 'it': 'Interior Designer',  'en': 'Interior Designers' } },
                    { 'id': 'p3', 'label': { 'it': 'General Contractor', 'en': 'General Contractors' } },
                    { 'id': 'p4', 'label': { 'it': 'Showroom & Brand',   'en': 'Showroom & Brands' } },
                    { 'id': 'p5', 'label': { 'it': 'Artigiani',          'en': 'Craftsmen' } },
                    { 'id': 'p6', 'label': { 'it': 'Developer',          'en': 'Developer' } },
                ],
            },
            'en-US': {
                'eyebrow': 'WHO COLLABORATES WITH US',
                'title':   'Professionals who share\nour vision of design.',
                'body':    'We work with architecture firms, interior designers, general contractors, material showrooms, brands and developers. Each collaboration is selected and built to measure.',
                'cta':     'Join the professional network',
            },
        },
        'settings': { 'cta_href': PARTNER_APPLY },
    }))

# ── 6. Cinematic Quote — CTA finale ──────────────────────────────────────────
if 'cinematic_quote' in by_type:
    patches.append((by_type['cinematic_quote'], {
        'locale_content': {
            '_default': { 'quote': 'Parliamo del prossimo progetto.' },
            'it': {
                'title':   'Parliamo del\nprossimo progetto.',
                'sub':     'Se stai cercando uno studio con cui costruire qualcosa di duraturo, siamo qui. Invia la tua candidatura e iniziamo una conversazione.',
                'private': 'Proponi una collaborazione',
                'pro':     'Entra nella rete professionale',
            },
            'en': {
                'title':   "Let's talk about\nthe next project.",
                'sub':     "If you're looking for a studio to build something lasting with, we're here. Send your application and let's start a conversation.",
                'private': 'Propose a collaboration',
                'pro':     'Join the professional network',
            },
            'en-US': {
                'title':   "Let's talk about\nthe next project.",
                'sub':     "If you're looking for a studio to build something lasting with, we're here. Send your application and let's start a conversation.",
                'private': 'Propose a collaboration',
                'pro':     'Join the professional network',
            },
        },
        'settings': {
            'private_href': PARTNER_APPLY,
            'pro_href':     PARTNER_APPLY,
        },
    }))

# ── Applica patch ─────────────────────────────────────────────────────────────
for sec_id, payload in patches:
    sb.table('cms_sections').update(payload).eq('id', sec_id).eq('tenant_id', TENANT_ID).execute()
    print(f"[OK] Sezione {sec_id[:8]}... aggiornata")

# ── Pubblica ──────────────────────────────────────────────────────────────────
from core.storefront_revisions import publish_page as core_publish
result = core_publish(tenant_id=TENANT_ID, page_key='professionals', profile_id=None, label='partner-sprint-professionals-update')
print(f"[OK] Pagina professionals pubblicata. rev_id={result['revision_id']}")
print("✅ DONE")
