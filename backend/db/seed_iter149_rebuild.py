"""
ITER149 REBUILD — homepage matching the official mockup
─────────────────────────────────────────────────────────────────────────────
Sections:
  01 hero_editorial       — "Design begins with understanding people."
  02 curated_brands       — PORRO · Minotti · B&B Italia · Poliform ·
                            Gallotti&Radice · FLOS · Flexform · Lualdi
  03 platform_pillars     — Curated Journeys · Editorial Moodboards ·
                            Relationship Memory · Material Intelligence ·
                            Blueprint Atelier
  04 design_journey       — "From atmosphere to realization" + 4 step cards
  05 editorial_triptych   — Magazine / Projects / Materials wide cards
  06 final_cta_immersive  — "Pronto a iniziare il tuo percorso?"
  + navigation (Magazine · Projects · Materials · About · Sign in
    + Begin your Journey + Professional Access)
  + footer (Magazine · Progetti · Materiali · Azienda · Legale)
Run: python /app/backend/db/seed_iter149_rebuild.py
"""
import asyncio, hashlib, json, os, sys, uuid
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


# ── MEDIA ──────────────────────────────────────────────────────────────────
MEDIA = {
    # Hero device mockup (laptop + phone on warm tabletop)
    'hero_device_mockup': {
        'url': 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=1800&q=90&auto=format&fit=crop',
        'alt': {'it': 'MOOD per studi di design — interfaccia su laptop e mobile',
                'en-us': 'MOOD for design studios — interface on laptop and mobile'},
        'category': 'site.home', 'dominant_color': '#0B1320',
    },
    # 4 cinematic step images for Design Journey
    'journey_listen': {
        'url': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=85&auto=format&fit=crop',
        'alt': {'it': 'Ascolto · spazio domestico contemporaneo',
                'en-us': 'Listening · contemporary domestic space'},
        'category': 'site.home', 'dominant_color': '#1A1612',
    },
    'journey_curate': {
        'url': 'https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=900&q=85&auto=format&fit=crop',
        'alt': {'it': 'Curatela · materia e finiture',
                'en-us': 'Curation · materials and finishes'},
        'category': 'site.home', 'dominant_color': '#2A2421',
    },
    'journey_project': {
        'url': 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=900&q=85&auto=format&fit=crop',
        'alt': {'it': 'Progetto · interno residenziale',
                'en-us': 'Project · residential interior'},
        'category': 'site.home', 'dominant_color': '#161A1F',
    },
    'journey_delivery': {
        'url': 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=900&q=85&auto=format&fit=crop',
        'alt': {'it': 'Realizzazione · luce e materia',
                'en-us': 'Delivery · light and matter'},
        'category': 'site.home', 'dominant_color': '#1F2326',
    },
    # 3 triptych images
    'card_magazine': {
        'url': 'https://images.unsplash.com/photo-1616137422495-1e9e46e2aa77?w=1100&q=85&auto=format&fit=crop',
        'alt': {'it': 'Magazine · spazio editoriale',
                'en-us': 'Magazine · editorial space'},
        'category': 'site.home', 'dominant_color': '#212626',
    },
    'card_projects': {
        'url': 'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=1100&q=85&auto=format&fit=crop',
        'alt': {'it': 'Progetti · residenza luxury',
                'en-us': 'Projects · luxury residence'},
        'category': 'site.home', 'dominant_color': '#1C2027',
    },
    'card_materials': {
        'url': 'https://images.unsplash.com/photo-1604147706283-d7119b5b822c?w=1100&q=85&auto=format&fit=crop',
        'alt': {'it': 'Materiali · marmo e finiture',
                'en-us': 'Materials · marble and finishes'},
        'category': 'site.home', 'dominant_color': '#262220',
    },
    # Final CTA architectural bg
    'final_cta_bg': {
        'url': 'https://images.unsplash.com/photo-1618219944342-824e40a13285?w=1800&q=85&auto=format&fit=crop',
        'alt': {'it': 'Salotto cinematic luxury',
                'en-us': 'Cinematic luxury living'},
        'category': 'site.home', 'dominant_color': '#0B1320',
    },
}


# ── EDITORIAL BLOCKS ───────────────────────────────────────────────────────
def L(it, en, fr=None, de=None, es=None):
    return {'it': it, 'en-us': en, 'fr': fr or en, 'de': de or en, 'es': es or en}


