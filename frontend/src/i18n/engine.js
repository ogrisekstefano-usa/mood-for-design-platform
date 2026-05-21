/**
 * Blueprint i18n — locale-aware engine.
 *
 *   • Strings dictionaries live in /app/frontend/src/i18n/strings/{locale}.json.
 *   • Locale codes are strict BCP-47 (it-IT, en-US, en-GB, es-ES, fr-FR, de-DE…).
 *     en-US ≠ en-GB (different luxury terminology).
 *   • Bridges to LocaleRuntimeContext which still exposes the composite
 *     format "IT_IT / EN_US / EN_GB" used by the cultural runtime. We convert
 *     IT_IT → it-IT here so all CRM surfaces speak BCP-47.
 *   • Fallback chain: requested → base-family (en-AE → en-US) → tenant default
 *     → 'it-IT' (platform default) → English-US (universal safety net).
 *   • NO hardcoded strings in components: every label comes from a dictionary
 *     or from `relationship_lookups` (DB-driven config).
 */
import itIT from './strings/it-IT.json';
import enUS from './strings/en-US.json';
import enGB from './strings/en-GB.json';
import esES from './strings/es-ES.json';
import frFR from './strings/fr-FR.json';
import deDE from './strings/de-DE.json';
import ar   from './strings/ar.json';

