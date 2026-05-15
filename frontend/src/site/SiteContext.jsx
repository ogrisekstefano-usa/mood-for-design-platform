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

// Detect initial canonical locale (preserve EN-US ≠ EN-UK distinction)
function detectInitialCanonicalLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored) {
      const lang = resolveLanguage(stored);
      if (lang.enabled && lang.public_enabled) return lang.code;
    }
  } catch (_) {}
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

  const value = useMemo(() => ({
    locale,
    setLocale,
    pick: (v, path) => pickValue(v, locale, { path }),
    locales,
  }), [locale, setLocale, locales]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
};
