/**
 * BlueprintContext — loads tenant config (theme + locales + navigation) and i18n strings.
 *
 * No hardcoded text in components — they use t('key.path').
 * Theme variables are applied as CSS custom properties on <html>.
 * Locale can be switched at runtime; tenant override is respected via tenant_slug.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import api from '../lib/api';
import { useAuth } from './AuthContext';

const BlueprintContext = createContext(null);
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const STORAGE_KEY = 'mfd_locale';
const DEFAULT_LOCALE = 'en-US';

const FALLBACK_LOCALES = [
  { code: 'en-US', label: 'English (US)', native: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)', native: 'English (UK)' },
  { code: 'it', label: 'Italian', native: 'Italiano' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'de', label: 'German', native: 'Deutsch' },
  { code: 'es', label: 'Spanish', native: 'Español' },
];

function detectInitialLocale() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  if (typeof navigator !== 'undefined' && navigator.language) {
    const nl = navigator.language;
    if (FALLBACK_LOCALES.find((l) => l.code === nl)) return nl;
    const base = nl.split('-')[0];
    if (FALLBACK_LOCALES.find((l) => l.code === base)) return base;
  }
  return DEFAULT_LOCALE;
}

const applyTheme = (theme) => {
  if (!theme) return;
  const root = document.documentElement;
  if (theme.primary_color) root.style.setProperty('--bp-primary', theme.primary_color);
  if (theme.secondary_color) root.style.setProperty('--bp-accent', theme.secondary_color);
  if (theme.font_heading && theme.font_heading !== 'serif') {
    root.style.setProperty('--bp-font-heading', theme.font_heading);
  }
  if (theme.font_body && theme.font_body !== 'sans-serif') {
    root.style.setProperty('--bp-font-body', theme.font_body);
  }
};

const interpolate = (template, vars) => {
  if (!template || !vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
};

export const BlueprintProvider = ({ children }) => {
  const { user } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [navigation, setNavigation] = useState(null);
  const [dashboardConfig, setDashboardConfig] = useState(null);
  const [locale, setLocaleState] = useState(detectInitialLocale());
  const [messages, setMessages] = useState({});
  const [availableLocales, setAvailableLocales] = useState(FALLBACK_LOCALES);
  const [loading, setLoading] = useState(true);

  // Load available locales once
  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/blueprint/i18n`)
      .then((r) => setAvailableLocales(r.data.locales || FALLBACK_LOCALES))
      .catch(() => {});
  }, []);

  // Load locale messages (re-fetch on locale change OR tenant change)
  const loadMessages = useCallback(async (loc, slug) => {
    try {
      const params = slug ? `?tenant_slug=${encodeURIComponent(slug)}` : '';
      const { data } = await axios.get(`${BACKEND_URL}/api/blueprint/i18n/${loc}${params}`);
      setMessages(data.messages || {});
    } catch (_) {
      setMessages({});
    }
  }, []);

  // When user logs in: load tenant + navigation + dashboard config
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user?.tenant_id) {
        setTenant(null);
        setNavigation(null);
        setDashboardConfig(null);
        await loadMessages(locale, null);
        setLoading(false);
        return;
      }
      const [tRes, nRes, dRes] = await Promise.allSettled([
        api.get('/api/blueprint/tenant/me'),
        api.get('/api/blueprint/navigation'),
        api.get('/api/blueprint/dashboard'),
      ]);
      if (cancelled) return;
      let tData = null;
      if (tRes.status === 'fulfilled') {
        tData = tRes.value.data;
        setTenant(tData);
        applyTheme(tData?.theme);
        if (!localStorage.getItem(STORAGE_KEY) && tData?.locales?.default) {
          setLocaleState(tData.locales.default);
        }
      }
      if (nRes.status === 'fulfilled') setNavigation(nRes.value.data);
      else {
        // retry once
        try { const r = await api.get('/api/blueprint/navigation'); setNavigation(r.data); } catch (_) {}
      }
      if (dRes.status === 'fulfilled') setDashboardConfig(dRes.value.data);
      else {
        try { const r = await api.get('/api/blueprint/dashboard'); setDashboardConfig(r.data); } catch (_) {}
      }
      await loadMessages(locale, tData?.slug);
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.tenant_id]);

  // Reload messages when locale changes
  useEffect(() => {
    loadMessages(locale, tenant?.slug);
  }, [locale, tenant?.slug, loadMessages]);

  const setLocale = useCallback((newLocale) => {
    localStorage.setItem(STORAGE_KEY, newLocale);
    setLocaleState(newLocale);
  }, []);

  const t = useCallback((key, vars, fallback) => {
    const value = messages[key];
    if (value === undefined) return interpolate(fallback || key, vars);
    return interpolate(value, vars);
  }, [messages]);

  const value = useMemo(() => ({
    tenant,
    navigation,
    dashboardConfig,
    locale,
    setLocale,
    availableLocales,
    messages,
    t,
    loading,
  }), [tenant, navigation, dashboardConfig, locale, setLocale, availableLocales, messages, t, loading]);

  return <BlueprintContext.Provider value={value}>{children}</BlueprintContext.Provider>;
};

export const useBlueprint = () => {
  const ctx = useContext(BlueprintContext);
  if (!ctx) throw new Error('useBlueprint must be inside BlueprintProvider');
  return ctx;
};

export const useT = () => {
  const { t } = useBlueprint();
  return t;
};

export default BlueprintContext;
