/**
 * ITER151 — Localized public route map.
 * Updated 2026-05-31 per LOCALE_ARCHITECTURE_DIRECTIVE: BCP-47 with region.
 *
 * Strategy: the DB stores ONE page per canonical key (audience, features…),
 * the router registers all localized slugs that resolve to the same React
 * component. Locale switching is a separate concern handled by LocaleContext.
 *
 * Keys here MUST match `platform_languages.code`. Legacy short codes
 * (`it`, `en-us`, `en-uk`) are kept for backward-compat aliases used by
 * earlier deeplinks; they resolve to the same paths as the canonical
 * region-tagged codes.
 */

export const LOCALIZED_SLUGS = {
  studio: {
    'it-IT': '/studio',
    'en-US': '/studio',
    'en-GB': '/studio',
    'fr-FR': '/studio',
    'de-DE': '/studio',
    'es-ES': '/studio',
    'es-MX': '/studio',
    'it':    '/studio',
    'en-us': '/studio',
    'en-uk': '/studio',
    fr:      '/studio',
    de:      '/studio',
    es:      '/studio',
  },
  audience: {
    'it-IT':  '/dedicato-a',
    'en-US':  '/audience',
    'en-GB':  '/audience',
    'fr-FR':  '/destine-a',
    'de-DE':  '/zielgruppe',
    'es-ES':  '/dirigido-a',
    // legacy aliases (no-op duplicates kept for previous links)
    'it':     '/dedicato-a',
    'en-us':  '/audience',
    'en-uk':  '/audience',
    fr:       '/destine-a',
    de:       '/zielgruppe',
    es:       '/dirigido-a',
  },
  features: {
    'it-IT':  '/caratteristiche',
    'en-US':  '/features',
    'en-GB':  '/features',
    'fr-FR':  '/fonctionnalites',
    'de-DE':  '/funktionen',
    'es-ES':  '/caracteristicas',
    'it':     '/caratteristiche',
    'en-us':  '/features',
    'en-uk':  '/features',
    fr:       '/fonctionnalites',
    de:       '/funktionen',
    es:       '/caracteristicas',
  },
  pricing: {
    'it-IT':  '/versioni-prezzi',
    'en-US':  '/pricing',
    'en-GB':  '/pricing',
    'fr-FR':  '/versions-prix',
    'de-DE':  '/versionen-preise',
    'es-ES':  '/versiones-precios',
    'it':     '/versioni-prezzi',
    'en-us':  '/pricing',
    'en-uk':  '/pricing',
    fr:       '/versions-prix',
    de:       '/versionen-preise',
    es:       '/versiones-precios',
  },
  training: {
    'it-IT':  '/formazione',
    'en-US':  '/training',
    'en-GB':  '/training',
    'fr-FR':  '/formation',
    'de-DE':  '/schulung',
    'es-ES':  '/formacion',
    'it':     '/formazione',
    'en-us':  '/training',
    'en-uk':  '/training',
    fr:       '/formation',
    de:       '/schulung',
    es:       '/formacion',
  },
  support: {
    'it-IT':  '/supporto',
    'en-US':  '/support',
    'en-GB':  '/support',
    'fr-FR':  '/support',
    'de-DE':  '/support',
    'es-ES':  '/soporte',
    'it':     '/supporto',
    'en-us':  '/support',
    'en-uk':  '/support',
    fr:       '/support',
    de:       '/support',
    es:       '/soporte',
  },
  login: {
    'it-IT':  '/accedi',
    'en-US':  '/login',
    'en-GB':  '/login',
    'fr-FR':  '/connexion',
    'de-DE':  '/anmelden',
    'es-ES':  '/acceso',
    'it':     '/accedi',
    'en-us':  '/login',
    'en-uk':  '/login',
    fr:       '/connexion',
    de:       '/anmelden',
    es:       '/acceso',
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
