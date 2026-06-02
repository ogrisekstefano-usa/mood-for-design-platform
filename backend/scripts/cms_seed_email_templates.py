"""
Seed CMS — Email templates for Tenant Activation Lifecycle.
─────────────────────────────────────────────────────────────────────────────
Editorial blocks under namespace `email.<template_key>.*`. Both source (it-IT)
and translated (en-US) values are populated for every template/field.

Templates:
  • studio_request_received   → to visitor on submit
  • admin_new_studio_request  → to MOOD super-admin on submit
  • advisor_new_lead          → to advisor when request is attributed
  • studio_request_review     → to visitor on status=under_review
  • studio_request_qualified  → to visitor on status=qualified
  • studio_request_rejected   → to visitor on status=rejected
  • studio_request_approved   → to visitor on tenant activation (companion of magic link)

Idempotent. Re-runnable safely.
"""
import os, sys, hashlib
import psycopg2
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
DATABASE_URL = os.environ.get('SESSION_POOLER_URL')

NAMESPACE = 'email'
SOURCE_LOCALE = 'it-IT'


TEMPLATES = {
    # ── 1) Visitor — submission received ────────────────────────────────
    'studio_request_received': {
        'it-IT': {
            'subject':       'Abbiamo ricevuto la tua candidatura · {{reference}}',
            'eyebrow':       'Candidatura ricevuta',
            'headline':      'Grazie, {{contact_name}}.',
            'body':          'Abbiamo ricevuto la candidatura di {{studio_name}} a MOOD for DESIGN.\n\nIl codice della tua candidatura è {{reference}}: tienilo per ogni comunicazione futura.\n\nNei prossimi due giorni lavorativi un Advisor MOOD prenderà in carico la richiesta, esaminerà il profilo del tuo studio e ti scriverà personalmente per il primo dialogo.\n\nMOOD non è un servizio in self-serve: ogni Blueprint viene configurato insieme. Per questo prendiamo il tempo di conoscerti prima.',
            'cta_label':     '',
            'cta_url_path':  '',
            'note':          'Non è necessario rispondere a questa email. Ti contatteremo direttamente.',
            'signature':     'L\'ecosistema MOOD for DESIGN™',
        },
        'en-US': {
            'subject':       'We received your application · {{reference}}',
            'eyebrow':       'Application received',
            'headline':      'Thank you, {{contact_name}}.',
            'body':          'We received the application from {{studio_name}} to MOOD for DESIGN.\n\nYour reference code is {{reference}}: keep it for any future correspondence.\n\nWithin the next two business days, a MOOD Advisor will review your studio profile and reach out personally for the first conversation.\n\nMOOD is not a self-serve service: every Blueprint is configured together. That is why we take the time to know you first.',
            'cta_label':     '',
            'cta_url_path':  '',
            'note':          'You do not need to reply to this email. We will contact you directly.',
            'signature':     'The MOOD for DESIGN™ ecosystem',
        },
    },
    # ── 2) Super-admin notification ─────────────────────────────────────
    'admin_new_studio_request': {
        'it-IT': {
            'subject':       '[MOOD] Nuova candidatura · {{studio_name}} ({{reference}})',
            'eyebrow':       'Nuova candidatura',
            'headline':      '{{studio_name}}',
            'body':          'Reference: {{reference}}\nReferente: {{contact_name}} ({{contact_role}})\nEmail: {{contact_email}}\nTelefono: {{phone_full}}\nCittà: {{city}} · {{country}}\nMercati dichiarati: {{markets}}\nLingue: {{languages}}\nArchetipo: {{archetype}}\nEsperienze attivate: {{experiences}}\nWebsite: {{website}}\n\nNote del referente: {{notes}}\n\nFonte: {{source}}',
            'cta_label':     'Apri in Command Center',
            'cta_url_path':  '/admin/tenant-activation?focus={{request_id}}',
            'note':          'Questa email è generata automaticamente da MOOD for DESIGN.',
            'signature':     'MOOD for DESIGN · Studio Activation Pipeline',
        },
        'en-US': {
            'subject':       '[MOOD] New application · {{studio_name}} ({{reference}})',
            'eyebrow':       'New application',
            'headline':      '{{studio_name}}',
            'body':          'Reference: {{reference}}\nContact: {{contact_name}} ({{contact_role}})\nEmail: {{contact_email}}\nPhone: {{phone_full}}\nCity: {{city}} · {{country}}\nDeclared markets: {{markets}}\nLanguages: {{languages}}\nArchetype: {{archetype}}\nActivated experiences: {{experiences}}\nWebsite: {{website}}\n\nApplicant notes: {{notes}}\n\nSource: {{source}}',
            'cta_label':     'Open in Command Center',
            'cta_url_path':  '/admin/tenant-activation?focus={{request_id}}',
            'note':          'This email was generated automatically by MOOD for DESIGN.',
            'signature':     'MOOD for DESIGN · Studio Activation Pipeline',
        },
    },
    # ── 3) Advisor notification (if attributed) ─────────────────────────
    'advisor_new_lead': {
        'it-IT': {
            'subject':       '[MOOD] Nuovo lead assegnato · {{studio_name}}',
            'eyebrow':       'Nuovo lead nel tuo perimetro',
            'headline':      'Hai un nuovo studio in revisione.',
            'body':          'Studio: {{studio_name}}\nReferente: {{contact_name}}\nEmail: {{contact_email}}\nTelefono: {{phone_full}}\nReference: {{reference}}\nFonte: {{source}}\n\nLa candidatura è arrivata tramite la tua attribuzione. Apri la pratica per qualificare lo studio e avviare il primo contatto.',
            'cta_label':     'Apri la pratica',
            'cta_url_path':  '/admin/advisor-console/relations?request={{request_id}}',
            'note':          'I lead inattivi per più di 7 giorni rientrano nel pool generale MOOD.',
            'signature':     'MOOD for DESIGN · Advisor Console',
        },
        'en-US': {
            'subject':       '[MOOD] New lead assigned · {{studio_name}}',
            'eyebrow':       'New lead in your scope',
            'headline':      'You have a new studio under review.',
            'body':          'Studio: {{studio_name}}\nContact: {{contact_name}}\nEmail: {{contact_email}}\nPhone: {{phone_full}}\nReference: {{reference}}\nSource: {{source}}\n\nThis application came in through your attribution. Open the case to qualify the studio and start the first conversation.',
            'cta_label':     'Open the case',
            'cta_url_path':  '/admin/advisor-console/relations?request={{request_id}}',
            'note':          'Leads inactive for more than 7 days return to the MOOD general pool.',
            'signature':     'MOOD for DESIGN · Advisor Console',
        },
    },
    # ── 4) Visitor — under review ───────────────────────────────────────
    'studio_request_review': {
        'it-IT': {
            'subject':       'La tua candidatura è in revisione · {{reference}}',
            'eyebrow':       'In revisione',
            'headline':      'Stiamo esaminando {{studio_name}}.',
            'body':          'Un Advisor MOOD ha preso in carico la tua candidatura ({{reference}}).\n\nNelle prossime 48-72 ore esaminerà il profilo del tuo studio, le esperienze che hai selezionato e i mercati indicati. Se servono ulteriori dettagli, ti contatterà direttamente.\n\nTi terremo aggiornato sui prossimi passaggi.',
            'cta_label':     '',
            'cta_url_path':  '',
            'note':          'Conserva il codice {{reference}} per ogni comunicazione futura.',
            'signature':     'L\'ecosistema MOOD for DESIGN™',
        },
        'en-US': {
            'subject':       'Your application is under review · {{reference}}',
            'eyebrow':       'Under review',
            'headline':      'We are reviewing {{studio_name}}.',
            'body':          'A MOOD Advisor has taken charge of your application ({{reference}}).\n\nOver the next 48-72 hours, they will assess your studio profile, the experiences you selected, and the markets you indicated. If further details are needed, they will reach out directly.\n\nWe will keep you posted on the next steps.',
            'cta_label':     '',
            'cta_url_path':  '',
            'note':          'Keep your reference code {{reference}} for any future correspondence.',
            'signature':     'The MOOD for DESIGN™ ecosystem',
        },
    },
    # ── 5) Visitor — qualified ──────────────────────────────────────────
    'studio_request_qualified': {
        'it-IT': {
            'subject':       'La tua candidatura è stata qualificata · {{reference}}',
            'eyebrow':       'Qualificata',
            'headline':      'Procediamo con {{studio_name}}.',
            'body':          'L\'Advisor MOOD ha qualificato la tua candidatura ({{reference}}).\n\nIl prossimo passaggio è un dialogo di configurazione: un incontro dedicato in cui costruiremo insieme il Blueprint del tuo studio — moduli, mercati, advisor di riferimento, lingue, modalità di lavoro.\n\nTi contatteremo nei prossimi giorni per fissare l\'appuntamento.',
            'cta_label':     '',
            'cta_url_path':  '',
            'note':          'Il dialogo di configurazione dura circa 60 minuti. È il momento in cui il Blueprint prende forma.',
            'signature':     'L\'ecosistema MOOD for DESIGN™',
        },
        'en-US': {
            'subject':       'Your application has been qualified · {{reference}}',
            'eyebrow':       'Qualified',
            'headline':      'We are proceeding with {{studio_name}}.',
            'body':          'The MOOD Advisor has qualified your application ({{reference}}).\n\nThe next step is a configuration conversation: a dedicated session where we will build your studio\'s Blueprint together — modules, markets, reference advisor, languages, ways of working.\n\nWe will reach out in the coming days to schedule the appointment.',
            'cta_label':     '',
            'cta_url_path':  '',
            'note':          'The configuration conversation lasts about 60 minutes. It is the moment when the Blueprint takes shape.',
            'signature':     'The MOOD for DESIGN™ ecosystem',
        },
    },
    # ── 6) Visitor — rejected ───────────────────────────────────────────
    'studio_request_rejected': {
        'it-IT': {
            'subject':       'Aggiornamento sulla tua candidatura · {{reference}}',
            'eyebrow':       'Non possiamo proseguire',
            'headline':      'Grazie, {{contact_name}}.',
            'body':          'Abbiamo esaminato con cura la candidatura di {{studio_name}} ({{reference}}).\n\nAl momento non possiamo proseguire con l\'attivazione: MOOD lavora su un perimetro selezionato di studi e modalità di pratica, e in questa fase il match non è quello che cerchiamo per la qualità della rete.\n\nQuesto non è un giudizio sul tuo lavoro. Le ragioni possono essere geografiche, di archetipo, di stato del progetto o di capienza dell\'ecosistema. Ci farebbe piacere riascoltarti in futuro se il quadro cambia.',
            'cta_label':     '',
            'cta_url_path':  '',
            'note':          'Se vuoi capire meglio la nostra valutazione, scrivici. Risponderemo personalmente.',
            'signature':     'L\'ecosistema MOOD for DESIGN™',
        },
        'en-US': {
            'subject':       'Update on your application · {{reference}}',
            'eyebrow':       'We cannot proceed',
            'headline':      'Thank you, {{contact_name}}.',
            'body':          'We carefully reviewed the application from {{studio_name}} ({{reference}}).\n\nAt this time, we cannot proceed with activation: MOOD works with a selected scope of studios and practice modes, and at this stage the match is not what we are looking for to preserve the quality of the network.\n\nThis is not a judgement on your work. Reasons can be geographical, archetypal, project-stage related, or ecosystem-capacity related. We would be glad to hear from you again in the future if the picture changes.',
            'cta_label':     '',
            'cta_url_path':  '',
            'note':          'If you would like to better understand our assessment, write to us. We will reply personally.',
            'signature':     'The MOOD for DESIGN™ ecosystem',
        },
    },
    # ── 7) Visitor — approved (post-activation: single email with magic link) ──
    'studio_request_approved': {
        'it-IT': {
            'subject':       'Il tuo Blueprint è pronto · {{studio_name}}',
            'eyebrow':       'Blueprint attivato',
            'headline':      'Benvenuto in MOOD, {{contact_name}}.',
            'body':          'Il Blueprint di {{studio_name}} è stato configurato e attivato.\n\nUsa il pulsante qui sotto per accedere subito al tuo workspace. Da lì potrai impostare la tua password personale e iniziare a usare l\'ecosistema MOOD.',
            'cta_label':     'Apri il tuo Blueprint',
            'cta_url_path':  '',
            'note':          'Il link è personale, può essere usato una sola volta ed è valido per i prossimi {{magic_link_validity_days}} giorni. Se non lo vedi, controlla la cartella spam.',
            'signature':     'L\'ecosistema MOOD for DESIGN™',
        },
        'en-US': {
            'subject':       'Your Blueprint is ready · {{studio_name}}',
            'eyebrow':       'Blueprint activated',
            'headline':      'Welcome to MOOD, {{contact_name}}.',
            'body':          'The Blueprint for {{studio_name}} has been configured and activated.\n\nUse the button below to enter your workspace right away. From there you can set your personal password and start using the MOOD ecosystem.',
            'cta_label':     'Open your Blueprint',
            'cta_url_path':  '',
            'note':          'The link is personal, single-use and valid for the next {{magic_link_validity_days}} days. If you don\'t see it, please check your spam folder.',
            'signature':     'The MOOD for DESIGN™ ecosystem',
        },
    },
    # ── 8) Concierge: workspace recovery from public login ──
    'workspace_recovery_concierge': {
        'it-IT': {
            'subject':       'Workspace recovery · {{visitor_email}}',
            'eyebrow':       'Concierge alert',
            'headline':      'Un utente non trova il suo workspace.',
            'body':          'Email indicata: {{visitor_email}}\nIP origine: {{ip}}\n\nL\'utente ha cliccato su "Non trovi il tuo workspace?" dalla pagina di accesso. Verifica chi è (advisor lead? founder con vecchia email? cliente privato?) e contattalo entro 24h.',
            'cta_label':     'Apri il Command Center',
            'cta_url_path':  '/command-center/overview',
            'note':          'La risposta data all\'utente è una mail neutra di conferma. Non rivelare se l\'account esiste.',
            'signature':     'Sistema MOOD',
        },
        'en-US': {
            'subject':       'Workspace recovery · {{visitor_email}}',
            'eyebrow':       'Concierge alert',
            'headline':      'A user cannot locate their workspace.',
            'body':          'Email supplied: {{visitor_email}}\nOrigin IP: {{ip}}\n\nThe user clicked "Cannot find your workspace?" from the login page. Determine who they are (advisor lead? founder with stale email? private client?) and reach out within 24h.',
            'cta_label':     'Open Command Center',
            'cta_url_path':  '/command-center/overview',
            'note':          'The response shown to the user is a neutral acknowledgement. Do not reveal whether the account exists.',
            'signature':     'MOOD system',
        },
    },
}


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT id FROM tenants WHERE slug='studio'")
    tenant_id = cur.fetchone()[0]

    stats = {'blocks': 0, 'translations': 0}
    for template_key, locales_map in TEMPLATES.items():
        for field in locales_map['it-IT'].keys():
            namespace = NAMESPACE
            block_key = f"{template_key}.{field}"
            source_value = locales_map['it-IT'][field]
            h = hashlib.md5((source_value or '').encode()).hexdigest()
            cur.execute("""
                INSERT INTO editorial_blocks
                  (scope, tenant_id, namespace, block_key, block_type,
                   source_locale, source_value, source_hash, is_active, updated_at)
                VALUES
                  ('tenant', %s, %s, %s, 'text',
                   'it-IT', %s, %s, true, now())
                ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE
                  SET source_value=EXCLUDED.source_value,
                      source_hash=EXCLUDED.source_hash,
                      is_active=true,
                      updated_at=now()
                RETURNING id
            """, (tenant_id, namespace, block_key, source_value, h))
            block_id = cur.fetchone()[0]
            stats['blocks'] += 1

            for loc, fields in locales_map.items():
                val = fields.get(field, '')
                hh = hashlib.md5((val or '').encode()).hexdigest()
                cur.execute("""
                    INSERT INTO editorial_block_translations
                      (block_id, locale, value, source_hash, status, generated_by, updated_at)
                    VALUES
                      (%s, %s, %s, %s, %s, 'human', now())
                    ON CONFLICT (block_id, locale) DO UPDATE
                      SET value=EXCLUDED.value,
                          source_hash=EXCLUDED.source_hash,
                          status=EXCLUDED.status,
                          generated_by='human',
                          updated_at=now()
                """, (block_id, loc, val, hh,
                      'source' if loc == 'it-IT' else 'manual'))
                stats['translations'] += 1

    conn.commit()
    cur.close(); conn.close()
    print(f"BLOCKS:       {stats['blocks']}")
    print(f"TRANSLATIONS: {stats['translations']}")
    print(f"TEMPLATES:    {len(TEMPLATES)}")


if __name__ == '__main__':
    main()
