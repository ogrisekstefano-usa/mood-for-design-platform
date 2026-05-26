import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { LOCALIZED_SLUGS } from '../corporate/routes/localizedSlugs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const LOCALE_LABELS = {
  'it': 'IT',
  'en-us': 'EN',
  'en-uk': 'EN',
  'fr': 'FR',
  'de': 'DE',
  'es': 'ES',
};

const LOCALE_FULL_NAMES = {
  'it': 'Italiano',
  'en-us': 'English (US)',
  'en-uk': 'English (UK)',
  'fr': 'Français',
  'de': 'Deutsch',
  'es': 'Español',
};

const LocaleContext = createContext({
  locale: 'en-us',
  setLocale: () => {},
  locales: [],
  localeLabel: 'EN',
  localeFullName: 'English (US)',
});

export const LocaleProvider = ({ children }) => {
  const [locale, setLocaleState] = useState(() => {
    const stored = localStorage.getItem('mood-locale') || localStorage.getItem('mood_locale');
    // 1) Detect locale from URL path (e.g. /audience → en-us, /fonctionnalites → fr)
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    for (const [, locales] of Object.entries(LOCALIZED_SLUGS)) {
      for (const [code, slug] of Object.entries(locales)) {
        if (slug === path) return code;
      }
    }
    // 2) Fallback to stored, then browser language hint, then default 'it'
    if (stored) return stored;
    if (typeof navigator !== 'undefined') {
      const lang = (navigator.language || '').toLowerCase();
      if (lang.startsWith('en-gb')) return 'en-uk';
      if (lang.startsWith('en'))    return 'en-us';
      if (lang.startsWith('fr'))    return 'fr';
      if (lang.startsWith('de'))    return 'de';
      if (lang.startsWith('es'))    return 'es';
      if (lang.startsWith('it'))    return 'it';
    }
    return 'it';
  });
  const [locales, setLocales] = useState([
    { code: 'it', name: 'Italiano', flag: 'IT' },
    { code: 'en-us', name: 'English (US)', flag: 'EN' },
    { code: 'fr', name: 'Français', flag: 'FR' },
    { code: 'de', name: 'Deutsch', flag: 'DE' },
    { code: 'es', name: 'Español', flag: 'ES' },
  ]);

  useEffect(() => {
    // Fetch enabled locales (Locale Governance) from /api/site/locales
    axios.get(`${BACKEND_URL}/api/site/locales`)
      .then(res => {
        const enabled = res.data?.enabled || [];
        if (enabled.length) {
          setLocales(enabled.map(code => ({
            code,
            name: LOCALE_FULL_NAMES[code] || code,
            flag: LOCALE_LABELS[code] || code.toUpperCase(),
          })));
        }
      })
      .catch(() => {});
  }, []);

  const setLocale = useCallback((code) => {
    setLocaleState(code);
    localStorage.setItem('mood-locale', code);
  }, []);

  return (
    <LocaleContext.Provider value={{
      locale,
      setLocale,
      locales,
      localeLabel: LOCALE_LABELS[locale] || locale.toUpperCase(),
      localeFullName: LOCALE_FULL_NAMES[locale] || locale,
    }}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = () => useContext(LocaleContext);
export default LocaleContext;
