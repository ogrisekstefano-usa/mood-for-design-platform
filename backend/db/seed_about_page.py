"""
seed_about_page.py
─────────────────────────────────────────────────────────────────────────────
Phase 3 — Task 3: Seed the About page CMS structure.

Creates sections and editorial_blocks for site.about.
Founder-specific data uses [PLACEHOLDER] markers — these are filtered out
on the frontend until real content is provided.

Idempotente. Run: cd /app/backend && python -m db.seed_about_page
"""
import asyncio
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


# ── Editorial blocks ───────────────────────────────────────────────────────
# (namespace, block_key, block_type, {locale: value})
# [PLACEHOLDER] values are filtered on the frontend — they signal "not ready".

ABOUT_BLOCKS = [
    # — Page Hero (real content, always visible) ——————————————————————————
    ('site.about', 'hero.eyebrow', 'eyebrow', {
        'it-IT': 'La metodologia',
        'en-US': 'The methodology',
    }),
    ('site.about', 'hero.title', 'headline', {
        'it-IT': 'Da dove viene Design Journey™.',
        'en-US': 'Where Design Journey™ comes from.',
    }),
    ('site.about', 'hero.subtitle', 'body', {
        'it-IT': (
            'MOOD for DESIGN nasce da anni di lavoro sul campo — in studi di design, '
            'showroom e mercati internazionali — con un unico obiettivo: '
            'rendere il progetto di design leggibile, preservabile e trasmissibile.'
        ),
        'en-US': (
            'MOOD for DESIGN emerges from years of field work — in design studios, '
            'showrooms, and international markets — with a single purpose: '
            'making the design project legible, preservable, and transmissible.'
        ),
    }),

    # — Founder section (PLACEHOLDER — hidden until founder provides real data) —
    ('site.about', 'founder.eyebrow', 'eyebrow', {
        'it-IT': '[PLACEHOLDER]',
        'en-US': '[PLACEHOLDER]',
    }),
    ('site.about', 'founder.name', 'headline', {
        'it-IT': '[PLACEHOLDER]',
        'en-US': '[PLACEHOLDER]',
    }),
    ('site.about', 'founder.role', 'body', {
        'it-IT': '[PLACEHOLDER]',
        'en-US': '[PLACEHOLDER]',
    }),
    ('site.about', 'founder.bio', 'body', {
        'it-IT': '[PLACEHOLDER]',
        'en-US': '[PLACEHOLDER]',
    }),
    ('site.about', 'founder.photo_alt', 'body', {
        'it-IT': '[PLACEHOLDER]',
        'en-US': '[PLACEHOLDER]',
    }),

    # — Metrics strip (PLACEHOLDER — hidden until founder provides real data) —
    ('site.about', 'metrics.eyebrow', 'eyebrow', {
        'it-IT': '[PLACEHOLDER]',
        'en-US': '[PLACEHOLDER]',
    }),
    ('site.about', 'metrics.years_label', 'body', {
        'it-IT': '[PLACEHOLDER]',
        'en-US': '[PLACEHOLDER]',
    }),
    ('site.about', 'metrics.years_value', 'headline', {
        'it-IT': '[PLACEHOLDER]',
        'en-US': '[PLACEHOLDER]',
    }),
    ('site.about', 'metrics.markets_label', 'body', {
        'it-IT': '[PLACEHOLDER]',
        'en-US': '[PLACEHOLDER]',
    }),
    ('site.about', 'metrics.markets_value', 'headline', {
        'it-IT': '[PLACEHOLDER]',
        'en-US': '[PLACEHOLDER]',
    }),
    ('site.about', 'metrics.studios_label', 'body', {
        'it-IT': '[PLACEHOLDER]',
        'en-US': '[PLACEHOLDER]',
    }),
    ('site.about', 'metrics.studios_value', 'headline', {
        'it-IT': '[PLACEHOLDER]',
        'en-US': '[PLACEHOLDER]',
    }),

    # — Founder quote (PLACEHOLDER — hidden until real data) ——————————————
    ('site.about', 'quote.text', 'body', {
        'it-IT': '[PLACEHOLDER]',
        'en-US': '[PLACEHOLDER]',
    }),
    ('site.about', 'quote.attribution', 'body', {
        'it-IT': '[PLACEHOLDER]',
        'en-US': '[PLACEHOLDER]',
    }),

    # — Vision section (real content) ————————————————————————————————————
    ('site.about', 'vision.eyebrow', 'eyebrow', {
        'it-IT': 'La visione',
        'en-US': 'The vision',
    }),
    ('site.about', 'vision.title', 'headline', {
        'it-IT': 'Un progetto editoriale sul progetto di design.',
        'en-US': 'An editorial project about the design project.',
    }),
    ('site.about', 'vision.body', 'body', {
        'it-IT': (
            'Il progetto di design è molto più di un insieme di scelte estetiche: '
            'è una sequenza di decisioni motivate, relazioni tra professionisti, '
            'materiali scelti e scartati, una conversazione con il cliente che dura '
            'anni. MOOD for DESIGN costruisce l\'infrastruttura per preservare '
            'e trasmettere tutto questo — fase per fase, progetto per progetto.'
        ),
        'en-US': (
            'The design project is far more than a set of aesthetic choices: '
            'it is a sequence of motivated decisions, relationships between '
            'professionals, materials chosen and discarded, a conversation with '
            'a client that lasts years. MOOD for DESIGN builds the infrastructure '
            'to preserve and transmit all of this — phase by phase, project by project.'
        ),
    }),

    # — CTA (real content) ————————————————————————————————————————————————
    ('site.about', 'cta.title', 'headline', {
        'it-IT': 'Entra nell\'ecosistema.',
        'en-US': 'Enter the ecosystem.',
    }),
    ('site.about', 'cta.body', 'body', {
        'it-IT': (
            'Scopri come Blueprint™ e Design Journey™ '
            'possono trasformare il modo in cui il tuo studio lavora.'
        ),
        'en-US': (
            'Discover how Blueprint™ and Design Journey™ '
            'can transform the way your studio works.'
        ),
    }),
    ('site.about', 'cta.label', 'cta', {
        'it-IT': 'Candidati a MOOD',
        'en-US': 'Apply to MOOD',
    }),
]


