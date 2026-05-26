"""
ITER151f — Support / Training / Login pages editorial rebuild
─────────────────────────────────────────────────────────────────────────────
Replaces the basic page_hero + page_intro of /supporto, /formazione, /accedi
with the new editorial section types matching the user's mockups:

  /supporto:
    1. support_hero          — hero + search bar + 4 quick-access cards
    2. editorial_card_grid   — 4 large editorial cards (Guide, FAQ, Contact, Status)

  /formazione:
    1. training_hero         — split: 3-line serif headline + photo right + 2 CTA
    2. editorial_card_grid   — 4 cards (Percorsi, Tutorial, Guide, Webinar)
    3. editorial_card_grid   — 1 full-span featured card (MOOD Academy)

  /accedi:
    1. login_hero            — panoramic hero + login form overlay

All blocks + media are CMS-managed via the Page Editor (auto-discovery).

Run:  python /app/backend/db/seed_iter151_pages_v2.py
"""
import asyncio
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

import asyncpg
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')

CORP_SLUG = os.environ.get('CORPORATE_TENANT_SLUG', 'studio')


# ── SUPPORT ─────────────────────────────────────────────────────────────
SUPPORT_BLOCKS = [
    ('site.support', 'hero.eyebrow', 'eyebrow', {'it': 'Supporto'}),
    ('site.support', 'hero.title',   'headline',{'it': 'Siamo qui per aiutarti.'}),
    ('site.support', 'hero.body',    'body',
     {'it': 'Trova risposte, guide e risorse per usare al meglio MOOD for DESIGN. Il nostro team è sempre al tuo fianco.'}),
    ('site.support', 'hero.search_placeholder', 'body', {'it': 'Cerca tra le risorse di supporto…'}),
    ('site.support', 'hero.quick_label', 'body', {'it': 'Oppure esplora le sezioni più richieste'}),
    ('site.support', 'hero.link_01_label', 'cta', {'it': 'Guide e tutorial'}),
    ('site.support', 'hero.link_02_label', 'cta', {'it': 'FAQ'}),
    ('site.support', 'hero.link_03_label', 'cta', {'it': 'Contatta il supporto'}),
    ('site.support', 'hero.link_04_label', 'cta', {'it': 'Stato del sistema'}),

    # SECTIONS — 4 cards
    ('site.support', 'sections.item_01_eyebrow', 'eyebrow', {'it': 'Guide e tutorial'}),
    ('site.support', 'sections.item_01_title',   'headline',{'it': 'Guide e tutorial.'}),
    ('site.support', 'sections.item_01_body',    'body',    {'it': 'Scopri come utilizzare ogni strumento passo dopo passo.'}),
    ('site.support', 'sections.item_01_cta',     'cta',     {'it': 'Esplora le guide'}),

    ('site.support', 'sections.item_02_eyebrow', 'eyebrow', {'it': 'FAQ'}),
    ('site.support', 'sections.item_02_title',   'headline',{'it': 'Domande frequenti.'}),
    ('site.support', 'sections.item_02_body',    'body',    {'it': 'Risposte rapide alle domande più comuni.'}),
    ('site.support', 'sections.item_02_cta',     'cta',     {'it': 'Vai alle FAQ'}),

    ('site.support', 'sections.item_03_eyebrow', 'eyebrow', {'it': 'Contatto'}),
    ('site.support', 'sections.item_03_title',   'headline',{'it': 'Contatta il supporto.'}),
    ('site.support', 'sections.item_03_body',    'body',    {'it': 'Il nostro team è pronto ad assisterti.'}),
    ('site.support', 'sections.item_03_cta',     'cta',     {'it': 'Invia una richiesta'}),

    ('site.support', 'sections.item_04_eyebrow', 'eyebrow', {'it': 'Status'}),
    ('site.support', 'sections.item_04_title',   'headline',{'it': 'Stato del sistema.'}),
    ('site.support', 'sections.item_04_body',    'body',    {'it': 'Controlla lo stato dei nostri servizi in tempo reale.'}),
    ('site.support', 'sections.item_04_cta',     'cta',     {'it': 'Verifica ora'}),
]


