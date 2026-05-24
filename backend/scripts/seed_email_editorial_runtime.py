"""ITER145.A · Seed email editorial copy (Editorial Runtime™ convergence).

Emails become runtime editorial surfaces. Each template field
(subject, preheader, body, cta, footer, signature, legal) is stored
as an editorial_block under namespace `system.email.{template_key}`.

ALE auto-localizes Italian source into the active locales at upsert.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from services.editorial_content_orchestrator import upsert_block  # noqa: E402

# ── 5 canonical email templates ─────────────────────────────────────
# Each is a tuple of (block_key, block_type, source_value).
# block_key has shape `{template_key}.{field}` so the resolver can pull
# a template by namespace=system.email and prefix=`{template_key}.`.
TEMPLATES = {
    'system-email-auth-reset': [
        ('auth_reset.subject',
         'meta',
         'Reimposta la tua password · {{studio_name}}'),
        ('auth_reset.preheader',
         'meta',
         'Un link sicuro per accedere di nuovo al tuo studio.'),
        ('auth_reset.eyebrow',
         'meta',
         'Accesso al tuo studio'),
        ('auth_reset.title',
         'narrative',
         'Reimposta la password.'),
        ('auth_reset.body',
         'narrative',
         "Abbiamo ricevuto la richiesta di reimpostare la password del tuo account. "
         "Il link qui sotto resta valido per i prossimi 60 minuti."),
        ('auth_reset.cta',
         'cta_label',
         'Reimposta password'),
        ('auth_reset.legal',
         'meta',
         "Se non hai richiesto tu il reset, ignora questa email. Il tuo account è al sicuro."),
    ],
    'system-email-invite': [
        ('invite.subject',
         'meta',
         '{{inviter_name}} ti invita su {{studio_name}}'),
        ('invite.preheader',
         'meta',
         'Un invito personale ad entrare nello studio.'),
        ('invite.eyebrow',
         'meta',
         'Invito personale'),
        ('invite.title',
         'narrative',
         'Sei stato invitato.'),
        ('invite.body',
         'narrative',
         "{{inviter_name}} ti ha invitato a collaborare in {{studio_name}}. "
         "Accetta l'invito qui sotto per entrare nello studio e iniziare la tua journey."),
        ('invite.cta',
         'cta_label',
         "Accetta l'invito"),
        ('invite.legal',
         'meta',
         "L'invito è personale. Se non riconosci il mittente, ignora questa email."),
    ],
    'system-email-onboarding': [
        ('onboarding.subject',
         'meta',
         'Benvenuto in {{studio_name}}'),
        ('onboarding.preheader',
         'meta',
         'Le tue prime atmosfere ti aspettano.'),
        ('onboarding.eyebrow',
         'meta',
         'Benvenuto'),
        ('onboarding.title',
         'narrative',
         'Benvenuto nel tuo studio.'),
        ('onboarding.body',
         'narrative',
         "Il tuo workspace è pronto. Da qui puoi iniziare a comporre la tua prima journey, "
         "raccogliere ispirazioni, e accogliere i tuoi primi clienti."),
        ('onboarding.cta',
         'cta_label',
         'Entra nel tuo studio'),
        ('onboarding.legal',
         'meta',
         "Questa email ti è stata inviata perché hai creato un account su {{studio_name}}."),
    ],
    'system-email-lead-captured': [
        ('lead_captured.subject',
         'meta',
         '{{studio_name}} · Abbiamo ricevuto la tua richiesta'),
        ('lead_captured.preheader',
         'meta',
         'Ti risponderemo a breve con attenzione.'),
        ('lead_captured.eyebrow',
         'meta',
         'Conferma di ricezione'),
        ('lead_captured.title',
         'narrative',
         'Grazie. Abbiamo ricevuto la tua richiesta.'),
        ('lead_captured.body',
         'narrative',
         "Il nostro studio sta esaminando il tuo messaggio. Ti risponderemo presto con "
         "una proposta di conversazione su misura per il tuo progetto."),
        ('lead_captured.cta',
         'cta_label',
         'Scopri il nostro mondo'),
        ('lead_captured.legal',
         'meta',
         "Questa email è una conferma automatica. Non è necessario rispondere."),
    ],
    'system-email-magic-link': [
        ('magic_link.subject',
         'meta',
         '{{studio_name}} · Accedi al tuo spazio'),
        ('magic_link.preheader',
         'meta',
         'Un link sicuro per accedere senza password.'),
        ('magic_link.eyebrow',
         'meta',
         'Accesso rapido'),
        ('magic_link.title',
         'narrative',
         'Accedi con un solo click.'),
        ('magic_link.body',
         'narrative',
         "Apri il link qui sotto entro 15 minuti per accedere al tuo workspace. "
         "Non serve password."),
        ('magic_link.cta',
         'cta_label',
         'Accedi al tuo spazio'),
        ('magic_link.legal',
         'meta',
         "Se non hai richiesto tu questo accesso, puoi ignorare questa email."),
    ],
}

NAMESPACE = 'system.email'


def main() -> int:
    n = 0
    for page_key, blocks in TEMPLATES.items():
        for block_key, block_type, source in blocks:
            upsert_block(
                scope='system',
                namespace=NAMESPACE,
                block_key=block_key,
                page_key=page_key,
                block_type=block_type,
                source_locale='it-IT',
                source_value=source,
            )
            n += 1
            print(f"  ✓ {NAMESPACE}.{block_key}")
    print(f"\nSeeded {n} email editorial blocks across {len(TEMPLATES)} templates "
          f"(ALE auto-localizes to active locales).")
    return n


if __name__ == '__main__':
    main()
