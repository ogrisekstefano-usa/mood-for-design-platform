import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  pick as pickValue,
  getSiteLocales,
  LOCALE_STORAGE_KEY,
  DEFAULT_PLATFORM_LOCALE,
} from './i18n';
import { resolveLanguage, getDefaultLocale } from './content/languages';

const SiteContext = createContext({
  locale: DEFAULT_PLATFORM_LOCALE,
  setLocale: () => {},
  pick: (v) => (typeof v === 'string' ? v : ''),
  locales: getSiteLocales(),
});

export const useSite = () => useContext(SiteContext);

// Detect initial canonical locale.
// Priority chain:
//   1. localStorage (user previously chose) — wins over everything
//   2. navigator.language(s) — browser preference, match against publicly enabled locales
//   3. en-GB explicit fallback (per product spec — UK English over US English)
//   4. registry default locale
function detectInitialCanonicalLocale() {
  // 1. Persisted choice
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored) {
      const lang = resolveLanguage(stored);
      if (lang.enabled && lang.public_enabled) return lang.code;
    }
  } catch (_) {}

  // 2. Browser-preferred languages (in order)
  try {
    const reg = getSiteLocales().filter((l) => l.public_enabled !== false);
    const browserPrefs = (typeof navigator !== 'undefined' && Array.isArray(navigator.languages) && navigator.languages.length)
      ? navigator.languages
      : (typeof navigator !== 'undefined' && navigator.language ? [navigator.language] : []);
    for (const raw of browserPrefs) {
      const norm = String(raw || '').trim();
      if (!norm) continue;
      // Exact match (e.g. 'en-GB' === 'en-GB')
      const exact = reg.find((l) => l.code.toLowerCase() === norm.toLowerCase());
      if (exact) return exact.code;
      // Base match (e.g. 'it-CH' → 'it')
      const base = norm.split('-')[0].toLowerCase();
      const baseHit = reg.find((l) => (l.base || l.code.split('-')[0]).toLowerCase() === base);
      if (baseHit) return baseHit.code;
    }
  } catch (_) {}

  // 3. en-GB hard fallback (spec)
  try {
    const reg = getSiteLocales().filter((l) => l.public_enabled !== false);
    const enGB = reg.find((l) => l.code === 'en-GB' || l.code === 'en-UK');
    if (enGB) return enGB.code;
  } catch (_) {}

  // 4. Registry default
  return getDefaultLocale();
}

export const SiteProvider = ({ children }) => {
  // `locale` is now the canonical BCP-47 code (e.g. 'en-US', 'en-GB', 'it')
  const [locale, setLocaleState] = useState(detectInitialCanonicalLocale);
  const [locales, setLocales] = useState(() => getSiteLocales());

  const setLocale = useCallback((next) => {
    const lang = resolveLanguage(next);
    const code = lang.code;
    setLocaleState(code);
    try { localStorage.setItem(LOCALE_STORAGE_KEY, code); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('mfd:locale:change', { detail: { locale: code } })); } catch (_) {}
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === LOCALE_STORAGE_KEY && e.newValue) {
        const lang = resolveLanguage(e.newValue);
        setLocaleState(lang.code);
      }
    };
    const onCustomLocale = (e) => {
      if (e.detail?.locale) {
        const lang = resolveLanguage(e.detail.locale);
        setLocaleState(lang.code);
      }
    };
    const onCustomLanguages = () => setLocales(getSiteLocales());
    window.addEventListener('storage', onStorage);
    window.addEventListener('mfd:locale:change', onCustomLocale);
    window.addEventListener('mfd:languages:change', onCustomLanguages);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('mfd:locale:change', onCustomLocale);
      window.removeEventListener('mfd:languages:change', onCustomLanguages);
    };
  }, []);

  useEffect(() => {
    try { document.documentElement.setAttribute('lang', locale); } catch (_) {}
    const lang = resolveLanguage(locale);
    try { document.documentElement.setAttribute('dir', lang.rtl ? 'rtl' : 'ltr'); } catch (_) {}
  }, [locale]);

  // ITER146.A · Tenant-default-locale honor — if the visitor has NOT made an
  // explicit choice (no localStorage entry), prefer the tenant's
  // `default_locale` over the browser Accept-Language. This guarantees a
  // visitor landing on an Italian studio sees the IT copy by default even
  // when the browser is configured in English.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hasExplicitChoice =
          typeof window !== 'undefined' &&
          !!window.localStorage.getItem(LOCALE_STORAGE_KEY);
        if (hasExplicitChoice) return;
        // Derive the tenant slug from the host the same way the public
        // onboarding flows do. Preview & platform hosts fall back to
        // the Golden Demo Tenant™ ('studio').
        const host = (typeof window !== 'undefined' && window.location.hostname) || '';
        const firstLabel = (host.split('.')[0] || '').toLowerCase();
        const PLATFORM_HOSTS = ['studio', 'blueprint', 'www', 'localhost'];
        const looksPreview =
          firstLabel.startsWith('content-hub-pro-') ||
          PLATFORM_HOSTS.some((h) => firstLabel === h || firstLabel.startsWith(h));
        const tenantSlug = looksPreview ? 'studio' : (firstLabel || 'studio');
        const base = process.env.REACT_APP_BACKEND_URL || '';
        // PUBLIC endpoint (anonymous) — exposes locales without auth.
        const r = await fetch(
          `${base}/api/tenant/configuration/public/${encodeURIComponent(tenantSlug)}`,
          { credentials: 'omit' },
        );
        if (!r.ok) return;
        const cfg = await r.json();
        const tenantDefault =
          cfg?.configuration?.default_locale ||
          cfg?.locales?.default_locale ||
          cfg?.default_locale ||
          null;
        if (!tenantDefault || cancelled) return;
        const resolved = resolveLanguage(tenantDefault);
        if (!resolved?.enabled || resolved.public_enabled === false) return;
        // Re-check explicit choice — user may have clicked the locale picker
        // while the fetch was in flight; never override an explicit choice.
        if (window.localStorage.getItem(LOCALE_STORAGE_KEY)) return;
        // Switch silently — but do NOT persist to localStorage so a user
        // visiting a different-locale tenant later still gets that tenant's
        // default. We update state directly to bypass the persistence path.
        setLocaleState(resolved.code);
        try {
          window.dispatchEvent(
            new CustomEvent('mfd:locale:change', { detail: { locale: resolved.code } }),
          );
        } catch (_) {}
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => ({
    locale,
    setLocale,
    pick: (v, path) => pickValue(v, locale, { path }),
    locales,
  }), [locale, setLocale, locales]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
};
