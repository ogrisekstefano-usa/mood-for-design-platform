"""
seed_partner_email_templates.py
─────────────────────────────────────────────────────────────────────────────
Phase 3 — Task 1: Seed the two CMS email templates for the partner
application flow.

Templates:
  • partner_application_received  → to the applicant on submit
  • admin_new_partner_application → to MOOD super-admin on submit

Same pattern as studio_request_received / admin_new_studio_request.
Variables available:
  partner_application_received:
    {{contact_name}}, {{reference}}, {{profile_type}}, {{company}}
  admin_new_partner_application:
    {{reference}}, {{contact_name}}, {{contact_email}},
    {{phone_full}}, {{company}}, {{website}}, {{profile_type}},
    {{intents_readable}}, {{message}}, {{locale}}, {{application_id}}

Idempotent. Run: cd /app/backend && python -m db.seed_partner_email_templates
"""
import asyncio, hashlib, os, sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

import asyncpg
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')

CORP_SLUG  = os.environ.get('CORPORATE_TENANT_SLUG', 'studio')
NAMESPACE  = 'email'

TEMPLATES = {
    # ── 1) Applicant confirmation ─────────────────────────────────────────
    'partner_application_received': {
        'it-IT': {
            'subject':      'Abbiamo ricevuto la tua candidatura · {{reference}}',
            'eyebrow':      'Candidatura ricevuta',
            'headline':     'Grazie, {{contact_name}}.',
            'body':         (
                'Abbiamo ricevuto la tua candidatura a MOOD for DESIGN come {{profile_type}}.\n\n'
                'Il codice di riferimento è {{reference}}: conservalo per ogni futura comunicazione.\n\n'
                'Esamineremo il tuo profilo nei prossimi giorni lavorativi e ti risponderemo '
                'personalmente per esplorare le possibilità di collaborazione.\n\n'
                'MOOD lavora su un perimetro selezionato: ogni partnership viene valutata con cura '
                'per garantire la coerenza editoriale dell\'ecosistema.'
            ),
            'cta_label':    '',
            'cta_url_path': '',
            'note':         'Non è necessario rispondere a questa email. Ti contatteremo direttamente.',
            'signature':    "L'ecosistema MOOD for DESIGN™",
        },
        'en-US': {
            'subject':      'We received your application · {{reference}}',
            'eyebrow':      'Application received',
            'headline':     'Thank you, {{contact_name}}.',
            'body':         (
                'We received your application to MOOD for DESIGN as {{profile_type}}.\n\n'
                'Your reference code is {{reference}}: keep it for any future correspondence.\n\n'
                'We will review your profile over the next business days and reach out '
                'personally to explore the possibilities of working together.\n\n'
                'MOOD works with a selected scope of partners: every partnership is evaluated '
                'with care to ensure editorial coherence across the ecosystem.'
            ),
            'cta_label':    '',
            'cta_url_path': '',
            'note':         'You do not need to reply to this email. We will contact you directly.',
            'signature':    'The MOOD for DESIGN™ ecosystem',
        },
    },

    # ── 2) Admin notification ─────────────────────────────────────────────
    'admin_new_partner_application': {
        'it-IT': {
            'subject':      '[MOOD] Nuova candidatura partner · {{contact_name}} ({{reference}})',
            'eyebrow':      'Nuova candidatura partner',
            'headline':     '{{contact_name}}{{company}}',
            'body':         (
                'Reference: {{reference}}\n'
                'Referente: {{contact_name}}\n'
                'Email: {{contact_email}}\n'
                'Telefono: {{phone_full}}\n'
                'Azienda / Studio: {{company}}\n'
                'Sito web: {{website}}\n'
                'Profilo: {{profile_type}}\n'
                'Aree di collaborazione: {{intents_readable}}\n'
                'Lingua candidatura: {{locale}}\n\n'
                'Messaggio:\n{{message}}'
            ),
            'cta_label':    'Apri in Command Center',
            'cta_url_path': '/admin/partner-applications?focus={{application_id}}',
            'note':         'Questa email è generata automaticamente da MOOD for DESIGN.',
            'signature':    'MOOD for DESIGN · Partner Pipeline',
        },
        'en-US': {
            'subject':      '[MOOD] New partner application · {{contact_name}} ({{reference}})',
            'eyebrow':      'New partner application',
            'headline':     '{{contact_name}}{{company}}',
            'body':         (
                'Reference: {{reference}}\n'
                'Contact: {{contact_name}}\n'
                'Email: {{contact_email}}\n'
                'Phone: {{phone_full}}\n'
                'Company / Studio: {{company}}\n'
                'Website: {{website}}\n'
                'Profile: {{profile_type}}\n'
                'Collaboration areas: {{intents_readable}}\n'
                'Application locale: {{locale}}\n\n'
                'Message:\n{{message}}'
            ),
            'cta_label':    'Open in Command Center',
            'cta_url_path': '/admin/partner-applications?focus={{application_id}}',
            'note':         'This email was generated automatically by MOOD for DESIGN.',
            'signature':    'MOOD for DESIGN · Partner Pipeline',
        },
    },
}


