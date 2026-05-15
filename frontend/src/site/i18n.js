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

// Public switcher view — auto-deduplicated keys for compact UI (one entry per base).
export function getSiteLocales() {
  const langs = publicLanguages();
  // De-dup by base — a public switcher exposes ONE entry per language family
  // (the first enabled variant by sort_order). Tenants can choose en-US or en-GB
  // via the SuperAdmin /settings/languages panel.
  const seen = new Set();
  const out = [];
  langs.forEach((l) => {
    if (seen.has(l.base)) return;
    seen.add(l.base);
    out.push({ code: l.code, base: l.base, label: l.short, native: l.native_name, rtl: l.rtl });
  });
  return out;
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
  if (value._default != null && value._default !== '') return value._default;

  const first = Object.values(value).find((v) => v != null && v !== '');
  if (first != null) return first;

  if (IS_DEV && path) console.warn(`[i18n] Empty content for all locales: ${path}`);
  return opts.safePlaceholder ?? '';
}
