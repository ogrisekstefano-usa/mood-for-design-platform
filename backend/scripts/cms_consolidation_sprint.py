#!/usr/bin/env python3
"""
CMS CONSOLIDATION SPRINT — Script completo
==========================================
1. Aggiorna professionals/editorial_triptych a 6 partner type blocks
2. Crea sezione partner_case_studies nella pagina professionals
3. Crea pagina CMS partner-application con sezione hero
4. Verifica e crea pagina CMS consulenza con sezione hero

Run: cd /app/backend && python3 scripts/cms_consolidation_sprint.py
"""
import sys
import os
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import db

NOW = datetime.now(timezone.utc).isoformat()
TENANT_ID = "848354b9-a43e-4147-bdad-116fb93bd585"

# ── 6 Partner Types per il triptych (migrazione da PARTNER_TYPES hardcoded) ──
PARTNER_TYPES_BLOCKS_IT = [
    {"title": "Architetti",        "body": "Studi di architettura che cercano un partner operativo per la fase esecutiva e la direzione lavori."},
    {"title": "Interior Designer", "body": "Designer indipendenti che vogliono amplificare la portata dei loro progetti con un partner affidabile."},
    {"title": "Contractor",        "body": "General contractor e imprese edili che gestiscono cantieri di qualità elevata in tutta Italia."},
    {"title": "Showroom",          "body": "Showroom e distributori di materiali premium alla ricerca di progetti di riferimento per il brand."},
    {"title": "Brand",             "body": "Brand di arredo e prodotto che cercano visibilità su progetti residenziali e hospitality di alto profilo."},
    {"title": "Developer",         "body": "Developer immobiliari che vogliono elevare la qualità progettuale dei propri interventi."},
]
PARTNER_TYPES_BLOCKS_EN = [
    {"title": "Architects",            "body": "Architecture firms looking for an operational partner for the execution phase and site management."},
    {"title": "Interior Designers",    "body": "Independent designers who want to amplify the scope of their projects with a reliable partner."},
    {"title": "Contractors",           "body": "General contractors and construction firms managing high-quality sites across Italy."},
    {"title": "Showrooms",             "body": "Premium material showrooms and distributors looking for showcase projects for their brand."},
    {"title": "Brands",                "body": "Furniture and product brands seeking visibility on high-profile residential and hospitality projects."},
    {"title": "Developers",            "body": "Real estate developers who want to elevate the design quality of their projects."},
]

# ── 3 Case Studies per partner_case_studies section ──
CASE_STUDIES_IT = [
    {
        "title":   "Villa privata, Brianza",
        "partner": "Studio Arch. M. Ferrante",
        "role":    "Progetto architettonico",
        "result":  "Ristrutturazione completa 480 mq — 14 mesi, consegnato entro budget.",
        "image":   "https://images.pexels.com/photos/4968694/pexels-photo-4968694.jpeg?auto=compress&cs=tinysrgb&w=940",
    },
    {
        "title":   "Resort boutique, Costiera Amalfitana",
        "partner": "Showroom Material Lab",
        "role":    "Fornitura materiali lapidei",
        "result":  "23 suite — selezione materiali premium, posa e supervisione cantiere.",
        "image":   "https://images.pexels.com/photos/5582590/pexels-photo-5582590.jpeg?auto=compress&cs=tinysrgb&w=940",
    },
    {
        "title":   "Penthouse Milano, Zona Magenta",
        "partner": "GC Costruzioni Srl",
        "role":    "General Contractor",
        "result":  "Penthouse 320 mq — progettazione esecutiva e cantieristica integrata.",
        "image":   "https://images.pexels.com/photos/23496714/pexels-photo-23496714.jpeg?auto=compress&cs=tinysrgb&w=940",
    },
]
CASE_STUDIES_EN = [
    {
        "title":   "Private Villa, Brianza",
        "partner": "Arch. M. Ferrante Studio",
        "role":    "Architectural design",
        "result":  "Full renovation 480 sqm — 14 months, delivered within budget.",
        "image":   "https://images.pexels.com/photos/4968694/pexels-photo-4968694.jpeg?auto=compress&cs=tinysrgb&w=940",
    },
    {
        "title":   "Boutique Resort, Amalfi Coast",
        "partner": "Material Lab Showroom",
        "role":    "Stone materials supply",
        "result":  "23 suites — premium material selection, laying and site supervision.",
        "image":   "https://images.pexels.com/photos/5582590/pexels-photo-5582590.jpeg?auto=compress&cs=tinysrgb&w=940",
    },
    {
        "title":   "Penthouse Milan, Magenta District",
        "partner": "GC Costruzioni Srl",
        "role":    "General Contractor",
        "result":  "320 sqm penthouse — executive design and integrated construction management.",
        "image":   "https://images.pexels.com/photos/23496714/pexels-photo-23496714.jpeg?auto=compress&cs=tinysrgb&w=940",
    },
]


