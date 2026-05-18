"""
Seed missing home-page bands so Experience Studio admins can edit them:
  - newsletter
  - dual_cta
  - stats_band initial KPIs/title (refresh if empty)
  - brand_logos initial items (refresh if empty)
  - magazine_grid limit/mode defaults
Also dedupes duplicate sections that appeared in earlier seeds.

Usage: python /app/backend/scripts/seed_storefront_home_bands.py [tenant_slug]
"""
import os, sys, uuid
import psycopg2, psycopg2.extras
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
DEMO_SLUG = sys.argv[1] if len(sys.argv) > 1 else 'mood-demo-studio-81a09e'

NEWSLETTER_LC = {
    'it-IT': {
        'title': 'Ispirazione e novità',
        'body': 'Iscriviti per ricevere contenuti esclusivi e aggiornamenti editoriali dal nostro studio.',
        'placeholder': 'La tua email',
        'cta': 'Iscriviti',
        'success': 'Grazie per esserti iscritto.',
    },
    'en-US': {
        'title': 'Inspiration & news',
        'body': 'Subscribe for exclusive editorial content and studio updates.',
        'placeholder': 'Your email',
        'cta': 'Subscribe',
        'success': 'Thanks for subscribing.',
    },
}

DUAL_CTA_LC = {
    'it-IT': {
        'eyebrow': 'Due percorsi. Un unico obiettivo:',
        'title': 'trasformare la tua visione in realtà.',
        'private_eyebrow': 'Sei un privato?',
        'private_title': 'Inizia il tuo progetto',
        'private_body': 'Raccontaci la tua idea, i tuoi desideri e le tue esigenze. Ti guideremo passo dopo passo nella creazione del tuo spazio ideale.',
        'private_cta': 'Inizia il tuo progetto',
        'private_href': '/start-project/private',
        'private_image': 'https://images.unsplash.com/photo-1492138645846-7ba729b4d6ae?auto=format&fit=crop&w=900&q=85',
        'professional_eyebrow': 'Sei un professionista?',
        'professional_title': 'Collabora con noi',
        'professional_body': "Accedi a un ecosistema di prodotti, competenze e servizi dedicati ai professionisti dell'interior design e dell'architettura.",
        'professional_cta': 'Accesso professionisti',
        'professional_href': '/start-project/professional',
        'professional_image': 'https://images.unsplash.com/photo-1582719188393-bb71ca45dbb9?auto=format&fit=crop&w=900&q=85',
    },
    'en-US': {
        'eyebrow': 'Two paths. One single goal:',
        'title': 'turning your vision into reality.',
        'private_eyebrow': 'Are you a private client?',
        'private_title': 'Start your project',
        'private_body': 'Tell us your idea, your wishes and your needs. We will guide you step by step in shaping your ideal space.',
        'private_cta': 'Start your project',
        'private_href': '/start-project/private',
        'private_image': 'https://images.unsplash.com/photo-1492138645846-7ba729b4d6ae?auto=format&fit=crop&w=900&q=85',
        'professional_eyebrow': 'Are you a professional?',
        'professional_title': 'Work with us',
        'professional_body': 'Access an ecosystem of products, expertise and services for interior design and architecture professionals.',
        'professional_cta': 'Professional access',
        'professional_href': '/start-project/professional',
        'professional_image': 'https://images.unsplash.com/photo-1582719188393-bb71ca45dbb9?auto=format&fit=crop&w=900&q=85',
    },
}

STATS_LC = {
    'it-IT': {'eyebrow': 'Lo studio in numeri', 'title': 'Una scena editoriale costruita progetto dopo progetto', 'body': ''},
    'en-US': {'eyebrow': 'The studio in numbers', 'title': 'An editorial practice built project after project', 'body': ''},
}
STATS_ITEMS = [
    {'value': '120+', 'label_i18n': {'it-IT': 'Progetti completati', 'en-US': 'Completed projects'}},
    {'value': '18',   'label_i18n': {'it-IT': 'Mercati internazionali', 'en-US': 'International markets'}},
    {'value': '35',   'label_i18n': {'it-IT': 'Artigiani partner', 'en-US': 'Partner artisans'}},
    {'value': '12y',  'label_i18n': {'it-IT': 'Anni di pratica', 'en-US': 'Years of practice'}},
]

LOGOS_LC = {
    'it-IT': {'eyebrow': 'Trusted by', 'title': 'Le firme che ci scelgono'},
    'en-US': {'eyebrow': 'Trusted by', 'title': 'The names who choose us'},
}
LOGOS_ITEMS = [
    {'name': 'B&B Italia',     'logo_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/B%26B_Italia_logo.svg/200px-B%26B_Italia_logo.svg.png'},
    {'name': 'Poliform',       'logo_url': ''},
    {'name': 'Cassina',        'logo_url': ''},
    {'name': 'Molteni&C',      'logo_url': ''},
    {'name': 'Flos',           'logo_url': ''},
    {'name': 'Boffi',          'logo_url': ''},
]

