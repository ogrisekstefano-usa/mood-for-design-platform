#!/usr/bin/env python3
"""CMS CONSOLIDATION SPRINT — Patch script.

Popola locale_content + settings per tutte le sezioni CMS vuote.
Dopo l'esecuzione, pubblica tutte le pagine modificate.

Run: cd /app/backend && python3 scripts/patch_cms_consolidation.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import db

# ─── Content Catalog ──────────────────────────────────────────────────────────

# Struttura: section_id → { locale_content, settings }
# locale_content segue il formato { it: {...}, 'en-US': {...}, _default: {...} }

PATCHES = {

    # ═══════════════════════════════════════════════════════
    # SERVICES PAGE
    # ═══════════════════════════════════════════════════════

    # 1. Hero editoriale — servizi
    "e508ceb9-bc4c-4820-a2c7-9a3f98f92331": {
        "locale_content": {
            "_default": {
                "eyebrow":       "I nostri servizi",
                "title":         "Progettiamo\nil tuo spazio.",
                "sub":           "Dalla residenza privata agli spazi commerciali: ogni progetto nasce dall'ascolto e prende forma attraverso materiali, luce e proporzioni.",
                "cta_primary":   "Prenota una consulenza",
                "cta_secondary": "Scopri i nostri progetti",
            },
            "it": {
                "eyebrow":       "I nostri servizi",
                "title":         "Progettiamo\nil tuo spazio.",
                "sub":           "Dalla residenza privata agli spazi commerciali: ogni progetto nasce dall'ascolto e prende forma attraverso materiali, luce e proporzioni.",
                "cta_primary":   "Prenota una consulenza",
                "cta_secondary": "Scopri i nostri progetti",
            },
            "en-US": {
                "eyebrow":       "Our services",
                "title":         "We design\nyour space.",
                "sub":           "From private residences to commercial spaces: every project starts with listening and takes shape through materials, light and proportion.",
                "cta_primary":   "Book a consultation",
                "cta_secondary": "Discover our projects",
            },
        },
        "settings": {
            "cta_primary_href":   "/consulenza",
            "cta_secondary_href": "/projects",
        },
    },

    # 2. Editorial Triptych — tipologie di servizio
    "944ab2ce-d0f8-402b-b78c-f197e02ca992": {
        "locale_content": {
            "_default": {
                "eyebrow": "Tipologie di progetto",
                "title":   "Ogni spazio\nha la sua identità.",
                "items": [
                    {
                        "label":   "Residenziale",
                        "body":    "Appartamenti, ville e case private. Il progetto che ti assomiglia.",
                        "image":   "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800",
                    },
                    {
                        "label":   "Hospitality",
                        "body":    "Hotel, ristoranti, spa. L'esperienza come linguaggio.",
                        "image":   "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800",
                    },
                    {
                        "label":   "Contract",
                        "body":    "Uffici e spazi di lavoro. Dove forma e funzione convergono.",
                        "image":   "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
                    },
                    {
                        "label":   "Retail",
                        "body":    "Store e showroom. Il brand che diventa spazio.",
                        "image":   "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800",
                    },
                ],
            },
            "it": {
                "eyebrow": "Tipologie di progetto",
                "title":   "Ogni spazio\nha la sua identità.",
            },
            "en-US": {
                "eyebrow": "Project types",
                "title":   "Every space\nhas its identity.",
                "items": [
                    {"label": "Residential", "body": "Apartments, villas and private homes. The project that reflects you."},
                    {"label": "Hospitality", "body": "Hotels, restaurants, spas. Experience as language."},
                    {"label": "Contract",    "body": "Offices and workspaces. Where form and function converge."},
                    {"label": "Retail",      "body": "Stores and showrooms. The brand becomes space."},
                ],
            },
        },
    },

    # 3. Atmosphere Statement — servizi
    "c9079351-16ec-47e1-800a-42a12e33b152": {
        "locale_content": {
            "_default": {
                "title": "Non vendiamo\nun catalogo.\nProgettiamo un'esperienza.",
                "sub":   "Ogni scelta — dal materiale alla proporzione — nasce da una conversazione profonda con chi abiterà quegli spazi.",
                "cta":   "Come lavoriamo",
            },
            "it": {
                "title": "Non vendiamo\nun catalogo.\nProgettiamo un'esperienza.",
                "sub":   "Ogni scelta — dal materiale alla proporzione — nasce da una conversazione profonda con chi abiterà quegli spazi.",
                "cta":   "Come lavoriamo",
            },
            "en-US": {
                "title": "We don't sell\na catalogue.\nWe design an experience.",
                "sub":   "Every choice — from material to proportion — comes from a deep conversation with those who will inhabit those spaces.",
                "cta":   "How we work",
            },
        },
        "settings": {
            "cta_href": "/about",
        },
    },

    # 4. Design Journey — processo servizi
    "719711e1-06c0-4575-8933-0e0331520311": {
        "locale_content": {
            "_default": {
                "eyebrow": "Il nostro processo",
                "title":   "Quattro fasi.\nUn metodo.",
                "steps": [
                    {"label": "Ascolto",       "body": "Comprendiamo chi sei e come vivi. Prima ancora di parlare di spazi."},
                    {"label": "Concept",        "body": "Un'ipotesi progettuale che sintetizza identità, funzione e visione."},
                    {"label": "Progettazione",  "body": "Tavole tecniche, materiali, selezione arredi. Ogni dettaglio ha un perché."},
                    {"label": "Realizzazione",  "body": "Coordinamento cantiere, supervisione, consegna. Fino all'ultimo tocco."},
                ],
                "cta": "Inizia il tuo progetto",
            },
            "it": {
                "eyebrow": "Il nostro processo",
                "title":   "Quattro fasi.\nUn metodo.",
                "cta":     "Inizia il tuo progetto",
            },
            "en-US": {
                "eyebrow": "Our process",
                "title":   "Four phases.\nOne method.",
                "steps": [
                    {"label": "Listen",   "body": "We understand who you are and how you live. Before talking about spaces."},
                    {"label": "Concept",  "body": "A design hypothesis that synthesises identity, function and vision."},
                    {"label": "Design",   "body": "Technical drawings, materials, furniture selection. Every detail has a reason."},
                    {"label": "Build",    "body": "Site coordination, supervision, delivery. Down to the last touch."},
                ],
                "cta": "Start your project",
            },
        },
        "settings": {
            "cta_href": "/consulenza",
        },
    },

    # 5. Cinematic Quote — chiusura servizi
    "17c799e5-53cf-4ad7-938b-9bea871b967e": {
        "locale_content": {
            "_default": {
                "title": "Hai un progetto?\nParlaci.",
                "cta":   "Prenota una consulenza",
            },
            "it": {
                "title": "Hai un progetto?\nParlaci.",
                "cta":   "Prenota una consulenza",
            },
            "en-US": {
                "title": "Have a project?\nLet's talk.",
                "cta":   "Book a consultation",
            },
        },
        "settings": {
            "cta_href": "/consulenza",
        },
    },

    # ═══════════════════════════════════════════════════════
    # PROFESSIONALS PAGE
    # ═══════════════════════════════════════════════════════

    # 1. Hero — professionisti / partner
    "01c4610d-9540-4108-96a4-d11d3671ec3f": {
        "locale_content": {
            "_default": {
                "eyebrow":       "Per i professionisti",
                "title":         "Proponi una\ncollaborazione.",
                "sub":           "Lavoriamo con architetti, interior designer, contractor e showroom che condividono la nostra visione del progetto come atto culturale.",
                "cta_primary":   "Invia la tua candidatura",
                "cta_secondary": "Scopri i nostri progetti",
                "image":         "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1400",
            },
            "it": {
                "eyebrow":       "Per i professionisti",
                "title":         "Proponi una\ncollaborazione.",
                "sub":           "Lavoriamo con architetti, interior designer, contractor e showroom che condividono la nostra visione del progetto come atto culturale.",
                "cta_primary":   "Invia la tua candidatura",
                "cta_secondary": "Scopri i nostri progetti",
            },
            "en-US": {
                "eyebrow":       "For professionals",
                "title":         "Propose a\ncollaboration.",
                "sub":           "We work with architects, interior designers, contractors and showrooms who share our vision of design as a cultural act.",
                "cta_primary":   "Submit your application",
                "cta_secondary": "Discover our projects",
            },
        },
        "settings": {
            "cta_primary_href":   "/partner-application",
            "cta_secondary_href": "/projects",
            "bg_image":           "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1400",
        },
    },

    # 2. Atmosphere Statement — manifesto partner
    "6b4113df-ca01-4871-898f-1e324f461931": {
        "locale_content": {
            "_default": {
                "title": "Cerchiamo professionisti\nche vedono oltre il progetto.",
                "sub":   "Non cerchiamo fornitori. Cerchiamo partner che portino visione, competenza e rispetto per il dettaglio. Persone con cui costruire relazioni durature.",
                "cta":   "Chi siamo",
            },
            "it": {
                "title": "Cerchiamo professionisti\nche vedono oltre il progetto.",
                "sub":   "Non cerchiamo fornitori. Cerchiamo partner che portino visione, competenza e rispetto per il dettaglio.",
                "cta":   "Chi siamo",
            },
            "en-US": {
                "title": "We look for professionals\nwho see beyond the project.",
                "sub":   "We don't look for suppliers. We look for partners who bring vision, competence and respect for detail.",
                "cta":   "About us",
            },
        },
        "settings": {
            "cta_href": "/about",
        },
    },

    # 3. Editorial Triptych — tipologie partner
    "a8c385ba-28db-4c85-a32d-ceea7ceffa03": {
        "locale_content": {
            "_default": {
                "eyebrow": "Chi collabora con noi",
                "title":   "Tre profili,\nun'unica visione.",
                "items": [
                    {
                        "label": "Architetti & Interior Designer",
                        "body":  "Collaboriamo su progetti di alto profilo dove la direzione creativa è condivisa fin dal primo concept.",
                        "image": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800",
                    },
                    {
                        "label": "General Contractor",
                        "body":  "Imprese edili e contractor specializzati con cui coordiniamo cantieri complessi in tutta Italia.",
                        "image": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800",
                    },
                    {
                        "label": "Brand & Showroom",
                        "body":  "Produttori, showroom e brand che condividono la nostra selezione di materiali e finiture di eccellenza.",
                        "image": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800",
                    },
                ],
            },
            "it": {
                "eyebrow": "Chi collabora con noi",
                "title":   "Tre profili,\nun'unica visione.",
            },
            "en-US": {
                "eyebrow": "Who collaborates with us",
                "title":   "Three profiles,\none vision.",
                "items": [
                    {"label": "Architects & Interior Designers", "body": "We collaborate on high-profile projects where creative direction is shared from the first concept."},
                    {"label": "General Contractor",              "body": "Construction firms and specialised contractors with whom we coordinate complex sites across Italy."},
                    {"label": "Brands & Showrooms",              "body": "Manufacturers, showrooms and brands that share our selection of premium materials and finishes."},
                ],
            },
        },
    },

    # 4. Design Journey — processo collaborazione
    "941481fa-6ddf-4a26-aee0-e44d5e62f24c": {
        "locale_content": {
            "_default": {
                "eyebrow": "Come funziona",
                "title":   "Una candidatura,\nun percorso.",
                "steps": [
                    {"label": "Candidatura",   "body": "Compila il form /partner-application. Ci racconti chi sei e come lavori."},
                    {"label": "Valutazione",   "body": "Il team valuta la candidatura nei tempi dovuti e ti contatta se emergono sinergie."},
                    {"label": "Incontro",      "body": "Una call o un incontro di persona per approfondire valori e modalità di lavoro."},
                    {"label": "Collaborazione","body": "Inizio di una relazione professionale su progetti specifici, curata nel tempo."},
                ],
                "cta": "Invia la tua candidatura",
            },
            "it": {
                "eyebrow": "Come funziona",
                "title":   "Una candidatura,\nun percorso.",
                "cta":     "Invia la tua candidatura",
            },
            "en-US": {
                "eyebrow": "How it works",
                "title":   "An application,\na journey.",
                "steps": [
                    {"label": "Application",   "body": "Fill in the /partner-application form. Tell us who you are and how you work."},
                    {"label": "Evaluation",    "body": "The team evaluates the application and contacts you if synergies emerge."},
                    {"label": "Meeting",       "body": "A call or in-person meeting to explore values and working methods."},
                    {"label": "Collaboration", "body": "The start of a professional relationship on specific projects, nurtured over time."},
                ],
                "cta": "Submit your application",
            },
        },
        "settings": {
            "cta_href": "/partner-application",
        },
    },

    # 5. Professionals CTA
    "db7c2964-4445-4bb6-b18a-cd46a6ccfe5d": {
        "locale_content": {
            "_default": {
                "eyebrow": "Sei un professionista?",
                "title":   "Collabora con noi",
                "body":    "Invia la tua candidatura. Valutiamo ogni profilo con cura.",
                "cta":     "Invia la tua candidatura",
            },
            "it": {
                "eyebrow": "Sei un professionista?",
                "title":   "Collabora con noi",
                "body":    "Invia la tua candidatura. Valutiamo ogni profilo con cura.",
                "cta":     "Invia la tua candidatura",
            },
            "en-US": {
                "eyebrow": "Are you a professional?",
                "title":   "Collaborate with us",
                "body":    "Submit your application. We evaluate every profile with care.",
                "cta":     "Submit your application",
            },
        },
        "settings": {
            "cta_href": "/partner-application",
        },
    },

    # 6. Cinematic Quote — chiusura professionals
    "2b66cabc-4c15-4f10-b518-81aa74a025aa": {
        "locale_content": {
            "_default": {
                "title": "Il progetto giusto\nnasce dalla persona giusta.",
                "cta":   "Invia la tua candidatura",
            },
            "it": {
                "title": "Il progetto giusto\nnasce dalla persona giusta.",
                "cta":   "Invia la tua candidatura",
            },
            "en-US": {
                "title": "The right project\ncomes from the right person.",
                "cta":   "Submit your application",
            },
        },
        "settings": {
            "cta_href": "/partner-application",
        },
    },

    # ═══════════════════════════════════════════════════════
    # ABOUT PAGE
    # ═══════════════════════════════════════════════════════

    # 1. Hero — about (ha già immagine in settings, mancano solo testi)
    "4a56e926-4b1a-4326-aa7f-06cea0cff5d8": {
        "locale_content": {
            "_default": {
                "eyebrow":       "Chi siamo",
                "title":         "Studio italiano\ndi progettazione.",
                "sub":           "Progettiamo ambienti dove materia e luce si incontrano. Con rigore e sensibilità, da oltre un decennio.",
                "cta_primary":   "Scopri i nostri servizi",
                "cta_secondary": "Vedi i nostri progetti",
            },
            "it": {
                "eyebrow":       "Chi siamo",
                "title":         "Studio italiano\ndi progettazione.",
                "sub":           "Progettiamo ambienti dove materia e luce si incontrano. Con rigore e sensibilità, da oltre un decennio.",
                "cta_primary":   "Scopri i nostri servizi",
                "cta_secondary": "Vedi i nostri progetti",
            },
            "en-US": {
                "eyebrow":       "About us",
                "title":         "Italian design\nstudio.",
                "sub":           "We design environments where matter and light meet. With rigour and sensitivity, for over a decade.",
                "cta_primary":   "Discover our services",
                "cta_secondary": "See our projects",
            },
        },
        "settings": {
            "cta_primary_href":   "/servizi",
            "cta_secondary_href": "/projects",
        },
    },
}

# Pagine da pubblicare dopo il patching
PAGES_TO_PUBLISH = ["services", "professionals", "about"]


def patch():
    client = db()

    print(f"Patching {len(PATCHES)} sezioni CMS...\n")
    errors = []

    for section_id, data in PATCHES.items():
        payload = {}
        if "locale_content" in data:
            payload["locale_content"] = data["locale_content"]
        if "settings" in data:
            payload["settings"] = data["settings"]

        try:
            # Verifica che la sezione esista
            check = client.table("cms_sections").select("id, section_type, page_id") \
                .eq("id", section_id).limit(1).execute()
            if not check.data:
                print(f"  SKIP {section_id}: non trovata nel DB")
                continue

            sec_type = check.data[0].get("section_type")

            # Patch
            payload["updated_at"] = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
            client.table("cms_sections").update(payload).eq("id", section_id).execute()
            print(f"  OK  [{sec_type}] {section_id[:8]}...")

        except Exception as e:
            print(f"  ERR {section_id[:8]}: {e}")
            errors.append((section_id, str(e)))

    print(f"\n{'─'*50}")
    print(f"Patch completato: {len(PATCHES) - len(errors)}/{len(PATCHES)} sezioni aggiornate")
    if errors:
        print(f"Errori ({len(errors)}):")
        for sid, err in errors:
            print(f"  {sid[:8]}: {err}")

    # Pubblica le pagine
    print(f"\nPubblicazione pagine: {PAGES_TO_PUBLISH}")
    for page_key in PAGES_TO_PUBLISH:
        try:
            # Trova la pagina
            page_res = client.table("cms_pages").select("id, published_revision_id") \
                .eq("page_key", page_key) \
                .limit(1).execute()
            if not page_res.data:
                print(f"  SKIP pagina {page_key}: non trovata")
                continue

            page_id = page_res.data[0]["id"]

            # Crea nuova revision
            import uuid
            from datetime import datetime, timezone

            sections_res = client.table("cms_sections").select("*") \
                .eq("page_id", page_id).order("sort_order").execute()
            sections = sections_res.data or []

            rev_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()

            revision_row = {
                "id":          rev_id,
                "page_id":     page_id,
                "sections_snapshot": sections,
                "label":       "CMS Consolidation Sprint — patch contenuto",
                "created_at":  now,
            }
            client.table("cms_revisions").insert(revision_row).execute()

            # Aggiorna published_revision_id
            client.table("cms_pages").update({
                "published_revision_id": rev_id,
                "updated_at": now,
            }).eq("id", page_id).execute()

            print(f"  OK  Pagina '{page_key}' pubblicata → rev {rev_id[:8]}...")

        except Exception as e:
            print(f"  ERR pagina {page_key}: {e}")

    print("\nDone.")


if __name__ == "__main__":
    patch()
