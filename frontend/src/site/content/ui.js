// MOOD for DESIGN™ — Shared UI Labels Content
// Mirrors future DB rows in `cms_content` under `page_key='_ui'`.
// ZERO inline constants in JSX components — every string lives here.

const tag = (it, en, fr, de, es) => ({ it, en, fr, de, es });

export const uiContent = {
  // Generic actions
  back: tag('Torna indietro', 'Back', 'Retour', 'Zurück', 'Volver'),
  backToArchive: tag('Torna all\u2019archivio', 'Back to archive', 'Retour aux archives', 'Zurück zum Archiv', 'Volver al archivo'),
  backHome: tag('Torna alla home', 'Back home', 'Retour à l\u2019accueil', 'Zur Startseite', 'Volver al inicio'),
  loading: tag('Caricamento\u2026', 'Loading\u2026', 'Chargement\u2026', 'Lädt\u2026', 'Cargando\u2026'),
  notFound: tag('Contenuto non disponibile', 'Content unavailable', 'Contenu indisponible', 'Inhalt nicht verfügbar', 'Contenido no disponible'),

  // Project archive page
  archive: {
    eyebrow: tag('Archivio editoriale', 'Editorial archive', 'Archives éditoriales', 'Redaktionsarchiv', 'Archivo editorial'),
    title: tag(
      'Progetti selezionati.\nStorie reali di spazi.',
      'Selected projects.\nReal stories of space.',
      'Projets sélectionnés.\nVraies histoires d\u2019espaces.',
      'Ausgewählte Projekte.\nEchte Geschichten von Räumen.',
      'Proyectos seleccionados.\nHistorias reales de espacios.',
    ),
    filterLabel: tag('Filtra per categoria', 'Filter by category', 'Filtrer par catégorie', 'Nach Kategorie filtern', 'Filtrar por categoría'),
    empty: tag('Nessun progetto in questa categoria.', 'No projects in this category.', 'Aucun projet dans cette catégorie.', 'Keine Projekte in dieser Kategorie.', 'No hay proyectos en esta categoría.'),
    finalTitle: tag(
      'Vuoi vedere il tuo prossimo spazio\nentrare in questo archivio?',
      'Want your next space\nto enter this archive?',
      'Envie de voir votre prochain espace\nentrer dans cette archive ?',
      'Soll Ihr nächster Raum\nin dieses Archiv?',
      '¿Quieres que tu próximo espacio\nentre en este archivo?',
    ),
    ctaPrivate: tag('INIZIA IL TUO PROGETTO', 'BEGIN YOUR PROJECT', 'COMMENCER VOTRE PROJET', 'PROJEKT BEGINNEN', 'COMIENZA TU PROYECTO'),
    ctaPro: tag('SONO UN PROFESSIONISTA', 'I AM A PROFESSIONAL', 'JE SUIS UN PROFESSIONNEL', 'ICH BIN FACHPERSON', 'SOY UN PROFESIONAL'),
  },

  // Project detail
  detail: {
    label: tag('Progetto', 'Project', 'Projet', 'Projekt', 'Proyecto'),
    overview: tag('Il progetto', 'Overview', 'Le projet', 'Das Projekt', 'El proyecto'),
    studio: tag('Studio', 'Studio', 'Studio', 'Studio', 'Estudio'),
    designer: tag('Designer', 'Designer', 'Designer', 'Designer', 'Diseñador'),
    location: tag('Luogo', 'Location', 'Lieu', 'Ort', 'Ubicación'),
    year: tag('Anno', 'Year', 'Année', 'Jahr', 'Año'),
    materials: tag('Materiali e fornitori', 'Materials & suppliers', 'Matériaux et fournisseurs', 'Materialien & Lieferanten', 'Materiales y proveedores'),
    related: tag('Continua a esplorare', 'Continue exploring', 'Continuer l\u2019exploration', 'Weiter erkunden', 'Sigue explorando'),
    cta: tag('Inizia un progetto come questo', 'Begin a project like this', 'Commencer un projet similaire', 'Ein ähnliches Projekt beginnen', 'Comienza un proyecto como este'),
    beginProject: tag('INIZIA IL TUO PROGETTO', 'BEGIN YOUR PROJECT', 'COMMENCER VOTRE PROJET', 'PROJEKT BEGINNEN', 'COMIENZA TU PROYECTO'),
    explore: tag('Esplora altri progetti', 'Explore other projects', 'Voir d\u2019autres projets', 'Weitere Projekte', 'Otros proyectos'),
  },

  // Onboarding placeholders (Private + Pro)
  onboarding: {
    private: {
      eyebrow: tag('PER I PRIVATI', 'FOR PRIVATE CLIENTS', 'POUR LES PARTICULIERS', 'FÜR PRIVATKUNDEN', 'PARA CLIENTES PRIVADOS'),
      title: tag(
        'Stiamo preparando\nun onboarding all\u2019altezza.',
        'We\u2019re preparing\nan onboarding to match.',
        'Nous préparons\nun onboarding à la hauteur.',
        'Wir bereiten\nein passendes Onboarding vor.',
        'Estamos preparando\nun onboarding a la altura.',
      ),
      body: tag(
        'Un percorso emotivo, in 7 passi: la tua visione, il tuo spazio, le tue referenze. Alla fine, ti affianchiamo a un designer reale. Aprirà a breve.',
        'An emotional 7-step path: your vision, your space, your references. At the end, we pair you with a real designer. Opening soon.',
        'Un parcours émotionnel en 7 étapes : votre vision, votre espace, vos références. À la fin, un designer réel. Bientôt disponible.',
        'Ein emotionaler 7-Schritte-Pfad: Vision, Raum, Referenzen. Am Ende ein echter Designer. Bald verfügbar.',
        'Un recorrido emocional en 7 pasos: tu visión, tu espacio, tus referencias. Al final, un diseñador real. Próximamente.',
      ),
      cta: tag('Scrivici intanto', 'Write to us', 'Écrivez-nous', 'Schreiben Sie uns', 'Escríbenos'),
    },
    pro: {
      eyebrow: tag('PER I PROFESSIONISTI', 'FOR PROFESSIONALS', 'POUR LES PROFESSIONNELS', 'FÜR FACHLEUTE', 'PARA PROFESIONALES'),
      title: tag(
        'Lo studio operativo\nsta arrivando.',
        'The operating studio\nis on its way.',
        'Le studio opérationnel\narrive bientôt.',
        'Das Studio-Betriebssystem\nkommt bald.',
        'El estudio operativo\nestá llegando.',
      ),
      body: tag(
        'Workspace, moodboard cinematografici, sourcing tracciato, proposte editoriali, relazione con il cliente. Accedi al Blueprint Workspace o richiedi un onboarding dedicato.',
        'Workspace, cinematic moodboards, traced sourcing, editorial proposals, client relationship. Access the Blueprint Workspace or request a dedicated onboarding.',
        'Workspace, moodboards cinématiques, sourcing tracé, propositions éditoriales, relation client. Accédez au Blueprint Workspace ou demandez un onboarding dédié.',
        'Workspace, kinematische Moodboards, verfolgtes Sourcing, redaktionelle Angebote, Kundenbeziehung. Greifen Sie auf Blueprint Workspace zu oder fordern Sie ein Onboarding an.',
        'Workspace, moodboards cinematográficos, sourcing trazado, propuestas editoriales, relación con el cliente. Accede al Blueprint Workspace o solicita onboarding.',
      ),
      cta: tag('Accedi al Workspace', 'Access the Workspace', 'Accéder au Workspace', 'Workspace betreten', 'Acceder al Workspace'),
    },
    exploreProjects: tag('Esplora i progetti', 'Explore projects', 'Voir les projets', 'Projekte ansehen', 'Ver proyectos'),
  },

  // Project categories (used by /projects filters)
  categories: {
    all:          tag('Tutti',         'All',          'Tous',         'Alle',           'Todos'),
    residential:  tag('Residenziale',  'Residential',  'Résidentiel',  'Wohnen',         'Residencial'),
    hospitality:  tag('Ospitalità',    'Hospitality',  'Hospitalité',  'Hospitality',    'Hospitalidad'),
    retail:       tag('Retail',        'Retail',       'Retail',       'Retail',         'Retail'),
  },
};
