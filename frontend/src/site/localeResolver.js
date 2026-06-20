/**
 * localeResolver.js — Shared locale resolution utility
 * ═══════════════════════════════════════════════════════
 *
 * CRITICAL RULE:
 * - Never collapse locale variants.
 * - EN-US and EN-GB are DISTINCT locales.
 * - ES-ES and ES-MX are DISTINCT locales.
 * - The DATABASE is the only source of truth for locale codes.
 * - Locale codes must remain exactly as stored in the database.
 *
 * Resolution order for a given fullLocale (e.g. "en-GB"):
 *   1. Exact match:       locale_content["en-GB"]
 *   2. Language fallback: locale_content["en"]   (legacy data uses short codes)
 *   3. Default fallback:  locale_content["_default"]
 *   4. Empty object {}
 *
 * This never maps en-GB → en-US or es-MX → es-ES.
 */

/**
 * Resolve a locale_content object for a given full locale code.
 * @param {object} localeContent  - The locale_content field from a CMS section
 * @param {string} fullLocale     - The full locale code, e.g. "en-US", "en-GB", "it-IT", "es-MX"
 * @returns {object} - Merged locale bag: _default + exact-locale content
 */
export function resolveLocaleBag(localeContent, fullLocale) {
  const lc = localeContent || {};
  const base = lc['_default'] || {};

  if (!fullLocale) return base;

  // 1. Exact match (database-authoritative)
  if (lc[fullLocale] && typeof lc[fullLocale] === 'object') {
    return { ...base, ...lc[fullLocale] };
  }

  // 2. Language-code-only fallback (handles legacy DB data stored as 'it', 'en', 'de', etc.)
  const langCode = fullLocale.split('-')[0]; // 'en-GB' → 'en', 'it-IT' → 'it'
  if (langCode && lc[langCode] && typeof lc[langCode] === 'object') {
    return { ...base, ...lc[langCode] };
  }

  // 3. _default only
  return base;
}

/**
 * Localized string resolver for label_i18n objects.
 * Used by nav labels, CTA labels, etc. stored in settings (not locale_content).
 *
 * Supports both:
 *   - "it-IT" / "en-US" / "en-GB" format (nav settings)
 *   - "it" / "en" format (legacy)
 *
 * @param {object|string} obj - The label object or plain string
 * @param {string} fullLocale - The full locale code
 * @returns {string}
 */
export function resolveLabel(obj, fullLocale) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;

  // 1. Exact match
  if (obj[fullLocale]) return obj[fullLocale];

  // 2. Language-code fallback (handles it-IT → it, en-US → en)
  const langCode = (fullLocale || '').split('-')[0];
  if (langCode && obj[langCode]) return obj[langCode];

  // 3. Uppercase variant (IT_IT, EN_US format from locale_profiles)
  const upperVariant = fullLocale.toUpperCase().replace('-', '_');
  if (obj[upperVariant]) return obj[upperVariant];

  // 4. _default
  if (obj['_default']) return obj['_default'];

  // 5. First available value
  const vals = Object.values(obj).filter((v) => typeof v === 'string' && v);
  return vals[0] || '';
}

/**
 * Extract the full locale from SiteContext without truncation.
 * SiteContext may return 'it-IT', 'en-US', 'en-GB', etc.
 * Never call .slice(0, 2) on a locale.
 *
 * @param {string|null} siteLocale - From useSite().locale
 * @param {string} [fallback]     - Default if siteLocale is absent
 * @returns {string} Full locale code, e.g. 'it-IT'
 */
export function normalizeLocale(siteLocale, fallback = 'it-IT') {
  if (!siteLocale) return fallback;
  // Normalize separator: 'it_IT' → 'it-IT'  (locale_profiles use underscore)
  return siteLocale.replace('_', '-');
}

/**
 * Short language code for backward-compatible comparisons.
 * Returns only the language part (first segment) without collapsing variants.
 * e.g. 'en-US' → 'en', 'en-GB' → 'en', 'it-IT' → 'it'
 *
 * NOTE: This should NOT be used to decide content. Use resolveLocaleBag instead.
 * Use langCode ONLY for UI direction logic (RTL), font selection, etc.
 *
 * @param {string} fullLocale
 * @returns {string}
 */
export function langCode(fullLocale) {
  return (fullLocale || 'it').split('-')[0].toLowerCase();
}
