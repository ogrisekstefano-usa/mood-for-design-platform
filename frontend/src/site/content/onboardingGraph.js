// ──────────────────────────────────────────────────────────────────────
// MOOD for DESIGN™ — Contextual Project Discovery Engine (Phase V)
// ──────────────────────────────────────────────────────────────────────
//
// This module turns the previously linear 7-step wizard into an **adaptive
// question graph**. Every answer can change downstream visibility, options,
// validation, copy and progress.
//
// ZERO hardcoded UI: every label and option is locale-keyed { it, en, fr, de, es }
// just like onboardingContent. The graph layers ON TOP of onboardingContent.js
// (we do not rewrite it — we extend it with category + adaptive rules).
//
// Design philosophy:
//   • A user who picks "Office" must NEVER see "Bedroom"
//   • The wizard feels like a guided discovery, not a CRM survey
//   • Every step has a `relevance_tags` and `visible_when` predicate
//   • Progress count adapts: skipped steps don't inflate the total
//
import { onboardingContent } from './onboarding.js';

const t = (it, en, fr, de, es) => ({ it, en, fr, de, es });

// ─── 1. PROJECT CATEGORY MAP ────────────────────────────────────────────
// Maps each step-1 project_type option to a high-level category. Used
// across every downstream step for branching + relevance filtering.

export const PROJECT_CATEGORY = {
  // residential
  apartment:     'residential',
  villa:         'residential',
  penthouse:     'residential',
  // hospitality
  boutique_hotel:'hospitality',
  restaurant:    'hospitality',
  wellness:      'hospitality',
  // commercial
  retail:        'commercial',
  office:        'commercial',
  // open
  other:         'other',
};

export const categoryFor = (projectType) =>
  PROJECT_CATEGORY[projectType] || 'other';

// ─── 2. CATEGORY-AWARE SPACES ───────────────────────────────────────────
// Replaces the legacy Step 2 (which always showed all 9 residential spaces).
// Each category has its OWN curated palette of spaces. NO crossover.

