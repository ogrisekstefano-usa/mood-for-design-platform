"""ITER167 Round 2 · Seed Adaptive Access™ editorial copy.

Populates `editorial_blocks` (scope=system, namespace=auth.access) for the
public-surface Adaptive Access™ page.  These keys are read via the
BlueprintContext `t()` accessor in LoginPage.jsx.

Compliance: 'TUTTO multilingue DB-driven, NO hardcoded copy' — the IT
source rows below become the canonical, editable, CMS-governed source.
ALE (Automatic Localization Engine) propagates them to the active locales.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from services.editorial_content_orchestrator import upsert_block  # noqa: E402


ACCESS = {
    'page_key': 'public-auth-access',
    'namespace': 'auth.access',
    'blocks': [
        # Phase 1 — Probe
        ('eyebrow',           'eyebrow', 'IL TUO SPAZIO PROGETTUALE'),
        ('probe.title',       'title',   'Bentornato nel tuo spazio progettuale.'),
        ('probe.subtitle',    'subtitle','Inserisci la mail che hai utilizzato per il tuo Design Journey™.'),
        ('email_label',       'label',   'La tua email'),
        ('email_placeholder', 'placeholder', 'nome@esempio.com'),
        ('probe.cta',         'cta',     'Continua'),

        # Phase 2 — Client
        ('client.title',      'title',   'Bentornato nel tuo spazio progettuale.'),
        ('client.subtitle',   'subtitle','Ti invieremo un accesso personale per continuare il tuo Design Journey™.'),
        ('client.cta_email',  'cta',     'Continua via email'),
        ('client.cta_password','cta',    'Usa password'),

        # Phase 2 — Professional
        ('professional.title',    'title',   'Accedi al tuo workspace operativo.'),
        ('professional.subtitle', 'subtitle','Inserisci la password per riprendere.'),
        ('professional.cta',      'cta',     'Accedi al workspace'),
        ('professional.cta_email','cta',     'Ricevi accesso via email'),

        # Shared password field
        ('password_label',       'label',       'Password'),
        ('password_placeholder', 'placeholder', '••••••••••'),
        ('forgot',               'link',        'Hai dimenticato la password?'),

        # Phase 3 — Sent
        ('sent.title',  'title',    'Ti abbiamo inviato un accesso personale.'),
        ('sent.copy',   'paragraph','Apri la tua email per continuare il tuo Design Journey™.'),
        ('sent.resend', 'cta',      'Invia di nuovo'),

        # Navigation + ambient
        ('back',           'link',     'Cambia email'),
        ('quote',          'quote',    'Design is not just what you see. It\u2019s how you live.'),
        ('quote_author',   'caption',  'MOOD for DESIGN\u2122'),
        ('need_help',      'paragraph','Hai bisogno di assistenza?'),
        ('support',        'link',     'Scrivi al nostro studio'),
        ('support_email',  'email',    'support@moodfordesign.com'),
    ],
}


def main():
    inserted = 0
    for key_path, block_type, value in ACCESS['blocks']:
        full_key = f"{ACCESS['namespace']}.{key_path}"
        try:
            upsert_block(
                scope='system',
                page_key=ACCESS['page_key'],
                namespace=ACCESS['namespace'],
                block_key=key_path,
                block_type=block_type,
                source_locale='it',
                source_value=value,
            )
            inserted += 1
            print(f"[iter167.aa] seeded {full_key}")
        except Exception as e:
            print(f"[iter167.aa] FAILED {full_key}: {e}")
    print(f"[iter167.aa] done — {inserted} auth.access.* blocks seeded.")


if __name__ == '__main__':
    main()
