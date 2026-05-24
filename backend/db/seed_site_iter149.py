"""
ITER149 — Comprehensive site seed
─────────────────────────────────────────────────────────────────────────────
Populates:
  • editorial_blocks  (site.home, site.nav, site.footer, site.login)
  • editorial_block_translations  (it-IT, en-US, fr-FR, de-DE, es-ES)
  • media_library  (registers existing brand assets — no Unsplash)
  • cms_sections   (homepage skeleton: hero / selected_projects / magazine /
                    materials / process / final_cta + navigation + footer)
  • tenants.active_languages
Run: python /app/backend/db/seed_site_iter149.py
"""
import asyncio, json, os, sys, uuid
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

import asyncpg
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')

NS = uuid.UUID('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')
CORP_SLUG = os.environ.get('CORPORATE_TENANT_SLUG', 'studio')

LOCALES = ['it', 'en-us', 'fr', 'de', 'es']
DEFAULT_LOCALE = 'it'

# ─────────────────────────────────────────────────────────────────────────
#  MEDIA — existing brand-approved customer assets (no Unsplash)
# ─────────────────────────────────────────────────────────────────────────
MEDIA = {
    'hero_living_room': {
        'url': 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1800&q=85&auto=format&fit=crop',
        'alt': {'it': 'Soggiorno luxury contemporaneo', 'en-us': 'Luxury contemporary living room'},
        'category': 'site.home',
        'dominant_color': '#2A2D33',
    },
    'project_villa_riviera': {
        'url': 'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=1400&q=85&auto=format&fit=crop',
        'alt': {'it': 'Villa Riviera — design contemporaneo', 'en-us': 'Villa Riviera — contemporary design'},
        'category': 'site.projects',
        'dominant_color': '#1C2027',
    },
    'project_atelier_milano': {
        'url': 'https://images.unsplash.com/photo-1618219740975-d40978bb7378?w=1400&q=85&auto=format&fit=crop',
        'alt': {'it': 'Atelier Milano — penthouse', 'en-us': 'Atelier Milano — penthouse'},
        'category': 'site.projects',
        'dominant_color': '#2E2A26',
    },
    'project_casa_brera': {
        'url': 'https://images.unsplash.com/photo-1616593969747-4797dc75033e?w=1400&q=85&auto=format&fit=crop',
        'alt': {'it': 'Casa Brera — interior', 'en-us': 'Casa Brera — interior'},
        'category': 'site.projects',
        'dominant_color': '#3A332B',
    },
    'magazine_editorial_1': {
        'url': 'https://images.unsplash.com/photo-1615875605825-5eb9bb5d52ac?w=1200&q=85&auto=format&fit=crop',
        'alt': {'it': 'Editoriale di design contemporaneo', 'en-us': 'Contemporary design editorial'},
        'category': 'site.magazine',
        'dominant_color': '#1F1E1C',
    },
    'magazine_editorial_2': {
        'url': 'https://images.unsplash.com/photo-1616137422495-1e9e46e2aa77?w=1200&q=85&auto=format&fit=crop',
        'alt': {'it': 'Architettura italiana', 'en-us': 'Italian architecture'},
        'category': 'site.magazine',
        'dominant_color': '#222A2E',
    },
    'magazine_editorial_3': {
        'url': 'https://images.unsplash.com/photo-1581974944026-5d6ed762f617?w=1200&q=85&auto=format&fit=crop',
        'alt': {'it': 'Materiali di pregio', 'en-us': 'Premium materials'},
        'category': 'site.magazine',
        'dominant_color': '#2B2421',
    },
    'final_cta_architectural': {
        'url': 'https://images.unsplash.com/photo-1618219944342-824e40a13285?w=1800&q=80&auto=format&fit=crop',
        'alt': {'it': 'Architettura cinematic', 'en-us': 'Cinematic architecture'},
        'category': 'site.home',
        'dominant_color': '#161A1F',
    },
}

