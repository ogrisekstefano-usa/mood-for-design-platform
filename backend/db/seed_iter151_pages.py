"""
ITER151 — Phase 1 Foundation
─────────────────────────────────────────────────────────────────────────────
Refactors the public website navigation + final CTA + adds 6 new dynamic pages:

  Pages (cms_pages.page_key — canonical EN slug for DB):
    audience  · features · pricing · training · support · login

  IT slugs (frontend routes only; resolve to canonical page_key):
    /dedicato-a · /caratteristiche · /versioni-prezzi · /formazione
    · /supporto · /accedi  (plus /login retained)

  Other locales: en-us/en-uk/fr/de/es — slug mapping is handled
  client-side in the React router (no duplicate DB pages).

Multilingual seed: Italian copy only. Other locales inherit via fallback chain
(IT → EN-US → source_value).

Changes to existing data:
  • home page → navigation section settings rewritten with new items + 'right' list
  • home page → final_cta blocks: cta_primary='Scopri MOOD for DESIGN',
                                  cta_secondary='' (hidden by frontend)

Run:  python /app/backend/db/seed_iter151_pages.py
"""
import asyncio
import hashlib
import json
import os
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

import asyncpg
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')

CORP_SLUG = os.environ.get('CORPORATE_TENANT_SLUG', 'studio')


# ── Editorial blocks (IT only — clean & minimal) ────────────────────────────
# format: (namespace, block_key, block_type, {locale: value})

NAV_BLOCKS = [
    ('site.nav', 'audience',  'label', {
        'it': 'Dedicato a',         'en-us': 'Audience',       'en-uk': 'Audience',
        'fr': 'Dédié à',            'de': 'Zielgruppe',        'es': 'Dedicado a',
    }),
    ('site.nav', 'features',  'label', {
        'it': 'Caratteristiche',    'en-us': 'Features',       'en-uk': 'Features',
        'fr': 'Fonctionnalités',    'de': 'Funktionen',        'es': 'Características',
    }),
    ('site.nav', 'pricing',   'label', {
        'it': 'Versioni e Prezzi',  'en-us': 'Editions & Pricing', 'en-uk': 'Editions & Pricing',
        'fr': 'Versions & Prix',    'de': 'Versionen & Preise',    'es': 'Ediciones y Precios',
    }),
    ('site.nav', 'training',  'label', {
        'it': 'Formazione',         'en-us': 'Training',       'en-uk': 'Training',
        'fr': 'Formation',          'de': 'Schulung',          'es': 'Formación',
    }),
    ('site.nav', 'support',   'label', {
        'it': 'Supporto',           'en-us': 'Support',        'en-uk': 'Support',
        'fr': 'Assistance',         'de': 'Support',           'es': 'Soporte',
    }),
    ('site.nav', 'login',     'label', {
        'it': 'Accedi',             'en-us': 'Sign in',        'en-uk': 'Sign in',
        'fr': 'Connexion',          'de': 'Anmelden',          'es': 'Acceder',
    }),
]

