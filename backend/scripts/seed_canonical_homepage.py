#!/usr/bin/env python3
"""
ITER157 · Sprint A · Canonical Homepage Seed™

Seeds the public homepage as a Storefront CMS page (slug `home`)
for the target tenant, with the 10 canonical section types defined
by the Public Editorial Infrastructure™ contract:

  1. hero_editorial
  2. featured_design_journeys
  3. editorial_grid           (acts as `magazine_highlights`)
  4. trust_marquee
  5. magazine_highlights
  6. atmosphere_statement
  7. professionals_cta
  8. materials_carousel
  9. cinematic_quote
 10. editorial_footer

Idempotent — re-running purges and re-inserts the canonical layout
for the tenant. Will NOT overwrite a tenant override (see ITER157.B).

Usage:
    python3 seed_canonical_homepage.py [tenant_slug]
"""
from __future__ import annotations
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from database import db  # noqa: E402

NOW = lambda: datetime.now(timezone.utc).isoformat()  # noqa: E731

DEFAULT_TENANT_SLUG = 'mood-demo-studio-81a09e'

# ── Locale bag helper ──────────────────────────────────────────────
def lb(it=None, en=None, fr=None, de=None, es=None, default=None):
    """Build a canonical locale_content sub-bag."""
    out = {}
    if default is not None: out['_default'] = default
    elif it is not None:    out['_default'] = it
    if it is not None: out['it']    = it
    if en is not None: out['en-US'] = en
    if fr is not None: out['fr']    = fr
    if de is not None: out['de']    = de
    if es is not None: out['es']    = es
    return out