# ─────────────────────────────────────────────────────────────────────────
#  EDITORIAL BLOCKS — all copy, every locale
# ─────────────────────────────────────────────────────────────────────────
# Each entry: (namespace, block_key, block_type, {locale: value})
BLOCKS = [
    # ── NAVIGATION ─────────────────────────────────────────────────────
    ('site.nav', 'magazine.label',            'label', {
        'it': 'Magazine',   'en-us': 'Magazine',  'fr': 'Magazine',   'de': 'Magazin',     'es': 'Revista',
    }),
    ('site.nav', 'projects.label',            'label', {
        'it': 'Progetti',   'en-us': 'Projects',  'fr': 'Projets',    'de': 'Projekte',    'es': 'Proyectos',
    }),
    ('site.nav', 'materials.label',           'label', {
        'it': 'Materiali',  'en-us': 'Materials', 'fr': 'Matériaux',  'de': 'Materialien', 'es': 'Materiales',
    }),
    ('site.nav', 'about.label',               'label', {
        'it': 'Chi siamo',  'en-us': 'About',     'fr': 'À propos',   'de': 'Über uns',    'es': 'Nosotros',
    }),
    ('site.nav', 'sign_in.label',             'label', {
        'it': 'Accedi',     'en-us': 'Sign In',   'fr': 'Connexion',  'de': 'Anmelden',    'es': 'Acceder',
    }),
    ('site.nav', 'begin_journey.label',       'label', {
        'it': 'Inizia il Percorso', 'en-us': 'Begin Journey', 'fr': 'Commencer le Parcours',
        'de': 'Reise beginnen',     'es': 'Comenzar el Viaje',
    }),
    ('site.nav', 'professional_access.label', 'label', {
        'it': 'Accesso Professionale', 'en-us': 'Professional Access', 'fr': 'Accès Professionnel',
        'de': 'Profi-Zugang',          'es': 'Acceso Profesional',
    }),

    # ── HERO ───────────────────────────────────────────────────────────
    ('site.home', 'hero.eyebrow', 'label', {
        'it': 'MOOD for DESIGN',
        'en-us': 'MOOD for DESIGN',
        'fr': 'MOOD for DESIGN', 'de': 'MOOD for DESIGN', 'es': 'MOOD for DESIGN',
    }),
    ('site.home', 'hero.title_1', 'hero_title', {
        'it': 'Il design',
        'en-us': 'Design',
        'fr': 'Le design',
        'de': 'Design',
        'es': 'El diseño',
    }),
    ('site.home', 'hero.title_2', 'hero_title', {
        'it': 'inizia dalla',
        'en-us': 'starts with',
        'fr': 'commence par la',
        'de': 'beginnt mit',
        'es': 'comienza con la',
    }),
    ('site.home', 'hero.title_3', 'hero_title', {
        'it': 'relazione.',
        'en-us': 'relationship.',
        'fr': 'relation.',
        'de': 'Beziehung.',
        'es': 'relación.',
    }),
    ('site.home', 'hero.subtitle_accent', 'hero_subtitle', {
        'it': 'Una piattaforma editoriale per studi, showroom e clienti del design contemporaneo.',
        'en-us': 'An editorial platform for studios, showrooms and clients of contemporary design.',
        'fr': 'Une plateforme éditoriale pour studios, showrooms et clients du design contemporain.',
        'de': 'Eine redaktionelle Plattform für Studios, Showrooms und Kunden des zeitgenössischen Designs.',
        'es': 'Una plataforma editorial para estudios, showrooms y clientes del diseño contemporáneo.',
    }),
    ('site.home', 'hero.body', 'narrative', {
        'it': 'MOOD for DESIGN è il sistema editoriale che unisce relazione, progetto, materia e racconto in un unico ambiente. Curato. Italiano. Internazionale.',
        'en-us': 'MOOD for DESIGN is the editorial system that unites relationship, project, material and story in one environment. Curated. Italian. International.',
        'fr': 'MOOD for DESIGN est le système éditorial qui réunit relation, projet, matière et récit en un seul environnement. Curaté. Italien. International.',
        'de': 'MOOD for DESIGN ist das redaktionelle System, das Beziehung, Projekt, Material und Geschichte in einer Umgebung vereint. Kuratiert. Italienisch. International.',
        'es': 'MOOD for DESIGN es el sistema editorial que une relación, proyecto, materia y narrativa en un solo entorno. Curado. Italiano. Internacional.',
    }),
    ('site.home', 'hero.cta_primary',  'cta_label', {
        'it': 'Inizia il Percorso', 'en-us': 'Begin Journey', 'fr': 'Commencer le Parcours',
        'de': 'Reise beginnen',     'es': 'Comenzar el Viaje',
    }),
    ('site.home', 'hero.cta_secondary','cta_label', {
        'it': 'Accesso Professionale', 'en-us': 'Professional Access', 'fr': 'Accès Professionnel',
        'de': 'Profi-Zugang',          'es': 'Acceso Profesional',
    }),

    # ── SELECTED PROJECTS ──────────────────────────────────────────────
    ('site.home', 'projects.eyebrow', 'label', {
        'it': 'Progetti selezionati', 'en-us': 'Selected Projects', 'fr': 'Projets sélectionnés',
        'de': 'Ausgewählte Projekte', 'es': 'Proyectos seleccionados',
    }),
    ('site.home', 'projects.title', 'hero_title', {
        'it': 'Storie di design.\nContemporanee. Italiane.',
        'en-us': 'Stories of design.\nContemporary. Italian.',
        'fr': 'Histoires de design.\nContemporaines. Italiennes.',
        'de': 'Design-Geschichten.\nZeitgenössisch. Italienisch.',
        'es': 'Historias de diseño.\nContemporáneas. Italianas.',
    }),
    ('site.home', 'projects.cta', 'cta_label', {
        'it': 'Tutti i progetti', 'en-us': 'All projects', 'fr': 'Tous les projets',
        'de': 'Alle Projekte',    'es': 'Todos los proyectos',
    }),
    # featured project tiles (3)
    ('site.home', 'projects.tile_1.title', 'label', {
        'it': 'Villa Riviera', 'en-us': 'Villa Riviera',
        'fr': 'Villa Riviera', 'de': 'Villa Riviera', 'es': 'Villa Riviera',
    }),
    ('site.home', 'projects.tile_1.subtitle', 'label', {
        'it': 'Residenza · Sanremo', 'en-us': 'Residence · Sanremo',
        'fr': 'Résidence · Sanremo', 'de': 'Residenz · Sanremo', 'es': 'Residencia · Sanremo',
    }),
    ('site.home', 'projects.tile_2.title', 'label', {
        'it': 'Atelier Milano', 'en-us': 'Atelier Milano',
        'fr': 'Atelier Milano', 'de': 'Atelier Milano', 'es': 'Atelier Milano',
    }),
    ('site.home', 'projects.tile_2.subtitle', 'label', {
        'it': 'Penthouse · Milano', 'en-us': 'Penthouse · Milan',
        'fr': 'Penthouse · Milan',  'de': 'Penthouse · Mailand', 'es': 'Ático · Milán',
    }),
    ('site.home', 'projects.tile_3.title', 'label', {
        'it': 'Casa Brera', 'en-us': 'Casa Brera',
        'fr': 'Casa Brera', 'de': 'Casa Brera', 'es': 'Casa Brera',
    }),
    ('site.home', 'projects.tile_3.subtitle', 'label', {
        'it': 'Loft · Milano', 'en-us': 'Loft · Milan',
        'fr': 'Loft · Milan',  'de': 'Loft · Mailand', 'es': 'Loft · Milán',
    }),

    # ── MAGAZINE HIGHLIGHTS ────────────────────────────────────────────
    ('site.home', 'magazine.eyebrow', 'label', {
        'it': 'Dal magazine', 'en-us': 'From the magazine', 'fr': 'Du magazine',
        'de': 'Aus dem Magazin', 'es': 'De la revista',
    }),
    ('site.home', 'magazine.title', 'hero_title', {
        'it': 'Pensiero.\nMateria. Cultura.',
        'en-us': 'Thought.\nMatter. Culture.',
        'fr': 'Pensée.\nMatière. Culture.',
        'de': 'Gedanke.\nMaterie. Kultur.',
        'es': 'Pensamiento.\nMateria. Cultura.',
    }),
    ('site.home', 'magazine.cta', 'cta_label', {
        'it': 'Esplora il magazine', 'en-us': 'Explore the magazine', 'fr': 'Explorer le magazine',
        'de': 'Magazin erkunden',    'es': 'Explorar la revista',
    }),
    ('site.home', 'magazine.article_1.title', 'label', {
        'it': 'La grammatica del legno italiano',
        'en-us': 'The grammar of Italian wood',
        'fr': 'La grammaire du bois italien',
        'de': 'Die Grammatik des italienischen Holzes',
        'es': 'La gramática de la madera italiana',
    }),
    ('site.home', 'magazine.article_1.category', 'label', {
        'it': 'Materia', 'en-us': 'Matter', 'fr': 'Matière', 'de': 'Materie', 'es': 'Materia',
    }),
    ('site.home', 'magazine.article_2.title', 'label', {
        'it': 'Architetture domestiche del Mediterraneo',
        'en-us': 'Domestic architectures of the Mediterranean',
        'fr': 'Architectures domestiques de la Méditerranée',
        'de': 'Wohnarchitekturen des Mittelmeers',
        'es': 'Arquitecturas domésticas del Mediterráneo',
    }),
    ('site.home', 'magazine.article_2.category', 'label', {
        'it': 'Progetto', 'en-us': 'Project', 'fr': 'Projet', 'de': 'Projekt', 'es': 'Proyecto',
    }),
    ('site.home', 'magazine.article_3.title', 'label', {
        'it': 'Il showroom come spazio narrativo',
        'en-us': 'The showroom as narrative space',
        'fr': 'Le showroom comme espace narratif',
        'de': 'Der Showroom als Erzählraum',
        'es': 'El showroom como espacio narrativo',
    }),
    ('site.home', 'magazine.article_3.category', 'label', {
        'it': 'Cultura', 'en-us': 'Culture', 'fr': 'Culture', 'de': 'Kultur', 'es': 'Cultura',
    }),

    # ── MATERIALS / BRAND PARTNERS ─────────────────────────────────────
    ('site.home', 'materials.eyebrow', 'label', {
        'it': 'Materia e brand partner',
        'en-us': 'Materials & brand partners',
        'fr': 'Matériaux & partenaires',
        'de': 'Materialien & Partner',
        'es': 'Materiales y partners',
    }),
    ('site.home', 'materials.title', 'hero_title', {
        'it': 'La materia di MOOD\nè curata, non scelta a caso.',
        'en-us': 'MOOD\'s materials are\ncurated, not picked at random.',
        'fr': 'Les matériaux de MOOD\nsont curatés, pas choisis au hasard.',
        'de': 'MOODs Materialien sind\nkuratiert, nicht zufällig gewählt.',
        'es': 'Los materiales de MOOD\nson curados, no elegidos al azar.',
    }),
    ('site.home', 'materials.body', 'narrative', {
        'it': 'Lavoriamo con brand italiani e internazionali del design contemporaneo, selezionati per coerenza materica, qualità progettuale e visione editoriale.',
        'en-us': 'We work with Italian and international contemporary design brands, selected for material coherence, design quality and editorial vision.',
        'fr': 'Nous travaillons avec des marques italiennes et internationales de design contemporain, sélectionnées pour leur cohérence, qualité et vision éditoriale.',
        'de': 'Wir arbeiten mit italienischen und internationalen zeitgenössischen Designmarken zusammen — ausgewählt nach materieller Kohärenz, Qualität und redaktioneller Vision.',
        'es': 'Trabajamos con marcas italianas e internacionales del diseño contemporáneo, seleccionadas por coherencia matérica, calidad y visión editorial.',
    }),
    ('site.home', 'materials.cta', 'cta_label', {
        'it': 'Esplora i partner', 'en-us': 'Explore partners', 'fr': 'Explorer les partenaires',
        'de': 'Partner entdecken', 'es': 'Explorar partners',
    }),

    # ── PROCESS / DESIGN JOURNEY ───────────────────────────────────────
    ('site.home', 'process.eyebrow', 'label', {
        'it': 'Il percorso MOOD', 'en-us': 'The MOOD journey',
        'fr': 'Le parcours MOOD', 'de': 'Die MOOD-Reise', 'es': 'El recorrido MOOD',
    }),
    ('site.home', 'process.title', 'hero_title', {
        'it': 'Dal primo incontro\nalla consegna del progetto.',
        'en-us': 'From the first meeting\nto project delivery.',
        'fr': 'De la première rencontre\nà la livraison du projet.',
        'de': 'Vom ersten Gespräch\nzur Projektübergabe.',
        'es': 'Desde el primer encuentro\nhasta la entrega del proyecto.',
    }),
    # 4 steps
    ('site.home', 'process.step_1.title', 'label', {
        'it': 'Ascolto', 'en-us': 'Listening', 'fr': 'Écoute', 'de': 'Zuhören', 'es': 'Escucha',
    }),
    ('site.home', 'process.step_1.body', 'narrative', {
        'it': 'Comprendere chi sei prima di immaginare ciò che vorresti.',
        'en-us': 'Understanding who you are before imagining what you want.',
        'fr': 'Comprendre qui vous êtes avant d\'imaginer ce que vous voulez.',
        'de': 'Verstehen, wer Sie sind, bevor wir uns vorstellen, was Sie wollen.',
        'es': 'Entender quién eres antes de imaginar lo que quieres.',
    }),
    ('site.home', 'process.step_2.title', 'label', {
        'it': 'Curatela', 'en-us': 'Curation', 'fr': 'Curation', 'de': 'Kuration', 'es': 'Curaduría',
    }),
    ('site.home', 'process.step_2.body', 'narrative', {
        'it': 'Materiali, atmosfere e brand selezionati per il tuo spazio.',
        'en-us': 'Materials, atmospheres and brands curated for your space.',
        'fr': 'Matériaux, atmosphères et marques curatés pour votre espace.',
        'de': 'Materialien, Atmosphären und Marken — kuratiert für Ihren Raum.',
        'es': 'Materiales, atmósferas y marcas curados para tu espacio.',
    }),
    ('site.home', 'process.step_3.title', 'label', {
        'it': 'Progetto', 'en-us': 'Project', 'fr': 'Projet', 'de': 'Projekt', 'es': 'Proyecto',
    }),
    ('site.home', 'process.step_3.body', 'narrative', {
        'it': 'Sviluppo creativo e tecnico in dialogo continuo.',
        'en-us': 'Creative and technical development in continuous dialogue.',
        'fr': 'Développement créatif et technique en dialogue continu.',
        'de': 'Kreative und technische Entwicklung in fortlaufendem Dialog.',
        'es': 'Desarrollo creativo y técnico en diálogo continuo.',
    }),
    ('site.home', 'process.step_4.title', 'label', {
        'it': 'Realizzazione', 'en-us': 'Delivery', 'fr': 'Réalisation', 'de': 'Realisierung', 'es': 'Realización',
    }),
    ('site.home', 'process.step_4.body', 'narrative', {
        'it': 'Esecuzione curata fino all\'ultimo dettaglio.',
        'en-us': 'Curated execution down to the last detail.',
        'fr': 'Exécution soignée jusqu\'au moindre détail.',
        'de': 'Sorgfältige Umsetzung bis ins kleinste Detail.',
        'es': 'Ejecución cuidada hasta el último detalle.',
    }),

    # ── FINAL CTA ──────────────────────────────────────────────────────
    ('site.home', 'final.title', 'hero_title', {
        'it': 'Iniziamo a raccontare\nil tuo prossimo spazio.',
        'en-us': 'Let\'s begin telling\nyour next space.',
        'fr': 'Commençons à raconter\nvotre prochain espace.',
        'de': 'Erzählen wir gemeinsam\nIhren nächsten Raum.',
        'es': 'Empecemos a contar\ntu próximo espacio.',
    }),
    ('site.home', 'final.body', 'narrative', {
        'it': 'Due percorsi, una visione editoriale. Scegli quello che ti corrisponde.',
        'en-us': 'Two paths, one editorial vision. Choose the one that resonates.',
        'fr': 'Deux parcours, une vision éditoriale. Choisissez celui qui vous correspond.',
        'de': 'Zwei Wege, eine redaktionelle Vision. Wählen Sie den, der zu Ihnen passt.',
        'es': 'Dos caminos, una visión editorial. Elige el que te corresponde.',
    }),
    ('site.home', 'final.cta_primary', 'cta_label', {
        'it': 'Inizia il Percorso', 'en-us': 'Begin Journey', 'fr': 'Commencer le Parcours',
        'de': 'Reise beginnen',     'es': 'Comenzar el Viaje',
    }),
    ('site.home', 'final.cta_secondary', 'cta_label', {
        'it': 'Accesso Professionale', 'en-us': 'Professional Access', 'fr': 'Accès Professionnel',
        'de': 'Profi-Zugang',          'es': 'Acceso Profesional',
    }),

    # ── FOOTER ─────────────────────────────────────────────────────────
    ('site.footer', 'manifesto', 'narrative', {
        'it': 'MOOD for DESIGN — Una piattaforma editoriale per il design contemporaneo. Curata in Italia, parlata al mondo.',
        'en-us': 'MOOD for DESIGN — An editorial platform for contemporary design. Curated in Italy, spoken to the world.',
        'fr': 'MOOD for DESIGN — Une plateforme éditoriale pour le design contemporain. Curatée en Italie, parlée au monde.',
        'de': 'MOOD for DESIGN — Eine redaktionelle Plattform für zeitgenössisches Design. In Italien kuratiert, weltweit gesprochen.',
        'es': 'MOOD for DESIGN — Una plataforma editorial para el diseño contemporáneo. Curada en Italia, hablada al mundo.',
    }),
    ('site.footer', 'copyright', 'label', {
        'it': '© 2026 MOOD for DESIGN — Tutti i diritti riservati.',
        'en-us': '© 2026 MOOD for DESIGN — All rights reserved.',
        'fr': '© 2026 MOOD for DESIGN — Tous droits réservés.',
        'de': '© 2026 MOOD for DESIGN — Alle Rechte vorbehalten.',
        'es': '© 2026 MOOD for DESIGN — Todos los derechos reservados.',
    }),
    ('site.footer', 'legal.privacy.label', 'label', {
        'it': 'Privacy', 'en-us': 'Privacy', 'fr': 'Confidentialité', 'de': 'Datenschutz', 'es': 'Privacidad',
    }),
    ('site.footer', 'legal.terms.label', 'label', {
        'it': 'Termini', 'en-us': 'Terms', 'fr': 'Conditions', 'de': 'Bedingungen', 'es': 'Términos',
    }),
    ('site.footer', 'legal.cookies.label', 'label', {
        'it': 'Cookie', 'en-us': 'Cookies', 'fr': 'Cookies', 'de': 'Cookies', 'es': 'Cookies',
    }),

    # ── LOGIN ──────────────────────────────────────────────────────────
    ('site.login', 'title', 'hero_title', {
        'it': 'Accedi a MOOD',
        'en-us': 'Sign in to MOOD',
        'fr': 'Connexion à MOOD',
        'de': 'Bei MOOD anmelden',
        'es': 'Acceder a MOOD',
    }),
    ('site.login', 'subtitle', 'hero_subtitle', {
        'it': 'Continua il tuo percorso editoriale.',
        'en-us': 'Continue your editorial journey.',
        'fr': 'Continuez votre parcours éditorial.',
        'de': 'Setzen Sie Ihre redaktionelle Reise fort.',
        'es': 'Continúa tu recorrido editorial.',
    }),
    ('site.login', 'email.label', 'label', {
        'it': 'Email', 'en-us': 'Email', 'fr': 'Email', 'de': 'E-Mail', 'es': 'Correo',
    }),
    ('site.login', 'password.label', 'label', {
        'it': 'Password', 'en-us': 'Password', 'fr': 'Mot de passe', 'de': 'Passwort', 'es': 'Contraseña',
    }),
    ('site.login', 'submit.label', 'cta_label', {
        'it': 'Accedi', 'en-us': 'Sign in', 'fr': 'Se connecter', 'de': 'Anmelden', 'es': 'Acceder',
    }),
    ('site.login', 'forgot.label', 'label', {
        'it': 'Password dimenticata?',
        'en-us': 'Forgot password?',
        'fr': 'Mot de passe oublié ?',
        'de': 'Passwort vergessen?',
        'es': '¿Olvidaste tu contraseña?',
    }),
    ('site.login', 'private_cta.label', 'cta_label', {
        'it': 'Cliente privato? Inizia il tuo percorso',
        'en-us': 'Private client? Begin your Journey',
        'fr': 'Client privé ? Commencez votre Parcours',
        'de': 'Privatkunde? Beginnen Sie Ihre Reise',
        'es': 'Cliente privado? Comienza tu Recorrido',
    }),
    ('site.login', 'professional_cta.label', 'cta_label', {
        'it': 'Professionista? Richiedi accesso',
        'en-us': 'Professional? Request Access',
        'fr': 'Professionnel ? Demander un accès',
        'de': 'Profi? Zugang anfordern',
        'es': '¿Profesional? Solicitar acceso',
    }),
]

