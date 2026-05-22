#!/usr/bin/env python3
"""ITER137 · Part 3c — moodboards.* remainder (page/pages/picker/placeholder/premium/presentation/shadow/skeleton/templates)."""
from __future__ import annotations
import json
from pathlib import Path

I18N = Path("/app/frontend/src/i18n/strings")

CANON: dict[str, tuple[str, str]] = {
    # ─── page (single) ──────────────────────────────────────────────────
    "moodboards.page.add":              ("Aggiungi pagina",     "Add page"),
    "moodboards.page.delete":           ("Elimina pagina",      "Delete page"),
    "moodboards.page.duplicate":        ("Duplica pagina",      "Duplicate page"),
    "moodboards.page.eyebrow":          ("Pagina",              "Page"),
    "moodboards.page.fromTemplate":     ("Da template",         "From template"),
    "moodboards.page.insertHere":       ("Inserisci qui",       "Insert here"),
    "moodboards.page.new":              ("Nuova pagina",        "New page"),
    "moodboards.page.untitled":         ("Pagina senza titolo", "Untitled page"),

    # ─── pages (plural overview) ────────────────────────────────────────
    "moodboards.pages.exploreAll":      ("Esplora tutte le pagine","Explore all pages"),
    "moodboards.pages.hint":
        ("Scegli un layout per iniziare a comporre.",
         "Choose a layout to start composing."),
    "moodboards.pages.layouts":         ("Layout",              "Layouts"),
    "moodboards.pages.thisProject":     ("In questo journey",   "In this journey"),
    "moodboards.pages.untitled":        ("Senza titolo",        "Untitled"),

    # ─── picker ─────────────────────────────────────────────────────────
    "moodboards.picker.eyebrow":        ("Inserisci nella moodboard",
                                         "Insert into moodboard"),
    "moodboards.picker.insertAfter":    ("Inserisci dopo",      "Insert after"),
    "moodboards.picker.subtitle":
        ("Scegli da quale moodboard prelevare il contenuto.",
         "Choose which moodboard to pull content from."),
    "moodboards.picker.title":          ("Seleziona moodboard", "Select moodboard"),

    # ─── placeholder ────────────────────────────────────────────────────
    "moodboards.placeholder.replaceImage": ("Sostituisci immagine","Replace image"),

    # ─── premium ────────────────────────────────────────────────────────
    "moodboards.premium.appliedMulti":  ("Applicato a più pagine",
                                         "Applied to multiple pages"),
    "moodboards.premium.applyFailed":   ("Impossibile applicare il template",
                                         "Could not apply the template"),
    "moodboards.premium.archiveTitle":  ("Archivio template premium",
                                         "Premium template archive"),
    "moodboards.premium.completeTemplates.short":
        ("Template completi",        "Complete templates"),
    "moodboards.premium.failed":
        ("Operazione non riuscita. Riprova.",
         "Operation failed. Please try again."),
    "moodboards.premium.intro.short":
        ("Layout pronti all'uso, curati per atelier editoriali.",
         "Ready-made layouts curated for editorial ateliers."),
    "moodboards.premium.pageCount.plural":   ("{count} pagine", "{count} pages"),
    "moodboards.premium.pageCount.singular": ("1 pagina",       "1 page"),
    "moodboards.premium.partialPages":
        ("Alcune pagine non sono state aggiornate.",
         "Some pages were not updated."),

    # ─── presentation ───────────────────────────────────────────────────
    "moodboards.presentation.chapters": ("Capitoli",            "Chapters"),
    "moodboards.presentation.empty":
        ("Nessuna pagina pronta per la presentazione.",
         "No pages ready to present."),

    # ─── shadow presets ─────────────────────────────────────────────────
    "moodboards.shadow.dramatic":       ("Drammatica",          "Dramatic"),
    "moodboards.shadow.medium":         ("Media",               "Medium"),
    "moodboards.shadow.none":           ("Nessuna",             "None"),
    "moodboards.shadow.soft":           ("Morbida",             "Soft"),

    # ─── skeleton ───────────────────────────────────────────────────────
    "moodboards.skeleton.applied":      ("Layout applicato",    "Layout applied"),
    "moodboards.skeleton.applyFailed":  ("Impossibile applicare il layout",
                                         "Could not apply the layout"),
    "moodboards.skeleton.section.eyebrow": ("Scheletri di pagina","Page skeletons"),
    "moodboards.skeleton.section.intro":
        ("Strutture rapide per impostare una pagina in pochi secondi.",
         "Quick scaffolds to set up a page in seconds."),
    "moodboards.skeleton.singlePages":  ("Pagine singole",      "Single pages"),

    # ─── templates ──────────────────────────────────────────────────────
    "moodboards.templates.blank":       ("Pagina bianca",       "Blank page"),
    "moodboards.templates.blankDesc":
        ("Parti da una pagina vuota.",
         "Start from an empty page."),
    "moodboards.templates.derivedFrom": ("Derivato da",         "Derived from"),
    "moodboards.templates.eyebrow":     ("Template",            "Templates"),
    "moodboards.templates.pageCount":   ("{count} pagine",      "{count} pages"),
    "moodboards.templates.saveAs":      ("Salva come template", "Save as template"),
    "moodboards.templates.saveFailed":
        ("Impossibile salvare il template",
         "Could not save the template"),
    "moodboards.templates.saved":       ("Template salvato",    "Template saved"),
    "moodboards.templates.startBlank":  ("Inizia da bianco",    "Start blank"),
    "moodboards.templates.tenantPreset":("Preset dello studio", "Studio preset"),
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
    for key, pair in CANON.items():
        cur = d; ok = True
        for part in key.split('.'):
            if isinstance(cur, dict) and part in cur: cur = cur[part]
            else: ok = False; break
        if ok and isinstance(cur, str) and cur.strip(): continue
        _set_nested(d, key.split('.'), pair[idx]); n += 1
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2), "utf-8")
    return n


if __name__ == "__main__":
    print(f"✦ {len(CANON)} canonical moodboards.* keys (part 3c)")
    print(f"  · it-IT: {apply('it-IT', 0)}")
    print(f"  · en-US: {apply('en-US', 1)}")
