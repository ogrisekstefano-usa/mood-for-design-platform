/**
 * locale-copy.js — Semantic Cultural Copy Registry (Phase P0.2.A foundation).
 *
 * NOT a translation table.
 *
 * Each entry is a *semantically equivalent* phrase that has been REWRITTEN
 * natively for each locale_profile — preserving the cultural register
 * (emotional tone, luxury framing, hospitality vocabulary) that defines
 * the locale.
 *
 * Compare:
 *
 *   EN_US `projects.empty.cta`:  "Start your next design journey"
 *   EN_GB `projects.empty.cta`:  "Begin a new project direction"
 *   EN_AE `projects.empty.cta`:  "Shape a new signature commission"
 *   IT_IT `projects.empty.cta`:  "Apri un nuovo percorso progettuale"
 *   DE_DE `projects.empty.cta`:  "Definieren Sie eine neue Richtung"
 *   FR_FR `projects.empty.cta`:  "Engagez une nouvelle direction"
 *   ES_ES `projects.empty.cta`:  "Inicia una nueva dirección"
 *
 * Same meaning, completely different cultural framing.
 *
 * The registry will be progressively expanded in P0.2.B → P0.2.D and
 * eventually become AI-regenerable (the LLM gets the token name + locale
 * profile and produces culturally-native copy on demand).
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
  // ── Dashboard ────────────────────────────────────────────────────
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

  // ── Projects empty state ─────────────────────────────────────────
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
    EN_US: 'Start your next design journey',
    EN_GB: 'Begin a new project direction',
    EN_AE: 'Shape a new signature commission',
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
};

/**
 * Resolve a semantic token for the given locale_code, with
 * market-intent-preserving fallback. Returns a culturally-native
 * string — never a translation.
 *
 * @param {string} token        e.g. 'projects.empty.cta'
 * @param {string} localeCode   e.g. 'EN_AE'
 * @param {object} [extra]      optional interpolation (reserved for later)
 * @returns {string}
 */
export const resolveCopy = (token, localeCode, _extra = {}) => {
  const entry = REGISTRY[token];
  if (!entry) return `[${token}]`;
  if (entry[localeCode]) return entry[localeCode];
  for (const alt of (FALLBACK_CHAIN[localeCode] || [])) {
    if (entry[alt]) return entry[alt];
  }
  // last resort — never crash UI: return the registry's IT_IT entry, or the
  // token name in brackets so QA can spot missing copy.
  return entry.IT_IT || `[${token}]`;
};

export const listTokens = () => Object.keys(REGISTRY);
