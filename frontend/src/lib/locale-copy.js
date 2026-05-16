/**
 * locale-copy.js — Semantic Cultural Copy Registry (P0.2.A + P0.2.B).
 *
 * NOT a translation table. Each entry is a *semantically equivalent* phrase
 * REWRITTEN natively for each locale_profile — preserving the cultural
 * register (emotional tone, luxury framing, hospitality vocabulary).
 *
 * EN_US ≠ EN_GB ≠ EN_AE: they share English, never share vocabulary.
 *
 * Registry sections (P0.2.B):
 *   • sidebar.*     — navigation rail
 *   • dashboard.*   — operational hero, KPIs, empty/loading states
 *   • projects.*    — list page header, empty state, CTA
 *   • onboarding.*  — StartProjectWizard step intros (culturally distinct
 *                     questions, NOT translated questions)
 *   • settings.*    — Cultural Perspective panel (locale picker)
 *   • global.*      — loading / empty / error / retry copy
 */

// Internal fallback chain — market-intent-preserving. Mirror of the backend
// chain in core/locale_runtime.py. NEVER blind-fallback to IT_IT.
const FALLBACK_CHAIN = {
  EN_AE: ['EN_GB', 'EN_US'],
  EN_GB: ['EN_US'],
  EN_US: ['EN_GB'],
  FR_FR: ['IT_IT', 'EN_GB'],
  DE_DE: ['EN_GB'],
  ES_ES: ['IT_IT', 'EN_GB'],
  IT_IT: ['EN_GB'],
};