const SPACES_BY_CATEGORY = {
  residential: [
    { id: 'living',      label: t('Soggiorno',         'Living room',     'Salon',                'Wohnzimmer',         'Sala de estar') },
    { id: 'kitchen',     label: t('Cucina',            'Kitchen',         'Cuisine',              'Küche',              'Cocina') },
    { id: 'dining',      label: t('Sala da pranzo',    'Dining room',     'Salle à manger',       'Esszimmer',          'Comedor') },
    { id: 'master',      label: t('Camera padronale',  'Master bedroom',  'Chambre principale',   'Hauptschlafzimmer',  'Dormitorio principal') },
    { id: 'bedroom',     label: t('Altra camera',      'Other bedroom',   'Autre chambre',        'Weiteres Schlafzimmer','Otro dormitorio') },
    { id: 'bathroom',    label: t('Bagno',             'Bathroom',        'Salle de bain',        'Badezimmer',         'Baño') },
    { id: 'study',       label: t('Studio / Home office','Study / Home office','Bureau à domicile','Arbeitszimmer',     'Estudio') },
    { id: 'walkin',      label: t('Cabina armadio',    'Walk-in closet',  'Dressing',             'Ankleidezimmer',     'Vestidor') },
    { id: 'outdoor',     label: t('Esterni / Terrazza','Outdoor / Terrace','Extérieur / Terrasse','Außenbereich',       'Exterior / Terraza') },
    { id: 'entrance',    label: t('Ingresso',          'Entrance',        'Entrée',               'Eingang',            'Entrada') },
  ],
  hospitality: [
    { id: 'suites',      label: t('Suite / Camere',    'Suites / Rooms',  'Suites / Chambres',    'Suiten / Zimmer',    'Suites / Habitaciones') },
    { id: 'lobby',       label: t('Lobby / Reception', 'Lobby / Reception','Lobby / Réception',   'Lobby / Empfang',    'Lobby / Recepción') },
    { id: 'restaurant',  label: t('Sala ristorante',   'Dining area',     'Salle de restaurant',  'Restaurantbereich',  'Sala de restaurante') },
    { id: 'bar',         label: t('Bar / Lounge',      'Bar / Lounge',    'Bar / Salon',          'Bar / Lounge',       'Bar / Lounge') },
    { id: 'spa',         label: t('Spa / Wellness',    'Spa / Wellness',  'Spa / Bien-être',      'Spa / Wellness',     'Spa / Bienestar') },
    { id: 'pool',        label: t('Piscina',           'Pool',            'Piscine',              'Pool',               'Piscina') },
    { id: 'event',       label: t('Sala eventi',       'Event hall',      'Salle évènementielle', 'Eventbereich',       'Sala de eventos') },
    { id: 'outdoor_hosp',label: t('Spazi esterni',     'Outdoor areas',   'Espaces extérieurs',   'Außenbereiche',      'Áreas exteriores') },
    { id: 'kitchen_hosp',label: t('Cucina professionale','Pro kitchen / BoH','Cuisine professionnelle','Profiküche',     'Cocina profesional') },
  ],
  commercial: [
    { id: 'reception',   label: t('Reception',         'Reception',       'Réception',            'Empfang',            'Recepción') },
    { id: 'open_space',  label: t('Open space',        'Open workspace',  'Open space',           'Open Space',         'Open space') },
    { id: 'meeting',     label: t('Sale riunioni',     'Meeting rooms',   'Salles de réunion',    'Besprechungsräume',  'Salas de reunión') },
    { id: 'executive',   label: t('Uffici dirigenziali','Executive offices','Bureaux de direction','Geschäftsführungsbüros','Despachos directivos') },
    { id: 'lounge_corp', label: t('Lounge / Break',    'Lounge / Break area','Lounge / Pause',   'Lounge / Pausenraum','Lounge / Descanso') },
    { id: 'showroom',    label: t('Showroom',          'Showroom',        'Showroom',             'Showroom',           'Showroom') },
    { id: 'sales_floor', label: t('Area vendita',      'Sales floor',     'Surface de vente',     'Verkaufsfläche',     'Área de venta') },
    { id: 'fitting',     label: t('Camerini',          'Fitting rooms',   'Cabines d\u2019essayage','Umkleidekabinen',  'Probadores') },
    { id: 'storage',     label: t('Magazzino',         'Storage / BoH',   'Stockage',             'Lager / BoH',        'Almacén') },
  ],
  other: [
    { id: 'space_a',     label: t('Spazio principale', 'Primary space',   'Espace principal',     'Hauptbereich',       'Espacio principal') },
    { id: 'space_b',     label: t('Spazio secondario', 'Secondary space', 'Espace secondaire',    'Sekundärer Bereich', 'Espacio secundario') },
    { id: 'space_c',     label: t('Altro',             'Other',           'Autre',                'Sonstiges',          'Otro') },
  ],
};

export const relevantSpacesFor = (projectType) =>
  SPACES_BY_CATEGORY[categoryFor(projectType)] || SPACES_BY_CATEGORY.other;

// ─── 3. CATEGORY-AWARE STEP COPY ────────────────────────────────────────
// Same step shape (eyebrow/title/body) but rewritten for the active
// category so the user feels heard. Step 2 example: "Which rooms..." for
// residential, "Which guest areas..." for hospitality, etc.

