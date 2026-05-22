#!/usr/bin/env python3
"""ITER137 · Part 3a — moodboards.* canonical authoring (top-level + assets + block + create + editor)."""
from __future__ import annotations
import json
from pathlib import Path

I18N = Path("/app/frontend/src/i18n/strings")

CANON: dict[str, tuple[str, str]] = {
    # ─── top-level shell ────────────────────────────────────────────────
    "moodboards.title":             ("Moodboard",            "Moodboards"),
    "moodboards.subtitle":          ("Narrazioni visive curate per i tuoi progetti.",
                                     "Curated visual narratives for your projects."),
    "moodboards.new":               ("Nuova moodboard",      "New moodboard"),
    "moodboards.empty":             ("Nessuna moodboard ancora composta.",
                                     "No moodboards composed yet."),
    "moodboards.emptyCta":          ("Componi la prima moodboard",
                                     "Compose the first moodboard"),
    "moodboards.untitled":          ("Senza titolo",         "Untitled"),

    # ─── tabs ───────────────────────────────────────────────────────────
    "moodboards.tab.title":         ("Composizione",         "Composition"),
    "moodboards.tab.assets":        ("Asset",                "Assets"),
    "moodboards.tab.insert":        ("Inserisci",            "Insert"),
    "moodboards.tab.inspirations":  ("Ispirazioni",          "Inspirations"),
    "moodboards.tab.pages":         ("Pagine",               "Pages"),

    # ─── assets ─────────────────────────────────────────────────────────
    "moodboards.assets.intro":
        ("Tutte le immagini caricate o salvate per questa moodboard.",
         "All images uploaded or saved into this moodboard."),
    "moodboards.assets.saved":      ("Salvati",              "Saved"),
    "moodboards.assets.savedEmpty":
        ("Nessun riferimento ancora salvato.",
         "No references saved yet."),
    "moodboards.assets.uploaded":   ("Caricati",             "Uploaded"),
    "moodboards.assets.uploadedHint":
        ("Trascina o seleziona file per aggiungerli alla moodboard.",
         "Drop files or click to add them to the moodboard."),

    # ─── block primitives ───────────────────────────────────────────────
    "moodboards.block.image.placeholder":
        ("Trascina qui un'immagine",
         "Drop an image here"),
    "moodboards.block.material":    ("Materiale",            "Material"),
    "moodboards.block.note.placeholder":
        ("Aggiungi una nota editoriale…",
         "Add an editorial note…"),
    "moodboards.block.product":     ("Prodotto",             "Product"),
    "moodboards.block.product.placeholder":
        ("Nome del prodotto",    "Product name"),
    "moodboards.block.text.placeholder":
        ("Scrivi qualcosa…",     "Type something…"),

    # ─── create modal ───────────────────────────────────────────────────
    "moodboards.create.failed":
        ("Impossibile creare la moodboard. Riprova.",
         "Could not create the moodboard. Please try again."),
    "moodboards.create.projectLabel":  ("Journey",           "Journey"),
    "moodboards.create.projectPh":     ("Seleziona un journey", "Select a journey"),
    "moodboards.create.submit":        ("Crea",              "Create"),
    "moodboards.create.timeout":
        ("La creazione sta impiegando troppo tempo. Riprova.",
         "Creation is taking too long. Please try again."),
    "moodboards.create.title":         ("Nuova moodboard",   "New moodboard"),
    "moodboards.create.titleLabel":    ("Titolo",            "Title"),
    "moodboards.create.titlePh":       ("Es. Direzione materica · Villa Verbano",
                                        "e.g. Material direction · Villa Verbano"),
    "moodboards.create.titleRequired": ("Inserisci un titolo per la moodboard.",
                                        "Please enter a moodboard title."),

    # ─── editor — actions ───────────────────────────────────────────────
    "moodboards.editor.actualSize":     ("Dimensioni reali", "Actual size"),
    "moodboards.editor.adjustments":    ("Regolazioni",      "Adjustments"),
    "moodboards.editor.applyAll":       ("Applica a tutte le pagine",
                                         "Apply to all pages"),
    "moodboards.editor.applyAllDone":   ("Applicato a tutte le pagine",
                                         "Applied to all pages"),
    "moodboards.editor.applyAllPages":  ("Applica a tutte le pagine",
                                         "Apply to all pages"),
    "moodboards.editor.applyStyleAll":  ("Applica lo stile ovunque",
                                         "Apply style everywhere"),
    "moodboards.editor.approve":        ("Approva",          "Approve"),
    "moodboards.editor.autosaveOn":     ("Salvataggio automatico attivo",
                                         "Autosave on"),
    "moodboards.editor.bringForward":   ("Porta avanti",     "Bring forward"),
    "moodboards.editor.bringToFront":   ("Porta in primo piano",
                                         "Bring to front"),
    "moodboards.editor.contextualHint":
        ("Seleziona un elemento per regolarne le proprietà.",
         "Select an element to adjust its properties."),
    "moodboards.editor.copyStyle":      ("Copia stile",      "Copy style"),
    "moodboards.editor.crop":           ("Ritaglia",         "Crop"),
    "moodboards.editor.delete":         ("Elimina",          "Delete"),
    "moodboards.editor.dropImage":      ("Trascina un'immagine qui",
                                         "Drop an image here"),
    "moodboards.editor.duplicate":      ("Duplica",          "Duplicate"),
    "moodboards.editor.fitHeight":      ("Adatta in altezza","Fit height"),
    "moodboards.editor.fitWidth":       ("Adatta in larghezza","Fit width"),
    "moodboards.editor.imageMissing":   ("Immagine non disponibile",
                                         "Image unavailable"),
    "moodboards.editor.inspector":      ("Inspector",        "Inspector"),
    "moodboards.editor.layers":         ("Livelli",          "Layers"),
    "moodboards.editor.openReview":     ("Apri review",      "Open review"),
    "moodboards.editor.openShare":      ("Condividi",        "Share"),
    "moodboards.editor.page":           ("Pagina",           "Page"),
    "moodboards.editor.pageInspector":  ("Inspector di pagina","Page inspector"),
    "moodboards.editor.pasteStyle":     ("Incolla stile",    "Paste style"),
    "moodboards.editor.pasteStyleEmpty":
        ("Nessuno stile copiato. Copia prima uno stile da un elemento.",
         "No style copied. Copy a style from an element first."),
    "moodboards.editor.present":        ("Presenta",         "Present"),

    # ─── editor — quick adjust ──────────────────────────────────────────
    "moodboards.editor.quickAdjust.adjust":   ("Regola",     "Adjust"),
    "moodboards.editor.quickAdjust.confirm":  ("Conferma",   "Confirm"),
    "moodboards.editor.quickAdjust.eyebrow":  ("Regolazione rapida",
                                               "Quick adjust"),
    "moodboards.editor.quickAdjust.fit":      ("Adatta",     "Fit"),
    "moodboards.editor.quickAdjust.focal":    ("Punto focale","Focal point"),
    "moodboards.editor.quickAdjust.focalHint":
        ("Trascina per scegliere il punto focale dell'immagine.",
         "Drag to choose the image's focal point."),
    "moodboards.editor.quickAdjust.reset":    ("Reimposta",  "Reset"),
    "moodboards.editor.quickAdjust.skip":     ("Salta",      "Skip"),
    "moodboards.editor.quickAdjust.title":    ("Regolazione rapida",
                                               "Quick adjust"),

    # ─── editor — remaining ─────────────────────────────────────────────
    "moodboards.editor.redo":            ("Ripeti",          "Redo"),
    "moodboards.editor.requestRevision": ("Richiedi revisione",
                                          "Request revision"),
    "moodboards.editor.reset":           ("Reimposta",       "Reset"),
    "moodboards.editor.resetCrop":       ("Reimposta ritaglio","Reset crop"),
    "moodboards.editor.retry":           ("Riprova",         "Retry"),
    "moodboards.editor.saveFailed":      ("Salvataggio non riuscito",
                                          "Save failed"),
    "moodboards.editor.saveFailedHint":
        ("Le ultime modifiche non sono state salvate. Riprova.",
         "The latest changes weren't saved. Please retry."),
    "moodboards.editor.saving":          ("Salvataggio in corso…",
                                          "Saving…"),
    "moodboards.editor.sendBackward":    ("Porta indietro",  "Send backward"),
    "moodboards.editor.sendReview":      ("Invia in review", "Send to review"),
    "moodboards.editor.sendToBack":      ("Porta in fondo",  "Send to back"),
    "moodboards.editor.share":           ("Condividi",       "Share"),
    "moodboards.editor.shareEyebrow":    ("Condivisione",    "Share"),
    "moodboards.editor.shareLegacyLabel": ("Link classico",  "Legacy link"),
    "moodboards.editor.sharePresentLabel": ("Modalità presentazione",
                                            "Presentation mode"),
    "moodboards.editor.shareReviewLabel": ("Modalità review",
                                           "Review mode"),
    "moodboards.editor.shareTitle":      ("Condividi la moodboard",
                                          "Share the moodboard"),
    "moodboards.editor.typography":      ("Tipografia",      "Typography"),
    "moodboards.editor.undo":            ("Annulla",         "Undo"),
    "moodboards.editor.unsaved":         ("Modifiche non salvate","Unsaved changes"),
    "moodboards.editor.uploadFailed":    ("Caricamento non riuscito","Upload failed"),
    "moodboards.editor.uploading":       ("Caricamento in corso…","Uploading…"),
    "moodboards.editor.visualProps":     ("Proprietà visive","Visual properties"),

    # ─── editorPanel ────────────────────────────────────────────────────
    "moodboards.editorPanel.title":      ("Pannello editor","Editor panel"),
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
    print(f"✦ {len(CANON)} canonical moodboards.* keys (part 3a)")
    print(f"  · it-IT: {apply('it-IT', 0)}")
    print(f"  · en-US: {apply('en-US', 1)}")