# Pages content blocks — namespace, block_key, type, locales
PAGE_BLOCKS = [
    # AUDIENCE — "Dedicato a"
    ('site.audience', 'hero.eyebrow',  'eyebrow',     {'it': 'Per chi è pensata MOOD'}),
    ('site.audience', 'hero.title',    'headline',    {'it': 'Una piattaforma per chi disegna il vivere.'}),
    ('site.audience', 'hero.subtitle', 'body',        {'it': 'Architetti, interior designer, studi, retailer del mobile, fornitori di pietre e materia, sviluppatori, ospitalità di lusso. MOOD for DESIGN nasce per le persone che trasformano spazi in narrazione.'}),
    ('site.audience', 'intro.body',    'body',        {'it': 'Ogni mestiere ha la sua intenzione. MOOD modella i flussi su chi li abita — strumenti calibrati, linguaggi condivisi, processi editoriali. Non un software universale: un sistema che riconosce la cultura del progetto.'}),
    ('site.audience', 'cta.label',     'cta',         {'it': 'Scopri MOOD for DESIGN'}),
    ('site.audience', 'seo.title',     'seo',         {'it': 'Dedicato a — MOOD for DESIGN'}),
    ('site.audience', 'seo.description','seo',        {'it': 'La piattaforma editoriale per architetti, interior designer, studi, retailer del mobile, fornitori di materia e ospitalità di lusso.'}),

    # FEATURES — "Caratteristiche"
    ('site.features', 'hero.eyebrow',   'eyebrow',    {'it': 'L\'ecosistema operativo'}),
    ('site.features', 'hero.title',     'headline',   {'it': 'Strumenti che pensano come voi.'}),
    ('site.features', 'hero.subtitle',  'body',       {'it': 'Moodboard, flussi di progetto, libreria materia, narrazione editoriale. Ogni elemento dell\'esperienza MOOD è disegnato per restituire tempo, contesto e relazione.'}),
    ('site.features', 'intro.body',     'body',       {'it': 'Non una suite di funzioni, ma una grammatica condivisa. Le caratteristiche di MOOD nascono dall\'osservazione di studi reali — i loro gesti, le loro pause, i loro archivi di intenzione.'}),
    ('site.features', 'cta.label',      'cta',        {'it': 'Scopri MOOD for DESIGN'}),
    ('site.features', 'seo.title',      'seo',        {'it': 'Caratteristiche — MOOD for DESIGN'}),
    ('site.features', 'seo.description','seo',        {'it': 'L\'ecosistema MOOD: moodboard editoriali, flussi di progetto, libreria materia, storytelling visuale, Blueprint Command Center.'}),

    # PRICING — "Versioni e Prezzi"
    ('site.pricing', 'hero.eyebrow',   'eyebrow',     {'it': 'Versioni e accesso'}),
    ('site.pricing', 'hero.title',     'headline',    {'it': 'Un sistema, più atelier.'}),
    ('site.pricing', 'hero.subtitle',  'body',        {'it': 'MOOD si adatta alla dimensione e alla cultura del vostro studio. Dall\'atelier indipendente al network internazionale — versioni calibrate su intenzione, volume e disciplina.'}),
    ('site.pricing', 'intro.body',     'body',        {'it': 'L\'accesso è curato. Ogni piano nasce dopo un dialogo: comprendere il vostro modo di progettare prima di proporre uno strumento. Nessuna registrazione pubblica — solo onboarding guidato.'}),
    ('site.pricing', 'cta.label',      'cta',         {'it': 'Richiedi una demo'}),
    ('site.pricing', 'seo.title',      'seo',         {'it': 'Versioni e Prezzi — MOOD for DESIGN'}),
    ('site.pricing', 'seo.description','seo',         {'it': 'Versioni MOOD calibrate per atelier, studi e network internazionali. Accesso curato tramite demo e onboarding guidato.'}),

    # TRAINING — "Formazione"
    ('site.training', 'hero.eyebrow',   'eyebrow',    {'it': 'MOOD Academy'}),
    ('site.training', 'hero.title',     'headline',   {'it': 'Imparare il mestiere editoriale del progetto.'}),
    ('site.training', 'hero.subtitle',  'body',       {'it': 'Webinar curati, tutorial, percorsi di certificazione e formazione per i partner. Una scuola privata di metodo — pensata per chi vuole governare il proprio studio come una redazione.'}),
    ('site.training', 'intro.body',     'body',       {'it': 'La piattaforma è uno strumento; il metodo è una cultura. MOOD Academy trasmette il linguaggio editoriale del progetto attraverso sessioni concrete, esempi reali e mentorship dedicata.'}),
    ('site.training', 'cta.label',      'cta',        {'it': 'Esplora MOOD Academy'}),
    ('site.training', 'seo.title',      'seo',        {'it': 'Formazione — MOOD Academy'}),
    ('site.training', 'seo.description','seo',        {'it': 'MOOD Academy: formazione editoriale per studi e partner — webinar, tutorial, certificazione, onboarding e mentorship.'}),

    # SUPPORT — "Supporto"
    ('site.support', 'hero.eyebrow',   'eyebrow',     {'it': 'Centro assistenza'}),
    ('site.support', 'hero.title',     'headline',    {'it': 'Vicini al vostro studio.'}),
    ('site.support', 'hero.subtitle',  'body',        {'it': 'Documentazione curata, risposte rapide, guide pratiche e contatto diretto con il team MOOD. Il supporto è parte dell\'esperienza, non un\'eccezione.'}),
    ('site.support', 'intro.body',     'body',        {'it': 'Ogni domanda merita una risposta puntuale e contestualizzata. Il team MOOD ascolta, indirizza e accompagna — nella tradizione del servizio editoriale di alto livello.'}),
    ('site.support', 'cta.label',      'cta',         {'it': 'Contatta il team'}),
    ('site.support', 'seo.title',      'seo',         {'it': 'Supporto — MOOD for DESIGN'}),
    ('site.support', 'seo.description','seo',         {'it': 'Centro assistenza MOOD: documentazione, guide pratiche e contatto diretto con il team editoriale.'}),

    # LOGIN — "Accedi"
    ('site.login', 'hero.eyebrow',    'eyebrow',      {'it': 'Area riservata'}),
    ('site.login', 'hero.title',      'headline',     {'it': 'Accedi al vostro spazio.'}),
    ('site.login', 'hero.subtitle',   'body',         {'it': 'L\'accesso a MOOD è riservato agli studi accreditati. Inserite le vostre credenziali per entrare nell\'ecosistema editoriale.'}),
    ('site.login', 'form.email',      'label',        {'it': 'Email professionale'}),
    ('site.login', 'form.password',   'label',        {'it': 'Password'}),
    ('site.login', 'form.submit',     'cta',          {'it': 'Accedi'}),
    ('site.login', 'form.forgot',     'cta',          {'it': 'Password dimenticata?'}),
    ('site.login', 'form.no_access',  'body',         {'it': 'Non avete ancora accesso? La registrazione avviene tramite onboarding curato.'}),
    ('site.login', 'seo.title',       'seo',          {'it': 'Accedi — MOOD for DESIGN'}),
    ('site.login', 'seo.description', 'seo',          {'it': 'Accesso all\'ecosistema MOOD for DESIGN. Area riservata per studi accreditati.'}),
]

