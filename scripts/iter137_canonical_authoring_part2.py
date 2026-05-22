#!/usr/bin/env python3
"""ITER137 · Part 2 — settings.* canonical authoring (56 keys)."""
from __future__ import annotations
import json
from pathlib import Path

I18N = Path("/app/frontend/src/i18n/strings")

CANON: dict[str, tuple[str, str]] = {
    "settings.account.body":          ("Email, password e preferenze del tuo account.",
                                       "Email, password and personal preferences."),
    "settings.account.kicker":        ("Account",            "Account"),
    "settings.account.title":         ("Account",            "Account"),
    "settings.brand.sub":             ("Tipografia, palette e densità dell'atelier.",
                                       "Typography, palette and atelier density."),
    "settings.brand.title":           ("Identità di brand",  "Brand identity"),
    "settings.domains.sub":           ("Dominio personalizzato per il sito pubblico.",
                                       "Custom domain for the public storefront."),
    "settings.domains.title":         ("Domini",             "Domains"),
    "settings.forms.sub":             ("Configurazione dei form di contatto e onboarding.",
                                       "Contact and onboarding form configuration."),
    "settings.forms.title":           ("Form",               "Forms"),
    "settings.internationalPresence.sub":
        ("Lingue, locali e disponibilità internazionale.",
         "Languages, locales and international availability."),
    "settings.internationalPresence.title":
        ("Presenza internazionale",  "International presence"),
    "settings.journal.sub":           ("Editoriali, magazine e flussi di pubblicazione.",
                                       "Editorials, magazine and publishing flows."),
    "settings.journal.title":         ("Journal",            "Journal"),
    "settings.kicker":                ("Atelier",            "Atelier"),
    "settings.languages.active":      ("Lingue attive",      "Active languages"),
    "settings.languages.ai.copy":
        ("Le lingue su cui la traduzione AI è abilitata.",
         "Languages where AI translation is enabled."),
    "settings.languages.architecture":
        ("Architettura linguistica",
         "Language architecture"),
    "settings.languages.architectureBody":
        ("Tre livelli orchestrati: pubblico, blueprint operativo, traduzione AI.",
         "Three orchestrated layers: public site, operational blueprint, AI translation."),
    "settings.languages.blueprint.copy":
        ("Le lingue in cui il blueprint operativo è disponibile.",
         "Languages in which the operational blueprint is available."),
    "settings.languages.blueprint.eyebrow":
        ("Blueprint operativo", "Operational blueprint"),
    "settings.languages.blueprint.locked":
        ("Bloccato sul piano corrente.",
         "Locked on the current plan."),
    "settings.languages.col.ai":        ("AI",                "AI"),
    "settings.languages.col.blueprint": ("Blueprint",         "Blueprint"),
    "settings.languages.col.code":      ("Codice",            "Code"),
    "settings.languages.col.default":   ("Predefinita",       "Default"),
    "settings.languages.col.enabled":   ("Attiva",            "Enabled"),
    "settings.languages.col.fallback":  ("Fallback",          "Fallback"),
    "settings.languages.col.name":      ("Lingua",            "Language"),
    "settings.languages.col.native":    ("Nome nativo",       "Native name"),
    "settings.languages.col.public":    ("Pubblica",          "Public"),
    "settings.languages.col.rtl":       ("RTL",               "RTL"),
    "settings.languages.eyebrow":       ("Lingue",            "Languages"),
    "settings.languages.intro":
        ("Lingue operative disponibili per il workspace Blueprint.",
         "Operational languages available for the Blueprint workspace."),
    "settings.languages.public.copy":
        ("Le lingue offerte sul sito pubblico e nel companion cliente.",
         "Languages offered on the public site and in the client companion."),
    "settings.languages.public.eyebrow":
        ("Sito pubblico",      "Public site"),
    "settings.languages.title":         ("Lingue & locali",   "Languages & locales"),
    "settings.notifications.sub":
        ("Email transazionali, digest e avvisi del workspace.",
         "Transactional email, digests and workspace alerts."),
    "settings.notifications.title":     ("Notifiche",         "Notifications"),
    "settings.plan.sub":
        ("Piano corrente, limiti operativi e fatturazione.",
         "Current plan, operational limits and billing."),
    "settings.plan.title":              ("Piano",             "Plan"),
    "settings.profile.sub":
        ("Nome, foto e firma editoriale.",
         "Name, photo and editorial signature."),
    "settings.profile.title":           ("Profilo",           "Profile"),
    "settings.security.sub":
        ("Password, accessi e sicurezza del workspace.",
         "Password, sessions and workspace security."),
    "settings.security.title":          ("Sicurezza",         "Security"),
    "settings.storefront.sub":
        ("Vetrina pubblica, contenuti e SEO.",
         "Public storefront, content and SEO."),
    "settings.storefront.title":        ("Storefront",        "Storefront"),
    "settings.sub":
        ("L'orchestrazione delle voci che compongono l'atelier.",
         "The orchestration of the voices that compose the atelier."),
    "settings.team.sub":
        ("Membri, ruoli e permessi del workspace.",
         "Members, roles and workspace permissions."),
    "settings.team.title":              ("Team",              "Team"),
    "settings.title":                   ("Impostazioni",      "Settings"),
    "settings.website.body":
        ("Pagine, link, social e form pubblici.",
         "Pages, links, social and public forms."),
    "settings.website.kicker":          ("Vetrina",           "Storefront"),
    "settings.website.title":           ("Sito pubblico",     "Public site"),
    "settings.workspace.body":
        ("Identità, brand e moduli attivi del workspace.",
         "Identity, brand and active workspace modules."),
    "settings.workspace.kicker":        ("Workspace",         "Workspace"),
    "settings.workspace.title":         ("Workspace",         "Workspace"),
}


def _set_nested(d: dict, parts: list[str], value: str) -> None:
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value


def apply(locale: str, idx: int) -> int:
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
    print(f"✦ {len(CANON)} canonical settings.* keys")
    print(f"  · it-IT: {apply('it-IT', 0)} new entries written")
    print(f"  · en-US: {apply('en-US', 1)} new entries written")
