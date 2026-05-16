/**
 * LocaleRuntimeContext — Phase P0.2.A frontend foundation.
 *
 * Single source of truth for cultural positioning in the UI shell.
 *
 * Exposes:
 *   • localeCode       — active composite code (IT_IT, EN_US, EN_GB, EN_AE, …)
 *   • profile          — the full locale_profiles row currently in effect
 *   • source           — origin of the resolution (user / project / tenant / …)
 *   • supported        — array of supported locale codes
 *   • setLocale(code)  — persist the user preference (server + local context)
 *   • copy(token, ctx) — semantic copy accessor (runtime-aware, NOT translation)
 *
 * The provider:
 *   1. waits for auth, then calls /api/locale-runtime/resolve once
 *   2. exposes a stable context value
 *   3. re-resolves when `setLocale` succeeds
 *
 * DO NOT use this for generic i18n. Use the `copy()` accessor which returns
 * culturally repositioned strings per locale_profile.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';
import { resolveCopy } from '../lib/locale-copy';

const LocaleRuntimeContext = createContext(null);

const SYSTEM_FALLBACK_PROFILE = {
  locale_code: 'IT_IT',
  language: 'it',
  market: 'IT',
  display_name: 'Italia',
  emotional_style: 'editorial craftsmanship',
};

export const LocaleRuntimeProvider = ({ children }) => {
  const { user } = useAuth() || {};
  const [state, setState] = useState({
    localeCode: 'IT_IT',
    profile:    SYSTEM_FALLBACK_PROFILE,
    source:     'system',
    supported:  ['IT_IT', 'EN_US', 'EN_GB', 'EN_AE', 'DE_DE', 'FR_FR', 'ES_ES'],
    loading:    true,
    error:      null,
  });

  const fetchRuntime = useCallback(async () => {
    // Anonymous / pre-login: keep the system fallback. The browser locale
    // signal is still attached to the request by the browser itself — when
    // the user logs in we re-resolve immediately.
    if (!user) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    try {
      const r = await api.get('/api/locale-runtime/resolve');
      const d = r.data || {};
      setState({
        localeCode: d.locale_code || 'IT_IT',
        profile:    d.profile || SYSTEM_FALLBACK_PROFILE,
        source:     d.source || 'system',
        supported:  d.supported || ['IT_IT', 'EN_US', 'EN_GB', 'EN_AE', 'DE_DE', 'FR_FR', 'ES_ES'],
        loading:    false,
        error:      null,
      });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: 'runtime_unreachable' }));
    }
  }, [user]);

  useEffect(() => { fetchRuntime(); }, [fetchRuntime]);

  const setLocale = useCallback(async (code) => {
    if (!code) return;
    try {
      await api.put('/api/locale-runtime/preference', { locale_code: code });
      await fetchRuntime();
    } catch (e) {
      setState((s) => ({ ...s, error: 'preference_save_failed' }));
    }
  }, [fetchRuntime]);

  // Semantic copy accessor — culturally repositioned, NOT translated.
  // The registry lives in /app/frontend/src/lib/locale-copy.js — that's
  // also the surface future AI systems will regenerate dynamically.
  const copy = useCallback((token, extra = {}) => {
    return resolveCopy(token, state.localeCode, extra);
  }, [state.localeCode]);

  const value = useMemo(() => ({
    localeCode: state.localeCode,
    profile:    state.profile,
    source:     state.source,
    supported:  state.supported,
    loading:    state.loading,
    error:      state.error,
    setLocale,
    copy,
    refresh:    fetchRuntime,
  }), [state, setLocale, copy, fetchRuntime]);

  return (
    <LocaleRuntimeContext.Provider value={value}>
      {children}
    </LocaleRuntimeContext.Provider>
  );
};

export const useLocaleRuntime = () => {
  const ctx = useContext(LocaleRuntimeContext);
  if (!ctx) {
    // Never crash UI surfaces if the provider isn't mounted (defensive).
    return {
      localeCode: 'IT_IT',
      profile:    SYSTEM_FALLBACK_PROFILE,
      source:     'system',
      supported:  ['IT_IT', 'EN_US', 'EN_GB', 'EN_AE', 'DE_DE', 'FR_FR', 'ES_ES'],
      loading:    false,
      error:      null,
      setLocale:  () => Promise.resolve(),
      copy:       (token) => `[${token}]`,
      refresh:    () => Promise.resolve(),
    };
  }
  return ctx;
};
