import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  detectInitialSiteLocale,
  pick as pickValue,
  normalizeLocale,
  SITE_LOCALES,
  LOCALE_STORAGE_KEY,
  DEFAULT_PLATFORM_LOCALE,
} from './i18n';

const SiteContext = createContext({
  locale: DEFAULT_PLATFORM_LOCALE,
  setLocale: () => {},
  pick: (v) => (typeof v === 'string' ? v : ''),
  locales: SITE_LOCALES,
});

export const useSite = () => useContext(SiteContext);

// Cross-tab + cross-app sync: when Blueprint app changes locale (or vice versa),
// both surfaces update because they share the same localStorage key.
export const SiteProvider = ({ children }) => {
  const [locale, setLocaleState] = useState(() => detectInitialSiteLocale());

  const setLocale = useCallback((next) => {
    const normalized = normalizeLocale(next);
    setLocaleState(normalized);
    try { localStorage.setItem(LOCALE_STORAGE_KEY, normalized); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('mfd:locale:change', { detail: { locale: normalized } })); } catch (_) {}
  }, []);

  // Listen for Blueprint app locale changes (storage events fire cross-tab; custom event fires same-tab)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === LOCALE_STORAGE_KEY && e.newValue) {
        const normalized = normalizeLocale(e.newValue);
        setLocaleState(normalized);
      }
    };
    const onCustom = (e) => {
      if (e.detail?.locale) setLocaleState(normalizeLocale(e.detail.locale));
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('mfd:locale:change', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('mfd:locale:change', onCustom);
    };
  }, []);

  useEffect(() => {
    try { document.documentElement.setAttribute('lang', locale); } catch (_) {}
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    // pick(value, [path]) — controlled fallback with optional path for dev warnings
    pick: (v, path) => pickValue(v, locale, { path }),
    locales: SITE_LOCALES,
  }), [locale, setLocale]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
};
