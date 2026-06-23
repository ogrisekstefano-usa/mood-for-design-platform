import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { LOCALIZED_SLUGS } from '../corporate/routes/localizedSlugs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * detectBrowserLocale()
 * ─────────────────────────────────────────────────────────────────────────
 * Returns the best-guess locale SYNCHRONOUSLY — no API, no async.
 * Used as the initial React state so the first paint is never null.
 *
 * Strategy:
 *   1) localStorage 'mood-locale' / 'mood_locale' — explicit user preference
 *   2) navigator.language — browser signal (coerced to BCP-47 base)
 *   3) 'en-US' — safe fallback
 *
 * NOTE: This is overridden after the API bootstrap completes (resolveInitial).
 * Its only purpose is to prevent a null→value locale flash.
 */
export const detectBrowserLocale = () => {
  try {
    const stored = localStorage.getItem('mood-locale') || localStorage.getItem('mood_locale');
    if (stored) return stored;
  } catch { /* localStorage blocked */ }
  try {
    const nav = navigator.language || navigator.userLanguage || '';
    if (nav) return nav;          // e.g. 'it-IT' or 'it' — downstream will normalise
  } catch { /* SSR / restricted env */ }
  return 'en-US';
};

/**
 * LocaleContext — Market-first locale architecture.
 *
 * Source of truth is the DB:
 *   • GET /api/site/locales  → platform_languages (enabled BCP-47 codes)
 *   • GET /api/markets       → markets catalog enriched with effective_locale, rtl
 *
 * NO HARDCODED:
 *   - no LOCALE_LABELS, no LOCALE_FULL_NAMES, no LEGACY_ALIAS
 *   - no static market or country arrays
 *   - default locale and default market come from the API responses
 */
const LocaleContext = createContext({
  // Lingua
  locale: null,
  setLocale: () => {},
  locales: [],
  localeLabel: '',
  // Mercato
  market: null,
  setMarket: () => {},
  markets: [],
  marketGroups: [],
  defaultMarketCode: null,
  // Derivati
  currency: null,
  direction: 'ltr',
  countries: [],
  // Stato
  ready: false,
});

// Reverse-lookup: from a path like "/audience" find its canonical key.
const slugToCanonical = (path) => {
  for (const [canonical, locales] of Object.entries(LOCALIZED_SLUGS)) {
    for (const [code, slug] of Object.entries(locales)) {
      if (slug === path) return { canonical, locale: code };
    }
  }
  return null;
};

const readStored = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const writeStored = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
};

