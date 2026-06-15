"""
seed_demo_content.py — Content Population Sprint
Popola Blueprint con contenuto demo reale:
  - 3 Published Design Journeys (Progetti)
  - 3 Magazine Articles IT
  - 3 Magazine Articles EN
  - Studio manifesto (design_journey section)
  - Team / finalCTA update (cinematic_quote + atmosphere_statement)
  - CTA professionisti (professionals_cta section)
"""
import os, sys, json, uuid
sys.path.insert(0, "/app/backend")
from database import db

# ─── Tenant ID ────────────────────────────────────────────────────────────────
def get_tenant_id():
    r = db().table("tenants").select("id").eq("slug", "studio").limit(1).execute()
    if not r.data:
        raise RuntimeError("Tenant 'studio' not found")
    return r.data[0]["id"]

# ─── Images (Unsplash) ────────────────────────────────────────────────────────
IMG = {
    "bathroom_luxury":    "https://images.unsplash.com/photo-1722923400899-af08ffc715c6?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
    "bedroom_dark":       "https://images.unsplash.com/photo-1663811397207-418a92396ad5?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
    "bedroom_light":      "https://images.unsplash.com/photo-1710224002849-a76ea1068b0d?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
    "living_fireplace":   "https://images.unsplash.com/photo-1759238136854-a43787126db7?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
    "kitchen_modern":     "https://images.unsplash.com/photo-1628745277862-bc0b2d68c50c?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
    "chair_editorial":    "https://images.unsplash.com/photo-1552146455-4b961f2ed173?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
    "kitchen_marble":     "https://images.unsplash.com/photo-1722605090433-41d1183a792d?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
    "bedroom_minimal":    "https://images.unsplash.com/photo-1633809365429-2fa048a02119?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
    "studio_office":      "https://images.unsplash.com/photo-1497366412874-3415097a27e7?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
}

NOW = lambda: __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()

# ─── 1. PUBLISHED DESIGN JOURNEYS ─────────────────────────────────────────────
JOURNEYS = [
    {
        "title":             "Villa Residenziale — Lago di Como",
        "slug":              "villa-lago-di-como",
        "editorial_excerpt": "Un rifugio lacustre in pietra naturale e legno di noce. "
                             "Il progetto reinterpreta la tradizione lombarda con un linguaggio contemporaneo "
                             "che dialoga con il paesaggio del Lario.",
        "atmosphere":        "Serena · Organica · Lacustre",
        "project_type":      "residenziale",
        "location":          "Lago di Como, Lombardia",
        "year":              2024,
        "hero_url":          IMG["bathroom_luxury"],
        "visibility_status": "published",
        "homepage_featured": True,
        "featured_order":    1,
        "material_tags":     ["pietra naturale", "noce canaletto", "travertino", "ferro battuto"],
        "canonical_locale":  "it-IT",
    },
    {
        "title":             "Penthouse — Milano Porta Nuova",
        "slug":              "penthouse-milano-porta-nuova",
        "editorial_excerpt": "Tremila metri quadri su due livelli. Una visione urbana del lusso contemporaneo "
                             "ispirata all'estetica industriale milanese, con dettagli in ottone e cemento a vista.",
        "atmosphere":        "Urbana · Sofisticata · Contemporanea",
        "project_type":      "residenziale",
        "location":          "Milano, Porta Nuova",
        "year":              2025,
        "hero_url":          IMG["bedroom_dark"],
        "visibility_status": "published",
        "homepage_featured": True,
        "featured_order":    2,
        "material_tags":     ["cemento a vista", "ottone brunito", "vetro strutturale", "marmo nero"],
        "canonical_locale":  "it-IT",
    },
    {
        "title":             "Boutique Suite — Costa Amalfitana",
        "slug":              "boutique-suite-costiera-amalfitana",
        "editorial_excerpt": "Un progetto sensoriale ispirato al Mediterraneo. Terracotta, intonaco bianco "
                             "e lino naturale si fondono in un dialogo con il mare. Ospitalità di alta gamma "
                             "per 12 suite indipendenti.",
        "atmosphere":        "Sensoriale · Mediterranea · Luminosa",
        "project_type":      "ospitalità",
        "location":          "Positano, Campania",
        "year":              2024,
        "hero_url":          IMG["bedroom_light"],
        "visibility_status": "published",
        "homepage_featured": True,
        "featured_order":    3,
        "material_tags":     ["terracotta", "intonaco veneziano", "lino naturale", "ceramica vietrese"],
        "canonical_locale":  "it-IT",
    },
]

