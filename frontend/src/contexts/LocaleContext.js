import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

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
    return localStorage.getItem('mood_locale') || 'it';
  });
  const [locales, setLocales] = useState([
    { code: 'it', name: 'Italiano', flag: 'IT' },
    { code: 'en-us', name: 'English (US)', flag: 'EN' },
    { code: 'fr', name: 'Français', flag: 'FR' },
    { code: 'de', name: 'Deutsch', flag: 'DE' },
    { code: 'es', name: 'Español', flag: 'ES' },
  ]);

  useEffect(() => {
    // Fetch available locales from backend
    axios.get(`${BACKEND_URL}/api/corporate/locales`)
      .then(res => { if (res.data?.locales?.length) setLocales(res.data.locales); })
      .catch(() => {});
  }, []);

  const setLocale = useCallback((code) => {
    setLocaleState(code);
    localStorage.setItem('mood_locale', code);
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
