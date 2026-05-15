"""
Reseed mood-corporate home with the new dark editorial design (May 2026).
Idempotent. Uses deterministic UUIDv5 keys so sections upsert in place.
Run: python /app/backend/db/reseed_home_v2.py
"""
import asyncio, json, os, sys, uuid
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

import asyncpg
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')

NS = uuid.UUID('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')
CORP_SLUG = 'mood-corporate'
LOCALES = ['it', 'en-us', 'en-uk', 'fr', 'de', 'es']

HERO_IMG = "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1600&q=80"
DASH_IMG = "https://images.unsplash.com/photo-1517502884422-41eaead166d4?w=1600&q=80"
PROJ_IMAGES = [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80",
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&q=80",
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=900&q=80",
    "https://images.unsplash.com/photo-1571508601891-ca5e7a713859?w=900&q=80",
]
CTA_BG = "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1800&q=80"


def page_uuid(key): return str(uuid.uuid5(NS, f'page:{CORP_SLUG}:{key}'))
def section_uuid(page, sid): return str(uuid.uuid5(NS, f'section:{CORP_SLUG}:{page}:{sid}'))


# ── Section content (multilingual) ───────────────────────────────────────────

SECTIONS = [
    # HERO -----------------------------------------------------------------
    {
        "id": "home-hero",
        "type": "editorial_hero",
        "sort": 0,
        "settings": {
            "layout": "split-right",
            "image_url": HERO_IMG,
            "image_alt": "Editorial luxury interior",
            "floating_card": {
                "project": "Villa Riviera",
                "status": "In Progress",
                "lines": [
                    {"label": "Type",     "value": "Residential"},
                    {"label": "Location", "value": "Côte d'Azur"},
                    {"label": "Phase",    "value": "Site visit"},
                ],
                "progress": 62,
                "cta": {"text": "View Project", "href": "#"},
            },
        },
        "content": {
            "en-us": {
                "eyebrow": "MOOD for DESIGN",
                "headline_1": "From Lead",
                "headline_2": "to Project.",
                "headline_3": "To Delivery.",
                "subheading": "One editorial workspace for studios, brands and clients. From the first mood board to the final handover — designed for the world's most discerning interiors.",
                "cta_primary":   {"text": "Book a Demo",   "href": "/start-studio"},
                "cta_secondary": {"text": "See how it works", "href": "#flow"},
                "chips": [
                    {"key": "lead",       "label": "Lead Intake"},
                    {"key": "moodboards", "label": "Moodboards"},
                    {"key": "projects",   "label": "Projects"},
                    {"key": "client",     "label": "Client Portal"},
                    {"key": "progress",   "label": "Progress Tracking"},
                ],
            },
            "it": {
                "eyebrow": "MOOD for DESIGN",
                "headline_1": "Dal Contatto",
                "headline_2": "al Progetto.",
                "headline_3": "Alla Consegna.",
                "subheading": "Un unico spazio editoriale per studi, brand e clienti. Dal primo moodboard alla consegna finale — pensato per gli interni più esigenti al mondo.",
                "cta_primary":   {"text": "Prenota una Demo", "href": "/start-studio"},
                "cta_secondary": {"text": "Scopri come funziona", "href": "#flow"},
                "chips": [
                    {"key": "lead",       "label": "Acquisizione Lead"},
                    {"key": "moodboards", "label": "Moodboard"},
                    {"key": "projects",   "label": "Progetti"},
                    {"key": "client",     "label": "Portale Cliente"},
                    {"key": "progress",   "label": "Avanzamento"},
                ],
            },
            "fr": {
                "eyebrow": "MOOD for DESIGN",
                "headline_1": "Du Contact",
                "headline_2": "au Projet.",
                "headline_3": "À la Livraison.",
                "subheading": "Un espace éditorial unique pour les studios, les marques et les clients. Du premier moodboard à la livraison finale.",
                "cta_primary":   {"text": "Réserver une Démo", "href": "/start-studio"},
                "cta_secondary": {"text": "Voir en action", "href": "#flow"},
                "chips": [
                    {"key": "lead",       "label": "Prospects"},
                    {"key": "moodboards", "label": "Moodboards"},
                    {"key": "projects",   "label": "Projets"},
                    {"key": "client",     "label": "Espace Client"},
                    {"key": "progress",   "label": "Suivi"},
                ],
            },
            "de": {
                "eyebrow": "MOOD for DESIGN",
                "headline_1": "Vom Kontakt",
                "headline_2": "zum Projekt.",
                "headline_3": "Zur Übergabe.",
                "subheading": "Ein redaktioneller Arbeitsbereich für Studios, Marken und Kunden — vom ersten Moodboard bis zur finalen Übergabe.",
                "cta_primary":   {"text": "Demo buchen", "href": "/start-studio"},
                "cta_secondary": {"text": "In Aktion sehen", "href": "#flow"},
                "chips": [
                    {"key": "lead",       "label": "Lead-Erfassung"},
                    {"key": "moodboards", "label": "Moodboards"},
                    {"key": "projects",   "label": "Projekte"},
                    {"key": "client",     "label": "Kunden-Portal"},
                    {"key": "progress",   "label": "Fortschritt"},
                ],
            },
            "es": {
                "eyebrow": "MOOD for DESIGN",
                "headline_1": "Del Contacto",
                "headline_2": "al Proyecto.",
                "headline_3": "A la Entrega.",
                "subheading": "Un espacio editorial único para estudios, marcas y clientes. Del primer moodboard a la entrega final.",
                "cta_primary":   {"text": "Reservar Demo", "href": "/start-studio"},
                "cta_secondary": {"text": "Ver cómo funciona", "href": "#flow"},
                "chips": [
                    {"key": "lead",       "label": "Captación"},
                    {"key": "moodboards", "label": "Moodboards"},
                    {"key": "projects",   "label": "Proyectos"},
                    {"key": "client",     "label": "Portal Cliente"},
                    {"key": "progress",   "label": "Progreso"},
                ],
            },
            "en-uk": None,  # falls back to en-us
        },
    },

    # METRICS --------------------------------------------------------------
    {
        "id": "home-metrics",
        "type": "metrics_strip",
        "sort": 1,
        "settings": {},
        "content": {
            "en-us": {
                "eyebrow": "Measured Impact",
                "headline": "What studios who use MOOD report after six months.",
                "metrics": [
                    {"value": "+38%",  "label": "Project Velocity", "description": "Lead-to-delivery turnaround", "tone": "positive"},
                    {"value": "-45%",  "label": "Admin Overhead",   "description": "Hours spent on coordination", "tone": "negative"},
                    {"value": "+92%",  "label": "Client Approval",  "description": "First-round moodboard acceptance", "tone": "highlight"},
                    {"value": "4.9/5", "label": "Studio Rating",    "description": "Avg. rating across active studios", "tone": "rating"},
                ],
            },
            "it": {
                "eyebrow": "Risultati Misurati",
                "headline": "Cosa riportano gli studi MOOD dopo sei mesi.",
                "metrics": [
                    {"value": "+38%",  "label": "Velocità Progetti", "description": "Dal contatto alla consegna", "tone": "positive"},
                    {"value": "-45%",  "label": "Carico Amministrativo", "description": "Ore di coordinamento", "tone": "negative"},
                    {"value": "+92%",  "label": "Approvazione Clienti", "description": "Moodboard accettati al primo invio", "tone": "highlight"},
                    {"value": "4.9/5", "label": "Valutazione Studi", "description": "Media degli studi attivi", "tone": "rating"},
                ],
            },
            "fr": {"eyebrow": "Impact Mesuré", "headline": "Ce que rapportent les studios MOOD après six mois.",
                "metrics": [
                    {"value": "+38%",  "label": "Vélocité Projet", "tone": "positive"},
                    {"value": "-45%",  "label": "Charge Admin", "tone": "negative"},
                    {"value": "+92%",  "label": "Approbation Client", "tone": "highlight"},
                    {"value": "4.9/5", "label": "Note Studio", "tone": "rating"},
                ]},
            "de": {"eyebrow": "Gemessene Wirkung", "headline": "Was Studios mit MOOD nach sechs Monaten berichten.",
                "metrics": [
                    {"value": "+38%",  "label": "Projekt-Tempo", "tone": "positive"},
                    {"value": "-45%",  "label": "Admin-Aufwand", "tone": "negative"},
                    {"value": "+92%",  "label": "Kundenfreigabe", "tone": "highlight"},
                    {"value": "4.9/5", "label": "Studio-Bewertung", "tone": "rating"},
                ]},
            "es": {"eyebrow": "Impacto Medido", "headline": "Lo que reportan los estudios MOOD tras seis meses.",
                "metrics": [
                    {"value": "+38%",  "label": "Velocidad de Proyecto", "tone": "positive"},
                    {"value": "-45%",  "label": "Carga Administrativa", "tone": "negative"},
                    {"value": "+92%",  "label": "Aprobación Cliente", "tone": "highlight"},
                    {"value": "4.9/5", "label": "Valoración Estudio", "tone": "rating"},
                ]},
        },
    },

    # SPLIT — Everything in one flow --------------------------------------
    {
        "id": "home-flow",
        "type": "split_story",
        "sort": 2,
        "settings": {
            "image_position": "right",
            "image_url": DASH_IMG,
            "image_alt": "MOOD dashboard preview",
            "dark": True,
        },
        "content": {
            "en-us": {
                "overline": "Everything in one flow",
                "headline": "Where studios run the\nentire client journey.",
                "body": "Replace seven tools with one editorial workspace. Mood boards, contracts, deliveries, payments and client portals — all under your studio's brand.",
                "bullets": [
                    "Visual project timelines with milestones",
                    "Materials & supplier ledger built-in",
                    "Client portal with shareable mood boards",
                    "Quotes, contracts and payments in one place",
                ],
                "cta": {"text": "Explore the Platform", "href": "/platform"},
            },
            "it": {
                "overline": "Tutto in un unico flusso",
                "headline": "Dove gli studi gestiscono\nl'intero ciclo cliente.",
                "body": "Sostituisci sette strumenti con uno spazio editoriale unico. Moodboard, contratti, consegne, pagamenti e portale cliente — tutto sotto il brand del tuo studio.",
                "bullets": [
                    "Timeline visuali con milestone",
                    "Registro materiali e fornitori integrato",
                    "Portale cliente con moodboard condivisibili",
                    "Preventivi, contratti e pagamenti in un solo posto",
                ],
                "cta": {"text": "Esplora la Piattaforma", "href": "/platform"},
            },
            "fr": {
                "overline": "Tout dans un seul flux",
                "headline": "Où les studios gèrent\ntout le parcours client.",
                "body": "Remplacez sept outils par un espace éditorial unique.",
                "bullets": ["Frises visuelles avec jalons", "Registre matériaux & fournisseurs", "Portail client avec moodboards", "Devis, contrats et paiements unifiés"],
                "cta": {"text": "Explorer la Plateforme", "href": "/platform"},
            },
            "de": {
                "overline": "Alles in einem Flow",
                "headline": "Wo Studios den gesamten\nKunden-Workflow steuern.",
                "body": "Sieben Tools ersetzen — durch einen redaktionellen Arbeitsbereich.",
                "bullets": ["Visuelle Projekt-Timelines mit Meilensteinen", "Integriertes Material- & Lieferantenregister", "Kunden-Portal mit teilbaren Moodboards", "Angebote, Verträge und Zahlungen vereint"],
                "cta": {"text": "Plattform entdecken", "href": "/platform"},
            },
            "es": {
                "overline": "Todo en un solo flujo",
                "headline": "Donde los estudios gestionan\ntodo el recorrido del cliente.",
                "body": "Reemplaza siete herramientas con un espacio editorial único.",
                "bullets": ["Líneas de tiempo con hitos", "Registro de materiales y proveedores", "Portal cliente con moodboards", "Presupuestos, contratos y pagos unificados"],
                "cta": {"text": "Explorar la Plataforma", "href": "/platform"},
            },
        },
    },

    # PROCESS STEPS — Client Journey -------------------------------------
    {
        "id": "home-journey",
        "type": "process_steps",
        "sort": 3,
        "settings": {"dark": True},
        "content": {
            "en-us": {
                "overline": "The Client Journey",
                "headline": "Six moves. One refined process.",
                "body": "From the first inquiry to the moment your client steps into the finished space — every phase orchestrated, every decision documented.",
                "steps": [
                    {"title": "Lead",       "description": "Capture inquiries from your site, social and referrals — auto-qualified."},
                    {"title": "Discovery",  "description": "Brief, budget and timeline in a single editorial intake."},
                    {"title": "Moodboard",  "description": "Collaborative boards your client approves with one click."},
                    {"title": "Concept",    "description": "Plans, renders and material palettes shipped from one place."},
                    {"title": "Delivery",   "description": "Suppliers, logistics and on-site progress — all tracked."},
                    {"title": "Handover",   "description": "Final walkthrough, archive and post-care under your brand."},
                ],
            },
            "it": {
                "overline": "Il Percorso del Cliente",
                "headline": "Sei passaggi. Un processo raffinato.",
                "body": "Dal primo contatto fino al momento in cui il tuo cliente entra nello spazio finito — ogni fase orchestrata, ogni decisione documentata.",
                "steps": [
                    {"title": "Contatto",   "description": "Acquisisci richieste da sito, social e referral — pre-qualificate."},
                    {"title": "Discovery",  "description": "Brief, budget e timeline in un unico intake editoriale."},
                    {"title": "Moodboard",  "description": "Board collaborative che il cliente approva in un click."},
                    {"title": "Concept",    "description": "Piante, render e palette materiali da un unico spazio."},
                    {"title": "Delivery",   "description": "Fornitori, logistica e avanzamento di cantiere tracciati."},
                    {"title": "Consegna",   "description": "Walkthrough finale, archivio e post-cura nel tuo brand."},
                ],
            },
            "fr": {
                "overline": "Le Parcours Client",
                "headline": "Six étapes. Un processus raffiné.",
                "body": "Du premier contact à la livraison finale, chaque phase orchestrée.",
                "steps": [
                    {"title": "Contact",    "description": "Capter les demandes — pré-qualifiées."},
                    {"title": "Découverte", "description": "Brief, budget et calendrier réunis."},
                    {"title": "Moodboard",  "description": "Boards collaboratifs validés en un clic."},
                    {"title": "Concept",    "description": "Plans, rendus et matériaux unifiés."},
                    {"title": "Livraison",  "description": "Fournisseurs et chantier suivis."},
                    {"title": "Remise",     "description": "Visite finale et archive sous votre marque."},
                ],
            },
            "de": {
                "overline": "Die Kunden-Reise",
                "headline": "Sechs Schritte. Ein redaktioneller Prozess.",
                "body": "Vom ersten Kontakt bis zur Übergabe — jede Phase orchestriert.",
                "steps": [
                    {"title": "Kontakt",     "description": "Anfragen vorqualifiziert erfassen."},
                    {"title": "Discovery",   "description": "Briefing, Budget und Zeitplan vereint."},
                    {"title": "Moodboard",   "description": "Kollaborative Boards mit einem Klick."},
                    {"title": "Konzept",     "description": "Pläne, Renderings, Materialien vereint."},
                    {"title": "Umsetzung",   "description": "Lieferanten und Baustellen verfolgt."},
                    {"title": "Übergabe",    "description": "Finale Tour und Archiv unter Ihrer Marke."},
                ],
            },
            "es": {
                "overline": "El Recorrido del Cliente",
                "headline": "Seis pasos. Un proceso refinado.",
                "body": "Del primer contacto a la entrega — cada fase orquestada.",
                "steps": [
                    {"title": "Contacto",     "description": "Captura solicitudes precalificadas."},
                    {"title": "Descubrimiento","description": "Briefing, presupuesto y calendario unificados."},
                    {"title": "Moodboard",    "description": "Boards aprobados con un clic."},
                    {"title": "Concepto",     "description": "Planos, renders y materiales unificados."},
                    {"title": "Entrega",      "description": "Proveedores y obra rastreados."},
                    {"title": "Cierre",       "description": "Recorrido final y archivo bajo tu marca."},
                ],
            },
        },
    },

    # PROJECT SHOWCASE ----------------------------------------------------
    {
        "id": "home-projects",
        "type": "project_showcase",
        "sort": 4,
        "settings": {"columns": 4, "background": "#F5F2EC"},
        "content": {
            "en-us": {
                "overline": "Real Projects",
                "headline": "Studios who deliver beautifully.",
                "body": "From private villas to luxury showrooms — a glimpse of the work created on MOOD.",
                "projects": [
                    {"title": "Villa Riviera",  "location": "Côte d'Azur, FR", "style": "Residential",  "image": PROJ_IMAGES[0]},
                    {"title": "Maison Otto",    "location": "Antwerp, BE",     "style": "Apartment",    "image": PROJ_IMAGES[1]},
                    {"title": "Studio Lumen",   "location": "Milan, IT",       "style": "Showroom",     "image": PROJ_IMAGES[2]},
                    {"title": "House Kintsugi", "location": "Kyoto, JP",       "style": "Architecture", "image": PROJ_IMAGES[3]},
                ],
            },
            "it": {
                "overline": "Progetti Reali",
                "headline": "Studi che consegnano bellezza.",
                "body": "Dalle ville private agli showroom di lusso — uno sguardo al lavoro creato su MOOD.",
                "projects": [
                    {"title": "Villa Riviera",  "location": "Costa Azzurra, FR", "style": "Residenziale", "image": PROJ_IMAGES[0]},
                    {"title": "Maison Otto",    "location": "Anversa, BE",       "style": "Appartamento", "image": PROJ_IMAGES[1]},
                    {"title": "Studio Lumen",   "location": "Milano, IT",        "style": "Showroom",     "image": PROJ_IMAGES[2]},
                    {"title": "House Kintsugi", "location": "Kyoto, JP",         "style": "Architettura", "image": PROJ_IMAGES[3]},
                ],
            },
            "fr": {
                "overline": "Projets Réels",
                "headline": "Des studios qui livrent la beauté.",
                "projects": [
                    {"title": "Villa Riviera",  "location": "Côte d'Azur, FR", "style": "Résidentiel", "image": PROJ_IMAGES[0]},
                    {"title": "Maison Otto",    "location": "Anvers, BE",      "style": "Appartement", "image": PROJ_IMAGES[1]},
                    {"title": "Studio Lumen",   "location": "Milan, IT",       "style": "Showroom",    "image": PROJ_IMAGES[2]},
                    {"title": "House Kintsugi", "location": "Kyoto, JP",       "style": "Architecture","image": PROJ_IMAGES[3]},
                ],
            },
            "de": {
                "overline": "Echte Projekte",
                "headline": "Studios, die Schönheit liefern.",
                "projects": [
                    {"title": "Villa Riviera",  "location": "Côte d'Azur, FR", "style": "Wohnen",        "image": PROJ_IMAGES[0]},
                    {"title": "Maison Otto",    "location": "Antwerpen, BE",   "style": "Apartment",     "image": PROJ_IMAGES[1]},
                    {"title": "Studio Lumen",   "location": "Mailand, IT",     "style": "Showroom",      "image": PROJ_IMAGES[2]},
                    {"title": "House Kintsugi", "location": "Kyoto, JP",       "style": "Architektur",   "image": PROJ_IMAGES[3]},
                ],
            },
            "es": {
                "overline": "Proyectos Reales",
                "headline": "Estudios que entregan belleza.",
                "projects": [
                    {"title": "Villa Riviera",  "location": "Costa Azul, FR", "style": "Residencial",   "image": PROJ_IMAGES[0]},
                    {"title": "Maison Otto",    "location": "Amberes, BE",    "style": "Apartamento",   "image": PROJ_IMAGES[1]},
                    {"title": "Studio Lumen",   "location": "Milán, IT",      "style": "Showroom",      "image": PROJ_IMAGES[2]},
                    {"title": "House Kintsugi", "location": "Kyoto, JP",      "style": "Arquitectura",  "image": PROJ_IMAGES[3]},
                ],
            },
        },
    },

    # PRESS LOGOS ---------------------------------------------------------
    {
        "id": "home-press",
        "type": "press_logos",
        "sort": 5,
        "settings": {"dark": False},
        "content": {
            "en-us": {
                "overline": "Used and loved by studios featured in",
                "logos": [
                    {"name": "ELLE Décor",            "italic": False},
                    {"name": "Architectural Digest"},
                    {"name": "Dezeen",                "uppercase": True},
                    {"name": "Design Milk"},
                    {"name": "Interior Design"},
                    {"name": "Frame"},
                    {"name": "Wallpaper",             "starred": True},
                ],
            },
            "it": {"overline": "Utilizzato e amato da studi citati in",
                "logos": [
                    {"name": "ELLE Décor"}, {"name": "Architectural Digest"}, {"name": "Dezeen", "uppercase": True},
                    {"name": "Design Milk"}, {"name": "Interior Design"}, {"name": "Frame"}, {"name": "Wallpaper", "starred": True},
                ]},
            "fr": {"overline": "Utilisé et aimé par des studios présentés dans",
                "logos": [
                    {"name": "ELLE Décor"}, {"name": "Architectural Digest"}, {"name": "Dezeen", "uppercase": True},
                    {"name": "Design Milk"}, {"name": "Interior Design"}, {"name": "Frame"}, {"name": "Wallpaper", "starred": True},
                ]},
            "de": {"overline": "Genutzt und geliebt von Studios in",
                "logos": [
                    {"name": "ELLE Décor"}, {"name": "Architectural Digest"}, {"name": "Dezeen", "uppercase": True},
                    {"name": "Design Milk"}, {"name": "Interior Design"}, {"name": "Frame"}, {"name": "Wallpaper", "starred": True},
                ]},
            "es": {"overline": "Usado y amado por estudios destacados en",
                "logos": [
                    {"name": "ELLE Décor"}, {"name": "Architectural Digest"}, {"name": "Dezeen", "uppercase": True},
                    {"name": "Design Milk"}, {"name": "Interior Design"}, {"name": "Frame"}, {"name": "Wallpaper", "starred": True},
                ]},
        },
    },

    # CTA -----------------------------------------------------------------
    {
        "id": "home-cta",
        "type": "cta_section",
        "sort": 6,
        "settings": {"background_image": CTA_BG, "dim": 0.6, "centered": True},
        "content": {
            "en-us": {
                "overline": "Begin your editorial workspace",
                "headline": "The next great studio\nstarts here.",
                "body": "Join the studios already shaping the future of interior design — one editorial workspace at a time.",
                "cta_primary":   {"text": "Book a Demo",   "href": "/start-studio"},
                "cta_secondary": {"text": "Talk to Sales", "href": "/contact"},
            },
            "it": {
                "overline": "Inizia il tuo spazio editoriale",
                "headline": "Il prossimo grande studio\ninizia qui.",
                "body": "Unisciti agli studi che stanno già definendo il futuro dell'interior design.",
                "cta_primary":   {"text": "Prenota una Demo", "href": "/start-studio"},
                "cta_secondary": {"text": "Parla con Sales",  "href": "/contact"},
            },
            "fr": {
                "overline": "Commencez votre espace éditorial",
                "headline": "Le prochain grand studio\ncommence ici.",
                "body": "Rejoignez les studios qui définissent l'avenir du design d'intérieur.",
                "cta_primary":   {"text": "Réserver une Démo", "href": "/start-studio"},
                "cta_secondary": {"text": "Parler à Sales",     "href": "/contact"},
            },
            "de": {
                "overline": "Starten Sie Ihren redaktionellen Arbeitsbereich",
                "headline": "Das nächste große Studio\nbeginnt hier.",
                "body": "Treten Sie den Studios bei, die die Zukunft des Interior Designs prägen.",
                "cta_primary":   {"text": "Demo buchen",      "href": "/start-studio"},
                "cta_secondary": {"text": "Mit Sales sprechen","href": "/contact"},
            },
            "es": {
                "overline": "Comienza tu espacio editorial",
                "headline": "El próximo gran estudio\nempieza aquí.",
                "body": "Únete a los estudios que ya están definiendo el futuro del diseño de interiores.",
                "cta_primary":   {"text": "Reservar Demo",    "href": "/start-studio"},
                "cta_secondary": {"text": "Hablar con Ventas","href": "/contact"},
            },
        },
    },
]