const STEP_COPY_BY_CATEGORY = {
  step2: {
    residential: {
      eyebrow: t('Gli ambienti',  'The rooms',           'Les pièces',                  'Die Räume',                    'Las habitaciones'),
      title:   t('Quali ambienti vuoi trasformare?', 'Which rooms would you like to transform?', 'Quelles pièces voulez-vous transformer ?', 'Welche Räume möchten Sie verwandeln?', '¿Qué habitaciones quieres transformar?'),
      body:    t('Seleziona tutti gli ambienti che fanno parte del progetto.', 'Select every room that\u2019s part of the project.', 'Sélectionnez toutes les pièces concernées.', 'Wählen Sie alle Räume, die zum Projekt gehören.', 'Selecciona todas las habitaciones del proyecto.'),
    },
    hospitality: {
      eyebrow: t('Spazi & guest experience', 'Guest spaces',   'Espaces invités',         'Gästebereiche',                'Espacios huéspedes'),
      title:   t('Quali spazi vivranno i tuoi ospiti?', 'Which spaces will your guests experience?', 'Quels espaces vos hôtes vivront-ils ?', 'Welche Bereiche erleben Ihre Gäste?', '¿Qué espacios vivirán tus huéspedes?'),
      body:    t('Seleziona gli ambienti che vuoi raccontare con noi.', 'Choose the areas you want to design with us.', 'Choisissez les zones à concevoir avec nous.', 'Wählen Sie die Bereiche, die wir mit Ihnen gestalten sollen.', 'Elige las áreas a diseñar.'),
    },
    commercial: {
      eyebrow: t('Spazi di lavoro',  'Work spaces',     'Espaces de travail',           'Arbeitsbereiche',              'Espacios de trabajo'),
      title:   t('Quali ambienti aziendali vuoi ripensare?', 'Which workspaces would you like to rethink?', 'Quels espaces souhaitez-vous repenser ?', 'Welche Arbeitsbereiche möchten Sie neu denken?', '¿Qué espacios de trabajo quieres reimaginar?'),
      body:    t('Seleziona gli spazi che fanno parte del progetto.', 'Pick every space that\u2019s part of the brief.', 'Sélectionnez tous les espaces du projet.', 'Wählen Sie alle Bereiche des Briefs.', 'Selecciona todos los espacios del brief.'),
    },
    other: {
      eyebrow: t('Gli spazi',     'The spaces',         'Les espaces',                  'Die Bereiche',                 'Los espacios'),
      title:   t('Quali spazi vuoi trasformare?', 'Which spaces would you like to transform?', 'Quels espaces voulez-vous transformer ?', 'Welche Bereiche möchten Sie verwandeln?', '¿Qué espacios quieres transformar?'),
      body:    t('Seleziona gli ambienti che vuoi farci considerare.', 'Select the spaces you\u2019d like us to consider.', 'Sélectionnez les espaces à considérer.', 'Wählen Sie alle Bereiche zur Berücksichtigung.', 'Selecciona los espacios a considerar.'),
    },
  },
  step6: {
    residential: {
      title:  t('Come vorresti vivere questo spazio?', 'How would you like to live in this space?', 'Comment souhaitez-vous habiter ce lieu ?', 'Wie möchten Sie diesen Raum bewohnen?', '¿Cómo te gustaría vivir este espacio?'),
      fieldLabels: {
        feel:       t('Come vuoi sentirti tornando a casa?', 'How do you want to feel when you walk in?', 'Comment voulez-vous vous sentir en rentrant ?', 'Wie möchten Sie sich beim Heimkommen fühlen?', '¿Cómo quieres sentirte al entrar?'),
        inspires:   t('Cosa ti ispira nel tuo quotidiano?', 'What inspires you day-to-day?', 'Qu\u2019est-ce qui vous inspire au quotidien ?', 'Was inspiriert Sie im Alltag?', '¿Qué te inspira a diario?'),
        atmosphere: t('Descrivi l\u2019atmosfera che immagini', 'Describe the atmosphere you imagine', 'Décrivez l\u2019atmosphère que vous imaginez', 'Beschreiben Sie die Atmosphäre', 'Describe la atmósfera'),
      },
    },
    hospitality: {
      title:  t('Quale esperienza vuoi regalare ai tuoi ospiti?', 'What experience do you want to offer your guests?', 'Quelle expérience voulez-vous offrir à vos hôtes ?', 'Welches Erlebnis möchten Sie Ihren Gästen bieten?', '¿Qué experiencia quieres ofrecer a tus huéspedes?'),
      fieldLabels: {
        feel:       t('Cosa vuoi che gli ospiti provino al primo sguardo?', 'What should guests feel at first glance?', 'Que doivent ressentir vos hôtes au premier regard ?', 'Was sollen Gäste auf den ersten Blick spüren?', '¿Qué deben sentir tus huéspedes al llegar?'),
        inspires:   t('Quale carattere o storia vuoi raccontare?', 'What character or story do you want to tell?', 'Quel caractère ou récit voulez-vous transmettre ?', 'Welchen Charakter oder welche Geschichte erzählen?', '¿Qué carácter o historia quieres contar?'),
        atmosphere: t('Descrivi l\u2019atmosfera dello spazio', 'Describe the atmosphere of the space', 'Décrivez l\u2019atmosphère du lieu', 'Beschreiben Sie die Raumatmosphäre', 'Describe la atmósfera del espacio'),
      },
    },
    commercial: {
      title:  t('Come vuoi che si lavori in questo spazio?', 'How should people work in this space?', 'Comment voulez-vous qu\u2019on travaille ici ?', 'Wie soll in diesem Raum gearbeitet werden?', '¿Cómo quieres que se trabaje aquí?'),
      fieldLabels: {
        feel:       t('Cosa devono provare i tuoi collaboratori?', 'What should your people feel?', 'Que doivent ressentir vos collaborateurs ?', 'Was sollen Ihre Mitarbeitenden spüren?', '¿Qué deben sentir tus colaboradores?'),
        inspires:   t('Quali valori vuoi che lo spazio comunichi?', 'Which values should the space communicate?', 'Quelles valeurs voulez-vous transmettre ?', 'Welche Werte soll der Raum vermitteln?', '¿Qué valores debe transmitir el espacio?'),
        atmosphere: t('Descrivi l\u2019atmosfera che immagini', 'Describe the atmosphere you imagine', 'Décrivez l\u2019atmosphère que vous imaginez', 'Beschreiben Sie die Atmosphäre', 'Describe la atmósfera'),
      },
    },
    other: {
      title:  t('Raccontaci la visione del progetto', 'Tell us the vision behind the project', 'Racontez-nous la vision du projet', 'Erzählen Sie uns die Projektvision', 'Cuéntanos la visión del proyecto'),
      fieldLabels: null, // fall back to onboardingContent.step6.fields[].label
    },
  },
};

