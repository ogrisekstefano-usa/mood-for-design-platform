import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  detectInitialSiteLocale,
  pick as pickValue,
  normalizeLocale,
  getSiteLocales,
  LOCALE_STORAGE_KEY,
  DEFAULT_PLATFORM_LOCALE,
} from './i18n';

const SiteContext = createContext({
  locale: DEFAULT_PLATFORM_LOCALE,
  setLocale: () => {},
  pick: (v) => (typeof v === 'string' ? v : ''),
  locales: getSiteLocales(),
});

export const useSite = () => useContext(SiteContext);

export const SiteProvider = ({ children }) => {
  const [locale, setLocaleState] = useState(() => detectInitialSiteLocale());
  const [locales, setLocales] = useState(() => getSiteLocales());

  const setLocale = useCallback((next) => {
    const normalized = normalizeLocale(next);
    setLocaleState(normalized);
    try { localStorage.setItem(LOCALE_STORAGE_KEY, normalized); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('mfd:locale:change', { detail: { locale: normalized } })); } catch (_) {}
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === LOCALE_STORAGE_KEY && e.newValue) setLocaleState(normalizeLocale(e.newValue));
    };
    const onCustomLocale = (e) => { if (e.detail?.locale) setLocaleState(normalizeLocale(e.detail.locale)); };
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
    const lang = locales.find((l) => l.base === locale);
    try { document.documentElement.setAttribute('dir', lang?.rtl ? 'rtl' : 'ltr'); } catch (_) {}
  }, [locale, locales]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    pick: (v, path) => pickValue(v, locale, { path }),
    locales,
  }), [locale, setLocale, locales]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
};