# Updated Final CTA — single button only
# NOTE: site_resolver._split_block_key splits "a.b.c.d" as ns="a.b", key="c.d"
# so we use namespace='site.home' and key='final_cta.cta_primary' (no extra dot in ns).
# For "empty" values, we set ALL locales to '' so no fallback restores the old copy.
FINAL_CTA_BLOCKS = [
    ('site.home', 'final_cta.cta_primary',   'cta',  {'it': 'Scopri MOOD for DESIGN', 'en-us': 'Discover MOOD for DESIGN'}),
    ('site.home', 'final_cta.cta_secondary', 'cta',  {'it': '', 'en-us': '', 'en-uk': '', 'fr': '', 'de': '', 'es': ''}),
    ('site.home', 'hero.cta_primary',        'cta',  {'it': 'Scopri MOOD for DESIGN', 'en-us': 'Discover MOOD for DESIGN'}),
    ('site.home', 'hero.cta_secondary',      'cta',  {'it': '', 'en-us': '', 'en-uk': '', 'fr': '', 'de': '', 'es': ''}),
]


# Page skeletons — each one gets a `page_hero` and `page_intro` section minimally
PAGES = [
    # page_key, title, hero_section_settings, intro_section_settings, seo_block_prefix
    {
        'key': 'audience', 'title': 'Dedicato a',
        'ns': 'site.audience',
    },
    {
        'key': 'features', 'title': 'Caratteristiche',
        'ns': 'site.features',
    },
    {
        'key': 'pricing', 'title': 'Versioni e Prezzi',
        'ns': 'site.pricing',
    },
    {
        'key': 'training', 'title': 'Formazione',
        'ns': 'site.training',
    },
    {
        'key': 'support', 'title': 'Supporto',
        'ns': 'site.support',
    },
    {
        'key': 'login', 'title': 'Accedi',
        'ns': 'site.login',
    },
]


# Navigation rewrite (home page navigation section)
NAV_ITEMS = [
    {'key': 'audience',  'href': '/dedicato-a',      'label_block': 'site.nav.audience',  'visible': True, 'position': 'main',  'fallback': 'Dedicato a'},
    {'key': 'features',  'href': '/caratteristiche', 'label_block': 'site.nav.features',  'visible': True, 'position': 'main',  'fallback': 'Caratteristiche'},
    {'key': 'pricing',   'href': '/versioni-prezzi', 'label_block': 'site.nav.pricing',   'visible': True, 'position': 'main',  'fallback': 'Versioni e Prezzi'},
    {'key': 'training',  'href': '/formazione',      'label_block': 'site.nav.training',  'visible': True, 'position': 'main',  'fallback': 'Formazione'},
    {'key': 'support',   'href': '/supporto',        'label_block': 'site.nav.support',   'visible': True, 'position': 'right', 'fallback': 'Supporto'},
    {'key': 'login',     'href': '/accedi',          'label_block': 'site.nav.login',     'visible': True, 'position': 'right', 'fallback': 'Accedi'},
]


# ── Helpers ────────────────────────────────────────────────────────────────

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
          block_type    = EXCLUDED.block_type,
          source_value  = EXCLUDED.source_value,
          source_hash   = EXCLUDED.source_hash,
          updated_at    = NOW()
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


