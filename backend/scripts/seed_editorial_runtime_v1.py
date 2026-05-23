"""ITER143A+ · Seed the Dynamic Editorial Runtime™ source content.

Populates `editorial_blocks` (scope=system) for the public surfaces that
ITER143A+ migrates off of hardcoded JSX strings:

  • site.begin_journey   → /begin-journey (3-step ritual)
  • site.professionals   → /professionals  (gateway hub)
  • site.header          → top navigation + storefront chrome
  • site.footer          → legal + editorial footer

After insert, the orchestrator auto-localizes via ALE into:
  it-it · en-us · en-gb · fr-fr · de-de · es-es

Run idempotently — re-running is safe (uses upsert_block which detects
drift and only refreshes stale entries).

Usage:
    cd /app && python3 backend/scripts/seed_editorial_runtime_v1.py
    cd /app && python3 backend/scripts/seed_editorial_runtime_v1.py --regenerate
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

# Make backend importable when this script runs from /app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.editorial_content_orchestrator import upsert_block  # noqa: E402


# ─── Source content (Italian, MOOD for DESIGN™ house voice) ───────────
BEGIN_JOURNEY = {
    'page_key':  'begin-journey',
    'namespace': 'site.begin_journey',
    'blocks': [
        # Eyebrows + step labels
        ('step1.eyebrow', 'hero_subtitle', 'Primo Passo · Atmosfera'),
        ('step2.eyebrow', 'hero_subtitle', 'Secondo Passo · Come Vivi gli Spazi'),
        ('step3.eyebrow', 'hero_subtitle', 'Ultimo Passo · Conosciamoci'),
        ('step1.short', 'label', 'Atmosfera'),
        ('step2.short', 'label', 'Come vivi'),
        ('step3.short', 'label', 'Conosciamoci'),

        # Step 1 — Atmosphere
        ('step1.title', 'hero_title',
         'Quale atmosfera stai cercando?'),
        ('step1.subtitle', 'hero_subtitle',
         'Inizia a raccontarci lo spazio che immagini. Senza fretta — sono '
         'le impressioni, non le specifiche tecniche, a guidarci.'),
        ('step1.field.space.label', 'label', 'Quale spazio immagini?'),
        ('step1.field.how_to_feel.label', 'label',
         'Come vuoi sentirti in questo spazio?'),
        ('step1.field.how_to_feel.placeholder', 'placeholder',
         'Una sensazione, un momento del giorno, un ricordo…'),
        ('step1.field.references.label', 'label',
         'Hai riferimenti che ami?'),
        ('step1.field.references.placeholder', 'placeholder',
         "Una città, un film, un materiale, un ricordo, un'immagine…"),
        ('step1.field.references.hint', 'helper',
         "Niente di formale: tutto quello che ti viene in mente."),
        ('step1.cta.next', 'cta_label', 'Continua il racconto'),
        ('step1.cta.required', 'helper',
         "Lasciaci almeno un'impressione per continuare."),

        # Step 1 — chips (space kinds)
        ('chip.space.home',        'chip', 'Casa'),
        ('chip.space.showroom',    'chip', 'Showroom'),
        ('chip.space.hospitality', 'chip', 'Hospitality'),
        ('chip.space.office',      'chip', 'Ufficio'),
        ('chip.space.other',       'chip', 'Uno spazio dedicato'),

        # Step 2 — How you live
        ('step2.title', 'hero_title', 'Come vivi gli spazi?'),
        ('step2.subtitle', 'hero_subtitle',
         "Aiutaci a comprendere il tuo modo di abitare. Non i mobili che vorrai — "
         "i gesti, le abitudini, la luce di una giornata."),
        ('step2.field.guests.label', 'label', 'Ricevi ospiti spesso?'),
        ('step2.field.materials.label', 'label',
         'Quali materiali ti fanno stare bene?'),
        ('step2.field.ambiance.label', 'label', 'Preferisci ambienti…'),
        ('step2.cta.back', 'cta_label', '← Indietro'),
        ('step2.cta.next', 'cta_label', 'Avvicinati al tuo Journey'),

        # Step 2 — chips (guests)
        ('chip.guests.often',     'chip', 'Sì, spesso'),
        ('chip.guests.sometimes', 'chip', 'Talvolta'),
        ('chip.guests.rarely',    'chip', 'Raramente'),
        ('chip.guests.alone',     'chip', 'Vivo lo spazio in solitudine'),

        # Step 2 — chips (materials)
        ('chip.material.wood',     'chip', 'Legno'),
        ('chip.material.stone',    'chip', 'Pietra'),
        ('chip.material.textiles', 'chip', 'Tessuti naturali'),
        ('chip.material.metals',   'chip', 'Metalli caldi'),
        ('chip.material.glass',    'chip', 'Vetro'),
        ('chip.material.velvet',   'chip', 'Velluto'),
        ('chip.material.marble',   'chip', 'Marmo'),
        ('chip.material.linen',    'chip', 'Lino'),

        # Step 2 — chips (ambiance)
        ('chip.ambiance.warm_enveloping', 'chip', 'Caldi e avvolgenti'),
        ('chip.ambiance.sober_minimal',   'chip', 'Sobri e minimali'),
        ('chip.ambiance.luminous_airy',   'chip', 'Luminosi e ariosi'),
        ('chip.ambiance.tactile_sensory', 'chip', 'Tattili e sensoriali'),
        ('chip.ambiance.cinematic',       'chip', 'Cinematografici'),

        # Step 3 — Welcome
        ('step3.title', 'hero_title', 'Da dove cominciamo?'),
        ('step3.subtitle', 'hero_subtitle',
         "Tre dettagli soltanto. Il resto nascerà dalla conversazione."),
        ('step3.field.first_name.label', 'label', 'Come ti chiamiamo?'),
        ('step3.field.email.label', 'label', 'Una mail per scriverti'),
        ('step3.field.phone.label', 'label',
         'Un numero, se preferisci sentirti'),
        ('step3.field.phone.hint', 'helper',
         "Facoltativo. Alcune cose si capiscono meglio a voce."),
        ('step3.cta.back', 'cta_label', '← Indietro'),
        ('step3.cta.submit', 'cta_label', 'Inizia il tuo Design Journey™'),
        ('step3.microcopy', 'helper',
         "Nessun preventivo, nessuna pressione. Solo una conversazione "
         "per capire se possiamo essere il tuo studio."),

        # Overlay & toasts
        ('overlay.opening', 'narrative',
         'Stiamo aprendo il tuo Design Journey™…'),
        ('toast.required', 'validation',
         "Lascia almeno il tuo nome e una mail per poterti scrivere."),
        ('toast.started', 'toast',
         'Il tuo Design Journey™ è iniziato.'),
        ('toast.failed', 'validation',
         "Non siamo riusciti ad avviare il Journey. Riprova tra un istante."),
    ],
}


PROFESSIONALS = {
    'page_key':  'professionals',
    'namespace': 'site.professionals',
    'blocks': [
        ('hero.eyebrow', 'hero_subtitle', 'Per Professionisti'),
        ('hero.headline', 'hero_title',
         "Un ecosistema editoriale per chi disegna il futuro dell'abitare."),
        ('hero.sub', 'hero_subtitle',
         "Studio collettivo, intelligenza culturale, presentazione cinematografica. "
         "MOOD for DESIGN™ è la regia editoriale del tuo lavoro."),

        # CTA 1 — Explore the studio
        ('cta.explore.kicker', 'helper', 'Lo Studio'),
        ('cta.explore.title',  'cta_label',
         "Esplora l'atelier"),
        ('cta.explore.body',   'helper',
         "Scopri la voce editoriale dello studio, i progetti pubblicati, le "
         "collezioni curate."),
        ('cta.explore.label',  'cta_label', 'Visita lo studio'),

        # CTA 2 — Start a professional project
        ('cta.start.kicker', 'helper', 'Nuovo Progetto'),
        ('cta.start.title',  'cta_label',
         'Inizia un progetto professionale'),
        ('cta.start.body',   'helper',
         "Apri un Design Journey™ con un cliente, condividi moodboard, "
         "proposte e momenti di chiusura cinematici."),
        ('cta.start.label',  'cta_label', 'Avvia un Journey'),

        # CTA 3 — Access workspace
        ('cta.access.kicker', 'helper', 'Atelier'),
        ('cta.access.title',  'cta_label', 'Accedi al tuo workspace'),
        ('cta.access.body',   'helper',
         "Entra nel tuo Blueprint Command Center™ — CRM, calendario, "
         "moodboard, atelier identity."),
        ('cta.access.label',  'cta_label', 'Vai al workspace'),

        # Meta
        ('meta.title', 'meta',
         'Per Professionisti · MOOD for DESIGN™'),
    ],
}


SITE_HEADER = {
    'page_key':  'site-header',
    'namespace': 'site.header',
    'blocks': [
        ('nav.projects',      'label', 'Progetti'),
        ('nav.magazine',      'label', 'Magazine'),
        ('nav.professionals', 'label', 'Professionisti'),
        ('nav.begin_journey', 'cta_label', 'Inizia il tuo Journey'),
        ('nav.login',         'cta_label', 'Accedi'),
        ('nav.locale_picker.aria',  'label',
         'Seleziona lingua e mercato'),
    ],
}


SITE_FOOTER = {
    'page_key':  'site-footer',
    'namespace': 'site.footer',
    'blocks': [
        ('tagline', 'narrative',
         "Un'orchestrazione editoriale per studi di interior design "
         "internazionali."),
        ('column.studio.title',  'label', 'Lo Studio'),
        ('column.studio.about',  'label', 'Chi siamo'),
        ('column.studio.work',   'label', 'Progetti'),
        ('column.studio.magazine', 'label', 'Magazine'),
        ('column.start.title',   'label', 'Inizia'),
        ('column.start.journey', 'label', 'Apri il tuo Design Journey™'),
        ('column.start.professionals', 'label', 'Sono un professionista'),
        ('column.legal.title',   'label', 'Note legali'),
        ('column.legal.privacy', 'label', 'Privacy'),
        ('column.legal.terms',   'label', 'Termini'),
        ('column.legal.cookies', 'label', 'Cookie'),
        ('rights',               'helper',
         '© MOOD for DESIGN™ · Tutti i diritti riservati.'),
    ],
}


SITE_COMMON = {
    'page_key':  'site-common',
    'namespace': 'site.common',
    'blocks': [
        ('loading',          'narrative', 'Un momento, stiamo componendo…'),
        ('error.generic',    'validation',
         "Qualcosa non ha risposto come avremmo voluto. Riprova tra un istante."),
        ('empty.default',    'empty_state',
         "Ancora nulla da mostrare qui."),
        ('cta.discover_more', 'cta_label', 'Scopri di più'),
        ('cta.start_journey', 'cta_label', 'Inizia il tuo Journey'),
    ],
}


COLLECTIONS = [BEGIN_JOURNEY, PROFESSIONALS, SITE_HEADER, SITE_FOOTER, SITE_COMMON]


def seed(regenerate: bool = False, auto_localize: bool = True) -> dict:
    inserted = 0
    skipped = 0
    failures = 0
    for collection in COLLECTIONS:
        page = collection['page_key']
        ns = collection['namespace']
        print(f"\n▸ {ns}  (page_key={page})")
        for block_key, block_type, source in collection['blocks']:
            try:
                upsert_block(
                    scope='system',
                    namespace=ns,
                    block_key=block_key,
                    source_value=source,
                    page_key=page,
                    block_type=block_type,
                    source_locale='it',
                    auto_localize=auto_localize,
                    force_regenerate=regenerate,
                )
                inserted += 1
                print(f"  ✓ {block_key}")
                # Tiny sleep to avoid hammering ALE provider on first cold cache.
                if auto_localize:
                    time.sleep(0.05)
            except Exception as e:
                failures += 1
                print(f"  ✗ {block_key} · {e}")
    return {'inserted_or_updated': inserted, 'skipped': skipped, 'failures': failures}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--regenerate', action='store_true',
                        help='Force ALE re-generation of every variant')
    parser.add_argument('--no-localize', action='store_true',
                        help='Skip ALE auto-localization (source only)')
    args = parser.parse_args()
    print("🎬 ITER143A+ · Dynamic Editorial Runtime™ — seeding source content")
    result = seed(regenerate=args.regenerate, auto_localize=not args.no_localize)
    print(f"\n── Done · upserts={result['inserted_or_updated']} "
          f"failures={result['failures']} ──")
    return 0 if result['failures'] == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