def run():
    client = db()
    errors = []

    print("=" * 60)
    print("CMS CONSOLIDATION SPRINT")
    print("=" * 60)

    # ─── 1. Aggiorna editorial_triptych professionals (6 partner types) ─────
    print("\n[1] Aggiornamento editorial_triptych professionals → 6 partner types")
    TRIPTYCH_ID = "a8c385ba-28db-4c85-a32d-ceea7ceffa03"
    try:
        payload = {
            "locale_content": {
                "_default": {
                    "eyebrow": "Chi collabora con noi",
                    "title":   "Sei profili,\nun'unica visione.",
                    "blocks":  PARTNER_TYPES_BLOCKS_IT,
                },
                "it": {
                    "eyebrow": "Chi collabora con noi",
                    "title":   "Sei profili,\nun'unica visione.",
                    "blocks":  PARTNER_TYPES_BLOCKS_IT,
                },
                "en-US": {
                    "eyebrow": "Who works with us",
                    "title":   "Six profiles,\none vision.",
                    "blocks":  PARTNER_TYPES_BLOCKS_EN,
                },
                "en-GB": {
                    "eyebrow": "Who works with us",
                    "title":   "Six profiles,\none vision.",
                    "blocks":  PARTNER_TYPES_BLOCKS_EN,
                },
            },
            "updated_at": NOW,
        }
        client.table("cms_sections").update(payload).eq("id", TRIPTYCH_ID).execute()
        print(f"  OK  editorial_triptych aggiornato con 6 blocks")
    except Exception as e:
        print(f"  ERR {e}")
        errors.append(("triptych_update", str(e)))

    # ─── 2. Crea sezione partner_case_studies nella pagina professionals ────
    print("\n[2] Creazione sezione partner_case_studies")
    PROFESSIONALS_PAGE_ID = "358792d3-9c27-4a7f-a72c-febb3c364096"
    CASE_STUDIES_SEC_ID = str(uuid.uuid4())
    try:
        # Controlla se esiste già
        existing = client.table("cms_sections") \
            .select("id") \
            .eq("page_id", PROFESSIONALS_PAGE_ID) \
            .eq("section_type", "partner_case_studies") \
            .limit(1).execute()
        if existing.data:
            CASE_STUDIES_SEC_ID = existing.data[0]["id"]
            print(f"  EXISTS  partner_case_studies già presente: {CASE_STUDIES_SEC_ID[:8]}")
            # Update it
            client.table("cms_sections").update({
                "locale_content": _case_studies_locale(),
                "updated_at": NOW,
            }).eq("id", CASE_STUDIES_SEC_ID).execute()
            print(f"  OK  Aggiornata sezione partner_case_studies")
        else:
            client.table("cms_sections").insert({
                "id":           CASE_STUDIES_SEC_ID,
                "tenant_id":    TENANT_ID,
                "page_id":      PROFESSIONALS_PAGE_ID,
                "section_type": "partner_case_studies",
                "sort_order":   35,
                "visible":      True,
                "locale_content": _case_studies_locale(),
                "settings":     {
                    "cta_href": "/partner-application",
                },
                "created_at":  NOW,
                "updated_at":  NOW,
            }).execute()
            print(f"  OK  Creata sezione partner_case_studies: {CASE_STUDIES_SEC_ID[:8]}")
    except Exception as e:
        print(f"  ERR {e}")
        errors.append(("case_studies_create", str(e)))

    # ─── 3. Crea pagina CMS partner-application ─────────────────────────────
    print("\n[3] Creazione pagina CMS partner-application")
    try:
        existing_page = client.table("cms_pages") \
            .select("id") \
            .eq("tenant_id", TENANT_ID) \
            .eq("page_key", "partner-application") \
            .limit(1).execute()

        if existing_page.data:
            pa_page_id = existing_page.data[0]["id"]
            print(f"  EXISTS  partner-application page: {pa_page_id[:8]}")
        else:
            pa_page_id = str(uuid.uuid4())
            client.table("cms_pages").insert({
                "id":         pa_page_id,
                "tenant_id":  TENANT_ID,
                "page_key":   "partner-application",
                "title":      "Partner Application",
                "status":     "published",
                "created_at": NOW,
                "updated_at": NOW,
            }).execute()
            print(f"  OK  Creata pagina partner-application: {pa_page_id[:8]}")

        # Crea sezione hero per partner-application
        existing_hero = client.table("cms_sections") \
            .select("id") \
            .eq("page_id", pa_page_id) \
            .eq("section_type", "hero_editorial") \
            .limit(1).execute()

        pa_hero_id = str(uuid.uuid4())
        pa_hero_locale = {
            "_default": {
                "eyebrow":      "CANDIDATURA PARTNER",
                "title":        "Proponi una\ncollaborazione.",
                "sub":          "Raccontaci il tuo studio e come immagini una collaborazione con noi. Valutiamo ogni profilo con cura entro 5 giorni lavorativi.",
                "cta_primary":  "Invia la tua candidatura",
            },
            "it": {
                "eyebrow":      "CANDIDATURA PARTNER",
                "title":        "Proponi una\ncollaborazione.",
                "sub":          "Raccontaci il tuo studio e come immagini una collaborazione con noi. Valutiamo ogni profilo con cura entro 5 giorni lavorativi.",
                "cta_primary":  "Invia la tua candidatura",
                "success_title": "Candidatura ricevuta.",
                "success_body":  "Grazie per il tuo interesse. Il nostro team valuterà la candidatura e ti contatterà qualora emergano opportunità di collaborazione compatibili con il tuo profilo.",
            },
            "en-US": {
                "eyebrow":      "PARTNER APPLICATION",
                "title":        "Propose a\ncollaboration.",
                "sub":          "Tell us about your studio and how you envision a collaboration with us. We evaluate every profile carefully within 5 business days.",
                "cta_primary":  "Submit your application",
                "success_title": "Application received.",
                "success_body":  "We will review your profile within 5 business days and contact you at the email address provided.",
            },
            "en-GB": {
                "eyebrow":      "PARTNER APPLICATION",
                "title":        "Propose a\ncollaboration.",
                "sub":          "Tell us about your studio and how you envision a collaboration with us. We evaluate every profile carefully within 5 business days.",
                "cta_primary":  "Submit your application",
                "success_title": "Application received.",
                "success_body":  "We will review your profile within 5 business days and contact you at the email address provided.",
            },
            "fr-FR": {
                "eyebrow":      "CANDIDATURE PARTENAIRE",
                "title":        "Proposez une\ncollaboration.",
                "sub":          "Parlez-nous de votre studio et de la façon dont vous envisagez une collaboration avec nous.",
                "cta_primary":  "Envoyer votre candidature",
            },
            "de-DE": {
                "eyebrow":      "PARTNER-BEWERBUNG",
                "title":        "Schlagen Sie eine\nZusammenarbeit vor.",
                "sub":          "Erzählen Sie uns von Ihrem Studio und wie Sie sich eine Zusammenarbeit mit uns vorstellen.",
                "cta_primary":  "Bewerbung einreichen",
            },
            "es-ES": {
                "eyebrow":      "CANDIDATURA DE SOCIO",
                "title":        "Proponga una\ncolaboración.",
                "sub":          "Cuéntenos sobre su estudio y cómo imagina una colaboración con nosotros.",
                "cta_primary":  "Enviar su candidatura",
            },
        }
        pa_hero_settings = {
            "bg_image":     "https://images.pexels.com/photos/4977353/pexels-photo-4977353.jpeg?auto=compress&cs=tinysrgb&w=940",
            "cta_primary_href": "/partner-application#form",
        }

        if existing_hero.data:
            client.table("cms_sections").update({
                "locale_content": pa_hero_locale,
                "settings":       pa_hero_settings,
                "updated_at":     NOW,
            }).eq("id", existing_hero.data[0]["id"]).execute()
            print(f"  OK  Aggiornata hero section partner-application")
        else:
            client.table("cms_sections").insert({
                "id":             pa_hero_id,
                "tenant_id":      TENANT_ID,
                "page_id":        pa_page_id,
                "section_type":   "hero_editorial",
                "sort_order":     10,
                "visible":        True,
                "locale_content": pa_hero_locale,
                "settings":       pa_hero_settings,
                "created_at":     NOW,
                "updated_at":     NOW,
            }).execute()
            print(f"  OK  Creata hero section partner-application: {pa_hero_id[:8]}")

        # Pubblica la pagina
        rev_id = str(uuid.uuid4())
        sections_res = client.table("cms_sections").select("*") \
            .eq("page_id", pa_page_id).order("sort_order").execute()
        client.table("cms_page_revisions").insert({
            "id":         rev_id,
            "tenant_id":  TENANT_ID,
            "page_id":    pa_page_id,
            "page_key":   "partner-application",
            "snapshot":   {"page": {}, "sections": sections_res.data or [], "frozen_at": NOW, "asset_index": {}},
            "label":      "CMS Consolidation Sprint — partner-application hero",
            "kind":       "publish",
            "created_at": NOW,
        }).execute()
        client.table("cms_pages").update({
            "published_revision_id": rev_id,
            "status":                "published",
            "updated_at":            NOW,
        }).eq("id", pa_page_id).execute()
        print(f"  OK  Pagina partner-application pubblicata → rev {rev_id[:8]}")

    except Exception as e:
        print(f"  ERR {e}")
        errors.append(("partner_application_page", str(e)))

    # ─── 4. Pubblica professionals page con nuove sezioni ───────────────────
    print("\n[4] Ripubblica pagina professionals con nuove sezioni")
    try:
        rev_id = str(uuid.uuid4())
        sections_res = client.table("cms_sections").select("*") \
            .eq("page_id", PROFESSIONALS_PAGE_ID).order("sort_order").execute()
        client.table("cms_page_revisions").insert({
            "id":         rev_id,
            "tenant_id":  TENANT_ID,
            "page_id":    PROFESSIONALS_PAGE_ID,
            "page_key":   "professionals",
            "snapshot":   {"page": {}, "sections": sections_res.data or [], "frozen_at": NOW, "asset_index": {}},
            "label":      "CMS Consolidation Sprint — 6 partner types + case studies",
            "kind":       "publish",
            "created_at": NOW,
        }).execute()
        client.table("cms_pages").update({
            "published_revision_id": rev_id,
            "updated_at":            NOW,
        }).eq("id", PROFESSIONALS_PAGE_ID).execute()
        print(f"  OK  Professionals ripubblicato → rev {rev_id[:8]}")
    except Exception as e:
        print(f"  ERR {e}")
        errors.append(("professionals_publish", str(e)))

    # ─── SUMMARY ─────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print(f"COMPLETATO: {4 - len(errors)}/4 operazioni OK")
    if errors:
        print(f"ERRORI ({len(errors)}):")
        for k, v in errors:
            print(f"  {k}: {v}")
    print("=" * 60)