async def upsert_page(conn, tenant_id, page_key, title, ns):
    """Create or update a published page with hero + intro sections."""
    page_row = await conn.fetchrow(
        """
        INSERT INTO cms_pages
          (id, tenant_id, page_key, title, status, locale_meta, created_at, updated_at, published_at)
        VALUES
          (gen_random_uuid(), $1, $2, $3, 'published', '{}'::jsonb, NOW(), NOW(), NOW())
        ON CONFLICT (tenant_id, page_key) DO UPDATE SET
          title=EXCLUDED.title, status='published',
          published_at=COALESCE(cms_pages.published_at, NOW()),
          updated_at=NOW()
        RETURNING id
        """,
        tenant_id, page_key, title,
    )
    pid = page_row['id']

    # Wipe existing sections (idempotent reseed)
    await conn.execute(
        "DELETE FROM cms_sections WHERE page_id = $1 AND section_type IN ('page_hero', 'page_intro')",
        pid,
    )

    hero_settings = {
        'blocks': {
            'eyebrow':  f'{ns}.hero.eyebrow',
            'title':    f'{ns}.hero.title',
            'subtitle': f'{ns}.hero.subtitle',
        },
    }
    intro_settings = {
        'blocks': {
            'body':      f'{ns}.intro.body',
            'cta_label': f'{ns}.cta.label',
        },
        'links': {'cta_href': '/dedicato-a' if page_key != 'audience' else '/caratteristiche'},
    }
    await conn.execute(
        """
        INSERT INTO cms_sections
          (id, tenant_id, page_id, section_type, sort_order, visible, settings,
           created_at, updated_at)
        VALUES
          (gen_random_uuid(), $1, $2, 'page_hero', 0, true, $3::jsonb, NOW(), NOW())
        """,
        tenant_id, pid, json.dumps(hero_settings),
    )
    await conn.execute(
        """
        INSERT INTO cms_sections
          (id, tenant_id, page_id, section_type, sort_order, visible, settings,
           created_at, updated_at)
        VALUES
          (gen_random_uuid(), $1, $2, 'page_intro', 1, true, $3::jsonb, NOW(), NOW())
        """,
        tenant_id, pid, json.dumps(intro_settings),
    )
    # SEO
    await conn.execute(
        """
        UPDATE cms_pages SET locale_meta = jsonb_set(
          COALESCE(locale_meta, '{}'::jsonb), '{it}',
          jsonb_build_object('title', $1::text, 'description', $2::text), true
        ) WHERE id = $3
        """,
        f'__seo_title_for_{page_key}__',  # placeholder — frontend resolves block directly
        f'__seo_desc_for_{page_key}__',
        pid,
    )


async def rewrite_home_navigation(conn, tenant_id):
    home = await conn.fetchrow(
        "SELECT id FROM cms_pages WHERE tenant_id = $1 AND page_key = 'home'",
        tenant_id,
    )
    if not home:
        print("⚠ Home page not found; skipping navigation update")
        return
    # Clean slate: remove all existing navigation sections (could be multiple)
    await conn.execute(
        "DELETE FROM cms_sections WHERE page_id = $1 AND section_type = 'navigation'",
        home['id'],
    )
    settings = {'items': NAV_ITEMS}  # no CTA, just items grouped by `position`
    await conn.execute(
        """
        INSERT INTO cms_sections
          (id, tenant_id, page_id, section_type, sort_order, visible, settings,
           created_at, updated_at)
        VALUES
          (gen_random_uuid(), $1, $2, 'navigation', -10, true, $3::jsonb, NOW(), NOW())
        """,
        tenant_id, home['id'], json.dumps(settings),
    )


# ── Main ───────────────────────────────────────────────────────────────────

async def main():
    db_url = os.environ['DATABASE_URL']
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        # Resolve corporate tenant
        tenant = await conn.fetchrow(
            "SELECT id FROM tenants WHERE slug = $1",
            CORP_SLUG,
        )
        if not tenant:
            raise SystemExit(f"Tenant '{CORP_SLUG}' not found")
        tid = tenant['id']
        print(f"→ Tenant: {CORP_SLUG} ({tid})")

        # 1) Editorial blocks (nav + pages + final_cta override)
        all_blocks = NAV_BLOCKS + PAGE_BLOCKS + FINAL_CTA_BLOCKS
        for ns, bk, btype, locales in all_blocks:
            await upsert_editorial_block(conn, tid, ns, bk, btype, locales)
        print(f"  ✓ editorial_blocks upserted: {len(all_blocks)}")

        # 2) Pages
        for p in PAGES:
            await upsert_page(conn, tid, p['key'], p['title'], p['ns'])
        print(f"  ✓ cms_pages + sections upserted: {len(PAGES)}")

        # 3) Navigation rewrite
        await rewrite_home_navigation(conn, tid)
        print("  ✓ home navigation rewritten with new items + 'right' group")

        print("\n✅ ITER151 Phase 1 seed completed.")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