# ── TRAINING ────────────────────────────────────────────────────────────
TRAINING_BLOCKS = [
    ('site.training', 'hero.eyebrow', 'eyebrow', {'it': 'Formazione MOOD'}),
    ('site.training', 'hero.title_line_1', 'headline', {'it': 'Conosci.'}),
    ('site.training', 'hero.title_line_2', 'headline', {'it': 'Impara.'}),
    ('site.training', 'hero.title_line_3', 'headline', {'it': 'Cresci.'}),
    ('site.training', 'hero.body', 'body',
     {'it': 'Risorse, guide e percorsi formativi per usare al massimo tutto il potenziale di MOOD for DESIGN.'}),
    ('site.training', 'hero.cta_primary',   'cta', {'it': 'Scopri i percorsi'}),
    ('site.training', 'hero.cta_secondary', 'cta', {'it': 'Guarda i tutorial'}),

    # SEZIONI — 4 cards
    ('site.training', 'sections.item_01_eyebrow', 'eyebrow', {'it': 'Percorsi guidati'}),
    ('site.training', 'sections.item_01_title',   'headline',{'it': 'Impara passo dopo passo.'}),
    ('site.training', 'sections.item_01_body',    'body',    {'it': 'Percorsi strutturati per ogni livello: dai primi passi alle funzionalità avanzate.'}),
    ('site.training', 'sections.item_01_cta',     'cta',     {'it': 'Scopri i percorsi'}),

    ('site.training', 'sections.item_02_eyebrow', 'eyebrow', {'it': 'Tutorial'}),
    ('site.training', 'sections.item_02_title',   'headline',{'it': 'Tutorial veloci e pratici.'}),
    ('site.training', 'sections.item_02_body',    'body',    {'it': 'Video brevi per scoprire funzionalità e strumenti in pochi minuti.'}),
    ('site.training', 'sections.item_02_cta',     'cta',     {'it': 'Vai ai tutorial'}),

    ('site.training', 'sections.item_03_eyebrow', 'eyebrow', {'it': 'Guide'}),
    ('site.training', 'sections.item_03_title',   'headline',{'it': 'Guide complete e aggiornate.'}),
    ('site.training', 'sections.item_03_body',    'body',    {'it': 'Approfondimenti dettagliati per lavorare meglio ogni giorno.'}),
    ('site.training', 'sections.item_03_cta',     'cta',     {'it': 'Sfoglia le guide'}),

    ('site.training', 'sections.item_04_eyebrow', 'eyebrow', {'it': 'Webinar'}),
    ('site.training', 'sections.item_04_title',   'headline',{'it': 'Webinar e sessioni live.'}),
    ('site.training', 'sections.item_04_body',    'body',    {'it': 'Incontri live con il team MOOD e professionisti del settore.'}),
    ('site.training', 'sections.item_04_cta',     'cta',     {'it': 'Scopri i prossimi eventi'}),

    # ACADEMY — featured full-width card
    ('site.training', 'academy.item_01_eyebrow', 'eyebrow', {'it': 'Academy'}),
    ('site.training', 'academy.item_01_title',   'headline',{'it': 'Cresci con la MOOD Academy.'}),
    ('site.training', 'academy.item_01_body',    'body',    {'it': 'Formazione continua, casi studio e ispirazione per trasformare le tue competenze in valore.'}),
    ('site.training', 'academy.item_01_cta',     'cta',     {'it': 'Scopri di più'}),
]