export const stepCopyFor = (stepKey, projectType, locale, fallbackContent) => {
  const cat = categoryFor(projectType);
  const adaptive = STEP_COPY_BY_CATEGORY[stepKey]?.[cat];
  if (!adaptive) return fallbackContent;
  return { ...fallbackContent, ...adaptive };
};

// ─── 4. QUESTION GRAPH ──────────────────────────────────────────────────
// Single source of truth for which steps are visible + their order +
// their validation, given the current answer state.
//
// Step shape:
//   { id, key, type, visible_when?, required, relevance_tags }
//
// `visible_when(state)` → boolean. If false, the step is skipped entirely.
// `required(state)`     → boolean — controls the Continue button gate.

export const STEP_GRAPH = [
  {
    id: 1,
    key: 'project_type',
    type: 'project_type',
    relevance_tags: ['intent'],
    visible_when: () => true,
    required: (s) => !!s.project_type,
  },
  {
    id: 2,
    key: 'spaces',
    type: 'spaces',
    relevance_tags: ['category', 'spaces'],
    visible_when: () => true,
    required: (s) => (s.spaces || []).length > 0,
  },
  {
    id: 3,
    key: 'moods',
    type: 'moods',
    relevance_tags: ['style', 'emotion'],
    visible_when: () => true,
    required: (s) => (s.moods || []).length > 0,
  },
  {
    id: 4,
    key: 'inspirations',
    type: 'inspirations',
    relevance_tags: ['references'],
    visible_when: () => true,
    required: () => true, // step 4 always optional
  },
  {
    id: 5,
    key: 'materials',
    type: 'materials',
    relevance_tags: ['materials', 'palette'],
    visible_when: () => true,
    required: (s) => (s.materials || []).length + (s.colors || []).length > 0,
  },
  {
    id: 6,
    key: 'lifestyle',
    type: 'lifestyle',
    relevance_tags: ['lifestyle', 'narrative'],
    visible_when: () => true,
    required: () => true, // free text — always optional
  },
  {
    id: 7,
    key: 'budget',
    type: 'budget',
    relevance_tags: ['budget', 'timeline'],
    visible_when: () => true,
    required: (s) =>
      !!s.budget?.timeline && !!s.budget?.amount && !!s.budget?.startDate,
  },
];

