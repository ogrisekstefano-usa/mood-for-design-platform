#!/usr/bin/env python3
"""ITER137 · Wave 2b — Replace IT fallback strings inside t() calls with EN.

Even when the key exists in the registry for en-US/en-GB/fr-FR/de-DE/es-ES/ar,
the IT-as-fallback is dead code today. But it remains a foot-gun for the
future: if the key ever gets dropped from a locale, the user sees IT.
Replace every t('key', null, 'Italian') with t('key', null, '<English>').

Idempotent — only modifies the fallback string, not the key or first arg.
"""
import re
from pathlib import Path

SRC = Path("/app/frontend/src")

# (key, IT-fallback, EN-fallback)  — matches the same canonical set in Wave 2
REPL = [
    ("dossier.chapter.approved",          "Capitolo approvato",        "Chapter approved"),
    ("dossier.chapter.closed",            "Capitolo chiuso",           "Chapter closed"),
    ("dossier.chapter.presented",         "Capitolo condiviso",        "Chapter shared"),
    ("dossier.chapter.in_progress",       "Capitolo in lavorazione",   "Chapter in progress"),
    ("dossier.chapter.revision_requested","Capitolo rivisitato",       "Chapter revisited"),
    ("dossier.chapter.default",           "Capitolo",                  "Chapter"),
    ("dossier.chapters.eyebrow",          "I capitoli attraversati",   "The chapters you’ve walked through"),
    ("dossier.transformations.eyebrow",   "Trasformazioni dello spazio","Transformations of the space"),
    ("companion.card.chapter_active",     "Capitolo attivo",           "Active chapter"),
    ("companion.card.progress",           "{done} su {total} capitoli approvati",
                                          "{done} of {total} chapters approved"),
    ("companion.hero.cta",                "Esplora il capitolo",       "Explore the chapter"),
    ("companion.section.active_chapter.eyebrow",
         "Capitolo attivo · Active Chapter™", "Active chapter · Active Chapter™"),
    ("companion.section.active_chapter.empty_title",
         "In attesa del prossimo capitolo",   "Awaiting the next chapter"),
    ("companion.section.archive.title",   "I capitoli che hai attraversato",
                                          "The chapters you’ve walked through"),
    ("companion.error.title",             "Questo Journey è in attesa","This Journey is awaiting"),
    ("companion.index.hero.title",        "I tuoi percorsi progettuali","Your design journeys"),
    ("editorial.presence.empty",          "Nessun mercato con eventi nella finestra corrente.",
                                          "No market with events in the current window."),
    ("editorial.cta.new_master",          "Nuovo Editorial Master",    "New editorial master"),
    ("editorial.cta.new_variant",         "Nuova Market Edition",      "New market edition"),
    ("projects.newProject",               "Nuovo progetto",            "New project"),
    ("projects.tabs.all",                 "Tutti",                     "All"),
    ("projects.empty.title",              "Nessun viaggio progettuale ancora aperto",
                                          "No design journey opened yet"),
    ("projects.empty.subtitle",           "Apri il primo capitolo del tuo studio.",
                                          "Open the first chapter of your studio."),
    ("projects.empty.open_first_journey", "+ Apri il primo viaggio",   "+ Open the first journey"),
    ("projects.card.continue_journey",    "Continua il viaggio",       "Continue the journey"),
    ("projects.actions.upgrade_for_more", "Upgrade per crearne altri", "Upgrade to create more"),
    ("projects.actions.upgrade_plan",     "Aggiorna il piano",         "Upgrade plan"),
    ("inspirations.search.placeholder",   "Cerca per atmosfera, materia, brand…",
                                          "Search by atmosphere, material, brand…"),
    ("inspirations.cta.import_catalog",   "Importa catalogo fornitore","Import supplier catalog"),
    ("inspirations.cta.add_reference",    "Aggiungi riferimento",      "Add reference"),
    ("inspirations.empty.hint",
        "Aggiungi il primo riferimento: un upload, un link Pinterest, un link Instagram o qualsiasi URL di immagine. MOOD lo trasformerà in una pagina del tuo atlante curatoriale.",
        "Add the first reference: an upload, a Pinterest link, an Instagram link or any image URL. MOOD will turn it into a page of your curated atlas."),
    ("inspirations.empty.cta",            "Aggiungi il primo riferimento","Add the first reference"),
    ("inspirations.toast.imported",       "Importati {count} prodotti come Product Inspirations™.",
                                          "Imported {count} products as Product Inspirations™."),
]


def quote_safe(s: str) -> str:
    # Replace single quotes with the JS-safe variant to keep us inside a JSX
    # single-quoted string. We don't expect any single quotes in our EN
    # replacements, but be defensive.
    return s.replace("'", "\\'")


edited = 0
errors = []
for ext in ("*.jsx", "*.tsx", "*.js", "*.ts"):
    for p in SRC.rglob(ext):
        if "node_modules" in str(p): continue
        try: txt = p.read_text(encoding="utf-8")
        except: continue
        new_txt = txt
        any_change = False
        for key, it_fb, en_fb in REPL:
            # Match `t('key', <arg>, 'IT fallback'` and replace IT → EN
            # Use single OR double or backtick quotes around the fallback,
            # but preserve quote style.
            for q in ('"', "'", "`"):
                old = f"{q}{it_fb}{q}"
                if old not in new_txt: continue
                # Ensure it's preceded by a t() call referencing the same key.
                # We do a more conservative replacement: only replace when the
                # exact key + it_fb appear on the same line (single-line t()).
                pattern = re.compile(
                    rf"\bt\(\s*['\"`]({re.escape(key)})['\"`]\s*,[^,)\n]*?,\s*{re.escape(old)}",
                    flags=0,
                )
                def _sub(m):
                    return m.group(0)[:-len(old)] + f"{q}{quote_safe(en_fb)}{q}"
                new_txt2, n = pattern.subn(_sub, new_txt)
                if n > 0:
                    new_txt = new_txt2
                    any_change = True
        if any_change:
            p.write_text(new_txt, encoding="utf-8")
            edited += 1
            print(f"  ✓ {p.relative_to(SRC.parent)}")
print(f"\n✦ files patched: {edited}")
