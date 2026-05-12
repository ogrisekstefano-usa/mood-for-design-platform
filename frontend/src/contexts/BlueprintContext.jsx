/**
 * BlueprintContext — tenant config + theme + i18n + module registry + permissions + impersonation.
 *
 * Tenant impersonation: when set, axios sends `X-Tenant-Override` header so backend
 * scopes queries to that tenant (super_admin only). Stored in sessionStorage.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import api from '../lib/api';
import { useAuth } from './AuthContext';

const BlueprintContext = createContext(null);
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const LOCALE_KEY = 'mfd_locale';
const IMPERSONATE_KEY = 'mfd_impersonate_tenant';
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
  const stored = localStorage.getItem(LOCALE_KEY);
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
  const [modules, setModules] = useState(null);
  const [featureFlags, setFeatureFlags] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [impersonating, setImpersonating] = useState(() => sessionStorage.getItem(IMPERSONATE_KEY));
  const [locale, setLocaleState] = useState(detectInitialLocale());
  const [messages, setMessages] = useState({});
  const [availableLocales, setAvailableLocales] = useState(FALLBACK_LOCALES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/blueprint/i18n`)
      .then((r) => setAvailableLocales(r.data.locales || FALLBACK_LOCALES))
      .catch(() => {});
  }, []);

  const loadMessages = useCallback(async (loc, slug) => {
    try {
      const params = slug ? `?tenant_slug=${encodeURIComponent(slug)}` : '';
      const { data } = await axios.get(`${BACKEND_URL}/api/blueprint/i18n/${loc}${params}`);
      setMessages(data.messages || {});
    } catch (_) { setMessages({}); }
  }, []);

  // Load tenant/modules/flags/permissions on user change OR impersonation change
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setTenant(null); setNavigation(null); setDashboardConfig(null);
        setModules(null); setFeatureFlags(null); setPermissions([]); setIsSuperAdmin(false);
        await loadMessages(locale, null);
        setLoading(false);
        return;
      }
      const results = await Promise.allSettled([
        api.get('/api/blueprint/tenant/me'),
        api.get('/api/blueprint/navigation'),
        api.get('/api/blueprint/dashboard'),
        api.get('/api/blueprint/modules'),
        api.get('/api/blueprint/feature-flags'),
        api.get('/api/blueprint/me/permissions'),
      ]);
      if (cancelled) return;
      const [tRes, nRes, dRes, mRes, fRes, pRes] = results;
      let tData = null;
      if (tRes.status === 'fulfilled') {
        tData = tRes.value.data;
        setTenant(tData);
        applyTheme(tData?.theme);
        if (!localStorage.getItem(LOCALE_KEY) && tData?.locales?.default) {
          setLocaleState(tData.locales.default);
        }
      }
      if (nRes.status === 'fulfilled') setNavigation(nRes.value.data);
      if (dRes.status === 'fulfilled') setDashboardConfig(dRes.value.data);
      if (mRes.status === 'fulfilled') setModules(mRes.value.data);
      if (fRes.status === 'fulfilled') setFeatureFlags(fRes.value.data);
      if (pRes.status === 'fulfilled') {
        setPermissions(pRes.value.data.permissions || []);
        setIsSuperAdmin(!!pRes.value.data.is_super_admin);
      }
      await loadMessages(locale, tData?.slug);
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.tenant_id, user?.profile_id, impersonating]);

  useEffect(() => { loadMessages(locale, tenant?.slug); }, [locale, tenant?.slug, loadMessages]);

  const setLocale = useCallback((newLocale) => {
    localStorage.setItem(LOCALE_KEY, newLocale);
    setLocaleState(newLocale);
  }, []);

  const startImpersonation = useCallback((tenantId) => {
    sessionStorage.setItem(IMPERSONATE_KEY, tenantId);
    setImpersonating(tenantId);
  }, []);

  const stopImpersonation = useCallback(() => {
    sessionStorage.removeItem(IMPERSONATE_KEY);
    setImpersonating(null);
  }, []);

  const t = useCallback((key, vars, fallback) => {
    const value = messages[key];
    if (value === undefined) return interpolate(fallback || key, vars);
    return interpolate(value, vars);
  }, [messages]);

  const can = useCallback((perm) => permissions.includes(perm), [permissions]);

  const enabledModuleIds = useMemo(() => new Set(modules?.modules?.map((m) => m.id) || []), [modules]);
  const isModuleEnabled = useCallback((id) => enabledModuleIds.has(id), [enabledModuleIds]);

  const value = useMemo(() => ({
    tenant, navigation, dashboardConfig, modules, featureFlags,
    permissions, isSuperAdmin, can, isModuleEnabled,
    impersonating, startImpersonation, stopImpersonation,
    locale, setLocale, availableLocales, messages, t, loading,
  }), [tenant, navigation, dashboardConfig, modules, featureFlags,
       permissions, isSuperAdmin, can, isModuleEnabled,
       impersonating, startImpersonation, stopImpersonation,
       locale, setLocale, availableLocales, messages, t, loading]);

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
