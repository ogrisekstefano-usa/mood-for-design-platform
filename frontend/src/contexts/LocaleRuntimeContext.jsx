/**
 * LocaleRuntimeContext — Phase P0.2.A foundation, extended P0.2.C.
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
 * Resolution paths:
 *   • Authenticated user      → /api/locale-runtime/resolve
 *   • Anonymous (P0.2.C)      → /api/locale-runtime/resolve/public
 *
 * Anonymous flows (StartProjectWizard, public storefront, magazine
 * articles) get cultural runtime BEFORE login. Their preference is
 * stored locally (mfd_public_locale) until they sign up.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';
import { resolveCopy } from '../lib/locale-copy';

const LocaleRuntimeContext = createContext(null);

const PUBLIC_LOCALE_STORAGE_KEY = 'mfd_public_locale';

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
    anonymous:  !user,
  });

  const fetchRuntime = useCallback(async () => {
    if (user) {
      // Authenticated path — full priority chain (user > project > lead > tenant > browser).
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
          anonymous:  false,
        });
      } catch (e) {
        setState((s) => ({ ...s, loading: false, error: 'runtime_unreachable' }));
      }
      return;
    }
    // Anonymous path — public resolver. Reads any saved preference and
    // sends it as a hint so the resolver chain honours it.
    let saved = null;
    try {
      saved = localStorage.getItem(PUBLIC_LOCALE_STORAGE_KEY);
    } catch (_) { /* ignore */ }
    try {
      const params = saved ? { saved_locale: saved } : {};
      const r = await api.get('/api/locale-runtime/resolve/public', { params });
      const d = r.data || {};
      setState({
        localeCode: d.locale_code || 'IT_IT',
        profile:    d.profile || SYSTEM_FALLBACK_PROFILE,
        source:     d.source || 'system',
        supported:  d.supported || ['IT_IT', 'EN_US', 'EN_GB', 'EN_AE', 'DE_DE', 'FR_FR', 'ES_ES'],
        loading:    false,
        error:      null,
        anonymous:  true,
      });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: 'runtime_unreachable', anonymous: true }));
    }
  }, [user]);

  useEffect(() => { fetchRuntime(); }, [fetchRuntime]);

  const setLocale = useCallback(async (code) => {
    if (!code) return;
    // Anonymous flow: persist locally, re-resolve via public endpoint.
    if (!user) {
      try {
        localStorage.setItem(PUBLIC_LOCALE_STORAGE_KEY, code);
      } catch (_) { /* ignore */ }
      // Re-resolve immediately with the saved hint.
      try {
        const r = await api.get('/api/locale-runtime/resolve/public', {
          params: { saved_locale: code },
        });
        const d = r.data || {};
        setState({
          localeCode: d.locale_code || 'IT_IT',
          profile:    d.profile || SYSTEM_FALLBACK_PROFILE,
          source:     d.source || 'system',
          supported:  d.supported || ['IT_IT', 'EN_US', 'EN_GB', 'EN_AE', 'DE_DE', 'FR_FR', 'ES_ES'],
          loading:    false,
          error:      null,
          anonymous:  true,
        });
      } catch (e) {
        setState((s) => ({ ...s, error: 'preference_save_failed' }));
      }
      return;
    }
    // Authenticated flow: persist server-side, then re-resolve.
    try {
      await api.put('/api/locale-runtime/preference', { locale_code: code });
      await fetchRuntime();
    } catch (e) {
      setState((s) => ({ ...s, error: 'preference_save_failed' }));
    }
  }, [user, fetchRuntime]);

  // Semantic copy accessor — culturally repositioned, NOT translated.
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
    anonymous:  state.anonymous,
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
      anonymous:  true,
      setLocale:  () => Promise.resolve(),
      copy:       (token) => `[${token}]`,
      refresh:    () => Promise.resolve(),
    };
  }
  return ctx;
};