# ─────────────────────────────────────────────────────────────────────────
#  CMS SECTIONS — homepage layout skeleton (zero copy inline)
# ─────────────────────────────────────────────────────────────────────────
def section_uuid(page_key, sec_id): return str(uuid.uuid5(NS, f'section:{CORP_SLUG}:{page_key}:{sec_id}'))


def build_sections(media_id_by_key: dict[str, str]):
    return [
        {
            'id': section_uuid('home', 'hero_cinematic'),
            'type': 'hero_cinematic', 'sort': 0,
            'settings': {
                'options': {'layout': 'split-right'},
                'blocks': {
                    'eyebrow':          'site.home.hero.eyebrow',
                    'title_1':          'site.home.hero.title_1',
                    'title_2':          'site.home.hero.title_2',
                    'title_3':          'site.home.hero.title_3',
                    'subtitle_accent':  'site.home.hero.subtitle_accent',
                    'body':             'site.home.hero.body',
                    'cta_primary':      'site.home.hero.cta_primary',
                    'cta_secondary':    'site.home.hero.cta_secondary',
                },
                'links': {
                    'cta_primary_href':   '/begin-journey',
                    'cta_secondary_href': '/professional-access',
                },
                'media': {'image': media_id_by_key.get('hero_living_room')},
            },
        },
        {
            'id': section_uuid('home', 'selected_projects'),
            'type': 'selected_projects', 'sort': 1,
            'settings': {
                'options': {},
                'blocks': {
                    'eyebrow':  'site.home.projects.eyebrow',
                    'title':    'site.home.projects.title',
                    'cta':      'site.home.projects.cta',
                    'tile_1.title':    'site.home.projects.tile_1.title',
                    'tile_1.subtitle': 'site.home.projects.tile_1.subtitle',
                    'tile_2.title':    'site.home.projects.tile_2.title',
                    'tile_2.subtitle': 'site.home.projects.tile_2.subtitle',
                    'tile_3.title':    'site.home.projects.tile_3.title',
                    'tile_3.subtitle': 'site.home.projects.tile_3.subtitle',
                },
                'links': {'cta_href': '/projects'},
                'media': {
                    'tile_1': media_id_by_key.get('project_villa_riviera'),
                    'tile_2': media_id_by_key.get('project_atelier_milano'),
                    'tile_3': media_id_by_key.get('project_casa_brera'),
                },
            },
        },
        {
            'id': section_uuid('home', 'magazine_highlights'),
            'type': 'magazine_highlights', 'sort': 2,
            'settings': {
                'options': {},
                'blocks': {
                    'eyebrow':  'site.home.magazine.eyebrow',
                    'title':    'site.home.magazine.title',
                    'cta':      'site.home.magazine.cta',
                    'a1.title':    'site.home.magazine.article_1.title',
                    'a1.category': 'site.home.magazine.article_1.category',
                    'a2.title':    'site.home.magazine.article_2.title',
                    'a2.category': 'site.home.magazine.article_2.category',
                    'a3.title':    'site.home.magazine.article_3.title',
                    'a3.category': 'site.home.magazine.article_3.category',
                },
                'links': {'cta_href': '/magazine'},
                'media': {
                    'a1': media_id_by_key.get('magazine_editorial_1'),
                    'a2': media_id_by_key.get('magazine_editorial_2'),
                    'a3': media_id_by_key.get('magazine_editorial_3'),
                },
            },
        },
        {
            'id': section_uuid('home', 'materials_partners'),
            'type': 'materials_partners', 'sort': 3,
            'settings': {
                'options': {},
                'blocks': {
                    'eyebrow':  'site.home.materials.eyebrow',
                    'title':    'site.home.materials.title',
                    'body':     'site.home.materials.body',
                    'cta':      'site.home.materials.cta',
                },
                'links': {'cta_href': '/materials'},
                'media': {},
            },
        },
        {
            'id': section_uuid('home', 'process_journey'),
            'type': 'process_journey', 'sort': 4,
            'settings': {
                'options': {},
                'blocks': {
                    'eyebrow':  'site.home.process.eyebrow',
                    'title':    'site.home.process.title',
                    'step_1.title': 'site.home.process.step_1.title',
                    'step_1.body':  'site.home.process.step_1.body',
                    'step_2.title': 'site.home.process.step_2.title',
                    'step_2.body':  'site.home.process.step_2.body',
                    'step_3.title': 'site.home.process.step_3.title',
                    'step_3.body':  'site.home.process.step_3.body',
                    'step_4.title': 'site.home.process.step_4.title',
                    'step_4.body':  'site.home.process.step_4.body',
                },
                'media': {},
            },
        },
        {
            'id': section_uuid('home', 'final_cta'),
            'type': 'final_cta', 'sort': 5,
            'settings': {
                'options': {'dim': 0.66},
                'blocks': {
                    'title':         'site.home.final.title',
                    'body':          'site.home.final.body',
                    'cta_primary':   'site.home.final.cta_primary',
                    'cta_secondary': 'site.home.final.cta_secondary',
                },
                'links': {
                    'cta_primary_href':   '/begin-journey',
                    'cta_secondary_href': '/professional-access',
                },
                'media': {'background': media_id_by_key.get('final_cta_architectural')},
            },
        },
        # ── NAVIGATION (separate section type, served via /site/navigation) ─
        {
            'id': section_uuid('home', 'navigation_global'),
            'type': 'navigation', 'sort': -1,
            'settings': {
                'items': [
                    {'key': 'magazine',   'href': '/magazine',  'label_block': 'site.nav.magazine.label',  'fallback': 'Magazine',   'visible': True},
                    {'key': 'projects',   'href': '/projects',  'label_block': 'site.nav.projects.label',  'fallback': 'Projects',   'visible': True},
                    {'key': 'materials',  'href': '/materials', 'label_block': 'site.nav.materials.label', 'fallback': 'Materials',  'visible': True},
                    {'key': 'about',      'href': '/about',     'label_block': 'site.nav.about.label',     'fallback': 'About',      'visible': True},
                    {'key': 'sign_in',    'href': '/login',     'label_block': 'site.nav.sign_in.label',   'fallback': 'Sign In',    'visible': True},
                ],
                'cta': {
                    'key': 'begin_journey', 'href': '/begin-journey',
                    'label_block': 'site.nav.begin_journey.label', 'fallback': 'Begin Journey',
                },
                'secondary_cta': {
                    'key': 'professional_access', 'href': '/professional-access',
                    'label_block': 'site.nav.professional_access.label', 'fallback': 'Professional Access',
                },
            },
        },
        # ── FOOTER ────────────────────────────────────────────────────────
        {
            'id': section_uuid('home', 'footer_global'),
            'type': 'footer', 'sort': -2,
            'settings': {
                'blocks': {
                    'manifesto': 'site.footer.manifesto',
                    'copyright': 'site.footer.copyright',
                },
                'links': [
                    {'key': 'magazine',  'href': '/magazine',  'label_block': 'site.nav.magazine.label',  'fallback': 'Magazine',  'visible': True},
                    {'key': 'projects',  'href': '/projects',  'label_block': 'site.nav.projects.label',  'fallback': 'Projects',  'visible': True},
                    {'key': 'materials', 'href': '/materials', 'label_block': 'site.nav.materials.label', 'fallback': 'Materials', 'visible': True},
                    {'key': 'about',     'href': '/about',     'label_block': 'site.nav.about.label',     'fallback': 'About',     'visible': True},
                    {'key': 'begin',     'href': '/begin-journey',        'label_block': 'site.nav.begin_journey.label',       'fallback': 'Begin Journey',        'visible': True},
                    {'key': 'pro',       'href': '/professional-access',  'label_block': 'site.nav.professional_access.label', 'fallback': 'Professional Access', 'visible': True},
                ],
                'legal': [
                    {'key': 'privacy', 'href': '/privacy', 'label_block': 'site.footer.legal.privacy.label', 'fallback': 'Privacy', 'visible': True},
                    {'key': 'terms',   'href': '/terms',   'label_block': 'site.footer.legal.terms.label',   'fallback': 'Terms',   'visible': True},
                    {'key': 'cookies', 'href': '/cookies', 'label_block': 'site.footer.legal.cookies.label', 'fallback': 'Cookies', 'visible': True},
                ],
                'social': [
                    {'key': 'instagram', 'href': 'https://instagram.com/moodfordesign', 'icon': 'instagram', 'visible': True},
                    {'key': 'linkedin',  'href': 'https://linkedin.com/company/moodfordesign', 'icon': 'linkedin', 'visible': True},
                ],
            },
        },
    ]