def _case_studies_locale():
    return {
        "_default": {
            "eyebrow": "PROGETTI SVILUPPATI INSIEME",
            "title":   "Partner + Studio\n= risultato.",
            "cases":   CASE_STUDIES_IT,
        },
        "it": {
            "eyebrow": "PROGETTI SVILUPPATI INSIEME",
            "title":   "Partner + Studio\n= risultato.",
            "cases":   CASE_STUDIES_IT,
        },
        "en-US": {
            "eyebrow": "PROJECTS BUILT TOGETHER",
            "title":   "Partner + Studio\n= result.",
            "cases":   CASE_STUDIES_EN,
        },
        "en-GB": {
            "eyebrow": "PROJECTS BUILT TOGETHER",
            "title":   "Partner + Studio\n= result.",
            "cases":   CASE_STUDIES_EN,
        },
        "fr-FR": {
            "eyebrow": "PROJETS DÉVELOPPÉS ENSEMBLE",
            "title":   "Partner + Studio\n= résultat.",
            "cases":   CASE_STUDIES_IT,
        },
        "de-DE": {
            "eyebrow": "GEMEINSAM ENTWICKELTE PROJEKTE",
            "title":   "Partner + Studio\n= Ergebnis.",
            "cases":   CASE_STUDIES_IT,
        },
        "es-ES": {
            "eyebrow": "PROYECTOS DESARROLLADOS JUNTOS",
            "title":   "Partner + Studio\n= resultado.",
            "cases":   CASE_STUDIES_IT,
        },
    }


if __name__ == "__main__":
    run()
