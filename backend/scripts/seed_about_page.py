"""
seed_about_page.py
══════════════════
Creates the /about CMS page for the studio tenant with 7 sections:
  1. hero_editorial    — cinematic studio hero
  2. atmosphere_statement — manifesto / filosofia
  3. team_identity_card   — team (wired to users_profile via API)
  4. design_journey       — come lavoriamo (3 steps)
  5. stats_band           — numeri chiave
  6. featured_design_journeys — portfolio teaser
  7. cinematic_quote      — CTA finale contatto

Also adds `/about` link to nav_top.settings.links.
Also adds `atmosphere_statement` section to `is_known_storefront_section` allowlist
  (legacy type — already in DB, just not in formal registry, but seed bypasses API).

Run:
    cd /app/backend && python3 scripts/seed_about_page.py
"""

import sys, json, uuid
from datetime import datetime, timezone

sys.path.insert(0, '.')
from database import db


TENANT_ID = '848354b9-a43e-4147-bdad-116fb93bd585'


# ── Section content ───────────────────────────────────────────────────────────

SECTIONS = [
    # ── 1. HERO ───────────────────────────────────────────────────────────────
    {
        'section_type': 'hero_editorial',
        'sort_order': 10,
        'visible': True,
        'locale_content': {
            'it': {
                'eyebrow': 'Chi siamo',
                'title': 'Progettiamo spazi che\nraccontano chi sei.',
                'sub': 'Ogni ambiente è un gesto di cura verso chi lo abita. Ascoltiamo prima di disegnare.',
                'cta_primary': 'Inizia un progetto',
                'cta_secondary': 'Per i professionisti',
                'image': 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1800&q=80&auto=format',
            },
            'en-US': {
                'eyebrow': 'Who we are',
                'title': 'We design spaces that\ntell your story.',
                'sub': 'Every space is a gesture of care for those who live in it. We listen before we draw.',
                'cta_primary': 'Start a project',
                'cta_secondary': 'For professionals',
                'image': 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1800&q=80&auto=format',
            },
            '_default': {
                'image': 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1800&q=80&auto=format',
            },
        },
        'settings': {
            'cta_primary_href': '/consulenza',
            'cta_secondary_href': '/professionals',
        },
    },

    # ── 2. MANIFESTO ──────────────────────────────────────────────────────────
    {
        'section_type': 'atmosphere_statement',
        'sort_order': 20,
        'visible': True,
        'locale_content': {
            'it': {
                'eyebrow': 'La nostra filosofia',
                'title': 'Il design non è solo\nciò che vedi.',
                'body': 'Lavoriamo con chi cerca non soltanto bellezza, ma senso. Con chi vuole che ogni spazio dica qualcosa di autentico su di sé. Con chi crede che abitare bene sia un diritto, non un privilegio.',
                'quote': 'Non costruiamo interni. Costruiamo appartenenza.',
                'cta': 'Scopri i nostri progetti',
            },
            'en-US': {
                'eyebrow': 'Our philosophy',
                'title': 'Design is not only\nwhat you see.',
                'body': 'We work with those who seek not just beauty, but meaning. With those who want each space to say something authentic about themselves. With those who believe that living well is a right, not a privilege.',
                'quote': "We don't build interiors. We build belonging.",
                'cta': 'Explore our projects',
            },
        },
        'settings': {
            'cta_href': '/projects',
        },
    },

    # ── 3. TEAM ───────────────────────────────────────────────────────────────
    {
        'section_type': 'team_identity_card',
        'sort_order': 30,
        'visible': True,
        'locale_content': {
            'it': {
                'eyebrow': 'Il team',
                'headline': 'Il tuo progetto,\nil nostro impegno personale.',
                'subheadline': 'Ogni progetto viene seguito direttamente da noi. Nessuna delega, nessun intermediario. Sei sempre in contatto con chi firma il progetto.',
                'cta_label': 'Inizia una conversazione',
            },
            'en-US': {
                'eyebrow': 'The team',
                'headline': 'Your project,\nour personal commitment.',
                'subheadline': 'Every project is managed directly by us. No delegation, no intermediaries. You are always in contact with the person who signs the project.',
                'cta_label': 'Start a conversation',
            },
        },
        'settings': {
            'cta_href': '/consulenza',
            'variant': 'warm',
            'alignment': 'portrait_left',
            'max_leaders': 1,
        },
    },

    # ── 4. APPROCCIO ──────────────────────────────────────────────────────────
    {
        'section_type': 'design_journey',
        'sort_order': 40,
        'visible': True,
        'locale_content': {
            'it': {
                'eyebrow': 'Il nostro approccio',
                'title': 'Tre atti.\nUna storia.',
                'cta': 'Inizia il tuo progetto',
            },
            'en-US': {
                'eyebrow': 'Our approach',
                'title': 'Three acts.\nOne story.',
                'cta': 'Start your project',
            },
        },
        'settings': {
            'cta_href': '/consulenza',
            'steps': [
                {
                    'id': '01',
                    'title': {'it': 'Ascoltiamo', 'en-US': 'We listen'},
                    'body': {
                        'it': "Il progetto nasce dall'ascolto. Capiamo chi sei, come vivi, cosa desideri. Il brief non è un modulo: è una conversazione.",
                        'en-US': "The project starts with listening. We understand who you are, how you live, what you desire. The brief is not a form: it's a conversation.",
                    },
                },
                {
                    'id': '02',
                    'title': {'it': 'Progettiamo', 'en-US': 'We design'},
                    'body': {
                        'it': 'Ogni decisione progettuale è motivata da intenzione. Materiali, proporzioni, luce, ordine degli spazi. Tutto è scelto per te.',
                        'en-US': 'Every design decision is motivated by intention. Materials, proportions, light, the order of spaces. Everything is chosen for you.',
                    },
                },
                {
                    'id': '03',
                    'title': {'it': 'Realizziamo', 'en-US': 'We build'},
                    'body': {
                        'it': 'Seguiamo ogni cantiere con attenzione maniacale. Dalla posa del primo mattone alla consegna delle chiavi: siamo presenti.',
                        'en-US': 'We follow every construction site with meticulous attention. From laying the first brick to handing over the keys: we are present.',
                    },
                },
            ],
        },
    },

    # ── 5. STATS ──────────────────────────────────────────────────────────────
    {
        'section_type': 'stats_band',
        'sort_order': 50,
        'visible': True,
        'locale_content': {
            'it': {
                'eyebrow': 'In numeri',
                'section_title': 'Ogni numero è una relazione.',
            },
            'en-US': {
                'eyebrow': 'In numbers',
                'section_title': 'Every number is a relationship.',
            },
        },
        'settings': {
            'stats': [
                {'id': 'years',    'value': '18',   'label': {'it': 'anni di esperienza',    'en-US': 'years of experience'}},
                {'id': 'projects', 'value': '200+', 'label': {'it': 'progetti realizzati',   'en-US': 'completed projects'}},
                {'id': 'countries','value': '12',   'label': {'it': 'paesi nel mondo',        'en-US': 'countries worldwide'}},
                {'id': 'privacy',  'value': '100%', 'label': {'it': 'riservatezza garantita','en-US': 'guaranteed privacy'}},
            ],
        },
    },

    # ── 6. PORTFOLIO TEASER ───────────────────────────────────────────────────
    {
        'section_type': 'featured_design_journeys',
        'sort_order': 60,
        'visible': True,
        'locale_content': {
            'it': {
                'eyebrow': 'I nostri lavori',
                'title': 'Ogni spazio,\nuna storia reale.',
                'viewAll': 'Vedi tutti i progetti',
            },
            'en-US': {
                'eyebrow': 'Our work',
                'title': 'Every space,\na real story.',
                'viewAll': 'View all projects',
            },
        },
        'settings': {'limit': 3},
    },

    # ── 7. CONTACT CTA ────────────────────────────────────────────────────────
    {
        'section_type': 'cinematic_quote',
        'sort_order': 70,
        'visible': True,
        'locale_content': {
            'it': {
                'title': 'Hai un progetto?\nParlaci.',
                'sub': 'Una conversazione non impegna. Ma può cambiare tutto.',
                'private': 'Prenota una consulenza privata',
                'pro': 'Sei un professionista?',
            },
            'en-US': {
                'title': "Have a project?\nLet's talk.",
                'sub': 'A conversation does not commit. But it can change everything.',
                'private': 'Book a private consultation',
                'pro': 'Are you a professional?',
            },
        },
        'settings': {
            'private_href': '/consulenza',
            'pro_href': '/professionals',
        },
    },
]