# ── LOGIN ───────────────────────────────────────────────────────────────
LOGIN_BLOCKS = [
    ('site.login', 'hero.eyebrow', 'eyebrow', {'it': 'Benvenuto su MOOD'}),
    ('site.login', 'hero.title',   'headline',{'it': 'Il tuo spazio. I tuoi progetti. Sempre con te.'}),
    ('site.login', 'hero.body',    'body',
     {'it': 'Accedi al tuo account per continuare a progettare, collaborare e creare valore.'}),
    ('site.login', 'hero.email_label',    'cta', {'it': 'Email'}),
    ('site.login', 'hero.password_label', 'cta', {'it': 'Password'}),
    ('site.login', 'hero.cta_label',      'cta', {'it': 'Accedi'}),
    ('site.login', 'hero.register_prompt',     'body', {'it': 'Non hai un account?'}),
    ('site.login', 'hero.register_link_label', 'cta',  {'it': 'Registrati'}),
]


async def upsert_editorial_block(conn, tenant_id, ns, bk, btype, locales):
    src_val = locales.get('it') or next(iter(locales.values()))
    sh = hashlib.sha256(src_val.encode('utf-8')).hexdigest()
    row = await conn.fetchrow(
        """
        INSERT INTO editorial_blocks
          (id, scope, tenant_id, namespace, block_key, block_type,
           source_locale, source_value, source_hash, is_active, created_at, updated_at)
        VALUES
          (gen_random_uuid(), 'tenant', $1, $2, $3, $4, 'it', $5, $6, true, NOW(), NOW())
        ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE SET
          block_type=EXCLUDED.block_type, source_value=EXCLUDED.source_value,
          source_hash=EXCLUDED.source_hash, updated_at=NOW()
        RETURNING id
        """,
        tenant_id, ns, bk, btype, src_val, sh,
    )
    bid = row['id']
    for loc, val in locales.items():
        await conn.execute(
            """
            INSERT INTO editorial_block_translations
              (id, block_id, locale, value, status, generated_by, source_hash, locked, created_at, updated_at)
            VALUES
              (gen_random_uuid(), $1, $2, $3, 'manual', 'seed', $4, false, NOW(), NOW())
            ON CONFLICT (block_id, locale) DO UPDATE SET
              value=EXCLUDED.value, status='manual', source_hash=EXCLUDED.source_hash, updated_at=NOW()
            """,
            bid, loc, val, sh,
        )


async def find_media(conn, tenant_id, n=8):
    rows = await conn.fetch(
        """SELECT id FROM media_library
           WHERE tenant_id = $1 AND archived_at IS NULL
           ORDER BY created_at DESC LIMIT $2""",
        tenant_id, n,
    )
    return [str(r['id']) for r in rows]


def cycle(arr, n):
    if not arr:
        return [None] * n
    out = []
    while len(out) < n:
        out.extend(arr)
    return out[:n]


async def replace_sections(conn, page_id, sections):
    """sections: list of (section_type, sort_order, settings_dict)."""
    section_types = [s[0] for s in sections]
    if section_types:
        # Remove the section types we're about to insert (idempotent), plus the
        # legacy page_hero / page_intro on these pages.
        await conn.execute(
            f"""DELETE FROM cms_sections
                WHERE page_id = $1
                  AND section_type = ANY($2::text[])""",
            page_id, ['page_hero', 'page_intro'] + section_types,
        )
    for stype, order, settings in sections:
        await conn.execute(
            """INSERT INTO cms_sections
                 (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
               SELECT gen_random_uuid(), tenant_id, id, $2, $3, true, $4::jsonb, NOW(), NOW()
               FROM cms_pages WHERE id = $1""",
            page_id, stype, order, json.dumps(settings),
        )