# ── Helpers ────────────────────────────────────────────────────────────────
async def upsert_block(conn, tenant_id, ns, bk, btype, locales):
    import hashlib
    src_val = locales.get('it-IT') or locales.get('en-US') or next(iter(locales.values()))
    sh = hashlib.sha256(src_val.encode('utf-8')).hexdigest()
    row = await conn.fetchrow(
        """
        INSERT INTO editorial_blocks
          (id, scope, tenant_id, namespace, block_key, block_type,
           source_locale, source_value, source_hash, is_active, created_at, updated_at)
        VALUES
          (gen_random_uuid(), 'tenant', $1, $2, $3, $4, 'it-IT', $5, $6, true, NOW(), NOW())
        ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE SET
          block_type = EXCLUDED.block_type,
          source_value = EXCLUDED.source_value,
          source_hash = EXCLUDED.source_hash,
          updated_at = NOW()
        RETURNING id
        """,
        tenant_id, ns, bk, btype, src_val, sh,
    )
    bid = row['id']
    for loc, val in locales.items():
        await conn.execute(
            """
            INSERT INTO editorial_block_translations
              (id, block_id, locale, value, status, generated_by,
               source_hash, locked, created_at, updated_at)
            VALUES
              (gen_random_uuid(), $1, $2, $3, 'manual', 'seed-about-page',
               $4, false, NOW(), NOW())
            ON CONFLICT (block_id, locale) DO UPDATE SET
              value = EXCLUDED.value,
              status = 'manual',
              source_hash = EXCLUDED.source_hash,
              updated_at = NOW()
            """,
            bid, loc, val, sh,
        )
    return bid


