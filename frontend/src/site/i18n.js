// MOOD for DESIGN™ — UNIFIED Locale System
// Single source of truth for locale codes shared between Blueprint app and public site.
// Mirrors future DB table `cms_languages(tenant_id, code, label, native, enabled, is_master)`.
// Architecture invariant: NO duplicate locale lists anywhere in the codebase.

// Canonical locale registry — must mirror BlueprintContext.FALLBACK_LOCALES exactly.
export const PLATFORM_LOCALES = [
  { code: 'en-US', base: 'en', label: 'EN', native: 'English (US)' },
  { code: 'en-GB', base: 'en', label: 'EN', native: 'English (UK)' },
  { code: 'it',    base: 'it', label: 'IT', native: 'Italiano' },
  { code: 'fr',    base: 'fr', label: 'FR', native: 'Français' },
  { code: 'de',    base: 'de', label: 'DE', native: 'Deutsch' },
  { code: 'es',    base: 'es', label: 'ES', native: 'Español' },
];

// Public site exposes a deduplicated set keyed by base — one switcher entry per language.
// Tenants may later enable/disable specific entries; for now all 5 base languages are on.
export const SITE_LOCALES = [
  { code: 'it',    label: 'IT', native: 'Italiano' },
  { code: 'en',    label: 'EN', native: 'English' },
  { code: 'fr',    label: 'FR', native: 'Français' },
  { code: 'de',    label: 'DE', native: 'Deutsch' },
  { code: 'es',    label: 'ES', native: 'Español' },
];

// SHARED storage key with Blueprint — DO NOT duplicate.
export const LOCALE_STORAGE_KEY = 'mfd_locale';
export const DEFAULT_PLATFORM_LOCALE = 'it'; // tenant brand default; Blueprint can override
export const FALLBACK_LOCALE = 'en';

// Normalize any incoming locale code (Blueprint BCP-47 or 2-char) to a base 2-char code
// used to look up content in locale-keyed config maps.
export function normalizeLocale(code) {
  if (!code || typeof code !== 'string') return DEFAULT_PLATFORM_LOCALE;
  const match = PLATFORM_LOCALES.find((l) => l.code === code);
  if (match) return match.base;
  // Fallback: split BCP-47 and use first segment if known
  const base = code.split('-')[0].toLowerCase();
  if (SITE_LOCALES.find((l) => l.code === base)) return base;
  return DEFAULT_PLATFORM_LOCALE;
}

// Detect initial site locale honoring Blueprint's shared storage key.
export function detectInitialSiteLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored) {
      const normalized = normalizeLocale(stored);
      if (SITE_LOCALES.find((l) => l.code === normalized)) return normalized;
    }
  } catch (_) {}
  return DEFAULT_PLATFORM_LOCALE;
}

// CONTROLLED FALLBACK CHAIN
// 1. exact locale (e.g. 'it')
// 2. fallback locale ('en')
// 3. '_default' if explicitly set
// 4. first non-empty value
// 5. dev warning + safe placeholder
const IS_DEV = typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production';

export function pick(value, locale = DEFAULT_PLATFORM_LOCALE, opts = {}) {
  const fallback = opts.fallback || FALLBACK_LOCALE;
  const path = opts.path || '';

  if (value == null) {
    if (IS_DEV && path) console.warn(`[i18n] Missing content: ${path}`);
    return opts.safePlaceholder ?? '';
  }
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value !== 'object') return String(value);

  const normalized = normalizeLocale(locale);
  if (value[normalized] != null && value[normalized] !== '') return value[normalized];
  if (value[fallback] != null && value[fallback] !== '') return value[fallback];
  if (value._default != null && value._default !== '') return value._default;

  const first = Object.values(value).find((v) => v != null && v !== '');
  if (first != null) return first;

  if (IS_DEV && path) console.warn(`[i18n] Empty content for all locales: ${path}`);
  return opts.safePlaceholder ?? '';
}
