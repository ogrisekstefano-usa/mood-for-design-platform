/**
 * ITER151 — Localized public route map.
 * Maps each canonical page (DB page_key) to all its localized URL slugs.
 *
 * Strategy: the DB stores ONE page per canonical key (audience, features…),
 * the router registers all localized slugs that resolve to the same React
 * component. Locale switching is a separate concern handled by LocaleContext.
 */

export const LOCALIZED_SLUGS = {
  audience: {
    it:      '/dedicato-a',
    'en-us': '/audience',
    'en-uk': '/audience',
    fr:      '/destine-a',
    de:      '/zielgruppe',
    es:      '/dirigido-a',
  },
  features: {
    it:      '/caratteristiche',
    'en-us': '/features',
    'en-uk': '/features',
    fr:      '/fonctionnalites',
    de:      '/funktionen',
    es:      '/caracteristicas',
  },
  pricing: {
    it:      '/versioni-prezzi',
    'en-us': '/pricing',
    'en-uk': '/pricing',
    fr:      '/versions-prix',
    de:      '/versionen-preise',
    es:      '/versiones-precios',
  },
  training: {
    it:      '/formazione',
    'en-us': '/training',
    'en-uk': '/training',
    fr:      '/formation',
    de:      '/schulung',
    es:      '/formacion',
  },
  support: {
    it:      '/supporto',
    'en-us': '/support',
    'en-uk': '/support',
    fr:      '/support',
    de:      '/support',
    es:      '/soporte',
  },
  login: {
    it:      '/accedi',
    'en-us': '/login',
    'en-uk': '/login',
    fr:      '/connexion',
    de:      '/anmelden',
    es:      '/acceso',
  },
};

/** Returns a deduplicated list of all paths for a given canonical key. */
export const getAllSlugs = (key) => {
  const set = new Set(Object.values(LOCALIZED_SLUGS[key] || {}));
  return Array.from(set);
};

/** Reverse lookup: from a current URL path, find the canonical key. */
export const slugToCanonical = (path) => {
  for (const [key, locales] of Object.entries(LOCALIZED_SLUGS)) {
    if (Object.values(locales).includes(path)) return key;
  }
  return null;
};