def seed_journeys(tid):
    c = db()
    created = []
    # Rimuovi eventuali journeys precedenti demo
    existing = (c.table("published_design_journeys")
                .select("id,slug").eq("tenant_id", tid).execute()).data or []
    existing_slugs = {r["slug"] for r in existing}

    for j in JOURNEYS:
        if j["slug"] in existing_slugs:
            # Aggiorna invece di inserire
            r = (c.table("published_design_journeys")
                 .update({
                     "title": j["title"], "editorial_excerpt": j["editorial_excerpt"],
                     "atmosphere": j["atmosphere"], "project_type": j["project_type"],
                     "location": j["location"], "year": j["year"],
                     "hero_url": j["hero_url"], "visibility_status": j["visibility_status"],
                     "homepage_featured": j["homepage_featured"],
                     "featured_order": j["featured_order"],
                     "material_tags": j["material_tags"], "published_at": NOW(),
                     "updated_at": NOW(),
                 })
                 .eq("tenant_id", tid).eq("slug", j["slug"]).execute())
            created.append(("UPDATED", j["slug"]))
        else:
            new_id = str(uuid.uuid4())
            c.table("published_design_journeys").insert({
                "id": new_id, "tenant_id": tid,
                "slug": j["slug"], "title": j["title"],
                "editorial_excerpt": j["editorial_excerpt"],
                "atmosphere": j["atmosphere"], "project_type": j["project_type"],
                "location": j["location"], "year": j["year"],
                "hero_url": j["hero_url"], "visibility_status": j["visibility_status"],
                "homepage_featured": j["homepage_featured"],
                "featured_order": j["featured_order"],
                "material_tags": j["material_tags"],
                "gallery_asset_ids": [], "canonical_locale": j["canonical_locale"],
                "published_at": NOW(), "created_at": NOW(), "updated_at": NOW(),
            }).execute()
            created.append(("CREATED", j["slug"]))
    return created


