// MOOD for DESIGN™ — GLOBAL LANGUAGE REGISTRY
// Single canonical source of truth for ALL locale logic across:
//   • public site (homepage, projects, onboarding)
//   • Blueprint authenticated app (workspace, settings)
//   • future CMS, messaging, AI translation, tenant overrides
//
// This file mirrors the future DB table:
//   `platform_languages(code PK, name, native_name, enabled, public_enabled,
//                       blueprint_enabled, default_locale BOOL, rtl BOOL,
//                       fallback_locale, sort_order, ai_translation_enabled)`
//
// At runtime SuperAdmin can override these via /settings/languages and the
// changes propagate to both public site & Blueprint instantly via the same
// locale storage key (`mfd_locale`) + `mfd:locale:change` custom event.

/**
 * @typedef {Object} LanguageEntry
 * @property {string}  code            — Canonical BCP-47 code (e.g. 'en-US', 'it', 'ar')
 * @property {string}  name            — English display name (e.g. 'English (US)')
 * @property {string}  native_name     — Native name (e.g. 'English', 'Italiano', 'العربية')
 * @property {boolean} enabled         — Master switch — if false, hidden everywhere
 * @property {boolean} public_enabled  — Show in public site switcher
 * @property {boolean} blueprint_enabled — Show in Blueprint app switcher
 * @property {boolean} default_locale  — One language is platform default (only one)
 * @property {boolean} rtl             — Right-to-left script (Arabic, Hebrew, Persian)
 * @property {string}  fallback_locale — Falls back to this code if a key is missing
 * @property {number}  sort_order      — Display order in switchers (lower first)
 * @property {boolean} ai_translation_enabled — Future AI translator may write to this lang
 * @property {string}  short           — 2-char short label for compact switcher
 * @property {string}  base            — Base 2-char code (en-US/en-UK → 'en')
 */

/**
 * BLUEPRINT_OPERATIONAL_CODES — HARDENING-I18N · 21 Mag 2026.
 *
 * The Blueprint Command Center™ admin UI is LOCKED to exactly 6 operational
 * languages. This whitelist is enforced by `blueprintLanguages()` regardless
 * of what an admin (or a localStorage override) sets `blueprint_enabled` to.
 *
 * Public site, Client Companion, onboarding, and AI translation pipelines
 * remain free to use the full Global Language Registry below (e.g. ar, zh, ja).
 *
 * Mapping: user spec → registry codes (we keep canonical short forms already
 * in use across the codebase):
 *   it-IT  → 'it'
 *   en-US  → 'en-US'
 *   en-GB  → 'en-GB'
 *   fr-FR  → 'fr'
 *   de-DE  → 'de'
 *   es-ES  → 'es'
 */
export const BLUEPRINT_OPERATIONAL_CODES = Object.freeze([
  'it', 'en-US', 'en-GB', 'fr', 'de', 'es',
]);

/** True if a language code is one of the 6 Blueprint operational languages. */
export const isBlueprintOperational = (code) =>
  BLUEPRINT_OPERATIONAL_CODES.includes(code);

