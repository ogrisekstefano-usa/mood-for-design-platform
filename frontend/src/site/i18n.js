// MOOD for DESIGN™ — Site (public) i18n helper
// Mirrors future Blueprint CMS schema: content.section.key.locale
// All values must remain locale-keyed; this helper picks the right string.

export const SITE_LOCALES = [
  { code: 'it', label: 'IT', native: 'Italiano' },
  { code: 'en', label: 'EN', native: 'English' },
  { code: 'fr', label: 'FR', native: 'Français' },
  { code: 'de', label: 'DE', native: 'Deutsch' },
  { code: 'es', label: 'ES', native: 'Español' },
];

export const DEFAULT_SITE_LOCALE = 'it';
export const FALLBACK_SITE_LOCALE = 'en';

// Pick a localized value from a `{it,en,fr,de,es}` map.
// Falls back through: locale → fallback → first available → ''
export function pick(value, locale = DEFAULT_SITE_LOCALE, fallback = FALLBACK_SITE_LOCALE) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value !== 'object') return String(value);
  if (value[locale] != null) return value[locale];
  if (value[fallback] != null) return value[fallback];
  const first = Object.values(value).find((v) => v != null && v !== '');
  return first != null ? first : '';
}

export function detectInitialSiteLocale() {
  try {
    const stored = localStorage.getItem('mfd_site_locale');
    if (stored && SITE_LOCALES.some((l) => l.code === stored)) return stored;
    if (typeof navigator !== 'undefined' && navigator.language) {
      const short = navigator.language.toLowerCase().slice(0, 2);
      if (SITE_LOCALES.some((l) => l.code === short)) return short;
    }
  } catch (_) {}
  return DEFAULT_SITE_LOCALE;
}
