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
 *   es-MX  → 'es-MX'  ← P0-B I18N-RECOVERY-001
 */
export const BLUEPRINT_OPERATIONAL_CODES = Object.freeze([
  'it', 'en-US', 'en-GB', 'fr', 'de', 'es',
]);

/** True if a language code is one of the 6 Blueprint operational languages. */
export const isBlueprintOperational = (code) =>
  BLUEPRINT_OPERATIONAL_CODES.includes(code);

/** @type {LanguageEntry[]} */
export const LANGUAGE_REGISTRY = [
  { code: 'it',    region: 'IT', dial_code: '+39',  name: 'Italian',         native_name: 'Italiano',      enabled: true,  public_enabled: true,  blueprint_enabled: true,  default_locale: true,  rtl: false, fallback_locale: 'en-US', sort_order: 10, ai_translation_enabled: true,  short: 'IT',    base: 'it' },
  { code: 'en-US', region: 'US', dial_code: '+1',   name: 'English (US)',    native_name: 'English (US)',  enabled: true,  public_enabled: true,  blueprint_enabled: true,  default_locale: false, rtl: false, fallback_locale: 'en-US', sort_order: 20, ai_translation_enabled: true,  short: 'EN-US', base: 'en' },
  { code: 'en-GB', region: 'GB', dial_code: '+44',  name: 'English (UK)',    native_name: 'English (UK)',  enabled: true,  public_enabled: true,  blueprint_enabled: true,  default_locale: false, rtl: false, fallback_locale: 'en-US', sort_order: 30, ai_translation_enabled: true,  short: 'EN-UK', base: 'en' },
  { code: 'fr',    region: 'FR', dial_code: '+33',  name: 'French',          native_name: 'Français',      enabled: true,  public_enabled: true,  blueprint_enabled: true,  default_locale: false, rtl: false, fallback_locale: 'en-US', sort_order: 40, ai_translation_enabled: true,  short: 'FR',    base: 'fr' },
  { code: 'de',    region: 'DE', dial_code: '+49',  name: 'German',          native_name: 'Deutsch',       enabled: true,  public_enabled: true,  blueprint_enabled: true,  default_locale: false, rtl: false, fallback_locale: 'en-US', sort_order: 50, ai_translation_enabled: true,  short: 'DE',    base: 'de' },
  { code: 'es',    region: 'ES', dial_code: '+34',  name: 'Spanish (Spain)', native_name: 'Español (ES)',  enabled: true,  public_enabled: true,  blueprint_enabled: true,  default_locale: false, rtl: false, fallback_locale: 'en-US', sort_order: 60, ai_translation_enabled: true,  short: 'ES',    base: 'es' },
  { code: 'es-MX', region: 'MX', dial_code: '+52',  name: 'Spanish (Mexico)',native_name: 'Español (MX)',  enabled: true,  public_enabled: true,  blueprint_enabled: false, default_locale: false, rtl: false, fallback_locale: 'es',    sort_order: 65, ai_translation_enabled: true,  short: 'ES-MX', base: 'es' },
  // Non-operational languages: visible/usable on public site + Client Companion ONLY.
  // `blueprint_enabled` is forced to false at registry level; admin UI cannot flip
  // it (toggle is locked — see LanguagesPage.jsx + blueprintLanguages() whitelist).
  { code: 'ar',    region: 'AE', dial_code: '+971', name: 'Arabic (UAE)',    native_name: 'العربية',        enabled: true,  public_enabled: true,  blueprint_enabled: false, default_locale: false, rtl: true,  fallback_locale: 'en-US', sort_order: 70, ai_translation_enabled: true,  short: 'AE',    base: 'ar' },
  { code: 'zh',    region: 'CN', dial_code: '+86',  name: 'Chinese (Simpl.)',native_name: '中文',           enabled: false, public_enabled: false, blueprint_enabled: false, default_locale: false, rtl: false, fallback_locale: 'en-US', sort_order: 80, ai_translation_enabled: true,  short: 'ZH',    base: 'zh' },
  { code: 'ja',    region: 'JP', dial_code: '+81',  name: 'Japanese',        native_name: '日本語',         enabled: false, public_enabled: false, blueprint_enabled: false, default_locale: false, rtl: false, fallback_locale: 'en-US', sort_order: 90, ai_translation_enabled: true,  short: 'JA',    base: 'ja' },
];