/** @type {LanguageEntry[]} */
export const LANGUAGE_REGISTRY = [
  { code: 'it',    name: 'Italian',         native_name: 'Italiano',      enabled: true,  public_enabled: true,  blueprint_enabled: true,  default_locale: true,  rtl: false, fallback_locale: 'en-US', sort_order: 10, ai_translation_enabled: true,  short: 'IT',    base: 'it' },
  { code: 'en-US', name: 'English (US)',    native_name: 'English (US)',  enabled: true,  public_enabled: true,  blueprint_enabled: true,  default_locale: false, rtl: false, fallback_locale: 'en-US', sort_order: 20, ai_translation_enabled: true,  short: 'EN-US', base: 'en' },
  { code: 'en-GB', name: 'English (UK)',    native_name: 'English (UK)',  enabled: true,  public_enabled: true,  blueprint_enabled: true,  default_locale: false, rtl: false, fallback_locale: 'en-US', sort_order: 30, ai_translation_enabled: true,  short: 'EN-UK', base: 'en' },
  { code: 'fr',    name: 'French',          native_name: 'Français',      enabled: true,  public_enabled: true,  blueprint_enabled: true,  default_locale: false, rtl: false, fallback_locale: 'en-US', sort_order: 40, ai_translation_enabled: true,  short: 'FR',    base: 'fr' },
  { code: 'de',    name: 'German',          native_name: 'Deutsch',       enabled: true,  public_enabled: true,  blueprint_enabled: true,  default_locale: false, rtl: false, fallback_locale: 'en-US', sort_order: 50, ai_translation_enabled: true,  short: 'DE',    base: 'de' },
  { code: 'es',    name: 'Spanish',         native_name: 'Español',       enabled: true,  public_enabled: true,  blueprint_enabled: true,  default_locale: false, rtl: false, fallback_locale: 'en-US', sort_order: 60, ai_translation_enabled: true,  short: 'ES',    base: 'es' },
  // Non-operational languages: visible/usable on public site + Client Companion ONLY.
  // `blueprint_enabled` is forced to false at registry level; admin UI cannot flip
  // it (toggle is locked — see LanguagesPage.jsx + blueprintLanguages() whitelist).
  { code: 'ar',    name: 'Arabic (UAE)',    native_name: 'العربية',        enabled: true,  public_enabled: true,  blueprint_enabled: false, default_locale: false, rtl: true,  fallback_locale: 'en-US', sort_order: 70, ai_translation_enabled: true,  short: 'AE',    base: 'ar' },
  { code: 'zh',    name: 'Chinese (Simpl.)',native_name: '中文',           enabled: false, public_enabled: false, blueprint_enabled: false, default_locale: false, rtl: false, fallback_locale: 'en-US', sort_order: 80, ai_translation_enabled: true,  short: 'ZH',    base: 'zh' },
  { code: 'ja',    name: 'Japanese',        native_name: '日本語',         enabled: false, public_enabled: false, blueprint_enabled: false, default_locale: false, rtl: false, fallback_locale: 'en-US', sort_order: 90, ai_translation_enabled: true,  short: 'JA',    base: 'ja' },
];

const RUNTIME_OVERRIDE_KEY = 'mfd_language_registry_override';

// SuperAdmin/tenant override — when set, replaces the static registry at runtime.
function readOverride() {
  try {
    const raw = localStorage.getItem(RUNTIME_OVERRIDE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

export function getLanguageRegistry() {
  const override = readOverride();
  return Array.isArray(override) && override.length > 0 ? override : LANGUAGE_REGISTRY;
}

export function setLanguageRegistry(next) {
  try {
    localStorage.setItem(RUNTIME_OVERRIDE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('mfd:languages:change', { detail: { registry: next } }));
  } catch (_) {}
}

export function getDefaultLocale() {
  const reg = getLanguageRegistry();
  const def = reg.find((l) => l.enabled && l.default_locale);
  return def ? def.code : (reg.find((l) => l.enabled)?.code || 'it');
}

// Filtered views consumed by switchers
export const enabledLanguages = () => getLanguageRegistry()
  .filter((l) => l.enabled).sort((a, b) => a.sort_order - b.sort_order);

export const publicLanguages = () => getLanguageRegistry()
  .filter((l) => l.enabled && l.public_enabled).sort((a, b) => a.sort_order - b.sort_order);

export const blueprintLanguages = () => getLanguageRegistry()
  .filter((l) => l.enabled && l.blueprint_enabled && BLUEPRINT_OPERATIONAL_CODES.includes(l.code))
  .sort((a, b) => a.sort_order - b.sort_order);

// Resolve any incoming code to its canonical registry entry (BCP-47 or 2-char)
export function resolveLanguage(code) {
  const reg = getLanguageRegistry();
  if (!code) return reg.find((l) => l.default_locale) || reg[0];
  let match = reg.find((l) => l.code === code);
  if (match) return match;
  // Try base match (en → en-US)
  const base = String(code).split('-')[0].toLowerCase();
  match = reg.find((l) => l.base === base && l.enabled);
  if (match) return match;
  return reg.find((l) => l.default_locale) || reg[0];
}

// Build a fallback chain from canonical → base → default (for content lookup)
export function buildFallbackChain(code) {
  const lang = resolveLanguage(code);
  const chain = [lang.code];
  if (lang.base !== lang.code) chain.push(lang.base);
  if (lang.fallback_locale && !chain.includes(lang.fallback_locale)) chain.push(lang.fallback_locale);
  const fallbackLang = resolveLanguage(lang.fallback_locale);
  if (fallbackLang.base !== lang.fallback_locale && !chain.includes(fallbackLang.base)) {
    chain.push(fallbackLang.base);
  }
  if (!chain.includes('en')) chain.push('en'); // universal last resort
  return chain;
}