# ── Canonical sections payload ─────────────────────────────────────
# Each entry: (section_type, locale_content, settings).
# locale_content stays in the proven {_default, it, en-US, …} shape
# already consumed by useStorefrontContent.
CANONICAL_SECTIONS = [
    (
        'hero_editorial',
        {
            '_default': {
                'eyebrow': 'MOOD for DESIGN™',
                'image':   'https://images.unsplash.com/photo-1618219740975-d40978bb7378?auto=format&fit=crop&w=2400&q=85',
            },
            'it': {
                'eyebrow':       'MOOD for DESIGN™',
                'title':         'Il tuo spazio.\nIl tuo viaggio.',
                'sub':           "Inizia un'esperienza di design personale con studi italiani di alta gamma.",
                'cta_primary':   'Inizia il tuo viaggio',
                'cta_secondary': 'Per i professionisti',
                'image':         'https://images.unsplash.com/photo-1618219740975-d40978bb7378?auto=format&fit=crop&w=2400&q=85',
            },
            'en-US': {
                'eyebrow':       'MOOD for DESIGN™',
                'title':         'Your space.\nYour journey.',
                'sub':           'Begin a personal design experience with Italian design studios.',
                'cta_primary':   'Begin Your Journey™',
                'cta_secondary': 'For Professionals™',
                'image':         'https://images.unsplash.com/photo-1618219740975-d40978bb7378?auto=format&fit=crop&w=2400&q=85',
            },
        },
        {
            'cta_primary_href':   '/begin-journey',
            'cta_secondary_href': '/professionals',
            'atmosphere':         'cinematic',
        },
    ),
    (
        'featured_design_journeys',
        {
            '_default': {'eyebrow': 'Design Stories', 'title': 'Real projects. Real spaces.'},
            'it':   {'eyebrow': 'Design Stories', 'title': 'Progetti reali. Spazi reali.',
                     'viewAll': 'Vedi tutti i progetti'},
            'en-US':{'eyebrow': 'Design Stories', 'title': 'Real projects. Real spaces.',
                     'viewAll': 'View all projects'},
        },
        {
            # Sprint B will replace this with a dynamic resolver over
            # `published_design_journeys`. For now: explicit selection.
            'source':           'portfolio_projects',
            'auto_feed':        True,
            'max_items':        4,
            'fallback_visible': False,  # never show fake content
        },
    ),
    (
        'editorial_grid',
        {
            '_default': {'eyebrow': 'Magazine', 'title': 'Inspiration. Materials. Atmospheres.'},
            'it':   {'eyebrow': 'Magazine', 'title': 'Ispirazione. Materiali. Atmosfere.',
                     'explore': 'Esplora tutti gli articoli'},
            'en-US':{'eyebrow': 'Magazine', 'title': 'Inspiration. Materials. Atmospheres.',
                     'explore': 'Explore all articles'},
        },
        {
            'source':    'magazine_articles',
            'auto_feed': True,
            'max_items': 5,
            'category_filter': None,  # all categories
        },
    ),
    (
        'trust_marquee',
        {
            '_default': {'eyebrow': 'Selected Materials & Design Partners'},
            'it':    {'eyebrow': 'Materiali Selezionati & Design Partner'},
            'en-US': {'eyebrow': 'Selected Materials & Design Partners'},
        },
        {
            # Curated brand list — admin can extend via Storefront CMS.
            'brands': [
                'Poliform', 'Molteni&C', 'B&B Italia', 'Minotti',
                'FLOS', 'Cattelan Italia', 'Porro', 'Poltrona Frau',
            ],
        },
    ),
    (
        'magazine_highlights',
        {
            '_default': {'eyebrow': 'Editorial Highlights', 'title': 'Curated stories from the studio.'},
            'it':    {'eyebrow': 'In evidenza', 'title': 'Storie curate dallo studio.'},
            'en-US': {'eyebrow': 'Editorial Highlights', 'title': 'Curated stories from the studio.'},
        },
        {'source': 'magazine_articles', 'featured_only': True, 'max_items': 3},
    ),
    (
        'atmosphere_statement',
        {
            '_default': {'quote': 'Design is not just what you see. It is how you live.'},
            'it':    {'quote': 'Il design non è solo ciò che vedi. È come vivi.', 'attribution': 'MOOD for DESIGN™'},
            'en-US': {'quote': 'Design is not just what you see. It is how you live.', 'attribution': 'MOOD for DESIGN™'},
        },
        {'background': 'warm-white', 'alignment': 'editorial-left'},
    ),
    (
        'professionals_cta',
        {
            '_default': {'title': 'For Design Studios & Brands'},
            'it':    {'eyebrow': 'Per i professionisti',
                      'title':   'Studi di design e brand del lusso.',
                      'sub':     "Scopri come Blueprint OS™ orchestra l'esperienza editoriale del tuo studio.",
                      'cta':     'Esplora For Professionals™'},
            'en-US': {'eyebrow': 'For Professionals™',
                      'title':   'Design studios & luxury brands.',
                      'sub':     "Discover how Blueprint OS™ orchestrates your studio's editorial experience.",
                      'cta':     'Explore For Professionals™'},
        },
        {'cta_href': '/professionals'},
    ),
    (
        'materials_carousel',
        {
            '_default': {'eyebrow': 'Materials & Brands', 'title': 'Curated selection of the finest materials.'},
            'it':    {'eyebrow': 'Materiali & Brand', 'title': 'Una selezione curata dei migliori materiali.',
                      'explore': 'Esplora i materiali'},
            'en-US': {'eyebrow': 'Materials & Brands', 'title': 'Curated selection of the finest materials.',
                      'explore': 'Explore materials'},
        },
        {
            'source':   'curated_swatches',
            'swatches': [
                {'id': 'mat1',  'name': 'Marble',      'swatch': '#E8E4DE', 'tone': 'light'},
                {'id': 'mat2',  'name': 'Walnut',      'swatch': '#5C3A28', 'tone': 'dark'},
                {'id': 'mat3',  'name': 'Oak',         'swatch': '#B8956A', 'tone': 'mid'},
                {'id': 'mat4',  'name': 'Linen',       'swatch': '#D6CDB8', 'tone': 'light'},
                {'id': 'mat5',  'name': 'Travertine',  'swatch': '#C9B498', 'tone': 'mid'},
                {'id': 'mat6',  'name': 'Brass',       'swatch': '#B5985A', 'tone': 'mid'},
                {'id': 'mat7',  'name': 'Terrazzo',    'swatch': '#ECE7DE', 'tone': 'light'},
                {'id': 'mat8',  'name': 'Slate',       'swatch': '#3A4148', 'tone': 'dark'},
                {'id': 'mat9',  'name': 'Linen Light', 'swatch': '#E8DFC9', 'tone': 'light'},
                {'id': 'mat10', 'name': 'Charcoal',    'swatch': '#2A2A2A', 'tone': 'dark'},
                {'id': 'mat11', 'name': 'Basalt',      'swatch': '#4A4744', 'tone': 'dark'},
            ],
        },
    ),
    (
        'cinematic_quote',
        {
            '_default': {'quote': 'Ready to start your design journey?'},
            'it':    {'eyebrow': 'Final invitation',
                      'title':   "Pronto a iniziare il tuo design journey?",
                      'sub':     'Siamo qui per portare la tua visione alla luce.',
                      'private': 'Per Clienti Privati',
                      'pro':     'Per Studi & Brand'},
            'en-US': {'eyebrow': 'Final invitation',
                      'title':   'Ready to start your design journey?',
                      'sub':     'We are here to bring your vision to life.',
                      'private': 'For Private Clients',
                      'pro':     'For Design Studios & Brands'},
        },
        {
            'private_href': '/begin-journey?audience=private',
            'pro_href':     '/professionals',
            'background':   'dark',
        },
    ),
    (
        'editorial_footer',
        {
            '_default': {'rights': '© 2026 MOOD for DESIGN. All rights reserved.'},
            'it':    {
                'rights': '© 2026 MOOD for DESIGN. Tutti i diritti riservati.',
                'cols':   [
                    {'title': 'Azienda', 'links': [
                        {'label': 'Chi siamo',      'href': '/about'},
                        {'label': 'I nostri studi', 'href': '/studios'},
                        {'label': 'Lavora con noi', 'href': '/careers'},
                        {'label': 'Contatti',       'href': '/contact'},
                    ]},
                    {'title': 'Risorse', 'links': [
                        {'label': 'FAQ',                       'href': '/faq'},
                        {'label': 'Privacy Policy',            'href': '/privacy'},
                        {'label': 'Termini e Condizioni',      'href': '/terms'},
                    ]},
                    {'title': 'Seguici', 'links': [
                        {'label': 'Instagram', 'href': 'https://instagram.com'},
                        {'label': 'Pinterest', 'href': 'https://pinterest.com'},
                        {'label': 'LinkedIn',  'href': 'https://linkedin.com'},
                    ]},
                ],
            },
            'en-US': {
                'rights': '© 2026 MOOD for DESIGN. All rights reserved.',
                'cols':   [
                    {'title': 'Company', 'links': [
                        {'label': 'About Us',    'href': '/about'},
                        {'label': 'Our Studios', 'href': '/studios'},
                        {'label': 'Careers',     'href': '/careers'},
                        {'label': 'Contact',     'href': '/contact'},
                    ]},
                    {'title': 'Resources', 'links': [
                        {'label': 'FAQ',                'href': '/faq'},
                        {'label': 'Privacy Policy',     'href': '/privacy'},
                        {'label': 'Terms & Conditions', 'href': '/terms'},
                    ]},
                    {'title': 'Follow Us', 'links': [
                        {'label': 'Instagram', 'href': 'https://instagram.com'},
                        {'label': 'Pinterest', 'href': 'https://pinterest.com'},
                        {'label': 'LinkedIn',  'href': 'https://linkedin.com'},
                    ]},
                ],
            },
        },
        {
            'colophon_enabled': True,
            'colophon_link':    'https://www.moodfordesign.com',
        },
    ),
]


