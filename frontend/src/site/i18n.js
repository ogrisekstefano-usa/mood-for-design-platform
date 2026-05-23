// MOOD for DESIGN™ — UNIFIED Locale System (powered by GLOBAL LANGUAGE REGISTRY)
// All locale logic now reads from /site/content/languages.js — the single source.
// Public site, Blueprint app, onboarding, future CMS all share this layer.

import {
  getLanguageRegistry,
  publicLanguages,
  resolveLanguage,
  buildFallbackChain,
  getDefaultLocale,
} from './content/languages';

export const LOCALE_STORAGE_KEY = 'mfd_locale';

// Public switcher view — exposes ALL public_enabled languages distinctly,
// including BCP-47 variants (EN-US ≠ EN-UK). The previous dedupe-by-base hid
// regional variants from the user, breaking platform consistency.
export function getSiteLocales() {
  return publicLanguages().map((l) => ({
    code: l.code,
    base: l.base,
    label: l.short,
    native: l.native_name,
    rtl: l.rtl,
  }));
}

// Backwards-compat exports (used across the codebase)
export const SITE_LOCALES = getSiteLocales();
export const PLATFORM_LOCALES = getLanguageRegistry();
export const DEFAULT_PLATFORM_LOCALE = getDefaultLocale();
export const FALLBACK_LOCALE = 'en-US';

export function normalizeLocale(code) {
  const lang = resolveLanguage(code);
  return lang.base;
}

export function detectInitialSiteLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored) {
      const lang = resolveLanguage(stored);
      if (lang.enabled && lang.public_enabled) return lang.base;
    }
  } catch (_) {}
  const def = resolveLanguage(getDefaultLocale());
  return def.base;
}

const IS_DEV = typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production';

// CONTROLLED FALLBACK CHAIN built from registry (canonical → base → fallback → en)
// ITER143A · LANGUAGE GOVERNANCE HARDENING™ — strict, never cross-language.
// If a value is missing in the full registry chain (lang → base → fallback → en),
// we return the safe placeholder. We NEVER pick a random language to avoid
// leaking IT into EN/ES/FR/DE surfaces.
export function pick(value, locale = DEFAULT_PLATFORM_LOCALE, opts = {}) {
  const path = opts.path || '';

  if (value == null) {
    if (IS_DEV && path) console.warn(`[i18n] Missing content: ${path}`);
    return opts.safePlaceholder ?? '';
  }
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value !== 'object') return String(value);

  const chain = buildFallbackChain(locale);
  for (const code of chain) {
    if (value[code] != null && value[code] !== '') return value[code];
  }
  // Same-language regional siblings (e.g. en-AE → en-GB → en-US) — handled
  // implicitly by buildFallbackChain. Below is the ABSOLUTE last resort,
  // and only when an `en` baseline exists. Otherwise empty (strict).
  if (value._default != null && value._default !== '') return value._default;
  if (value['en-US'] != null && value['en-US'] !== '') return value['en-US'];
  if (value['en-GB'] != null && value['en-GB'] !== '') return value['en-GB'];
  if (value['en']    != null && value['en']    !== '') return value['en'];

  if (IS_DEV && path) console.warn(`[i18n] Empty content for all locales: ${path}`);
  return opts.safePlaceholder ?? '';
}
