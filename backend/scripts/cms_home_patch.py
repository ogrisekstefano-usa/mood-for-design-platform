#!/usr/bin/env python3
"""
CMS Consolidation Sprint — Home page sections update
Aggiunge campi mancanti per eliminare tutte le stringhe hardcoded dalla HomePage.

Run: cd /app/backend && python3 scripts/cms_home_patch.py
"""
import sys
import os
import json
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import db

NOW = datetime.now(timezone.utc).isoformat()
TENANT_ID = "848354b9-a43e-4147-bdad-116fb93bd585"
HOME_PAGE_ID = None  # filled dynamically

def run():
    client = db()
    errors = []
    print("=" * 60)
    print("CMS HOME PATCH — Eliminazione stringhe hardcoded")
    print("=" * 60)

    # ─── Recupera home page ID ────────────────────────────────────────────────
    pg = client.table("cms_pages").select("id") \
        .eq("tenant_id", TENANT_ID).eq("page_key", "home").limit(1).execute()
    if not pg.data:
        print("ERR: pagina home non trovata")
        return
    home_page_id = pg.data[0]["id"]
    print(f"  home page id: {home_page_id[:8]}")

    # ─── 1. design_journey → aggiungi campi hl_* ─────────────────────────────
    print("\n[1] Aggiunta campi hl_* alla sezione design_journey")
    dj_id = "336615b1-4a01-5602-8634-903b98914edd"
    try:
        sec = client.table("cms_sections").select("locale_content") \
            .eq("id", dj_id).limit(1).execute()
        if not sec.data:
            print("  SKIP: design_journey non trovata")
        else:
            lc = sec.data[0].get("locale_content", {}) or {}
            # Aggiorna locale it
            it = lc.get("it", {}) or {}
            it.update({
                "hl_eyebrow":  "Brief di Progetto",
                "hl_title":    "Raccontaci il tuo\nprogetto.",
                "hl_body":     "Condividi esigenze, stile, tempistiche e obiettivi. Ti aiuteremo a trasformare le idee in un progetto concreto e personalizzato.",
                "hl_cta":      "Compila il brief",
                "hl_cta_href": "/begin-journey",
            })
            # Aggiorna locale en-US
            en = lc.get("en-US", {}) or {}
            en.update({
                "hl_eyebrow":  "Project Brief",
                "hl_title":    "Tell us about\nyour project.",
                "hl_body":     "Share your needs, style, timeframe and goals. We will help you turn ideas into a concrete, personalised project.",
                "hl_cta":      "Fill in the brief",
                "hl_cta_href": "/begin-journey",
            })
            # Aggiorna en-GB
            en_gb = lc.get("en-GB", {}) or {}
            en_gb.update({
                "hl_eyebrow":  "Project Brief",
                "hl_title":    "Tell us about\nyour project.",
                "hl_body":     "Share your needs, style, timeframe and goals. We will help you turn ideas into a concrete, personalised project.",
                "hl_cta":      "Fill in the brief",
                "hl_cta_href": "/begin-journey",
            })
            lc["it"] = it
            lc["en-US"] = en
            lc["en-GB"] = en_gb
            # _default
            lc["_default"] = lc.get("_default") or {}
            lc["_default"].update({
                "hl_eyebrow":  "Brief di Progetto",
                "hl_title":    "Raccontaci il tuo\nprogetto.",
                "hl_body":     "Condividi esigenze, stile, tempistiche e obiettivi.",
                "hl_cta":      "Compila il brief",
                "hl_cta_href": "/begin-journey",
            })
            client.table("cms_sections").update({
                "locale_content": lc,
                "updated_at": NOW,
            }).eq("id", dj_id).execute()
            print("  OK  design_journey aggiornata con hl_*")
    except Exception as e:
        print(f"  ERR {e}")
        errors.append(("design_journey_hl", str(e)))

    # ─── 2. cinematic_quote → aggiungi contact_* ─────────────────────────────
    print("\n[2] Aggiunta campi contact_* alla sezione cinematic_quote")
    cq_id = "049428ad-16bf-4611-8b31-a09e640be62e"
    try:
        sec = client.table("cms_sections").select("locale_content, settings") \
            .eq("id", cq_id).limit(1).execute()
        if not sec.data:
            print("  SKIP: cinematic_quote non trovata")
        else:
            lc = sec.data[0].get("locale_content", {}) or {}
            settings = sec.data[0].get("settings", {}) or {}
            it = lc.get("it", {}) or {}
            it.update({
                "contact_label":      "Preferisci scrivere?",
                "contact_link_label": "Contattaci",
            })
            en = lc.get("en-US", {}) or {}
            en.update({
                "contact_label":      "Prefer to write?",
                "contact_link_label": "Contact us",
            })
            en_gb = lc.get("en-GB", {}) or {}
            en_gb.update({
                "contact_label":      "Prefer to write?",
                "contact_link_label": "Contact us",
            })
            fr = lc.get("fr-FR", {}) or {}
            fr.update({
                "contact_label":      "Vous préférez écrire?",
                "contact_link_label": "Contactez-nous",
            })
            es = lc.get("es-ES", {}) or {}
            es.update({
                "contact_label":      "¿Prefiere escribir?",
                "contact_link_label": "Contáctenos",
            })
            lc["it"]   = it
            lc["en-US"] = en
            lc["en-GB"] = en_gb
            lc["fr-FR"] = fr
            lc["es-ES"] = es
            # Aggiungi contact_href ai settings
            settings["contact_href"] = settings.get("contact_href") or "/consulenza"
            client.table("cms_sections").update({
                "locale_content": lc,
                "settings":       settings,
                "updated_at":     NOW,
            }).eq("id", cq_id).execute()
            print("  OK  cinematic_quote aggiornata con contact_*")
    except Exception as e:
        print(f"  ERR {e}")
        errors.append(("cinematic_quote_contact", str(e)))

    # ─── 3. editorial_grid → assicura read_link IT/EN ─────────────────────────
    print("\n[3] Verifica editorial_grid read_link")
    eg_id = "42e1f69c-644b-43a7-8b66-d8a8dbb24ecb"
    try:
        sec = client.table("cms_sections").select("locale_content") \
            .eq("id", eg_id).limit(1).execute()
        if sec.data:
            lc = sec.data[0].get("locale_content", {}) or {}
            it = lc.get("it", {}) or {}
            en = lc.get("en-US", {}) or {}
            needs_update = False
            if not it.get("read_link"):
                it["read_link"] = "Leggi l'articolo"
                lc["it"] = it
                needs_update = True
            if not en.get("read_link"):
                en["read_link"] = "Read the article"
                lc["en-US"] = en
                needs_update = True
            if needs_update:
                client.table("cms_sections").update({
                    "locale_content": lc, "updated_at": NOW,
                }).eq("id", eg_id).execute()
                print("  UPDATED  read_link aggiunto")
            else:
                print("  OK  read_link già presente")
    except Exception as e:
        print(f"  ERR {e}")
        errors.append(("editorial_grid", str(e)))

    # ─── SUMMARY ─────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print(f"COMPLETATO: {3 - len(errors)}/3 operazioni")
    if errors:
        for k, v in errors:
            print(f"  ERR {k}: {v}")
    print("=" * 60)


if __name__ == "__main__":
    run()