// ── Locale code helpers (BCP-47) ─────────────────────────────────────────
export const SUPPORTED_LOCALES = ['it-IT', 'en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'ar-AE'];
export const PLATFORM_DEFAULT_LOCALE = 'it-IT';

const STRINGS = {
  'it-IT': itIT,
  'en-US': enUS,
  'en-GB': enGB,
  'es-ES': esES,
  'fr-FR': frFR,
  'de-DE': deDE,
  'ar-AE': ar,
  'ar':    ar,
};

/**
 * Normalise a locale code coming from anywhere in the platform.
 *
 *   IT_IT   → it-IT       (legacy composite from LocaleRuntimeContext)
 *   it      → it-IT       (language-only → primary region)
 *   en      → en-US       (English defaults to US)
 *   en-ae   → en-AE
 *   en_US   → en-US
 */
export function toBcp47(code) {
  if (!code) return PLATFORM_DEFAULT_LOCALE;
  let c = String(code).trim().replace('_', '-');
  if (!c) return PLATFORM_DEFAULT_LOCALE;
  // Already a region? Normalise casing (xx-YY).
  const parts = c.split('-');
  if (parts.length === 2) {
    return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
  }
  // Language-only: map to primary region.
  const lang = c.toLowerCase();
  const primaryRegion = {
    it: 'IT', en: 'US', es: 'ES', fr: 'FR', de: 'DE',
    pt: 'BR', ar: 'AE', ja: 'JP', zh: 'CN',
  }[lang] || lang.toUpperCase();
  return `${lang}-${primaryRegion}`;
}

/**
 * Build a fallback chain for a given BCP-47 locale.
 *
 * Sprint ITER126 · Global UI Localization Sweep™ — STRICT MODE:
 *
 *   IF requested locale starts with 'it-' (e.g. 'it-IT', 'it-CH'):
 *     it-IT → en-US (universal safety net)
 *
 *   IF requested locale is ANY OTHER language:
 *     en-AE  → ['en-AE', 'en-GB', 'en-US']        (same-family + EN safety net)
 *     fr-FR  → ['fr-FR', 'en-US']                 (no IT silent fallback)
 *     de-DE  → ['de-DE', 'en-US']
 *     pt-BR  → ['pt-BR', 'en-US']                 (unsupported → EN safety net)
 *
 * The platform-default Italian (`it-IT`) is NEVER inserted into a non-IT
 * chain. If a key is missing from the requested locale AND from the English
 * safety net, `pickString()` records the gap and returns a visible MISSING
 * token (in dev) or the key path (in prod) — but it does NOT leak Italian
 * into a non-IT user's UI. This is the core anti-mixed-language rule.
 *
 * Optional `tenantDefault` is appended right after the language family
 * chain so a tenant-specific override is honoured before the platform
 * safety net — BUT it is also suppressed if it is Italian and the requested
 * locale is not (same anti-leakage rule).
 */
export function buildFallbackChain(locale, tenantDefault = null) {
  const target = toBcp47(locale);
  const [lang] = target.split('-');
  const chain = [target];

  // 1. Same-language regional siblings (en-AE → en-GB → en-US, etc.)
  const siblings = SUPPORTED_LOCALES.filter((l) => l.startsWith(`${lang}-`) && l !== target);
  if (target === 'en-AE') {
    if (siblings.includes('en-GB')) chain.push('en-GB');
    if (siblings.includes('en-US')) chain.push('en-US');
  } else {
    siblings.forEach((s) => chain.push(s));
  }

  // 2. Tenant default (if configured, not already present, AND not an
  //    Italian leak for a non-Italian user).
  if (tenantDefault) {
    const td = toBcp47(tenantDefault);
    const isItalianLeak = td.startsWith('it-') && lang !== 'it';
    if (!chain.includes(td) && !isItalianLeak) chain.push(td);
  }

  // 3. Italian-only chains get the platform default. Every other language
  //    skips it entirely so we never silently fall back to Italian for a
  //    non-Italian user.
  if (lang === 'it' && !chain.includes(PLATFORM_DEFAULT_LOCALE)) {
    chain.push(PLATFORM_DEFAULT_LOCALE);
  }

  // 4. Universal safety net (English-US) — always last.
  if (!chain.includes('en-US')) chain.push('en-US');

  return chain;
}

/**
 * Resolve a multilingual `{ "it-IT": "...", "en-US": "..." }` JSONB value
 * (as stored in relationship_lookups.label) for a given locale, using the
 * fallback chain. Also tolerates legacy `{ it: "...", en: "..." }` shape
 * (pre-Phase R-CRM-2A seed): if no BCP-47 key matches, falls back to base.
 */
export function pickLocaleValue(labelObj, locale, tenantDefault = null) {
  if (labelObj == null) return '';
  if (typeof labelObj === 'string') return labelObj;
  if (typeof labelObj !== 'object') return String(labelObj);

  const chain = buildFallbackChain(locale, tenantDefault);
  for (const code of chain) {
    if (labelObj[code] != null && labelObj[code] !== '') return labelObj[code];
  }
  // Legacy `it/en` keys (pre-BCP-47 seed).
  for (const code of chain) {
    const base = code.split('-')[0];
    if (labelObj[base] != null && labelObj[base] !== '') return labelObj[base];
  }
  // Last resort: first non-empty value.
  const first = Object.values(labelObj).find((v) => v != null && v !== '');
  return first || '';
}

/**
 * Resolve a string-dictionary key (`"relationships.title"`) for a locale.
 * Supports `{var}` interpolation: t('greeting', { name: 'Anna' }).
 *
 * Sprint ITER126 · STRICT MODE: when the key is not found anywhere in the
 * (Italian-free) fallback chain for non-Italian users, returns a visible
 * `⟦key⟧` token in development so the gap is impossible to miss, and the
 * bare key in production. Italian is NEVER served as a silent fallback
 * to a non-Italian user.
 */
export function pickString(key, locale, params = null, tenantDefault = null) {
  if (!key) return '';
  const target = toBcp47(locale);
  const chain = buildFallbackChain(target, tenantDefault);
  const path = String(key).split('.');
  for (const code of chain) {
    const dict = STRINGS[code];
    if (!dict) continue;
    let cur = dict;
    for (const seg of path) {
      if (cur && typeof cur === 'object' && seg in cur) cur = cur[seg];
      else { cur = null; break; }
    }
    if (typeof cur === 'string') {
      if (!params) return cur;
      return cur.replace(/\{(\w+)\}/g, (_, p) => (params[p] != null ? String(params[p]) : `{${p}}`));
    }
  }
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(`[i18n] Missing string key: ${key} (locale ${target})`);
  }
  try {
    // eslint-disable-next-line global-require
    const { recordMissing } = require('../design-system/missingI18nRegistry');
    recordMissing({ key, locale: target, fallbackSrc: 'key-literal' });
  } catch (_) { /* noop */ }
  // Visible MISSING token in dev, bare key in prod — never Italian.
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    return `⟦${key}⟧`;
  }
  return key;
}
