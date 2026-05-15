"""
MOOD for DESIGN — Corporate Website Seed Data
SQL-compatible structure (Supabase-ready).
All entities mirror the schema.sql structure.
"""

# ==============================================================================
# TENANTS
# ==============================================================================
TENANTS = [
    {
        "id": "t-mood-corporate",
        "slug": "mood-corporate",
        "name": "MOOD for DESIGN",
        "domain": "www.moodfordesign.com",
        "config": {
            "theme": "editorial-luxury",
            "primary_locale": "en-us",
            "locales_enabled": ["it", "en-us", "en-uk", "fr", "de", "es"],
            "logo_url": "https://customer-assets.emergentagent.com/job_editorial-platform-4/artifacts/kfe510tt_Artboard%201.png",
            "brand_color": "#3DDAD0",
            "font_heading": "Cormorant Garamond",
            "font_body": "Manrope",
        },
        "is_active": True,
    }
]

# ==============================================================================
# LOCALES
# ==============================================================================
LOCALES = [
    {"code": "it", "name": "Italiano", "flag": "IT", "is_active": True, "is_default": False},
    {"code": "en-us", "name": "English (US)", "flag": "EN", "is_active": True, "is_default": True},
    {"code": "en-uk", "name": "English (UK)", "flag": "EN", "is_active": True, "is_default": False},
    {"code": "fr", "name": "Français", "flag": "FR", "is_active": True, "is_default": False},
    {"code": "de", "name": "Deutsch", "flag": "DE", "is_active": True, "is_default": False},
    {"code": "es", "name": "Español", "flag": "ES", "is_active": True, "is_default": False},
]

# ==============================================================================
# NAVIGATION — mood-corporate
# ==============================================================================
NAVIGATION = {
    "tenant_id": "t-mood-corporate",
    "main": [
        {
            "id": "nav-platform", "key": "platform", "href": "/platform", "order": 1,
            "labels": {"it": "Piattaforma", "en-us": "Platform", "en-uk": "Platform",
                       "fr": "Plateforme", "de": "Plattform", "es": "Plataforma"}
        },
        {
            "id": "nav-studios", "key": "for-studios", "href": "/for-studios", "order": 2,
            "labels": {"it": "Per gli Studi", "en-us": "For Studios", "en-uk": "For Studios",
                       "fr": "Pour les Studios", "de": "Für Studios", "es": "Para Estudios"}
        },
        {
            "id": "nav-retailers", "key": "for-retailers", "href": "/for-retailers", "order": 3,
            "labels": {"it": "Per i Retailer", "en-us": "For Retailers", "en-uk": "For Retailers",
                       "fr": "Pour les Détaillants", "de": "Für Händler", "es": "Para Minoristas"}
        },
        {
            "id": "nav-templates", "key": "templates", "href": "/templates", "order": 4,
            "labels": {"it": "Template", "en-us": "Templates", "en-uk": "Templates",
                       "fr": "Modèles", "de": "Vorlagen", "es": "Plantillas"}
        },
        {
            "id": "nav-pricing", "key": "pricing", "href": "/pricing", "order": 5,
            "labels": {"it": "Prezzi", "en-us": "Pricing", "en-uk": "Pricing",
                       "fr": "Tarifs", "de": "Preise", "es": "Precios"}
        },
        {
            "id": "nav-journal", "key": "journal", "href": "/journal", "order": 6,
            "labels": {"it": "Journal", "en-us": "Journal", "en-uk": "Journal",
                       "fr": "Journal", "de": "Journal", "es": "Revista"}
        },
        {
            "id": "nav-about", "key": "about", "href": "/about", "order": 7,
            "labels": {"it": "Chi siamo", "en-us": "About", "en-uk": "About",
                       "fr": "À propos", "de": "Über uns", "es": "Acerca de"}
        },
    ],
    "cta": {
        "id": "nav-cta", "key": "start-studio", "href": "/start-studio",
        "labels": {"it": "Crea il tuo Studio", "en-us": "Start Your Studio",
                   "en-uk": "Start Your Studio", "fr": "Créer votre Studio",
                   "de": "Studio erstellen", "es": "Crear tu Studio"}
    },
    "footer": {
        "platform": {
            "heading": {"it": "Piattaforma", "en-us": "Platform"},
            "links": [
                {"label": {"it": "Panoramica", "en-us": "Overview"}, "href": "/platform"},
                {"label": {"it": "Funzionalità", "en-us": "Features"}, "href": "/platform#features"},
                {"label": {"it": "Integrazioni", "en-us": "Integrations"}, "href": "/platform#integrations"},
                {"label": {"it": "Sicurezza", "en-us": "Security"}, "href": "/platform#security"},
                {"label": {"it": "Aggiornamenti", "en-us": "Updates"}, "href": "/platform#updates"},
            ]
        },
        "resources": {
            "heading": {"it": "Risorse", "en-us": "Resources"},
            "links": [
                {"label": {"it": "Template", "en-us": "Templates"}, "href": "/templates"},
                {"label": {"it": "Centro Assistenza", "en-us": "Help Center"}, "href": "/help"},
                {"label": {"it": "Guide", "en-us": "Guides"}, "href": "/guides"},
                {"label": {"it": "API Docs", "en-us": "API Docs"}, "href": "/api-docs"},
                {"label": {"it": "Status", "en-us": "Status"}, "href": "/status"},
            ]
        },
        "company": {
            "heading": {"it": "Azienda", "en-us": "Company"},
            "links": [
                {"label": {"it": "Chi siamo", "en-us": "About Us"}, "href": "/about"},
                {"label": {"it": "Carriere", "en-us": "Careers"}, "href": "/careers"},
                {"label": {"it": "Journal", "en-us": "Journal"}, "href": "/journal"},
                {"label": {"it": "Stampa", "en-us": "Press"}, "href": "/press"},
                {"label": {"it": "Contatti", "en-us": "Contact"}, "href": "/contact"},
            ]
        }
    }
}

# ==============================================================================
# HERO IMAGE ASSETS
# ==============================================================================
HERO_IMAGE = "https://static.prod-images.emergentagent.com/jobs/8710080e-5188-4ec5-bd65-70ec654c95f9/images/47b99628f6050f1aa60c175bf389e79b1bfe0f2d1ce288c4f1f637d3b0df271b.png"
PLATFORM_IMAGE = "https://images.unsplash.com/photo-1700474568247-2bf81611b293?w=1400&q=80"
DARK_SECTION_IMAGE = "https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?w=800&q=80"
ABOUT_IMAGE = "https://images.unsplash.com/photo-1598367815092-a2c0cbc1ea3d?w=1400&q=80"
STUDIO_IMAGE = "https://images.unsplash.com/photo-1742440711413-da7afb0f4930?w=1200&q=80"
MATERIALS_IMAGE = "https://static.prod-images.emergentagent.com/jobs/8710080e-5188-4ec5-bd65-70ec654c95f9/images/a1a0631e310012f11b40f292a4e5d0ad766e9bacca39cc796c3853b19daa65ed.png"