async def main():
    url = os.environ['SESSION_POOLER_URL']
    conn = await asyncpg.connect(url, command_timeout=60)
    try:
        # Get tenant_id + home page_id from DB
        tenant = await conn.fetchrow("SELECT id FROM tenants WHERE slug = $1", CORP_SLUG)
        if not tenant:
            raise SystemExit(f"Tenant '{CORP_SLUG}' not found")
        tenant_id = tenant['id']
        page = await conn.fetchrow("SELECT id FROM cms_pages WHERE tenant_id = $1 AND page_key = 'home'", tenant_id)
        if not page:
            raise SystemExit("Home page not found")
        page_id = page['id']
        print(f"tenant={tenant_id}  home_page={page_id}")

        # Update home SEO meta for new design
        new_seo = {
            "en-us": {
                "title": "MOOD for DESIGN — From Lead to Project. To Delivery.",
                "description": "The editorial operating system for architecture & interior design studios. From the first moodboard to the final handover.",
                "og_title": "MOOD for DESIGN",
                "og_description": "From Lead to Project. To Delivery.",
            },
            "it": {
                "title": "MOOD for DESIGN — Dal Contatto al Progetto. Alla Consegna.",
                "description": "Il sistema operativo editoriale per gli studi di architettura e interior design. Dal primo moodboard alla consegna finale.",
            },
        }
        await conn.execute(
            "UPDATE cms_pages SET locale_meta = $1::jsonb, updated_at = NOW() WHERE id = $2",
            json.dumps(new_seo), page_id,
        )

        # Hide ALL existing visible home sections (soft archive)
        await conn.execute(
            "UPDATE cms_sections SET visible = false, updated_at = NOW() WHERE page_id = $1 AND deleted_at IS NULL",
            page_id,
        )

        # Upsert new sections
        for sec in SECTIONS:
            sid = section_uuid('home', sec['id'])
            # build locale_content with full locale set (fallback en-us for missing)
            base_en = sec['content'].get('en-us', {})
            locale_content = {}
            for loc in LOCALES:
                v = sec['content'].get(loc)
                locale_content[loc] = v if v else base_en

            await conn.execute(
                """
                INSERT INTO cms_sections
                  (id, tenant_id, page_id, section_type, sort_order, visible,
                   locale_content, settings, asset_refs, created_at, updated_at)
                VALUES
                  ($1, $2, $3, $4, $5, true,
                   $6::jsonb, $7::jsonb, ARRAY[]::uuid[], NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                  section_type   = EXCLUDED.section_type,
                  sort_order     = EXCLUDED.sort_order,
                  visible        = true,
                  locale_content = EXCLUDED.locale_content,
                  settings       = EXCLUDED.settings,
                  updated_at     = NOW()
                """,
                sid, tenant_id, page_id, sec['type'], sec['sort'],
                json.dumps(locale_content), json.dumps(sec['settings']),
            )
            print(f"  ✓ {sec['type']:20s}  sort={sec['sort']}  id={sid[:8]}…")

        # Re-publish home (rebuilds published_json snapshot via API would be ideal,
        # but we also flush cache via /api/corporate/cache/invalidate from frontend init).
        await conn.execute(
            "UPDATE cms_pages SET status='published', published_at = NOW(), updated_at = NOW() WHERE id = $1",
            page_id,
        )
        print("─── Done. New dark editorial home seeded. ───")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