BLOCKS = [
    # ── NAVIGATION ─────────────────────────────────────────────────────────
    ('site.nav', 'magazine.label',            'label', L('Magazine',  'Magazine',  'Magazine',  'Magazin',     'Revista')),
    ('site.nav', 'projects.label',            'label', L('Progetti',  'Projects',  'Projets',   'Projekte',    'Proyectos')),
    ('site.nav', 'materials.label',           'label', L('Materiali', 'Materials', 'Matériaux', 'Materialien', 'Materiales')),
    ('site.nav', 'about.label',               'label', L('Chi siamo', 'About',     'À propos',  'Über uns',    'Nosotros')),
    ('site.nav', 'sign_in.label',             'label', L('Accedi',    'Sign in',   'Connexion', 'Anmelden',    'Acceder')),
    ('site.nav', 'begin_journey.label',       'cta_label', L('Inizia il Percorso', 'Begin your Journey', 'Commencer le Parcours', 'Reise beginnen', 'Comenzar el Viaje')),
    ('site.nav', 'professional_access.label', 'cta_label', L('Accesso Professionale', 'Professional Access', 'Accès Professionnel', 'Profi-Zugang', 'Acceso Profesional')),

    # ── HERO ────────────────────────────────────────────────────────────────
    ('site.home', 'hero.eyebrow', 'label', L(
        'La piattaforma editoriale per i professionisti del design',
        'The editorial platform for interior design professionals',
        'La plateforme éditoriale pour les professionnels du design',
        'Die redaktionelle Plattform für Design-Profis',
        'La plataforma editorial para profesionales del diseño',
    )),
    ('site.home', 'hero.title_1', 'hero_title', L('Il design',  'Design',  'Le design',  'Design',  'El diseño')),
    ('site.home', 'hero.title_2', 'hero_title', L('nasce dall\'ascolto', 'begins with understanding', 'commence par l\'écoute', 'beginnt mit Zuhören', 'comienza por escuchar')),
    ('site.home', 'hero.title_3', 'hero_title', L('delle persone.', 'people.', 'des gens.', 'der Menschen.', 'a las personas.')),
    ('site.home', 'hero.body', 'narrative', L(
        'MOOD for DESIGN è il sistema operativo che connette relazioni, materiali e progetti in un\'unica esperienza editoriale.',
        'MOOD for DESIGN is the operating system that connects relationships, materials and projects in a single editorial experience.',
        'MOOD for DESIGN est le système d\'exploitation qui relie relations, matériaux et projets dans une expérience éditoriale unique.',
        'MOOD for DESIGN ist das Betriebssystem, das Beziehungen, Materialien und Projekte in einer redaktionellen Erfahrung verbindet.',
        'MOOD for DESIGN es el sistema operativo que conecta relaciones, materiales y proyectos en una experiencia editorial única.',
    )),
    ('site.home', 'hero.cta_primary',   'cta_label', L('Inizia il Percorso', 'Begin your Journey', 'Commencer le Parcours', 'Reise beginnen', 'Comenzar el Viaje')),
    ('site.home', 'hero.cta_secondary', 'cta_label', L('Accesso Professionale', 'Professional Access', 'Accès Professionnel', 'Profi-Zugang', 'Acceso Profesional')),

    # ── CURATED BRANDS ─────────────────────────────────────────────────────
    ('site.home', 'brands.eyebrow', 'label', L(
        'Materiali curati con',
        'Curated materials from',
        'Matériaux curatés avec',
        'Kuratierte Materialien mit',
        'Materiales curados con',
    )),
    ('site.home', 'brands.brand_1.label', 'label', L('PORRO',         'PORRO',         'PORRO',         'PORRO',         'PORRO')),
    ('site.home', 'brands.brand_2.label', 'label', L('Minotti',       'Minotti',       'Minotti',       'Minotti',       'Minotti')),
    ('site.home', 'brands.brand_3.label', 'label', L('B&B Italia',    'B&B Italia',    'B&B Italia',    'B&B Italia',    'B&B Italia')),
    ('site.home', 'brands.brand_4.label', 'label', L('Poliform',      'Poliform',      'Poliform',      'Poliform',      'Poliform')),
    ('site.home', 'brands.brand_5.label', 'label', L('Gallotti&Radice','Gallotti&Radice','Gallotti&Radice','Gallotti&Radice','Gallotti&Radice')),
    ('site.home', 'brands.brand_6.label', 'label', L('FLOS',          'FLOS',          'FLOS',          'FLOS',          'FLOS')),
    ('site.home', 'brands.brand_7.label', 'label', L('Flexform',      'Flexform',      'Flexform',      'Flexform',      'Flexform')),
    ('site.home', 'brands.brand_8.label', 'label', L('Lualdi',        'Lualdi',        'Lualdi',        'Lualdi',        'Lualdi')),

    # ── PILLARS ────────────────────────────────────────────────────────────
    ('site.home', 'pillars.p1.title', 'label',     L('Curated Journeys',     'Curated Journeys',     'Parcours Curatés',     'Kuratierte Reisen',     'Recorridos Curados')),
    ('site.home', 'pillars.p1.body',  'narrative', L(
        'Esperienze guidate che trasformano l\'ispirazione in progetti significativi.',
        'Guided experiences that turn inspiration into meaningful projects.',
        'Expériences guidées qui transforment l\'inspiration en projets significatifs.',
        'Geführte Erfahrungen, die Inspiration in bedeutsame Projekte verwandeln.',
        'Experiencias guiadas que convierten la inspiración en proyectos con sentido.',
    )),
    ('site.home', 'pillars.p2.title', 'label',     L('Editorial Moodboards', 'Editorial Moodboards', 'Moodboards Éditoriales', 'Editorial Moodboards', 'Moodboards Editoriales')),
    ('site.home', 'pillars.p2.body',  'narrative', L(
        'Raccogli, confronta e affina idee con un approccio editoriale.',
        'Collect, compare and refine ideas with an editorial approach.',
        'Collectez, comparez et affinez vos idées avec une approche éditoriale.',
        'Sammeln, vergleichen und verfeinern Sie Ideen mit redaktionellem Ansatz.',
        'Recoge, compara y refina ideas con un enfoque editorial.',
    )),
    ('site.home', 'pillars.p3.title', 'label',     L('Relationship Memory',  'Relationship Memory',  'Mémoire Relationnelle',  'Beziehungsgedächtnis',  'Memoria Relacional')),
    ('site.home', 'pillars.p3.body',  'narrative', L(
        'Ogni interazione diventa contesto, intuizione e valore duraturo.',
        'Every interaction becomes context, insight and lasting value.',
        'Chaque interaction devient contexte, intuition et valeur durable.',
        'Jede Interaktion wird zu Kontext, Einsicht und nachhaltigem Wert.',
        'Cada interacción se vuelve contexto, intuición y valor duradero.',
    )),
    ('site.home', 'pillars.p4.title', 'label',     L('Material Intelligence','Material Intelligence','Intelligence Matérielle','Material-Intelligenz', 'Inteligencia Material')),
    ('site.home', 'pillars.p4.body',  'narrative', L(
        'I materiali giusti, curati e connessi alla tua visione.',
        'The right materials, curated and connected to your vision.',
        'Les bons matériaux, curatés et connectés à votre vision.',
        'Die richtigen Materialien, kuratiert und mit Ihrer Vision verbunden.',
        'Los materiales correctos, curados y conectados a tu visión.',
    )),
    ('site.home', 'pillars.p5.title', 'label',     L('Blueprint Atelier',    'Blueprint Atelier',    'Blueprint Atelier',    'Blueprint Atelier',    'Blueprint Atelier')),
    ('site.home', 'pillars.p5.body',  'narrative', L(
        'Il tuo studio, il tuo team, il tuo processo. Tutto in un ecosistema.',
        'Your studio, your team, your process. All in one ecosystem.',
        'Votre studio, votre équipe, votre processus. Tout dans un seul écosystème.',
        'Ihr Studio, Ihr Team, Ihr Prozess. Alles in einem Ökosystem.',
        'Tu estudio, tu equipo, tu proceso. Todo en un ecosistema.',
    )),

    # ── DESIGN JOURNEY ─────────────────────────────────────────────────────
    ('site.home', 'journey.eyebrow', 'label', L(
        'Il tuo percorso di design',
        'Your design journey',
        'Votre parcours de design',
        'Ihre Design-Reise',
        'Tu recorrido de diseño',
    )),
    ('site.home', 'journey.title_pre',    'label', L('Dall\'atmosfera',   'From atmosphere',   'De l\'atmosphère',   'Von der Atmosphäre',   'De la atmósfera')),
    ('site.home', 'journey.title_accent', 'label', L('alla realizzazione.','to realization.',  'à la réalisation.',  'zur Realisierung.',    'a la realización.')),
    ('site.home', 'journey.s1.title', 'label',     L('Ascolto',     'Listening',  'Écoute',     'Zuhören',       'Escucha')),
    ('site.home', 'journey.s1.body',  'narrative', L('Comprendiamo persone, visioni e aspirazioni.',
                                                     'We understand people, visions and aspirations.',
                                                     'Nous comprenons les personnes, les visions et les aspirations.',
                                                     'Wir verstehen Menschen, Visionen und Bestrebungen.',
                                                     'Comprendemos personas, visiones y aspiraciones.')),
    ('site.home', 'journey.s2.title', 'label',     L('Curatela',    'Curation',   'Curation',   'Kuration',      'Curaduría')),
    ('site.home', 'journey.s2.body',  'narrative', L('Selezioniamo materiali, finiture e atmosfere.',
                                                     'We select materials, finishes and atmospheres.',
                                                     'Nous sélectionnons matériaux, finitions et atmosphères.',
                                                     'Wir wählen Materialien, Oberflächen und Atmosphären aus.',
                                                     'Seleccionamos materiales, acabados y atmósferas.')),
    ('site.home', 'journey.s3.title', 'label',     L('Progetto',    'Project',    'Projet',     'Projekt',       'Proyecto')),
    ('site.home', 'journey.s3.body',  'narrative', L('Diamo forma a spazi coerenti e senza tempo.',
                                                     'We shape coherent, timeless spaces.',
                                                     'Nous façonnons des espaces cohérents et intemporels.',
                                                     'Wir gestalten kohärente, zeitlose Räume.',
                                                     'Damos forma a espacios coherentes y atemporales.')),
    ('site.home', 'journey.s4.title', 'label',     L('Realizzazione','Delivery',  'Réalisation', 'Realisierung', 'Realización')),
    ('site.home', 'journey.s4.body',  'narrative', L('Seguiamo ogni dettaglio fino alla consegna.',
                                                     'We follow every detail through to delivery.',
                                                     'Nous suivons chaque détail jusqu\'à la livraison.',
                                                     'Wir verfolgen jedes Detail bis zur Übergabe.',
                                                     'Seguimos cada detalle hasta la entrega.')),
    ('site.home', 'journey.cta', 'cta_label', L('Scopri il metodo MOOD', 'Discover the MOOD method', 'Découvrir la méthode MOOD', 'Die MOOD-Methode entdecken', 'Descubrir el método MOOD')),

    # ── TRIPTYCH ────────────────────────────────────────────────────────────
    ('site.home', 'triptych.magazine.category', 'label', L('Magazine',  'Magazine',  'Magazine',  'Magazin',     'Revista')),
    ('site.home', 'triptych.magazine.title',    'label', L(
        'Insight, storie e ispirazioni sul design contemporaneo.',
        'Insights, stories and inspirations on contemporary design.',
        'Aperçus, histoires et inspirations sur le design contemporain.',
        'Einblicke, Geschichten und Inspirationen zu zeitgenössischem Design.',
        'Reflexiones, historias e inspiraciones del diseño contemporáneo.',
    )),
    ('site.home', 'triptych.magazine.cta',      'cta_label', L('Leggi il magazine', 'Read the magazine', 'Lire le magazine', 'Magazin lesen', 'Leer la revista')),

    ('site.home', 'triptych.projects.category', 'label', L('Progetti',  'Projects',  'Projets',   'Projekte',    'Proyectos')),
    ('site.home', 'triptych.projects.title',    'label', L(
        'I nostri progetti raccontano relazioni, luoghi e visioni.',
        'Our projects tell stories of relationships, places and visions.',
        'Nos projets racontent relations, lieux et visions.',
        'Unsere Projekte erzählen Beziehungen, Orte und Visionen.',
        'Nuestros proyectos cuentan relaciones, lugares y visiones.',
    )),
    ('site.home', 'triptych.projects.cta',      'cta_label', L('Esplora i progetti', 'Explore projects', 'Explorer les projets', 'Projekte erkunden', 'Explorar proyectos')),

    ('site.home', 'triptych.materials.category', 'label', L('Materiali', 'Materials', 'Matériaux', 'Materialien', 'Materiales')),
    ('site.home', 'triptych.materials.title',    'label', L(
        'Materiali selezionati per qualità, cultura e autenticità.',
        'Materials selected for quality, culture and authenticity.',
        'Matériaux sélectionnés pour leur qualité, culture et authenticité.',
        'Materialien ausgewählt nach Qualität, Kultur und Authentizität.',
        'Materiales seleccionados por calidad, cultura y autenticidad.',
    )),
    ('site.home', 'triptych.materials.cta',      'cta_label', L('Scopri i materiali', 'Discover materials', 'Découvrir les matériaux', 'Materialien entdecken', 'Descubrir materiales')),

    # ── FINAL CTA ──────────────────────────────────────────────────────────
    ('site.home', 'final.title', 'hero_title', L(
        'Pronto a iniziare il tuo percorso?',
        'Ready to begin your journey?',
        'Prêt à commencer votre parcours ?',
        'Bereit, Ihre Reise zu beginnen?',
        '¿Listo para empezar tu recorrido?',
    )),
    ('site.home', 'final.body', 'narrative', L(
        'Entra in MOOD for DESIGN e trasforma le tue idee in progetti memorabili.',
        'Step into MOOD for DESIGN and turn your ideas into memorable projects.',
        'Entrez dans MOOD for DESIGN et transformez vos idées en projets mémorables.',
        'Treten Sie in MOOD for DESIGN ein und verwandeln Sie Ideen in unvergessliche Projekte.',
        'Entra en MOOD for DESIGN y transforma tus ideas en proyectos memorables.',
    )),
    ('site.home', 'final.cta_primary',   'cta_label', L('Inizia il Percorso', 'Begin your Journey', 'Commencer le Parcours', 'Reise beginnen', 'Comenzar el Viaje')),
    ('site.home', 'final.cta_secondary', 'cta_label', L('Accesso Professionale', 'Professional Access', 'Accès Professionnel', 'Profi-Zugang', 'Acceso Profesional')),

    # ── FOOTER ─────────────────────────────────────────────────────────────
    ('site.footer', 'manifesto', 'narrative', L(
        'Il sistema operativo relazionale per il design contemporaneo.',
        'The relational operating system for contemporary design.',
        'Le système d\'exploitation relationnel pour le design contemporain.',
        'Das relationale Betriebssystem für zeitgenössisches Design.',
        'El sistema operativo relacional para el diseño contemporáneo.',
    )),
    ('site.footer', 'copyright', 'label', L(
        '© 2026 MOOD for DESIGN. Tutti i diritti riservati.',
        '© 2026 MOOD for DESIGN. All rights reserved.',
        '© 2026 MOOD for DESIGN. Tous droits réservés.',
        '© 2026 MOOD for DESIGN. Alle Rechte vorbehalten.',
        '© 2026 MOOD for DESIGN. Todos los derechos reservados.',
    )),
    # Column headings
    ('site.footer', 'col.magazine.heading',   'label', L('Magazine',  'Magazine',  'Magazine',  'Magazin',     'Revista')),
    ('site.footer', 'col.projects.heading',   'label', L('Progetti',  'Projects',  'Projets',   'Projekte',    'Proyectos')),
    ('site.footer', 'col.materials.heading',  'label', L('Materiali', 'Materials', 'Matériaux', 'Materialien', 'Materiales')),
    ('site.footer', 'col.company.heading',    'label', L('Azienda',   'Company',   'Entreprise','Unternehmen', 'Empresa')),
    ('site.footer', 'col.legal.heading',      'label', L('Legale',    'Legal',     'Mentions',  'Rechtliches', 'Legal')),
    # Magazine items
    ('site.footer', 'col.magazine.articles',   'label', L('Articoli',    'Articles',    'Articles',    'Artikel',     'Artículos')),
    ('site.footer', 'col.magazine.interviews', 'label', L('Interviste',  'Interviews',  'Entretiens',  'Interviews',  'Entrevistas')),
    ('site.footer', 'col.magazine.inspirations','label',L('Ispirazioni', 'Inspirations','Inspirations','Inspirationen','Inspiraciones')),
    ('site.footer', 'col.magazine.news',       'label', L('News',        'News',        'Actualités',  'News',        'Noticias')),
    # Projects items
    ('site.footer', 'col.projects.residential','label', L('Residenze',  'Residential', 'Résidences', 'Wohnobjekte', 'Residencias')),
    ('site.footer', 'col.projects.hospitality','label', L('Hospitality','Hospitality', 'Hôtellerie', 'Hospitality', 'Hospitality')),
    ('site.footer', 'col.projects.retail',     'label', L('Retail',     'Retail',      'Retail',     'Retail',      'Retail')),
    ('site.footer', 'col.projects.offices',    'label', L('Uffici',     'Offices',     'Bureaux',    'Büros',       'Oficinas')),
    # Materials items
    ('site.footer', 'col.materials.brands',    'label', L('Brand',      'Brands',      'Marques',    'Marken',      'Marcas')),
    ('site.footer', 'col.materials.finishes',  'label', L('Finiture',   'Finishes',    'Finitions',  'Oberflächen', 'Acabados')),
    ('site.footer', 'col.materials.textiles',  'label', L('Tessuti',    'Textiles',    'Textiles',   'Textilien',   'Textiles')),
    ('site.footer', 'col.materials.surfaces',  'label', L('Superfici',  'Surfaces',    'Surfaces',   'Oberflächen', 'Superficies')),
    # Company items
    ('site.footer', 'col.company.about',       'label', L('Chi siamo',  'About',       'À propos',   'Über uns',    'Nosotros')),
    ('site.footer', 'col.company.method',      'label', L('Metodo',     'Method',      'Méthode',    'Methode',     'Método')),
    ('site.footer', 'col.company.network',     'label', L('Network',    'Network',     'Réseau',     'Netzwerk',    'Red')),
    ('site.footer', 'col.company.contact',     'label', L('Contatti',   'Contact',     'Contact',    'Kontakt',     'Contacto')),
    # Legal items
    ('site.footer', 'col.legal.privacy', 'label', L('Privacy Policy', 'Privacy Policy', 'Confidentialité', 'Datenschutz', 'Privacidad')),
    ('site.footer', 'col.legal.cookies', 'label', L('Cookie Policy',  'Cookie Policy',  'Cookies',         'Cookies',     'Cookies')),
    ('site.footer', 'col.legal.terms',   'label', L('Termini di utilizzo', 'Terms of Use', 'Conditions',   'Bedingungen', 'Términos')),
]