# ==============================================================================
# PAGES WITH SECTIONS — mood-corporate tenant
# ==============================================================================
PAGES = {
    "home": {
        "id": "p-home",
        "tenant_id": "t-mood-corporate",
        "slug": "home",
        "template": "corporate-default",
        "is_published": True,
        "seo": {
            "en-us": {
                "title": "MOOD for DESIGN — Inspiration. Design. Solutions.",
                "description": "MOOD is the operating system for architecture and design. Connect studios, brands and clients in one seamless digital environment.",
                "og_title": "MOOD for DESIGN",
                "og_description": "The operating system for architecture and design.",
            },
            "it": {
                "title": "MOOD for DESIGN — Ispirazione. Design. Soluzioni.",
                "description": "MOOD è il sistema operativo per l'architettura e il design.",
                "og_title": "MOOD for DESIGN",
                "og_description": "Il sistema operativo per l'architettura e il design.",
            }
        },
        "sections": [
            {
                "id": "s-home-hero",
                "type": "editorial_hero",
                "display_order": 0,
                "is_enabled": True,
                "config": {
                    "layout": "split-right",
                    "image_url": HERO_IMAGE,
                    "image_alt": "Luxury architectural interior",
                    "full_height": True,
                },
                "content": {
                    "it": {
                        "eyebrow": "Il sistema operativo per il design",
                        "headline_1": "Ispirazione.",
                        "headline_2": "Design.",
                        "headline_3": "Soluzioni.",
                        "subheading": "MOOD è il sistema operativo per il mondo dell'architettura e del design. Dove le relazioni diventano progetti e le idee diventano realtà.",
                        "cta_primary": {"text": "Scopri la Piattaforma", "href": "/platform"},
                        "cta_secondary": {"text": "Guarda in azione", "href": "#cinematic"},
                    },
                    "en-us": {
                        "eyebrow": "The operating system for design",
                        "headline_1": "Inspiration.",
                        "headline_2": "Design.",
                        "headline_3": "Solutions.",
                        "subheading": "MOOD is the operating system for the architecture and design world. Where relationships become projects and ideas become reality.",
                        "cta_primary": {"text": "Discover the Platform", "href": "/platform"},
                        "cta_secondary": {"text": "See it in action", "href": "#cinematic"},
                    },
                    "en-uk": {
                        "eyebrow": "The operating system for design",
                        "headline_1": "Inspiration.",
                        "headline_2": "Design.",
                        "headline_3": "Solutions.",
                        "subheading": "MOOD is the operating system for the architecture and design world. Where relationships become projects and ideas become reality.",
                        "cta_primary": {"text": "Discover the Platform", "href": "/platform"},
                        "cta_secondary": {"text": "See it in action", "href": "#cinematic"},
                    },
                    "fr": {
                        "eyebrow": "Le système d'exploitation pour le design",
                        "headline_1": "Inspiration.",
                        "headline_2": "Design.",
                        "headline_3": "Solutions.",
                        "subheading": "MOOD est le système d'exploitation pour l'architecture et le design. Où les relations deviennent des projets.",
                        "cta_primary": {"text": "Découvrir la Plateforme", "href": "/platform"},
                        "cta_secondary": {"text": "Voir en action", "href": "#cinematic"},
                    },
                    "de": {
                        "eyebrow": "Das Betriebssystem für Design",
                        "headline_1": "Inspiration.",
                        "headline_2": "Design.",
                        "headline_3": "Lösungen.",
                        "subheading": "MOOD ist das Betriebssystem für die Architektur- und Designwelt. Wo Beziehungen zu Projekten werden.",
                        "cta_primary": {"text": "Plattform entdecken", "href": "/platform"},
                        "cta_secondary": {"text": "In Aktion sehen", "href": "#cinematic"},
                    },
                    "es": {
                        "eyebrow": "El sistema operativo para el diseño",
                        "headline_1": "Inspiración.",
                        "headline_2": "Diseño.",
                        "headline_3": "Soluciones.",
                        "subheading": "MOOD es el sistema operativo para el mundo de la arquitectura y el diseño. Donde las relaciones se convierten en proyectos.",
                        "cta_primary": {"text": "Descubrir la Plataforma", "href": "/platform"},
                        "cta_secondary": {"text": "Ver en acción", "href": "#cinematic"},
                    },
                }
            },
            {
                "id": "s-home-logos",
                "type": "logos_wall",
                "display_order": 1,
                "is_enabled": True,
                "config": {
                    "brands": ["Molteni &C", "Poliform", "Minotti", "Giorgetti", "FENDI Casa", "B&B Italia", "Cassina", "Flexform"]
                },
                "content": {
                    "it": {"eyebrow": "Scelti dalle migliori studi e brand del settore"},
                    "en-us": {"eyebrow": "Trusted by leading studios and brands"},
                    "en-uk": {"eyebrow": "Trusted by leading studios and brands"},
                    "fr": {"eyebrow": "Choisi par les meilleurs studios et marques"},
                    "de": {"eyebrow": "Von führenden Studios und Marken gewählt"},
                    "es": {"eyebrow": "Elegido por los mejores estudios y marcas"},
                }
            },
            {
                "id": "s-home-platform",
                "type": "split_story",
                "display_order": 2,
                "is_enabled": True,
                "config": {
                    "image_position": "right",
                    "image_url": PLATFORM_IMAGE,
                    "background": "#FFFFFF",
                },
                "content": {
                    "it": {
                        "overline": "La Piattaforma",
                        "headline": "Una piattaforma.\nOgni connessione.",
                        "body": "Dal primo sopralluogo fino all'installazione finale. MOOD connette designer, showroom, brand e clienti in un unico ambiente digitale intelligente.",
                        "cta": {"text": "Esplora la Piattaforma", "href": "/platform"},
                    },
                    "en-us": {
                        "overline": "The Platform",
                        "headline": "One platform.\nEvery connection.",
                        "body": "From first inspiration to final installation. MOOD connects designers, showrooms, brands and clients in one seamless digital environment.",
                        "cta": {"text": "Explore the Platform", "href": "/platform"},
                    },
                    "en-uk": {
                        "overline": "The Platform",
                        "headline": "One platform.\nEvery connection.",
                        "body": "From first inspiration to final installation. MOOD connects designers, showrooms, brands and clients in one seamless digital environment.",
                        "cta": {"text": "Explore the Platform", "href": "/platform"},
                    },
                    "fr": {
                        "overline": "La Plateforme",
                        "headline": "Une plateforme.\nChaque connexion.",
                        "body": "De la première inspiration à l'installation finale. MOOD connecte designers, showrooms, marques et clients en un seul environnement numérique.",
                        "cta": {"text": "Explorer la Plateforme", "href": "/platform"},
                    },
                    "de": {
                        "overline": "Die Plattform",
                        "headline": "Eine Plattform.\nJede Verbindung.",
                        "body": "Von der ersten Inspiration bis zur endgültigen Installation verbindet MOOD Designer, Showrooms, Marken und Kunden.",
                        "cta": {"text": "Plattform erkunden", "href": "/platform"},
                    },
                    "es": {
                        "overline": "La Plataforma",
                        "headline": "Una plataforma.\nCada conexión.",
                        "body": "Desde la primera inspiración hasta la instalación final. MOOD conecta diseñadores, showrooms, marcas y clientes en un entorno digital fluido.",
                        "cta": {"text": "Explorar la Plataforma", "href": "/platform"},
                    },
                }
            },
            {
                "id": "s-home-features",
                "type": "feature_narrative",
                "display_order": 3,
                "is_enabled": True,
                "config": {
                    "layout": "4-columns",
                    "features": [
                        {
                            "id": "for-studios",
                            "icon": "Building2",
                            "href": "/for-studios",
                            "content": {
                                "it": {"title": "Per gli Studi", "description": "Gestisci progetti, collabora senza sforzo e impressiona i tuoi clienti.", "cta": "Scopri di più"},
                                "en-us": {"title": "For Studios", "description": "Manage projects, collaborate seamlessly and impress your clients.", "cta": "Learn more"},
                                "en-uk": {"title": "For Studios", "description": "Manage projects, collaborate seamlessly and impress your clients.", "cta": "Learn more"},
                                "fr": {"title": "Pour les Studios", "description": "Gérez des projets, collaborez facilement et impressionnez vos clients.", "cta": "En savoir plus"},
                                "de": {"title": "Für Studios", "description": "Projekte verwalten, nahtlos zusammenarbeiten und Kunden beeindrucken.", "cta": "Mehr erfahren"},
                                "es": {"title": "Para Estudios", "description": "Gestiona proyectos, colabora sin esfuerzo e impresiona a tus clientes.", "cta": "Saber más"},
                            }
                        },
                        {
                            "id": "for-retailers",
                            "icon": "Store",
                            "href": "/for-retailers",
                            "content": {
                                "it": {"title": "Per i Retailer", "description": "Presenta le tue collezioni, coinvolgi i designer e fai crescere la tua rete.", "cta": "Scopri di più"},
                                "en-us": {"title": "For Retailers", "description": "Showcase your collections, engage designers and grow your network.", "cta": "Learn more"},
                                "en-uk": {"title": "For Retailers", "description": "Showcase your collections, engage designers and grow your network.", "cta": "Learn more"},
                                "fr": {"title": "Pour les Détaillants", "description": "Présentez vos collections, engagez les designers et développez votre réseau.", "cta": "En savoir plus"},
                                "de": {"title": "Für Händler", "description": "Zeigen Sie Ihre Kollektionen, engagieren Sie Designer und erweitern Sie Ihr Netzwerk.", "cta": "Mehr erfahren"},
                                "es": {"title": "Para Minoristas", "description": "Exhibe tus colecciones, conecta con diseñadores y haz crecer tu red.", "cta": "Saber más"},
                            }
                        },
                        {
                            "id": "templates",
                            "icon": "LayoutTemplate",
                            "href": "/templates",
                            "content": {
                                "it": {"title": "Template", "description": "Lancia la tua presenza digitale con i nostri template professionali.", "cta": "Scopri di più"},
                                "en-us": {"title": "Templates", "description": "Launch your digital presence with our professional website templates.", "cta": "Learn more"},
                                "en-uk": {"title": "Templates", "description": "Launch your digital presence with our professional website templates.", "cta": "Learn more"},
                                "fr": {"title": "Modèles", "description": "Lancez votre présence numérique avec nos modèles de sites professionnels.", "cta": "En savoir plus"},
                                "de": {"title": "Vorlagen", "description": "Starten Sie Ihre digitale Präsenz mit unseren professionellen Website-Vorlagen.", "cta": "Mehr erfahren"},
                                "es": {"title": "Plantillas", "description": "Lanza tu presencia digital con nuestras plantillas de sitios web profesionales.", "cta": "Saber más"},
                            }
                        },
                        {
                            "id": "pricing",
                            "icon": "BarChart3",
                            "href": "/pricing",
                            "content": {
                                "it": {"title": "Prezzi", "description": "Scegli il piano adatto alla tua attività. Scala senza limiti.", "cta": "Scopri di più"},
                                "en-us": {"title": "Pricing", "description": "Choose the plan that fits your business. Scale without limits.", "cta": "Learn more"},
                                "en-uk": {"title": "Pricing", "description": "Choose the plan that fits your business. Scale without limits.", "cta": "Learn more"},
                                "fr": {"title": "Tarifs", "description": "Choisissez le plan adapté à votre entreprise. Évoluez sans limites.", "cta": "En savoir plus"},
                                "de": {"title": "Preise", "description": "Wählen Sie den Plan, der zu Ihrem Unternehmen passt. Skalieren ohne Grenzen.", "cta": "Mehr erfahren"},
                                "es": {"title": "Precios", "description": "Elige el plan que se adapte a tu negocio. Escala sin límites.", "cta": "Saber más"},
                            }
                        },
                    ]
                },
                "content": {}
            },
            {
                "id": "s-home-cinematic",
                "type": "cinematic_quote",
                "display_order": 4,
                "is_enabled": True,
                "config": {
                    "background": "dark",
                    "image_url": DARK_SECTION_IMAGE,
                    "show_features": True,
                    "show_testimonial": True,
                },
                "content": {
                    "it": {
                        "overline": "Progettato per come lavori",
                        "headline": "Progettato per\ncome lavori.",
                        "body": "MOOD riunisce i tuoi progetti, prodotti, contatti e ispirazione in un unico spazio di lavoro intelligente.",
                        "features": ["Progetti & Moodboard", "Libreria Prodotti & Materiali", "Collaborazione Clienti e Team", "Task, Timeline & Calendario"],
                        "quote": "MOOD ha trasformato il modo in cui il nostro studio gestisce progetti e presenta le idee. È semplicemente essenziale.",
                        "quote_author": "Francesca P.",
                        "quote_role": "Studio Founder, Milano",
                    },
                    "en-us": {
                        "overline": "Designed for how you work",
                        "headline": "Designed for\nhow you work.",
                        "body": "MOOD brings together your projects, products, contacts and inspiration in one beautiful, intelligent workspace.",
                        "features": ["Projects & Moodboards", "Product & Material Library", "Client & Team Collaboration", "Tasks, Timeline & Calendar"],
                        "quote": "MOOD has transformed the way our studio manages projects and presents ideas. It's simply essential.",
                        "quote_author": "Francesca P.",
                        "quote_role": "Studio Founder, Milan",
                    },
                    "en-uk": {
                        "overline": "Designed for how you work",
                        "headline": "Designed for\nhow you work.",
                        "body": "MOOD brings together your projects, products, contacts and inspiration in one beautiful, intelligent workspace.",
                        "features": ["Projects & Moodboards", "Product & Material Library", "Client & Team Collaboration", "Tasks, Timeline & Calendar"],
                        "quote": "MOOD has transformed the way our studio manages projects and presents ideas. It's simply essential.",
                        "quote_author": "Francesca P.",
                        "quote_role": "Studio Founder, London",
                    },
                    "fr": {
                        "overline": "Conçu pour votre façon de travailler",
                        "headline": "Conçu pour\nvotre façon de travailler.",
                        "body": "MOOD rassemble vos projets, produits, contacts et inspirations dans un espace de travail magnifique.",
                        "features": ["Projets & Moodboards", "Bibliothèque Produits & Matériaux", "Collaboration Clients & Équipe", "Tâches, Timeline & Calendrier"],
                        "quote": "MOOD a transformé la façon dont notre studio gère les projets et présente les idées.",
                        "quote_author": "Francesca P.",
                        "quote_role": "Studio Founder, Milan",
                    },
                    "de": {
                        "overline": "Designed für Ihre Arbeitsweise",
                        "headline": "Designed für\nIhre Arbeitsweise.",
                        "body": "MOOD bringt Ihre Projekte, Produkte, Kontakte und Inspiration in einem intelligenten Arbeitsbereich zusammen.",
                        "features": ["Projekte & Moodboards", "Produkt- & Materialbibliothek", "Kunden- & Teamzusammenarbeit", "Aufgaben, Timeline & Kalender"],
                        "quote": "MOOD hat die Art und Weise, wie unser Studio Projekte verwaltet, grundlegend verändert.",
                        "quote_author": "Francesca P.",
                        "quote_role": "Studio Founder, Mailand",
                    },
                    "es": {
                        "overline": "Diseñado para tu forma de trabajar",
                        "headline": "Diseñado para\ntu forma de trabajar.",
                        "body": "MOOD reúne tus proyectos, productos, contactos e inspiración en un hermoso espacio de trabajo inteligente.",
                        "features": ["Proyectos & Moodboards", "Biblioteca de Productos y Materiales", "Colaboración con Clientes y Equipo", "Tareas, Timeline y Calendario"],
                        "quote": "MOOD ha transformado la forma en que nuestro estudio gestiona proyectos. Es simplemente esencial.",
                        "quote_author": "Francesca P.",
                        "quote_role": "Studio Founder, Milán",
                    },
                }
            },
            {
                "id": "s-home-cta",
                "type": "cta_section",
                "display_order": 5,
                "is_enabled": True,
                "config": {"background": "teal", "show_logo": True},
                "content": {
                    "it": {
                        "headline": "Pronto ad elevare il tuo brand?",
                        "subheading": "Unisciti alla community di Architettura & Design che usa MOOD.",
                        "cta_primary": {"text": "Crea il tuo Studio", "href": "/start-studio"},
                        "cta_secondary": {"text": "Parla con noi", "href": "/contact"},
                    },
                    "en-us": {
                        "headline": "Ready to elevate your brand?",
                        "subheading": "Join the Architecture & Design community using MOOD.",
                        "cta_primary": {"text": "Start Your Studio", "href": "/start-studio"},
                        "cta_secondary": {"text": "Talk to us", "href": "/contact"},
                    },
                    "en-uk": {
                        "headline": "Ready to elevate your brand?",
                        "subheading": "Join the Architecture & Design community using MOOD.",
                        "cta_primary": {"text": "Start Your Studio", "href": "/start-studio"},
                        "cta_secondary": {"text": "Talk to us", "href": "/contact"},
                    },
                    "fr": {
                        "headline": "Prêt à élever votre marque?",
                        "subheading": "Rejoignez la communauté Architecture & Design qui utilise MOOD.",
                        "cta_primary": {"text": "Créer votre Studio", "href": "/start-studio"},
                        "cta_secondary": {"text": "Parlez-nous", "href": "/contact"},
                    },
                    "de": {
                        "headline": "Bereit, Ihre Marke zu erhöhen?",
                        "subheading": "Werden Sie Teil der Architektur- und Design-Community.",
                        "cta_primary": {"text": "Studio erstellen", "href": "/start-studio"},
                        "cta_secondary": {"text": "Sprechen Sie mit uns", "href": "/contact"},
                    },
                    "es": {
                        "headline": "¿Listo para elevar tu marca?",
                        "subheading": "Únete a la comunidad de Arquitectura y Diseño que usa MOOD.",
                        "cta_primary": {"text": "Crear tu Studio", "href": "/start-studio"},
                        "cta_secondary": {"text": "Habla con nosotros", "href": "/contact"},
                    },
                }
            },
        ]
    },

    "platform": {
        "id": "p-platform",
        "tenant_id": "t-mood-corporate",
        "slug": "platform",
        "template": "corporate-default",
        "is_published": True,
        "seo": {
            "en-us": {"title": "Platform — MOOD for DESIGN", "description": "Discover the MOOD platform for architecture and design studios."},
            "it": {"title": "Piattaforma — MOOD for DESIGN", "description": "Scopri la piattaforma MOOD per studi di architettura e design."},
        },
        "sections": [
            {
                "id": "s-platform-hero",
                "type": "editorial_hero",
                "display_order": 0,
                "is_enabled": True,
                "config": {"layout": "centered", "background": "#F9F9F8"},
                "content": {
                    "en-us": {
                        "eyebrow": "The Platform",
                        "headline_1": "One platform.",
                        "headline_2": "Infinite possibilities.",
                        "subheading": "From project management to brand discovery — MOOD gives architecture and design professionals the tools they need to work beautifully.",
                        "cta_primary": {"text": "Start Free", "href": "/start-studio"},
                        "cta_secondary": {"text": "View Pricing", "href": "/pricing"},
                    },
                    "it": {
                        "eyebrow": "La Piattaforma",
                        "headline_1": "Una piattaforma.",
                        "headline_2": "Possibilità infinite.",
                        "subheading": "Dalla gestione dei progetti alla scoperta dei brand — MOOD offre ai professionisti del design gli strumenti per lavorare al meglio.",
                        "cta_primary": {"text": "Inizia Gratis", "href": "/start-studio"},
                        "cta_secondary": {"text": "Vedi i Prezzi", "href": "/pricing"},
                    },
                }
            },
            {
                "id": "s-platform-metrics",
                "type": "metrics_strip",
                "display_order": 1,
                "is_enabled": True,
                "config": {},
                "content": {
                    "en-us": {
                        "metrics": [
                            {"value": "12,000+", "label": "Design Studios", "description": "Active on the platform"},
                            {"value": "3,200+", "label": "Brand Partners", "description": "Showrooms and manufacturers"},
                            {"value": "180K+", "label": "Products", "description": "In the design library"},
                            {"value": "42", "label": "Countries", "description": "Global reach"},
                        ]
                    },
                    "it": {
                        "metrics": [
                            {"value": "12.000+", "label": "Studi di Design", "description": "Attivi sulla piattaforma"},
                            {"value": "3.200+", "label": "Brand Partner", "description": "Showroom e produttori"},
                            {"value": "180K+", "label": "Prodotti", "description": "Nella libreria design"},
                            {"value": "42", "label": "Paesi", "description": "Reach globale"},
                        ]
                    },
                }
            },
            {
                "id": "s-platform-story1",
                "type": "split_story",
                "display_order": 2,
                "is_enabled": True,
                "config": {
                    "image_position": "left",
                    "image_url": MATERIALS_IMAGE,
                    "background": "#FFFFFF",
                },
                "content": {
                    "en-us": {
                        "overline": "Blueprint Editor",
                        "headline": "Your studio.\nYour brand.",
                        "body": "Blueprint is the visual design editor at the heart of MOOD. Create stunning digital showrooms, client presentations and brand experiences — all without code.",
                        "cta": {"text": "Discover Blueprint", "href": "/blueprint"},
                    },
                    "it": {
                        "overline": "Blueprint Editor",
                        "headline": "Il tuo studio.\nIl tuo brand.",
                        "body": "Blueprint è l'editor visuale al cuore di MOOD. Crea showroom digitali straordinari, presentazioni clienti ed esperienze di brand — senza codice.",
                        "cta": {"text": "Scopri Blueprint", "href": "/blueprint"},
                    },
                }
            },
            {
                "id": "s-platform-cta",
                "type": "cta_section",
                "display_order": 3,
                "is_enabled": True,
                "config": {"background": "dark"},
                "content": {
                    "en-us": {
                        "headline": "The platform built for design relationships.",
                        "subheading": "Join thousands of studios, brands and retailers already using MOOD.",
                        "cta_primary": {"text": "Start Your Studio", "href": "/start-studio"},
                        "cta_secondary": {"text": "View Pricing", "href": "/pricing"},
                    },
                    "it": {
                        "headline": "La piattaforma costruita per le relazioni nel design.",
                        "subheading": "Unisciti a migliaia di studi, brand e retailer che già usano MOOD.",
                        "cta_primary": {"text": "Crea il tuo Studio", "href": "/start-studio"},
                        "cta_secondary": {"text": "Vedi i Prezzi", "href": "/pricing"},
                    },
                }
            },
        ]
    },

    "pricing": {
        "id": "p-pricing",
        "tenant_id": "t-mood-corporate",
        "slug": "pricing",
        "template": "corporate-default",
        "is_published": True,
        "seo": {
            "en-us": {"title": "Pricing — MOOD for DESIGN", "description": "Simple, transparent pricing for studios, brands and retailers."},
            "it": {"title": "Prezzi — MOOD for DESIGN", "description": "Prezzi semplici e trasparenti per studi, brand e retailer."},
        },
        "sections": [
            {
                "id": "s-pricing-hero",
                "type": "editorial_hero",
                "display_order": 0,
                "is_enabled": True,
                "config": {"layout": "centered", "background": "#F9F9F8"},
                "content": {
                    "en-us": {
                        "eyebrow": "Plans & Pricing",
                        "headline_1": "Choose the plan",
                        "headline_2": "that fits your business.",
                        "subheading": "Transparent pricing. No surprises. Scale when you're ready. All plans include a 14-day free trial.",
                    },
                    "it": {
                        "eyebrow": "Piani e Prezzi",
                        "headline_1": "Scegli il piano",
                        "headline_2": "adatto alla tua attività.",
                        "subheading": "Prezzi trasparenti. Nessuna sorpresa. Scala quando sei pronto. Tutti i piani includono 14 giorni di prova gratuita.",
                    },
                }
            },
            {
                "id": "s-pricing-cards",
                "type": "pricing_cards",
                "display_order": 1,
                "is_enabled": True,
                "config": {
                    "show_yearly_toggle": True,
                    "currency": "EUR",
                    "yearly_discount_pct": 20,
                    "plans": [
                        {"id": "starter", "slug": "starter", "price_monthly": 0, "price_yearly": 0, "is_featured": False, "display_order": 0, "badge": None},
                        {"id": "professional", "slug": "professional", "price_monthly": 79, "price_yearly": 759, "is_featured": True, "display_order": 1, "badge": "Most Popular"},
                        {"id": "brand", "slug": "brand", "price_monthly": 199, "price_yearly": 1910, "is_featured": False, "display_order": 2, "badge": None},
                    ]
                },
                "content": {
                    "en-us": {
                        "headline": "Simple, transparent pricing",
                        "plans": {
                            "starter": {
                                "name": "Studio Essentials", "description": "For studios beginning their digital journey.",
                                "cta": "Start Free",
                                "features": ["1 active project", "Basic moodboards", "5 GB storage", "Email support", "Blueprint viewer"]
                            },
                            "professional": {
                                "name": "Studio Professional", "description": "For professional studios ready to grow.",
                                "cta": "Start free trial",
                                "features": ["Unlimited projects", "Advanced moodboards", "50 GB storage", "Full product library", "Team collaboration", "Priority support", "Blueprint editor", "Custom domain"]
                            },
                            "brand": {
                                "name": "Brand & Retailer", "description": "For brands and retailers connecting with top studios.",
                                "cta": "Contact us",
                                "features": ["Everything in Professional", "Verified brand profile", "Unlimited product catalog", "Advanced analytics", "API access", "Dedicated account manager", "Custom integrations", "SLA guarantee"]
                            },
                        }
                    },
                    "it": {
                        "headline": "Prezzi semplici e trasparenti",
                        "plans": {
                            "starter": {
                                "name": "Studio Essentials", "description": "Per studi che iniziano il loro percorso digitale.",
                                "cta": "Inizia Gratis",
                                "features": ["1 progetto attivo", "Moodboard di base", "5 GB storage", "Supporto email", "Blueprint viewer"]
                            },
                            "professional": {
                                "name": "Studio Professional", "description": "Per studi professionali pronti a crescere.",
                                "cta": "Inizia la prova gratuita",
                                "features": ["Progetti illimitati", "Moodboard avanzate", "50 GB storage", "Libreria prodotti completa", "Collaborazione team", "Supporto prioritario", "Blueprint editor", "Custom domain"]
                            },
                            "brand": {
                                "name": "Brand & Retailer", "description": "Per brand e retailer pronti a connettersi con i migliori studi.",
                                "cta": "Contattaci",
                                "features": ["Tutto di Professional", "Profilo brand verificato", "Catalogo prodotti illimitato", "Analytics avanzate", "API access", "Account manager dedicato", "Integrazioni custom", "Garanzia SLA"]
                            },
                        }
                    },
                }
            },
            {
                "id": "s-pricing-faq",
                "type": "faq_accordion",
                "display_order": 2,
                "is_enabled": True,
                "config": {},
                "content": {
                    "en-us": {
                        "headline": "Frequently asked questions",
                        "items": [
                            {"q": "Can I change my plan at any time?", "a": "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately."},
                            {"q": "Is there a free trial?", "a": "Yes, we offer a 14-day free trial for the Professional plan, no credit card required."},
                            {"q": "How does billing work?", "a": "We bill monthly or annually. Annual payment offers a 20% discount compared to monthly."},
                            {"q": "Can I cancel at any time?", "a": "Yes, you can cancel your subscription at any time with no penalties. You retain access until the end of your billing period."},
                            {"q": "What payment methods do you accept?", "a": "We accept all major credit cards (Visa, Mastercard, Amex) and bank transfers for annual plans."},
                            {"q": "Do you offer discounts for agencies?", "a": "Yes, we offer custom pricing for large agencies and studios with 10+ team members. Contact us to discuss."},
                        ]
                    },
                    "it": {
                        "headline": "Domande frequenti",
                        "items": [
                            {"q": "Posso cambiare piano in qualsiasi momento?", "a": "Sì, puoi fare upgrade o downgrade del tuo piano in qualsiasi momento. Il cambio è immediato."},
                            {"q": "Esiste una prova gratuita?", "a": "Sì, offriamo 14 giorni di prova gratuita per il piano Professional, senza carta di credito richiesta."},
                            {"q": "Come funziona la fatturazione?", "a": "Fatturiamo mensilmente o annualmente. Il pagamento annuale offre uno sconto del 20%."},
                            {"q": "Posso cancellare in qualsiasi momento?", "a": "Sì, puoi cancellare l'abbonamento in qualsiasi momento senza penali. Mantieni l'accesso fino alla fine del periodo di fatturazione."},
                            {"q": "Quali metodi di pagamento accettate?", "a": "Accettiamo tutte le principali carte di credito (Visa, Mastercard, Amex) e bonifici bancari per i piani annuali."},
                            {"q": "Offrite sconti per le agenzie?", "a": "Sì, offriamo prezzi personalizzati per agenzie e studi con più di 10 membri del team. Contattaci per discuterne."},
                        ]
                    },
                }
            },
            {
                "id": "s-pricing-cta",
                "type": "cta_section",
                "display_order": 3,
                "is_enabled": True,
                "config": {"background": "teal"},
                "content": {
                    "en-us": {
                        "headline": "Start for free today.",
                        "subheading": "No credit card required. 14-day trial included.",
                        "cta_primary": {"text": "Start Your Studio", "href": "/start-studio"},
                        "cta_secondary": {"text": "Talk to sales", "href": "/contact"},
                    },
                    "it": {
                        "headline": "Inizia gratis oggi.",
                        "subheading": "Nessuna carta di credito richiesta. 14 giorni di prova inclusi.",
                        "cta_primary": {"text": "Crea il tuo Studio", "href": "/start-studio"},
                        "cta_secondary": {"text": "Parla con noi", "href": "/contact"},
                    },
                }
            },
        ]
    },

    "about": {
        "id": "p-about",
        "tenant_id": "t-mood-corporate",
        "slug": "about",
        "template": "corporate-default",
        "is_published": True,
        "seo": {
            "en-us": {"title": "About — MOOD for DESIGN", "description": "The story behind MOOD for DESIGN."},
        },
        "sections": [
            {
                "id": "s-about-hero",
                "type": "editorial_hero",
                "display_order": 0,
                "is_enabled": True,
                "config": {"layout": "split-right", "image_url": ABOUT_IMAGE},
                "content": {
                    "en-us": {
                        "eyebrow": "Our Story",
                        "headline_1": "Built for the",
                        "headline_2": "design world.",
                        "subheading": "MOOD was born from a simple belief: the architecture and design industry deserves tools as refined as the spaces it creates.",
                        "cta_primary": {"text": "Join the Platform", "href": "/start-studio"},
                    },
                    "it": {
                        "eyebrow": "La Nostra Storia",
                        "headline_1": "Costruito per il",
                        "headline_2": "mondo del design.",
                        "subheading": "MOOD è nato da una semplice convinzione: l'industria dell'architettura e del design merita strumenti raffinati quanto gli spazi che crea.",
                        "cta_primary": {"text": "Unisciti alla Piattaforma", "href": "/start-studio"},
                    },
                }
            },
            {
                "id": "s-about-metrics",
                "type": "metrics_strip",
                "display_order": 1,
                "is_enabled": True,
                "config": {},
                "content": {
                    "en-us": {
                        "metrics": [
                            {"value": "2021", "label": "Founded", "description": "Born in Milan"},
                            {"value": "12K+", "label": "Studios", "description": "Trust MOOD globally"},
                            {"value": "42", "label": "Countries", "description": "And growing"},
                            {"value": "50+", "label": "Team", "description": "Design-first people"},
                        ]
                    },
                    "it": {
                        "metrics": [
                            {"value": "2021", "label": "Fondazione", "description": "Nati a Milano"},
                            {"value": "12K+", "label": "Studi", "description": "Si fidano di MOOD globalmente"},
                            {"value": "42", "label": "Paesi", "description": "E in crescita"},
                            {"value": "50+", "label": "Team", "description": "Persone design-first"},
                        ]
                    },
                }
            },
            {
                "id": "s-about-story",
                "type": "split_story",
                "display_order": 2,
                "is_enabled": True,
                "config": {"image_position": "left", "image_url": STUDIO_IMAGE, "background": "#FFFFFF"},
                "content": {
                    "en-us": {
                        "overline": "Our Manifesto",
                        "headline": "Infrastructure for\ndesign relationships.",
                        "body": "We believe that great design emerges from great relationships. Between studios and clients. Between brands and designers. Between inspiration and execution. MOOD is the infrastructure that makes those relationships thrive.",
                        "cta": {"text": "Join the community", "href": "/start-studio"},
                    },
                    "it": {
                        "overline": "Il Nostro Manifesto",
                        "headline": "Infrastruttura per le\nrelazioni nel design.",
                        "body": "Crediamo che il grande design emerga da grandi relazioni. Tra studi e clienti. Tra brand e designer. Tra ispirazione ed esecuzione. MOOD è l'infrastruttura che fa prosperare queste relazioni.",
                        "cta": {"text": "Unisciti alla community", "href": "/start-studio"},
                    },
                }
            },
            {
                "id": "s-about-quote",
                "type": "cinematic_quote",
                "display_order": 3,
                "is_enabled": True,
                "config": {"background": "dark", "show_features": False, "show_testimonial": False},
                "content": {
                    "en-us": {
                        "overline": "Our Vision",
                        "headline": "One Design\nOperating System.",
                        "body": "We are building not just a product, but an ecosystem. A living network where every studio, brand, designer and client is connected — and where the entire design industry can flourish.",
                    },
                    "it": {
                        "overline": "La Nostra Visione",
                        "headline": "Un Design\nOperating System.",
                        "body": "Stiamo costruendo non solo un prodotto, ma un ecosistema. Una rete vivente dove ogni studio, brand, designer e cliente è connesso — e dove l'intera industria del design può prosperare.",
                    },
                }
            },
        ]
    },

    "journal": {
        "id": "p-journal",
        "tenant_id": "t-mood-corporate",
        "slug": "journal",
        "template": "corporate-default",
        "is_published": True,
        "seo": {
            "en-us": {"title": "Journal — MOOD for DESIGN", "description": "Editorial insights from the world of architecture and design."},
        },
        "sections": [
            {
                "id": "s-journal-hero",
                "type": "editorial_hero",
                "display_order": 0,
                "is_enabled": True,
                "config": {"layout": "centered", "background": "#F9F9F8"},
                "content": {
                    "en-us": {
                        "eyebrow": "Journal",
                        "headline_1": "Insights from",
                        "headline_2": "the design world.",
                        "subheading": "Editorial perspectives on architecture, interior design, material culture and the future of the design industry.",
                    },
                    "it": {
                        "eyebrow": "Journal",
                        "headline_1": "Prospettive dal",
                        "headline_2": "mondo del design.",
                        "subheading": "Visioni editoriali su architettura, interior design, cultura materiale e il futuro dell'industria del design.",
                    },
                }
            },
            {
                "id": "s-journal-grid",
                "type": "journal_grid",
                "display_order": 1,
                "is_enabled": True,
                "config": {},
                "content": {
                    "en-us": {
                        "posts": [
                            {
                                "id": "post-1",
                                "title": "The New Language of Luxury Interiors",
                                "excerpt": "How the definition of luxury is shifting from ostentation to restraint — and what this means for the design industry.",
                                "category": "Design Thinking",
                                "author": "Marco Ricci",
                                "date": "May 2025",
                                "image": "https://images.unsplash.com/photo-1682184805271-11671b7ecf4c?w=800&q=80",
                                "href": "/journal/luxury-interiors",
                            },
                            {
                                "id": "post-2",
                                "title": "Digital Showrooms: The Future of Brand Presentation",
                                "excerpt": "How leading furniture brands are reimagining the showroom experience for the digital age.",
                                "category": "Technology",
                                "author": "Sofia Chen",
                                "date": "April 2025",
                                "image": "https://images.unsplash.com/photo-1700474568247-2bf81611b293?w=800&q=80",
                                "href": "/journal/digital-showrooms",
                            },
                            {
                                "id": "post-3",
                                "title": "Material Stories: Tracing the Origin of Design Objects",
                                "excerpt": "A deep dive into the supply chains, craftspeople and narratives behind the materials we specify.",
                                "category": "Materials",
                                "author": "Lena Müller",
                                "date": "March 2025",
                                "image": "https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?w=800&q=80",
                                "href": "/journal/material-stories",
                            },
                            {
                                "id": "post-4",
                                "title": "The Architecture of Collaboration",
                                "excerpt": "Why the most successful studios are rethinking how they work with clients, brands and each other.",
                                "category": "Studio Life",
                                "author": "Giulia Ferrari",
                                "date": "February 2025",
                                "image": "https://images.unsplash.com/photo-1598367815092-a2c0cbc1ea3d?w=800&q=80",
                                "href": "/journal/architecture-collaboration",
                            },
                            {
                                "id": "post-5",
                                "title": "Biophilic Design at Scale",
                                "excerpt": "Exploring how the integration of nature into architectural spaces is evolving from trend to discipline.",
                                "category": "Trends",
                                "author": "Thomas Bergmann",
                                "date": "January 2025",
                                "image": "https://images.unsplash.com/photo-1682184805271-11671b7ecf4c?w=800&q=80",
                                "href": "/journal/biophilic-design",
                            },
                            {
                                "id": "post-6",
                                "title": "Milan Design Week 2025: What We Learned",
                                "excerpt": "Our editorial team reports from the most important design event of the year.",
                                "category": "Events",
                                "author": "Editorial Team",
                                "date": "December 2024",
                                "image": "https://images.unsplash.com/photo-1742440711413-da7afb0f4930?w=800&q=80",
                                "href": "/journal/milan-design-week-2025",
                            },
                        ]
                    },
                    "it": {
                        "posts": [
                            {
                                "id": "post-1",
                                "title": "Il Nuovo Linguaggio degli Interni di Lusso",
                                "excerpt": "Come la definizione di lusso si sta spostando dall'ostentazione alla moderazione — e cosa significa per l'industria del design.",
                                "category": "Design Thinking",
                                "author": "Marco Ricci",
                                "date": "Maggio 2025",
                                "image": "https://images.unsplash.com/photo-1682184805271-11671b7ecf4c?w=800&q=80",
                                "href": "/journal/luxury-interiors",
                            },
                            {
                                "id": "post-2",
                                "title": "Showroom Digitali: Il Futuro della Presentazione del Brand",
                                "excerpt": "Come i principali brand di arredamento stanno reinventando l'esperienza dello showroom per l'era digitale.",
                                "category": "Tecnologia",
                                "author": "Sofia Chen",
                                "date": "Aprile 2025",
                                "image": "https://images.unsplash.com/photo-1700474568247-2bf81611b293?w=800&q=80",
                                "href": "/journal/digital-showrooms",
                            },
                        ]
                    },
                }
            },
        ]
    },

    "contact": {
        "id": "p-contact",
        "tenant_id": "t-mood-corporate",
        "slug": "contact",
        "template": "corporate-default",
        "is_published": True,
        "seo": {
            "en-us": {"title": "Contact — MOOD for DESIGN", "description": "Get in touch with the MOOD for DESIGN team."},
        },
        "sections": [
            {
                "id": "s-contact-hero",
                "type": "editorial_hero",
                "display_order": 0,
                "is_enabled": True,
                "config": {"layout": "centered", "background": "#F9F9F8"},
                "content": {
                    "en-us": {
                        "eyebrow": "Contact",
                        "headline_1": "Let's talk",
                        "headline_2": "about your vision.",
                        "subheading": "Whether you're a studio, brand or retailer — we'd love to hear how MOOD can work for you.",
                    },
                    "it": {
                        "eyebrow": "Contatti",
                        "headline_1": "Parliamo",
                        "headline_2": "della tua visione.",
                        "subheading": "Che tu sia uno studio, un brand o un retailer — ci piacerebbe sentire come MOOD può funzionare per te.",
                    },
                }
            },
        ]
    },

    "start-studio": {
        "id": "p-start-studio",
        "tenant_id": "t-mood-corporate",
        "slug": "start-studio",
        "template": "corporate-default",
        "is_published": True,
        "seo": {
            "en-us": {"title": "Start Your Studio — MOOD for DESIGN", "description": "Create your MOOD studio and join the design community."},
        },
        "sections": [
            {
                "id": "s-start-hero",
                "type": "editorial_hero",
                "display_order": 0,
                "is_enabled": True,
                "config": {"layout": "centered", "background": "#0A0A0A", "dark_mode": True},
                "content": {
                    "en-us": {
                        "eyebrow": "Get Started",
                        "headline_1": "Your studio.",
                        "headline_2": "Your world.",
                        "headline_3": "Start today.",
                        "subheading": "Join thousands of architecture and design professionals on MOOD. Your studio workspace is ready in minutes.",
                    },
                    "it": {
                        "eyebrow": "Inizia Ora",
                        "headline_1": "Il tuo studio.",
                        "headline_2": "Il tuo mondo.",
                        "headline_3": "Inizia oggi.",
                        "subheading": "Unisciti a migliaia di professionisti dell'architettura e del design su MOOD. Il tuo spazio studio è pronto in pochi minuti.",
                    },
                }
            },
        ]
    },

    "blueprint": {
        "id": "p-blueprint",
        "tenant_id": "t-mood-corporate",
        "slug": "blueprint",
        "template": "corporate-default",
        "is_published": True,
        "seo": {
            "en-us": {"title": "Blueprint — MOOD for DESIGN", "description": "The visual design editor for architecture studios."},
        },
        "sections": [
            {
                "id": "s-blueprint-hero",
                "type": "editorial_hero",
                "display_order": 0,
                "is_enabled": True,
                "config": {"layout": "centered", "background": "#0A0A0A", "dark_mode": True},
                "content": {
                    "en-us": {
                        "eyebrow": "Blueprint Editor",
                        "headline_1": "Design without",
                        "headline_2": "limits.",
                        "subheading": "Blueprint is MOOD's visual editor — a no-code tool for creating stunning digital showrooms, client presentations and brand experiences.",
                        "cta_primary": {"text": "Start Building", "href": "/start-studio"},
                        "cta_secondary": {"text": "View Templates", "href": "/templates"},
                    },
                    "it": {
                        "eyebrow": "Blueprint Editor",
                        "headline_1": "Design senza",
                        "headline_2": "limiti.",
                        "subheading": "Blueprint è l'editor visuale di MOOD — uno strumento no-code per creare showroom digitali straordinari, presentazioni clienti ed esperienze di brand.",
                        "cta_primary": {"text": "Inizia a Costruire", "href": "/start-studio"},
                        "cta_secondary": {"text": "Vedi i Template", "href": "/templates"},
                    },
                }
            },
            {
                "id": "s-blueprint-story",
                "type": "split_story",
                "display_order": 1,
                "is_enabled": True,
                "config": {"image_position": "right", "image_url": MATERIALS_IMAGE, "background": "#FFFFFF"},
                "content": {
                    "en-us": {
                        "overline": "The Editor",
                        "headline": "Visual editing.\nEditorially precise.",
                        "body": "Blueprint gives you complete control over every pixel of your studio's digital presence. From hero sections to product showcases — build it exactly as you envisioned it.",
                        "cta": {"text": "Explore the Editor", "href": "/start-studio"},
                    },
                    "it": {
                        "overline": "L'Editor",
                        "headline": "Editing visuale.\nPrecisione editoriale.",
                        "body": "Blueprint ti dà il controllo completo su ogni pixel della presenza digitale del tuo studio. Dalle sezioni hero alle vetrine prodotti — costruisci esattamente come lo hai immaginato.",
                        "cta": {"text": "Esplora l'Editor", "href": "/start-studio"},
                    },
                }
            },
            {
                "id": "s-blueprint-cta",
                "type": "cta_section",
                "display_order": 2,
                "is_enabled": True,
                "config": {"background": "teal"},
                "content": {
                    "en-us": {
                        "headline": "Start building your studio today.",
                        "subheading": "Blueprint is included in every MOOD plan.",
                        "cta_primary": {"text": "Start Your Studio", "href": "/start-studio"},
                    },
                    "it": {
                        "headline": "Inizia a costruire il tuo studio oggi.",
                        "subheading": "Blueprint è incluso in ogni piano MOOD.",
                        "cta_primary": {"text": "Crea il tuo Studio", "href": "/start-studio"},
                    },
                }
            },
        ]
    },
}