export const LocaleProvider = ({ children }) => {
  const [locales, setLocales]   = useState([]);   // from /api/site/locales
  const [markets, setMarkets]   = useState([]);   // from /api/markets
  const [groups, setGroups]     = useState([]);
  const [defaultLocale, setDefaultLocale] = useState(null);
  const [defaultMarketCode, setDefaultMarketCode] = useState(null);
  const [marketCode, setMarketCode] = useState(null);
  const [locale, setLocaleState]   = useState(() => detectBrowserLocale()); // sync initial value
  const [ready, setReady] = useState(false);

  // ── Bootstrap: fetch catalogs in parallel, then resolve initial state ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [localesRes, marketsRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/site/locales`),
          axios.get(`${BACKEND_URL}/api/markets`),
        ]);
        if (cancelled) return;

        const enrichedLocales = localesRes.data?.locales || [];
        const defLocale = localesRes.data?.default || null;
        const mkList    = marketsRes.data?.markets || [];
        const mkGroups  = marketsRes.data?.groups  || [];
        const defMkCode = marketsRes.data?.default_market || null;

        setLocales(enrichedLocales);
        setMarkets(mkList);
        setGroups(mkGroups);
        setDefaultLocale(defLocale);
        setDefaultMarketCode(defMkCode);

        // Resolve initial market + locale.
        const initial = resolveInitial({
          path: window.location.pathname,
          markets: mkList,
          enabled: enrichedLocales.map(l => l.code),
          defaultMarket: defMkCode,
          defaultLocale: defLocale,
        });
        setMarketCode(initial.market);
        setLocaleState(initial.locale);
        setReady(true);
      } catch (err) {
        // API unreachable: keep ready=false but do not crash UI.
        if (!cancelled) setReady(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Sync <html lang> and <html dir> when locale or markets change ──
  useEffect(() => {
    if (!locale) return;
    document.documentElement.setAttribute('lang', locale);
    const meta = locales.find(l => l.code === locale);
    document.documentElement.setAttribute('dir', meta?.rtl ? 'rtl' : 'ltr');
  }, [locale, locales]);

  // ── Public setters ──
  const setMarket = (code) => {
    const m = markets.find(x => x.code === code);
    if (!m) return;
    setMarketCode(code);
    setLocaleState(m.effective_locale);
    writeStored('mood-market', code);
    writeStored('mood-locale', m.effective_locale);
  };

  const setLocale = (code) => {
    // Legacy setter (locale-only). Used by Studio Activation language chooser.
    if (!locales.find(l => l.code === code)) return;
    setLocaleState(code);
    writeStored('mood-locale', code);
  };

  // ── Derived values ──
  const market = useMemo(
    () => markets.find(m => m.code === marketCode) || null,
    [markets, marketCode],
  );

  const localeMeta = useMemo(
    () => locales.find(l => l.code === locale) || null,
    [locales, locale],
  );

  const ctxValue = useMemo(() => ({
    // Lingua
    locale,
    setLocale,
    locales,
    localeLabel: localeMeta?.short_label || localeMeta?.code || '',
    // Mercato
    market,
    setMarket,
    markets,
    marketGroups: groups,
    defaultMarketCode,
    // Derivati
    currency:  market?.currency  || null,
    direction: localeMeta?.rtl ? 'rtl' : 'ltr',
    countries: market?.countries || [],
    // Stato
    ready,
  }), [locale, locales, localeMeta, market, markets, groups, defaultMarketCode, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LocaleContext.Provider value={ctxValue}>
      {children}
    </LocaleContext.Provider>
  );
};

/**
 * Resolve which market to bootstrap with at first paint.
 * Strategy (in order):
 *   1) URL slug already implies a locale → pick a market whose primary/effective_locale matches.
 *   2) localStorage mood-market → use it if still valid.
 *   3) localStorage mood-locale → pick first market with that primary_locale.
 *   4) navigator.language base-match → first market whose primary_locale begins with that base.
 *   5) defaultMarket from API.
 */
const resolveInitial = ({ path, markets, enabled, defaultMarket, defaultLocale }) => {
  const findMarketByLocale = (loc) =>
    markets.find(m => m.primary_locale === loc) ||
    markets.find(m => m.effective_locale === loc);

  // 1) URL slug
  const fromSlug = slugToCanonical(path);
  if (fromSlug) {
    const m = findMarketByLocale(fromSlug.locale);
    if (m) return { market: m.code, locale: m.effective_locale };
  }

  // 2) localStorage mood-market
  const storedMarket = readStored('mood-market');
  if (storedMarket) {
    const m = markets.find(x => x.code === storedMarket);
    if (m) return { market: m.code, locale: m.effective_locale };
  }

  // 3) localStorage mood-locale
  const storedLocale = readStored('mood-locale') || readStored('mood_locale');
  if (storedLocale) {
    const m = findMarketByLocale(storedLocale);
    if (m) return { market: m.code, locale: m.effective_locale };
    if (enabled.includes(storedLocale)) {
      // Locale enabled but no matching market — pick default market, keep locale.
      const fb = markets.find(x => x.code === defaultMarket) || markets[0];
      return { market: fb?.code || null, locale: storedLocale };
    }
  }

  // 4) navigator.language base-match
  if (typeof navigator !== 'undefined' && navigator.language) {
    const base = navigator.language.split('-')[0];
    const m = markets.find(x => x.primary_locale.split('-')[0] === base);
    if (m) return { market: m.code, locale: m.effective_locale };
  }

  // 5) API default
  const fb = markets.find(x => x.code === defaultMarket) || markets[0];
  return {
    market: fb?.code || null,
    locale: fb?.effective_locale || defaultLocale || null,
  };
};

export const useLocale = () => useContext(LocaleContext);
export default LocaleContext;