# ─── 2. MAGAZINE ARTICLES ─────────────────────────────────────────────────────
ARTICLES = [
    # IT
    {
        "slug": "tendenze-2025-materiali-naturali",
        "default_locale": "it",
        "cover_url": IMG["living_fireplace"],
        "hero_url":  IMG["living_fireplace"],
        "category_slug": "tendenze",
        "tags": ["materiali", "2025", "tendenze"],
        "atmosphere_keywords": ["organico", "naturale", "caldo"],
        "locale_content": {
            "it": {
                "kicker":  "TENDENZE 2025",
                "title":   "Il ritorno della materia. Pietra, lino e legno non verniciato.",
                "summary": "Dopo anni di superfici laccate e finiture sintetiche, il design di interni "
                           "riscopre la materia grezza. Una guida ai materiali che definiranno lo spazio nel 2025.",
            }
        },
        "body_blocks": [
            {"type": "paragraph", "locale_content": {"it": {
                "text": "La pietra non è mai scomparsa dagli interni di lusso. "
                        "Ma nel 2025 torna con una presenza nuova: grezza, non lucidata, con le venature a vista. "
                        "Non è nostalgia. È una risposta precisa all'eccesso digitale degli ultimi cinque anni."
            }}},
            {"type": "paragraph", "locale_content": {"it": {
                "text": "Il lino grezzo nel salotto, il legno di noce non trattato in cucina, "
                        "la terracotta artigianale in bagno. Ogni superficie racconta un processo di lavorazione, "
                        "una provenienza, un territorio. Il lusso contemporaneo si misura in autenticità, non in perfezione."
            }}},
        ],
    },
    {
        "slug": "cucina-come-spazio-di-design",
        "default_locale": "it",
        "cover_url": IMG["kitchen_modern"],
        "hero_url":  IMG["kitchen_modern"],
        "category_slug": "progettazione",
        "tags": ["cucina", "design", "funzionale"],
        "atmosphere_keywords": ["moderno", "funzionale", "sociale"],
        "locale_content": {
            "it": {
                "kicker":  "PROGETTAZIONE",
                "title":   "La cucina non è più un servizio. È il centro gravitazionale della casa.",
                "summary": "La cucina come luogo di rappresentanza, incontro e identità familiare. "
                           "Come progettare uno spazio che sia insieme bello, funzionale e autentico.",
            }
        },
        "body_blocks": [
            {"type": "paragraph", "locale_content": {"it": {
                "text": "La cucina residenziale è cambiata più di qualsiasi altro ambiente negli ultimi dieci anni. "
                        "Non è più il retroscena della casa. È il palcoscenico principale. "
                        "Il luogo dove si ricevono gli amici, si prendono le decisioni, si trascorre più tempo."
            }}},
            {"type": "paragraph", "locale_content": {"it": {
                "text": "Un buon progetto di cucina deve bilanciare tre dimensioni: ergonomia, estetica, identità. "
                        "Ergonomia significa che tutto sia a portata di mano nel modo giusto. "
                        "Estetica significa che lo spazio abbia coerenza visiva. "
                        "Identità significa che quella cucina possa esistere solo in quella casa, per quella famiglia."
            }}},
        ],
    },
    {
        "slug": "luce-naturale-benessere-domestico",
        "default_locale": "it",
        "cover_url": IMG["chair_editorial"],
        "hero_url":  IMG["chair_editorial"],
        "category_slug": "benessere",
        "tags": ["luce", "benessere", "biofilia"],
        "atmosphere_keywords": ["luminoso", "sereno", "biofilico"],
        "locale_content": {
            "it": {
                "kicker":  "BENESSERE",
                "title":   "La luce non è arredo. È architettura.",
                "summary": "Come la gestione della luce naturale trasforma la qualità della vita domestica. "
                           "Orientamento, materiali riflettenti, schermature: una guida progettuale.",
            }
        },
        "body_blocks": [
            {"type": "paragraph", "locale_content": {"it": {
                "text": "La luce naturale è il parametro di qualità più sottovalutato in un progetto residenziale. "
                        "Gli studi confermano: la quantità e la qualità della luce naturale incidono direttamente "
                        "sul ritmo circadiano, sull'umore, sulla produttività e persino sulla qualità del sonno."
            }}},
            {"type": "paragraph", "locale_content": {"it": {
                "text": "Un progetto luminoso non inizia con le lampade. Inizia dall'orientamento dei locali, "
                        "dalla dimensione delle aperture, dalla scelta delle superfici. "
                        "Il bianco non è l'unica risposta: il giallo paglierino, il travertino, il lino grezzo "
                        "amplificano la luce senza annullarla."
            }}},
        ],
    },
    # EN
    {
        "slug": "2025-material-trends-stone-linen-wood",
        "default_locale": "en",
        "cover_url": IMG["kitchen_marble"],
        "hero_url":  IMG["kitchen_marble"],
        "category_slug": "tendenze",
        "tags": ["materials", "2025", "trends"],
        "atmosphere_keywords": ["organic", "natural", "warm"],
        "locale_content": {
            "en": {
                "kicker":  "TRENDS 2025",
                "title":   "The return of raw materials. Stone, linen and untreated wood.",
                "summary": "After years of lacquered surfaces and synthetic finishes, interior design "
                           "rediscovers raw materials. A guide to the textures that will define space in 2025.",
            }
        },
        "body_blocks": [
            {"type": "paragraph", "locale_content": {"en": {
                "text": "Stone never truly disappeared from luxury interiors. "
                        "But in 2025 it returns with new presence: raw, unpolished, with visible veins. "
                        "This is not nostalgia. It is a precise response to the digital excess of the last five years."
            }}},
            {"type": "paragraph", "locale_content": {"en": {
                "text": "Raw linen in the living room, untreated walnut wood in the kitchen, "
                        "artisanal terracotta in the bathroom. Each surface tells a story of making, "
                        "of origin, of territory. Contemporary luxury is measured in authenticity, not perfection."
            }}},
        ],
    },
    {
        "slug": "designing-with-natural-light",
        "default_locale": "en",
        "cover_url": IMG["living_fireplace"],
        "hero_url":  IMG["living_fireplace"],
        "category_slug": "benessere",
        "tags": ["light", "wellness", "biophilia"],
        "atmosphere_keywords": ["luminous", "serene", "biophilic"],
        "locale_content": {
            "en": {
                "kicker":  "WELLNESS",
                "title":   "Light is not decoration. It is architecture.",
                "summary": "How natural light management transforms the quality of domestic life. "
                           "Orientation, reflective surfaces, screening: a design guide.",
            }
        },
        "body_blocks": [
            {"type": "paragraph", "locale_content": {"en": {
                "text": "Natural light is the most undervalued quality parameter in residential design. "
                        "Studies confirm: the quantity and quality of natural light directly affects "
                        "circadian rhythm, mood, productivity and even sleep quality."
            }}},
        ],
    },
    {
        "slug": "the-kitchen-as-design-statement",
        "default_locale": "en",
        "cover_url": IMG["kitchen_modern"],
        "hero_url":  IMG["kitchen_modern"],
        "category_slug": "progettazione",
        "tags": ["kitchen", "design", "functional"],
        "atmosphere_keywords": ["modern", "social", "functional"],
        "locale_content": {
            "en": {
                "kicker":  "DESIGN",
                "title":   "The kitchen is no longer a service room. It is the gravitational center of the home.",
                "summary": "The kitchen as a space of representation, gathering and family identity. "
                           "How to design a space that is beautiful, functional and authentic.",
            }
        },
        "body_blocks": [
            {"type": "paragraph", "locale_content": {"en": {
                "text": "The residential kitchen has changed more than any other room in the last ten years. "
                        "It is no longer the backstage of the home. It is the main stage. "
                        "The place where friends are received, decisions are made, most time is spent."
            }}},
        ],
    },
]

