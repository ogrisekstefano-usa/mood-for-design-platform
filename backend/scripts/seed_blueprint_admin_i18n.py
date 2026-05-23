"""ITER143C · Seed Blueprint Command Center™ editorial copy.

Populates `editorial_blocks` (scope=system) for the cinematic admin shell:

  • admin.shell          → sidebar labels + identity strip
  • admin.dashboard      → Dashboard Governance™ headline + metric labels
  • admin.tenants        → Tenant Orchestration™ headline + column labels
  • admin.users          → User Governance™ headline + column labels
  • admin.presets        → Atelier Presets™ headline
  • admin.editorial      → Editorial Runtime™ (Narrative Orchestration)
  • admin.email          → Email Governance™ (control tower)
  • admin.demo           → Demo Governance™ (Golden Snapshot)
  • admin.action.*       → shared action labels (refresh, etc.)

Source locale is IT (the platform's authoring language). ALE auto-localizes
into the 6 ACTIVE_LOCALES at upsert time.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from services.editorial_content_orchestrator import upsert_block  # noqa: E402


SHELL = {
    'page_key': 'blueprint-admin-shell', 'namespace': 'admin.shell',
    'blocks': [
        ('nav.dashboard',  'label', 'Governance'),
        ('nav.tenants',    'label', 'Studi'),
        ('nav.users',      'label', 'Utenti'),
        ('nav.presets',    'label', 'Preset Atelier'),
        ('nav.editorial',  'label', 'Editorial Runtime'),
        ('nav.tenant_configuration', 'label', 'Configurazione Tenant'),
        ('nav.language',   'label', 'Lingue'),
        ('nav.email',      'label', 'Email'),
        ('nav.demo',       'label', 'Demo Tenant'),
    ],
}


def _ns(page_key, namespace, blocks):
    return {'page_key': page_key, 'namespace': namespace, 'blocks': blocks}


DASHBOARD = _ns('blueprint-admin-dashboard', 'admin.dashboard', [
    ('eyebrow', 'hero_subtitle', 'Mission Control'),
    ('title',   'hero_title',
     'Lo stato vivo della piattaforma.'),
    ('sub',     'hero_subtitle',
     "Una lettura silenziosa di tenant, utenti, runtime editoriale e "
     "delivery. Aggiornata in tempo reale."),
    ('metric.tenants',           'label', 'Studi attivi'),
    ('metric.users',             'label', 'Utenti attivi'),
    ('metric.journeys',          'label', 'Design Journey aperti'),
    ('metric.editorial_blocks',  'label', 'Blocchi editoriali'),
    ('metric.editorial_blocks.hint', 'helper', 'governati dal runtime'),
    ('section.coverage',         'label',
     'Copertura linguistica del runtime editoriale'),
])


TENANTS = _ns('blueprint-admin-tenants', 'admin.tenants', [
    ('eyebrow', 'hero_subtitle', 'Tenant Orchestration'),
    ('title',   'hero_title',    'Gli studi che orbitano nel sistema.'),
    ('sub',     'hero_subtitle',
     "Stato, dominio, sottoscrizione e team di ogni studio attivo."),
    ('col.name',    'label', 'Studio'),
    ('col.slug',    'label', 'Subdomain'),
    ('col.plan',    'label', 'Piano'),
    ('col.locale',  'label', 'Lingua'),
    ('col.members', 'label', 'Membri'),
    ('col.status',  'label', 'Stato'),
])


USERS = _ns('blueprint-admin-users', 'admin.users', [
    ('eyebrow', 'hero_subtitle', 'User Governance'),
    ('title',   'hero_title',    'Le persone, i ruoli, gli accessi.'),
    ('sub',     'hero_subtitle',
     "ROOT, Collaboratori Blueprint, Admin di studio, Operatori e Clienti."),
    ('col.email',  'label', 'Email'),
    ('col.name',   'label', 'Nome'),
    ('col.role',   'label', 'Ruolo'),
    ('col.tenant', 'label', 'Studio'),
    ('col.status', 'label', 'Stato'),
])


PRESETS = _ns('blueprint-admin-presets', 'admin.presets', [
    ('eyebrow', 'hero_subtitle', 'Atelier Presets'),
    ('title',   'hero_title',    'I sei mondi visivi del sistema.'),
    ('sub',     'hero_subtitle',
     "Preset master congelati. Ogni studio può selezionarli — non "
     "rinominarli, non rifondarli."),
])


EDITORIAL = _ns('blueprint-admin-editorial', 'admin.editorial', [
    ('eyebrow', 'hero_subtitle', 'Narrative Orchestration'),
    ('title',   'hero_title',
     'La voce della piattaforma, governata da qui.'),
    ('sub',     'hero_subtitle',
     "Hero, CTA, narrative di onboarding, intro editoriali, footer. "
     "Ogni blocco è auto-localizzato. Override manuali rispettati."),
    ('col.block',    'label', 'Blocco'),
    ('col.source',   'label', 'Sorgente'),
    ('col.coverage', 'label', 'Copertura'),
    ('col.actions',  'label', '·'),
    ('action.regenerate', 'cta_label', 'Ri-orchestra'),
])


EMAIL = _ns('blueprint-admin-email', 'admin.email', [
    ('eyebrow', 'hero_subtitle', 'Email Governance'),
    ('title',   'hero_title',
     'La torre di controllo delle comunicazioni.'),
    ('sub',     'hero_subtitle',
     "Onboarding, inviti, journey notifications, proposal. Per tenant, "
     "evento, lingua. (Provider integration: ITER143E)"),
    ('metric.sent',     'label', 'Inviate'),
    ('metric.queued',   'label', 'In coda'),
    ('metric.failed',   'label', 'Fallite'),
    ('metric.bounced',  'label', 'Bounce'),
    ('col.when',        'label', 'Quando'),
    ('col.event',       'label', 'Evento'),
    ('col.recipient',   'label', 'Destinatario'),
    ('col.subject',     'label', 'Oggetto'),
    ('col.status',      'label', 'Stato'),
    ('empty',           'empty_state',
     "Nessuna email registrata ancora. Il sistema è in attesa del "
     "primo evento."),
])


DEMO = _ns('blueprint-admin-demo', 'admin.demo', [
    ('eyebrow', 'hero_subtitle', 'Demo Governance'),
    ('title',   'hero_title',
     'Il Golden Demo Tenant. Sempre pronto a ripartire.'),
    ('sub',     'hero_subtitle',
     "Ripristina la dimostrazione cinematica a uno stato iniziale "
     "deterministico — preset, lingua e governance restano intatti."),
    ('metric.tenant',        'label', 'Tenant'),
    ('metric.users',         'label', 'Utenti'),
    ('metric.relationships', 'label', 'Relazioni CRM'),
    ('metric.journeys',      'label', 'Journey aperti'),
    ('unavailable',          'empty_state',
     "Demo tenant non disponibile."),
    ('last_snapshot',        'label', 'Ultimo snapshot'),
    ('restore.title',        'label', 'Restore Golden Snapshot™'),
    ('restore.body',         'helper',
     "Pulizia chirurgica del runtime: relazioni, journey, moodboard. "
     "Vengono preservati: utenti, preset Atelier, configurazione tenant, "
     "Editorial Runtime, governance linguistica."),
    ('restore.cta',          'cta_label', 'Avvia restore'),
    ('restore.confirm',      'helper', 'Sei sicuro? Operazione irreversibile.'),
    ('restore.confirm_cta',  'cta_label', 'Sì, ripristina ora'),
    ('restore.cancel',       'cta_label', 'Annulla'),
])


INDEX = _ns('blueprint-admin-index', 'admin.index', [
    ('eyebrow', 'hero_subtitle', 'Blueprint Command Center'),
    ('title',   'hero_title',    'Benvenuto al centro di governance.'),
    ('sub',     'hero_subtitle',
     "Tutto ciò che riguarda l'orchestrazione globale della piattaforma "
     "vive qui sotto. Inizia dalla Governance."),
    ('cta',     'cta_label',     'Vai alla Governance'),
])


ACTIONS = _ns('blueprint-admin-actions', 'admin.action', [
    ('refresh', 'cta_label', 'Aggiorna'),
])


COLLECTIONS = [SHELL, DASHBOARD, TENANTS, USERS, PRESETS, EDITORIAL,
               EMAIL, DEMO, INDEX, ACTIONS]


def seed(regenerate: bool = False) -> dict:
    inserted = 0
    failures = 0
    # ALL admin namespaces share a single page_key so that the
    # AdminShell — which mounts EditorialBundleProvider(pageKeys=['blueprint-admin-shell'])
    # — receives the entire governance vocabulary in one HTTP roundtrip.
    SHELL_PAGE = 'blueprint-admin-shell'
    for col in COLLECTIONS:
        ns = col['namespace']
        print(f"\n▸ {ns}")
        for block_key, block_type, source in col['blocks']:
            try:
                upsert_block(
                    scope='system', namespace=ns, block_key=block_key,
                    source_value=source, page_key=SHELL_PAGE,
                    block_type=block_type, source_locale='it',
                    auto_localize=True, force_regenerate=regenerate,
                )
                inserted += 1
                print(f"  ✓ {block_key}")
                time.sleep(0.05)
            except Exception as e:
                failures += 1
                print(f"  ✗ {block_key} · {e}")
    return {'inserted': inserted, 'failures': failures}


def main() -> int:
    print("🎬 ITER143C · seeding Blueprint Command Center™ editorial copy")
    out = seed()
    print(f"\n── Done · upserts={out['inserted']} failures={out['failures']} ──")
    return 0 if out['failures'] == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
