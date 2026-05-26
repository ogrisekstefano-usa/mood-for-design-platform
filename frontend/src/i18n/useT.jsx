/**
 * Blueprint i18n React surface.
 *
 *   • <BlueprintI18nProvider> — wraps the workspace shell. Reads the active
 *     locale from LocaleRuntimeContext, normalises it to BCP-47, exposes
 *     `locale`, `t`, `pick`, formatters and the tenant default.
 *   • useT()      — returns { locale, t, pickLabel, fmtDate, fmtRelative, fmtNumber, fmtCurrency }
 *   • useLookups(group) — fetches /api/relationships/lookups?group=<...>
 *     (cached in-memory per tenant + locale), returns an array of
 *     `{ value, label, color, metadata, sort_order }` resolved with the active
 *     locale's fallback chain. No hardcoded labels anywhere.
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocaleRuntime } from '../contexts/LocaleRuntimeContext';
import api from '../lib/api';
import {
  toBcp47, PLATFORM_DEFAULT_LOCALE,
  pickString, pickLocaleValue, buildFallbackChain,
} from './engine';
import {
  fmtDate, fmtRelative, fmtNumber, fmtCurrency, defaultCurrencyForLocale,
} from './formatters';

const I18nContext = createContext(null);

/** Optional: provider for surfaces that don't have one (defensive default). */
export const BlueprintI18nProvider = ({ children, tenantDefaultLocale = null }) => {
  const runtime = useLocaleRuntime();
  // Bridge IT_IT → it-IT, EN_AE → en-AE, etc.
  const locale = useMemo(
    () => toBcp47(runtime?.localeCode || PLATFORM_DEFAULT_LOCALE),
    [runtime?.localeCode],
  );

  // ITER155.R2 · runtime override version — bumps on every CMS save so
  // every `t()` consumer re-renders with the new copy. No hard refresh.
  const [overrideVersion, setOverrideVersion] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const bump = () => setOverrideVersion((v) => v + 1);
    window.addEventListener('mfd:editorial-overrides:loaded', bump);
    return () => window.removeEventListener('mfd:editorial-overrides:loaded', bump);
  }, []);

  const t = useCallback(
    (key, params = null) => pickString(key, locale, params, tenantDefaultLocale),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, tenantDefaultLocale, overrideVersion],
  );

  const pickLabel = useCallback(
    (labelObj) => pickLocaleValue(labelObj, locale, tenantDefaultLocale),
    [locale, tenantDefaultLocale],
  );

  const value = useMemo(() => ({
    locale,                                  // BCP-47 active code
    tenantDefaultLocale,                     // BCP-47 or null
    chain: buildFallbackChain(locale, tenantDefaultLocale),
    t,
    pickLabel,
    fmtDate:     (iso, opts)         => fmtDate(iso, locale, opts),
    fmtRelative: (iso)               => fmtRelative(iso, locale),
    fmtNumber:   (v, opts)           => fmtNumber(v, locale, opts),
    fmtCurrency: (v, currency, opts) => fmtCurrency(v, locale, currency, opts),
    currency:    defaultCurrencyForLocale(locale),
  }), [locale, tenantDefaultLocale, t, pickLabel]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

/** Primary hook used across CRM surfaces. Falls back gracefully if provider missing. */
export function useT() {
  const ctx = useContext(I18nContext);
  // Defensive fallback: read directly from LocaleRuntime when provider absent.
  const runtime = useLocaleRuntime();
  const locale = ctx?.locale || toBcp47(runtime?.localeCode || PLATFORM_DEFAULT_LOCALE);
  if (ctx) return ctx;
  return {
    locale,
    tenantDefaultLocale: null,
    chain: buildFallbackChain(locale, null),
    t: (key, params) => pickString(key, locale, params),
    pickLabel: (labelObj) => pickLocaleValue(labelObj, locale, null),
    fmtDate:     (iso, opts)         => fmtDate(iso, locale, opts),
    fmtRelative: (iso)               => fmtRelative(iso, locale),
    fmtNumber:   (v, opts)           => fmtNumber(v, locale, opts),
    fmtCurrency: (v, currency, opts) => fmtCurrency(v, locale, currency, opts),
    currency:    defaultCurrencyForLocale(locale),
  };
}

// ─── Lookups cache ───────────────────────────────────────────────────────
// In-memory cache keyed by tenant cookie scope. Invalidate via `mfd:lookups:invalidate`.
let LOOKUPS_PROMISE = null;
let LOOKUPS_DATA = null;

function fetchAllLookups() {
  if (LOOKUPS_DATA) return Promise.resolve(LOOKUPS_DATA);
  if (LOOKUPS_PROMISE) return LOOKUPS_PROMISE;
  LOOKUPS_PROMISE = api.get('/api/relationships/lookups')
    .then((r) => {
      LOOKUPS_DATA = r.data?.lookups || {};
      return LOOKUPS_DATA;
    })
    .catch(() => { LOOKUPS_DATA = {}; return LOOKUPS_DATA; })
    .finally(() => { LOOKUPS_PROMISE = null; });
  return LOOKUPS_PROMISE;
}

export function invalidateLookupsCache() {
  LOOKUPS_DATA = null; LOOKUPS_PROMISE = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mfd:lookups:invalidate'));
  }
}

/**
 * useLookups(group) — returns:
 *   {
 *     loading: bool,
 *     items: [{ value, label, color, metadata, sort_order }],
 *     byValue: { value_key: { value, label, color, metadata, ... } },
 *     labelOf: (value_key) => string,
 *     colorOf: (value_key) => {bg, ink} | null,
 *   }
 *
 * No hardcoded labels anywhere — every value comes from the API.
 */
export function useLookups(group) {
  const { pickLabel } = useT();
  const [state, setState] = useState({ loading: true, raw: [] });
  const lastGroup = useRef(group);

  useEffect(() => {
    lastGroup.current = group;
    let cancelled = false;
    fetchAllLookups().then((all) => {
      if (cancelled || lastGroup.current !== group) return;
      setState({ loading: false, raw: all[group] || [] });
    });
    const onInvalidate = () => {
      fetchAllLookups().then((all) => {
        if (!cancelled && lastGroup.current === group) {
          setState({ loading: false, raw: all[group] || [] });
        }
      });
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('mfd:lookups:invalidate', onInvalidate);
    }
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('mfd:lookups:invalidate', onInvalidate);
      }
    };
  }, [group]);

  return useMemo(() => {
    const items = state.raw.map((r) => ({
      value:      r.value_key,
      label:      pickLabel(r.label),
      color:      r.metadata?.color || null,
      icon:       r.metadata?.icon || null,
      metadata:   r.metadata || {},
      sort_order: r.sort_order || 0,
      raw:        r,
    }));
    const byValue = Object.fromEntries(items.map((i) => [i.value, i]));
    return {
      loading: state.loading,
      items,
      byValue,
      labelOf: (v) => byValue[v]?.label || v,
      colorOf: (v) => byValue[v]?.color || null,
    };
  }, [state, pickLabel]);
}