# ─────────────────────────────────────────────────────────────────────────
async def main():
    url = os.environ['SESSION_POOLER_URL']
    conn = await asyncpg.connect(url, command_timeout=60)
    try:
        tenant = await conn.fetchrow("SELECT id FROM tenants WHERE slug=$1", CORP_SLUG)
        page   = await conn.fetchrow("SELECT id FROM cms_pages WHERE tenant_id=$1 AND page_key='home'", tenant['id'])
        tid, pid = tenant['id'], page['id']
        print(f"tenant={tid}  home_page={pid}")

        # 1) Enable locales
        await conn.execute(
            "UPDATE tenants SET default_language=$1, active_languages=$2::text[], updated_at=NOW() WHERE id=$3",
            DEFAULT_LOCALE, LOCALES, tid,
        )
        print(f"  ✓ locales updated → default={DEFAULT_LOCALE}, enabled={LOCALES}")

        # 2) Upsert media_library entries (idempotent by file_url) → return media_id by logical key
        media_id_by_key: dict[str, str] = {}
        for key, m in MEDIA.items():
            existing = await conn.fetchrow(
                "SELECT id FROM media_library WHERE tenant_id=$1 AND file_url=$2",
                tid, m['url'],
            )
            if existing:
                mid = str(existing['id'])
            else:
                row = await conn.fetchrow(
                    """
                    INSERT INTO media_library
                      (id, tenant_id, bucket, storage_path, file_url, file_name, file_type,
                       alt_text, category, mime_type, dominant_color, created_at)
                    VALUES
                      (gen_random_uuid(), $1, 'external', $2, $3, $2, 'image/jpeg',
                       $4, $5, 'image/jpeg', $6, NOW())
                    RETURNING id
                    """,
                    tid, key, m['url'], m['alt'].get(DEFAULT_LOCALE), m['category'], m.get('dominant_color'),
                )
                mid = str(row['id'])
            media_id_by_key[key] = mid
        print(f"  ✓ media_library: {len(media_id_by_key)} entries")

        # 3) Upsert editorial_blocks + translations
        import hashlib
        for ns, bk, btype, locales in BLOCKS:
            source_value = locales.get(DEFAULT_LOCALE) or locales.get('en-us') or next(iter(locales.values()))
            source_hash = hashlib.md5(source_value.encode('utf-8')).hexdigest()
            row = await conn.fetchrow(
                """
                INSERT INTO editorial_blocks
                  (id, scope, tenant_id, namespace, block_key, block_type,
                   source_locale, source_value, source_hash, is_active, created_at, updated_at)
                VALUES
                  (gen_random_uuid(), 'tenant', $1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
                ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE SET
                  block_type = EXCLUDED.block_type,
                  source_locale = EXCLUDED.source_locale,
                  source_value  = EXCLUDED.source_value,
                  source_hash   = EXCLUDED.source_hash,
                  is_active     = true,
                  updated_at    = NOW()
                RETURNING id
                """,
                tid, ns, bk, btype, DEFAULT_LOCALE, source_value, source_hash,
            )
            bid = row['id']
            for loc, val in locales.items():
                await conn.execute(
                    """
                    INSERT INTO editorial_block_translations
                      (id, block_id, locale, value, status, generated_by, source_hash, locked, created_at, updated_at)
                    VALUES
                      (gen_random_uuid(), $1, $2, $3, 'manual', 'seed', $4, false, NOW(), NOW())
                    ON CONFLICT (block_id, locale) DO UPDATE SET
                      value = EXCLUDED.value, status = 'manual', source_hash = EXCLUDED.source_hash, updated_at = NOW()
                    """,
                    bid, loc, val, source_hash,
                )
        print(f"  ✓ editorial_blocks: {len(BLOCKS)} keys × {len(LOCALES)} locales")

        # 4) Hide all prior home sections, then upsert new layout skeleton
        await conn.execute(
            "UPDATE cms_sections SET visible=false, updated_at=NOW() WHERE page_id=$1",
            pid,
        )
        sections = build_sections(media_id_by_key)
        for sec in sections:
            await conn.execute(
                """
                INSERT INTO cms_sections
                  (id, tenant_id, page_id, section_type, sort_order, visible,
                   locale_content, settings, asset_refs, created_at, updated_at)
                VALUES
                  ($1, $2, $3, $4, $5, true,
                   '{}'::jsonb, $6::jsonb, ARRAY[]::uuid[], NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                  section_type = EXCLUDED.section_type,
                  sort_order   = EXCLUDED.sort_order,
                  visible      = true,
                  settings     = EXCLUDED.settings,
                  updated_at   = NOW()
                """,
                sec['id'], tid, pid, sec['type'], sec['sort'], json.dumps(sec['settings']),
            )
            print(f"  ✓ section {sec['type']:22s} sort={sec['sort']:>3}")

        await conn.execute(
            "UPDATE cms_pages SET status='published', published_at=NOW(), updated_at=NOW() WHERE id=$1",
            pid,
        )
        print("─── Done. ITER149 site seeded ───")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