const RUNTIME_OVERRIDE_KEY = 'mfd_language_registry_override';
const DB_CACHE_KEY = 'mfd_language_registry_db_cache_v1';

// In-memory mirror populated by `bootstrapLanguagesFromDB()`. Until that
// resolves we serve the static LANGUAGE_REGISTRY as cold-boot fallback
// (prevents flash of empty switcher on first render).
let _dbMirror = null;

// SuperAdmin/tenant override — when set, replaces the static registry at runtime.
function readOverride() {
  try {
    const raw = localStorage.getItem(RUNTIME_OVERRIDE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

/** Read a previously-cached DB snapshot (localStorage). Survives reloads. */
function readDbCache() {
  try {
    const raw = localStorage.getItem(DB_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

/** Persist the DB mirror so next page-load is instant. */
function writeDbCache(rows) {
  try {
    localStorage.setItem(DB_CACHE_KEY, JSON.stringify(rows));
  } catch (_) {}
}

/** Bootstrap the registry from /api/platform/languages.
 *  Call once at app startup. Subsequent calls revalidate the cache.
 *  Returns the resolved registry (array). */
export async function bootstrapLanguagesFromDB(apiBase = null) {
  try {
    const base = apiBase
      || (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL)
      || '';
    const url = `${base}/api/platform/languages?scope=all`;
    const r = await fetch(url, { credentials: 'omit' });
    if (!r.ok) throw new Error(`platform/languages ${r.status}`);
    const body = await r.json();
    const rows = (body.languages || []).map((l) => {
      // Prefer the short label from the static registry (e.g. 'IT', 'EN-US')
      // over the DB value which may be verbose (e.g. 'IT-IT').
      const staticEntry = LANGUAGE_REGISTRY.find(
        (s) => s.code === l.code || s.code === l.base_code || (s.base === l.base_code && !s.code.includes('-'))
      );
      return {
        code:                    l.code,
        name:                    l.name,
        native_name:             l.native_name,
        region:                  l.region,
        dial_code:               l.dial_code,
        enabled:                 !!l.enabled,
        public_enabled:          !!l.public_enabled,
        blueprint_enabled:       !!l.blueprint_enabled,
        default_locale:          !!l.default_locale,
        rtl:                     !!l.rtl,
        fallback_locale:         l.fallback_locale,
        sort_order:              l.sort_order ?? 100,
        ai_translation_enabled:  !!l.ai_translation_enabled,
        short:                   staticEntry?.short || l.short_label || l.code,
        base:                    l.base_code,
      };
    });
    _dbMirror = rows;
    writeDbCache(rows);
    try {
      window.dispatchEvent(new CustomEvent('mfd:languages:change',
        { detail: { source: 'db_bootstrap', registry: rows } }));
    } catch (_) {}
    return rows;
  } catch (e) {
    // Silent fallback to localStorage cache or static registry
    const cached = readDbCache();
    if (cached) { _dbMirror = cached; return cached; }
    return LANGUAGE_REGISTRY;
  }
}

// Eagerly try the cached DB snapshot at module import time so the first
// synchronous getLanguageRegistry() call returns the freshest data.
try {
  const cached = readDbCache();
  if (cached) _dbMirror = cached;
} catch (_) {}

export function getLanguageRegistry() {
  // Priority: explicit override (localStorage) > DB mirror > static fallback
  const override = readOverride();
  if (Array.isArray(override) && override.length > 0) return override;
  if (Array.isArray(_dbMirror) && _dbMirror.length > 0) return _dbMirror;
  return LANGUAGE_REGISTRY;
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

export const blueprintLanguages = () => {
  const reg = getLanguageRegistry();
  return reg
    .filter((l) => {
      if (!l.enabled || !l.blueprint_enabled) return false;
      // Base-code matching: 'it-IT' must match operational code 'it'.
      // DB may store 'it-IT' while BLUEPRINT_OPERATIONAL_CODES has 'it'.
      return BLUEPRINT_OPERATIONAL_CODES.some(
        (c) => l.code === c || l.code === `${c}-${l.region}` || l.code.startsWith(c + '-')
      );
    })
    .sort((a, b) => a.sort_order - b.sort_order);
};

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