async def main():
    db_url = os.environ['DATABASE_URL']
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        tenant = await conn.fetchrow("SELECT id FROM tenants WHERE slug = $1", CORP_SLUG)
        if not tenant:
            raise SystemExit(f"Tenant '{CORP_SLUG}' not found")
        tid = tenant['id']
        print(f"→ Tenant: {CORP_SLUG} ({tid})")

        # Upsert all blocks
        for ns, bk, bt, locs in ABOUT_BLOCKS:
            await upsert_block(conn, tid, ns, bk, bt, locs)
        print(f"  ✓ editorial_blocks upserted: {len(ABOUT_BLOCKS)}")

        # Ensure page exists
        page = await conn.fetchrow(
            "SELECT id FROM cms_pages WHERE tenant_id = $1 AND page_key = 'about'",
            tid,
        )
        if not page:
            page = await conn.fetchrow(
                """INSERT INTO cms_pages
                     (id, tenant_id, page_key, title, slug, is_active, created_at, updated_at)
                   VALUES (gen_random_uuid(), $1, 'about', 'About', '/about', true, NOW(), NOW())
                   RETURNING id""",
                tid,
            )
            print("  ✓ about page created")

        page_id = page['id']

        # Clear existing about sections to rebuild cleanly
        await conn.execute(
            "DELETE FROM cms_sections WHERE page_id = $1",
            page_id,
        )

        # Section 1 — page_hero (real content, always visible)
        hero_settings = {
            'blocks': {
                'eyebrow':  'site.about.hero.eyebrow',
                'title':    'site.about.hero.title',
                'subtitle': 'site.about.hero.subtitle',
            },
        }
        await conn.execute(
            """INSERT INTO cms_sections
                 (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'page_hero', 0, true, $3::jsonb, NOW(), NOW())""",
            tid, page_id, json.dumps(hero_settings),
        )

        # Section 2 — founder split (PLACEHOLDER — filtered on frontend)
        founder_settings = {
            'blocks': {
                'eyebrow':   'site.about.founder.eyebrow',
                'title':     'site.about.founder.name',
                'subtitle':  'site.about.founder.role',
                'body':      'site.about.founder.bio',
                'image_alt': 'site.about.founder.photo_alt',
            },
        }
        await conn.execute(
            """INSERT INTO cms_sections
                 (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'editorial_body_with_photo', 1, true, $3::jsonb, NOW(), NOW())""",
            tid, page_id, json.dumps(founder_settings),
        )

        # Section 3 — metrics_strip (PLACEHOLDER — filtered on frontend)
        metrics_settings = {
            'blocks': {
                'eyebrow':        'site.about.metrics.eyebrow',
                'metric_01_val':  'site.about.metrics.years_value',
                'metric_01_label':'site.about.metrics.years_label',
                'metric_02_val':  'site.about.metrics.markets_value',
                'metric_02_label':'site.about.metrics.markets_label',
                'metric_03_val':  'site.about.metrics.studios_value',
                'metric_03_label':'site.about.metrics.studios_label',
            },
        }
        await conn.execute(
            """INSERT INTO cms_sections
                 (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'metrics_strip', 2, true, $3::jsonb, NOW(), NOW())""",
            tid, page_id, json.dumps(metrics_settings),
        )

        # Section 4 — cinematic_quote (PLACEHOLDER — filtered on frontend)
        quote_settings = {
            'blocks': {
                'quote':       'site.about.quote.text',
                'attribution': 'site.about.quote.attribution',
            },
        }
        await conn.execute(
            """INSERT INTO cms_sections
                 (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'cinematic_quote', 3, true, $3::jsonb, NOW(), NOW())""",
            tid, page_id, json.dumps(quote_settings),
        )

        # Section 5 — vision editorial_body (real content, always visible)
        vision_settings = {
            'blocks': {
                'eyebrow': 'site.about.vision.eyebrow',
                'title':   'site.about.vision.title',
                'body':    'site.about.vision.body',
            },
        }
        await conn.execute(
            """INSERT INTO cms_sections
                 (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'page_intro', 4, true, $3::jsonb, NOW(), NOW())""",
            tid, page_id, json.dumps(vision_settings),
        )

        # Section 6 — final_cta_immersive (real content, always visible)
        cta_settings = {
            'blocks': {
                'title':     'site.about.cta.title',
                'body':      'site.about.cta.body',
                'cta_label': 'site.about.cta.label',
            },
            'links': {'cta_href': '/studio'},
        }
        await conn.execute(
            """INSERT INTO cms_sections
                 (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'final_cta_immersive', 5, true, $3::jsonb, NOW(), NOW())""",
            tid, page_id, json.dumps(cta_settings),
        )

        print("  ✓ 6 sections created (2 real + 3 placeholder + 1 cta)")

        # Update SEO meta
        await conn.execute(
            """UPDATE cms_pages SET locale_meta = jsonb_set(
                 COALESCE(locale_meta, '{}'::jsonb), '{it-IT}',
                 jsonb_build_object(
                   'title',       'Chi siamo — MOOD for DESIGN e la metodologia Design Journey™',
                   'description', 'Da dove viene Design Journey™: anni di esperienza internazionale nel design.'
                 ), true
               ) WHERE id = $1""",
            page_id,
        )
        print("  ✓ SEO meta updated (it-IT)")
        print("\n✅  About page seed completed.")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
