#!/usr/bin/env python3
"""ITER137 · Part 3b — moodboards.field + inspector + insert + library."""
from __future__ import annotations
import json
from pathlib import Path

I18N = Path("/app/frontend/src/i18n/strings")

CANON: dict[str, tuple[str, str]] = {
    # ─── field (visual props) ───────────────────────────────────────────
    "moodboards.field.addColor":         ("Aggiungi colore",   "Add color"),
    "moodboards.field.arrowHead":        ("Punta della freccia","Arrow head"),
    "moodboards.field.arrowKind":        ("Tipo di freccia",   "Arrow kind"),
    "moodboards.field.bgColor":          ("Colore di sfondo",  "Background color"),
    "moodboards.field.bgImage":          ("Immagine di sfondo","Background image"),
    "moodboards.field.bgOverlay":        ("Overlay di sfondo", "Background overlay"),
    "moodboards.field.blur":             ("Sfocatura",         "Blur"),
    "moodboards.field.borderColor":      ("Colore del bordo",  "Border color"),
    "moodboards.field.borderRadius":     ("Raggio del bordo",  "Border radius"),
    "moodboards.field.borderStyle":      ("Stile del bordo",   "Border style"),
    "moodboards.field.borderWidth":      ("Spessore del bordo","Border width"),
    "moodboards.field.brightness":       ("Luminosità",        "Brightness"),
    "moodboards.field.caption":          ("Didascalia",        "Caption"),
    "moodboards.field.chapter":          ("Capitolo",          "Chapter"),
    "moodboards.field.chapterPlaceholder": ("Es. Atmosfera materica",
                                            "e.g. Material atmosphere"),
    "moodboards.field.color":            ("Colore",            "Color"),
    "moodboards.field.colors":           ("Colori",            "Colors"),
    "moodboards.field.contrast":         ("Contrasto",         "Contrast"),
    "moodboards.field.dashed":           ("Tratteggiato",      "Dashed"),
    "moodboards.field.decoration":       ("Decorazione",       "Decoration"),
    "moodboards.field.fill":             ("Riempimento",       "Fill"),
    "moodboards.field.finish":           ("Finitura",          "Finish"),
    "moodboards.field.fitMode":          ("Modalità di adattamento","Fit mode"),
    "moodboards.field.fitMode.contain":  ("Contenuto",         "Contain"),
    "moodboards.field.fitMode.cover":    ("Coprente",          "Cover"),
    "moodboards.field.fitMode.fill":     ("Riempi",            "Fill"),
    "moodboards.field.focalPoint":       ("Punto focale",      "Focal point"),
    "moodboards.field.fontFamily":       ("Famiglia tipografica","Font family"),
    "moodboards.field.fontSize":         ("Corpo",             "Font size"),
    "moodboards.field.fontWeight":       ("Peso",              "Font weight"),
    "moodboards.field.grayscale":        ("Scala di grigi",    "Grayscale"),
    "moodboards.field.hiddenFromClient": ("Nascondi al cliente","Hide from client"),
    "moodboards.field.hiddenFromClientHint":
        ("Visibile solo agli interni dello studio.",
         "Visible only to the studio team."),
    "moodboards.field.hiddenInPresentation":
        ("Nascondi in presentazione",
         "Hide in presentation"),
    "moodboards.field.hiddenInPresentationHint":
        ("Non comparirà durante la presentazione live.",
         "Won't appear during the live presentation."),
    "moodboards.field.imageUrl":         ("URL dell'immagine", "Image URL"),
    "moodboards.field.letterSpacing":    ("Crenatura",         "Letter spacing"),
    "moodboards.field.lineHeight":       ("Interlinea",        "Line height"),
    "moodboards.field.listStyle":        ("Stile elenco",      "List style"),
    "moodboards.field.name":             ("Nome",              "Name"),
    "moodboards.field.note":             ("Nota",              "Note"),
    "moodboards.field.opacity":          ("Opacità",           "Opacity"),
    "moodboards.field.pageBackground":   ("Sfondo della pagina","Page background"),
    "moodboards.field.price":            ("Prezzo",            "Price"),
    "moodboards.field.rotation":         ("Rotazione",         "Rotation"),
    "moodboards.field.saturation":       ("Saturazione",       "Saturation"),
    "moodboards.field.shadow":           ("Ombra",             "Shadow"),
    "moodboards.field.shapeKind":        ("Tipo di forma",     "Shape kind"),
    "moodboards.field.size":             ("Dimensione",        "Size"),
    "moodboards.field.swatch":           ("Campione",          "Swatch"),
    "moodboards.field.text":             ("Testo",             "Text"),
    "moodboards.field.textAlign":        ("Allineamento",      "Text align"),
    "moodboards.field.thickness":        ("Spessore",          "Thickness"),
    "moodboards.field.title":            ("Titolo",            "Title"),
    "moodboards.field.transition":       ("Transizione",       "Transition"),
    "moodboards.field.transitionDuration": ("Durata transizione","Transition duration"),
    "moodboards.field.transitionIn":     ("Transizione in entrata","Transition in"),
    "moodboards.field.vendor":           ("Fornitore",         "Vendor"),
    "moodboards.field.vignette":         ("Vignettatura",      "Vignette"),
    "moodboards.field.visibility":       ("Visibilità",        "Visibility"),
    "moodboards.field.warmth":           ("Calore",            "Warmth"),
    "moodboards.field.zoom":             ("Zoom",              "Zoom"),

    # ─── insert tab ─────────────────────────────────────────────────────
    "moodboards.insert.exploreTemplates":("Esplora i template","Explore templates"),
    "moodboards.insert.group.templates": ("Template",          "Templates"),

    # ─── inspector ──────────────────────────────────────────────────────
    "moodboards.inspector.advancedSoon": ("Avanzate · in arrivo","Advanced · coming soon"),
    "moodboards.inspector.empty.body":
        ("Seleziona un elemento per regolarne le proprietà.",
         "Select an element to adjust its properties."),
    "moodboards.inspector.empty.title":  ("Nessun elemento selezionato",
                                          "Nothing selected"),
    "moodboards.inspector.group.advanced":      ("Avanzate",       "Advanced"),
    "moodboards.inspector.group.image":         ("Immagine",       "Image"),
    "moodboards.inspector.group.image.eyebrow": ("Immagine",       "Image"),
    "moodboards.inspector.group.layout":        ("Layout",         "Layout"),
    "moodboards.inspector.group.style":         ("Stile",          "Style"),
    "moodboards.inspector.group.style.eyebrow": ("Stile",          "Style"),
    "moodboards.inspector.group.typography":    ("Tipografia",     "Typography"),
    "moodboards.inspector.group.typography.eyebrow": ("Tipografia","Typography"),
    "moodboards.inspector.selectedItem":        ("Elemento selezionato","Selected item"),

    # ─── library ────────────────────────────────────────────────────────
    "moodboards.library.collapse":               ("Comprimi",      "Collapse"),
    "moodboards.library.expand":                 ("Espandi",       "Expand"),
    "moodboards.library.personal":               ("Personale",     "Personal"),
    "moodboards.library.section.content":        ("Contenuti",     "Content"),
    "moodboards.library.section.primitives":     ("Primitive",     "Primitives"),
    "moodboards.library.section.saved":          ("Salvati",       "Saved"),
    "moodboards.library.tab.blocks":             ("Blocchi",       "Blocks"),
    "moodboards.library.tab.content":            ("Contenuti",     "Content"),
    "moodboards.library.title":                  ("Libreria",      "Library"),
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
    print(f"✦ {len(CANON)} canonical moodboards.* keys (part 3b)")
    print(f"  · it-IT: {apply('it-IT', 0)}")
    print(f"  · en-US: {apply('en-US', 1)}")