# ── SECTIONS ───────────────────────────────────────────────────────────────
def section_uuid(page, sid): return str(uuid.uuid5(NS, f'iter149-rebuild:{CORP_SLUG}:{page}:{sid}'))


def build_sections(media):
    return [
        # 01 HERO
        {
            'id': section_uuid('home', 'hero'),
            'type': 'hero_editorial', 'sort': 0,
            'settings': {
                'blocks': {
                    'eyebrow':       'site.home.hero.eyebrow',
                    'title_1':       'site.home.hero.title_1',
                    'title_2':       'site.home.hero.title_2',
                    'title_3':       'site.home.hero.title_3',
                    'body':          'site.home.hero.body',
                    'cta_primary':   'site.home.hero.cta_primary',
                    'cta_secondary': 'site.home.hero.cta_secondary',
                },
                'links': {
                    'cta_primary_href':   '/begin-journey',
                    'cta_secondary_href': '/professional-access',
                },
                'media': {'image': media['hero_device_mockup']},
            },
        },
        # 02 CURATED BRANDS
        {
            'id': section_uuid('home', 'brands'),
            'type': 'curated_brands', 'sort': 1,
            'settings': {
                'blocks': {
                    'eyebrow':       'site.home.brands.eyebrow',
                    'brand_1.label': 'site.home.brands.brand_1.label',
                    'brand_2.label': 'site.home.brands.brand_2.label',
                    'brand_3.label': 'site.home.brands.brand_3.label',
                    'brand_4.label': 'site.home.brands.brand_4.label',
                    'brand_5.label': 'site.home.brands.brand_5.label',
                    'brand_6.label': 'site.home.brands.brand_6.label',
                    'brand_7.label': 'site.home.brands.brand_7.label',
                    'brand_8.label': 'site.home.brands.brand_8.label',
                },
            },
        },
        # 03 PILLARS
        {
            'id': section_uuid('home', 'pillars'),
            'type': 'platform_pillars', 'sort': 2,
            'settings': {
                'blocks': {
                    'p1.title': 'site.home.pillars.p1.title', 'p1.body': 'site.home.pillars.p1.body',
                    'p2.title': 'site.home.pillars.p2.title', 'p2.body': 'site.home.pillars.p2.body',
                    'p3.title': 'site.home.pillars.p3.title', 'p3.body': 'site.home.pillars.p3.body',
                    'p4.title': 'site.home.pillars.p4.title', 'p4.body': 'site.home.pillars.p4.body',
                    'p5.title': 'site.home.pillars.p5.title', 'p5.body': 'site.home.pillars.p5.body',
                },
            },
        },
        # 04 DESIGN JOURNEY
        {
            'id': section_uuid('home', 'journey'),
            'type': 'design_journey', 'sort': 3,
            'settings': {
                'blocks': {
                    'eyebrow':       'site.home.journey.eyebrow',
                    'title_pre':     'site.home.journey.title_pre',
                    'title_accent':  'site.home.journey.title_accent',
                    's1.title':      'site.home.journey.s1.title', 's1.body': 'site.home.journey.s1.body',
                    's2.title':      'site.home.journey.s2.title', 's2.body': 'site.home.journey.s2.body',
                    's3.title':      'site.home.journey.s3.title', 's3.body': 'site.home.journey.s3.body',
                    's4.title':      'site.home.journey.s4.title', 's4.body': 'site.home.journey.s4.body',
                    'cta':           'site.home.journey.cta',
                },
                'links': {'cta_href': '/about'},
                'media': {
                    's1': media['journey_listen'],
                    's2': media['journey_curate'],
                    's3': media['journey_project'],
                    's4': media['journey_delivery'],
                },
            },
        },
        # 05 TRIPTYCH (Magazine / Projects / Materials)
        {
            'id': section_uuid('home', 'triptych'),
            'type': 'editorial_triptych', 'sort': 4,
            'settings': {
                'blocks': {
                    'magazine.category':  'site.home.triptych.magazine.category',
                    'magazine.title':     'site.home.triptych.magazine.title',
                    'magazine.cta':       'site.home.triptych.magazine.cta',
                    'projects.category':  'site.home.triptych.projects.category',
                    'projects.title':     'site.home.triptych.projects.title',
                    'projects.cta':       'site.home.triptych.projects.cta',
                    'materials.category': 'site.home.triptych.materials.category',
                    'materials.title':    'site.home.triptych.materials.title',
                    'materials.cta':      'site.home.triptych.materials.cta',
                },
                'links': {
                    'magazine_href':  '/magazine',
                    'projects_href':  '/projects',
                    'materials_href': '/materials',
                },
                'media': {
                    'magazine':  media['card_magazine'],
                    'projects':  media['card_projects'],
                    'materials': media['card_materials'],
                },
            },
        },
        # 06 FINAL CTA
        {
            'id': section_uuid('home', 'final'),
            'type': 'final_cta_immersive', 'sort': 5,
            'settings': {
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
                'options': {'dim': 0.7},
                'media': {'background': media['final_cta_bg']},
            },
        },
        # NAV
        {
            'id': section_uuid('home', 'nav'),
            'type': 'navigation', 'sort': -1,
            'settings': {
                'items': [
                    {'key': 'magazine',  'href': '/magazine',  'label_block': 'site.nav.magazine.label',  'visible': True, 'fallback': 'Magazine'},
                    {'key': 'projects',  'href': '/projects',  'label_block': 'site.nav.projects.label',  'visible': True, 'fallback': 'Projects'},
                    {'key': 'materials', 'href': '/materials', 'label_block': 'site.nav.materials.label', 'visible': True, 'fallback': 'Materials'},
                    {'key': 'about',     'href': '/about',     'label_block': 'site.nav.about.label',     'visible': True, 'fallback': 'About'},
                    {'key': 'sign_in',   'href': '/login',     'label_block': 'site.nav.sign_in.label',   'visible': True, 'fallback': 'Sign in'},
                ],
                'cta': {
                    'key': 'begin_journey', 'href': '/begin-journey',
                    'label_block': 'site.nav.begin_journey.label', 'fallback': 'Begin your Journey',
                },
                'secondary_cta': {
                    'key': 'professional_access', 'href': '/professional-access',
                    'label_block': 'site.nav.professional_access.label', 'fallback': 'Professional Access',
                },
            },
        },
        # FOOTER
        {
            'id': section_uuid('home', 'footer'),
            'type': 'footer', 'sort': -2,
            'settings': {
                'blocks': {
                    'manifesto': 'site.footer.manifesto',
                    'copyright': 'site.footer.copyright',
                },
                'links': [
                    # Magazine column
                    {'key': 'col_mag_h',  'group': 'magazine', 'isHeading': True, 'href': '#', 'label_block': 'site.footer.col.magazine.heading',   'visible': True},
                    {'key': 'mag_art',    'group': 'magazine', 'href': '/magazine',              'label_block': 'site.footer.col.magazine.articles',    'visible': True},
                    {'key': 'mag_int',    'group': 'magazine', 'href': '/magazine?cat=interviews','label_block': 'site.footer.col.magazine.interviews',  'visible': True},
                    {'key': 'mag_insp',   'group': 'magazine', 'href': '/magazine?cat=inspirations','label_block': 'site.footer.col.magazine.inspirations','visible': True},
                    {'key': 'mag_news',   'group': 'magazine', 'href': '/magazine?cat=news',     'label_block': 'site.footer.col.magazine.news',         'visible': True},
                    # Projects
                    {'key': 'col_proj_h', 'group': 'projects', 'isHeading': True, 'href': '#', 'label_block': 'site.footer.col.projects.heading',     'visible': True},
                    {'key': 'p_res',      'group': 'projects', 'href': '/projects?cat=residential','label_block': 'site.footer.col.projects.residential','visible': True},
                    {'key': 'p_hosp',     'group': 'projects', 'href': '/projects?cat=hospitality','label_block': 'site.footer.col.projects.hospitality','visible': True},
                    {'key': 'p_ret',      'group': 'projects', 'href': '/projects?cat=retail',    'label_block': 'site.footer.col.projects.retail',     'visible': True},
                    {'key': 'p_off',      'group': 'projects', 'href': '/projects?cat=offices',   'label_block': 'site.footer.col.projects.offices',    'visible': True},
                    # Materials
                    {'key': 'col_mat_h',  'group': 'materials','isHeading': True, 'href': '#', 'label_block': 'site.footer.col.materials.heading',   'visible': True},
                    {'key': 'm_br',       'group': 'materials','href': '/materials?cat=brands',  'label_block': 'site.footer.col.materials.brands',   'visible': True},
                    {'key': 'm_fin',      'group': 'materials','href': '/materials?cat=finishes','label_block': 'site.footer.col.materials.finishes', 'visible': True},
                    {'key': 'm_tex',      'group': 'materials','href': '/materials?cat=textiles','label_block': 'site.footer.col.materials.textiles', 'visible': True},
                    {'key': 'm_sur',      'group': 'materials','href': '/materials?cat=surfaces','label_block': 'site.footer.col.materials.surfaces', 'visible': True},
                    # Company
                    {'key': 'col_co_h',   'group': 'company',  'isHeading': True, 'href': '#', 'label_block': 'site.footer.col.company.heading',      'visible': True},
                    {'key': 'co_ab',      'group': 'company',  'href': '/about',                  'label_block': 'site.footer.col.company.about',     'visible': True},
                    {'key': 'co_me',      'group': 'company',  'href': '/about#method',           'label_block': 'site.footer.col.company.method',    'visible': True},
                    {'key': 'co_ne',      'group': 'company',  'href': '/about#network',          'label_block': 'site.footer.col.company.network',   'visible': True},
                    {'key': 'co_co',      'group': 'company',  'href': '/contact',                'label_block': 'site.footer.col.company.contact',   'visible': True},
                ],
                'legal': [
                    {'key': 'leg_h',      'isHeading': True, 'href': '#', 'label_block': 'site.footer.col.legal.heading', 'visible': True},
                    {'key': 'lg_priv',    'href': '/privacy', 'label_block': 'site.footer.col.legal.privacy', 'visible': True},
                    {'key': 'lg_cook',    'href': '/cookies', 'label_block': 'site.footer.col.legal.cookies', 'visible': True},
                    {'key': 'lg_terms',   'href': '/terms',   'label_block': 'site.footer.col.legal.terms',   'visible': True},
                ],
                'social': [
                    {'key': 'instagram', 'href': 'https://instagram.com/moodfordesign', 'icon': 'instagram', 'visible': True},
                    {'key': 'linkedin',  'href': 'https://linkedin.com/company/moodfordesign', 'icon': 'linkedin', 'visible': True},
                    {'key': 'pinterest', 'href': 'https://pinterest.com/moodfordesign', 'icon': 'pinterest', 'visible': True},
                ],
            },
        },
    ]


