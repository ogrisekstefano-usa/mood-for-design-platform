"""
CMS Update — Studio Activation Entrance Copy (NEW alignment)
═══════════════════════════════════════════════════════════════════════
Allinea i blocchi `studio.activation.entrance.*` al copy NEW
approvato (vedi `STUDIO_V2/ONBOARDING_RENDER_AUDIT.md`).

Strategy:
  • IDEMPOTENT — re-runnable safely
  • UPDATE only (no namespace duplication)
  • No `studio.activation.v2` (il componente legge il namespace base)
  • Compatibile con hold P0: zero DELETE, solo UPDATE/INSERT
  • IT-IT come source locale, traduzioni EN-US editoriali

Authority:
  • /app/memory/STUDIO_V2/ONBOARDING_RENDER_AUDIT.md
  • /app/memory/STUDIO_V2/STUDIO_ACTIVATION_LIFECYCLE.md
  • useStudioManifest.IT_DEFAULTS (bundle JS, source of truth NEW)
"""
import os
import sys
import hashlib
import psycopg2
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
DATABASE_URL = os.environ.get('SESSION_POOLER_URL') or os.environ.get('DATABASE_URL')

NAMESPACE = 'studio.activation'
SOURCE_LOCALE = 'it-IT'
TARGET_LOCALES = ['en-US']

COPY = {
    'entrance.eyebrow': {
        'it-IT': 'Composizione',
        'en-US': 'Composition',
    },
    'entrance.headline': {
        'it-IT': 'Componi il tuo Studio.',
        'en-US': 'Compose your Studio.',
    },
    'entrance.sublead': {
        'it-IT': 'Una sequenza editoriale di sei movimenti per attivare il tuo Blueprint™ con MOOD.',
        'en-US': 'An editorial sequence in six movements to activate your Blueprint™ with MOOD.',
    },
    'entrance.cta': {
        'it-IT': 'Inizia la composizione',
        'en-US': 'Begin composition',
    },
    'entrance.return_link': {
        'it-IT': 'Hai già iniziato?',
        'en-US': 'Already started?',
    },
    'entrance.return_destination': {
        'it-IT': 'Riprendi da dove sei',
        'en-US': 'Resume where you left off',
    },
}


def get_corporate_tenant_id(cur) -> str:
    cur.execute("SELECT id FROM tenants WHERE slug = 'studio' LIMIT 1")
    row = cur.fetchone()
    if not row:
        raise RuntimeError("Corporate tenant (slug=studio) not found")
    return row[0]


def upsert_block(cur, namespace, block_key, source_value, source_locale, tenant_id):
    h = hashlib.md5((source_value or '').encode('utf-8')).hexdigest()
    cur.execute("""
        INSERT INTO editorial_blocks
          (scope, tenant_id, namespace, block_key, block_type, source_locale, source_value, source_hash, is_active, updated_at)
        VALUES
          ('tenant', %s, %s, %s, 'text', %s, %s, %s, true, now())
        ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE
          SET source_value  = EXCLUDED.source_value,
              source_locale = EXCLUDED.source_locale,
              source_hash   = EXCLUDED.source_hash,
              is_active     = true,
              updated_at    = now()
        RETURNING id
    """, (tenant_id, namespace, block_key, source_locale, source_value, h))
    return cur.fetchone()[0]


def upsert_translation(cur, block_id, locale, value, is_source=False):
    h = hashlib.md5((value or '').encode('utf-8')).hexdigest()
    status = 'source' if is_source else 'manual'
    cur.execute("""
        INSERT INTO editorial_block_translations
          (block_id, locale, value, source_hash, status, generated_by, updated_at)
        VALUES
          (%s, %s, %s, %s, %s, 'human', now())
        ON CONFLICT (block_id, locale) DO UPDATE
          SET value        = EXCLUDED.value,
              source_hash  = EXCLUDED.source_hash,
              status       = EXCLUDED.status,
              generated_by = 'human',
              updated_at   = now()
    """, (block_id, locale, value, h, status))


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    stats = {'blocks': 0, 'translations': 0, 'changes': []}
    try:
        tenant_id = get_corporate_tenant_id(cur)
        for block_key, locales_map in COPY.items():
            source_value = locales_map[SOURCE_LOCALE]
            # Detect prior value for changelog
            cur.execute("""
                SELECT id, source_value FROM editorial_blocks
                WHERE tenant_id=%s AND namespace=%s AND block_key=%s
            """, (tenant_id, NAMESPACE, block_key))
            prev = cur.fetchone()
            prev_val = prev[1] if prev else None

            block_id = upsert_block(cur, NAMESPACE, block_key, source_value, SOURCE_LOCALE, tenant_id)
            stats['blocks'] += 1
            upsert_translation(cur, block_id, SOURCE_LOCALE, source_value, is_source=True)
            stats['translations'] += 1
            for tgt in TARGET_LOCALES:
                val = locales_map.get(tgt, '')
                upsert_translation(cur, block_id, tgt, val, is_source=False)
                stats['translations'] += 1

            stats['changes'].append({
                'key': f"{NAMESPACE}.{block_key}",
                'old': prev_val,
                'new': source_value,
                'changed': prev_val != source_value,
            })
        conn.commit()
    finally:
        cur.close()
        conn.close()

    print(f"\n══════════════════════════════════════════")
    print(f"BLOCKS upserted:       {stats['blocks']}")
    print(f"TRANSLATIONS upserted: {stats['translations']}")
    print(f"\nCHANGELOG:")
    for c in stats['changes']:
        marker = '✓' if c['changed'] else '·'
        print(f"  {marker} {c['key']}")
        print(f"      OLD: {c['old']!r}")
        print(f"      NEW: {c['new']!r}")
    sys.exit(0)


if __name__ == '__main__':
    main()
