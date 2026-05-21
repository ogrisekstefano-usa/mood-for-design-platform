/**
 * Translation Memory™ — Linguistic Design System foundation.
 * Sprint I18N-02.
 *
 * The single canonical source for brand-protected terminology.
 * These terms must appear identically across all locales because they
 * represent the MOOD for DESIGN™ vocabulary itself, not interface
 * labels that can be culturally repositioned.
 *
 * Rules:
 *   · BRAND_TERMS: never translated. The trademark IS the term.
 *   · TONE_PROFILES: locale-specific editorial direction. Defines
 *     register, sentence rhythm, and the words to avoid.
 *   · SEMANTIC_LOCKS: canonical wordings shared across the app for
 *     concepts that must read consistently (chapter states, lifecycle
 *     labels, etc.). Each entry is read by every translation file.
 *
 * Consumers:
 *   · `tm(term, locale?)`  returns the canonical brand term as-is.
 *   · `toneFor(locale)`    returns the tone profile for editorial copy.
 *   · `semanticLock(key, locale)` returns the locked translation.
 *
 * NEVER translate:
 *   - product/collection names
 *   - designer names
 *   - material codes
 *   - official brand wording (™ terms below)
 */

/** Brand-protected ™ terms — invariant across all locales. */
export const BRAND_TERMS = Object.freeze({
  designJourney:      'Design Journey™',
  designJourneyOs:    'Design Journey OS™',
  materialDirection:  'Material Direction™',
  siteEvolution:      'Site Evolution™',
  sharedThoughts:     'Shared Thoughts™',
  journeyArchive:     'Journey Archive™',
  brandAtlas:         'Brand Atlas™',
  studioIdentity:     'Studio Identity™',
  culturalEdition:    'Cultural Edition™',
  certifiedClosure:   'Certified Closure™',
  milestoneDialogue:  'Milestone Dialogue™',
  studioPulse:        'Studio Pulse™',
  blueprintCommand:   'Blueprint Command Center™',
});

/**
 * Tone profiles — guide the EDITORIAL register of every t() string.
 * These are NOT consumed at runtime by t() itself; they exist for the
 * authoring discipline of translators and contributors.
 */
export const TONE_PROFILES = Object.freeze({
  'it':    { register: 'sober editorial italian', avoid: ['SaaS', 'marketing luxury', 'colloquial'], voice: 'editorial atelier' },
  'en-US': { register: 'architectural calm luxury', avoid: ['corporate SaaS', 'AI literal', 'marketing'], voice: 'design publishing' },
  'en-GB': { register: 'architectural calm luxury', avoid: ['corporate SaaS', 'AI literal', 'marketing'], voice: 'design publishing' },
  'fr':    { register: 'restrained luxe éditorial', avoid: ['traduction littérale', 'marketing'], voice: 'atelier d\'architecture' },
  'de':    { register: 'präzise editorial', avoid: ['Marketing-Floskeln', 'wörtliche Übersetzung'], voice: 'architektonische Sprache' },
  'es':    { register: 'editorial sereno', avoid: ['marketing', 'traducción literal'], voice: 'atelier arquitectónico' },
  'ar':    { register: 'premium architectural arabic', avoid: ['over-poetic', 'machine literal', 'western direct'], voice: 'restrained architectural' },
});

/**
 * Semantic locks — canonical translations of recurring concepts.
 * If a concept appears in 3+ places it lives here, not in per-page
 * strings, so the term reads identically everywhere.
 *
 * Each lock entry is locale-keyed BCP-47.
 */
export const SEMANTIC_LOCKS = Object.freeze({
  // Lifecycle — what the client sees on the journey card pill.
  'lifecycle.conversation_open': {
    'it': 'La conversazione è iniziata',
    'en-US': 'The conversation has opened',
    'en-GB': 'The conversation has opened',
    'fr': 'La conversation s\'ouvre',
    'de': 'Das Gespräch hat begonnen',
    'es': 'La conversación ha comenzado',
    'ar': 'بدأ الحوار',
  },
  'lifecycle.in_progress': {
    'it': 'Il viaggio è in corso',
    'en-US': 'The journey is unfolding',
    'en-GB': 'The journey is unfolding',
    'fr': 'Le parcours se déploie',
    'de': 'Die Reise entfaltet sich',
    'es': 'El viaje se está desarrollando',
    'ar': 'الرحلة جارية',
  },
  'lifecycle.archived': {
    'it': 'Memoria della casa',
    'en-US': 'Living memory of the home',
    'en-GB': 'Living memory of the home',
    'fr': 'Mémoire vivante de la maison',
    'de': 'Lebendiges Hausgedächtnis',
    'es': 'Memoria viva de la casa',
    'ar': 'ذاكرة البيت الحيّة',
  },
  // Chapter state in the Dossier.
  'chapter.approved': {
    'it': 'Capitolo approvato',
    'en-US': 'Chapter approved',
    'en-GB': 'Chapter approved',
    'fr': 'Chapitre approuvé',
    'de': 'Kapitel freigegeben',
    'es': 'Capítulo aprobado',
    'ar': 'فصل معتمد',
  },
  'chapter.closed': {
    'it': 'Capitolo chiuso',
    'en-US': 'Chapter closed',
    'en-GB': 'Chapter closed',
    'fr': 'Chapitre clos',
    'de': 'Kapitel abgeschlossen',
    'es': 'Capítulo cerrado',
    'ar': 'فصل مغلق',
  },
  'chapter.in_progress': {
    'it': 'Capitolo in lavorazione',
    'en-US': 'Chapter in progress',
    'en-GB': 'Chapter in progress',
    'fr': 'Chapitre en cours',
    'de': 'Kapitel in Arbeit',
    'es': 'Capítulo en curso',
    'ar': 'فصل قيد العمل',
  },
});

const BCP47_BASES = ['en-US', 'en-GB', 'it', 'fr', 'de', 'es', 'ar'];

const normaliseLocale = (l) => {
  if (!l) return 'en-US';
  if (BCP47_BASES.includes(l)) return l;
  if (l.startsWith('en')) return 'en-US';
  if (l.startsWith('it')) return 'it';
  if (l.startsWith('fr')) return 'fr';
  if (l.startsWith('de')) return 'de';
  if (l.startsWith('es')) return 'es';
  if (l.startsWith('ar')) return 'ar';
  return 'en-US';
};

/** Return a brand-protected term. Always invariant. `locale` is ignored. */
export function tm(termKey /*, locale */) {
  return BRAND_TERMS[termKey] || termKey;
}

/** Return the tone profile for a given locale. */
export function toneFor(locale) {
  return TONE_PROFILES[normaliseLocale(locale)] || TONE_PROFILES['en-US'];
}

/** Return the semantic-lock translation for a key+locale. */
export function semanticLock(key, locale) {
  const lock = SEMANTIC_LOCKS[key];
  if (!lock) return key;
  return lock[normaliseLocale(locale)] || lock['en-US'] || key;
}

export default { tm, toneFor, semanticLock, BRAND_TERMS, TONE_PROFILES, SEMANTIC_LOCKS };