const REGISTRY = {
  // ═════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═════════════════════════════════════════════════════════════════
  'dashboard.hero.welcome': {
    IT_IT: 'Ogni progetto racconta una direzione diversa.',
    EN_US: 'Your next international design opportunity is already taking shape.',
    EN_GB: 'A quieter, more considered project direction is emerging.',
    EN_AE: 'Curate the next signature experience for your client.',
    DE_DE: 'Eine neue architektonische Richtung nimmt Form an.',
    FR_FR: 'Une nouvelle direction éditoriale se dessine pour votre studio.',
    ES_ES: 'Una nueva dirección sensorial empieza a tomar forma.',
  },
  'dashboard.hero.eyebrow': {
    IT_IT: 'Operazioni di studio',
    EN_US: 'Studio operations',
    EN_GB: 'Studio direction',
    EN_AE: 'Atelier operations',
    DE_DE: 'Studiobetrieb',
    FR_FR: 'Direction du studio',
    ES_ES: 'Operaciones del estudio',
  },
  'dashboard.hero.empty': {
    IT_IT: 'Nessuna azione critica oggi. Lo studio gira sereno.',
    EN_US: 'No critical actions today. Your studio is running smoothly.',
    EN_GB: 'Nothing requires immediate attention. The studio is composed.',
    EN_AE: 'No urgent matters require your attention today.',
    DE_DE: 'Keine kritischen Aufgaben heute. Das Studio läuft ruhig.',
    FR_FR: 'Aucune action critique aujourd\'hui. Le studio tourne sereinement.',
    ES_ES: 'Sin acciones urgentes hoy. El estudio respira con calma.',
  },

  // ═════════════════════════════════════════════════════════════════
  // SIDEBAR · navigation rail
  // ═════════════════════════════════════════════════════════════════
  'sidebar.section.workspace': {
    IT_IT: 'Studio',
    EN_US: 'Workspace',
    EN_GB: 'Studio',
    EN_AE: 'Atelier',
    DE_DE: 'Arbeitsbereich',
    FR_FR: 'Atelier',
    ES_ES: 'Estudio',
  },
  'sidebar.section.editorial': {
    IT_IT: 'Editoriale',
    EN_US: 'Editorial',
    EN_GB: 'Editorial',
    EN_AE: 'Editorial',
    DE_DE: 'Redaktion',
    FR_FR: 'Éditorial',
    ES_ES: 'Editorial',
  },
  'sidebar.section.studio': {
    IT_IT: 'Team',
    EN_US: 'Studio team',
    EN_GB: 'Studio',
    EN_AE: 'Atelier team',
    DE_DE: 'Team',
    FR_FR: 'Équipe',
    ES_ES: 'Equipo',
  },
  'sidebar.section.settings': {
    IT_IT: 'Impostazioni',
    EN_US: 'Settings',
    EN_GB: 'Settings',
    EN_AE: 'Preferences',
    DE_DE: 'Einstellungen',
    FR_FR: 'Réglages',
    ES_ES: 'Ajustes',
  },
  'sidebar.section.platform': {
    IT_IT: 'Piattaforma',
    EN_US: 'Platform',
    EN_GB: 'Platform',
    EN_AE: 'Platform',
    DE_DE: 'Plattform',
    FR_FR: 'Plateforme',
    ES_ES: 'Plataforma',
  },

  // ═════════════════════════════════════════════════════════════════
  // PROJECTS · list page
  // ═════════════════════════════════════════════════════════════════
  'projects.page.title': {
    IT_IT: 'Progetti',
    EN_US: 'Active projects',
    EN_GB: 'Project directions',
    EN_AE: 'Active commissions',
    DE_DE: 'Aktive Projekte',
    FR_FR: 'Projets en cours',
    ES_ES: 'Proyectos activos',
  },
  'projects.page.eyebrow': {
    IT_IT: 'Studio',
    EN_US: 'Workspace',
    EN_GB: 'Studio',
    EN_AE: 'Atelier',
    DE_DE: 'Arbeitsbereich',
    FR_FR: 'Atelier',
    ES_ES: 'Estudio',
  },
  'projects.empty.title': {
    IT_IT: 'Nessun progetto ancora aperto.',
    EN_US: 'No projects in your portfolio yet.',
    EN_GB: 'No projects underway just yet.',
    EN_AE: 'No commissions in your atelier yet.',
    DE_DE: 'Noch keine Projekte angelegt.',
    FR_FR: 'Aucun projet pour l\'instant.',
    ES_ES: 'Aún no hay proyectos abiertos.',
  },
  'projects.empty.cta': {
    IT_IT: 'Apri un nuovo percorso progettuale',
    EN_US: 'Shape your next design experience',
    EN_GB: 'Begin a new project direction',
    EN_AE: 'Curate a signature experience',
    DE_DE: 'Definieren Sie eine neue architektonische Richtung',
    FR_FR: 'Engagez une nouvelle direction éditoriale',
    ES_ES: 'Inicia una nueva dirección sensorial',
  },
  'projects.empty.subtitle': {
    IT_IT: 'Il primo progetto comincia con un\'intenzione strategica, non con un brief.',
    EN_US: 'Every great project begins with a clear vision of how clients will live in the space.',
    EN_GB: 'A project begins as a quiet intention — not yet a brief.',
    EN_AE: 'Each commission begins as a curated promise of atmosphere and prestige.',
    DE_DE: 'Jedes Projekt beginnt mit einer klaren architektonischen Absicht.',
    FR_FR: 'Chaque projet commence par une intention éditoriale, avant le brief.',
    ES_ES: 'Cada proyecto empieza como una intención antes de convertirse en brief.',
  },
  'projects.new.cta': {
    IT_IT: 'Nuovo progetto',
    EN_US: 'New project',
    EN_GB: 'New direction',
    EN_AE: 'New commission',
    DE_DE: 'Neues Projekt',
    FR_FR: 'Nouveau projet',
    ES_ES: 'Nuevo proyecto',
  },

  // ═════════════════════════════════════════════════════════════════
  // ONBOARDING · StartProjectWizard step intros
  //
  // These are SEMANTICALLY DIFFERENT questions per locale — NOT
  // translations. EN_AE asks about atmosphere and hospitality;
  // EN_US asks about lifestyle and entertaining; DE_DE asks about
  // architectural precision.
  // ═════════════════════════════════════════════════════════════════
  'onboarding.intro.title': {
    IT_IT: 'Apriamo il progetto insieme.',
    EN_US: 'Let\'s shape your design journey.',
    EN_GB: 'Let us begin the project direction.',
    EN_AE: 'Let us curate your signature experience.',
    DE_DE: 'Definieren wir die architektonische Richtung.',
    FR_FR: 'Engageons cette direction éditoriale ensemble.',
    ES_ES: 'Comencemos juntos esta dirección.',
  },
  'onboarding.intro.body': {
    IT_IT: 'Sei domande misurate per leggere il progetto dal lato giusto. Non un modulo: un avvio editoriale.',
    EN_US: 'Six considered questions to understand how you want to live in the finished space.',
    EN_GB: 'Six measured questions to read the project from the right angle.',
    EN_AE: 'Six refined questions to compose the prestige direction of your commission.',
    DE_DE: 'Sechs präzise Fragen zur architektonischen Klärung Ihres Projekts.',
    FR_FR: 'Six questions mesurées pour révéler la direction éditoriale de ce projet.',
    ES_ES: 'Seis preguntas para descubrir la dirección sensorial del proyecto.',
  },
  'onboarding.space_intro.title': {
    IT_IT: 'Quali ambienti chiamerai a partecipare?',
    EN_US: 'Which spaces should this transformation include?',
    EN_GB: 'Which spaces should this project encompass?',
    EN_AE: 'Which spaces will hold your signature atmosphere?',
    DE_DE: 'Welche Räume sollen einbezogen werden?',
    FR_FR: 'Quels espaces composent cette direction ?',
    ES_ES: '¿Qué espacios componen esta dirección?',
  },
  'onboarding.space_intro.body': {
    IT_IT: 'Seleziona gli ambienti su cui interverremo. La materia comincia dalla soglia di ogni stanza.',
    EN_US: 'Pick the rooms you imagine entertaining in, living in, and relaxing in.',
    EN_GB: 'Select the rooms whose atmosphere matters most. Restraint over inventory.',
    EN_AE: 'Choose the spaces that will define the hospitality character of the residence.',
    DE_DE: 'Wählen Sie die Räume, deren konstruktive Qualität entscheidend ist.',
    FR_FR: 'Choisissez les espaces qui porteront la justesse du projet.',
    ES_ES: 'Selecciona los espacios donde la luz y la materia se encontrarán.',
  },
  'onboarding.style_intro.title': {
    IT_IT: 'Che atmosfera deve trasmettere lo spazio?',
    EN_US: 'How should this home make you feel every day?',
    EN_GB: 'What atmosphere should the project quietly communicate?',
    EN_AE: 'What impression should this space leave on guests?',
    DE_DE: 'Welche architektonischen Qualitäten zählen am meisten?',
    FR_FR: 'Quelle tenue devrait porter ce projet ?',
    ES_ES: '¿Qué atmósfera debería respirar este lugar?',
  },
  'onboarding.style_intro.body': {
    IT_IT: 'Scegli i registri che ti rappresentano — equilibrio materico, luce, calma.',
    EN_US: 'Choose the moods that capture your aspirational lifestyle.',
    EN_GB: 'Choose the moods that express your sense of considered restraint.',
    EN_AE: 'Choose the moods that articulate the prestige register of the space.',
    DE_DE: 'Wählen Sie die Stimmungen, die Ihre Materialdisziplin widerspiegeln.',
    FR_FR: 'Choisissez les registres qui révèlent votre sensibilité éditoriale.',
    ES_ES: 'Elige los registros que expresan tu calidez mediterránea.',
  },
  'onboarding.material_intro.title': {
    IT_IT: 'Quali materie ti chiamano?',
    EN_US: 'Which materials make this space feel personal?',
    EN_GB: 'Which materials should anchor the project?',
    EN_AE: 'Which materials should carry the sensorial signature?',
    DE_DE: 'Welche Materialien tragen die konstruktive Identität?',
    FR_FR: 'Quelles matières porteront la justesse du projet ?',
    ES_ES: '¿Qué materiales darán cuerpo a este lugar?',
  },
  'onboarding.material_intro.body': {
    IT_IT: 'Pietra, legno, metallo, tessuti — la materia parla prima del disegno.',
    EN_US: 'Stone, wood, metal, fabric — the textures that define elevated living.',
    EN_GB: 'Stone, wood, metal, fabric — the textures of layered sophistication.',
    EN_AE: 'Stone, bronze, lacquer, silk — the textures of statement materiality.',
    DE_DE: 'Stein, Holz, Metall, Stoff — Materialien, die Konstruktion sichtbar machen.',
    FR_FR: 'Pierre, bois, métal, tissu — les matières qui portent la culture du projet.',
    ES_ES: 'Piedra, madera, metal, tejido — las texturas mediterráneas del lugar.',
  },
  'onboarding.lifestyle_intro.title': {
    IT_IT: 'Come vivrai questo spazio?',
    EN_US: 'How do you imagine living in this space?',
    EN_GB: 'How should the spaces feel throughout the day?',
    EN_AE: 'What level of hospitality should this environment express?',
    DE_DE: 'Welche funktionale Qualität soll das Projekt tragen?',
    FR_FR: 'Comment vivrez-vous cet espace au quotidien ?',
    ES_ES: '¿Cómo se habitará este espacio cada día?',
  },
  'onboarding.lifestyle_intro.body': {
    IT_IT: 'Raccontaci il ritmo della casa: ricevere, cucinare, leggere, ritirarsi.',
    EN_US: 'Tell us about your lifestyle — entertaining, gathering, personal moments.',
    EN_GB: 'Tell us about the quiet rituals — reading, hosting close friends, retreating.',
    EN_AE: 'Tell us about the hospitality moments — private receptions, gatherings, atmosphere.',
    DE_DE: 'Erzählen Sie uns vom funktionalen Rhythmus des Hauses.',
    FR_FR: 'Décrivez-nous les rituels du lieu — recevoir, lire, se retirer.',
    ES_ES: 'Cuéntanos del ritmo de la casa — sobremesa, convivencia, descanso.',
  },
  'onboarding.review_intro.title': {
    IT_IT: 'Rivediamo la direzione insieme.',
    EN_US: 'Let\'s review your design journey.',
    EN_GB: 'Let us review the project direction.',
    EN_AE: 'Let us review your signature direction.',
    DE_DE: 'Lassen Sie uns die architektonische Richtung überprüfen.',
    FR_FR: 'Revoyons ensemble la direction du projet.',
    ES_ES: 'Revisemos juntos la dirección.',
  },
  'onboarding.review_intro.body': {
    IT_IT: 'L\'advisor riceverà questo brief e proporrà una direzione editoriale entro 48 ore.',
    EN_US: 'Your advisor will read this and propose a design direction within 48 hours.',
    EN_GB: 'Your advisor will read this and propose a considered direction within 48 hours.',
    EN_AE: 'Your atelier advisor will compose a signature direction within 48 hours.',
    DE_DE: 'Ihr Advisor schlägt innerhalb von 48 Stunden eine architektonische Richtung vor.',
    FR_FR: 'Votre advisor proposera une direction éditoriale sous 48 heures.',
    ES_ES: 'Tu advisor propondrá una dirección sensorial en 48 horas.',
  },

  // ═════════════════════════════════════════════════════════════════
  // SETTINGS · Cultural Perspective panel
  // ═════════════════════════════════════════════════════════════════
  'settings.cultural.kicker': {
    IT_IT: 'Prospettiva culturale',
    EN_US: 'Cultural perspective',
    EN_GB: 'Cultural perspective',
    EN_AE: 'Cultural perspective',
    DE_DE: 'Kulturelle Perspektive',
    FR_FR: 'Perspective culturelle',
    ES_ES: 'Perspectiva cultural',
  },
  'settings.cultural.title': {
    IT_IT: 'Come lo studio parla al mercato.',
    EN_US: 'How your studio speaks to its market.',
    EN_GB: 'How your studio addresses its market.',
    EN_AE: 'How your atelier speaks to its audience.',
    DE_DE: 'Wie Ihr Studio mit seinem Markt spricht.',
    FR_FR: 'Comment votre studio s\'adresse à son marché.',
    ES_ES: 'Cómo tu estudio habla a su mercado.',
  },
  'settings.cultural.body': {
    IT_IT: 'Non è una traduzione: è un riposizionamento culturale. La piattaforma parla con il registro emotivo, il vocabolario e il framing d\'investimento del mercato che scegli — non lo stesso testo in lingue diverse.',
    EN_US: 'Not a translation — a cultural repositioning. The platform speaks in the emotional register, vocabulary and investment framing of your chosen market.',
    EN_GB: 'Not a translation — a cultural repositioning. The platform speaks in the emotional register, vocabulary and investment framing native to your chosen market.',
    EN_AE: 'Not a translation — a cultural repositioning. The platform addresses your audience with the prestige register, hospitality vocabulary and signature framing native to your market.',
    DE_DE: 'Keine Übersetzung — eine kulturelle Neupositionierung. Die Plattform spricht mit dem emotionalen Register und Vokabular des gewählten Marktes.',
    FR_FR: 'Pas une traduction — un repositionnement culturel. La plateforme s\'exprime dans le registre éditorial du marché choisi.',
    ES_ES: 'No es una traducción — es un reposicionamiento cultural. La plataforma habla con el registro emocional y el vocabulario del mercado elegido.',
  },
  'settings.cultural.label.active': {
    IT_IT: 'Prospettiva attiva',
    EN_US: 'Active perspective',
    EN_GB: 'Active perspective',
    EN_AE: 'Active perspective',
    DE_DE: 'Aktive Perspektive',
    FR_FR: 'Perspective active',
    ES_ES: 'Perspectiva activa',
  },

  // ═════════════════════════════════════════════════════════════════
  // GLOBAL states
  // ═════════════════════════════════════════════════════════════════
  'global.loading': {
    IT_IT: 'Caricamento…',
    EN_US: 'Loading…',
    EN_GB: 'Loading…',
    EN_AE: 'Loading…',
    DE_DE: 'Wird geladen…',
    FR_FR: 'Chargement…',
    ES_ES: 'Cargando…',
  },
  'global.loading.generating': {
    IT_IT: 'Sto componendo la direzione…',
    EN_US: 'Composing your design direction…',
    EN_GB: 'Composing the project direction…',
    EN_AE: 'Curating your signature direction…',
    DE_DE: 'Komponiere die architektonische Ausrichtung…',
    FR_FR: 'Composition de la direction éditoriale…',
    ES_ES: 'Componiendo la dirección sensorial…',
  },
  'global.error': {
    IT_IT: 'Qualcosa non ha funzionato. Riprova fra un istante.',
    EN_US: 'Something didn\'t go through. Please try again.',
    EN_GB: 'Something didn\'t go through. Do try again.',
    EN_AE: 'A moment of disruption — please try again.',
    DE_DE: 'Etwas hat nicht funktioniert. Bitte erneut versuchen.',
    FR_FR: 'Quelque chose s\'est interrompu. Réessayez dans un instant.',
    ES_ES: 'Algo se interrumpió. Inténtalo de nuevo.',
  },
  'global.retry': {
    IT_IT: 'Riprova',
    EN_US: 'Try again',
    EN_GB: 'Try again',
    EN_AE: 'Try again',
    DE_DE: 'Erneut versuchen',
    FR_FR: 'Réessayer',
    ES_ES: 'Reintentar',
  },
};

/**
 * Resolve a semantic token for the given locale_code with market-intent-
 * preserving fallback. Returns a culturally-native string — never a
 * translation.
 *
 * @param {string} token       e.g. 'projects.empty.cta'
 * @param {string} localeCode  e.g. 'EN_AE'
 * @returns {string}
 */
export const resolveCopy = (token, localeCode, _extra = {}) => {
  const entry = REGISTRY[token];
  if (!entry) return `[${token}]`;
  if (entry[localeCode]) return entry[localeCode];
  for (const alt of (FALLBACK_CHAIN[localeCode] || [])) {
    if (entry[alt]) return entry[alt];
  }
  return entry.IT_IT || `[${token}]`;
};

export const listTokens = () => Object.keys(REGISTRY);
