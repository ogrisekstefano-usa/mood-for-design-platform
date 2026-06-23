"""
seed_about_page_corporate.py
─────────────────────────────────────────────────────────────────────────────
About page — corporate rewrite.
Zero founder references. MOOD for DESIGN come progetto, non come persona.
Modello: Salesforce, Linear, Figma.

Esegue in ordine:
  1) DELETE blocchi PLACEHOLDER / founder / metrics / quote da site.about
  2) UPSERT nuovi blocchi corporate definitivi (source_value IT + en-US translation)
  3) Rebuild cms_sections per about page (6 sezioni)
  4) Verifica finale → 0 PLACEHOLDER attivi

Idempotente. Run: cd /app/backend && python -m db.seed_about_page_corporate
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


# ── New corporate copy ─────────────────────────────────────────────────────
ABOUT_BLOCKS = {
    # ── SEO ──────────────────────────────────────────────────────────────
    'seo.title': {
        'it-IT': 'Il progetto — MOOD for DESIGN',
        'en-US': 'The project — MOOD for DESIGN',
    },
    'seo.description': {
        'it-IT': (
            'MOOD for DESIGN è il primo ecosistema editoriale per il progetto '
            'contemporaneo. Design Journey™ e Blueprint™: metodologia e '
            'infrastruttura per studi, showroom e brand del design.'
        ),
        'en-US': (
            'MOOD for DESIGN is the first editorial ecosystem for the contemporary '
            'design project. Design Journey™ and Blueprint™: methodology and '
            'infrastructure for studios, showrooms, and design brands.'
        ),
    },

    # ── Hero ─────────────────────────────────────────────────────────────
    'hero.eyebrow': {
        'it-IT': 'Il progetto',
        'en-US': 'The project',
    },
    'hero.title': {
        'it-IT': 'Una nuova categoria per il progetto di design.',
        'en-US': 'A new category for the design project.',
    },
    'hero.subtitle': {
        'it-IT': (
            'MOOD for DESIGN è il primo ecosistema editoriale per la conduzione '
            'del progetto contemporaneo. Non un software, non un CRM, non uno '
            'strumento di moodboard: una metodologia operativa e '
            "un'infrastruttura editoriale costruite per il design."
        ),
        'en-US': (
            'MOOD for DESIGN is the first editorial ecosystem for the contemporary '
            'design project. Not software, not a CRM, not a moodboard tool: '
            'an operational methodology and an editorial infrastructure '
            'built for design.'
        ),
    },

    # ── Perché esiste ─────────────────────────────────────────────────────
    'why.eyebrow': {
        'it-IT': 'Perché esiste',
        'en-US': 'Why it exists',
    },
    'why.title': {
        'it-IT': 'Il settore del design è cresciuto in ogni direzione eccetto una.',
        'en-US': 'The design sector has grown in every direction except one.',
    },
    'why.body': {
        'it-IT': (
            'Più strumenti, più mercati, più visibilità. Ma il modo in cui un progetto '
            'viene custodito è rimasto invariato: email, cartelle Dropbox, messaggi '
            'sparsi, memoria individuale.\n\n'
            'Il singolo asset più importante dello studio di design — la memoria delle '
            'decisioni progettuali — si disperde il giorno della consegna. '
            'E si ricostruisce da zero al prossimo progetto.\n\n'
            'MOOD for DESIGN è stato costruito per affrontare questa dispersione. '
            'Non con un altro strumento. Con un metodo che tiene insieme gli strumenti '
            "già in uso, e un'infrastruttura editoriale che rende il metodo operativo "
            'nel lavoro quotidiano dello studio.'
        ),
        'en-US': (
            'More tools, more markets, more visibility. But the way a project is '
            'preserved has stayed the same: emails, Dropbox folders, scattered '
            'messages, individual memory.\n\n'
            'The single most important asset of a design studio — the memory of '
            'design decisions — dissolves on the day of delivery. '
            'And is rebuilt from scratch on the next project.\n\n'
            'MOOD for DESIGN was built to address this dissolution. '
            'Not with another tool. With a method that holds existing tools together, '
            'and an editorial infrastructure that makes the method operational in '
            'the daily work of the studio.'
        ),
    },

    # ── Mercati ───────────────────────────────────────────────────────────
    'markets.eyebrow': {
        'it-IT': 'Dove operiamo',
        'en-US': 'Where we operate',
    },
    'markets.title': {
        'it-IT': 'Stati Uniti e Italia.\nDue mercati, una metodologia.',
        'en-US': 'United States and Italy.\nTwo markets, one methodology.',
    },
    'markets.body': {
        'it-IT': (
            'MOOD for DESIGN opera negli Stati Uniti — Chicago, New York, '
            'Los Angeles — e in Italia, primo mercato europeo. '
            'La metodologia Design Journey™ è nata dal contatto diretto con '
            'le pratiche progettuali di entrambi i mercati e con le reti '
            'internazionali di showroom e brand del design.\n\n'
            "L'espansione verso Francia, Spagna e Germania è in corso."
        ),
        'en-US': (
            'MOOD for DESIGN operates in the United States — Chicago, New York, '
            'Los Angeles — and in Italy, our first European market. '
            'The Design Journey™ methodology was born from direct contact with '
            'the design practices of both markets and with the international '
            'networks of showrooms and design brands.\n\n'
            'Expansion into France, Spain, and Germany is underway.'
        ),
    },

    # ── I due pilastri ────────────────────────────────────────────────────
    'pillars.eyebrow': {
        'it-IT': 'Come funziona',
        'en-US': 'How it works',
    },
    'pillars.title': {
        'it-IT': 'Due pilastri. Un ecosistema.',
        'en-US': 'Two pillars. One ecosystem.',
    },
    'pillars.pillar1.label': {
        'it-IT': 'Design Journey™',
        'en-US': 'Design Journey™',
    },
    'pillars.pillar1.body': {
        'it-IT': (
            'La metodologia in sette fasi per condurre, raccontare e custodire '
            'il progetto contemporaneo. Ogni fase lascia una traccia leggibile '
            'per studio, cliente, showroom e brand.'
        ),
        'en-US': (
            'The seven-phase methodology for leading, narrating, and preserving '
            'the contemporary design project. Every phase leaves a legible trace '
            'for studio, client, showroom, and brand.'
        ),
    },
    'pillars.pillar1.cta': {
        'it-IT': 'Esplora il Design Journey™',
        'en-US': 'Explore Design Journey™',
    },
    'pillars.pillar2.label': {
        'it-IT': 'Blueprint™',
        'en-US': 'Blueprint™',
    },
    'pillars.pillar2.body': {
        'it-IT': (
            "L'infrastruttura editoriale che rende il Journey™ operativo. "
            'Non si compra: si configura per ogni studio specifico, '
            'dopo una conversazione iniziale.'
        ),
        'en-US': (
            'The editorial infrastructure that makes the Journey™ operational. '
            "It isn't bought: it's configured for each specific studio, "
            'after an opening conversation.'
        ),
    },
    'pillars.pillar2.cta': {
        'it-IT': 'Vedi le configurazioni',
        'en-US': 'See configurations',
    },

    # ── Osservazioni (anonime) ────────────────────────────────────────────
    'observations.eyebrow': {
        'it-IT': 'Il problema che risolviamo',
        'en-US': 'The problem we solve',
    },
    'observations.title': {
        'it-IT': 'Tre osservazioni. Una risposta.',
        'en-US': 'Three observations. One answer.',
    },
    'observations.obs1.label': {
        'it-IT': '01 · La frammentazione è universale.',
        'en-US': '01 · Fragmentation is universal.',
    },
    'observations.obs1.body': {
        'it-IT': (
            'Da New York a Milano, gli studi di interior e architettura affrontano '
            'lo stesso problema: dieci strumenti scollegati, nessuna memoria condivisa.'
        ),
        'en-US': (
            'From New York to Milan, interior and architecture studios face the same '
            'problem: ten disconnected tools, no shared memory.'
        ),
    },
    'observations.obs2.label': {
        'it-IT': '02 · Lo showroom è sottovalutato.',
        'en-US': '02 · The showroom is undervalued.',
    },
    'observations.obs2.body': {
        'it-IT': (
            'La curatela materica dello showroom è il singolo asset più sottovalutato '
            'del settore. Riconoscerla come autorialità del progetto crea valore '
            'per tutti gli attori.'
        ),
        'en-US': (
            "The showroom's material curation is the single most undervalued asset in "
            'the sector. Recognizing it as project authorship creates value for all actors.'
        ),
    },
    'observations.obs3.label': {
        'it-IT': '03 · Il cliente premium chiede continuità.',
        'en-US': '03 · The premium client wants continuity.',
    },
    'observations.obs3.body': {
        'it-IT': (
            'Il cliente di un progetto premium non vuole un servizio più veloce. '
            'Vuole un servizio più coerente, più riconoscibile, '
            'più memorabile nel tempo.'
        ),
        'en-US': (
            "The client of a premium project doesn't want a faster service. "
            'They want a more coherent, more recognizable, '
            'more memorable one over time.'
        ),
    },

    # ── Final CTA ─────────────────────────────────────────────────────────
    'final_cta.title': {
        'it-IT': 'Configurate il vostro Blueprint™.',
        'en-US': 'Configure your Blueprint™.',
    },
    'final_cta.body': {
        'it-IT': (
            'Ogni configurazione è costruita per uno studio specifico. '
            'La conversazione comincia raccontandoci come lavorate oggi. '
            'Risposta entro due giorni lavorativi.'
        ),
        'en-US': (
            'Every configuration is built for a specific studio. '
            'The conversation begins with you telling us how you work today. '
            'Response within two business days.'
        ),
    },
    'final_cta.cta_primary': {
        'it-IT': 'Richiedi una configurazione Blueprint™',
        'en-US': 'Request a Blueprint™ configuration',
    },
    'final_cta.cta_secondary': {
        'it-IT': 'Esplora il Design Journey™',
        'en-US': 'Explore Design Journey™',
    },
}


# ── Helpers ────────────────────────────────────────────────────────────────
def _hash(val: str) -> str:
    return hashlib.sha256((val or '').encode('utf-8')).hexdigest()


async def cleanup_placeholder_blocks(conn, tenant_id):
    """Step 1 — Delete PLACEHOLDER / founder blocks from site.about."""
    # Delete translations first (FK constraint)
    deleted_t = await conn.fetchval(
        """
        DELETE FROM editorial_block_translations
        WHERE block_id IN (
            SELECT id FROM editorial_blocks
            WHERE namespace = 'site.about' AND tenant_id = $1
              AND (
                source_value ILIKE '%[PLACEHOLDER%'
                OR block_key ILIKE '%founder%'
                OR block_key ILIKE '%metrics%'
                OR block_key ILIKE '%quote%'
              )
        )
        RETURNING 1
        """,
        tenant_id,
        column=0,
    )
    deleted_b = await conn.fetchval(
        """
        DELETE FROM editorial_blocks
        WHERE namespace = 'site.about' AND tenant_id = $1
          AND (
            source_value ILIKE '%[PLACEHOLDER%'
            OR block_key ILIKE '%founder%'
            OR block_key ILIKE '%metrics%'
            OR block_key ILIKE '%quote%'
          )
        RETURNING 1
        """,
        tenant_id,
        column=0,
    )
    return deleted_t or 0, deleted_b or 0


async def upsert_block(conn, tenant_id, block_key, locales):
    source_value = locales.get('it-IT') or next(iter(locales.values()))
    sh = _hash(source_value)
    row = await conn.fetchrow(
        """
        INSERT INTO editorial_blocks
          (id, scope, tenant_id, namespace, block_key, block_type,
           source_locale, source_value, source_hash, is_active, created_at, updated_at)
        VALUES
          (gen_random_uuid(), 'tenant', $1, 'site.about', $2, 'text',
           'it-IT', $3, $4, true, NOW(), NOW())
        ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE SET
          source_value = EXCLUDED.source_value,
          source_hash  = EXCLUDED.source_hash,
          is_active    = true,
          updated_at   = NOW()
        RETURNING id
        """,
        tenant_id, block_key, source_value, sh,
    )
    block_id = row['id']
    for locale, value in locales.items():
        await conn.execute(
            """
            INSERT INTO editorial_block_translations
              (id, block_id, locale, value, source_hash, status, generated_by,
               locked, created_at, updated_at)
            VALUES
              (gen_random_uuid(), $1, $2, $3, $4,
               CASE WHEN $2 = 'it-IT' THEN 'source' ELSE 'manual' END,
               'seed-about-corporate', false, NOW(), NOW())
            ON CONFLICT (block_id, locale) DO UPDATE SET
              value        = EXCLUDED.value,
              source_hash  = EXCLUDED.source_hash,
              status       = EXCLUDED.status,
              generated_by = 'seed-about-corporate',
              updated_at   = NOW()
            """,
            block_id, locale, value, _hash(value),
        )
    return block_id


async def rebuild_sections(conn, tenant_id, page_id):
    """Step 3 — Rebuild about page CMS sections (6 corporate sections)."""
    await conn.execute("DELETE FROM cms_sections WHERE page_id = $1", page_id)

    sections = [
        # (sort_order, section_type, settings)
        (0, 'page_hero', {
            'blocks': {
                'eyebrow':  'site.about.hero.eyebrow',
                'title':    'site.about.hero.title',
                'subtitle': 'site.about.hero.subtitle',
            },
        }),
        (1, 'page_intro', {
            'blocks': {
                'eyebrow': 'site.about.why.eyebrow',
                'title':   'site.about.why.title',
                'body':    'site.about.why.body',
            },
        }),
        (2, 'page_intro', {
            'blocks': {
                'eyebrow': 'site.about.markets.eyebrow',
                'title':   'site.about.markets.title',
                'body':    'site.about.markets.body',
            },
        }),
        (3, 'features_triptych', {
            'blocks': {
                'eyebrow':         'site.about.pillars.eyebrow',
                'title':           'site.about.pillars.title',
                'col1.label':      'site.about.pillars.pillar1.label',
                'col1.body':       'site.about.pillars.pillar1.body',
                'col1.cta_label':  'site.about.pillars.pillar1.cta',
                'col2.label':      'site.about.pillars.pillar2.label',
                'col2.body':       'site.about.pillars.pillar2.body',
                'col2.cta_label':  'site.about.pillars.pillar2.cta',
            },
            'links': {
                'col1.cta_href': '/design-journey',
                'col2.cta_href': '/versioni-prezzi',
            },
        }),
        (4, 'editorial_triptych', {
            'blocks': {
                'eyebrow':     'site.about.observations.eyebrow',
                'title':       'site.about.observations.title',
                'col1.label':  'site.about.observations.obs1.label',
                'col1.body':   'site.about.observations.obs1.body',
                'col2.label':  'site.about.observations.obs2.label',
                'col2.body':   'site.about.observations.obs2.body',
                'col3.label':  'site.about.observations.obs3.label',
                'col3.body':   'site.about.observations.obs3.body',
            },
        }),
        (5, 'final_cta_immersive', {
            'blocks': {
                'title':           'site.about.final_cta.title',
                'body':            'site.about.final_cta.body',
                'cta_label':       'site.about.final_cta.cta_primary',
                'cta2_label':      'site.about.final_cta.cta_secondary',
            },
            'links': {
                'cta_href':  '/studio',
                'cta2_href': '/design-journey',
            },
        }),
    ]

    for sort_order, section_type, settings in sections:
        await conn.execute(
            """
            INSERT INTO cms_sections
              (id, tenant_id, page_id, section_type, sort_order,
               visible, settings, created_at, updated_at)
            VALUES
              (gen_random_uuid(), $1, $2, $3, $4, true, $5::jsonb, NOW(), NOW())
            """,
            tenant_id, page_id, section_type, sort_order, json.dumps(settings),
        )
    return len(sections)


async def global_placeholder_cleanup(conn, tenant_id):
    """Step 2b — Deactivate any remaining PLACEHOLDER blocks on public namespaces."""
    n = await conn.fetchval(
        """
        UPDATE editorial_blocks
           SET is_active = false, updated_at = NOW()
         WHERE namespace LIKE 'site.%%' AND tenant_id = $1
           AND is_active = true
           AND source_value ILIKE '%%[PLACEHOLDER%%'
        RETURNING 1
        """,
        tenant_id,
        column=0,
    )
    return n or 0


async def verify(conn, tenant_id):
    count = await conn.fetchval(
        """
        SELECT COUNT(*) FROM editorial_blocks
        WHERE namespace LIKE 'site.%%' AND tenant_id = $1
          AND is_active = true
          AND (source_value ILIKE '%%fondatore%%' OR source_value ILIKE '%%founder%%'
               OR source_value ILIKE '%%[PLACEHOLDER%%' OR source_value ILIKE '%%una voce dietro%%')
        """,
        tenant_id,
    )
    return count


# ── Main ──────────────────────────────────────────────────────────────────
async def main():
    db_url = os.environ['DATABASE_URL']
    conn   = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        tenant = await conn.fetchrow("SELECT id FROM tenants WHERE slug = $1", CORP_SLUG)
        if not tenant:
            raise SystemExit(f"Tenant '{CORP_SLUG}' not found")
        tid = tenant['id']
        print(f"→ Tenant: {CORP_SLUG} ({tid})")

        # Step 1 — DELETE PLACEHOLDER / founder / metrics / quote blocks
        del_t, del_b = await cleanup_placeholder_blocks(conn, tid)
        print(f"\n[Step 1] Cleanup site.about PLACEHOLDER blocks")
        print(f"  Deleted translations: {del_t}")
        print(f"  Deleted blocks:       {del_b}")

        # Step 1b — Deactivate any other PLACEHOLDER on public namespaces
        other = await global_placeholder_cleanup(conn, tid)
        print(f"  Deactivated other PLACEHOLDER blocks: {other}")

        # Step 2 — UPSERT new corporate blocks
        print(f"\n[Step 2] Upsert corporate blocks ({len(ABOUT_BLOCKS)} total)")
        for bk, locales in ABOUT_BLOCKS.items():
            await upsert_block(conn, tid, bk, locales)
        print(f"  ✓ {len(ABOUT_BLOCKS)} blocks upserted (IT + EN-US)")

        # Step 3 — Rebuild CMS sections
        page = await conn.fetchrow(
            "SELECT id FROM cms_pages WHERE tenant_id = $1 AND page_key = 'about'",
            tid,
        )
        if not page:
            page = await conn.fetchrow(
                """INSERT INTO cms_pages
                     (id, tenant_id, page_key, title, slug, is_active, created_at, updated_at)
                   VALUES (gen_random_uuid(), $1, 'about', 'Il progetto', '/about', true, NOW(), NOW())
                   RETURNING id""",
                tid,
            )
        page_id = page['id']
        n_sec = await rebuild_sections(conn, tid, page_id)
        print(f"\n[Step 3] CMS sections rebuilt: {n_sec}")

        # Step 4 — Verify
        remaining = await verify(conn, tid)
        print(f"\n[Step 4] Post-update audit:")
        print(f"  Forbidden words remaining: {remaining}")
        if remaining == 0:
            print("  ✓ ZERO PLACEHOLDER / founder / personal references on public site")
        else:
            print("  ❌ FIX REQUIRED — see audit query above")

        print("\n✅  About page corporate rewrite complete.")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