def seed_articles(tid):
    c = db()
    created = []
    existing = (c.table("magazine_articles").select("id,slug")
                .eq("tenant_id", tid).execute()).data or []
    existing_slugs = {r["slug"]: r["id"] for r in existing}

    for art in ARTICLES:
        slug = art["slug"]
        payload = {
            "tenant_id":          tid,
            "slug":               slug,
            "locale_content":     art["locale_content"],
            "body_blocks":        art["body_blocks"],
            "cover_url":          art["cover_url"],
            "hero_url":           art["hero_url"],
            "category_slug":      art["category_slug"],
            "tags":               art["tags"],
            "atmosphere_keywords":art["atmosphere_keywords"],
            "default_locale":     art["default_locale"],
            "status":             "published",
            "published_at":       NOW(),
            "updated_at":         NOW(),
        }
        reading = max(1, sum(
            len((b.get("locale_content") or {}).get(art["default_locale"], {}).get("text", "").split())
            for b in art["body_blocks"]
        ) // 220)
        payload["reading_minutes"] = reading or 2

        if slug in existing_slugs:
            c.table("magazine_articles").update({
                k: v for k, v in payload.items() if k != "tenant_id"
            }).eq("id", existing_slugs[slug]).execute()
            created.append(("UPDATED", slug))
        else:
            new_id = str(uuid.uuid4())
            payload["id"] = new_id
            payload["created_at"] = NOW()
            c.table("magazine_articles").insert(payload).execute()
            created.append(("CREATED", slug))
    return created


# ─── 3. CMS SECTIONS ──────────────────────────────────────────────────────────
SECTION_UPDATES = {
    "design_journey": {
        "locale_content": {
            "it": {
                "eyebrow": "COME LAVORIAMO",
                "title":   "Un progetto nasce\ndall'ascolto profondo.",
                "cta":     "Inizia il tuo percorso",
            },
            "en": {
                "eyebrow": "HOW WE WORK",
                "title":   "A project is born\nfrom deep listening.",
                "cta":     "Begin your journey",
            },
        },
    },
    "atmosphere_statement": {
        "locale_content": {
            "it": {
                "eyebrow": "IL NOSTRO STUDIO",
                "title":   "Il design non è solo ciò che vedi.\nÈ come vivi.",
                "body":    "Siamo uno studio di interior design fondato sulla convinzione che ogni spazio "
                           "debba raccontare la storia di chi lo abita. Lavoriamo con materiali autentici, "
                           "artigiani selezionati e una metodologia progettuale rigorosa che parte sempre "
                           "dall'ascolto del cliente.",
                "cta":    "Scopri il metodo",
            },
            "en": {
                "eyebrow": "OUR STUDIO",
                "title":   "Design is not just what you see.\nIt is how you live.",
                "body":    "We are an interior design studio founded on the belief that every space "
                           "must tell the story of those who inhabit it. We work with authentic materials, "
                           "selected craftsmen and a rigorous design methodology that always starts "
                           "with listening to the client.",
                "cta":    "Discover our method",
            },
        },
    },
    "professionals_cta": {
        "locale_content": {
            "it": {
                "eyebrow": "PER PROFESSIONISTI",
                "title":   "Lavoriamo con architetti,\ninterior designer e developer.",
                "body":    "Offriamo collaborazioni strutturate per professionisti del settore: "
                           "accesso prioritario al nostro catalogo materiali, "
                           "fee commerciali dedicate, supporto nella presentazione al cliente finale.",
                "cta":    "Entra nella rete",
            },
            "en": {
                "eyebrow": "FOR PROFESSIONALS",
                "title":   "We work with architects,\ninterior designers and developers.",
                "body":    "We offer structured collaborations for industry professionals: "
                           "priority access to our materials catalogue, "
                           "dedicated commercial fees, support in presentations to end clients.",
                "cta":    "Join the network",
            },
        },
    },
    "cinematic_quote": {
        "locale_content": {
            "it": {
                "eyebrow":  "INIZIA IL TUO PROGETTO",
                "title":    "Pronto a trasformare\nil tuo spazio?",
                "sub":      "Raccontaci il progetto che hai in mente. "
                            "Il primo incontro è sempre un momento di ascolto.",
                "private":  "Richiedi una consulenza",
                "pro":      "Sei un professionista?",
            },
            "en": {
                "eyebrow":  "START YOUR PROJECT",
                "title":    "Ready to transform\nyour space?",
                "sub":      "Tell us about the project you have in mind. "
                            "The first meeting is always a moment of listening.",
                "private":  "Request a consultation",
                "pro":      "Are you a professional?",
            },
        },
    },
    "editorial_footer": {
        "locale_content": {
            "it": {
                "rights": "© 2026 Studio. Tutti i diritti riservati.",
                "cols": [
                    {"heading": "Studio", "links": [
                        {"label": "Chi siamo", "href": "/about"},
                        {"label": "Progetti", "href": "/projects"},
                        {"label": "Magazine", "href": "/magazine"},
                    ]},
                    {"heading": "Servizi", "links": [
                        {"label": "Residenziale", "href": "/services"},
                        {"label": "Ospitalità", "href": "/services"},
                        {"label": "Per Professionisti", "href": "/professionals"},
                    ]},
                    {"heading": "Contatti", "links": [
                        {"label": "Inizia un progetto", "href": "/begin-journey"},
                        {"label": "info@studio.com", "href": "mailto:info@studio.com"},
                    ]},
                ],
            },
            "en": {
                "rights": "© 2026 Studio. All rights reserved.",
                "cols": [],
            },
        },
    },
}

def seed_sections(tid):
    c = db()
    updated = []
    for section_type, update_data in SECTION_UPDATES.items():
        # Find section by section_type (not id prefix)
        r = (c.table("cms_sections").select("id,section_type,locale_content")
             .eq("tenant_id", tid).eq("section_type", section_type).limit(1).execute())
        if not r.data:
            updated.append(("NOT FOUND", section_type))
            continue
        sec = r.data[0]
        full_id = sec["id"]
        upd = {"updated_at": NOW()}
        if "locale_content" in update_data:
            current_lc = sec.get("locale_content") or {}
            new_lc = dict(current_lc)
            for locale, content in update_data["locale_content"].items():
                existing_locale = new_lc.get(locale) or {}
                new_lc[locale] = {**existing_locale, **content}
            upd["locale_content"] = new_lc
        if "settings" in update_data:
            upd["settings"] = update_data["settings"]
        c.table("cms_sections").update(upd).eq("id", full_id).execute()
        updated.append(("UPDATED", section_type, full_id[:8]))
    return updated


# ─── MAIN ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=== Content Population Sprint ===")
    tid = get_tenant_id()
    print(f"Tenant ID: {tid}")

    print("\n--- Step 1: Design Journeys ---")
    result = seed_journeys(tid)
    for op, slug in result:
        print(f"  [{op}] {slug}")

    print("\n--- Step 2: Magazine Articles ---")
    result = seed_articles(tid)
    for op, slug in result:
        print(f"  [{op}] {slug}")

    print("\n--- Step 3: CMS Sections ---")
    result = seed_sections(tid)
    for item in result:
        print(f"  {item}")

    print("\n=== DONE ===")