# ── Nav link ──────────────────────────────────────────────────────────────────

ABOUT_NAV_LINK = {
    'id': 'about',
    'href': '/about',
    'visible': True,
    'label_i18n': {
        'it-IT': 'Chi siamo',
        'en-US': 'About',
        '_default': 'About',
    },
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def now_iso():
    return datetime.now(timezone.utc).isoformat()


def create_about_page(c):
    existing = (
        c.table('cms_pages')
        .select('id,status')
        .eq('tenant_id', TENANT_ID)
        .eq('page_key', 'about')
        .limit(1)
        .execute()
    )
    if existing.data:
        print(f"  cms_pages.about already exists → id={existing.data[0]['id']}")
        return existing.data[0]['id']

    page_id = str(uuid.uuid4())
    c.table('cms_pages').insert({
        'id': page_id,
        'tenant_id': TENANT_ID,
        'page_key': 'about',
        'title': 'Chi siamo — Studio',
        'status': 'draft',
        'created_at': now_iso(),
        'updated_at': now_iso(),
    }).execute()
    print(f"  cms_pages.about created → id={page_id}")
    return page_id


def upsert_sections(c, page_id):
    existing = (
        c.table('cms_sections')
        .select('id,section_type')
        .eq('tenant_id', TENANT_ID)
        .eq('page_id', page_id)
        .execute()
    )
    existing_types = {s['section_type']: s['id'] for s in (existing.data or [])}

    created, updated = 0, 0
    inserted_sections = []

    for sec in SECTIONS:
        payload = {
            'tenant_id': TENANT_ID,
            'page_id': page_id,
            'section_type': sec['section_type'],
            'sort_order': sec['sort_order'],
            'visible': sec['visible'],
            'locale_content': sec['locale_content'],
            'settings': sec.get('settings', {}),
            'updated_at': now_iso(),
        }
        if sec['section_type'] in existing_types:
            sec_id = existing_types[sec['section_type']]
            c.table('cms_sections').update(payload).eq('id', sec_id).execute()
            payload['id'] = sec_id
            updated += 1
        else:
            sec_id = str(uuid.uuid4())
            payload['id'] = sec_id
            payload['created_at'] = now_iso()
            c.table('cms_sections').insert(payload).execute()
            created += 1

        inserted_sections.append({**payload})

    print(f"  sections: {created} created, {updated} updated")
    return inserted_sections


def publish_about_page(c, page_id):
    """Use the storefront revision engine to publish the about page."""
    import sys
    sys.path.insert(0, '/app/backend/core')
    from storefront_revisions import publish_page

    result = publish_page(
        tenant_id=TENANT_ID,
        page_key='about',
        profile_id=None,
        label='Initial publish — seed_about_page.py',
    )
    print(f"  revision published → rev_id={result['revision_id']}")
    return result['revision_id']


def add_nav_link(c):
    """Add /about to nav_top.settings.links if not already there."""
    nav_page = (
        c.table('cms_pages')
        .select('id')
        .eq('tenant_id', TENANT_ID)
        .eq('page_key', 'navigation')
        .limit(1)
        .execute()
    )
    if not nav_page.data:
        print("  WARNING: navigation page not found, skipping nav link")
        return

    nav_pid = nav_page.data[0]['id']
    nav_sec = (
        c.table('cms_sections')
        .select('id,settings')
        .eq('tenant_id', TENANT_ID)
        .eq('page_id', nav_pid)
        .eq('section_type', 'nav_top')
        .limit(1)
        .execute()
    )
    if not nav_sec.data:
        print("  WARNING: nav_top section not found, skipping nav link")
        return

    sec_id = nav_sec.data[0]['id']
    settings = nav_sec.data[0].get('settings') or {}
    links = settings.get('links') or []

    if any(l.get('id') == 'about' for l in links):
        print("  nav_top already has /about link")
        return

    # Insert /about before 'professionals'
    pro_idx = next((i for i, l in enumerate(links) if l.get('id') == 'professionals'), len(links))
    links.insert(pro_idx, ABOUT_NAV_LINK)
    settings['links'] = links

    c.table('cms_sections').update({
        'settings': settings,
        'updated_at': now_iso(),
    }).eq('id', sec_id).execute()
    print(f"  nav_top: /about link added at position {pro_idx}")

    # Re-publish navigation page using the revision engine
    import sys
    sys.path.insert(0, '/app/backend/core')
    from storefront_revisions import publish_page
    nav_result = publish_page(
        tenant_id=TENANT_ID,
        page_key='navigation',
        profile_id=None,
        label='Nav link /about added — seed_about_page.py',
    )
    print(f"  navigation page re-published → rev_id={nav_result['revision_id']}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    c = db()
    print("\n=== SEED: /about page ===\n")

    print("1. Creating/verifying cms_pages.about …")
    page_id = create_about_page(c)

    print("\n2. Upserting 7 sections …")
    sections = upsert_sections(c, page_id)

    print("\n3. Publishing revision …")
    publish_about_page(c, page_id)

    print("\n4. Adding /about to nav_top …")
    add_nav_link(c)

    print("\n=== DONE ===")
    print(f"  Public URL: /about")
    print(f"  CMS API:    /api/storefront/public/studio/pages/about")


if __name__ == '__main__':
    main()