async def main():
    url = os.environ['SESSION_POOLER_URL']
    conn = await asyncpg.connect(url, command_timeout=60)
    try:
        tenant = await conn.fetchrow("SELECT id FROM tenants WHERE slug=$1", CORP_SLUG)
        page   = await conn.fetchrow("SELECT id FROM cms_pages WHERE tenant_id=$1 AND page_key='home'", tenant['id'])
        tid, pid = tenant['id'], page['id']
        print(f"tenant={tid}  home_page={pid}")

        # 1) Locales
        await conn.execute("UPDATE tenants SET default_language=$1, active_languages=$2::text[], updated_at=NOW() WHERE id=$3", DEFAULT_LOCALE, LOCALES, tid)

        # 2) Media upsert
        media_id = {}
        for key, m in MEDIA.items():
            row = await conn.fetchrow("SELECT id FROM media_library WHERE tenant_id=$1 AND file_url=$2", tid, m['url'])
            if row:
                media_id[key] = str(row['id'])
            else:
                r2 = await conn.fetchrow(
                    """
                    INSERT INTO media_library
                      (id, tenant_id, bucket, storage_path, file_url, file_name, file_type,
                       alt_text, category, mime_type, dominant_color, created_at)
                    VALUES (gen_random_uuid(), $1, 'external', $2, $3, $2, 'image/jpeg',
                            $4, $5, 'image/jpeg', $6, NOW())
                    RETURNING id
                    """,
                    tid, key, m['url'], m['alt'].get(DEFAULT_LOCALE), m['category'], m.get('dominant_color'),
                )
                media_id[key] = str(r2['id'])
        print(f"  ✓ media: {len(media_id)} entries")

        # 3) Editorial blocks
        for ns, bk, btype, locs in BLOCKS:
            sv = locs.get(DEFAULT_LOCALE) or locs.get('en-us') or next(iter(locs.values()))
            sh = hashlib.md5(sv.encode('utf-8')).hexdigest()
            row = await conn.fetchrow(
                """
                INSERT INTO editorial_blocks
                  (id, scope, tenant_id, namespace, block_key, block_type,
                   source_locale, source_value, source_hash, is_active, created_at, updated_at)
                VALUES (gen_random_uuid(), 'tenant', $1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
                ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE SET
                  block_type=EXCLUDED.block_type, source_locale=EXCLUDED.source_locale,
                  source_value=EXCLUDED.source_value, source_hash=EXCLUDED.source_hash,
                  is_active=true, updated_at=NOW()
                RETURNING id
                """,
                tid, ns, bk, btype, DEFAULT_LOCALE, sv, sh,
            )
            bid = row['id']
            for loc, val in locs.items():
                await conn.execute(
                    """
                    INSERT INTO editorial_block_translations
                      (id, block_id, locale, value, status, generated_by, source_hash, locked, created_at, updated_at)
                    VALUES (gen_random_uuid(), $1, $2, $3, 'manual', 'seed', $4, false, NOW(), NOW())
                    ON CONFLICT (block_id, locale) DO UPDATE SET
                      value=EXCLUDED.value, status='manual', source_hash=EXCLUDED.source_hash, updated_at=NOW()
                    """,
                    bid, loc, val, sh,
                )
        print(f"  ✓ blocks: {len(BLOCKS)} × {len(LOCALES)} = {len(BLOCKS) * len(LOCALES)} translations")

        # 4) Sections — hide all prior, then upsert new
        await conn.execute("UPDATE cms_sections SET visible=false, updated_at=NOW() WHERE page_id=$1", pid)
        for sec in build_sections(media_id):
            await conn.execute(
                """
                INSERT INTO cms_sections
                  (id, tenant_id, page_id, section_type, sort_order, visible,
                   locale_content, settings, asset_refs, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, true,
                        '{}'::jsonb, $6::jsonb, ARRAY[]::uuid[], NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                  section_type=EXCLUDED.section_type, sort_order=EXCLUDED.sort_order,
                  visible=true, settings=EXCLUDED.settings, updated_at=NOW()
                """,
                sec['id'], tid, pid, sec['type'], sec['sort'], json.dumps(sec['settings']),
            )
            print(f"  ✓ section {sec['type']:22s} sort={sec['sort']:>3}")

        await conn.execute("UPDATE cms_pages SET status='published', published_at=NOW(), updated_at=NOW() WHERE id=$1", pid)
        print("─── Done. ITER149 rebuild seeded ───")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