def get_page(slug: str, locale: str = "en-us") -> dict:
    """Get page data with locale-resolved section content."""
    raw = PAGES.get(slug)
    if not raw:
        return None

    # Resolve locale content for each section
    sections = []
    for section in raw.get("sections", []):
        if not section.get("is_enabled", True):
            continue

        content_map = section.get("content", {})
        # Fallback chain: requested locale → en-us → first available
        resolved_content = (
            content_map.get(locale)
            or content_map.get("en-us")
            or next(iter(content_map.values()), {})
        )

        sections.append({
            "id": section["id"],
            "type": section["type"],
            "display_order": section["display_order"],
            "config": section.get("config", {}),
            "content": resolved_content,
        })

    seo_map = raw.get("seo", {})
    seo = seo_map.get(locale) or seo_map.get("en-us") or {}

    return {
        "page": {
            "id": raw["id"],
            "slug": raw["slug"],
            "title": seo.get("title", raw["slug"].title()),
            "meta_description": seo.get("description", ""),
        },
        "sections": sorted(sections, key=lambda s: s["display_order"]),
    }


def get_navigation(locale: str = "en-us") -> dict:
    """Get navigation items resolved to specified locale."""
    nav = NAVIGATION
    main_items = []
    for item in nav["main"]:
        main_items.append({
            "id": item["id"],
            "key": item["key"],
            "href": item["href"],
            "label": item["labels"].get(locale) or item["labels"].get("en-us", item["key"]),
        })

    cta = nav["cta"]
    cta_resolved = {
        "id": cta["id"],
        "key": cta["key"],
        "href": cta["href"],
        "label": cta["labels"].get(locale) or cta["labels"].get("en-us"),
    }

    return {"main": main_items, "cta": cta_resolved}


def get_tenant(slug: str) -> dict:
    for t in TENANTS:
        if t["slug"] == slug:
            return t
    return None
