"""
ITER151i — Formazione anchor sections.

Adds 5 anchor_section rows to /formazione, one per CTA destination:
  #percorsi · #tutorial · #guide · #webinar · #academy

Each has: eyebrow + serif title + italic subtitle + markdown body
+ secondary photograph. Designed to be the landing target of the
training hero's "Scopri i percorsi" / card CTAs.

Run: python /app/backend/db/seed_iter151_training_anchors.py
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

# Each anchor: (anchor_id, eyebrow, title, subtitle, body_md, cta_label)
ANCHORS = [
    ('percorsi', 'Percorsi guidati',
     'Impara passo dopo passo.',
     'Un percorso editoriale, non un manuale.',
     "Ogni percorso MOOD è un viaggio ritmato attraverso il metodo. **Iniziamo dalle basi** — il primo moodboard, il primo Design Journey™ — e ti accompagniamo fino alle funzionalità più sofisticate dell'ecosistema.\n\nI percorsi sono articolati in capitoli brevi, ognuno con esempi pratici tratti da progetti reali curati dalla nostra redazione. Adatti tanto al professionista in autonomia quanto allo studio strutturato.",
     'Esplora i percorsi'),
    ('tutorial', 'Tutorial veloci',
     'Tutorial veloci e pratici.',
     'Tre minuti per padroneggiare una funzionalità.',
     "Video brevi e mirati per chi vuole risposte rapide. **Ogni tutorial dura tra i 2 e i 4 minuti** e affronta un singolo compito concreto — creare una moodboard tematica, configurare un hotspot, esportare una presentazione client-ready.\n\nLa libreria si aggiorna ogni settimana con nuovi contenuti, allineati alle ultime evoluzioni della piattaforma.",
     'Vai ai tutorial'),
    ('guide', 'Guide',
     'Guide complete e aggiornate.',
     'L\'approfondimento di chi cerca padronanza.',
     "Quando un tutorial non basta, le **guide editoriali** offrono uno sguardo lungo: best practice, casi studio, errori comuni da evitare, riflessioni metodologiche sul significato di lavorare con MOOD.\n\nScritte in collaborazione con architetti e designer della nostra community, sono la spina dorsale formativa dell'ecosistema.",
     'Sfoglia le guide'),
    ('webinar', 'Webinar & live',
     'Incontri in diretta con il nostro team.',
     'Una conversazione, non una conferenza.',
     "Ogni mese organizziamo **sessioni live** con la nostra redazione e ospiti del mondo del design: workshop pratici sulla piattaforma, conversazioni su progetti recenti, anteprime delle nuove funzionalità.\n\nI partecipanti possono porre domande, condividere il proprio lavoro e ricevere feedback in tempo reale. Le registrazioni restano disponibili nella libreria per chi non riesce a partecipare dal vivo.",
     'Scopri i prossimi eventi'),
    ('academy', 'MOOD Academy',
     'Cresci con la MOOD Academy.',
     'Formazione continua per chi progetta il futuro.',
     "L'**Academy** è il livello più profondo del nostro impegno formativo: percorsi certificati, sessioni 1-to-1 con la redazione, accesso anticipato ai contenuti e una community privata di professionisti che condividono progetti, materiali e riflessioni.\n\nÈ pensata per chi non vuole solo imparare a usare MOOD — ma trasformare il proprio modo di progettare. Un investimento sulla propria voce editoriale.",
     'Richiedi accesso'),
]


async def upsert_block(conn, tid, ns, bk, btype, src):
    sh = hashlib.sha256(src.encode('utf-8')).hexdigest()
    row = await conn.fetchrow(
        """INSERT INTO editorial_blocks (id, scope, tenant_id, namespace, block_key, block_type,
              source_locale, source_value, source_hash, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(),'tenant',$1,$2,$3,$4,'it',$5,$6,true,NOW(),NOW())
           ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE SET
             block_type=EXCLUDED.block_type, source_value=EXCLUDED.source_value,
             source_hash=EXCLUDED.source_hash, updated_at=NOW()
           RETURNING id""",
        tid, ns, bk, btype, src, sh,
    )
    await conn.execute(
        """INSERT INTO editorial_block_translations
              (id, block_id, locale, value, status, generated_by, source_hash, locked, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, 'it', $2, 'manual', 'seed', $3, false, NOW(), NOW())
           ON CONFLICT (block_id, locale) DO UPDATE SET
             value=EXCLUDED.value, status='manual', source_hash=EXCLUDED.source_hash, updated_at=NOW()""",
        row['id'], src, sh,
    )


async def main():
    db_url = os.environ['DATABASE_URL']
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        tenant = await conn.fetchrow("SELECT id FROM tenants WHERE slug=$1", CORP_SLUG)
        tid = tenant['id']

        training = await conn.fetchrow("SELECT id FROM cms_pages WHERE tenant_id=$1 AND page_key='training'", tid)
        if not training:
            raise SystemExit("training page not found")

        media_ids = await conn.fetch(
            """SELECT id FROM media_library WHERE tenant_id=$1 AND archived_at IS NULL
               ORDER BY created_at DESC LIMIT 10""", tid,
        )
        pool = [str(r['id']) for r in media_ids]

        # Remove any previous anchor_section to be idempotent
        await conn.execute(
            "DELETE FROM cms_sections WHERE page_id=$1 AND section_type='anchor_section'",
            training['id'],
        )

        for i, (aid, eyebrow, title, subtitle, body, cta) in enumerate(ANCHORS):
            ns = 'site.training'
            await upsert_block(conn, tid, ns, f'anchor_{aid}.eyebrow',  'eyebrow',  eyebrow)
            await upsert_block(conn, tid, ns, f'anchor_{aid}.title',    'headline', title)
            await upsert_block(conn, tid, ns, f'anchor_{aid}.subtitle', 'body',     subtitle)
            await upsert_block(conn, tid, ns, f'anchor_{aid}.body',     'body',     body)
            await upsert_block(conn, tid, ns, f'anchor_{aid}.cta',      'cta',      cta)

            settings = {
                'blocks': {
                    'eyebrow':   f'{ns}.anchor_{aid}.eyebrow',
                    'title':     f'{ns}.anchor_{aid}.title',
                    'subtitle':  f'{ns}.anchor_{aid}.subtitle',
                    'body':      f'{ns}.anchor_{aid}.body',
                    'cta_label': f'{ns}.anchor_{aid}.cta',
                },
                'media': {},
                'links': {'cta_href': f'#{aid}-detail'},
                'options': {
                    'anchor_id': aid,
                    'reverse': (i % 2 == 1),
                    'background': '#050606' if (i % 2 == 0) else '#000000',
                },
            }
            if pool:
                settings['media']['photo'] = pool[i % len(pool)]

            await conn.execute(
                """INSERT INTO cms_sections (id, tenant_id, page_id, section_type, sort_order, visible, settings, created_at, updated_at)
                   VALUES (gen_random_uuid(), $1, $2, 'anchor_section', $3, true, $4::jsonb, NOW(), NOW())""",
                tid, training['id'], 10 + i, json.dumps(settings),
            )
            print(f"  ✓ anchor_section #{aid} inserted")

        # Update training hero CTA links to point to anchors
        hero = await conn.fetchrow(
            "SELECT id, settings FROM cms_sections WHERE page_id=$1 AND section_type='training_hero' LIMIT 1",
            training['id'],
        )
        if hero:
            s = hero['settings']
            if isinstance(s, str):
                s = json.loads(s)
            s.setdefault('links', {})['cta_primary_href']   = '#percorsi'
            s['links']['cta_secondary_href'] = '#tutorial'
            await conn.execute(
                "UPDATE cms_sections SET settings=$1::jsonb, updated_at=NOW() WHERE id=$2",
                json.dumps(s), hero['id'],
            )
            print("  ✓ training_hero CTAs updated to anchors")

        print("\n✅ ITER151i Training anchor sections completed.")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
