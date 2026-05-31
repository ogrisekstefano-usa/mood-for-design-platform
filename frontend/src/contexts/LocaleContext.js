import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { LOCALIZED_SLUGS } from '../corporate/routes/localizedSlugs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Locale Architecture Directive (2026-05-31): BCP-47 with region.
// These labels are pure display helpers — the canonical source is the
// /api/site/locales endpoint backed by platform_languages.
const LOCALE_LABELS = {
  'it-IT': 'IT',
  'en-US': 'EN',
  'en-GB': 'EN',
  'fr-FR': 'FR',
  'de-DE': 'DE',
  'es-ES': 'ES',
  'es-MX': 'ES',
  'ar-AE': 'AR',
  'pt-BR': 'PT',
  'pt-PT': 'PT',
  'zh-CN': 'ZH',
  'ja-JP': 'JA',
};

const LOCALE_FULL_NAMES = {
  'it-IT': 'Italiano',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'fr-FR': 'Français',
  'de-DE': 'Deutsch',
  'es-ES': 'Español',
  'es-MX': 'Español (MX)',
  'ar-AE': 'العربية',
  'pt-BR': 'Português (BR)',
  'pt-PT': 'Português',
  'zh-CN': '中文',
  'ja-JP': '日本語',
};

// Legacy alias map for migration from old non-region codes.
const LEGACY_ALIAS = {
  'it': 'it-IT',
  'en': 'en-US',
  'en-us': 'en-US',
  'en-uk': 'en-GB',
  'en-gb': 'en-GB',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'es': 'es-ES',
};

const normalize = (code) => LEGACY_ALIAS[code] || code;

const BOOTSTRAP_DEFAULT = 'it-IT';

const LocaleContext = createContext({
  locale: BOOTSTRAP_DEFAULT,
  setLocale: () => {},
  locales: [],
  localeLabel: 'IT',
  localeFullName: 'Italiano',
});

export const LocaleProvider = ({ children }) => {
  const [locale, setLocaleState] = useState(() => {
    const stored = localStorage.getItem('mood-locale') || localStorage.getItem('mood_locale');
    // 1) Detect locale from URL path (slug matches localized variant).
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    for (const [, locales] of Object.entries(LOCALIZED_SLUGS)) {
      for (const [code, slug] of Object.entries(locales)) {
        if (slug === path) return normalize(code);
      }
    }
    // 2) Honor an explicit prior user choice (normalized).
    if (stored) return normalize(stored);
    // 3) Bootstrap default. The actual platform default is loaded async
    //    from /api/site/locales below.
    return BOOTSTRAP_DEFAULT;
  });
  const [locales, setLocales] = useState([
    { code: 'it-IT', name: 'Italiano',     flag: 'IT' },
    { code: 'en-US', name: 'English (US)', flag: 'EN' },
  ]);

  useEffect(() => {
    // Fetch enabled locales from the canonical source (platform_languages).
    axios.get(`${BACKEND_URL}/api/site/locales`)
      .then(res => {
        const enabled = res.data?.enabled || [];
        if (enabled.length) {
          setLocales(enabled.map(code => ({
            code,
            name: LOCALE_FULL_NAMES[code] || code,
            flag: LOCALE_LABELS[code] || code.split('-')[0].toUpperCase(),
          })));
        }
        // If current locale is not in enabled list, fall back to platform default
        const defaultLocale = res.data?.default;
        if (defaultLocale && enabled.length && !enabled.includes(locale)) {
          setLocaleState(defaultLocale);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setLocale = useCallback((code) => {
    const norm = normalize(code);
    setLocaleState(norm);
    localStorage.setItem('mood-locale', norm);
  }, []);

  return (
    <LocaleContext.Provider value={{
      locale,
      setLocale,
      locales,
      localeLabel: LOCALE_LABELS[locale] || locale.split('-')[0].toUpperCase(),
      localeFullName: LOCALE_FULL_NAMES[locale] || locale,
    }}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = () => useContext(LocaleContext);
export default LocaleContext;