# ── Idempotent persistence ──────────────────────────────────────────
def _resolve_tenant_id(client, tenant_slug: str) -> str | None:
    r = (client.table('tenants').select('id')
         .eq('slug', tenant_slug).limit(1).execute()).data or []
    return r[0]['id'] if r else None


def _ensure_page(client, tenant_id: str) -> dict:
    r = (client.table('cms_pages').select('*')
         .eq('tenant_id', tenant_id).eq('page_key', 'home')
         .limit(1).execute()).data or []
    if r:
        # Already exists. Promote to published if needed.
        if r[0].get('status') != 'published':
            client.table('cms_pages').update({
                'status':      'published',
                'updated_at':  NOW(),
            }).eq('id', r[0]['id']).execute()
        return r[0]
    new = {
        'id':           str(uuid.uuid4()),
        'tenant_id':    tenant_id,
        'page_key':     'home',
        'title':        'Home',
        'status':       'published',
        'locale_meta':  {},
        'page_content': {},
        'created_at':   NOW(),
        'updated_at':   NOW(),
    }
    client.table('cms_pages').insert(new).execute()
    return new


def _purge_sections(client, tenant_id: str, page_id: str) -> None:
    client.table('cms_sections').delete() \
        .eq('tenant_id', tenant_id).eq('page_id', page_id).execute()


def _insert_section(client, tenant_id: str, page_id: str,
                    sort_order: int, section_type: str,
                    locale_content: dict, settings: dict) -> None:
    client.table('cms_sections').insert({
        'id':             str(uuid.uuid4()),
        'tenant_id':      tenant_id,
        'page_id':        page_id,
        'section_type':   section_type,
        'sort_order':     sort_order,
        'visible':        True,
        'locale_content': locale_content,
        'settings':       settings or {},
        'created_at':     NOW(),
        'updated_at':     NOW(),
    }).execute()


def main() -> int:
    tenant_slug = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TENANT_SLUG
    client = db()
    tid = _resolve_tenant_id(client, tenant_slug)
    if not tid:
        print(f"ERROR · tenant '{tenant_slug}' not found")
        return 2

    print(f"→ Tenant {tenant_slug} = {tid}")
    page = _ensure_page(client, tid)
    print(f"→ Page 'home' = {page['id']} (status: published)")

    _purge_sections(client, tid, page['id'])
    print(f"→ Purged existing sections")

    for idx, (stype, lc, settings) in enumerate(CANONICAL_SECTIONS):
        _insert_section(client, tid, page['id'], idx, stype, lc, settings)
        print(f"  ✓ [{idx:02d}] {stype}")

    print(f"\n✅ Seeded {len(CANONICAL_SECTIONS)} canonical sections for {tenant_slug}/home")
    return 0


if __name__ == '__main__':
    sys.exit(main())
