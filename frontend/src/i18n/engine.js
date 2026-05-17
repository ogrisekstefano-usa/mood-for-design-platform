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

// ── Locale code helpers (BCP-47) ─────────────────────────────────────────
export const SUPPORTED_LOCALES = ['it-IT', 'en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE'];
export const PLATFORM_DEFAULT_LOCALE = 'it-IT';

const STRINGS = {
  'it-IT': itIT,
  'en-US': enUS,
  'en-GB': enGB,
  'es-ES': esES,
  'fr-FR': frFR,
  'de-DE': deDE,
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
 *   en-AE  → ['en-AE','en-GB','en-US','it-IT','en-US']
 *   it-IT  → ['it-IT','en-US']  (it-IT IS the platform default)
 *   pt-BR  → ['pt-BR','en-US','it-IT','en-US']  (unsupported → en-US fallback)
 *
 * Optional `tenantDefault` is appended right after the language family chain
 * so a tenant-specific override is honoured before the platform fallback.
 */
export function buildFallbackChain(locale, tenantDefault = null) {
  const target = toBcp47(locale);
  const [lang] = target.split('-');
  const chain = [target];

  // 1. Same-language regional siblings (en-AE → en-GB → en-US, etc.)
  const siblings = SUPPORTED_LOCALES.filter((l) => l.startsWith(`${lang}-`) && l !== target);
  // British English gets priority before American English for Commonwealth locales.
  if (target === 'en-AE') {
    if (siblings.includes('en-GB')) chain.push('en-GB');
    if (siblings.includes('en-US')) chain.push('en-US');
  } else {
    siblings.forEach((s) => chain.push(s));
  }

  // 2. Tenant default (if configured and not already present).
  if (tenantDefault) {
    const td = toBcp47(tenantDefault);
    if (!chain.includes(td)) chain.push(td);
  }

  // 3. Platform default (it-IT).
  if (!chain.includes(PLATFORM_DEFAULT_LOCALE)) chain.push(PLATFORM_DEFAULT_LOCALE);

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
 */
export function pickString(key, locale, params = null, tenantDefault = null) {
  if (!key) return '';
  const chain = buildFallbackChain(locale, tenantDefault);
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
    console.warn(`[i18n] Missing string key: ${key} (locale ${locale})`);
  }
  return key;
}