// ─── 5. ENGINE PRIMITIVES ───────────────────────────────────────────────

export const visibleSteps = (state) =>
  STEP_GRAPH.filter((step) => step.visible_when(state));

export const visibleStepAt = (state, index) => visibleSteps(state)[index];

export const totalVisibleSteps = (state) => visibleSteps(state).length;

export const indexOfStepId = (state, stepId) =>
  visibleSteps(state).findIndex((s) => s.id === stepId);

export const isStepRequiredMet = (state, stepId) => {
  const step = STEP_GRAPH.find((s) => s.id === stepId);
  return step ? step.required(state) : true;
};

// Adaptive progress: percentage based on currently-visible flow,
// not on the legacy hardcoded 7-step constant.
export const progressPercent = (state, currentStepId) => {
  const list = visibleSteps(state);
  const idx = list.findIndex((s) => s.id === currentStepId);
  if (idx < 0) return 100;
  return Math.round(((idx + 0.5) / list.length) * 100);
};

// ─── 6. AI BRIEFING SHAPE ───────────────────────────────────────────────
// Pre-baked client-side summary that mirrors what the backend AI summarizer
// will produce. Used as both (a) the genesis-overlay caption and (b) the
// fallback shape if the AI call fails. NEVER shown to the client as raw text.

export const buildBriefingShape = (state, locale) => {
  const cat = categoryFor(state.project_type);
  const spaceLabels = relevantSpacesFor(state.project_type)
    .filter((sp) => (state.spaces || []).includes(sp.id))
    .map((sp) => sp.label?.[locale] || sp.label?.en || sp.id);
  const moods = (state.moods || []);
  const materials = (state.materials || []);
  const colors = (state.colors || []);
  return {
    project_intent: state.project_type,
    project_category: cat,
    spaces: spaceLabels,
    stylistic_direction: moods,
    materials_priority: materials,
    palette_priority: colors,
    emotional_tone: state.lifestyle?.feel || null,
    inspirations_sources: state.lifestyle?.inspires || null,
    atmosphere: state.lifestyle?.atmosphere || null,
    complexity_hint: spaceLabels.length >= 5 ? 'multi-area' : spaceLabels.length >= 2 ? 'mid' : 'focused',
    locale,
  };
};

// ─── 7. RESOLVED CONTENT HELPERS ────────────────────────────────────────
// Sugar accessors used by the wizard renderer.

const IMG_BY_CATEGORY = {
  residential: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=85',
  hospitality: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=85',
  commercial:  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=85',
  other:       'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=85',
};

export const resolveStep2Content = (state, locale) => {
  const base = onboardingContent.step2;
  const cat = categoryFor(state.project_type);
  return {
    ...stepCopyFor('step2', state.project_type, locale, base),
    options: relevantSpacesFor(state.project_type),
    image: IMG_BY_CATEGORY[cat] || base.image,
  };
};

export const resolveStep6Content = (state, locale) => {
  const base = onboardingContent.step6;
  const merged = stepCopyFor('step6', state.project_type, locale, base);
  const adaptiveLabels = STEP_COPY_BY_CATEGORY.step6?.[categoryFor(state.project_type)]?.fieldLabels;
  if (!adaptiveLabels) return merged;
  return {
    ...merged,
    fields: base.fields.map((f) => ({
      ...f,
      label: adaptiveLabels[f.id] || f.label,
    })),
  };
};