async def main():
    db_url = os.environ['DATABASE_URL']
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        tenant = await conn.fetchrow("SELECT id FROM tenants WHERE slug = $1", CORP_SLUG)
        if not tenant:
            raise SystemExit(f"Tenant '{CORP_SLUG}' not found")
        tid = tenant['id']
        print(f"→ Tenant: {CORP_SLUG} ({tid})")

        all_blocks = SUPPORT_BLOCKS + TRAINING_BLOCKS + LOGIN_BLOCKS
        for ns, bk, bt, locs in all_blocks:
            await upsert_editorial_block(conn, tid, ns, bk, bt, locs)
        print(f"  ✓ editorial_blocks upserted: {len(all_blocks)}")

        media_ids = await find_media(conn, tid, n=8)
        if not media_ids:
            print("⚠ No media in library — slots will be empty (picker-ready)")
        media_pool = cycle(media_ids, 8)

        # ── SUPPORT page ───────────────────────────────────────────────
        support = await conn.fetchrow("SELECT id FROM cms_pages WHERE tenant_id=$1 AND page_key='support'", tid)
        if not support:
            raise SystemExit("Page 'support' not found — run seed_iter151_pages.py first")

        support_hero_settings = {
            'blocks': {
                'eyebrow':            'site.support.hero.eyebrow',
                'title':              'site.support.hero.title',
                'body':               'site.support.hero.body',
                'search_placeholder': 'site.support.hero.search_placeholder',
                'quick_label':        'site.support.hero.quick_label',
                'link_01_label':      'site.support.hero.link_01_label',
                'link_02_label':      'site.support.hero.link_02_label',
                'link_03_label':      'site.support.hero.link_03_label',
                'link_04_label':      'site.support.hero.link_04_label',
            },
            'media': {'background': media_pool[0]} if media_pool[0] else {},
            'links': {
                'link_01_href': '#guide', 'link_02_href': '#faq',
                'link_03_href': '#contact', 'link_04_href': '#status',
                'search_action': '/supporto',
            },
        }
        support_cards_settings = {
            'blocks': {
                f'item_{k}_eyebrow': f'site.support.sections.item_{k}_eyebrow' for k in ['01','02','03','04']
            } | {
                f'item_{k}_title':   f'site.support.sections.item_{k}_title'   for k in ['01','02','03','04']
            } | {
                f'item_{k}_body':    f'site.support.sections.item_{k}_body'    for k in ['01','02','03','04']
            } | {
                f'item_{k}_cta':     f'site.support.sections.item_{k}_cta'     for k in ['01','02','03','04']
            },
            'media': {
                f'item_{k}': media_pool[i + 1] for i, k in enumerate(['01','02','03','04'])
                if media_pool[i + 1]
            },
            'links': {
                'item_01_href': '#guide', 'item_02_href': '#faq',
                'item_03_href': '#contact', 'item_04_href': '#status',
            },
            'options': {'columns': 4, 'featured_last': False},
        }
        await replace_sections(conn, support['id'], [
            ('support_hero',        0, support_hero_settings),
            ('editorial_card_grid', 1, support_cards_settings),
        ])
        print("  ✓ /supporto: 2 sections inserted")

        # ── TRAINING page ──────────────────────────────────────────────
        training = await conn.fetchrow("SELECT id FROM cms_pages WHERE tenant_id=$1 AND page_key='training'", tid)
        if not training:
            raise SystemExit("Page 'training' not found")

        training_hero_settings = {
            'blocks': {
                'eyebrow':       'site.training.hero.eyebrow',
                'title_line_1':  'site.training.hero.title_line_1',
                'title_line_2':  'site.training.hero.title_line_2',
                'title_line_3':  'site.training.hero.title_line_3',
                'body':          'site.training.hero.body',
                'cta_primary':   'site.training.hero.cta_primary',
                'cta_secondary': 'site.training.hero.cta_secondary',
            },
            'media': {'background': media_pool[0]} if media_pool[0] else {},
            'links': {'cta_primary_href': '#percorsi', 'cta_secondary_href': '#tutorial'},
        }
        training_sections_settings = {
            'blocks': {
                f'item_{k}_eyebrow': f'site.training.sections.item_{k}_eyebrow' for k in ['01','02','03','04']
            } | {
                f'item_{k}_title':   f'site.training.sections.item_{k}_title'   for k in ['01','02','03','04']
            } | {
                f'item_{k}_body':    f'site.training.sections.item_{k}_body'    for k in ['01','02','03','04']
            } | {
                f'item_{k}_cta':     f'site.training.sections.item_{k}_cta'     for k in ['01','02','03','04']
            },
            'media': {
                f'item_{k}': media_pool[i + 1] for i, k in enumerate(['01','02','03','04'])
                if media_pool[i + 1]
            },
            'links': {
                'item_01_href': '#percorsi', 'item_02_href': '#tutorial',
                'item_03_href': '#guide',    'item_04_href': '#webinar',
            },
            'options': {'columns': 2, 'featured_last': False},
        }
        training_academy_settings = {
            'blocks': {
                'item_01_eyebrow': 'site.training.academy.item_01_eyebrow',
                'item_01_title':   'site.training.academy.item_01_title',
                'item_01_body':    'site.training.academy.item_01_body',
                'item_01_cta':     'site.training.academy.item_01_cta',
            },
            'media': {'item_01': media_pool[5]} if media_pool[5] else {},
            'links': {'item_01_href': '#academy'},
            'options': {'columns': 1, 'featured_last': True, 'background': '#0A0A0A'},
        }
        await replace_sections(conn, training['id'], [
            ('training_hero',       0, training_hero_settings),
            ('editorial_card_grid', 1, training_sections_settings),
            ('editorial_card_grid', 2, training_academy_settings),
        ])
        print("  ✓ /formazione: 3 sections inserted")

        # ── LOGIN page ─────────────────────────────────────────────────
        login = await conn.fetchrow("SELECT id FROM cms_pages WHERE tenant_id=$1 AND page_key='login'", tid)
        if not login:
            raise SystemExit("Page 'login' not found")

        login_hero_settings = {
            'blocks': {
                'eyebrow':              'site.login.hero.eyebrow',
                'title':                'site.login.hero.title',
                'body':                 'site.login.hero.body',
                'email_label':          'site.login.hero.email_label',
                'password_label':       'site.login.hero.password_label',
                'cta_label':            'site.login.hero.cta_label',
                'register_prompt':      'site.login.hero.register_prompt',
                'register_link_label':  'site.login.hero.register_link_label',
            },
            'media': {'background': media_pool[0]} if media_pool[0] else {},
            'links': {'register_href': '/dedicato-a', 'forgot_href': '#'},
        }
        await replace_sections(conn, login['id'], [
            ('login_hero', 0, login_hero_settings),
        ])
        print("  ✓ /accedi: 1 section inserted")

        # SEO meta updates
        await conn.execute(
            """UPDATE cms_pages SET locale_meta = jsonb_set(COALESCE(locale_meta,'{}'::jsonb), '{it}',
                 jsonb_build_object('title','Supporto — MOOD for DESIGN',
                                    'description','Trova risposte, guide e risorse per usare al meglio MOOD for DESIGN.'), true)
               WHERE id = $1""", support['id'])
        await conn.execute(
            """UPDATE cms_pages SET locale_meta = jsonb_set(COALESCE(locale_meta,'{}'::jsonb), '{it}',
                 jsonb_build_object('title','Formazione — MOOD for DESIGN',
                                    'description','Risorse, guide e percorsi formativi per usare al massimo MOOD for DESIGN.'), true)
               WHERE id = $1""", training['id'])
        await conn.execute(
            """UPDATE cms_pages SET locale_meta = jsonb_set(COALESCE(locale_meta,'{}'::jsonb), '{it}',
                 jsonb_build_object('title','Accedi — MOOD for DESIGN',
                                    'description','Accedi al tuo account MOOD per continuare a progettare, collaborare e creare valore.'), true)
               WHERE id = $1""", login['id'])
        print("  ✓ SEO meta updated")

        print("\n✅ ITER151f Support / Training / Login rebuild completed.")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
