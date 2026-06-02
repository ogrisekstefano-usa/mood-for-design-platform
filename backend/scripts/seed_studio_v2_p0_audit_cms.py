"""
Seed CMS chiavi mancanti per Studio V2 P0 Audit.
Aggiunge stringhe in studio_v2.ui per eliminare hardcoded.
"""
import asyncio, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from sqlalchemy import text
from database import AsyncSessionLocal
from tenant_resolver import get_corporate_tenant

# Key | source (it-IT) | en-US
KEYS = [
    ('step1.eyebrow',                 'Inizia', 'Begin'),
    ('step2.market.eyebrow',          'A · Mercato operativo', 'A · Operating market'),
    ('step2.market.label',            'Mercato MOOD', 'MOOD market'),
    ('step2.hq.eyebrow',              'B · Sede', 'B · Headquarter'),
    ('step2.targets.eyebrow',         'C · Paesi target · Opzionale', 'C · Target countries · Optional'),
    ('step2.city.placeholder',        'Inserisci la città…', 'Enter your city…'),
    ('step2.city.placeholder_italy',  'Milano…', 'e.g. Milano…'),
    ('step2.city.fallback_hint',      'Inserisci manualmente il nome della città.', 'Type your city manually.'),
    ('step2.targets.search.placeholder', 'Cerca un Paese…', 'Search a country…'),
    ('step2.targets.status.active',   'Già attivo', 'Active'),
    ('step2.targets.status.planned',  'In espansione', 'Planned'),
    ('step2.targets.counter',         '{n} di {max} selezionati · La priorità è assegnata automaticamente.',
                                       '{n} of {max} selected · Priority is assigned automatically.'),
    ('step2.targets.limit_reached',   'Massimo {max} Paesi target raggiunto.', 'Maximum {max} target countries reached.'),
    ('step2.targets.remove_aria',     'Rimuovi {country}', 'Remove {country}'),
    ('step3.email.checking',          'Verifica in corso…', 'Checking…'),
    ('step3.email.ok',                'Email disponibile.', 'Email available.'),
    # P0-B: Studio Name (required first-class V2 field) + activation modal binding.
    ('step3.studio_name',             'Nome dello studio', 'Studio name'),
    ('step3.studio_name.placeholder', 'Es. Martinel Interior Design', 'e.g. Martinel Interior Design'),
    ('step3.studio_name.hint',        'Sarà il nome ufficiale del tuo workspace MOOD.',
                                       'This will be the official name of your MOOD workspace.'),
    ('step4.help_other.placeholder',  'Specifica…', 'Specify…'),
    ('step4.error.prefix',            'Si è verificato un errore', 'Something went wrong'),
    ('loading.brand',                 'MOOD', 'MOOD'),
    ('loading.message',               'Un attimo…', 'One moment…'),
]

async def main():
    tenant = await get_corporate_tenant()
    tid = tenant['id']
    async with AsyncSessionLocal() as s:
        added, updated = 0, 0
        for key, src_it, src_en in KEYS:
            # 1. Ensure editorial_block exists
            row = (await s.execute(text("""
                SELECT id FROM editorial_blocks
                 WHERE tenant_id=:tid AND namespace='studio_v2.ui' AND block_key=:k
            """), {"tid": tid, "k": key})).mappings().first()
            if row:
                bid = row['id']
            else:
                bid = (await s.execute(text("""
                    INSERT INTO editorial_blocks(tenant_id, namespace, block_key, source_value,
                                                 source_hash, scope, is_active)
                    VALUES (:tid, 'studio_v2.ui', :k, :v, md5(:v), 'tenant', TRUE) RETURNING id
                """), {"tid": tid, "k": key, "v": src_it})).scalar()
                added += 1
            # 2. Upsert translation it-IT
            for loc, val in (('it-IT', src_it), ('en-US', src_en)):
                await s.execute(text("""
                    INSERT INTO editorial_block_translations(block_id, locale, value)
                    VALUES (:bid, :loc, :val)
                    ON CONFLICT (block_id, locale)
                    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                """), {"bid": bid, "loc": loc, "val": val})
        await s.commit()
        print(f"Added new blocks: {added}, total keys upserted: {len(KEYS)}")

if __name__ == '__main__':
    asyncio.run(main())
