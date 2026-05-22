#!/usr/bin/env python3
"""ITER137 · Hardcoded IT Eradication™ · Wave 1 — JSX wrap + canonical authoring.

For each (file, line, old_jsx_fragment) entry below, replace the hardcoded
Italian text node with a `{t('atelier_voice.<ns>.<key>', null, '<EN fallback>')}`
call, and seed the canonical `it-IT` + `en-US` values in the registry JSONs.

The remaining 5 locales (en-GB / fr-FR / de-DE / es-ES / ar) will be filled
by the standard semantic migration pipeline next.

Naming: `atelier_voice.<feature>.<slug>` — short, kebab-case, no
character-pair clashes with existing keys.
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

SRC = Path("/app/frontend/src")
I18N = Path("/app/frontend/src/i18n/strings")

# (file, key, old_text_fragment, jsx_wrap_old, jsx_wrap_new, it_value, en_value)
# `old_text_fragment` is what we search inside the file (must be unique).
# `jsx_wrap_old` and `jsx_wrap_new` are the exact strings used for search_replace.

REPLACEMENTS = [
    # ── CuratorialInspirationsModal.jsx (6) ───────────────────────────
    ("blueprint/moodboard/CuratorialInspirationsModal.jsx",
     "atelier_voice.curatorial_modal.tray_eyebrow",
     "Tavolo curatoriale",
     "Tavolo curatoriale", "Curatorial table",
     "{t('atelier_voice.curatorial_modal.tray_eyebrow', null, 'Curatorial table')}",
     '<p className="ci-eyebrow">Tavolo curatoriale</p>',
     '<p className="ci-eyebrow">{t(\'atelier_voice.curatorial_modal.tray_eyebrow\', null, \'Curatorial table\')}</p>'),
    ("blueprint/moodboard/CuratorialInspirationsModal.jsx",
     "atelier_voice.curatorial_modal.tray_empty_lede",
     "Marca i riferimenti più rilevanti.",
     "Marca i riferimenti più rilevanti.", "Mark the references that matter most.",
     None,
     '<p>Marca i riferimenti più rilevanti.<br />Saranno portati nel moodboard insieme.</p>',
     '<p>{t(\'atelier_voice.curatorial_modal.tray_empty_line1\', null, \'Mark the references that matter most.\')}<br />{t(\'atelier_voice.curatorial_modal.tray_empty_line2\', null, \'They\\u2019ll travel into the moodboard together.\')}</p>'),
    ("blueprint/moodboard/CuratorialInspirationsModal.jsx",
     "atelier_voice.curatorial_modal.head_eyebrow",
     "Tavolo curatoriale · Inspirations™",
     None, None,
     None,
     '<p className="ci-eyebrow">Tavolo curatoriale · Inspirations™</p>',
     '<p className="ci-eyebrow">{t(\'atelier_voice.curatorial_modal.head_eyebrow\', null, \'Curatorial table \\u00B7 Inspirations\\u2122\')}</p>'),
    ("blueprint/moodboard/CuratorialInspirationsModal.jsx",
     "atelier_voice.curatorial_modal.head_title_em",
     "riferimenti progettuali",
     None, None,
     None,
     '<h2 className="ci-overlay__title">\n            Componi <em>riferimenti progettuali</em>\n          </h2>',
     '<h2 className="ci-overlay__title">\n            {t(\'atelier_voice.curatorial_modal.head_title_lead\', null, \'Compose\')} <em>{t(\'atelier_voice.curatorial_modal.head_title_em\', null, \'design references\')}</em>\n          </h2>'),
    ("blueprint/moodboard/CuratorialInspirationsModal.jsx",
     "atelier_voice.curatorial_modal.empty_lede",
     "Allarga atmosfera, materialità o geografia per leggere altri linguaggi progettuali dello studio.",
     None, None,
     None,
     '<p>Allarga atmosfera, materialità o geografia per leggere altri linguaggi progettuali dello studio.</p>',
     '<p>{t(\'atelier_voice.curatorial_modal.empty_lede\', null, \'Broaden the atmosphere, materiality or geography to read other design languages from the studio.\')}</p>'),

    # ── EditorPanel.jsx (1) ───────────────────────────────────────────
    ("blueprint/moodboard/EditorPanel.jsx",
     "atelier_voice.editor_panel.curatorial_cta_eyebrow",
     "Tavolo curatoriale",
     None, None,
     None,
     '<span className="ci-cta__eyebrow">Tavolo curatoriale</span>',
     '<span className="ci-cta__eyebrow">{t(\'atelier_voice.editor_panel.curatorial_cta_eyebrow\', null, \'Curatorial table\')}</span>'),

    # ── PremiumTemplatePreview.jsx (1) — purely static asset preview;
    # the strings inside the previews are part of the visual mockup and
    # are intentionally not localized. We document this explicitly.
    # SKIP — see note in the report.

    # ── MaterialDirectionWorkspace.jsx (1) ────────────────────────────
    ("components/journey/MaterialDirectionWorkspace.jsx",
     "atelier_voice.material_direction.eyebrow",
     "Direzione materica",
     None, None,
     None,
     '<p className="sw-section__eyebrow">Direzione materica</p>',
     '<p className="sw-section__eyebrow">{t(\'atelier_voice.material_direction.eyebrow\', null, \'Material direction\')}</p>'),

    # ── MilestoneDialogue.jsx (2) ─────────────────────────────────────
    ("components/journey/MilestoneDialogue.jsx",
     "atelier_voice.milestone_dialogue.feedback_title",
     "Conversazione progettuale",
     None, None,
     None,
     '<h3 className="mdialog__feedback-title"><em>Conversazione progettuale</em></h3>',
     '<h3 className="mdialog__feedback-title"><em>{t(\'atelier_voice.milestone_dialogue.feedback_title\', null, \'Design conversation\')}</em></h3>'),
    ("components/journey/MilestoneDialogue.jsx",
     "atelier_voice.milestone_dialogue.chapters_title",
     "I capitoli condivisi",
     None, None,
     None,
     '<h3 className="mdialog__title"><em>I capitoli condivisi</em></h3>',
     '<h3 className="mdialog__title"><em>{t(\'atelier_voice.milestone_dialogue.chapters_title\', null, \'The shared chapters\')}</em></h3>'),

    # ── StorySectionsEditor.jsx (1) ───────────────────────────────────
    ("components/storytelling/StorySectionsEditor.jsx",
     "atelier_voice.story_sections.eyebrow",
     "Narrazione visiva",
     None, None,
     None,
     '<p className="ss-eyebrow">Narrazione visiva</p>',
     '<p className="ss-eyebrow">{t(\'atelier_voice.story_sections.eyebrow\', null, \'Visual narrative\')}</p>'),

    # ── AdvisorNetworkAdminPage.jsx (1) ───────────────────────────────
    ("pages/admin/AdvisorNetworkAdminPage.jsx",
     "atelier_voice.advisor_network.new_partner_title",
     "Nuovo partner di rete",
     None, None,
     None,
     '<h2 className="adv-drawer__title">Nuovo partner di rete</h2>',
     '<h2 className="adv-drawer__title">{t(\'atelier_voice.advisor_network.new_partner_title\', null, \'New network partner\')}</h2>'),

    # ── AdvisorDashboardPage.jsx (1) ──────────────────────────────────
    ("pages/advisor/AdvisorDashboardPage.jsx",
     "atelier_voice.advisor_dashboard.new_report",
     "Nuovo report",
     None, None,
     None,
     '<Plus size={11} /> Nuovo report',
     '<Plus size={11} /> {t(\'atelier_voice.advisor_dashboard.new_report\', null, \'New report\')}'),

    # ── AccountConstellation.jsx (4) ──────────────────────────────────
    ("pages/crm/AccountConstellation.jsx",
     "atelier_voice.account_constellation.people_eyebrow",
     "Compagni di viaggio",
     None, None,
     None,
     '<span className="ac-section__eyebrow"><Users size={11} /> Compagni di viaggio</span>',
     '<span className="ac-section__eyebrow"><Users size={11} /> {t(\'atelier_voice.account_constellation.people_eyebrow\', null, \'Travel companions\')}</span>'),
    ("pages/crm/AccountConstellation.jsx",
     "atelier_voice.account_constellation.memory_eyebrow",
     "Memoria progettuale",
     None, None,
     None,
     '<span className="ac-section__eyebrow"><Sparkles size={11} /> Memoria progettuale</span>',
     '<span className="ac-section__eyebrow"><Sparkles size={11} /> {t(\'atelier_voice.account_constellation.memory_eyebrow\', null, \'Design memory\')}</span>'),
    ("pages/crm/AccountConstellation.jsx",
     "atelier_voice.account_constellation.memory_title",
     "Ciò che è già stato detto",
     None, None,
     None,
     '<h2 className="ac-section__title">Ciò che è già stato detto</h2>',
     '<h2 className="ac-section__title">{t(\'atelier_voice.account_constellation.memory_title\', null, \'What has already been said\')}</h2>'),
    ("pages/crm/AccountConstellation.jsx",
     "atelier_voice.account_constellation.artifacts_title",
     "Ciò che è stato presentato",
     None, None,
     None,
     '<h2 className="ac-section__title">Ciò che è stato presentato</h2>',
     '<h2 className="ac-section__title">{t(\'atelier_voice.account_constellation.artifacts_title\', null, \'What has been presented\')}</h2>'),

    # ── ActivityModal.jsx (1) ─────────────────────────────────────────
    ("pages/crm/ActivityModal.jsx",
     "atelier_voice.activity_modal.eyebrow",
     "Nuova attività",
     None, None,
     None,
     '<p className="rl-modal__eyebrow">Nuova attività</p>',
     '<p className="rl-modal__eyebrow">{t(\'atelier_voice.activity_modal.eyebrow\', null, \'New activity\')}</p>'),

    # ── CrmAccountsPage.jsx (1) ───────────────────────────────────────
    ("pages/crm/CrmAccountsPage.jsx",
     "atelier_voice.crm_accounts.new_relationship_eyebrow",
     "CRM · Nuova relazione",
     None, None,
     None,
     'CRM · Nuova relazione',
     "{t('atelier_voice.crm_accounts.new_relationship_eyebrow', null, 'CRM \\u00B7 New relationship')}"),

    # ── CulturalEditionReviewPage.jsx (1) ─────────────────────────────
    ("pages/cultural/CulturalEditionReviewPage.jsx",
     "atelier_voice.cultural_edition.palette_label",
     "Palette materica",
     None, None,
     None,
     '>Palette materica<',
     ">{t('atelier_voice.cultural_edition.palette_label', null, 'Material palette')}<"),

    # ── EditorialStudioPage.jsx (1) ───────────────────────────────────
    ("pages/editorial/EditorialStudioPage.jsx",
     "atelier_voice.editorial_studio.new_master_cta",
     "+ Nuovo Master",
     None, None,
     None,
     '+ Nuovo Master',
     "+ {t('atelier_voice.editorial_studio.new_master_cta', null, 'New master')}"),

    # ── MarketEditionsToolbar.jsx (4) — same string used 4 times,
    # rely on `replace_all` for the IT phrase.
    ("pages/editorial/MarketEditionsToolbar.jsx",
     "atelier_voice.market_editions.new_master",
     "Nuovo Editorial Master",
     None, None,
     None,
     '>Nuovo Editorial Master<',
     ">{t('atelier_voice.market_editions.new_master', null, 'New editorial master')}<",
     "replace_all"),
    ("pages/editorial/MarketEditionsToolbar.jsx",
     "atelier_voice.market_editions.new_edition",
     "Nuova Market Edition",
     None, None,
     None,
     '>Nuova Market Edition<',
     ">{t('atelier_voice.market_editions.new_edition', null, 'New market edition')}<",
     "replace_all"),
    ("pages/editorial/MarketEditionsToolbar.jsx",
     "atelier_voice.market_editions.new_master_short",
     "Nuovo Master",
     None, None,
     None,
     '>Nuovo Master<',
     ">{t('atelier_voice.market_editions.new_master_short', null, 'New master')}<",
     "replace_all"),

    # ── InsightsPage.jsx (1) ──────────────────────────────────────────
    ("pages/insights/InsightsPage.jsx",
     "atelier_voice.insights.signature_label",
     "Signature curatoriale",
     None, None,
     None,
     '>Signature curatoriale<',
     ">{t('atelier_voice.insights.signature_label', null, 'Curatorial signature')}<"),

    # ── AddInspirationModal.jsx (1) ───────────────────────────────────
    ("pages/inspirations/AddInspirationModal.jsx",
     "atelier_voice.add_inspiration.main_material_label",
     "Materia principale",
     None, None,
     None,
     '>Materia principale<',
     ">{t('atelier_voice.add_inspiration.main_material_label', null, 'Primary material')}<"),

    # ── BrandDetailPage.jsx (3) ───────────────────────────────────────
    ("pages/inspirations/BrandDetailPage.jsx",
     "atelier_voice.brand_detail.atlas_eyebrow",
     "Atlante curatoriale",
     None, None,
     None,
     '>Atlante curatoriale<',
     ">{t('atelier_voice.brand_detail.atlas_eyebrow', null, 'Curated atlas')}<"),
    ("pages/inspirations/BrandDetailPage.jsx",
     "atelier_voice.brand_detail.reading_eyebrow",
     "Lettura curatoriale",
     None, None,
     None,
     '>Lettura curatoriale<',
     ">{t('atelier_voice.brand_detail.reading_eyebrow', null, 'Curatorial reading')}<"),

    # ── CollectionFormModal.jsx (1) ───────────────────────────────────
    ("pages/inspirations/CollectionFormModal.jsx",
     "atelier_voice.collection_form.description_label",
     "Descrizione curatoriale",
     None, None,
     None,
     '>Descrizione curatoriale<',
     ">{t('atelier_voice.collection_form.description_label', null, 'Curatorial description')}<"),

    # ── CuratedCollectionDrawer.jsx (1) ───────────────────────────────
    ("pages/inspirations/CuratedCollectionDrawer.jsx",
     "atelier_voice.curated_collection.new_collection",
     "Nuova collezione",
     None, None,
     None,
     '>Nuova collezione<',
     ">{t('atelier_voice.curated_collection.new_collection', null, 'New collection')}<"),

    # ── InspirationDetailDrawer.jsx (1) — "Materia" alone is too generic,
    # but the audit found it as a section label. Add minimal wrap.
    ("pages/inspirations/InspirationDetailDrawer.jsx",
     "atelier_voice.inspiration_detail.material_label",
     "Materia",
     None, None,
     None,
     '>Materia<',
     ">{t('atelier_voice.inspiration_detail.material_label', null, 'Material')}<"),

    # ── MaterialViewPage.jsx (1) ──────────────────────────────────────
    ("pages/inspirations/MaterialViewPage.jsx",
     "atelier_voice.material_view.eyebrow",
     "Material View™ · Materioteca curatoriale",
     None, None,
     None,
     '>Material View™ · Materioteca curatoriale<',
     ">Material View\\u2122 \\u00B7 {t('atelier_voice.material_view.eyebrow_suffix', null, 'curated materials library')}<"),

    # ── ProductGalleryPage.jsx (2) ────────────────────────────────────
    ("pages/inspirations/ProductGalleryPage.jsx",
     "atelier_voice.product_gallery.design_language",
     "Linguaggio progettuale",
     None, None,
     None,
     '>Linguaggio progettuale<',
     ">{t('atelier_voice.product_gallery.design_language', null, 'Design language')}<"),
    ("pages/inspirations/ProductGalleryPage.jsx",
     "atelier_voice.product_gallery.new_collection",
     "Nuova collezione",
     None, None,
     None,
     '>Nuova collezione<',
     ">{t('atelier_voice.product_gallery.new_collection', null, 'New collection')}<"),

    # ── StudioCollectionsPage.jsx (1) ─────────────────────────────────
    ("pages/inspirations/StudioCollectionsPage.jsx",
     "atelier_voice.studio_collections.loading",
     "Carico l'archivio curatoriale…",
     None, None,
     None,
     '>Carico l\'archivio curatoriale…<',
     ">{t('atelier_voice.studio_collections.loading', null, 'Loading the curated archive\\u2026')}<"),

    # ── SupplierCatalogImportModal.jsx (3) ────────────────────────────
    ("pages/inspirations/SupplierCatalogImportModal.jsx",
     "atelier_voice.supplier_import.no_producer_found",
     "Nessun produttore trovato.",
     None, None,
     None,
     '>Nessun produttore trovato.<',
     ">{t('atelier_voice.supplier_import.no_producer_found', null, 'No manufacturer found.')}<"),
    ("pages/inspirations/SupplierCatalogImportModal.jsx",
     "atelier_voice.supplier_import.new_producer",
     "Nuovo produttore",
     None, None,
     None,
     '>Nuovo produttore<',
     ">{t('atelier_voice.supplier_import.new_producer', null, 'New manufacturer')}<"),
    ("pages/inspirations/SupplierCatalogImportModal.jsx",
     "atelier_voice.supplier_import.new_collection",
     "Nuova collezione",
     None, None,
     None,
     '>Nuova collezione<',
     ">{t('atelier_voice.supplier_import.new_collection', null, 'New collection')}<"),

    # ── StepWorkspacePage.jsx (1) ─────────────────────────────────────
    ("pages/journey/StepWorkspacePage.jsx",
     "atelier_voice.step_workspace.recorded_chapters",
     "Capitoli registrati",
     None, None,
     None,
     '>Capitoli registrati<',
     ">{t('atelier_voice.step_workspace.recorded_chapters', null, 'Recorded chapters')}<"),

    # ── ProjectsStudioPage.jsx (1) ────────────────────────────────────
    ("pages/projects/ProjectsStudioPage.jsx",
     "atelier_voice.projects_studio.open_new_hint",
     "o aprine uno nuovo per iniziare",
     None, None,
     None,
     '>o aprine uno nuovo per iniziare<',
     ">{t('atelier_voice.projects_studio.open_new_hint', null, 'or open a new one to begin')}<"),

    # Atlas keys (already wrapped in BrandModePage.jsx earlier in the session)
    ("pages/inspirations/BrandModePage.jsx",
     "atelier_voice.brand_atlas.eyebrow",
     "(already wrapped) atlas_eyebrow",
     None, None,
     None, None, None),
]

# Canonical IT + EN value pairs (the keys not handled by inline t() fallback
# need explicit JSON entries to satisfy 100% native coverage in it-IT and en-US).
CANON: dict[str, tuple[str, str]] = {
    # CuratorialInspirationsModal
    "atelier_voice.curatorial_modal.tray_eyebrow":      ("Tavolo curatoriale",         "Curatorial table"),
    "atelier_voice.curatorial_modal.tray_empty_line1":  ("Marca i riferimenti più rilevanti.",
                                                         "Mark the references that matter most."),
    "atelier_voice.curatorial_modal.tray_empty_line2":  ("Saranno portati nel moodboard insieme.",
                                                         "They’ll travel into the moodboard together."),
    "atelier_voice.curatorial_modal.head_eyebrow":      ("Tavolo curatoriale · Inspirations™",
                                                         "Curatorial table · Inspirations™"),
    "atelier_voice.curatorial_modal.head_title_lead":   ("Componi",                    "Compose"),
    "atelier_voice.curatorial_modal.head_title_em":     ("riferimenti progettuali",    "design references"),
    "atelier_voice.curatorial_modal.empty_lede":        ("Allarga atmosfera, materialità o geografia per leggere altri linguaggi progettuali dello studio.",
                                                         "Broaden the atmosphere, materiality or geography to read other design languages from the studio."),
    # EditorPanel
    "atelier_voice.editor_panel.curatorial_cta_eyebrow":("Tavolo curatoriale",         "Curatorial table"),
    # MaterialDirectionWorkspace
    "atelier_voice.material_direction.eyebrow":         ("Direzione materica",         "Material direction"),
    # MilestoneDialogue
    "atelier_voice.milestone_dialogue.feedback_title":  ("Conversazione progettuale",  "Design conversation"),
    "atelier_voice.milestone_dialogue.chapters_title":  ("I capitoli condivisi",       "The shared chapters"),
    # StorySectionsEditor
    "atelier_voice.story_sections.eyebrow":             ("Narrazione visiva",          "Visual narrative"),
    # Advisor
    "atelier_voice.advisor_network.new_partner_title":  ("Nuovo partner di rete",      "New network partner"),
    "atelier_voice.advisor_dashboard.new_report":       ("Nuovo report",               "New report"),
    # AccountConstellation
    "atelier_voice.account_constellation.people_eyebrow":   ("Compagni di viaggio",       "Travel companions"),
    "atelier_voice.account_constellation.memory_eyebrow":   ("Memoria progettuale",       "Design memory"),
    "atelier_voice.account_constellation.memory_title":     ("Ciò che è già stato detto", "What has already been said"),
    "atelier_voice.account_constellation.artifacts_title":  ("Ciò che è stato presentato","What has been presented"),
    # ActivityModal
    "atelier_voice.activity_modal.eyebrow":             ("Nuova attività",             "New activity"),
    # CrmAccounts
    "atelier_voice.crm_accounts.new_relationship_eyebrow": ("CRM · Nuova relazione",   "CRM · New relationship"),
    # Cultural / Editorial
    "atelier_voice.cultural_edition.palette_label":     ("Palette materica",           "Material palette"),
    "atelier_voice.editorial_studio.new_master_cta":    ("Nuovo Master",               "New master"),
    # Market editions
    "atelier_voice.market_editions.new_master":         ("Nuovo Editorial Master",     "New editorial master"),
    "atelier_voice.market_editions.new_edition":        ("Nuova Market Edition",       "New market edition"),
    "atelier_voice.market_editions.new_master_short":   ("Nuovo Master",               "New master"),
    # Insights
    "atelier_voice.insights.signature_label":           ("Signature curatoriale",      "Curatorial signature"),
    # Inspirations family
    "atelier_voice.add_inspiration.main_material_label":("Materia principale",         "Primary material"),
    "atelier_voice.brand_detail.atlas_eyebrow":         ("Atlante curatoriale",        "Curated atlas"),
    "atelier_voice.brand_detail.reading_eyebrow":       ("Lettura curatoriale",        "Curatorial reading"),
    "atelier_voice.collection_form.description_label":  ("Descrizione curatoriale",    "Curatorial description"),
    "atelier_voice.curated_collection.new_collection":  ("Nuova collezione",           "New collection"),
    "atelier_voice.inspiration_detail.material_label":  ("Materia",                    "Material"),
    "atelier_voice.material_view.eyebrow_suffix":       ("materioteca curatoriale",    "curated materials library"),
    "atelier_voice.product_gallery.design_language":    ("Linguaggio progettuale",     "Design language"),
    "atelier_voice.product_gallery.new_collection":     ("Nuova collezione",           "New collection"),
    "atelier_voice.studio_collections.loading":         ("Carico l’archivio curatoriale…",
                                                         "Loading the curated archive…"),
    "atelier_voice.supplier_import.no_producer_found":  ("Nessun produttore trovato.", "No manufacturer found."),
    "atelier_voice.supplier_import.new_producer":       ("Nuovo produttore",           "New manufacturer"),
    "atelier_voice.supplier_import.new_collection":     ("Nuova collezione",           "New collection"),
    # Journey / Projects
    "atelier_voice.step_workspace.recorded_chapters":   ("Capitoli registrati",        "Recorded chapters"),
    "atelier_voice.projects_studio.open_new_hint":      ("o aprine uno nuovo per iniziare",
                                                         "or open a new one to begin"),
    # BrandModePage (already wrapped earlier in session)
    "atelier_voice.brand_atlas.eyebrow":                ("Brand Atlas™ · atlante curatoriale dei produttori",
                                                         "Brand Atlas™ · curated atlas of manufacturers"),
    "atelier_voice.brand_atlas.title_lead":             ("I produttori come",          "Manufacturers as"),
    "atelier_voice.brand_atlas.title_em":               ("linguaggi progettuali",      "design languages"),
    "atelier_voice.brand_atlas.lead":                   ("Esplora i marchi, le collezioni e il linguaggio progettuale dei produttori presenti in MOOD. Ogni brand è una pagina del nostro atlante curatoriale.",
                                                         "Explore the manufacturers, their collections and the design language of every brand within MOOD. Each brand is a page in our curated atlas."),
    "atelier_voice.brand_atlas.empty_lede":             ("L’atlante curatoriale è in costruzione. Aggiungi un produttore o importa un catalogo per iniziare la lettura.",
                                                         "The curated atlas is being composed. Add a manufacturer or import a catalog to begin the reading."),
}


# ── Apply JSX edits ─────────────────────────────────────────────────────
def apply_jsx_edits() -> tuple[int, list[str]]:
    edited, errors = 0, []
    for entry in REPLACEMENTS:
        # Skip the BrandModePage placeholder entry
        if len(entry) >= 8 and entry[7] is None and "BrandModePage" in entry[0]:
            continue
        rel, key, *_ = entry
        old_jsx, new_jsx = entry[6], entry[7]
        replace_all = (len(entry) > 8 and entry[8] == "replace_all")
        if old_jsx is None or new_jsx is None:
            errors.append(f"skipped {rel} :: {key} (missing patterns)")
            continue
        p = SRC / rel
        try:
            content = p.read_text(encoding="utf-8")
        except FileNotFoundError:
            errors.append(f"missing file {rel}")
            continue
        if old_jsx not in content:
            errors.append(f"pattern not found in {rel}: «{old_jsx[:70]}…»")
            continue
        if replace_all:
            new_content = content.replace(old_jsx, new_jsx)
        else:
            if content.count(old_jsx) > 1:
                errors.append(f"pattern AMBIGUOUS in {rel}: «{old_jsx[:70]}…» (use replace_all)")
                continue
            new_content = content.replace(old_jsx, new_jsx, 1)
        if new_content == content:
            errors.append(f"no-op replacement in {rel} :: {key}")
            continue
        p.write_text(new_content, encoding="utf-8")
        edited += 1
        print(f"  ✓ {rel} ← {key}")
    return edited, errors


# ── Apply canonical authoring ──────────────────────────────────────────
def _set_nested(d, parts, value):
    cur = d
    for part in parts[:-1]:
        if part not in cur or not isinstance(cur[part], dict):
            cur[part] = {}
        cur = cur[part]
    cur[parts[-1]] = value


def apply_canonical(locale: str, idx: int) -> int:
    p = I18N / f"{locale}.json"
    d = json.loads(p.read_text("utf-8"))
    n = 0
    for k, pair in CANON.items():
        cur = d
        ok = True
        for part in k.split("."):
            if isinstance(cur, dict) and part in cur:
                cur = cur[part]
            else:
                ok = False
                break
        if ok and isinstance(cur, str) and cur.strip():
            continue
        _set_nested(d, k.split("."), pair[idx])
        n += 1
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2), "utf-8")
    return n


if __name__ == "__main__":
    print("=" * 60)
    print("HARDCODED IT ERADICATION™ — Wave 1")
    print("=" * 60)
    edited, errs = apply_jsx_edits()
    print(f"\n→ JSX files edited: {edited}")
    if errs:
        print(f"\nErrors / skips ({len(errs)}):")
        for e in errs:
            print(f"  · {e}")
    print()
    print(f"→ Canonical IT-IT: {apply_canonical('it-IT', 0)} keys added")
    print(f"→ Canonical EN-US: {apply_canonical('en-US', 1)} keys added")
    print(f"\nTotal canonical entries staged: {len(CANON)}")