async def upsert_block(conn, tenant_id, namespace, block_key, source_value):
    sh = hashlib.sha256((source_value or '').encode('utf-8')).hexdigest()
    row = await conn.fetchrow(
        """
        INSERT INTO editorial_blocks
          (scope, tenant_id, namespace, block_key, block_type,
           source_locale, source_value, source_hash, is_active, updated_at)
        VALUES
          ('tenant', $1, $2, $3, 'text', 'it-IT', $4, $5, true, NOW())
        ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE
          SET source_value = EXCLUDED.source_value,
              source_hash  = EXCLUDED.source_hash,
              is_active    = true,
              updated_at   = NOW()
        RETURNING id
        """,
        tenant_id, namespace, block_key, source_value, sh,
    )
    return row['id']


async def upsert_translation(conn, block_id, locale, value):
    sh = hashlib.sha256((value or '').encode('utf-8')).hexdigest()
    await conn.execute(
        """
        INSERT INTO editorial_block_translations
          (id, block_id, locale, value, source_hash, status, generated_by,
           locked, created_at, updated_at)
        VALUES
          (gen_random_uuid(), $1, $2, $3, $4,
           CASE WHEN $2 = 'it-IT' THEN 'source' ELSE 'manual' END,
           'seed-partner-email', false, NOW(), NOW())
        ON CONFLICT (block_id, locale) DO UPDATE
          SET value        = EXCLUDED.value,
              source_hash  = EXCLUDED.source_hash,
              status       = EXCLUDED.status,
              generated_by = 'seed-partner-email',
              updated_at   = NOW()
        """,
        block_id, locale, value, sh,
    )


async def main():
    db_url = os.environ['DATABASE_URL']
    conn   = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        tenant = await conn.fetchrow("SELECT id FROM tenants WHERE slug = $1", CORP_SLUG)
        if not tenant:
            raise SystemExit(f"Tenant '{CORP_SLUG}' not found")
        tid = tenant['id']
        print(f"→ Tenant: {CORP_SLUG} ({tid})")

        blocks = translations = 0
        for template_key, locales_map in TEMPLATES.items():
            for field in locales_map['it-IT'].keys():
                block_key    = f"{template_key}.{field}"
                source_value = locales_map['it-IT'][field]
                block_id     = await upsert_block(conn, tid, NAMESPACE, block_key, source_value)
                blocks += 1
                for locale, fields in locales_map.items():
                    await upsert_translation(conn, block_id, locale, fields.get(field, ''))
                    translations += 1

        print(f"  ✓ blocks:       {blocks}")
        print(f"  ✓ translations: {translations}")
        print(f"  ✓ templates:    {len(TEMPLATES)}")
        print("\n✅  Partner email templates seeded.")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
