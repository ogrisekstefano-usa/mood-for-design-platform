"""ITER144.1 · Seed Module Guard editorial copy.

Populates `editorial_blocks` (scope=system) for the Cinematic Blocked
State™ surface. Source locale IT; ALE auto-localizes into the active
locales at upsert time.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from services.editorial_content_orchestrator import upsert_block  # noqa: E402


BLOCKS = {
    'page_key': 'system-module-guard',
    'namespace': 'system.module_guard',
    'blocks': [
        # LOCKED
        ('locked.eyebrow', 'meta',      'Modulo bloccato'),
        ('locked.title',   'narrative', 'Questo capitolo è riservato.'),
        ('locked.lede',    'narrative',
         "L'accesso a questo modulo è custodito. Contattaci per attivarlo nel tuo runtime."),

        # DISABLED
        ('disabled.eyebrow', 'meta',      'Modulo disattivato'),
        ('disabled.title',   'narrative', 'Questo spazio è in silenzio.'),
        ('disabled.lede',    'narrative',
         "Il tuo studio ha scelto di non operare in questa zona del runtime. Quando vorrai aprire questo capitolo, sarà qui ad aspettarti."),

        # COMING SOON
        ('coming_soon.eyebrow', 'meta',      'In arrivo'),
        ('coming_soon.title',   'narrative', 'Stiamo componendo questo capitolo.'),
        ('coming_soon.lede',    'narrative',
         'Quando sarà pronto, apparirà naturalmente nel tuo runtime. Nessuna fretta — la cura ha il suo tempo.'),

        # HIDDEN
        ('hidden.eyebrow', 'meta',      'Nascosto'),
        ('hidden.title',   'narrative', 'Niente da vedere qui, per ora.'),
        ('hidden.lede',    'narrative',
         'Questa superficie esiste, ma è invisibile per il tuo runtime. Continueremo a curarla in silenzio.'),

        # BETA RESTRICTED
        ('beta_restricted.eyebrow', 'meta',      'Beta riservata'),
        ('beta_restricted.title',   'narrative', 'Accesso anticipato richiesto.'),
        ('beta_restricted.lede',    'narrative',
         'Questo modulo è in beta e attende una manciata di studi pilota. Vuoi entrare nella prima ondata?'),

        # CTA
        ('cta.home', 'cta_label', 'Torna alla dashboard'),
    ],
}


def main() -> int:
    n = 0
    for block_key, block_type, source_value in BLOCKS['blocks']:
        upsert_block(
            scope='system',
            namespace=BLOCKS['namespace'],
            block_key=block_key,
            page_key=BLOCKS['page_key'],
            block_type=block_type,
            source_locale='it-IT',
            source_value=source_value,
        )
        n += 1
        print(f"  ✓ {BLOCKS['namespace']}.{block_key}")
    print(f"\nSeeded {n} module_guard editorial blocks (ALE auto-localizes to active locales).")
    return n


if __name__ == '__main__':
    main()
