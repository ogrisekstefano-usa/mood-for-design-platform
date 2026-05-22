#!/usr/bin/env python3
"""ITER137 · Hardcoded IT Eradication™ · Wave 2 — t() fallback canonical authoring.

37 t('key', null, 'Italian fallback') call-sites leak Italian when the key is
missing from a locale. Seed canonical it-IT + en-US so the engine fallback
chain (Italian-free for non-IT users) always has a Latin-friendly target.
"""
from __future__ import annotations
import json
from pathlib import Path

I18N = Path("/app/frontend/src/i18n/strings")

CANON: dict[str, tuple[str, str]] = {
    # DossierSection
    "dossier.chapter.approved":          ("Capitolo approvato",     "Chapter approved"),
    "dossier.chapter.closed":            ("Capitolo chiuso",        "Chapter closed"),
    "dossier.chapter.presented":         ("Capitolo condiviso",     "Chapter shared"),
    "dossier.chapter.in_progress":       ("Capitolo in lavorazione","Chapter in progress"),
    "dossier.chapter.revision_requested":("Capitolo rivisitato",    "Chapter revisited"),
    "dossier.chapter.default":           ("Capitolo",               "Chapter"),
    "dossier.chapters.eyebrow":          ("I capitoli attraversati","The chapters you’ve walked through"),
    "dossier.transformations.eyebrow":   ("Trasformazioni dello spazio",
                                          "Transformations of the space"),
    # ClientCompanionPage
    "companion.card.chapter_active":     ("Capitolo attivo",        "Active chapter"),
    "companion.card.progress":           ("{done} su {total} capitoli approvati",
                                          "{done} of {total} chapters approved"),
    "companion.hero.cta":                ("Esplora il capitolo",    "Explore the chapter"),
    "companion.section.active_chapter.eyebrow":
        ("Capitolo attivo · Active Chapter™",
         "Active chapter · Active Chapter™"),
    "companion.section.active_chapter.empty_title":
        ("In attesa del prossimo capitolo",
         "Awaiting the next chapter"),
    "companion.section.archive.title":   ("I capitoli che hai attraversato",
                                          "The chapters you’ve walked through"),
    "companion.error.title":             ("Questo Journey è in attesa",
                                          "This Journey is awaiting"),
    # ClientJourneysIndexPage
    "companion.index.hero.title":        ("I tuoi percorsi progettuali",
                                          "Your design journeys"),
    # EditorialCalendarPage / MarketEditionsToolbar
    "editorial.presence.empty":          ("Nessun mercato con eventi nella finestra corrente.",
                                          "No market with events in the current window."),
    "editorial.cta.new_master":          ("Nuovo Editorial Master","New editorial master"),
    "editorial.cta.new_variant":         ("Nuova Market Edition",  "New market edition"),
    # Projects
    "projects.newProject":               ("Nuovo progetto",        "New project"),
    "projects.tabs.all":                 ("Tutti",                 "All"),
    "projects.empty.title":              ("Nessun viaggio progettuale ancora aperto",
                                          "No design journey opened yet"),
    "projects.empty.subtitle":           ("Apri il primo capitolo del tuo studio.",
                                          "Open the first chapter of your studio."),
    "projects.empty.open_first_journey": ("+ Apri il primo viaggio",
                                          "+ Open the first journey"),
    "projects.card.continue_journey":    ("Continua il viaggio",   "Continue the journey"),
    "projects.actions.upgrade_for_more": ("Upgrade per crearne altri",
                                          "Upgrade to create more"),
    "projects.actions.upgrade_plan":     ("Aggiorna il piano",     "Upgrade plan"),
    # InspirationsPage
    "inspirations.search.placeholder":   ("Cerca per atmosfera, materia, brand…",
                                          "Search by atmosphere, material, brand…"),
    "inspirations.cta.import_catalog":   ("Importa catalogo fornitore",
                                          "Import supplier catalog"),
    "inspirations.cta.add_reference":    ("Aggiungi riferimento",  "Add reference"),
    "inspirations.empty.hint":
        ("Aggiungi il primo riferimento: un upload, un link Pinterest, un link Instagram o qualsiasi URL di immagine. MOOD lo trasformerà in una pagina del tuo atlante curatoriale.",
         "Add the first reference: an upload, a Pinterest link, an Instagram link or any image URL. MOOD will turn it into a page of your curated atlas."),
    "inspirations.empty.cta":            ("Aggiungi il primo riferimento",
                                          "Add the first reference"),
    "inspirations.toast.imported":       ("Importati {count} prodotti come Product Inspirations™.",
                                          "Imported {count} products as Product Inspirations™."),
    # BrandStudio
    "brand.save_changes":                ("Salva modifiche",        "Save changes"),
}


def _set_nested(d, parts, value):
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value


def apply(locale, idx):
    p = I18N / f"{locale}.json"
    d = json.loads(p.read_text("utf-8"))
    n = 0
    for k, pair in CANON.items():
        cur = d; ok = True
        for part in k.split("."):
            if isinstance(cur, dict) and part in cur: cur = cur[part]
            else: ok = False; break
        if ok and isinstance(cur, str) and cur.strip(): continue
        _set_nested(d, k.split("."), pair[idx])
        n += 1
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2), "utf-8")
    return n


if __name__ == "__main__":
    print(f"✦ {len(CANON)} keys")
    print(f"  · it-IT: {apply('it-IT', 0)}")
    print(f"  · en-US: {apply('en-US', 1)}")