MAG_LC = {
    'it-IT': {
        'eyebrow': 'Journal',
        'title': 'Storie dallo studio',
        'body': 'Approfondimenti, materiali, progetti e cultura del design.',
        'cta_label': 'Esplora il magazine',
        'cta_href': '/magazine',
    },
    'en-US': {
        'eyebrow': 'Journal',
        'title': 'Stories from the studio',
        'body': 'Insights, materials, projects and design culture.',
        'cta_label': 'Explore the magazine',
        'cta_href': '/magazine',
    },
}

def dedupe(cur, page_id):
    """Keep only the lowest-id row per (section_type)."""
    cur.execute("""DELETE FROM cms_sections WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY page_id, section_type ORDER BY id) AS rn
          FROM cms_sections WHERE page_id = %s
        ) t WHERE rn > 1
    )""", (page_id,))

def upsert_section(cur, page_id, tenant_id, section_type, sort_order, lc, settings):
    cur.execute("SELECT id, locale_content, settings FROM cms_sections WHERE page_id=%s AND section_type=%s LIMIT 1",
                (page_id, section_type))
    row = cur.fetchone()
    if row:
        sid, existing_lc, existing_settings = row
        existing_lc = existing_lc or {}
        existing_settings = existing_settings or {}
        # Merge — only fill missing locales/keys, never overwrite admin edits.
        merged_lc = dict(existing_lc)
        for loc, data in lc.items():
            cur_loc = dict(merged_lc.get(loc) or {})
            for k, v in data.items():
                cur_loc.setdefault(k, v)
            merged_lc[loc] = cur_loc
        merged_settings = dict(existing_settings)
        for k, v in (settings or {}).items():
            merged_settings.setdefault(k, v)
        cur.execute("UPDATE cms_sections SET locale_content=%s::jsonb, settings=%s::jsonb, updated_at=NOW() WHERE id=%s",
                    (psycopg2.extras.Json(merged_lc), psycopg2.extras.Json(merged_settings), sid))
        print(f"[merge] {section_type}")
        return
    cur.execute("""INSERT INTO cms_sections
        (id, tenant_id, page_id, section_type, sort_order, visible, locale_content, settings, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, TRUE, %s::jsonb, %s::jsonb, NOW(), NOW())""",
        (str(uuid.uuid4()), tenant_id, page_id, section_type, sort_order,
         psycopg2.extras.Json(lc), psycopg2.extras.Json(settings or {})))
    print(f"[insert] {section_type}")

def main():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM tenants WHERE slug=%s", (DEMO_SLUG,))
    row = cur.fetchone()
    if not row:
        print('Tenant not found'); sys.exit(1)
    tenant_id, name = row
    print(f'Tenant: {name} ({tenant_id})')

    cur.execute("SELECT id FROM cms_pages WHERE tenant_id=%s AND page_key='home'", (tenant_id,))
    home = cur.fetchone()
    if not home:
        print('home page not found'); sys.exit(1)
    home_id = home[0]

    # Dedupe duplicates in projects + professionals + start_project + ui pages
    for pkey in ('home', 'projects', 'professionals', 'start_project', 'ui', 'navigation'):
        cur.execute("SELECT id FROM cms_pages WHERE tenant_id=%s AND page_key=%s", (tenant_id, pkey))
        r = cur.fetchone()
        if r:
            dedupe(cur, r[0])
    print('[ok] dedupe complete')

    upsert_section(cur, home_id, tenant_id, 'dual_cta',      15, DUAL_CTA_LC, {})
    upsert_section(cur, home_id, tenant_id, 'stats_band',    20, STATS_LC,    {'stats': STATS_ITEMS})
    upsert_section(cur, home_id, tenant_id, 'brand_logos',   50, LOGOS_LC,    {'logos': LOGOS_ITEMS})
    upsert_section(cur, home_id, tenant_id, 'magazine_grid', 40, MAG_LC,      {'mode': 'auto', 'limit': 3})
    upsert_section(cur, home_id, tenant_id, 'newsletter',    60, NEWSLETTER_LC, {})

    cur.execute("UPDATE cms_pages SET status='published', published_at=COALESCE(published_at, NOW()), updated_at=NOW() WHERE id=%s", (home_id,))
    print('[ok] home page published')
    cur.close(); conn.close()
    print('DONE.')

if __name__ == '__main__':
    main()
