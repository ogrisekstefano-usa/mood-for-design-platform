import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { detectInitialSiteLocale, pick as pickValue, SITE_LOCALES, DEFAULT_SITE_LOCALE } from './i18n';

const SiteContext = createContext({
  locale: DEFAULT_SITE_LOCALE,
  setLocale: () => {},
  pick: (v) => (typeof v === 'string' ? v : ''),
  locales: SITE_LOCALES,
});

export const useSite = () => useContext(SiteContext);

export const SiteProvider = ({ children }) => {
  const [locale, setLocaleState] = useState(() => detectInitialSiteLocale());

  const setLocale = useCallback((next) => {
    setLocaleState(next);
    try { localStorage.setItem('mfd_site_locale', next); } catch (_) {}
  }, []);

  useEffect(() => {
    try { document.documentElement.setAttribute('lang', locale); } catch (_) {}
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    pick: (v) => pickValue(v, locale),
    locales: SITE_LOCALES,
  }), [locale, setLocale]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
};
